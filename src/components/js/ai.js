// 大模型 API 调用封装
// 支持 OpenAI 兼容接口（/v1/chat/completions）
// 支持 SSE 流式输出和普通非流式调用

import aiConfig from './aiConfig.js'

/**
 * 构建请求头
 * @param {string} apiKey
 * @returns {object}
 */
function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }
}

/**
 * 普通（非流式）对话调用
 * @param {Array} messages - [{role: 'user'|'assistant'|'system', content: string}]
 * @param {object} [options] - 覆盖默认配置
 * @returns {Promise<string>} AI 回复文本
 */
async function chat(messages, options = {}) {
  const cfg = aiConfig.getConfig()
  const apiUrl = options.apiUrl || cfg.apiUrl
  const apiKey = options.apiKey || cfg.apiKey
  const model = options.model || cfg.model

  if (!apiUrl || !apiKey || !model) {
    throw new Error('请先在设置中配置大模型接口地址、API Key 和模型名称')
  }

  const endpoint = apiUrl.replace(/\/$/, '') + '/v1/chat/completions'

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096
    })
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`API 请求失败 (${resp.status})：${errText || resp.statusText}`)
  }

  const data = await resp.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * 流式对话调用（SSE）
 * @param {Array} messages - [{role, content}]
 * @param {Function} onChunk - 每收到一个文本片段时回调，参数为增量文本
 * @param {Function} onDone - 流结束时回调，参数为完整文本
 * @param {Function} onError - 出错时回调，参数为 Error
 * @param {object} [options] - 覆盖默认配置
 * @returns {Function} abort 函数，调用后中止流
 */
function streamChat(messages, onChunk, onDone, onError, options = {}) {
  const cfg = aiConfig.getConfig()
  const apiUrl = options.apiUrl || cfg.apiUrl
  const apiKey = options.apiKey || cfg.apiKey
  const model = options.model || cfg.model

  if (!apiUrl || !apiKey || !model) {
    onError?.(new Error('请先在设置中配置大模型接口地址、API Key 和模型名称'))
    return () => {}
  }

  const endpoint = apiUrl.replace(/\/$/, '') + '/v1/chat/completions'
  const controller = new AbortController()

  ;(async () => {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096
        }),
        signal: controller.signal
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        throw new Error(`API 请求失败 (${resp.status})：${errText || resp.statusText}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let fullText = ''
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // 最后一行可能不完整，保留到下次处理
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              fullText += delta
              onChunk?.(delta, fullText)
            }
          } catch {
            // 忽略解析异常的行
          }
        }
      }

      onDone?.(fullText)
    } catch (err) {
      if (err.name === 'AbortError') {
        // 用户主动中止，不算错误
        onDone?.('')
        return
      }
      onError?.(err)
    }
  })()

  return () => controller.abort()
}

/**
 * 向知识库发起 RAG 查询
 * @param {string} question 用户问题
 * @param {string} [kbUrlOverride] 覆盖配置中的知识库地址
 * @returns {Promise<string>} 知识库返回的上下文文本
 */
async function queryKnowledgeBase(question, kbUrlOverride) {
  const segments = await queryKnowledgeBaseSegments(question, { kbUrlOverride })
  return segments.map((item) => item.content).filter(Boolean).join('\n\n')
}

/**
 * 向知识库发起 RAG 查询，返回结构化片段
 * @param {string} question 用户问题
 * @param {object} [options]
 * @param {string} [options.kbUrlOverride] 覆盖配置中的知识库地址
 * @param {string} [options.kbDatasetId] 覆盖当前选择的 Dify 知识库 ID
 * @param {number} [options.topK] 覆盖检索片段数量
 * @returns {Promise<Array<{content: string, score: number|null, source: string, metadata: object}>>}
 */
async function queryKnowledgeBaseSegments(question, options = {}) {
  const cfg = aiConfig.getConfig()
  const kbUrl = options.kbUrlOverride || cfg.kbUrl
  if (!question || !kbUrl || !isKnowledgeBaseConfigured(cfg)) return []

  if (cfg.kbProvider === 'dify') {
    const kbDatasetId = options.kbDatasetId || cfg.kbDatasetId
    if (!kbDatasetId) return []
    return queryDifyKnowledgeBase(question, {
      kbUrl,
      kbApiKey: cfg.kbApiKey,
      kbDatasetId,
      kbTopK: options.topK || cfg.kbTopK
    })
  }

  return queryCustomKnowledgeBase(question, kbUrl, options.topK || cfg.kbTopK)
}

/**
 * 调用 Dify 知识库检索接口
 * @param {string} question 用户问题
 * @param {object} config Dify 知识库配置
 * @returns {Promise<Array<{content: string, score: number|null, source: string, metadata: object}>>}
 */
async function queryDifyKnowledgeBase(question, config) {
  const { kbUrl, kbApiKey, kbDatasetId } = config
  if (!kbUrl || !kbApiKey || !kbDatasetId) return []

  const topK = normalizeTopK(config.kbTopK)

  try {
    const endpoint = `${kbUrl.replace(/\/$/, '')}/datasets/${encodeURIComponent(kbDatasetId)}/retrieve`
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(kbApiKey),
      body: JSON.stringify({
        query: question,
        retrieval_model: {
          search_method: 'semantic_search',
          reranking_enable: false,
          top_k: topK,
          score_threshold_enabled: false
        }
      })
    })
    if (!resp.ok) return []
    const data = await resp.json()
    if (!Array.isArray(data.records)) return []
    return data.records
      .map((record) => {
        const segment = record.segment || {}
        const document = segment.document || record.document || {}
        const dataset = record.dataset || {}
        const source =
          document.name ||
          segment.document_name ||
          dataset.name ||
          segment.keyword ||
          record.title ||
          'Dify 知识库'
        return normalizeKnowledgeSegment({
          content: segment.content || record.content || '',
          score: record.score ?? segment.score ?? null,
          source,
          metadata: {
            segmentId: segment.id || record.segment_id || '',
            documentId: document.id || segment.document_id || '',
            datasetId: dataset.id || kbDatasetId
          }
        })
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 调用项目原有的自定义 RAG 服务
 * @param {string} question 用户问题
 * @param {string} kbUrl 知识库服务地址
 * @param {number} kbTopK 检索片段数量
 * @returns {Promise<Array<{content: string, score: number|null, source: string, metadata: object}>>}
 */
async function queryCustomKnowledgeBase(question, kbUrl, kbTopK) {
  try {
    const endpoint = kbUrl.replace(/\/$/, '') + '/query'
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: normalizeTopK(kbTopK) })
    })
    if (!resp.ok) return []
    const data = await resp.json()
    // 兼容常见 RAG 接口返回格式
    if (Array.isArray(data.results)) {
      return data.results
        .map((item) =>
          normalizeKnowledgeSegment({
            content: item.content || item.text || item.chunk || '',
            score: item.score ?? item.similarity ?? item.relevance ?? null,
            source: item.source || item.title || item.document || item.doc_name || '知识库',
            metadata: item.metadata || {}
          })
        )
        .filter(Boolean)
    }
    if (Array.isArray(data.data)) {
      return data.data
        .map((item) =>
          normalizeKnowledgeSegment({
            content: item.content || item.text || item.chunk || '',
            score: item.score ?? item.similarity ?? item.relevance ?? null,
            source: item.source || item.title || item.document || item.doc_name || '知识库',
            metadata: item.metadata || {}
          })
        )
        .filter(Boolean)
    }
    if (typeof data.context === 'string') {
      return splitContextToSegments(data.context)
    }
    return []
  } catch {
    return []
  }
}

/**
 * 获取 Dify 可见知识库列表
 * @param {object} [options]
 * @param {string} [options.kbUrl] Dify API 地址
 * @param {string} [options.kbApiKey] Dify API Key
 * @param {string} [options.keyword] 按名称筛选
 * @returns {Promise<Array<{id: string, name: string, description: string, documentCount: number, provider: string}>>}
 */
async function listDifyDatasets(options = {}) {
  const cfg = aiConfig.getConfig()
  const kbUrl = String(options.kbUrl || cfg.kbUrl || '').trim()
  const kbApiKey = String(options.kbApiKey || cfg.kbApiKey || '').trim()
  const keyword = String(options.keyword || '').trim()
  if (!kbUrl || !kbApiKey) return []

  const all = []
  let page = 1
  const limit = 20

  for (;;) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit)
    })
    if (keyword) params.set('keyword', keyword)

    const endpoint = `${kbUrl.replace(/\/$/, '')}/datasets?${params.toString()}`
    const resp = await fetchDifyJson(endpoint, kbApiKey, '获取 Dify 知识库列表')

    const data = resp.data
    if (Array.isArray(data.data)) {
      all.push(
        ...data.data
          .map((item) => ({
            id: item.id || '',
            name: item.name || '未命名知识库',
            description: item.description || '',
            documentCount: item.total_available_documents ?? item.document_count ?? item.total_documents ?? 0,
            provider: item.provider || ''
          }))
          .filter((item) => item.id)
      )
    }

    if (!data.has_more) break
    page += 1
  }

  return all
}

async function fetchDifyJson(endpoint, apiKey, actionName) {
  let resp
  try {
    resp = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(apiKey)
    })
  } catch (err) {
    throw new Error(`${actionName}失败：无法访问 Dify API，请检查地址是否可访问，以及 Dify 服务是否允许当前加载项跨域请求。`)
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`${actionName}失败 (${resp.status})：${errText || resp.statusText}`)
  }

  return {
    status: resp.status,
    data: await resp.json()
  }
}

/**
 * 判断知识库配置是否完整
 * @param {object} [cfg]
 * @returns {boolean}
 */
function isKnowledgeBaseConfigured(cfg = aiConfig.getConfig()) {
  if (cfg.kbProvider === 'dify') {
    return !!(cfg.kbUrl && cfg.kbApiKey)
  }
  return !!cfg.kbUrl
}

function normalizeKnowledgeSegment(item) {
  const content = String(item.content || '').trim()
  if (!content) return null

  const score = Number(item.score)
  return {
    content,
    score: Number.isFinite(score) ? score : null,
    source: item.source || '知识库',
    metadata: item.metadata || {}
  }
}

function splitContextToSegments(context) {
  return String(context || '')
    .split(/\n{2,}/)
    .map((content) => normalizeKnowledgeSegment({ content, score: null, source: '知识库', metadata: {} }))
    .filter(Boolean)
}

/**
 * 规范化知识库检索数量，避免配置异常导致接口请求失败
 * @param {number|string} value
 * @returns {number}
 */
function normalizeTopK(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.min(Math.max(Math.round(parsed), 1), 20)
}

/**
 * 生成图片，兼容 OpenAI 风格的 /v1/images/generations 接口。
 * @param {string} prompt 图片描述
 * @param {object} [options]
 * @returns {Promise<{url: string, revisedPrompt: string}>}
 */
async function generateImage(prompt, options = {}) {
  const cfg = aiConfig.getConfig()
  const apiUrl = options.apiUrl || cfg.apiUrl
  const apiKey = options.apiKey || cfg.apiKey
  const model = options.model || cfg.imageModel || cfg.model

  if (!apiUrl || !apiKey || !model) {
    throw new Error('请先在设置中配置大模型接口地址、API Key 和模型名称')
  }

  const endpoint = apiUrl.replace(/\/$/, '') + '/v1/images/generations'
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: options.size || '1024x1024',
      response_format: options.responseFormat || 'url'
    })
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`图片生成请求失败 (${resp.status})：${errText || resp.statusText}`)
  }

  const data = await resp.json()
  const first = data.data?.[0]
  const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '')
  if (!url) {
    throw new Error('图片接口未返回可用的图片 URL 或 base64 数据')
  }

  return {
    url,
    revisedPrompt: first?.revised_prompt || ''
  }
}

/**
 * 测试连接是否可用
 * @param {object} cfg - { apiUrl, apiKey, model }
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(cfg) {
  try {
    const result = await chat([{ role: 'user', content: '你好，请回复"连接成功"' }], {
      ...cfg,
      maxTokens: 20
    })
    return { ok: true, message: `连接成功，模型回复：${result.slice(0, 50)}` }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export default {
  chat,
  streamChat,
  queryKnowledgeBase,
  queryKnowledgeBaseSegments,
  listDifyDatasets,
  isKnowledgeBaseConfigured,
  generateImage,
  testConnection
}
