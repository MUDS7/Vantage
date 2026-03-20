<script setup lang="ts">
import { ref, reactive, nextTick, watch } from 'vue'
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Copy, MoreVertical, Brain, ChevronDown } from 'lucide-vue-next'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()
const scrollContainer = ref<HTMLElement | null>(null)

// 追踪每条思维链消息的折叠状态
const reasoningExpanded = reactive<Record<string, boolean>>({})

function toggleReasoning(msgId: string) {
  reasoningExpanded[msgId] = !reasoningExpanded[msgId]
}

// 自动滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTo({
        top: scrollContainer.value.scrollHeight,
        behavior: 'smooth',
      })
    }
  })
}

watch(
  () => chatStore.messages.length,
  () => {
    scrollToBottom()
  },
)

watch(
  () => chatStore.isTyping,
  () => {
    scrollToBottom()
  },
)
</script>

<template>
  <div id="chat-messages-container" ref="scrollContainer" class="chat-messages-container">
    <div class="chat-messages-inner">
      <div
        v-for="msg in chatStore.messages"
        :key="msg.id"
        :id="'msg-' + msg.id"
        class="message-row"
        :class="msg.role === 'user' ? 'message-row--user' : 'message-row--assistant'"
      >
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="user-bubble">
          {{ msg.content }}
        </div>

        <!-- AI 消息 -->
        <div v-else class="assistant-message">
          <div class="assistant-avatar">
            <Sparkles :size="16" />
          </div>
          <div class="assistant-content">
            <!-- 思维链折叠面板 -->
            <div v-if="msg.reasoningContent" class="reasoning-panel">
              <button
                :id="'reasoning-toggle-' + msg.id"
                class="reasoning-toggle"
                @click="toggleReasoning(msg.id)"
              >
                <Brain :size="14" class="reasoning-icon" />
                <span class="reasoning-label">思考过程</span>
                <ChevronDown
                  :size="14"
                  class="reasoning-chevron"
                  :class="{ 'reasoning-chevron--open': reasoningExpanded[msg.id] }"
                />
              </button>
              <div
                class="reasoning-content"
                :class="{ 'reasoning-content--open': reasoningExpanded[msg.id] }"
              >
                <div class="reasoning-text" v-html="formatMarkdown(msg.reasoningContent)"></div>
              </div>
            </div>
            <div class="assistant-text" v-html="formatMarkdown(msg.content)"></div>
            <div class="assistant-actions">
              <button class="action-btn" aria-label="点赞">
                <ThumbsUp :size="16" />
              </button>
              <button class="action-btn" aria-label="点踩">
                <ThumbsDown :size="16" />
              </button>
              <button class="action-btn" aria-label="重新生成">
                <RefreshCw :size="16" />
              </button>
              <button class="action-btn" aria-label="复制">
                <Copy :size="16" />
              </button>
              <button class="action-btn" aria-label="更多">
                <MoreVertical :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 打字指示器 -->
      <div v-if="chatStore.isTyping" class="message-row message-row--assistant">
        <div class="assistant-message">
          <div class="assistant-avatar">
            <Sparkles :size="16" />
          </div>
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 简单的 Markdown 格式化
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

export default {}
</script>

<style scoped>
.chat-messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl) 0;
  scroll-behavior: smooth;
}

.chat-messages-inner {
  max-width: 672px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* 消息行 */
.message-row {
  display: flex;
  animation: messageIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-row--user {
  justify-content: flex-end;
}

.message-row--assistant {
  justify-content: flex-start;
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 用户消息气泡 */
.user-bubble {
  max-width: 80%;
  padding: 12px 20px;
  background: #f0f0f0;
  border-radius: 20px 20px 4px 20px;
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  line-height: 1.6;
  word-break: break-word;
}

/* AI 消息 */
.assistant-message {
  display: flex;
  gap: 12px;
  max-width: 90%;
  align-items: flex-start;
}

.assistant-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-blue);
  margin-top: 2px;
}

.assistant-content {
  flex: 1;
  min-width: 0;
}

.assistant-text {
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--color-text-primary);
  word-break: break-word;
}

.assistant-text :deep(strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

.assistant-text :deep(code) {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  font-size: 0.875em;
  font-family: 'Fira Code', 'Menlo', monospace;
}

/* 思维链面板 */
.reasoning-panel {
  margin-bottom: 10px;
}

.reasoning-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
  border: 1px solid rgba(139, 92, 246, 0.15);
  color: #7c3aed;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reasoning-toggle:hover {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(59, 130, 246, 0.14));
  border-color: rgba(139, 92, 246, 0.25);
}

.reasoning-icon {
  flex-shrink: 0;
}

.reasoning-chevron {
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.reasoning-chevron--open {
  transform: rotate(180deg);
}

.reasoning-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
  opacity: 0;
}

.reasoning-content--open {
  max-height: 2000px;
  opacity: 1;
}

.reasoning-text {
  margin-top: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(59, 130, 246, 0.04));
  border-left: 3px solid rgba(139, 92, 246, 0.3);
  border-radius: 0 8px 8px 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--color-text-secondary);
  word-break: break-word;
}

.reasoning-text :deep(strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

.reasoning-text :deep(code) {
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  font-size: 0.85em;
  font-family: 'Fira Code', 'Menlo', monospace;
}

/* 操作按钮 */
.assistant-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.assistant-message:hover .assistant-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}

.action-btn:hover {
  background: var(--color-hover);
  color: var(--color-text-primary);
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: dotBounce 1.4s ease-in-out infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.16s;
}

.dot:nth-child(3) {
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
</style>
