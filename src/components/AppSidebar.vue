<script setup lang="ts">
import { ref } from 'vue'
import {
  Menu,
  Search,
  SquarePen,
  Home,
  Settings,
  Scan,
} from 'lucide-vue-next'
import { useSidebarStore } from '../stores/sidebar'
import { useViewStore } from '../stores/view'

const sidebarStore = useSidebarStore()
const viewStore = useViewStore()

const conversations: string[] = []
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
        <button id="new-chat-btn" class="sidebar-btn" :class="{ active: viewStore.currentView === 'chat' }" @click="viewStore.setView('chat')">
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
        <button
          v-for="(title, index) in conversations"
          :key="index"
          class="conversation-item"
        >
          {{ title }}
        </button>
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
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.conversation-item:hover {
  background: var(--color-hover);
}

.sidebar-footer {
  border-top: 1px solid var(--sidebar-border);
  padding: var(--space-md);
}


</style>
