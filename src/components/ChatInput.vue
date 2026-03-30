<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Plus, Send, X, FileText, Image, Film, Music, Archive, File, Brain, BookOpen, FolderOpen, Folder, Check } from 'lucide-vue-next'
import { useChatStore } from '../stores/chat'
import { API_BASE_URL } from '../config'

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

// 文件夹选择相关
interface FolderOption {
  name: string
  fileCount?: number
}

const selectedFolders = ref<FolderOption[]>([])
const folderOptions = ref<FolderOption[]>([])
const showFolderDropdown = ref(false)
const folderLoading = ref(false)
const folderBtnRef = ref<HTMLButtonElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const hasFiles = computed(() => uploadedFiles.value.length > 0)
const hasFolders = computed(() => selectedFolders.value.length > 0)
const hasAttachments = computed(() => hasFiles.value || hasFolders.value)

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''

  // 收集当前已选文件
  const files = uploadedFiles.value.map((f) => f.file)

  // 收集已选文件夹名称
  const folders = selectedFolders.value.map((f) => f.name)

  // 清空文件列表并释放预览 URL
  for (const f of uploadedFiles.value) {
    if (f.previewUrl) {
      URL.revokeObjectURL(f.previewUrl)
    }
  }
  uploadedFiles.value = []
  selectedFolders.value = []

  await chatStore.sendMessage(
    text,
    files.length > 0 ? files : undefined,
    folders.length > 0 ? folders : undefined,
  )
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

// ---- 文件夹选择相关逻辑 ----
async function fetchFolderOptions() {
  folderLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/folders`)
    if (response.ok) {
      const data = await response.json()
      folderOptions.value = data.map((item: any) => ({
        name: item.name,
        fileCount: item.file_count,
      }))
    }
  } catch (error) {
    console.error('获取文件夹列表失败:', error)
  } finally {
    folderLoading.value = false
  }
}

function toggleFolderDropdown() {
  showFolderDropdown.value = !showFolderDropdown.value
  if (showFolderDropdown.value) {
    fetchFolderOptions()
    // 计算下拉框位置（基于按钮位置）
    nextTick(() => {
      if (folderBtnRef.value) {
        const rect = folderBtnRef.value.getBoundingClientRect()
        const dropdownWidth = 280
        // 居中于按钮，left 不能小于 8px
        let left = rect.left + rect.width / 2 - dropdownWidth / 2
        if (left < 8) left = 8
        if (left + dropdownWidth > window.innerWidth - 8) {
          left = window.innerWidth - 8 - dropdownWidth
        }
        dropdownStyle.value = {
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + 8}px`,
          left: `${left}px`,
          width: `${dropdownWidth}px`,
        }
      }
    })
  }
}

function isFolderSelected(folderName: string): boolean {
  return selectedFolders.value.some((f) => f.name === folderName)
}

function toggleFolderSelection(folder: FolderOption) {
  const index = selectedFolders.value.findIndex((f) => f.name === folder.name)
  if (index !== -1) {
    selectedFolders.value.splice(index, 1)
  } else {
    selectedFolders.value.push({ ...folder })
  }
}

function removeFolder(folderName: string) {
  selectedFolders.value = selectedFolders.value.filter((f) => f.name !== folderName)
}

// 点击外部关闭文件夹下拉
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.folder-select-wrapper')) {
    showFolderDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
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
      <!-- Attachments Preview Area (files + folders) -->
      <div id="file-preview-area" v-if="hasAttachments" class="file-preview-area">
        <!-- 已选文件夹卡片 -->
        <div
          v-for="folder in selectedFolders"
          :key="'folder-' + folder.name"
          class="file-card folder-card"
        >
          <div class="file-icon file-icon--folder">
            <Folder :size="20" />
          </div>
          <div class="file-info">
            <span class="file-name">{{ folder.name }}</span>
            <span class="file-size">{{ folder.fileCount !== undefined ? folder.fileCount + ' 个文件' : '文件夹' }}</span>
          </div>
          <button class="file-remove-btn" @click="removeFolder(folder.name)" aria-label="移除文件夹">
            <X :size="14" />
          </button>
        </div>
        <!-- 已上传文件卡片 -->
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
          autocomplete="off"
          class="text-input"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Toolbar -->
      <div id="toolbar" class="toolbar">
        <div class="toolbar-left">
          <button
            id="add-attachment-btn"
            class="toolbar-btn"
            aria-label="添加附件"
            data-tooltip="上传文件"
            @click="triggerFileInput"
          >
            <Plus :size="20" />
          </button>
          <button
            id="thinking-toggle-btn"
            class="toolbar-btn thinking-btn"
            :class="{ 'thinking-btn--active': chatStore.thinkingEnabled }"
            aria-label="思考模式"
            data-tooltip="思考模式"
            :title="chatStore.thinkingEnabled ? '关闭思考模式' : '开启思考模式'"
            @click="chatStore.toggleThinking()"
          >
            <Brain :size="18" class="thinking-brain-icon" />
          </button>
          <button
            id="doc-search-toggle-btn"
            class="toolbar-btn doc-search-btn"
            :class="{ 'doc-search-btn--active': chatStore.docSearchEnabled }"
            aria-label="文档检索"
            data-tooltip="文档检索"
            :title="chatStore.docSearchEnabled ? '关闭文档优先检索' : '开启文档优先检索'"
            @click="chatStore.toggleDocSearch()"
          >
            <BookOpen :size="18" class="doc-search-icon" />
          </button>
          <!-- 文件夹选择按钮 -->
          <div class="folder-select-wrapper">
            <button
              id="folder-select-btn"
              ref="folderBtnRef"
              class="toolbar-btn folder-select-btn"
              :class="{ 'folder-select-btn--active': hasFolders }"
              aria-label="选择文件夹"
              data-tooltip="选择文件夹"
              :title="hasFolders ? selectedFolders.length + ' 个文件夹已选' : '从我的内容中选择文件夹'"
              @click.stop="toggleFolderDropdown"
            >
              <FolderOpen :size="18" class="folder-select-icon" />
            </button>
          </div>
        </div>
        <button
          id="send-btn"
          class="send-btn"
          aria-label="发送"
          data-tooltip="发送"
          @click="handleSend"
        >
          <Send :size="16" />
        </button>
      </div>
    </div>
  </div>

  <!-- 文件夹下拉选择器（Teleport 到 body 避免被父容器裁切） -->
  <Teleport to="body">
    <div v-if="showFolderDropdown" id="folder-dropdown" class="folder-dropdown" :style="dropdownStyle" @click.stop>
      <div class="folder-dropdown-header">
        <span class="folder-dropdown-title">选择文件夹</span>
        <span v-if="selectedFolders.length > 0" class="folder-dropdown-count">已选 {{ selectedFolders.length }}</span>
      </div>
      <div class="folder-dropdown-list">
        <div v-if="folderLoading" class="folder-dropdown-loading">
          <span class="folder-loading-spinner"></span>
          <span>加载中...</span>
        </div>
        <div v-else-if="folderOptions.length === 0" class="folder-dropdown-empty">
          暂无文件夹
        </div>
        <button
          v-else
          v-for="folder in folderOptions"
          :key="folder.name"
          class="folder-dropdown-item"
          :class="{ 'folder-dropdown-item--selected': isFolderSelected(folder.name) }"
          @click="toggleFolderSelection(folder)"
        >
          <Folder :size="16" class="folder-dropdown-item-icon" />
          <span class="folder-dropdown-item-name">{{ folder.name }}</span>
          <span class="folder-dropdown-item-count">{{ folder.fileCount ?? 0 }} 文件</span>
          <Check v-if="isFolderSelected(folder.name)" :size="16" class="folder-dropdown-item-check" />
        </button>
      </div>
    </div>
  </Teleport>
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
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--input-btn-bg-hover);
  color: var(--color-text-primary);
  transform: scale(1.05);
}

.toolbar-btn:active {
  transform: scale(0.95);
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
  background: rgba(139, 92, 246, 0.15);
  border: 1.5px solid rgba(139, 92, 246, 0.4);
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
  animation: thinkingPulse 2.5s ease-in-out infinite;
}

.thinking-btn--active .thinking-brain-icon {
  filter: drop-shadow(0 0 3px rgba(139, 92, 246, 0.5));
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

/* 文档检索按钮 */
.doc-search-btn {
  position: relative;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
}

.doc-search-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
}

.doc-search-btn:hover {
  color: #0d9488;
  background: rgba(20, 184, 166, 0.1);
  transform: translateY(-1px) scale(1.08);
  box-shadow: 0 3px 10px rgba(20, 184, 166, 0.15);
}

.doc-search-btn:hover .doc-search-icon {
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 3px rgba(20, 184, 166, 0.4));
}

.doc-search-btn:active {
  transform: scale(0.95);
}

/* 文档检索激活态 */
.doc-search-btn--active {
  color: #0d9488;
  background: rgba(20, 184, 166, 0.15);
  border: 1.5px solid rgba(20, 184, 166, 0.4);
  box-shadow: 0 0 8px rgba(20, 184, 166, 0.2);
  animation: docSearchPulse 2.5s ease-in-out infinite;
}

.doc-search-btn--active .doc-search-icon {
  filter: drop-shadow(0 0 3px rgba(20, 184, 166, 0.5));
  animation: docSearchGlow 2.5s ease-in-out infinite;
}

.doc-search-btn--active:hover {
  background: rgba(20, 184, 166, 0.18);
  transform: translateY(-1px) scale(1.08);
  animation: none;
  box-shadow: 0 3px 12px rgba(20, 184, 166, 0.25);
}

.doc-search-btn--active:hover .doc-search-icon {
  animation: none;
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 5px rgba(20, 184, 166, 0.5));
}

@keyframes docSearchPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.1);
  }
}

@keyframes docSearchGlow {
  0%, 100% {
    filter: drop-shadow(0 0 1px rgba(20, 184, 166, 0.2));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 4px rgba(20, 184, 166, 0.45));
    transform: scale(1.06);
  }
}

/* 文件夹选择按钮 */
.folder-select-wrapper {
  position: relative;
}

.folder-select-btn {
  position: relative;
  transition: background 0.2s ease, color 0.2s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
}

.folder-select-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
}

.folder-select-btn:hover {
  color: #d97706;
  background: rgba(245, 158, 11, 0.1);
  transform: translateY(-1px) scale(1.08);
  box-shadow: 0 3px 10px rgba(245, 158, 11, 0.15);
}

.folder-select-btn:hover .folder-select-icon {
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.4));
}

.folder-select-btn:active {
  transform: scale(0.95);
}

/* 文件夹选择激活态 */
.folder-select-btn--active {
  color: #d97706;
  background: rgba(245, 158, 11, 0.15);
  border: 1.5px solid rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
  animation: folderSelectPulse 2.5s ease-in-out infinite;
}

.folder-select-btn--active .folder-select-icon {
  filter: drop-shadow(0 0 3px rgba(245, 158, 11, 0.5));
  animation: folderSelectGlow 2.5s ease-in-out infinite;
}

.folder-select-btn--active:hover {
  background: rgba(245, 158, 11, 0.18);
  transform: translateY(-1px) scale(1.08);
  animation: none;
  box-shadow: 0 3px 12px rgba(245, 158, 11, 0.25);
}

.folder-select-btn--active:hover .folder-select-icon {
  animation: none;
  transform: rotate(-8deg) scale(1.1);
  filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.5));
}

@keyframes folderSelectPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1);
  }
}

@keyframes folderSelectGlow {
  0%, 100% {
    filter: drop-shadow(0 0 1px rgba(245, 158, 11, 0.2));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.45));
    transform: scale(1.06);
  }
}

/* 文件夹卡片样式 */
.folder-card {
  border: 1px solid rgba(245, 158, 11, 0.2);
  background: rgba(245, 158, 11, 0.06);
}

.file-icon--folder {
  background: linear-gradient(135deg, #f59e0b, #d97706);
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
  transition: all var(--transition-fast);
}

.send-btn:hover {
  background: var(--input-btn-bg-hover);
  color: var(--color-text-primary);
  transform: scale(1.05);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.send-btn:active {
  transform: scale(0.95);
}

/* Tooltip implementation */
[data-tooltip] {
  position: relative;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 11px;
  line-height: 1.2;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 防止左侧第一个 Tooltip 超出屏幕 */
.toolbar-left > [data-tooltip]:first-child::after {
  left: 0;
  transform: translateX(0) translateY(5px);
}

.toolbar-left > [data-tooltip]:first-child:hover::after {
  transform: translateX(0) translateY(0);
}

[data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
</style>

<!-- 文件夹下拉选择器样式（全局，因为是 Teleport 到 body 的） -->
<style>
.folder-dropdown {
  background: var(--input-bg, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 9999;
  overflow: hidden;
  animation: folderDropdownIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes folderDropdownIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.folder-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.folder-dropdown-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.folder-dropdown-count {
  font-size: 0.6875rem;
  color: #d97706;
  background: rgba(245, 158, 11, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.folder-dropdown-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.folder-dropdown-loading,
.folder-dropdown-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #9ca3af);
}

.folder-loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(217, 119, 6, 0.2);
  border-top-color: #d97706;
  border-radius: 50%;
  animation: folderSpinAnim 0.6s linear infinite;
}

@keyframes folderSpinAnim {
  to { transform: rotate(360deg); }
}

.folder-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--color-text-primary, #1f2937);
}

.folder-dropdown-item:hover {
  background: var(--color-hover, rgba(0, 0, 0, 0.04));
}

.folder-dropdown-item--selected {
  background: rgba(245, 158, 11, 0.08);
}

.folder-dropdown-item--selected:hover {
  background: rgba(245, 158, 11, 0.12);
}

.folder-dropdown-item-icon {
  color: #d97706;
  flex-shrink: 0;
}

.folder-dropdown-item-name {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text-primary, #1f2937);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.folder-dropdown-item-count {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #9ca3af);
  flex-shrink: 0;
}

.folder-dropdown-item-check {
  color: #d97706;
  flex-shrink: 0;
}
</style>
