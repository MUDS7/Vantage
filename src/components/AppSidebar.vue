<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Menu,
  Search,
  SquarePen,
  Home,
  Settings,
  Scan,
  Trash2,
} from 'lucide-vue-next'
import { useSidebarStore } from '../stores/sidebar'
import { useViewStore } from '../stores/view'
import { useChatStore } from '../stores/chat'

const sidebarStore = useSidebarStore()
const viewStore = useViewStore()
const chatStore = useChatStore()

// 悬浮显示删除按钮的会话 ID
const hoveredSessionId = ref<string | null>(null)

// 组件挂载时加载会话列表
onMounted(() => {
  chatStore.fetchSessions()
})

/**
 * 发起新对话
 */
function handleNewChat() {
  chatStore.newChat()
  viewStore.setView('chat')
}

/**
 * 点击某个会话，加载其详情
 */
async function handleSelectSession(sessionId: string) {
  viewStore.setView('chat')
  await chatStore.loadSession(sessionId)
}

/**
 * 删除某个会话
 */
async function handleDeleteSession(sessionId: string, event: Event) {
  event.stopPropagation()
  const confirmed = window.confirm('确定要删除这个会话吗？删除后无法恢复。')
  if (!confirmed) return
  await chatStore.deleteSession(sessionId)
}
</script>

<template>
  <aside id="sidebar" class="sidebar" :class="{ collapsed: sidebarStore.isCollapsed }">
    <!-- Header -->
    <div id="sidebar-header" class="sidebar-header">
      <button id="sidebar-menu-btn" class="icon-btn" aria-label="菜单" @click="sidebarStore.toggle()">
        <Menu :size="20" />
      </button>
      <button id="sidebar-search-btn" class="icon-btn" aria-label="搜索">
        <Search :size="20" />
      </button>
    </div>

    <!-- Logo -->
    <div id="sidebar-logo" class="sidebar-logo">
      <h1 id="sidebar-logo-title">Gemini</h1>
    </div>

    <!-- New Chat -->
    <div id="sidebar-new-chat-section" class="sidebar-section">
      <div id="new-chat-row" class="new-chat-row">
        <button id="new-chat-btn" class="sidebar-btn" :class="{ active: viewStore.currentView === 'chat' && !chatStore.sessionId }" @click="handleNewChat">
          <SquarePen :size="20" />
          <span id="new-chat-text">发起新对话</span>
        </button>
        <button id="temp-chat-btn" class="icon-btn small tooltip" data-tooltip="临时对话" aria-label="临时对话">
          <Scan :size="16" />
        </button>
      </div>
    </div>

    <!-- My Content -->
    <div id="sidebar-my-content-section" class="sidebar-section compact">
      <button id="my-content-btn" class="sidebar-btn full-width" :class="{ active: viewStore.currentView === 'files' }" @click="viewStore.setView('files')">
        <Home :size="20" />
        <span id="my-content-text">我的内容</span>
      </button>
    </div>

    <!-- Conversations -->
    <div id="sidebar-conversations" class="sidebar-conversations">
      <div id="conversations-title" class="conversations-title">对话</div>
      <div id="conversations-list" class="conversations-list">
        <!-- 加载状态 -->
        <div v-if="chatStore.sessionsLoading && chatStore.sessions.length === 0" class="sessions-loading">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
        </div>

        <!-- 会话列表 -->
        <button
          v-for="session in chatStore.sessions"
          :key="session.session_id"
          :id="'session-' + session.session_id"
          class="conversation-item"
          :class="{ 'conversation-item--active': chatStore.sessionId === session.session_id }"
          @click="handleSelectSession(session.session_id)"
          @mouseenter="hoveredSessionId = session.session_id"
          @mouseleave="hoveredSessionId = null"
        >
          <span class="conversation-item-title">{{ session.title || '新对话' }}</span>
          <!-- 删除按钮（悬浮显示） -->
          <button
            v-if="hoveredSessionId === session.session_id"
            :id="'session-delete-' + session.session_id"
            class="session-delete-btn"
            aria-label="删除会话"
            @click="handleDeleteSession(session.session_id, $event)"
          >
            <Trash2 :size="14" />
          </button>
        </button>

        <!-- 无会话提示 -->
        <div v-if="!chatStore.sessionsLoading && chatStore.sessions.length === 0" class="no-sessions">
          暂无对话记录
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div id="sidebar-footer" class="sidebar-footer">
      <button id="settings-btn" class="sidebar-btn full-width">
        <Settings :size="20" />
        <span id="settings-text">设置和帮助</span>
      </button>


    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100%;
  background: linear-gradient(to bottom, var(--sidebar-bg-from), var(--sidebar-bg-to));
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.sidebar.collapsed {
  width: 0;
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  color: var(--sidebar-text);
  transition: background var(--transition-fast);
}

.icon-btn:hover {
  background: var(--color-hover);
}

.icon-btn.small {
  width: 32px;
  height: 32px;
}

/* Tooltip */
.tooltip {
  position: relative;
}

.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--color-text-primary, #1f2937);
  color: #fff;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tooltip::before {
  content: '';
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: var(--color-text-primary, #1f2937);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tooltip:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.tooltip:hover::before {
  opacity: 1;
}

.sidebar-logo {
  padding: var(--space-sm) var(--space-lg);
}

.sidebar-logo h1 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--sidebar-text-heading);
}

.sidebar-section {
  padding: var(--space-sm) var(--space-md);
}

.sidebar-section.compact {
  padding: var(--space-xs) var(--space-md);
}

.new-chat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-btn {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background var(--transition-fast);
  white-space: nowrap;
}

.sidebar-btn:hover {
  background: var(--color-hover);
}

.sidebar-btn.active {
  background: var(--color-hover-strong);
}

.sidebar-btn.full-width {
  width: 100%;
}



.sidebar-conversations {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm) var(--space-md);
}

.conversations-title {
  padding: 0 var(--space-md);
  margin-bottom: var(--space-sm);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text-heading);
}

.conversations-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conversation-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  transition: background var(--transition-fast);
  cursor: pointer;
}

.conversation-item:hover {
  background: var(--color-hover);
}

.conversation-item--active {
  background: var(--color-hover-strong);
  color: var(--color-text-primary);
  font-weight: 500;
}

.conversation-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 会话删除按钮 */
.session-delete-btn {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  animation: fadeInBtn 0.15s ease;
}

@keyframes fadeInBtn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.session-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 加载状态 */
.sessions-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-lg) 0;
}

.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: dotBounce 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.16s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes dotBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 无会话提示 */
.no-sessions {
  padding: var(--space-lg) var(--space-md);
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.sidebar-footer {
  border-top: 1px solid var(--sidebar-border);
  padding: var(--space-md);
}

</style>
