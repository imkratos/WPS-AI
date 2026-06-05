<template>
  <main class="ai-pane">
    <header class="pane-head">
      <div>
        <p class="eyebrow">文策 AI</p>
        <h1>{{ currentTab.label }}</h1>
      </div>
      <button class="icon-button" title="新会话" @click="newActiveChat">+</button>
    </header>

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
          <button class="primary-button" @click="insertWriteResult">插入文末</button>
          <button class="secondary-button" :disabled="writeGenerating" @click="onWrite">重新生成</button>
        </div>
      </article>
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

export default {
  name: 'AiTaskPane',
  data() {
    return {
      activeTab: 'write',
      tabs: [
        { key: 'write', label: '帮我写' },
        { key: 'companion', label: '伴写' },
        { key: 'qa', label: '文档问答' }
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
    currentTab() {
      return this.tabs.find((tab) => tab.key === this.activeTab) || this.tabs[0]
    },
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
  created() {
    const hash = window.location.hash || ''
    const queryStr = hash.includes('?') ? hash.split('?')[1] : window.location.search.slice(1)
    const params = new URLSearchParams(queryStr)
    const mode = params.get('mode')
    if (['write', 'companion', 'qa'].includes(mode)) this.activeTab = mode
    this.useKb = !!aiConfig.getConfig().kbUrl
  },
  methods: {
    switchTab(key) {
      this.activeTab = key
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
        { role: 'system', content: '你是一位专业中文写作助手。请直接输出可放入文档的正文内容。' },
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
      if (!wpsDoc.insertAtEnd(`\n\n${this.writeResult}`)) {
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
  background:
    linear-gradient(180deg, #f7f8ff 0%, #ffffff 32%),
    #fff;
  font-size: 13px;
}

.pane-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 16px 16px 12px;
}

.eyebrow {
  margin: 0 0 3px;
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 750;
  line-height: 1.2;
}

.icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid #dbe1ea;
  border-radius: 8px;
  color: #4f46e5;
  background: #fff;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.tab-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  flex-shrink: 0;
  margin: 0 12px 10px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #f8fafc;
}

.tab-button {
  height: 30px;
  border: 0;
  border-radius: 7px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
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
  padding: 0 12px 12px;
  overflow: auto;
}

.write-workspace,
.chat-workspace {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompt-card,
.result-card,
.chat-input-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.055);
}

.prompt-card,
.chat-input-card {
  flex-shrink: 0;
  padding: 12px;
}

.field-label {
  display: block;
  margin-bottom: 7px;
  color: #374151;
  font-weight: 700;
}

.prompt-input,
.chat-input {
  width: 100%;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  outline: none;
  padding: 10px;
  color: #111827;
  background: #fff;
  line-height: 1.55;
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
  gap: 8px;
  margin-top: 9px;
}

select {
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  outline: none;
  color: #374151;
  background: #fff;
}

.action-row,
.card-actions,
.context-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-row {
  margin-top: 10px;
}

button {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
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
  height: 28px;
  padding: 0 10px;
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
  min-height: 180px;
  overflow: hidden;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 700;
}

.result-text {
  flex: 1;
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.65;
}

.card-actions {
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 10px 12px;
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
  padding: 8px 2px;
}

.empty-state {
  margin: 32px 8px;
  padding: 18px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  background: #f8fafc;
  line-height: 1.6;
}

.empty-state p {
  margin: 0;
}

.message {
  max-width: 88%;
  margin: 0 0 10px;
  padding: 10px 11px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
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
  line-height: 1.6;
}

.error-msg,
.tip-msg {
  flex-shrink: 0;
  margin: 0 12px 12px;
  padding: 9px 11px;
  border-radius: 7px;
  line-height: 1.45;
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
