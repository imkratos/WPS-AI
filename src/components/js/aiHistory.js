// 历史会话管理，存储在 localStorage
// key: wps_ai_history

const HISTORY_KEY = 'wps_ai_history'
// 最多保留 50 条历史
const MAX_SESSIONS = 50

/**
 * 读取所有历史会话（按更新时间倒序）
 * @returns {Array}
 */
function listSessions() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

/**
 * 保存会话（新建或更新）
 * @param {object} session - { id, title, type, messages, createdAt, updatedAt }
 */
function saveSession(session) {
  const list = listSessions()
  const idx = list.findIndex((s) => s.id === session.id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...session, updatedAt: Date.now() }
  } else {
    // 超出上限时删除最旧的
    if (list.length >= MAX_SESSIONS) {
      list.sort((a, b) => a.updatedAt - b.updatedAt)
      list.shift()
    }
    list.push({ ...session, updatedAt: Date.now() })
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
}

/**
 * 根据 ID 获取单条会话
 * @param {string} id
 * @returns {object|null}
 */
function getSession(id) {
  return listSessions().find((s) => s.id === id) || null
}

/**
 * 删除单条会话
 * @param {string} id
 */
function deleteSession(id) {
  const list = listSessions().filter((s) => s.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
}

/**
 * 清空所有历史
 */
function clearAll() {
  localStorage.removeItem(HISTORY_KEY)
}

/**
 * 生成唯一 ID
 * @returns {string}
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export default {
  listSessions,
  saveSession,
  getSession,
  deleteSession,
  clearAll,
  genId
}
