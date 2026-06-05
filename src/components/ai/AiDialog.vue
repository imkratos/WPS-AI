<template>
  <main class="ai-dialog">
    <header class="dialog-head">
      <div>
        <p class="eyebrow">文策 AI</p>
        <h1>{{ modeInfo.title }}</h1>
      </div>
      <span class="status-pill">{{ modeInfo.category }}</span>
    </header>

    <section v-if="modeInfo.source !== 'none'" class="source-card">
      <div class="source-title">
        <span>{{ sourceTitle }}</span>
        <button class="ghost-button" @click="loadSource">刷新</button>
      </div>
      <p v-if="sourceText" class="source-preview">{{ sourcePreview }}</p>
      <p v-else class="source-empty">{{ sourceEmptyText }}</p>
    </section>

    <section class="work-card">
      <label class="field-label" :for="`prompt-${mode}`">{{ modeInfo.promptLabel }}</label>
      <textarea
        :id="`prompt-${mode}`"
        v-model="extraPrompt"
        class="prompt-box"
        :placeholder="modeInfo.placeholder"
        :rows="modeInfo.kind === 'image' ? 4 : 3"
        @keydown.ctrl.enter="onGenerate"
      ></textarea>

      <div class="action-row">
        <button class="primary-button" :disabled="primaryDisabled" @click="onGenerate">
          {{ generating ? '处理中...' : modeInfo.actionLabel }}
        </button>
        <button v-if="generating" class="danger-button" @click="onStop">停止</button>
        <button
          v-if="modeInfo.kind === 'layout'"
          class="secondary-button"
          :disabled="layoutApplying"
          @click="onApplyLayoutOnly"
        >
          {{ layoutApplying ? '应用中...' : '直接排版' }}
        </button>
      </div>
    </section>

    <section v-if="resultText || imageUrl || generating" class="result-card">
      <div class="result-head">
        <span>{{ modeInfo.resultLabel }}</span>
        <button v-if="resultText" class="ghost-button" @click="copyText(resultText)">复制</button>
      </div>

      <div v-if="imageUrl" class="image-result">
        <img :src="imageUrl" alt="AI 生成图片" />
        <p v-if="revisedPrompt" class="image-caption">{{ revisedPrompt }}</p>
      </div>

      <pre v-else class="result-text">{{ resultText }}<span v-if="generating" class="cursor">|</span></pre>
    </section>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    <p v-if="tipMsg" class="tip-msg">{{ tipMsg }}</p>

    <footer class="dialog-foot">
      <button
        v-if="canApplyResult"
        class="primary-button"
        :disabled="applying"
        @click="onApply"
      >
        {{ applying ? '写入中...' : modeInfo.applyLabel }}
      </button>
      <button class="secondary-button" @click="onClose">关闭</button>
    </footer>
  </main>
</template>

<script>
import aiApi from '../js/ai.js'
import aiConfig from '../js/aiConfig.js'
import aiHistory from '../js/aiHistory.js'
import wpsDoc from '../js/wpsDoc.js'

const MODE_CONFIG = {
  continue: {
    title: '续写',
    category: '改写',
    kind: 'text',
    source: 'selection',
    promptLabel: '续写要求',
    placeholder: '例如：继续写三段，语气保持正式',
    actionLabel: '开始续写',
    resultLabel: '续写结果',
    applyLabel: '插入到选区后',
    applyMode: 'insertAfter',
    buildPrompt: (src, extra) =>
      `请基于以下文本继续续写，保持上下文连贯。\n\n原文：\n${src}\n\n补充要求：${extra || '自然续写，直接输出续写内容。'}`
  },
  expand: {
    title: '扩写',
    category: '改写',
    kind: 'text',
    source: 'selection',
    promptLabel: '扩写要求',
    placeholder: '例如：增加事实依据和细节，扩展到 500 字',
    actionLabel: '开始扩写',
    resultLabel: '扩写结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请扩写以下文本，保持原意并增强细节和论证。\n\n原文：\n${src}\n\n补充要求：${extra || '结构清晰，直接输出扩写后的文本。'}`
  },
  rewrite: {
    title: '重写',
    category: '改写',
    kind: 'text',
    source: 'selection',
    promptLabel: '重写要求',
    placeholder: '例如：换一种表达方式，语气更凝练',
    actionLabel: '开始重写',
    resultLabel: '重写结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请重写以下文本，保留核心含义。\n\n原文：\n${src}\n\n补充要求：${extra || '表达自然，直接输出重写后的文本。'}`
  },
  shorten: {
    title: '缩写',
    category: '改写',
    kind: 'text',
    source: 'selection',
    promptLabel: '缩写要求',
    placeholder: '例如：压缩到 100 字以内，保留关键结论',
    actionLabel: '开始缩写',
    resultLabel: '缩写结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请精简以下文本，保留核心信息。\n\n原文：\n${src}\n\n补充要求：${extra || '去掉冗余表达，直接输出缩写后的文本。'}`
  },
  party: {
    title: '党政风',
    category: '文风',
    kind: 'text',
    source: 'selection',
    promptLabel: '转换要求',
    placeholder: '可补充具体场景，如汇报、通知、讲话稿',
    actionLabel: '开始转换',
    resultLabel: '转换结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请将以下文本转换为规范、庄重、严谨的党政公文风格。\n\n原文：\n${src}\n\n补充要求：${extra || '直接输出转换后的文本。'}`
  },
  polish: {
    title: '润色',
    category: '文风',
    kind: 'text',
    source: 'selection',
    promptLabel: '润色要求',
    placeholder: '例如：更流畅、更有感染力、减少口语化',
    actionLabel: '开始润色',
    resultLabel: '润色结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请润色以下文本，使表达更流畅、准确。\n\n原文：\n${src}\n\n补充要求：${extra || '不改变原意，直接输出润色后的文本。'}`
  },
  formal: {
    title: '更正式',
    category: '文风',
    kind: 'text',
    source: 'selection',
    promptLabel: '正式化要求',
    placeholder: '可补充适用场景，如商务邮件、制度文件',
    actionLabel: '开始处理',
    resultLabel: '处理结果',
    applyLabel: '替换选区',
    applyMode: 'replace',
    buildPrompt: (src, extra) =>
      `请将以下文本改写得更正式、专业。\n\n原文：\n${src}\n\n补充要求：${extra || '适合正式文档，直接输出处理后的文本。'}`
  },
  'full-polish': {
    title: '全文润色',
    category: '全文',
    kind: 'text',
    source: 'document',
    promptLabel: '全文润色要求',
    placeholder: '例如：增强逻辑连贯性，保留原有结构',
    actionLabel: '开始润色',
    resultLabel: '全文润色版本',
    applyLabel: '追加润色版本',
    applyMode: 'insertEnd',
    buildPrompt: (src, extra) =>
      `请润色以下文档全文，保持原有信息和结构。\n\n文档：\n${src}\n\n补充要求：${extra || '提升表达质量，直接输出润色后的全文。'}`
  },
  summary: {
    title: '全文总结',
    category: '全文',
    kind: 'text',
    source: 'document',
    promptLabel: '总结要求',
    placeholder: '例如：300 字以内，按要点列出',
    actionLabel: '开始总结',
    resultLabel: '总结结果',
    applyLabel: '插入到文末',
    applyMode: 'insertSummary',
    buildPrompt: (src, extra) =>
      `请总结以下文档，提炼核心观点、关键事实和待办事项。\n\n文档：\n${src}\n\n补充要求：${extra || '简洁清晰，使用分点结构。'}`
  },
  layout: {
    title: 'AI 排版',
    category: '排版',
    kind: 'layout',
    source: 'document',
    preset: 'general',
    promptLabel: '排版偏好',
    placeholder: '例如：标题更醒目，正文适合正式报告',
    actionLabel: '生成排版建议',
    resultLabel: '排版建议',
    applyLabel: '应用基础排版',
    buildPrompt: (src, extra) =>
      `请分析以下文档并给出可执行的排版建议，包括标题层级、字体、段落、页边距和检查清单。\n\n文档：\n${src}\n\n偏好：${extra || '通用正式文档。'}`
  },
  'paper-layout': {
    title: '论文排版',
    category: '排版',
    kind: 'layout',
    source: 'document',
    preset: 'paper',
    promptLabel: '论文规范要求',
    placeholder: '例如：本科毕业论文，要求含摘要、关键词、参考文献检查',
    actionLabel: '生成论文排版建议',
    resultLabel: '论文排版建议',
    applyLabel: '应用论文排版',
    buildPrompt: (src, extra) =>
      `请按论文规范分析以下文档，输出标题层级、摘要、关键词、目录、引用和参考文献的排版建议。\n\n文档：\n${src}\n\n规范要求：${extra || '通用中文论文格式。'}`
  },
  'official-layout': {
    title: '公文排版',
    category: '排版',
    kind: 'layout',
    source: 'document',
    preset: 'official',
    promptLabel: '公文场景',
    placeholder: '例如：通知、请示、报告，按常见党政机关公文格式',
    actionLabel: '生成公文排版建议',
    resultLabel: '公文排版建议',
    applyLabel: '应用公文排版',
    buildPrompt: (src, extra) =>
      `请按常见党政机关公文格式分析以下文档，输出标题、主送机关、正文、附件、落款、日期和版式建议。\n\n文档：\n${src}\n\n场景：${extra || '通用公文。'}`
  },
  ppt: {
    title: '文档生成 PPT',
    category: '生成',
    kind: 'text',
    source: 'document',
    promptLabel: 'PPT 要求',
    placeholder: '例如：10 页，适合汇报，突出结论和行动项',
    actionLabel: '生成 PPT 大纲',
    resultLabel: 'PPT 页面结构',
    applyLabel: '插入 PPT 大纲',
    applyMode: 'insertPpt',
    buildPrompt: (src, extra) =>
      `请把以下文档转换为 PPT 页面结构。每页包含：页标题、核心信息、建议图表或视觉元素、演讲备注。\n\n文档：\n${src}\n\n要求：${extra || '8-10 页，适合正式汇报。'}`
  },
  image: {
    title: 'AI 生成图片',
    category: '图片',
    kind: 'image',
    source: 'none',
    promptLabel: '图片描述',
    placeholder: '描述要生成的图片，例如：现代办公场景中的数字化转型主题插画',
    actionLabel: '生成图片',
    resultLabel: '图片结果',
    applyLabel: '插入图片',
    buildPrompt: (_src, extra) => extra
  },
  'summary-image': {
    title: 'AI 总结生图',
    category: '图片',
    kind: 'image',
    source: 'document',
    promptLabel: '图片风格',
    placeholder: '例如：生成信息图，蓝白商务风，包含核心结论和流程',
    actionLabel: '总结并生图',
    resultLabel: '总结生图结果',
    applyLabel: '插入图片',
    buildPrompt: (src, extra) =>
      `请基于以下文档内容生成一张信息图或思维导图的图片提示词。要求提示词适合图片生成模型，包含主题、构图、文字元素、颜色和风格。\n\n文档：\n${src}\n\n风格：${extra || '现代商务信息图，清晰、克制、适合文档插图。'}`
  }
}

export default {
  name: 'AiDialog',
  data() {
    return {
      mode: 'rewrite',
      sourceText: '',
      extraPrompt: '',
      resultText: '',
      imageUrl: '',
      revisedPrompt: '',
      generating: false,
      applying: false,
      layoutApplying: false,
      errorMsg: '',
      tipMsg: '',
      stopFn: null,
      paneKey: ''
    }
  },
  computed: {
    modeInfo() {
      return MODE_CONFIG[this.mode] || MODE_CONFIG.rewrite
    },
    sourceTitle() {
      return this.modeInfo.source === 'selection' ? '当前选区' : '当前文档'
    },
    sourcePreview() {
      const text = this.sourceText.replace(/\s+/g, ' ').trim()
      return text.length > 180 ? text.slice(0, 180) + '...' : text
    },
    sourceEmptyText() {
      return this.modeInfo.source === 'selection'
        ? '未读取到选区内容，请先在文档中选中文本。'
        : '未读取到文档内容，请确认已在 WPS 中打开文档。'
    },
    primaryDisabled() {
      if (this.generating) return true
      if (this.modeInfo.source !== 'none' && !this.sourceText) return true
      if (this.modeInfo.kind === 'image' && this.modeInfo.source === 'none' && !this.extraPrompt.trim()) return true
      return false
    },
    canApplyResult() {
      if (this.modeInfo.kind === 'image') return !!this.imageUrl
      return !!this.resultText || this.modeInfo.kind === 'layout'
    }
  },
  created() {
    const hash = window.location.hash || ''
    const queryStr = hash.includes('?') ? hash.split('?')[1] : window.location.search.slice(1)
    const params = new URLSearchParams(queryStr)
    const m = params.get('mode')
    if (m && MODE_CONFIG[m]) this.mode = m
    this.paneKey = params.get('paneKey') || ''
    this.loadSource()
  },
  methods: {
    loadSource() {
      if (this.modeInfo.source === 'selection') {
        this.sourceText = wpsDoc.getSelection()
      } else if (this.modeInfo.source === 'document') {
        this.sourceText = wpsDoc.getFullText()
      } else {
        this.sourceText = ''
      }
    },
    ensureConfig() {
      if (!aiConfig.isConfigured()) {
        this.errorMsg = '请先在设置中配置大模型接口地址、API Key 和模型名称。'
        return false
      }
      return true
    },
    async onGenerate() {
      if (this.generating || !this.ensureConfig()) return
      this.errorMsg = ''
      this.tipMsg = ''
      this.resultText = ''
      this.imageUrl = ''
      this.revisedPrompt = ''

      if (this.modeInfo.kind === 'image') {
        await this.generateImage()
        return
      }

      this.generateText()
    },
    generateText() {
      this.generating = true
      const src = this.modeInfo.source === 'selection' ? (this.sourceText || wpsDoc.getSelection()) : this.sourceText
      const prompt = this.modeInfo.buildPrompt(src, this.extraPrompt.trim())
      const messages = [
        { role: 'system', content: '你是专业的中文文档助手，输出要直接、准确、可落地，不要添加无关解释。' },
        { role: 'user', content: prompt }
      ]

      this.stopFn = aiApi.streamChat(
        messages,
        (chunk) => {
          this.resultText += chunk
        },
        () => {
          this.generating = false
          this.stopFn = null
          this.saveHistory(messages)
        },
        (err) => {
          this.errorMsg = err.message
          this.generating = false
          this.stopFn = null
        }
      )
    },
    async generateImage() {
      this.generating = true
      try {
        let prompt = this.extraPrompt.trim()
        if (this.mode === 'summary-image') {
          const promptText = this.modeInfo.buildPrompt(this.sourceText, this.extraPrompt.trim())
          prompt = await aiApi.chat([
            { role: 'system', content: '你是图片提示词专家，请输出一段可直接用于图片生成模型的中文提示词。' },
            { role: 'user', content: promptText }
          ])
          this.resultText = prompt
        }

        const result = await aiApi.generateImage(prompt)
        this.imageUrl = result.url
        this.revisedPrompt = result.revisedPrompt
        this.saveHistory([
          { role: 'user', content: prompt },
          { role: 'assistant', content: result.url }
        ])
      } catch (err) {
        this.errorMsg = err.message
      } finally {
        this.generating = false
      }
    },
    onStop() {
      if (this.stopFn) this.stopFn()
      this.stopFn = null
      this.generating = false
    },
    async onApplyLayoutOnly() {
      await this.applyLayout()
    },
    async onApply() {
      if (this.modeInfo.kind === 'layout') {
        await this.applyLayout()
        return
      }

      this.applying = true
      this.errorMsg = ''
      let ok = false
      try {
        if (this.modeInfo.kind === 'image') {
          ok = wpsDoc.insertImage(this.imageUrl)
          if (!ok) ok = wpsDoc.insertAtEnd(`\n\n【AI 图片】\n${this.imageUrl}\n`)
        } else {
          ok = this.applyTextResult()
        }
      } finally {
        this.applying = false
      }

      if (ok) {
        this.tipMsg = '已写入文档。'
      } else {
        this.errorMsg = '写入文档失败，请确认当前在 WPS 宿主环境中并已打开文档。'
      }
    },
    applyTextResult() {
      const text = this.resultText
      switch (this.modeInfo.applyMode) {
        case 'replace':
          return wpsDoc.replaceSelection(text)
        case 'insertAfter':
          return wpsDoc.insertAfterSelection(text)
        case 'insertSummary':
          return wpsDoc.insertAtEnd(`\n\n【AI 全文总结】\n${text}`)
        case 'insertPpt':
          return wpsDoc.insertAtEnd(`\n\n【AI 生成 PPT 大纲】\n${text}`)
        case 'insertEnd':
        default:
          return wpsDoc.insertAtEnd(`\n\n【${this.modeInfo.title}】\n${text}`)
      }
    },
    async applyLayout() {
      this.layoutApplying = true
      this.errorMsg = ''
      const result = wpsDoc.applyLayoutPreset(this.modeInfo.preset)
      this.layoutApplying = false
      if (result.ok) {
        this.tipMsg = result.message
      } else {
        this.errorMsg = result.message
      }
    },
    saveHistory(messages) {
      aiHistory.saveSession({
        id: aiHistory.genId(),
        title: this.modeInfo.title,
        type: this.modeInfo.kind === 'image' ? 'image' : this.modeInfo.kind === 'layout' ? 'layout' : 'edit',
        messages: [
          ...messages,
          { role: 'assistant', content: this.imageUrl || this.resultText }
        ],
        createdAt: Date.now()
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
    onClose() {
      if (this.stopFn) this.stopFn()
      if (this.paneKey && window.Application?.PluginStorage) {
        const paneId = window.Application.PluginStorage.getItem(this.paneKey)
        if (paneId) {
          try {
            const pane = window.Application.GetTaskPane(paneId)
            pane.Visible = false
            return
          } catch {
            // 任务窗格已失效时退回普通关闭逻辑
          }
        }
      }
      try {
        window.close()
      } catch {
        // 浏览器预览时忽略
      }
    }
  }
}
</script>

<style scoped>
.ai-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  color: #1f2937;
  background:
    linear-gradient(180deg, rgba(246, 248, 255, 0.96), rgba(255, 255, 255, 0.98) 34%),
    #fff;
  font-size: 13px;
}

.dialog-head,
.source-card,
.work-card,
.result-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 14px 16px;
}

.eyebrow {
  margin: 0 0 3px;
  color: #6366f1;
  font-size: 11px;
  font-weight: 600;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}

.status-pill {
  padding: 4px 9px;
  border-radius: 999px;
  color: #475569;
  background: #eef2ff;
  font-size: 12px;
}

.source-card,
.work-card {
  flex-shrink: 0;
  padding: 12px;
}

.source-title,
.result-head,
.action-row,
.dialog-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-title,
.result-head {
  justify-content: space-between;
  color: #111827;
  font-weight: 600;
}

.source-preview,
.source-empty {
  margin: 8px 0 0;
  color: #64748b;
  max-height: 112px;
  overflow: auto;
  line-height: 1.6;
}

.source-empty {
  color: #b45309;
}

.field-label {
  display: block;
  margin-bottom: 7px;
  color: #374151;
  font-weight: 600;
}

.prompt-box {
  width: 100%;
  min-height: 76px;
  max-height: 180px;
  padding: 10px 11px;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  outline: none;
  color: #111827;
  background: #fff;
  overflow: auto;
  line-height: 1.55;
}

.prompt-box:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
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
  font-size: 13px;
  font-weight: 600;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-button {
  color: #fff;
  background: #4f46e5;
}

.primary-button:hover:not(:disabled) {
  background: #4338ca;
}

.secondary-button,
.ghost-button {
  color: #374151;
  background: #fff;
  border-color: #d1d5db;
}

.ghost-button {
  height: 26px;
  padding: 0 9px;
  font-size: 12px;
}

.secondary-button:hover:not(:disabled),
.ghost-button:hover:not(:disabled) {
  background: #f8fafc;
}

.danger-button {
  color: #b91c1c;
  background: #fff;
  border-color: #fecaca;
}

.result-card {
  flex: 1;
  min-height: 120px;
  max-height: min(360px, 48vh);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-head {
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.result-text {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 12px;
  overflow: auto;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.65;
}

.image-result {
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}

.image-result img {
  display: block;
  max-width: 100%;
  max-height: 260px;
  margin: 0 auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.image-caption {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.6;
}

.error-msg,
.tip-msg {
  flex-shrink: 0;
  margin: 0;
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
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.dialog-foot {
  justify-content: flex-end;
  flex-shrink: 0;
  position: sticky;
  bottom: -16px;
  z-index: 1;
  margin: 0 -16px -16px;
  padding: 10px 16px 16px;
  background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid #e5e7eb;
  backdrop-filter: blur(8px);
}

@media (max-height: 520px) {
  .source-preview,
  .source-empty {
    max-height: 84px;
  }

  .result-card {
    max-height: none;
  }
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
</style>
