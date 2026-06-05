<template>
  <main class="history-pane">
    <header class="history-head">
      <div>
        <p class="eyebrow">文策 AI</p>
        <h1>历史会话</h1>
      </div>
      <button class="ghost-button" :disabled="sessions.length === 0" @click="onClearAll">清空</button>
    </header>

    <section v-if="sessions.length === 0" class="empty-card">
      <p>暂无历史会话</p>
      <span>使用帮我写、伴写、文档问答等功能后，会话会自动保存在这里。</span>
    </section>

    <section v-else class="history-list">
      <article v-for="session in sessions" :key="session.id" class="history-item">
        <button class="item-main" @click="onOpenSession(session)">
          <span class="type-mark">{{ typeLabel(session.type).slice(0, 1) }}</span>
          <span class="item-info">
            <strong>{{ session.title || '无标题会话' }}</strong>
            <small>{{ typeLabel(session.type) }} · {{ formatTime(session.updatedAt) }}</small>
            <em>{{ sessionPreview(session) || '暂无预览内容' }}</em>
          </span>
        </button>
        <button class="delete-button" title="删除" @click="onDelete(session.id)">删除</button>
      </article>
    </section>
  </main>
</template>

<script>
import aiHistory from '../js/aiHistory.js'

const TYPE_LABELS = {
  write: '帮我写',
  companion: '伴写',
  qa: '文档问答',
  edit: '文本处理',
  layout: '排版',
  image: '图片'
}

export default {
  name: 'HistoryPane',
  data() {
    return {
      sessions: []
    }
  },
  created() {
    this.loadSessions()
  },
  methods: {
    loadSessions() {
      this.sessions = aiHistory.listSessions()
    },
    typeLabel(type) {
      return TYPE_LABELS[type] || 'AI 会话'
    },
    sessionPreview(session) {
      if (!session.messages?.length) return ''
      const last = [...session.messages].reverse().find((m) => m.role === 'assistant') || session.messages.at(-1)
      const content = (last?.content || '').replace(/\s+/g, ' ').trim()
      return content.length > 72 ? content.slice(0, 72) + '...' : content
    },
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
      if (diffMin < 1) return '刚刚'
      if (diffMin < 60) return `${diffMin} 分钟前`
      const diffHr = Math.floor(diffMin / 60)
      if (diffHr < 24) return `${diffHr} 小时前`
      const diffDay = Math.floor(diffHr / 24)
      if (diffDay < 7) return `${diffDay} 天前`
      return `${d.getMonth() + 1}/${d.getDate()}`
    },
    onDelete(id) {
      aiHistory.deleteSession(id)
      this.loadSessions()
    },
    onClearAll() {
      if (!confirm('确定清空所有历史会话？此操作不可撤销。')) return
      aiHistory.clearAll()
      this.loadSessions()
    },
    onOpenSession(session) {
      if (typeof window !== 'undefined' && window.Application) {
        try {
          window.Application.PluginStorage.setItem('ai_resume_session', session.id)
          window.Application.PluginStorage.setItem('ai_resume_type', session.type)
        } catch {
          // 非 WPS 环境忽略
        }
      }
      alert(`已记录要恢复的会话：${session.title || '无标题会话'}。请打开对应 AI 面板查看。`)
    }
  }
}
</script>

<style scoped>
.history-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  color: #1f2937;
  background:
    linear-gradient(180deg, #f7f8ff 0%, #fff 34%),
    #fff;
  font-size: 13px;
}

.history-head,
.empty-card,
.history-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.history-head {
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

h1 {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 750;
  line-height: 1.2;
}

button {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  cursor: pointer;
  font-weight: 700;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ghost-button {
  color: #374151;
  background: #fff;
  border: 1px solid #d1d5db;
}

.empty-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;
  text-align: center;
}

.empty-card p {
  margin: 0 0 6px;
  color: #111827;
  font-weight: 750;
}

.empty-card span {
  color: #64748b;
  line-height: 1.6;
}

.history-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.item-main {
  flex: 1;
  min-width: 0;
  height: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
}

.item-main:hover {
  background: #f8fafc;
}

.type-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  color: #4f46e5;
  background: #eef2ff;
}

.item-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-info strong,
.item-info small,
.item-info em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-info strong {
  color: #111827;
  font-weight: 750;
}

.item-info small {
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
}

.item-info em {
  margin-top: 5px;
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.delete-button {
  width: 58px;
  height: auto;
  flex-shrink: 0;
  border: 0;
  border-left: 1px solid #e5e7eb;
  border-radius: 0;
  color: #b91c1c;
  background: #fff;
}

.delete-button:hover {
  background: #fef2f2;
}
</style>
