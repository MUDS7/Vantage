<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import ChatInput from './components/ChatInput.vue'
import FileManager from './components/FileManager.vue'
import { Sparkles } from 'lucide-vue-next'
import { Menu } from 'lucide-vue-next'
import { useSidebarStore } from './stores/sidebar'
import { useViewStore } from './stores/view'

const sidebarStore = useSidebarStore()
const viewStore = useViewStore()
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
      <div v-if="viewStore.currentView === 'chat'" id="content-area" class="content-area">
        <!-- Greeting -->
        <div id="greeting" class="greeting">
          <div id="greeting-line" class="greeting-line">
            <Sparkles :size="20" class="sparkle-icon" />
            <span id="greeting-sub" class="greeting-sub">锋，你好</span>
          </div>
          <h1 id="greeting-title" class="greeting-title">需要我为你做些什么？</h1>
        </div>

        <!-- Chat Input -->
        <ChatInput />
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
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-lg);
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

.files-area {
  flex: 1;
  overflow: hidden;
}
</style>
