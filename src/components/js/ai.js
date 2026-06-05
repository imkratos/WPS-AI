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
  const cfg = aiConfig.getConfig()
  const kbUrl = kbUrlOverride || cfg.kbUrl
  if (!kbUrl) return ''

  if (cfg.kbProvider === 'dify') {
    return queryDifyKnowledgeBase(question, {
      kbUrl,
      kbApiKey: cfg.kbApiKey,
      kbDatasetId: cfg.kbDatasetId,
      kbTopK: cfg.kbTopK
    })
  }

  return queryCustomKnowledgeBase(question, kbUrl, cfg.kbTopK)
}

/**
 * 调用 Dify 知识库检索接口
 * @param {string} question 用户问题
 * @param {object} config Dify 知识库配置
 * @returns {Promise<string>}
 */
async function queryDifyKnowledgeBase(question, config) {
  const { kbUrl, kbApiKey, kbDatasetId } = config
  if (!kbUrl || !kbApiKey || !kbDatasetId) return ''

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
    if (!resp.ok) return ''
    const data = await resp.json()
    if (!Array.isArray(data.records)) return ''
    return data.records
      .map((record) => {
        const segment = record.segment || {}
        return segment.content || record.content || ''
      })
      .filter(Boolean)
      .join('\n\n')
  } catch {
    return ''
  }
}

/**
 * 调用项目原有的自定义 RAG 服务
 * @param {string} question 用户问题
 * @param {string} kbUrl 知识库服务地址
 * @param {number} kbTopK 检索片段数量
 * @returns {Promise<string>}
 */
async function queryCustomKnowledgeBase(question, kbUrl, kbTopK) {
  try {
    const endpoint = kbUrl.replace(/\/$/, '') + '/query'
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: normalizeTopK(kbTopK) })
    })
    if (!resp.ok) return ''
    const data = await resp.json()
    // 兼容常见 RAG 接口返回格式
    if (Array.isArray(data.results)) {
      return data.results.map((r) => r.content || r.text || '').join('\n\n')
    }
    if (typeof data.context === 'string') return data.context
    return ''
  } catch {
    return ''
  }
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
  generateImage,
  testConnection
}
