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



<style scoped src="./ChatMessages.css"></style>
