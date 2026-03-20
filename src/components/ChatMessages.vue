<script setup lang="ts">
import { ref, reactive, nextTick, watch } from 'vue'
import { Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Copy, MoreVertical, Brain, ChevronDown, FileText, ExternalLink } from 'lucide-vue-next'
import { useChatStore, type ReferenceInfo } from '../stores/chat'
import { useViewStore } from '../stores/view'
import { marked } from 'marked'

// 配置 marked 选项
marked.setOptions({
  breaks: true,    // 支持 GFM 换行
  gfm: true,       // 启用 GitHub Flavored Markdown
})

/**
 * 使用 marked 渲染 Markdown 为 HTML
 */
function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text) as string
}

const chatStore = useChatStore()
const viewStore = useViewStore()
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

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

/**
 * 获取文件后缀名（大写）
 */
function getFileExt(name: string): string {
  const dotIdx = name.lastIndexOf('.')
  if (dotIdx === -1) return 'FILE'
  return name.slice(dotIdx + 1).toUpperCase()
}

/**
 * 重新发送：删除该用户消息及其之后的所有消息，然后重新发送（带上文件）
 */
function resendMessage(msgId: string) {
  const idx = chatStore.messages.findIndex((m) => m.id === msgId)
  if (idx === -1) return
  const msg = chatStore.messages[idx]
  if (!msg) return
  const content = msg.content
  // 取出原始 File 对象
  const files = msg.files?.map((f) => f.file).filter((f): f is File => !!f)
  // 移除该消息及之后的所有消息
  chatStore.messages.splice(idx)
  // 重新发送（带上文件）
  chatStore.sendMessage(content, files && files.length > 0 ? files : undefined)
}

/**
 * 点击引用来源，跳转到文件预览并定位页码
 */
function navigateToReference(ref: ReferenceInfo) {
  // 从 file_path 提取文件夹名，格式为 "data/uploads/{folderName}/{fileName}"
  const parts = ref.file_path.split('/')
  // 文件夹名是倒数第二个部分
  const folderName = parts.length >= 2 ? parts[parts.length - 2]! : ''
  if (!folderName) return

  viewStore.requestFilePreview({
    folderName,
    fileName: ref.file_name,
    pageNumber: ref.page_number > 0 ? ref.page_number : undefined,
  })
}
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
        <div v-if="msg.role === 'user'" class="user-message-group">
          <button
            :id="'resend-btn-' + msg.id"
            class="resend-btn"
            aria-label="重新发送"
            title="重新发送"
            @click="resendMessage(msg.id)"
          >
            <RefreshCw :size="14" />
          </button>
          <div class="user-bubble-wrapper">
            <!-- 文件卡片区域 -->
            <div v-if="msg.files && msg.files.length > 0" class="msg-files-area">
              <div
                v-for="(file, fIdx) in msg.files"
                :key="fIdx"
                class="msg-file-card"
              >
                <div class="msg-file-icon">
                  <FileText :size="20" />
                </div>
                <div class="msg-file-info">
                  <span class="msg-file-name">{{ file.name }}</span>
                  <span class="msg-file-meta">{{ getFileExt(file.name) }} {{ formatFileSize(file.size) }}</span>
                </div>
              </div>
            </div>
            <!-- 文字气泡 -->
            <div class="user-bubble">
              {{ msg.content }}
            </div>
          </div>
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
                <div class="reasoning-text markdown-body" v-html="renderMarkdown(msg.reasoningContent)"></div>
              </div>
            </div>
            <div class="assistant-text markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <!-- 引用来源 -->
            <div v-if="msg.references && msg.references.length > 0" class="references-section">
              <div class="references-label">参考来源</div>
              <div class="references-list">
                <div
                  v-for="(ref, rIdx) in msg.references"
                  :key="rIdx"
                  :id="'ref-' + msg.id + '-' + rIdx"
                  class="reference-item reference-item--clickable"
                  @click="navigateToReference(ref)"
                >
                  <div class="reference-header">
                    <FileText :size="13" class="reference-file-icon" />
                    <span class="reference-file-name">{{ ref.file_name }}</span>
                    <span v-if="ref.page_number > 0" class="reference-page">第{{ ref.page_number }}页</span>
                    <span class="reference-chunk">#{{ ref.chunk_index }}</span>
                    <ExternalLink :size="11" class="reference-link-icon" />
                  </div>
                  <div v-if="ref.snippet" class="reference-snippet">{{ ref.snippet }}</div>
                </div>
              </div>
            </div>
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

/* 用户消息容器（气泡 + 重新发送按钮） */
.user-message-group {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  max-width: 80%;
}

/* 重新发送按钮 */
.resend-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: var(--color-text-muted, #9ca3af);
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(8px) scale(0.8);
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.2s ease,
              color 0.2s ease;
  pointer-events: none;
}

.user-message-group:hover .resend-btn {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.resend-btn:hover {
  background: rgba(0, 0, 0, 0.07);
  color: var(--color-text-primary, #374151);
}

.resend-btn:active {
  transform: translateX(0) scale(0.9);
}

/* 点击后旋转动画 */
.resend-btn:active svg {
  animation: resendSpin 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes resendSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 用户消息气泡包裹器（文件卡片 + 文字气泡） */
.user-bubble-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

/* 文件卡片区域 */
.msg-files-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  align-items: flex-end;
}

.msg-file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  min-width: 180px;
  max-width: 260px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  animation: fileCardSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fileCardSlideIn {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.msg-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
  flex-shrink: 0;
}

.msg-file-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.msg-file-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msg-file-meta {
  font-size: 0.6875rem;
  color: var(--color-text-secondary, #6b7280);
  letter-spacing: 0.02em;
}

/* 用户消息气泡 */
.user-bubble {
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

/* ===== Markdown 渲染样式（通用） ===== */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-primary);
}

.markdown-body :deep(h1) { font-size: 1.5em; }
.markdown-body :deep(h2) { font-size: 1.3em; }
.markdown-body :deep(h3) { font-size: 1.15em; }
.markdown-body :deep(h4) { font-size: 1.05em; }

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p) {
  margin: 0.6em 0;
  line-height: 1.75;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

.markdown-body :deep(em) {
  font-style: italic;
}

/* 行内代码 */
.markdown-body :deep(code) {
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'Fira Code', 'Menlo', 'Consolas', monospace;
}

/* 代码块 */
.markdown-body :deep(pre) {
  margin: 0.8em 0;
  padding: 16px;
  background: #1e1e2e;
  border-radius: 10px;
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
  border-radius: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #cdd6f4;
  font-family: 'Fira Code', 'Menlo', 'Consolas', monospace;
}

/* 表格 */
.markdown-body :deep(table) {
  width: 100%;
  margin: 0.8em 0;
  border-collapse: collapse;
  border-radius: 8px;
  overflow: hidden;
  font-size: 0.875rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.markdown-body :deep(thead) {
  background: rgba(0, 0, 0, 0.04);
}

.markdown-body :deep(th) {
  padding: 10px 14px;
  font-weight: 600;
  text-align: left;
  color: var(--color-text-primary);
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
}

.markdown-body :deep(td) {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: var(--color-text-secondary);
}

.markdown-body :deep(tr:last-child td) {
  border-bottom: none;
}

.markdown-body :deep(tbody tr:hover) {
  background: rgba(0, 0, 0, 0.02);
}

/* 列表 */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.8em;
}

.markdown-body :deep(li) {
  margin: 0.3em 0;
  line-height: 1.7;
}

.markdown-body :deep(li > ul),
.markdown-body :deep(li > ol) {
  margin: 0.2em 0;
}

/* 分割线 */
.markdown-body :deep(hr) {
  margin: 1.2em 0;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

/* 引用块 */
.markdown-body :deep(blockquote) {
  margin: 0.8em 0;
  padding: 8px 16px;
  border-left: 3px solid rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.04);
  border-radius: 0 6px 6px 0;
  color: var(--color-text-secondary);
}

.markdown-body :deep(blockquote p) {
  margin: 0.3em 0;
}

/* 链接 */
.markdown-body :deep(a) {
  color: #3b82f6;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.markdown-body :deep(a:hover) {
  border-bottom-color: #3b82f6;
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



/* 引用来源区域 */
.references-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.references-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.references-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reference-item {
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.025);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.reference-item:hover {
  background: rgba(0, 0, 0, 0.045);
  border-color: rgba(0, 0, 0, 0.1);
}

.reference-item--clickable {
  cursor: pointer;
}

.reference-item--clickable:hover {
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.04);
}

.reference-link-icon {
  color: var(--color-text-muted, #9ca3af);
  opacity: 0;
  flex-shrink: 0;
  margin-left: auto;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.reference-item--clickable:hover .reference-link-icon {
  opacity: 1;
  color: #3b82f6;
}

.reference-header {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.reference-file-icon {
  color: var(--color-text-muted, #9ca3af);
  flex-shrink: 0;
}

.reference-file-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.reference-page,
.reference-chunk {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #9ca3af);
  white-space: nowrap;
}

.reference-snippet {
  margin-top: 4px;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--color-text-muted, #9ca3af);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
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
