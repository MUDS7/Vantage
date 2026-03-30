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

<style scoped src="./ChatInput.css"></style>

<!-- 文件夹下拉选择器样式（全局，因为是 Teleport 到 body 的） -->
<style src="./ChatInput_1.css"></style>
