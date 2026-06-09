<template>
  <main class="ai-pane">
    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-button"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'write'" class="workspace write-workspace">
      <div class="prompt-card">
        <label class="field-label" for="writePrompt">写作需求</label>
        <textarea
          id="writePrompt"
          v-model="writePrompt"
          class="prompt-input"
          placeholder="描述要生成的内容，例如：写一份数字化转型工作总结，500 字左右，条理清晰。"
          rows="5"
          @keydown.ctrl.enter="onWrite"
        ></textarea>
        <div class="option-grid">
          <select v-model="writeStyle">
            <option value="">风格不限</option>
            <option value="professional">专业正式</option>
            <option value="casual">轻松口语</option>
            <option value="party">党政公文</option>
            <option value="academic">学术论文</option>
          </select>
          <select v-model="writeLength">
            <option value="">长度不限</option>
            <option value="short">200 字内</option>
            <option value="medium">约 500 字</option>
            <option value="long">1000 字以上</option>
          </select>
        </div>
        <div class="action-row">
          <button class="primary-button" :disabled="!writePrompt.trim() || writeGenerating" @click="onWrite">
            {{ writeGenerating ? '生成中...' : '生成文稿' }}
          </button>
          <button v-if="writeGenerating" class="danger-button" @click="stopWrite">停止</button>
        </div>
      </div>

      <article v-if="writeResult || writeGenerating" class="result-card">
        <div class="card-head">
          <span>生成结果</span>
          <button class="ghost-button" @click="copyText(writeResult)">复制</button>
        </div>
        <pre class="result-text">{{ writeResult }}<span v-if="writeGenerating" class="cursor">|</span></pre>
        <div class="card-actions">
          <button class="primary-button" @click="insertWriteResult">按标题插入文末</button>
          <button class="secondary-button" :disabled="writeGenerating" @click="onWrite">重新生成</button>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'knowledge'" class="workspace knowledge-workspace">
      <section class="knowledge-panel">
        <div class="card-head compact-head">
          <span>知识库参考</span>
          <button
            class="ghost-button"
            :disabled="companionKbLoading || !companionKbConfigured"
            @click="refreshCurrentParagraphKnowledge()"
          >
            {{ companionKbLoading ? '检索中...' : '刷新' }}
          </button>
        </div>
        <div class="knowledge-body">
          <div v-if="companionKbProvider === 'dify' && companionKbConfigured" class="dataset-row">
            <select
              v-model="companionDatasetId"
              :disabled="companionDatasetLoading"
              @change="onCompanionDatasetChange"
            >
              <option value="">选择知识库</option>
              <option v-for="item in companionDatasets" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </select>
            <button class="ghost-button" :disabled="companionDatasetLoading" @click="loadCompanionDatasets()">
              {{ companionDatasetLoading ? '加载中...' : '列表' }}
            </button>
          </div>
          <p v-if="!companionKbConfigured" class="muted-text">配置知识库后，会按光标所在段落检索匹配度最高的 5 段内容。</p>
          <p v-else-if="companionDatasetError" class="warning-text">{{ companionDatasetError }}</p>
          <p v-else-if="companionDatasetLoading" class="muted-text">正在加载知识库列表...</p>
          <p v-else-if="companionKbProvider === 'dify' && !companionDatasetId" class="muted-text">请选择一个知识库后再检索。</p>
          <p v-else-if="companionKbError" class="warning-text">{{ companionKbError }}</p>
          <p v-else-if="companionKbLoading" class="muted-text">正在用当前段落检索知识库...</p>
          <p v-else-if="!companionParagraphText" class="muted-text">请把光标放在需要参考知识库的段落中，然后点击刷新。</p>
          <template v-else>
            <p class="paragraph-preview">当前段落：{{ companionParagraphText }}</p>
            <ol v-if="companionKbSegments.length" class="knowledge-list">
              <li v-for="(item, index) in companionKbSegments" :key="index">
                <p>{{ item.content }}</p>
              </li>
            </ol>
            <p v-else class="muted-text">未检索到匹配片段。</p>
          </template>
        </div>
      </section>
    </section>

    <section v-else class="workspace chat-workspace">
      <div class="context-row">
        <label v-if="activeTab === 'companion'" class="check-label">
          <input v-model="injectDocContext" type="checkbox" />
          使用当前文档
        </label>
        <label v-else class="check-label">
          <input v-model="useKb" type="checkbox" />
          使用知识库
        </label>
        <button class="ghost-button" @click="newActiveChat">新对话</button>
      </div>

      <div ref="chatScroller" class="messages">
        <div v-if="activeMessages.length === 0 && !activeGenerating" class="empty-state">
          <p>{{ activeTab === 'companion' ? '输入写作想法，获得结构、措辞和改写建议。' : '围绕当前文档提问，可叠加知识库内容。' }}</p>
        </div>

        <article
          v-for="(msg, idx) in activeMessages"
          :key="idx"
          class="message"
          :class="msg.role"
        >
          <pre>{{ msg.content }}</pre>
        </article>

        <article v-if="activeGenerating" class="message assistant">
          <pre>{{ activeStreamText }}<span class="cursor">|</span></pre>
        </article>
      </div>

      <div class="chat-input-card">
        <textarea
          v-model="activeInputProxy"
          class="chat-input"
          :placeholder="activeTab === 'companion' ? '输入写作问题或指令，Ctrl+Enter 发送' : '输入针对文档的问题，Ctrl+Enter 发送'"
          rows="3"
          @keydown.ctrl.enter="sendActive"
        ></textarea>
        <div class="action-row">
          <button class="primary-button" :disabled="!activeInputProxy.trim() || activeGenerating" @click="sendActive">
            {{ activeGenerating ? '回答中...' : '发送' }}
          </button>
          <button v-if="activeGenerating" class="danger-button" @click="stopActive">停止</button>
        </div>
      </div>
    </section>

    <p v-if="activeError" class="error-msg">{{ activeError }}</p>
    <p v-if="showConfigTip" class="tip-msg">请先在 Ribbon 的“设置”中配置大模型接口地址、API Key 和模型名称。</p>
  </main>
</template>

<script>
import aiApi from '../js/ai.js'
import aiConfig from '../js/aiConfig.js'
import aiHistory from '../js/aiHistory.js'
import wpsDoc from '../js/wpsDoc.js'

const PRODUCT_NAME = '文策 AI'
const AI_TASK_PANE_TITLES = {
  write: '帮我写',
  companion: '伴写',
  qa: '文档问答',
  knowledge: '知识库参考'
}

export default {
  name: 'AiTaskPane',
  data() {
    return {
      activeTab: 'write',
      tabs: [
        { key: 'write', label: AI_TASK_PANE_TITLES.write },
        { key: 'companion', label: AI_TASK_PANE_TITLES.companion },
        { key: 'qa', label: AI_TASK_PANE_TITLES.qa },
        { key: 'knowledge', label: AI_TASK_PANE_TITLES.knowledge }
      ],
      writePrompt: '',
      writeStyle: '',
      writeLength: '',
      writeResult: '',
      writeGenerating: false,
      writeError: '',
      writeStopFn: null,
      writeSessionId: null,
      companionMessages: [],
      companionInput: '',
      companionStreamText: '',
      companionGenerating: false,
      companionError: '',
      companionStopFn: null,
      companionSessionId: null,
      injectDocContext: true,
      companionKbProvider: 'dify',
      companionKbConfigured: false,
      companionKbLoading: false,
      companionKbError: '',
      companionKbSegments: [],
      companionParagraphText: '',
      companionParagraphKey: '',
      companionDatasets: [],
      companionDatasetId: '',
      companionDatasetLoading: false,
      companionDatasetError: '',
      companionDatasetLoaded: false,
      qaMessages: [],
      qaInput: '',
      qaStreamText: '',
      qaGenerating: false,
      qaError: '',
      qaStopFn: null,
      qaSessionId: null,
      useKb: false,
      showConfigTip: false
    }
  },
  computed: {
    activeMessages() {
      return this.activeTab === 'qa' ? this.qaMessages : this.companionMessages
    },
    activeGenerating() {
      return this.activeTab === 'qa' ? this.qaGenerating : this.companionGenerating
    },
    activeStreamText() {
      return this.activeTab === 'qa' ? this.qaStreamText : this.companionStreamText
    },
    activeError() {
      if (this.activeTab === 'write') return this.writeError
      if (this.activeTab === 'knowledge') return ''
      return this.activeTab === 'qa' ? this.qaError : this.companionError
    },
    activeInputProxy: {
      get() {
        return this.activeTab === 'qa' ? this.qaInput : this.companionInput
      },
      set(value) {
        if (this.activeTab === 'qa') this.qaInput = value
        else this.companionInput = value
      }
    }
  },
  watch: {
    '$route.query.mode': {
      immediate: true,
      handler(mode) {
        this.applyRouteMode(mode)
      }
    },
    activeTab(tab) {
      if (tab === 'knowledge') {
        this.$nextTick(() => this.refreshCurrentParagraphKnowledge({ silent: true }))
      }
    }
  },
  created() {
    const cfg = aiConfig.getConfig()
    this.useKb = !!cfg.kbUrl
    this.companionKbProvider = cfg.kbProvider
    this.companionDatasetId = cfg.kbDatasetId || ''
    this.companionKbConfigured = aiApi.isKnowledgeBaseConfigured(cfg)
  },
  mounted() {
    if (this.activeTab === 'knowledge') {
      this.refreshCurrentParagraphKnowledge({ silent: true })
    }
  },
  methods: {
    applyRouteMode(mode) {
      const nextTab = AI_TASK_PANE_TITLES[mode] ? mode : this.activeTab
      this.activeTab = nextTab
      this.updateTaskPaneTitle(nextTab)
    },
    switchTab(key) {
      if (!AI_TASK_PANE_TITLES[key]) return
      this.activeTab = key
      this.updateTaskPaneTitle(key)
      this.$router
        .replace({
          path: this.$route.path,
          query: {
            ...this.$route.query,
            mode: key
          }
        })
        .catch(() => {})
    },
    updateTaskPaneTitle(mode = this.activeTab) {
      const featureName = AI_TASK_PANE_TITLES[mode] || 'AI 任务窗格'
      const title = `${PRODUCT_NAME}|${featureName}`
      document.title = title
      if (!window.Application?.PluginStorage) return
      try {
        const paneId = window.Application.PluginStorage.getItem('ai_taskpane_id')
        if (paneId) {
          window.Application.GetTaskPane(paneId).Title = title
        }
      } catch {
        // 部分 WPS 版本只支持创建任务窗格时传入标题。
      }
    },
    checkConfig() {
      if (!aiConfig.isConfigured()) {
        this.showConfigTip = true
        setTimeout(() => {
          this.showConfigTip = false
        }, 4200)
        return false
      }
      return true
    },
    newActiveChat() {
      if (this.activeTab === 'write') {
        this.writePrompt = ''
        this.writeResult = ''
        this.writeError = ''
        this.writeSessionId = aiHistory.genId()
      } else if (this.activeTab === 'qa') {
        this.newQaChat()
      } else {
        this.newCompanionChat()
      }
    },
    onWrite() {
      if (!this.checkConfig() || !this.writePrompt.trim()) return
      this.writeResult = ''
      this.writeError = ''
      this.writeGenerating = true

      const styleMap = {
        professional: '专业正式',
        casual: '轻松口语化',
        party: '党政公文',
        academic: '学术论文'
      }
      const lengthMap = {
        short: '200 字以内',
        medium: '约 500 字',
        long: '1000 字以上'
      }
      let userMsg = `请帮我写：${this.writePrompt}`
      if (this.writeStyle) userMsg += `\n写作风格：${styleMap[this.writeStyle]}`
      if (this.writeLength) userMsg += `\n内容长度：${lengthMap[this.writeLength]}`

      const messages = [
        {
          role: 'system',
          content:
            '你是一位专业中文写作助手。请直接输出可放入文档的 Markdown 正文内容：一级标题用 #，二级标题用 ##，三级标题用 ###，正文不要放在代码块中。'
        },
        { role: 'user', content: userMsg }
      ]
      if (!this.writeSessionId) this.writeSessionId = aiHistory.genId()

      this.writeStopFn = aiApi.streamChat(
        messages,
        (chunk) => {
          this.writeResult += chunk
        },
        () => {
          this.writeGenerating = false
          this.writeStopFn = null
          aiHistory.saveSession({
            id: this.writeSessionId,
            title: this.writePrompt.slice(0, 30),
            type: 'write',
            messages: [...messages, { role: 'assistant', content: this.writeResult }],
            createdAt: Date.now()
          })
        },
        (err) => {
          this.writeError = err.message
          this.writeGenerating = false
          this.writeStopFn = null
        }
      )
    },
    stopWrite() {
      if (this.writeStopFn) this.writeStopFn()
      this.writeStopFn = null
      this.writeGenerating = false
    },
    insertWriteResult() {
      if (!wpsDoc.insertMarkdownAtEnd(this.writeResult)) {
        this.writeError = '插入文档失败，请确认在 WPS 中打开了此加载项。'
      }
    },
    newCompanionChat() {
      this.companionMessages = []
      this.companionStreamText = ''
      this.companionError = ''
      this.companionSessionId = aiHistory.genId()
    },
    async sendCompanion() {
      if (!this.checkConfig()) return
      const text = this.companionInput.trim()
      if (!text) return
      this.companionError = ''
      this.companionInput = ''
      this.companionMessages.push({ role: 'user', content: text })

      let systemContent = '你是专业写作伙伴，擅长结构建议、文案生成、语气调整和内容完善。'
      if (this.injectDocContext) {
        const docText = wpsDoc.getFullText()
        if (docText) systemContent += `\n\n当前文档内容，仅作上下文参考：\n${docText.slice(0, 4000)}`
      }
      await this.ensureCompanionKnowledgeFresh()
      const kbContext = this.companionKbSegments.map((item, index) => `${index + 1}. ${item.content}`).join('\n\n')
      if (kbContext) {
        systemContent += `\n\n知识库参考，来自当前光标所在段落的 RAG 检索结果：\n${kbContext.slice(0, 2500)}`
      }

      const messages = [
        { role: 'system', content: systemContent },
        ...this.companionMessages.slice(-20)
      ]
      this.companionGenerating = true
      this.companionStreamText = ''
      if (!this.companionSessionId) this.companionSessionId = aiHistory.genId()

      this.companionStopFn = aiApi.streamChat(
        messages,
        (chunk) => {
          this.companionStreamText += chunk
          this.scrollChat()
        },
        () => {
          this.companionMessages.push({ role: 'assistant', content: this.companionStreamText })
          this.companionStreamText = ''
          this.companionGenerating = false
          this.companionStopFn = null
          aiHistory.saveSession({
            id: this.companionSessionId,
            title: text.slice(0, 30),
            type: 'companion',
            messages: this.companionMessages,
            createdAt: Date.now()
          })
        },
        (err) => {
          this.companionError = err.message
          this.companionStreamText = ''
          this.companionGenerating = false
          this.companionStopFn = null
        }
      )
    },
    stopCompanion() {
      if (this.companionStopFn) this.companionStopFn()
      if (this.companionStreamText) {
        this.companionMessages.push({ role: 'assistant', content: `${this.companionStreamText}\n（已停止）` })
      }
      this.companionStreamText = ''
      this.companionStopFn = null
      this.companionGenerating = false
    },
    async ensureCompanionKnowledgeFresh() {
      if (!this.companionKbConfigured || this.companionKbLoading) return
      const paragraphInfo = wpsDoc.getCurrentParagraphInfo()
      const paragraphKey = `${paragraphInfo.start ?? ''}:${paragraphInfo.end ?? ''}:${paragraphInfo.text}`
      if (!paragraphInfo.text || paragraphKey === this.companionParagraphKey) return
      await this.refreshCurrentParagraphKnowledge({ silent: true, paragraphInfo })
    },
    async refreshCurrentParagraphKnowledge(options = {}) {
      const cfg = aiConfig.getConfig()
      this.companionKbProvider = cfg.kbProvider
      this.companionKbConfigured = aiApi.isKnowledgeBaseConfigured(cfg)
      this.companionDatasetId = this.companionDatasetId || cfg.kbDatasetId || ''
      if (!this.companionKbConfigured) {
        this.companionKbSegments = []
        this.companionParagraphText = ''
        this.companionParagraphKey = ''
        this.companionKbError = ''
        this.companionDatasetError = ''
        return
      }
      if (cfg.kbProvider === 'dify' && !this.companionDatasetLoaded && !this.companionDatasetLoading) {
        await this.loadCompanionDatasets({ silent: options.silent })
      }
      if (cfg.kbProvider === 'dify' && !this.companionDatasetId) {
        this.companionKbSegments = []
        this.companionParagraphText = ''
        this.companionParagraphKey = ''
        if (!options.silent && !this.companionDatasetError) {
          this.companionKbError = '请先选择一个 Dify 知识库。'
        }
        return
      }

      const paragraphInfo = options.paragraphInfo || wpsDoc.getCurrentParagraphInfo()
      const paragraphText = paragraphInfo.text || ''
      this.companionParagraphText = this.shortenText(paragraphText, 120)
      this.companionParagraphKey = `${paragraphInfo.start ?? ''}:${paragraphInfo.end ?? ''}:${paragraphText}`
      this.companionKbError = ''

      if (!paragraphText) {
        this.companionKbSegments = []
        if (!options.silent) this.companionKbError = '未读取到当前段落，请确认光标在正文段落内。'
        return
      }

      this.companionKbLoading = true
      try {
        const segments = await aiApi.queryKnowledgeBaseSegments(paragraphText, {
          topK: 5,
          kbDatasetId: this.companionDatasetId
        })
        this.companionKbSegments = segments.slice(0, 5)
      } catch (err) {
        this.companionKbSegments = []
        this.companionKbError = err.message || '知识库检索失败'
      } finally {
        this.companionKbLoading = false
      }
    },
    async loadCompanionDatasets(options = {}) {
      const cfg = aiConfig.getConfig()
      this.companionKbProvider = cfg.kbProvider
      this.companionDatasetError = ''
      if (cfg.kbProvider !== 'dify' || !aiApi.isKnowledgeBaseConfigured(cfg)) return

      this.companionDatasetLoading = true
      try {
        const datasets = await aiApi.listDifyDatasets({
          kbUrl: cfg.kbUrl,
          kbApiKey: cfg.kbApiKey
        })
        this.companionDatasets = datasets
        this.companionDatasetLoaded = true

        const currentId = this.companionDatasetId || cfg.kbDatasetId || ''
        const currentExists = datasets.some((item) => item.id === currentId)
        const nextId = currentExists ? currentId : datasets[0]?.id || ''
        if (nextId !== this.companionDatasetId) {
          this.companionDatasetId = nextId
          aiConfig.setConfig({ kbDatasetId: nextId })
        }
        if (!datasets.length && !options.silent) {
          this.companionDatasetError = '当前 Dify API Key 未返回可用知识库。'
        }
      } catch (err) {
        this.companionDatasets = []
        this.companionDatasetLoaded = false
        if (!options.silent) {
          this.companionDatasetError = err.message || '获取 Dify 知识库列表失败'
        }
      } finally {
        this.companionDatasetLoading = false
      }
    },
    onCompanionDatasetChange() {
      aiConfig.setConfig({ kbDatasetId: this.companionDatasetId })
      this.companionKbSegments = []
      this.companionParagraphKey = ''
      this.refreshCurrentParagraphKnowledge({ silent: true })
    },
    newQaChat() {
      this.qaMessages = []
      this.qaStreamText = ''
      this.qaError = ''
      this.qaSessionId = aiHistory.genId()
    },
    async sendQa() {
      if (!this.checkConfig()) return
      const text = this.qaInput.trim()
      if (!text) return
      this.qaError = ''
      this.qaInput = ''
      this.qaMessages.push({ role: 'user', content: text })

      const docText = wpsDoc.getFullText()
      let kbContext = ''
      if (this.useKb) {
        kbContext = await aiApi.queryKnowledgeBase(text)
      }

      let systemContent = '你是智能文档问答助手。回答必须基于文档和知识库上下文，缺少依据时要明确说明。'
      if (docText) systemContent += `\n\n当前文档内容：\n${docText.slice(0, 5000)}`
      if (kbContext) systemContent += `\n\n知识库参考：\n${kbContext.slice(0, 2500)}`

      const messages = [
        { role: 'system', content: systemContent },
        ...this.qaMessages.slice(-14)
      ]
      this.qaGenerating = true
      this.qaStreamText = ''
      if (!this.qaSessionId) this.qaSessionId = aiHistory.genId()

      this.qaStopFn = aiApi.streamChat(
        messages,
        (chunk) => {
          this.qaStreamText += chunk
          this.scrollChat()
        },
        () => {
          this.qaMessages.push({ role: 'assistant', content: this.qaStreamText })
          this.qaStreamText = ''
          this.qaGenerating = false
          this.qaStopFn = null
          aiHistory.saveSession({
            id: this.qaSessionId,
            title: text.slice(0, 30),
            type: 'qa',
            messages: this.qaMessages,
            createdAt: Date.now()
          })
        },
        (err) => {
          this.qaError = err.message
          this.qaStreamText = ''
          this.qaGenerating = false
          this.qaStopFn = null
        }
      )
    },
    stopQa() {
      if (this.qaStopFn) this.qaStopFn()
      if (this.qaStreamText) {
        this.qaMessages.push({ role: 'assistant', content: `${this.qaStreamText}\n（已停止）` })
      }
      this.qaStreamText = ''
      this.qaStopFn = null
      this.qaGenerating = false
    },
    sendActive() {
      if (this.activeTab === 'qa') return this.sendQa()
      return this.sendCompanion()
    },
    stopActive() {
      if (this.activeTab === 'qa') return this.stopQa()
      return this.stopCompanion()
    },
    scrollChat() {
      this.$nextTick(() => {
        const el = this.$refs.chatScroller
        if (el) el.scrollTop = el.scrollHeight
      })
    },
    copyText(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {})
        return
      }
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    },
    shortenText(text, maxLength) {
      const value = String(text || '').replace(/\s+/g, ' ').trim()
      if (value.length <= maxLength) return value
      return `${value.slice(0, maxLength)}...`
    }
  }
}
</script>

<style scoped>
.ai-pane {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: #1f2937;
  background: #f8fafc;
  font-size: 13px;
}

.pane-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 8px 10px 6px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.eyebrow {
  margin: 0 0 1px;
  color: #6366f1;
  font-size: 10px;
  font-weight: 700;
}

.icon-button {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #dbe1ea;
  border-radius: 5px;
  color: #4f46e5;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.tab-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  flex-shrink: 0;
  margin: 6px 8px 8px;
  padding: 3px;
  border: 1px solid #dbe1ea;
  border-radius: 6px;
  background: #eef2f7;
}

.tab-button {
  height: 26px;
  min-width: 0;
  border: 0;
  border-radius: 4px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.tab-button.active {
  color: #111827;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.workspace {
  flex: 1;
  min-height: 0;
  padding: 0 8px 8px;
  overflow: auto;
}

.write-workspace,
.chat-workspace,
.knowledge-workspace {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-card,
.result-card,
.chat-input-card {
  border: 1px solid #dbe1ea;
  border-radius: 6px;
  background: #fff;
}

.prompt-card,
.chat-input-card {
  flex-shrink: 0;
  padding: 8px;
}

.field-label {
  display: block;
  margin-bottom: 5px;
  color: #374151;
  font-weight: 700;
}

.prompt-input,
.chat-input {
  width: 100%;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  outline: none;
  padding: 8px;
  color: #111827;
  background: #fff;
  line-height: 1.5;
}

.prompt-input:focus,
.chat-input:focus,
select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 7px;
}

select {
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  outline: none;
  color: #374151;
  background: #fff;
}

.action-row,
.card-actions,
.context-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-row {
  margin-top: 8px;
}

button {
  height: 28px;
  padding: 0 10px;
  border-radius: 5px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-button {
  color: #fff;
  background: #4f46e5;
}

.secondary-button,
.ghost-button {
  color: #374151;
  background: #fff;
  border-color: #d1d5db;
}

.ghost-button {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}

.danger-button {
  color: #b91c1c;
  background: #fff;
  border-color: #fecaca;
}

.result-card {
  display: flex;
  flex-direction: column;
  min-height: 220px;
  overflow: hidden;
}

.knowledge-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #dbe1ea;
  border-radius: 6px;
  background: #fff;
}

.knowledge-workspace .knowledge-panel {
  flex: 1;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 7px 8px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 700;
}

.compact-head {
  padding: 6px 8px;
}

.knowledge-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.dataset-row {
  display: flex;
  gap: 6px;
  min-width: 0;
  margin-bottom: 8px;
}

.dataset-row select {
  flex: 1;
}

.paragraph-preview,
.muted-text,
.warning-text {
  margin: 0;
  line-height: 1.5;
}

.paragraph-preview {
  margin-bottom: 7px;
  color: #334155;
}

.muted-text {
  color: #64748b;
}

.warning-text {
  color: #991b1b;
}

.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}

.knowledge-list li {
  padding-bottom: 6px;
  border-bottom: 1px solid #eef2f7;
}

.knowledge-list li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.knowledge-list p {
  margin: 0;
  color: #1f2937;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-text {
  flex: 1;
  margin: 0;
  padding: 8px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.5;
}

.card-actions {
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 7px 8px;
  border-top: 1px solid #e5e7eb;
}

.context-row {
  justify-content: space-between;
  flex-shrink: 0;
}

.check-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #475569;
  font-weight: 650;
}

.messages {
  flex: 1;
  min-height: 0;
  overscroll-behavior: contain;
  overflow: auto;
  padding: 4px 0;
}

.empty-state {
  margin: 12px 4px;
  padding: 10px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
  line-height: 1.5;
}

.empty-state p {
  margin: 0;
}

.message {
  max-width: 94%;
  margin: 0 0 6px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #fff;
}

.message.user {
  margin-left: auto;
  color: #fff;
  background: #4f46e5;
  border-color: #4f46e5;
}

.message.assistant {
  margin-right: auto;
}

.message pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.5;
}

.error-msg,
.tip-msg {
  flex-shrink: 0;
  margin: 0 8px 8px;
  padding: 7px 8px;
  border-radius: 5px;
  line-height: 1.4;
}

.error-msg {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.tip-msg {
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.cursor {
  color: #4f46e5;
  animation: cursor-blink 1s step-start infinite;
}

@media (max-width: 360px) {
  .option-grid {
    grid-template-columns: 1fr;
  }

  .context-row,
  .action-row,
  .card-actions {
    flex-wrap: wrap;
  }
}
</style>
