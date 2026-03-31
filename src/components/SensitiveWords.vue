<script setup lang="ts">
import { ref } from 'vue'
import {
  ShieldAlert,
  Plus,
  FolderPlus,
  Trash2,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-vue-next'
import { onMounted } from 'vue'
import { API_BASE_URL } from '@/config'

// Types
interface SensitiveWord {
  id?: string
  word: string
  match_strategy: string
  replace_strategy: string
  created_at: string
}

const words = ref<SensitiveWord[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedWord = ref<SensitiveWord | null>(null)
const isAddDialogOpen = ref(false)
const newWord = ref({ 
  word: '',
  match_strategy: 'exact',
  replace_strategy: 'mask'
})

async function fetchSensitiveWords() {
  isLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensitive/list`)
    if (response.ok) {
      words.value = await response.json()
    } else {
      console.error('获取敏感词列表失败')
    }
  } catch (error) {
    console.error('网络请求异常:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchSensitiveWords()
})

function selectWord(word: SensitiveWord) {
  selectedWord.value = word
}

function deleteWord(wordStr: string) {
  // 暂时保留前端删除逻辑，或后续对接删除接口
  words.value = words.value.filter(w => w.word !== wordStr)
  if (selectedWord.value?.word === wordStr) {
    selectedWord.value = null
  }
}

async function addWord() {
  if (!newWord.value.word.trim()) return
  try {
    const response = await fetch(`${API_BASE_URL}/api/sensitive/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: newWord.value.word,
        match_strategy: newWord.value.match_strategy,
        replace_strategy: newWord.value.replace_strategy
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        await fetchSensitiveWords()
        newWord.value = { 
          word: '',
          match_strategy: 'exact',
          replace_strategy: 'mask'
        }
        isAddDialogOpen.value = false
      } else {
        alert(data.message || '添加失败')
      }
    } else {
      alert('后端服务异常，添加失败')
    }
  } catch (error) {
    console.error('添加敏感词异常:', error)
    alert('网络请求失败')
  }
}

function handleSave() {
  if (!selectedWord.value) return
  alert(`敏感词 「${selectedWord.value.word}」 的设置已保存`)
}



</script>

<template>
  <div id="sensitive-words-manager" class="file-manager">
    <!-- Left Panel: Word List -->
    <div id="word-tree-panel" class="file-tree-panel">
      <!-- Header -->
      <div id="word-tree-header" class="file-tree-header">
        <h2 class="file-tree-title">敏感词设置</h2>
        <div id="word-tree-actions" class="file-tree-actions">
          <button class="fm-btn" @click="isAddDialogOpen = true">
            <FolderPlus :size="14" />
            <span>新建敏感词</span>
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <Search :size="14" class="search-icon" />
          <input v-model="searchQuery" placeholder="搜索敏感词..." class="search-input" />
        </div>
      </div>

      <!-- Word List -->
      <div id="word-tree-content" class="file-tree-content">
        <div v-if="isLoading" class="loading-state">
          <Loader2 :size="24" class="loading-spinner" />
          <p>加载中...</p>
        </div>
        <div v-else-if="words.length === 0" class="empty-state">
          <ShieldAlert :size="40" class="empty-icon" />
          <p class="empty-text">暂无敏感词</p>
          <p class="empty-hint">点击上方按钮添加</p>
        </div>
        <div v-else class="tree-list">
          <div
            v-for="word in words"
            :key="word.word"
            class="file-row"
            :class="{ active: selectedWord?.word === word.word }"
            @click="selectWord(word)"
          >
            <ShieldAlert :size="16" class="file-type-icon" />
            <span class="file-name">{{ word.word }}</span>
            <button class="delete-btn" @click.stop="deleteWord(word.word)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Panel: Word Details -->
    <div id="word-detail-panel" class="file-preview-panel">
      <template v-if="selectedWord">
        <div class="preview-header">
          <div id="preview-header-info">
            <h3 class="preview-file-name">{{ selectedWord.word }}</h3>
            <p class="preview-file-location">详细设置</p>
          </div>
        </div>

        <div class="preview-content detail-view">
          <div class="detail-card">
            <div class="detail-item">
              <label>敏感词</label>
              <span>{{ selectedWord.word }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间</label>
              <span>{{ selectedWord.created_at }}</span>
            </div>
            <div class="detail-item full-width">
              <label>匹配策略</label>
              <input v-model="selectedWord.match_strategy" class="dialog-input" placeholder="请输入匹配逻辑" />
            </div>
            <div class="detail-item full-width">
              <label>替换策略</label>
              <textarea v-model="selectedWord.replace_strategy" class="dialog-input task-area" placeholder="请输入替换逻辑"></textarea>
            </div>
            <!-- Save Button Inside Card -->
            <div class="detail-item full-width save-container">
              <button class="fm-btn primary large full-width" @click="handleSave">保存配置</button>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="preview-empty">
          <div class="preview-empty-icon-wrapper">
            <ShieldAlert :size="48" class="preview-empty-icon" />
          </div>
          <p class="preview-empty-title">查看敏感词详情</p>
          <p class="preview-empty-hint">在左侧列表中选择一个敏感词以查看其详细属性和过滤策略</p>
        </div>
      </template>
    </div>

    <!-- Add Dialog -->
    <Teleport to="body">
      <div v-if="isAddDialogOpen" class="dialog-overlay" @click.self="isAddDialogOpen = false">
        <div class="dialog-content">
          <div class="dialog-header">
            <h3 class="dialog-title">增加敏感词</h3>
            <p class="dialog-description">配置新的敏感词过滤规则</p>
          </div>
          <div class="dialog-body grid-form">
            <div class="form-item">
              <label>词条内容</label>
              <input v-model="newWord.word" class="dialog-input" placeholder="请输入敏感词内容" autofocus />
            </div>
            <div class="form-item">
              <label>匹配策略</label>
              <input v-model="newWord.match_strategy" class="dialog-input" placeholder="请输入匹配逻辑（如：exact, regex等）" />
            </div>
            <div class="form-item">
              <label>替换策略</label>
              <textarea v-model="newWord.replace_strategy" class="dialog-input task-area" placeholder="请输入替换后的内容"></textarea>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="fm-btn secondary" @click="isAddDialogOpen = false">取消</button>
            <button class="fm-btn primary" @click="addWord">添加</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import "./FileManager.css";

.search-container {
  padding: 0 16px 12px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-hover);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.search-input-wrapper:focus-within {
  border-color: var(--color-accent-blue);
  background: var(--color-bg);
}

.search-icon {
  color: var(--color-text-muted);
}

.search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  width: 100%;
}

.level-high { color: #ef4444 !important; }
.level-medium { color: #f59e0b !important; }
.level-low { color: #3b82f6 !important; }

.badge-high { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
.badge-medium { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
.badge-low { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }

.detail-view {
  padding: 24px;
}

.detail-card {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  background: var(--color-bg);
  padding: 32px;
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  max-width: 800px;
  margin: 0 auto;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-item label {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.detail-item span {
  font-size: 1rem;
  color: var(--color-text-primary);
}

.level-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.policy-info {
  padding: 12px 16px;
  background: var(--color-hover);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.policy-info.replacement {
  background: rgba(59, 130, 246, 0.05);
  border: 1px dashed var(--color-accent-blue);
  color: var(--color-accent-blue);
  font-family: monospace;
}

.task-area {
  min-height: 120px;
  resize: vertical;
  line-height: 1.5;
  padding: 10px 14px;
}

.save-container {
  margin-top: 12px;
}

.fm-btn.large {
  padding: 10px 40px;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: var(--radius-lg);
}

.fm-btn.full-width {
  width: 100%;
  justify-content: center;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  color: var(--color-text-muted);
  padding: 4px;
}

.file-row:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #ef4444;
}

.grid-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 12px;
  color: var(--color-text-muted);
}

.loading-spinner {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
