// 大模型配置管理，存储在 localStorage
// key: wps_ai_config

const CONFIG_KEY = 'wps_ai_config'

// 默认配置
const DEFAULT_CONFIG = {
  apiUrl: '',    // 大模型接口 baseURL，如 https://api.openai.com
  apiKey: '',    // API Key
  model: '',     // 模型名称，如 gpt-4o / deepseek-chat
  kbUrl: ''      // 知识库服务地址（RAG 接口）
}

/**
 * 读取当前配置
 * @returns {object}
 */
function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * 保存配置
 * @param {object} config
 */
function setConfig(config) {
  const current = getConfig()
  const merged = { ...current, ...config }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged))
}

/**
 * 清除配置
 */
function clearConfig() {
  localStorage.removeItem(CONFIG_KEY)
}

/**
 * 检查是否已完成基础配置
 * @returns {boolean}
 */
function isConfigured() {
  const cfg = getConfig()
  return !!(cfg.apiUrl && cfg.apiKey && cfg.model)
}

export default {
  getConfig,
  setConfig,
  clearConfig,
  isConfigured
}
