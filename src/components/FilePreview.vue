<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { FileText, AlertCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  file: File | null
  fileName: string
}>()

const loading = ref(false)
const error = ref<string | null>(null)

// Preview data
const imageUrl = ref<string | null>(null)
const pdfUrl = ref<string | null>(null)
const htmlContent = ref<string | null>(null)
const textContent = ref<string | null>(null)
const tableData = ref<{ headers: string[]; rows: string[][] } | null>(null)

// Column resize
const columnWidths = ref<number[]>([])
const tableRef = ref<HTMLTableElement | null>(null)
const tableWidth = computed(() => {
  if (columnWidths.value.length === 0) return 'auto'
  return columnWidths.value.reduce((sum, w) => sum + w, 0) + 'px'
})
let resizing = false
let resizeColIndex = -1
let resizeStartX = 0
let resizeStartWidth = 0

function initColumnWidths() {
  if (!tableData.value || tableData.value.headers.length === 0) return
  // 基于内容采样估算初始列宽：表头字符数 * 16 + padding，最小 80，最大 400
  const widths = tableData.value.headers.map((h, i) => {
    // 采样前 10 行数据找到该列最长内容
    let maxLen = (h || `列 ${i + 1}`).length
    const sampleRows = tableData.value!.rows.slice(0, 10)
    for (const row of sampleRows) {
      const cellLen = (row[i] || '').length
      if (cellLen > maxLen) maxLen = cellLen
    }
    // 根据内容长度估算宽度，中文按2倍计，但限定范围
    const estimated = Math.min(Math.max(maxLen * 14, 80), 400)
    return estimated
  })
  columnWidths.value = widths
}

function onResizeStart(event: MouseEvent, colIndex: number) {
  event.preventDefault()
  event.stopPropagation()
  resizing = true
  resizeColIndex = colIndex
  resizeStartX = event.clientX
  resizeStartWidth = columnWidths.value[colIndex] ?? 120

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(event: MouseEvent) {
  if (!resizing) return
  const diff = event.clientX - resizeStartX
  const newWidth = Math.max(50, resizeStartWidth + diff)
  // 使用 splice 确保触发 Vue 响应式更新
  columnWidths.value.splice(resizeColIndex, 1, newWidth)
}

function onResizeEnd() {
  resizing = false
  resizeColIndex = -1
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Track object URLs for cleanup
let currentObjectUrl: string | null = null

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function getPreviewType(filename: string): string {
  const ext = getFileExtension(filename)
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'img'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['xls', 'xlsx'].includes(ext)) return 'excel'
  if (ext === 'csv') return 'csv'
  if (ext === 'md') return 'markdown'
  if (ext === 'txt') return 'text'
  return 'unsupported'
}

function cleanup() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  imageUrl.value = null
  pdfUrl.value = null
  htmlContent.value = null
  textContent.value = null
  tableData.value = null
  columnWidths.value = []
  error.value = null
}

async function loadPreview(file: File | null, fileName: string) {
  cleanup()
  if (!file) return

  loading.value = true
  error.value = null

  try {
    const type = getPreviewType(fileName)

    switch (type) {
      case 'image': {
        const url = URL.createObjectURL(file)
        currentObjectUrl = url
        imageUrl.value = url
        break
      }

      case 'pdf': {
        const url = URL.createObjectURL(file)
        currentObjectUrl = url
        pdfUrl.value = url
        break
      }

      case 'word': {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.default.convertToHtml({ arrayBuffer })
        htmlContent.value = result.value
        break
      }

      case 'excel': {
        const XLSX = await import('xlsx')
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          tableData.value = { headers: [], rows: [] }
          break
        }
        const firstSheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet!, { header: 1 })
        if (jsonData.length > 0) {
          // 找出所有行中的最大列数，防止空表头列被截断
          let maxCols = 0
          for (const row of jsonData) {
            if ((row as string[]).length > maxCols) maxCols = (row as string[]).length
          }
          // 补齐 headers 到 maxCols
          const rawHeaders = jsonData[0] as string[]
          const headers: string[] = []
          for (let i = 0; i < maxCols; i++) {
            headers.push(String(rawHeaders[i] ?? ''))
          }
          // 补齐每行数据到 maxCols
          const rows = jsonData.slice(1).map((row) => {
            const cells: string[] = []
            for (let i = 0; i < maxCols; i++) {
              cells.push(String((row as string[])[i] ?? ''))
            }
            return cells
          })
          tableData.value = { headers, rows }
        } else {
          tableData.value = { headers: [], rows: [] }
        }
        break
      }

      case 'csv': {
        const text = await file.text()
        const lines = text.split('\n').filter((l) => l.trim())
        const firstLine = lines[0]
        if (firstLine) {
          const headers = firstLine.split(',').map((h) => h.trim())
          const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()))
          tableData.value = { headers, rows }
        } else {
          tableData.value = { headers: [], rows: [] }
        }
        break
      }

      case 'markdown': {
        const { marked } = await import('marked')
        const text = await file.text()
        const result = await marked(text)
        htmlContent.value = result
        break
      }

      case 'text': {
        textContent.value = await file.text()
        break
      }

      default:
        error.value = '暂不支持预览此文件格式'
    }
  } catch (e: any) {
    console.error('Preview error:', e)
    error.value = `文件预览失败: ${e.message || '未知错误'}`
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.file, props.fileName],
  async ([file, name]) => {
    await loadPreview(file as File | null, name as string)
    await nextTick()
    initColumnWidths()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cleanup()
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<template>
  <div class="file-preview">
    <!-- Loading state -->
    <div v-if="loading" class="preview-state">
      <div class="loading-spinner">
        <Loader2 :size="36" class="spin-icon" />
      </div>
      <p class="state-text">正在加载预览...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="preview-state">
      <div class="error-icon-wrapper">
        <AlertCircle :size="36" class="error-icon" />
      </div>
      <p class="state-text error-text">{{ error }}</p>
    </div>

    <!-- Image preview -->
    <div v-else-if="imageUrl" class="preview-image-container">
      <img :src="imageUrl" :alt="fileName" class="preview-image" />
    </div>

    <!-- PDF preview -->
    <div v-else-if="pdfUrl" class="preview-iframe-container">
      <iframe :src="pdfUrl" class="preview-iframe" frameborder="0"></iframe>
    </div>

    <!-- HTML content (Word / Markdown) -->
    <div v-else-if="htmlContent" class="preview-html-container">
      <div class="preview-html-content" v-html="htmlContent"></div>
    </div>

    <!-- Table content (Excel / CSV) -->
    <div v-else-if="tableData" class="preview-table-container">
      <div v-if="tableData.headers.length === 0 && tableData.rows.length === 0" class="preview-state">
        <FileText :size="36" class="empty-table-icon" />
        <p class="state-text">表格为空</p>
      </div>
      <div v-else class="table-scroll-wrapper">
        <table ref="tableRef" class="preview-table" :style="{ width: tableWidth }">
          <colgroup>
            <col
              v-for="(w, i) in columnWidths"
              :key="i"
              :style="{ width: w + 'px' }"
            />
          </colgroup>
          <thead>
            <tr>
              <th v-for="(header, i) in tableData.headers" :key="i">
                <span class="th-text">{{ header || `列 ${i + 1}` }}</span>
                <div
                  class="resize-handle"
                  @mousedown.prevent="onResizeStart($event, i)"
                ></div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in tableData.rows" :key="ri">
              <td v-for="(cell, ci) in row" :key="ci">
                <div class="cell-content" :title="cell">{{ cell }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Text content -->
    <div v-else-if="textContent !== null" class="preview-text-container">
      <pre class="preview-text">{{ textContent }}</pre>
    </div>

    <!-- No content -->
    <div v-else class="preview-state">
      <FileText :size="36" class="empty-icon" />
      <p class="state-text">暂无预览内容</p>
    </div>
  </div>
</template>

<style scoped>
.file-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* States */
.preview-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
}

.state-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.error-text {
  color: #ef4444;
}

/* Loading */
.loading-spinner {
  padding: 16px;
  background: var(--color-border-light);
  border-radius: var(--radius-full);
}

.spin-icon {
  color: var(--color-accent-blue);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon-wrapper {
  padding: 16px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: var(--radius-full);
}

.error-icon {
  color: #ef4444;
}

.empty-icon,
.empty-table-icon {
  color: var(--color-text-muted);
  opacity: 0.5;
}

/* Image */
.preview-image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
  background:
    repeating-conic-gradient(rgba(128, 128, 128, 0.08) 0% 25%, transparent 0% 50%)
    50% / 20px 20px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease;
}

.preview-image:hover {
  transform: scale(1.02);
}

/* PDF / iframe */
.preview-iframe-container {
  flex: 1;
  display: flex;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* HTML (Word / Markdown) */
.preview-html-container {
  flex: 1;
  overflow: auto;
  padding: 32px;
}

.preview-html-content {
  max-width: 800px;
  margin: 0 auto;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--color-text-primary);
}

.preview-html-content :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5em 0 0.75em;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border-light);
  padding-bottom: 0.5em;
}

.preview-html-content :deep(h2) {
  font-size: 1.375rem;
  font-weight: 600;
  margin: 1.25em 0 0.5em;
  color: var(--color-text-primary);
}

.preview-html-content :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1em 0 0.5em;
  color: var(--color-text-primary);
}

.preview-html-content :deep(p) {
  margin: 0.75em 0;
}

.preview-html-content :deep(a) {
  color: var(--color-accent-blue);
  text-decoration: none;
}

.preview-html-content :deep(a:hover) {
  text-decoration: underline;
}

.preview-html-content :deep(code) {
  background: var(--color-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.preview-html-content :deep(pre) {
  background: #1e1e2e;
  color: #cdd6f4;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.6;
  margin: 1em 0;
}

.preview-html-content :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.preview-html-content :deep(blockquote) {
  border-left: 3px solid var(--color-accent-blue);
  margin: 1em 0;
  padding: 0.5em 1em;
  background: rgba(59, 130, 246, 0.04);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--color-text-secondary);
}

.preview-html-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.preview-html-content :deep(th),
.preview-html-content :deep(td) {
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  text-align: left;
}

.preview-html-content :deep(th) {
  background: var(--color-hover);
  font-weight: 600;
}

.preview-html-content :deep(ul),
.preview-html-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.preview-html-content :deep(li) {
  margin: 0.25em 0;
}

.preview-html-content :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-md);
}

.preview-html-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border-light);
  margin: 1.5em 0;
}

/* Table (Excel / CSV) */
.preview-table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-scroll-wrapper {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.preview-table {
  border-collapse: collapse;
  font-size: 0.8125rem;
  table-layout: fixed;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 0;
  background: #f0f2f5;
  border: 1px solid var(--color-border);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: left;
  overflow: hidden;
  user-select: none;
  /* sticky 自带定位上下文，resize-handle 的 absolute 可直接生效 */
}

.th-text {
  display: block;
  padding: 10px 14px;
  padding-right: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  z-index: 3;
  transition: background 0.15s ease;
}

.resize-handle:hover,
.resize-handle:active {
  background: var(--color-accent-blue);
}

.preview-table td {
  padding: 0;
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
  vertical-align: top;
  overflow: hidden;
}

.cell-content {
  padding: 8px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
}

.preview-table tbody tr:hover td {
  background: var(--color-hover);
}

.preview-table tbody tr:nth-child(even) td {
  background: rgba(0, 0, 0, 0.01);
}

.preview-table tbody tr:nth-child(even):hover td {
  background: var(--color-hover);
}

/* Text */
.preview-text-container {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.preview-text {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  padding: 20px 24px;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
}
</style>
