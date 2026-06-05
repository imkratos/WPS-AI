<template>
  <main class="settings-page">
    <header class="settings-head">
      <div>
        <p class="eyebrow">文策 AI</p>
        <h1>设置</h1>
      </div>
      <span class="status-pill">{{ configuredText }}</span>
    </header>

    <section class="settings-card">
      <div class="section-head">
        <h2>大模型配置</h2>
        <button class="ghost-button" :disabled="testing" @click="onTestConn">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
      </div>

      <label class="field">
        <span>接口地址 Base URL</span>
        <input
          v-model.trim="form.apiUrl"
          type="url"
          placeholder="https://api.openai.com"
        />
        <small>填写兼容 OpenAI 格式的服务根地址，系统会自动拼接 `/v1/chat/completions`。</small>
      </label>

      <label class="field key-field">
        <span>API Key</span>
        <div class="key-row">
          <input
            v-model.trim="form.apiKey"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
          />
          <button class="ghost-button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        </div>
      </label>

      <label class="field">
        <span>模型名称</span>
        <div class="model-row">
          <input v-model.trim="form.model" type="text" placeholder="gpt-4o / deepseek-chat / qwen-plus" />
          <select @change="onPresetSelect">
            <option value="">选择预设</option>
            <option v-for="p in modelPresets" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </label>

      <p v-if="testResult" class="test-result" :class="{ ok: testResult.ok }">
        {{ testResult.message }}
      </p>
    </section>

    <section class="settings-card">
      <div class="section-head">
        <h2>知识库配置</h2>
        <span class="soft-tag">可选</span>
      </div>

      <label class="field">
        <span>知识库服务地址</span>
        <input
          v-model.trim="form.kbUrl"
          type="url"
          placeholder="http://localhost:8000"
        />
        <small>留空则不使用知识库。配置后文档问答会请求 `POST /query`，请求体包含 `question` 和 `top_k`。</small>
      </label>
    </section>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    <p v-if="savedTip" class="tip-msg">设置已保存。</p>

    <footer class="settings-foot">
      <button class="primary-button" @click="onSave">保存</button>
      <button class="secondary-button" @click="onClose">关闭</button>
    </footer>
  </main>
</template>

<script>
import aiConfig from '../js/aiConfig.js'
import aiApi from '../js/ai.js'

export default {
  name: 'AiSettings',
  data() {
    return {
      form: {
        apiUrl: '',
        apiKey: '',
        model: '',
        kbUrl: ''
      },
      showKey: false,
      testing: false,
      testResult: null,
      savedTip: false,
      errorMsg: '',
      modelPresets: [
        'gpt-4o',
        'gpt-4o-mini',
        'deepseek-chat',
        'deepseek-reasoner',
        'qwen-turbo',
        'qwen-plus',
        'qwen-max',
        'glm-4',
        'glm-4-flash',
        'moonshot-v1-8k',
        'moonshot-v1-32k'
      ]
    }
  },
  computed: {
    configuredText() {
      return this.form.apiUrl && this.form.apiKey && this.form.model ? '已配置' : '未配置'
    }
  },
  created() {
    this.form = { ...aiConfig.getConfig() }
  },
  methods: {
    onPresetSelect(e) {
      if (e.target.value) {
        this.form.model = e.target.value
        e.target.value = ''
      }
    },
    validate() {
      if (!this.form.apiUrl) return '请填写大模型接口地址。'
      if (!this.form.apiKey) return '请填写 API Key。'
      if (!this.form.model) return '请填写模型名称。'
      return ''
    },
    async onTestConn() {
      this.errorMsg = ''
      const validation = this.validate()
      if (validation) {
        this.errorMsg = validation
        return
      }
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await aiApi.testConnection(this.form)
      } catch (err) {
        this.testResult = { ok: false, message: err.message }
      } finally {
        this.testing = false
      }
    },
    onSave() {
      this.errorMsg = ''
      const validation = this.validate()
      if (validation) {
        this.errorMsg = validation
        return
      }
      aiConfig.setConfig(this.form)
      this.savedTip = true
      setTimeout(() => {
        this.savedTip = false
      }, 1800)
    },
    onClose() {
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
.settings-page {
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
    linear-gradient(180deg, #f7f8ff 0%, #fff 34%),
    #fff;
  font-size: 13px;
}

.settings-head,
.settings-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.settings-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 14px 16px;
}

.eyebrow {
  margin: 0 0 3px;
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
}

h1,
h2 {
  margin: 0;
  color: #111827;
  line-height: 1.2;
}

h1 {
  font-size: 18px;
  font-weight: 750;
}

h2 {
  font-size: 14px;
  font-weight: 750;
}

.status-pill,
.soft-tag {
  padding: 4px 9px;
  border-radius: 999px;
  color: #475569;
  background: #eef2ff;
  font-size: 12px;
}

.soft-tag {
  background: #f1f5f9;
}

.settings-card {
  flex-shrink: 0;
  padding: 14px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.field {
  display: block;
  margin-top: 12px;
}

.field span {
  display: block;
  margin-bottom: 6px;
  color: #374151;
  font-weight: 700;
}

.field small {
  display: block;
  margin-top: 5px;
  color: #64748b;
  line-height: 1.45;
}

input,
select {
  width: 100%;
  height: 34px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  outline: none;
  color: #111827;
  background: #fff;
}

input:focus,
select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
}

.key-row,
.model-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.key-row input,
.model-row input {
  flex: 1;
}

.model-row select {
  width: 120px;
  flex-shrink: 0;
}

button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 7px;
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

.test-result,
.error-msg,
.tip-msg {
  margin: 12px 0 0;
  padding: 9px 11px;
  border-radius: 7px;
  line-height: 1.45;
}

.test-result {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.test-result.ok,
.tip-msg {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.error-msg {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.settings-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

@media (max-width: 420px) {
  .key-row,
  .model-row,
  .settings-foot {
    flex-wrap: wrap;
  }

  .key-row input,
  .model-row input,
  .model-row select {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
