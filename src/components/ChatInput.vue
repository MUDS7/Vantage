<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Send, X, FileText, Image, Film, Music, Archive, File, Brain } from 'lucide-vue-next'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()
const inputText = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

interface UploadFile {
  id: string
  file: File
  name: string
  size: string
  type: string
  previewUrl?: string
}

const uploadedFiles = ref<UploadFile[]>([])

const hasFiles = computed(() => uploadedFiles.value.length > 0)

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  await chatStore.sendMessage(text)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileCategory(type: string): string {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z')) return 'archive'
  if (type.includes('pdf') || type.includes('doc') || type.includes('text') || type.includes('sheet') || type.includes('presentation')) return 'document'
  return 'file'
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  for (const file of Array.from(input.files)) {
    const uploadFile: UploadFile = {
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileCategory(file.type),
    }

    // 图片文件生成预览
    if (uploadFile.type === 'image') {
      uploadFile.previewUrl = URL.createObjectURL(file)
    }

    uploadedFiles.value.push(uploadFile)
  }

  // 重置 input 以便再次选择同一文件
  input.value = ''
}

function removeFile(id: string) {
  const index = uploadedFiles.value.findIndex((f) => f.id === id)
  if (index !== -1) {
    const removed = uploadedFiles.value[index]
    if (removed && removed.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl)
    }
    uploadedFiles.value.splice(index, 1)
  }
}
</script>

<template>
  <div id="chat-input-wrapper" class="chat-input-wrapper">
    <!-- Hidden File Input -->
    <input
      id="hidden-file-input"
      ref="fileInputRef"
      type="file"
      multiple
      class="hidden-file-input"
      @change="handleFileChange"
    />

    <div id="chat-input-card" class="chat-input-card">
      <!-- File Preview Area -->
      <div id="file-preview-area" v-if="hasFiles" class="file-preview-area">
        <div
          v-for="file in uploadedFiles"
          :key="file.id"
          class="file-card"
        >
          <!-- 图片缩略图 -->
          <div v-if="file.type === 'image' && file.previewUrl" :id="'file-thumb-' + file.id" class="file-thumb">
            <img :src="file.previewUrl" :alt="file.name" />
          </div>
          <!-- 非图片文件图标 -->
          <div v-else :id="'file-icon-' + file.id" class="file-icon" :class="'file-icon--' + file.type">
            <FileText v-if="file.type === 'document'" :size="20" />
            <Film v-else-if="file.type === 'video'" :size="20" />
            <Music v-else-if="file.type === 'audio'" :size="20" />
            <Archive v-else-if="file.type === 'archive'" :size="20" />
            <File v-else :size="20" />
          </div>
          <!-- 文件信息 -->
          <div :id="'file-info-' + file.id" class="file-info">
            <span :id="'file-name-' + file.id" class="file-name">{{ file.name }}</span>
            <span :id="'file-size-' + file.id" class="file-size">{{ file.size }}</span>
          </div>
          <!-- 删除按钮 -->
          <button :id="'file-remove-btn-' + file.id" class="file-remove-btn" @click="removeFile(file.id)" aria-label="移除文件">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- Input Area -->
      <div id="input-area" class="input-area">
        <input
          id="text-input"
          v-model="inputText"
          type="text"
          placeholder="问问 Gemini 3"
          class="text-input"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Toolbar -->
      <div id="toolbar" class="toolbar">
        <div class="toolbar-left">
          <button id="add-attachment-btn" class="toolbar-btn" aria-label="添加附件" @click="triggerFileInput">
            <Plus :size="20" />
          </button>
          <button
            id="thinking-toggle-btn"
            class="toolbar-btn thinking-btn"
            :class="{ 'thinking-btn--active': chatStore.thinkingEnabled }"
            aria-label="思考模式"
            :title="chatStore.thinkingEnabled ? '关闭思考模式' : '开启思考模式'"
            @click="chatStore.toggleThinking()"
          >
            <Brain :size="18" class="thinking-brain-icon" />
          </button>
        </div>
        <button id="send-btn" class="send-btn" aria-label="发送" @click="handleSend">
          <Send :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hidden-file-input {
  display: none;
}

.chat-input-wrapper {
  width: 100%;
  max-width: 672px;
}

.chat-input-card {
  border-radius: var(--radius-2xl);
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  box-shadow: var(--input-shadow);
  overflow: hidden;
  transition: box-shadow var(--transition-normal), border-color var(--transition-normal);
}

.chat-input-card:focus-within {
  border-color: #d1d5db;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07);
}

/* File Preview Area */
.file-preview-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: var(--space-md) var(--space-lg) 0;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-hover, rgba(0, 0, 0, 0.04));
  border-radius: 12px;
  max-width: 240px;
  position: relative;
  animation: fileCardIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fileCardIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.file-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
  color: #fff;
}

.file-icon--document {
  background: linear-gradient(135deg, #4285f4, #3367d6);
}

.file-icon--video {
  background: linear-gradient(135deg, #ea4335, #c5221f);
}

.file-icon--audio {
  background: linear-gradient(135deg, #fbbc04, #f29900);
}

.file-icon--archive {
  background: linear-gradient(135deg, #34a853, #1e8e3e);
}

.file-icon--file {
  background: linear-gradient(135deg, #9aa0a6, #6e7479);
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 0.6875rem;
  color: var(--color-text-secondary);
}

.file-remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-text-secondary, #6b7280);
  color: #fff;
  border: 2px solid var(--input-bg, #fff);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
}

.file-card:hover .file-remove-btn {
  opacity: 1;
  transform: scale(1);
}

.file-remove-btn:hover {
  background: #ef4444;
}

.input-area {
  padding: var(--space-md) var(--space-lg);
}

.text-input {
  width: 100%;
  font-size: 1rem;
  color: var(--color-text-primary);
  line-height: 1.5;
}

.text-input::placeholder {
  color: var(--color-text-placeholder);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border-light);
  padding: var(--space-sm);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--input-btn-bg);
}

/* 思考模式按钮 */
.thinking-btn {
  position: relative;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
}

.thinking-brain-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
}

.thinking-btn:hover {
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.1);
  transform: translateY(-1px) scale(1.08);
  box-shadow: 0 3px 10px rgba(139, 92, 246, 0.15);
}

.thinking-btn:hover .thinking-brain-icon {
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 3px rgba(139, 92, 246, 0.4));
}

.thinking-btn:active {
  transform: scale(0.95);
}

/* 激活态 */
.thinking-btn--active {
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.1);
  animation: thinkingPulse 2.5s ease-in-out infinite;
}

.thinking-btn--active .thinking-brain-icon {
  animation: brainGlow 2.5s ease-in-out infinite;
}

.thinking-btn--active:hover {
  background: rgba(139, 92, 246, 0.18);
  transform: translateY(-1px) scale(1.08);
  animation: none;
  box-shadow: 0 3px 12px rgba(139, 92, 246, 0.25);
}

.thinking-btn--active:hover .thinking-brain-icon {
  animation: none;
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 5px rgba(139, 92, 246, 0.5));
}

@keyframes thinkingPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
  }
}

@keyframes brainGlow {
  0%, 100% {
    filter: drop-shadow(0 0 1px rgba(139, 92, 246, 0.2));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.45));
    transform: scale(1.06);
  }
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--input-btn-bg);
  color: var(--sidebar-text);
  transition: background var(--transition-fast);
}

.send-btn:hover {
  background: var(--input-btn-bg-hover);
}
</style>
