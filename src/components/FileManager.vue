<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  FolderPlus,
  Upload,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Image,
  FileCode,
  File,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  Eye,
} from 'lucide-vue-next'

// Types
interface FileItem {
  id: string
  name: string
  type: 'file'
  fileType?: 'image' | 'document' | 'code' | 'other'
}

interface FolderItem {
  id: string
  name: string
  type: 'folder'
  children: (FileItem | FolderItem)[]
  isExpanded?: boolean
}

interface SelectedFile extends FileItem {
  folderName: string
}

// Initial data
const folders = ref<FolderItem[]>([
  {
    id: '1',
    name: '项目文档',
    type: 'folder',
    isExpanded: false,
    children: [
      { id: '1-1', name: '需求说明.docx', type: 'file', fileType: 'document' },
      { id: '1-2', name: '设计稿.png', type: 'file', fileType: 'image' },
      { id: '1-3', name: '接口文档.md', type: 'file', fileType: 'code' },
    ],
  },
  {
    id: '2',
    name: '图片素材',
    type: 'folder',
    isExpanded: false,
    children: [
      { id: '2-1', name: 'logo.png', type: 'file', fileType: 'image' },
      { id: '2-2', name: 'banner.jpg', type: 'file', fileType: 'image' },
    ],
  },
  {
    id: '3',
    name: '代码文件',
    type: 'folder',
    isExpanded: false,
    children: [
      { id: '3-1', name: 'index.tsx', type: 'file', fileType: 'code' },
      { id: '3-2', name: 'styles.css', type: 'file', fileType: 'code' },
      { id: '3-3', name: 'utils.ts', type: 'file', fileType: 'code' },
    ],
  },
  {
    id: '4',
    name: '其他资料',
    type: 'folder',
    isExpanded: false,
    children: [],
  },
])

const selectedFile = ref<SelectedFile | null>(null)
const selectedFolderId = ref<string | null>(null)
const isCreateDialogOpen = ref(false)
const newFolderName = ref('')

// Context menu (shared for folders and files)
const activeMenuId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function toggleMenu(id: string) {
  activeMenuId.value = activeMenuId.value === id ? null : id
}

function closeMenu() {
  activeMenuId.value = null
}

function getFileTypeFromName(filename: string): 'image' | 'document' | 'code' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return 'image'
  if (['doc', 'docx', 'pdf', 'txt', 'md'].includes(ext || '')) return 'document'
  if (['js', 'ts', 'tsx', 'jsx', 'css', 'html', 'json', 'py'].includes(ext || '')) return 'code'
  return 'other'
}

function toggleFolder(folder: FolderItem) {
  folder.isExpanded = !folder.isExpanded
}

function selectFolder(folder: FolderItem) {
  selectedFolderId.value = folder.id
  selectedFile.value = null
  folder.isExpanded = true
}

function selectFile(file: FileItem, folderName: string) {
  selectedFile.value = { ...file, folderName }
  selectedFolderId.value = null
}

function createFolder() {
  if (newFolderName.value.trim()) {
    folders.value.push({
      id: Date.now().toString(),
      name: newFolderName.value.trim(),
      type: 'folder',
      isExpanded: false,
      children: [],
    })
    newFolderName.value = ''
    isCreateDialogOpen.value = false
  }
}

function deleteFolder(id: string) {
  if (selectedFolderId.value === id) {
    selectedFolderId.value = null
  }
  folders.value = folders.value.filter((f) => f.id !== id)
  closeMenu()
}

function startRename(item: FolderItem | FileItem) {
  renamingId.value = item.id
  renameValue.value = item.name
  closeMenu()
}

function confirmRename(item: FolderItem | FileItem) {
  if (renameValue.value.trim()) {
    item.name = renameValue.value.trim()
    // 如果正在预览该文件，同步更新名称
    if (selectedFile.value && selectedFile.value.id === item.id) {
      selectedFile.value.name = item.name
    }
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function deleteFile(fileId: string, folder: FolderItem) {
  folder.children = folder.children.filter((c) => c.id !== fileId)
  if (selectedFile.value?.id === fileId) {
    selectedFile.value = null
  }
  closeMenu()
}

function handleUploadFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files
    if (files && files.length > 0 && folders.value.length > 0) {
      const newFiles: FileItem[] = Array.from(files).map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        name: file.name,
        type: 'file' as const,
        fileType: getFileTypeFromName(file.name),
      }))
      // 优先放到选中的文件夹，否则放到第一个文件夹
      const targetFolder = selectedFolderId.value
        ? folders.value.find((f) => f.id === selectedFolderId.value)
        : folders.value[0]
      if (targetFolder) {
        targetFolder.children.push(...newFiles)
        targetFolder.isExpanded = true
      }
    }
  }
  input.click()
}

function getFileTypeLabel(fileType?: string): string {
  switch (fileType) {
    case 'image': return '图片文件'
    case 'document': return '文档文件'
    case 'code': return '代码文件'
    default: return '其他文件'
  }
}

function getFileTypeDescription(fileType?: string): string {
  switch (fileType) {
    case 'image': return '支持预览 PNG、JPG、GIF、SVG 等图片格式'
    case 'document': return '支持预览 PDF、Word 等文档格式'
    case 'code': return '支持语法高亮显示代码内容'
    default: return '暂不支持预览此文件类型'
  }
}
</script>

<template>
  <div id="file-manager" class="file-manager">
    <!-- Left: File Tree -->
    <div id="file-tree-panel" class="file-tree-panel">
      <!-- Header -->
      <div id="file-tree-header" class="file-tree-header">
        <h2 class="file-tree-title">我的内容</h2>
        <div id="file-tree-actions" class="file-tree-actions">
          <button class="fm-btn" @click="isCreateDialogOpen = true">
            <FolderPlus :size="14" />
            <span>新建文件夹</span>
          </button>
          <button class="fm-btn" @click="handleUploadFile">
            <Upload :size="14" />
            <span>上传文件</span>
          </button>
        </div>
      </div>

      <!-- File Tree -->
      <div id="file-tree-content" class="file-tree-content">
        <div v-if="folders.length === 0" id="file-tree-empty" class="empty-state">
          <Folder :size="40" class="empty-icon" />
          <p class="empty-text">暂无文件夹</p>
          <p class="empty-hint">点击上方按钮创建</p>
        </div>
        <div v-else id="tree-list" class="tree-list">
          <div v-for="folder in folders" :key="folder.id" :id="'tree-node-' + folder.id" class="tree-node">
            <!-- Folder Header -->
            <div :id="'folder-row-' + folder.id" class="folder-row" :class="{ 'folder-row-active': selectedFolderId === folder.id }">
              <button class="folder-toggle" @click="toggleFolder(folder)">
                <ChevronDown v-if="folder.isExpanded" :size="16" class="chevron-icon" />
                <ChevronRight v-else :size="16" class="chevron-icon" />
                <Folder :size="16" :class="['folder-icon', { expanded: folder.isExpanded }]" />
              </button>

              <!-- Renaming -->
              <template v-if="renamingId === folder.id">
                <div :id="'folder-rename-' + folder.id" class="rename-row">
                  <input
                    v-model="renameValue"
                    class="rename-input"
                    @keydown.enter="confirmRename(folder)"
                    @keydown.escape="cancelRename"
                    autofocus
                  />
                  <button class="rename-action" @click="confirmRename(folder)">
                    <ChevronRight :size="12" />
                  </button>
                  <button class="rename-action" @click="cancelRename">
                    <X :size="12" />
                  </button>
                </div>
              </template>

              <!-- Normal display -->
              <template v-else>
                <span class="folder-name" @click="selectFolder(folder)">{{ folder.name }}</span>
                <span class="folder-count">{{ folder.children.length }}</span>
                <div :id="'folder-menu-wrapper-' + folder.id" class="folder-menu-wrapper">
                  <button class="folder-menu-btn" @click.stop="toggleMenu(folder.id)">
                    <MoreHorizontal :size="16" />
                  </button>
                  <!-- Dropdown -->
                  <div v-if="activeMenuId === folder.id" :id="'folder-dropdown-' + folder.id" class="dropdown-menu" @click.stop>
                    <button class="dropdown-item" @click="startRename(folder)">
                      <Pencil :size="14" />
                      <span>重命名</span>
                    </button>
                    <button class="dropdown-item danger" @click="deleteFolder(folder.id)">
                      <Trash2 :size="14" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <!-- Folder Contents -->
            <div v-if="folder.isExpanded" :id="'folder-children-' + folder.id" class="folder-children">
              <div v-if="folder.children.length === 0" :id="'folder-empty-' + folder.id" class="children-empty">空</div>
              <div
                v-for="item in folder.children"
                :key="item.id"
                :id="'file-row-' + item.id"
                class="file-row"
                :class="{ active: selectedFile?.id === item.id }"
                @click="item.type === 'file' && selectFile(item as FileItem, folder.name)"
              >
                <component
                  :is="(item as FileItem).fileType === 'image' ? Image :
                       (item as FileItem).fileType === 'document' ? FileText :
                       (item as FileItem).fileType === 'code' ? FileCode : File"
                  :size="16"
                  :class="['file-type-icon',
                    (item as FileItem).fileType === 'image' ? 'icon-green' :
                    (item as FileItem).fileType === 'document' ? 'icon-blue' :
                    (item as FileItem).fileType === 'code' ? 'icon-purple' : 'icon-gray']"
                />

                <!-- File renaming -->
                <template v-if="renamingId === item.id">
                  <div :id="'file-rename-' + item.id" class="rename-row" @click.stop>
                    <input
                      v-model="renameValue"
                      class="rename-input"
                      @keydown.enter="confirmRename(item)"
                      @keydown.escape="cancelRename"
                      autofocus
                    />
                    <button class="rename-action" @click="confirmRename(item)">
                      <ChevronRight :size="12" />
                    </button>
                    <button class="rename-action" @click="cancelRename">
                      <X :size="12" />
                    </button>
                  </div>
                </template>

                <!-- File normal display -->
                <template v-else>
                  <span class="file-name">{{ item.name }}</span>
                  <div :id="'file-menu-wrapper-' + item.id" class="folder-menu-wrapper" @click.stop>
                    <button class="folder-menu-btn" @click.stop="toggleMenu(item.id)">
                      <MoreHorizontal :size="16" />
                    </button>
                    <div v-if="activeMenuId === item.id" :id="'file-dropdown-' + item.id" class="dropdown-menu">
                      <button class="dropdown-item" @click="startRename(item)">
                        <Pencil :size="14" />
                        <span>重命名</span>
                      </button>
                      <button class="dropdown-item danger" @click="deleteFile(item.id, folder)">
                        <Trash2 :size="14" />
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: File Preview -->
    <div id="file-preview-panel" class="file-preview-panel">
      <template v-if="selectedFile">
        <!-- Preview Header -->
        <div id="preview-header" class="preview-header">
          <div id="preview-header-info">
            <h3 class="preview-file-name">{{ selectedFile.name }}</h3>
            <p class="preview-file-location">位置: {{ selectedFile.folderName }}</p>
          </div>
          <div id="preview-actions" class="preview-actions">
            <button class="fm-btn">
              <Eye :size="16" />
              <span>预览</span>
            </button>
          </div>
        </div>

        <!-- Preview Content -->
        <div id="preview-content" class="preview-content">
          <div id="preview-content-inner" class="preview-content-inner">
            <component
              :is="selectedFile.fileType === 'image' ? Image :
                   selectedFile.fileType === 'document' ? FileText :
                   selectedFile.fileType === 'code' ? FileCode : File"
              :size="64"
              :class="['preview-file-icon',
                selectedFile.fileType === 'image' ? 'icon-green' :
                selectedFile.fileType === 'document' ? 'icon-blue' :
                selectedFile.fileType === 'code' ? 'icon-purple' : 'icon-gray']"
            />
            <p class="preview-filename-large">{{ selectedFile.name }}</p>
            <p class="preview-filetype-label">{{ getFileTypeLabel(selectedFile.fileType) }}</p>
            <div id="preview-info-card" class="preview-info-card">
              <p class="preview-info-text">{{ getFileTypeDescription(selectedFile.fileType) }}</p>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div id="preview-empty" class="preview-empty">
          <div id="preview-empty-icon-wrapper" class="preview-empty-icon-wrapper">
            <Eye :size="48" class="preview-empty-icon" />
          </div>
          <p class="preview-empty-title">选择文件以预览</p>
          <p class="preview-empty-hint">从左侧目录树中选择一个文件</p>
        </div>
      </template>
    </div>

    <!-- Create Folder Dialog -->
    <Teleport to="body">
      <div v-if="isCreateDialogOpen" id="dialog-overlay" class="dialog-overlay" @click.self="isCreateDialogOpen = false">
        <div id="dialog-content" class="dialog-content">
          <div id="dialog-header" class="dialog-header">
            <h3 class="dialog-title">新建文件夹</h3>
            <p class="dialog-description">请输入新文件夹的名称</p>
          </div>
          <div id="dialog-body" class="dialog-body">
            <input
              v-model="newFolderName"
              class="dialog-input"
              placeholder="请输入文件夹名称"
              @keydown.enter="createFolder"
              autofocus
            />
          </div>
          <div id="dialog-footer" class="dialog-footer">
            <button class="fm-btn secondary" @click="isCreateDialogOpen = false">取消</button>
            <button class="fm-btn primary" @click="createFolder">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.file-manager {
  display: flex;
  height: 100%;
  width: 100%;
}

/* ===== Left Panel ===== */
.file-tree-panel {
  display: flex;
  flex-direction: column;
  width: 33.333%;
  border-right: 1px solid var(--color-border);
}

.file-tree-header {
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.file-tree-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.file-tree-actions {
  display: flex;
  gap: 8px;
}

.file-tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* ===== Buttons ===== */
.fm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.fm-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-text-muted);
}

.fm-btn.primary {
  background: var(--color-accent-blue);
  color: #fff;
  border-color: var(--color-accent-blue);
}

.fm-btn.primary:hover {
  background: var(--color-accent-blue-hover);
}

.fm-btn.secondary {
  background: transparent;
}

/* ===== Empty state ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.5;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ===== Tree ===== */
.tree-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tree-node {
  user-select: none;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: var(--radius-lg);
  transition: background var(--transition-fast);
}

.folder-row:hover {
  background: var(--color-hover);
}

.folder-row-active {
  background: rgba(59, 130, 246, 0.08);
}

.folder-row-active:hover {
  background: rgba(59, 130, 246, 0.12);
}

.folder-row:hover .folder-menu-btn,
.folder-row-active .folder-menu-btn {
  opacity: 1;
}

.folder-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chevron-icon {
  color: var(--color-text-muted);
}

.folder-icon {
  color: #facc15;
  transition: color var(--transition-fast);
}

.folder-icon.expanded {
  color: #eab308;
}

.folder-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Folder Menu */
.folder-menu-wrapper {
  position: relative;
  flex-shrink: 0;
}

.folder-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: opacity var(--transition-fast), background var(--transition-fast);
  color: var(--color-text-muted);
}

.folder-menu-btn:hover {
  background: var(--color-hover-strong);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  min-width: 120px;
  padding: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: dropdown-in 0.15s ease;
}

@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--color-hover);
}

.dropdown-item.danger {
  color: #ef4444;
}

.dropdown-item.danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

/* Rename */
.rename-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.rename-input {
  flex: 1;
  height: 24px;
  padding: 0 6px;
  font-size: 0.8125rem;
  border: 1px solid var(--color-accent-blue);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-primary);
  outline: none;
}

.rename-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: background var(--transition-fast);
}

.rename-action:hover {
  background: var(--color-hover);
}

/* Folder Children */
.folder-children {
  margin-left: 16px;
  padding-left: 8px;
  border-left: 1px solid var(--color-border-light);
}

.children-empty {
  padding: 8px 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.file-row:hover {
  background: var(--color-hover);
}

.file-row:hover .folder-menu-btn {
  opacity: 1;
}

.file-row.active {
  background: rgba(59, 130, 246, 0.08);
}

.file-row.active .folder-menu-btn {
  opacity: 1;
}

.file-type-icon { flex-shrink: 0; }
.icon-green { color: #22c55e; }
.icon-blue { color: #3b82f6; }
.icon-purple { color: #a855f7; }
.icon-gray { color: #9ca3af; }

.file-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Right Panel ===== */
.file-preview-panel {
  display: flex;
  flex-direction: column;
  width: 66.667%;
  background: #f9fafb;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.preview-file-name {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.preview-file-location {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.preview-content-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.preview-file-icon {
  margin-bottom: 16px;
}

.preview-filename-large {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.preview-filetype-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.preview-info-card {
  margin-top: 24px;
  padding: 24px;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.preview-info-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Empty preview */
.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.preview-empty-icon-wrapper {
  padding: 24px;
  background: var(--color-border-light);
  border-radius: var(--radius-full);
  margin-bottom: 16px;
}

.preview-empty-icon {
  color: var(--color-text-muted);
}

.preview-empty-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.preview-empty-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ===== Dialog ===== */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  animation: overlay-in 0.2s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog-content {
  width: 100%;
  max-width: 420px;
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: dialog-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes dialog-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.dialog-header {
  margin-bottom: 16px;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.dialog-body {
  padding: 8px 0;
}

.dialog-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.dialog-input:focus {
  border-color: var(--color-accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-input::placeholder {
  color: var(--color-text-placeholder);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
