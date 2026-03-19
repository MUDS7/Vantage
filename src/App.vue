<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import ChatInput from './components/ChatInput.vue'
import ChatMessages from './components/ChatMessages.vue'
import FileManager from './components/FileManager.vue'
import { Sparkles } from 'lucide-vue-next'
import { Menu } from 'lucide-vue-next'
import { useSidebarStore } from './stores/sidebar'
import { useViewStore } from './stores/view'
import { useChatStore } from './stores/chat'

const sidebarStore = useSidebarStore()
const viewStore = useViewStore()
const chatStore = useChatStore()
</script>

<template>
  <div id="app-layout" class="app-layout">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content -->
    <main id="main-content" class="main-content">
      <!-- Sidebar Toggle (visible when sidebar is collapsed) -->
      <button
        id="sidebar-toggle-btn"
        v-if="sidebarStore.isCollapsed"
        class="sidebar-toggle-btn"
        aria-label="展开侧边栏"
        @click="sidebarStore.toggle()"
      >
        <Menu :size="20" />
      </button>

      <!-- Header -->
      <AppHeader />

      <!-- Content Area -->
      <div v-if="viewStore.currentView === 'chat'" id="content-area" class="content-area" :class="{ 'content-area--chatting': chatStore.hasMessages }">

        <!-- 欢迎页模式：无消息时显示 -->
        <div v-if="!chatStore.hasMessages" class="welcome-view">
          <div id="greeting" class="greeting">
            <div id="greeting-line" class="greeting-line">
              <Sparkles :size="20" class="sparkle-icon" />
              <span id="greeting-sub" class="greeting-sub">锋，你好</span>
            </div>
            <h1 id="greeting-title" class="greeting-title">需要我为你做些什么？</h1>
          </div>

          <!-- Chat Input (居中) -->
          <ChatInput />
        </div>

        <!-- 聊天模式：有消息时显示 -->
        <template v-else>
          <!-- 消息列表 -->
          <ChatMessages />

          <!-- Chat Input (底部) -->
          <div class="chat-input-bottom">
            <ChatInput />
          </div>
        </template>
      </div>

      <!-- File Manager -->
      <div v-else class="files-area">
        <FileManager />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: var(--color-bg);
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  position: relative;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-toggle-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.2s ease, transform 0.2s ease;
  z-index: 10;
}

.sidebar-toggle-btn:hover {
  background: var(--color-hover);
  transform: scale(1.05);
}

.content-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* 欢迎页 - 居中布局 */
.welcome-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-lg);
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.greeting {
  margin-bottom: var(--space-2xl);
  text-align: center;
}

.greeting-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.sparkle-icon {
  color: var(--color-accent-blue);
}

.greeting-sub {
  font-size: 1.125rem;
  color: var(--color-text-secondary);
}

.greeting-title {
  font-size: 1.875rem;
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: 1.3;
}

/* 聊天模式 - 底部输入框 */
.chat-input-bottom {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 0 var(--space-lg) var(--space-lg);
  animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.files-area {
  flex: 1;
  overflow: hidden;
}
</style>

