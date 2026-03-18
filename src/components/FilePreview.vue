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
const isDocxPreview = ref(false)
const docxContainer = ref<HTMLElement | null>(null)

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

/**
 * ======================================================================
 * OLE2 复合文档 (CFB) 解析 + Word 二进制格式文本提取
 * ======================================================================
 * .doc 文件采用 OLE2 (Compound File Binary) 格式存储，内部包含多个"流"。
 * 文本信息存储在 WordDocument 流中，通过 FIB (File Information Block)
 * 可以定位文本的精确位置、长度和编码方式。
 *
 * 如果 OLE2 解析失败，则回退到 UTF-16LE 扫描方式。
 */

// Windows-1252 代码页映射表（用于 .doc 中的 8 位编码文本）
const CP1252_MAP: Record<number, number> = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E,
  0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6,
  0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
  0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
  0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
}

/** 从 ArrayBuffer 的指定偏移读取一个 32 位小端无符号整数 */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (data[offset]! | (data[offset + 1]! << 8) |
          (data[offset + 2]! << 16) | (data[offset + 3]! << 24)) >>> 0
}

/** 从 ArrayBuffer 的指定偏移读取一个 16 位小端无符号整数 */
function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8)
}

/** 从 ArrayBuffer 的指定偏移读取一个 32 位小端有符号整数 */
function readInt32LE(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8) |
         (data[offset + 2]! << 16) | (data[offset + 3]! << 24)
}

/**
 * 解析 OLE2 复合文档，提取指定名称的流数据
 */
function parseCFB(data: Uint8Array): Map<string, Uint8Array> {
  const streams = new Map<string, Uint8Array>()

  // 验证 OLE2 签名: D0 CF 11 E0 A1 B1 1A E1
  if (data[0] !== 0xD0 || data[1] !== 0xCF || data[2] !== 0x11 || data[3] !== 0xE0) {
    throw new Error('不是有效的 OLE2 文件')
  }

  // 读取 CFB Header
  const sectorSizePow = readUint16LE(data, 30)  // Sector size power
  const sectorSize = 1 << sectorSizePow          // 通常 512
  const miniSectorSizePow = readUint16LE(data, 32)
  const miniSectorSize = 1 << miniSectorSizePow  // 通常 64
  const totalFATSectors = readUint32LE(data, 44)
  const firstDirSecID = readInt32LE(data, 48)
  const miniStreamCutoff = readUint32LE(data, 56) // 通常 0x1000
  const firstMiniFATSecID = readInt32LE(data, 60)
  // const totalMiniFATSectors = readUint32LE(data, 64) // 留作备用
  const firstDIFATSecID = readInt32LE(data, 68)
  const totalDIFATSectors = readUint32LE(data, 72)

  // 辅助函数：sector 偏移 → 文件中的字节偏移
  function sectorOffset(secId: number): number {
    return (secId + 1) * sectorSize
  }

  // 1. 构建 FAT (File Allocation Table)
  // 先从 Header 中读取 DIFAT 数组（最多 109 个条目）
  const difatEntries: number[] = []
  for (let i = 0; i < 109; i++) {
    const secId = readInt32LE(data, 76 + i * 4)
    if (secId < 0) break
    difatEntries.push(secId)
  }
  // 如果有额外的 DIFAT sectors，追加它们
  if (totalDIFATSectors > 0 && firstDIFATSecID >= 0) {
    let difatSec = firstDIFATSecID
    for (let d = 0; d < totalDIFATSectors && difatSec >= 0; d++) {
      const off = sectorOffset(difatSec)
      const entries = (sectorSize / 4) - 1
      for (let i = 0; i < entries; i++) {
        const secId = readInt32LE(data, off + i * 4)
        if (secId < 0) break
        difatEntries.push(secId)
      }
      difatSec = readInt32LE(data, off + entries * 4)
    }
  }

  // 从 DIFAT 构建完整 FAT
  const fat: number[] = []
  for (let i = 0; i < Math.min(difatEntries.length, totalFATSectors); i++) {
    const off = sectorOffset(difatEntries[i]!)
    for (let j = 0; j < sectorSize / 4; j++) {
      fat.push(readInt32LE(data, off + j * 4))
    }
  }

  // 辅助函数：沿 FAT 链读取所有扇区的数据
  function readStream(startSecId: number): Uint8Array {
    const sectors: number[] = []
    let sec = startSecId
    const maxIter = fat.length + 1 // 防止无限循环
    let iter = 0
    while (sec >= 0 && iter < maxIter) {
      sectors.push(sec)
      sec = fat[sec] ?? -1
      iter++
    }
    const totalLen = sectors.length * sectorSize
    const result = new Uint8Array(totalLen)
    for (let i = 0; i < sectors.length; i++) {
      const off = sectorOffset(sectors[i]!)
      result.set(data.subarray(off, off + sectorSize), i * sectorSize)
    }
    return result
  }

  // 2. 读取 Directory
  const dirData = readStream(firstDirSecID)

  // 3. 构建 Mini FAT
  let miniFat: number[] = []
  if (firstMiniFATSecID >= 0) {
    const miniFatData = readStream(firstMiniFATSecID)
    for (let i = 0; i < miniFatData.length / 4; i++) {
      miniFat.push(readInt32LE(miniFatData, i * 4))
    }
  }

  // 4. 获取 mini stream（根 Directory Entry 的流）
  let miniStreamData: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

  // 5. 解析 Directory Entries
  interface DirEntry {
    name: string
    type: number
    startSecId: number
    size: number
  }
  const entries: DirEntry[] = []
  const entrySize = 128
  for (let i = 0; i < dirData.length / entrySize; i++) {
    const off = i * entrySize
    const nameLen = readUint16LE(dirData, off + 64) // 名称字节长度（含 null 终结符）
    const entryType = dirData[off + 66]!
    const startSec = readInt32LE(dirData, off + 116)
    const sizeLo = readUint32LE(dirData, off + 120)

    // 解码 UTF-16LE 名称
    let name = ''
    const strLen = Math.max(0, nameLen - 2) // 不含 null 终结符
    for (let j = 0; j < strLen; j += 2) {
      name += String.fromCharCode(readUint16LE(dirData, off + j))
    }

    entries.push({ name, type: entryType, startSecId: startSec, size: sizeLo })

    // 根节点 = 第一个 Root Entry，其流数据即为 mini stream 容器
    if (i === 0 && entryType === 5 && startSec >= 0) {
      miniStreamData = readStream(startSec)
    }
  }

  // 辅助：从 mini stream 中读取小流数据
  function readMiniStream(startSecId: number, size: number): Uint8Array {
    const result = new Uint8Array(size)
    let sec = startSecId
    let written = 0
    const maxIter = miniFat.length + 1
    let iter = 0
    while (sec >= 0 && written < size && iter < maxIter) {
      const off = sec * miniSectorSize
      const chunk = Math.min(miniSectorSize, size - written)
      result.set(miniStreamData.subarray(off, off + chunk), written)
      written += chunk
      sec = miniFat[sec] ?? -1
      iter++
    }
    return result
  }

  // 6. 提取所有流
  for (const entry of entries) {
    if (entry.type !== 2) continue // 只处理 Stream 类型
    if (entry.startSecId < 0) continue

    let streamData: Uint8Array
    if (entry.size < miniStreamCutoff) {
      streamData = readMiniStream(entry.startSecId, entry.size)
    } else {
      const fullData = readStream(entry.startSecId)
      streamData = fullData.subarray(0, entry.size)
    }
    streams.set(entry.name, streamData)
  }

  return streams
}

/**
 * 从 Word Binary (.doc) 的流中提取纯文本
 * 利用 FIB 结构定位文本位置，通过 CLX/Piece Table 确定编码
 */
function extractTextFromWordStreams(streams: Map<string, Uint8Array>): string {
  const wordDoc = streams.get('WordDocument')
  if (!wordDoc) throw new Error('找不到 WordDocument 流')

  // ----- 读取 FIB (File Information Block) -----
  // FIB base: offset 0, 32 bytes
  // wIdent (0): 必须是 0xA5EC
  const wIdent = readUint16LE(wordDoc, 0)
  if (wIdent !== 0xA5EC) throw new Error('不是有效的 Word 文件')

  // FIB.fibRgLw (从 offset 32 开始)，先跳过 FibBase(32) + FibRgW 可变长
  // fibRgW 从 offset 32 开始，前 2 字节是 cslw (count of shorts)
  const csw = readUint16LE(wordDoc, 32)
  const fibRgLwOffset = 34 + csw * 2

  // fibRgLw: 前 2 字节是 cbRgLw (count of longs)
  // const cbRgLw = readUint16LE(wordDoc, fibRgLwOffset)
  const fibRgLwDataStart = fibRgLwOffset + 2

  // cbMac: 在 fibRgLw 的第 3 个 long（index 2, offset +8）
  // ccpText: 在 fibRgLw 的第 4 个 long（index 3, offset +12）
  const ccpText = readInt32LE(wordDoc, fibRgLwDataStart + 12)
  const ccpFtn  = readInt32LE(wordDoc, fibRgLwDataStart + 16)
  const ccpHdd  = readInt32LE(wordDoc, fibRgLwDataStart + 20)
  // 文档正文的总字符数
  const totalTextCp = ccpText + ccpFtn + ccpHdd

  // fibRgFcLcb: 紧跟 fibRgLw 之后
  const cbRgLw = readUint16LE(wordDoc, fibRgLwOffset)
  const fibRgFcLcbOffset = fibRgLwDataStart + cbRgLw * 4
  const cbRgFcLcb = readUint16LE(wordDoc, fibRgFcLcbOffset)
  const fibRgFcLcbDataStart = fibRgFcLcbOffset + 2

  // 在 fibRgFcLcbFib 中找 fcClx 和 lcbClx
  // fcClx 是第 67 个 8 字节对（index 66，offset 66*8 = 528），对应 fibRgFcLcb97
  let fcClx = 0, lcbClx = 0
  if (cbRgFcLcb >= 67) {
    fcClx  = readUint32LE(wordDoc, fibRgFcLcbDataStart + 66 * 8)
    lcbClx = readUint32LE(wordDoc, fibRgFcLcbDataStart + 66 * 8 + 4)
  }

  // ----- 方法 A: 通过 CLX/Piece Table 精确提取文本 -----
  if (fcClx > 0 && lcbClx > 0) {
    // CLX 存储在 Table Stream（0Table 或 1Table）
    const fWhichTblStm = (readUint16LE(wordDoc, 10) >> 9) & 1  // FibBase.flags bit 9
    const tableStreamName = fWhichTblStm ? '1Table' : '0Table'
    const tableStream = streams.get(tableStreamName)

    if (tableStream && fcClx + lcbClx <= tableStream.length) {
      try {
        return extractTextViaClx(wordDoc, tableStream, fcClx, lcbClx, totalTextCp, ccpText)
      } catch (e) {
        console.warn('CLX 解析失败，回退到方法 B:', e)
      }
    }
  }

  // ----- 方法 B: 从 FIB 直接定位文本（简化方式） -----
  // fcMin (fibRgFcLcb 第 1 个 fc，index 0) 即 fcStshfOrig
  // 通常正文文本从 wordDoc 的一个特定偏移开始
  // 我们尝试用 FIB 中的 ccpText 来确定长度，并在 WordDocument 中寻找文本

  // 使用改进的扫描方法：通过 FIB.ccpText 限制文本长度
  return extractTextFallback(wordDoc, ccpText > 0 ? ccpText : totalTextCp)
}

/**
 * 通过 CLX (Piece Table) 精确提取文本
 */
function extractTextViaClx(
  wordDoc: Uint8Array,
  tableStream: Uint8Array,
  fcClx: number,
  lcbClx: number,
  totalCp: number,
  ccpText: number
): string {
  let offset = fcClx
  const end = fcClx + lcbClx

  // 跳过 RgPrc 记录（type = 0x01）
  while (offset < end && tableStream[offset] === 0x01) {
    const cbGrpprl = readUint16LE(tableStream, offset + 1)
    offset += 3 + cbGrpprl
  }

  // 接下来应该是 Pcdt（type = 0x02）
  if (offset >= end || tableStream[offset] !== 0x02) {
    throw new Error('CLX 中找不到 Pcdt')
  }
  offset += 1
  const lcbPcd = readUint32LE(tableStream, offset)
  offset += 4

  // PlcPcd: CP 数组 (n+1 个 uint32) + PCD 数组 (n 个 8 字节)
  // 计算片段数量: lcbPcd = (n+1)*4 + n*8 => lcbPcd = 12n + 4 => n = (lcbPcd - 4) / 12
  const nPieces = (lcbPcd - 4) / 12
  if (nPieces < 1 || nPieces !== Math.floor(nPieces)) {
    throw new Error('PlcPcd 数据不合法')
  }

  const cpStart = offset
  const pcdStart = cpStart + (nPieces + 1) * 4

  const result: string[] = []
  let charCount = 0

  for (let i = 0; i < nPieces && charCount < ccpText; i++) {
    const cp1 = readUint32LE(tableStream, cpStart + i * 4)
    const cp2 = readUint32LE(tableStream, cpStart + (i + 1) * 4)
    let cpLen = cp2 - cp1

    // 限制到正文部分
    if (cp1 >= ccpText) break
    if (cp1 + cpLen > ccpText) {
      cpLen = ccpText - cp1
    }

    // PCD: 8 bytes，fc 在 offset +2 (4 bytes)
    const pcdOffset = pcdStart + i * 8
    const fcCompressed = readUint32LE(tableStream, pcdOffset + 2)

    // fc 的 bit 30 表示文本是否为"压缩"（1 字节编码）
    const fCompressed = (fcCompressed >> 30) & 1
    const fc = fcCompressed & 0x3FFFFFFF

    let text = ''
    if (fCompressed) {
      // 8-bit 编码 (CP1252)，fc 是字节偏移 / 2
      const byteOffset = fc
      for (let j = 0; j < cpLen; j++) {
        const idx = byteOffset + j
        if (idx >= wordDoc.length) break
        const b = wordDoc[idx]!
        if (b >= 0x80 && b <= 0x9F && CP1252_MAP[b] !== undefined) {
          text += String.fromCharCode(CP1252_MAP[b]!)
        } else {
          text += String.fromCharCode(b)
        }
      }
    } else {
      // 16-bit Unicode (UTF-16LE)
      const byteOffset = fc
      for (let j = 0; j < cpLen; j++) {
        const idx = byteOffset + j * 2
        if (idx + 1 >= wordDoc.length) break
        text += String.fromCharCode(readUint16LE(wordDoc, idx))
      }
    }

    result.push(text)
    charCount += cpLen
  }

  // 合并并清理特殊字符
  let fullText = result.join('')
  // Word 使用 \r (0x0D) 作为段落/行结束标记，替换为 \n
  fullText = fullText.replace(/\r/g, '\n')
  // 清理 Word 特殊字段字符和不可见控制字符
  fullText = fullText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x07]/g, '')
  // 清理多余空行
  fullText = fullText.replace(/\n{3,}/g, '\n\n').trim()

  return fullText
}

/**
 * 回退方法：改进的扫描式提取（当 CLX 解析失败时使用）
 * 比原始方法更智能：利用 ccpText 限制输出长度，并优先提取连续文本片段
 */
function extractTextFallback(wordDoc: Uint8Array, expectedLen: number): string {
  // 尝试从文件后半部分的 UTF-16LE 连续片段中提取
  const chunks: { text: string; score: number }[] = []
  let currentChunk = ''
  let chineseCount = 0

  for (let i = 0; i < wordDoc.length - 1; i += 2) {
    const code = readUint16LE(wordDoc, i)

    const isPrintable =
      (code >= 0x20 && code <= 0x7E) ||
      code === 0x0A || code === 0x0D || code === 0x09 ||
      (code >= 0x2000 && code <= 0x206F) ||
      (code >= 0x3000 && code <= 0x9FFF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0x00A0 && code <= 0x024F)

    if (isPrintable) {
      currentChunk += String.fromCharCode(code)
      if (code >= 0x4E00 && code <= 0x9FFF) chineseCount++
    } else {
      if (currentChunk.length >= 6) {
        // 计算文本质量分：中文字符越多越可能是真实文本
        const score = currentChunk.length + chineseCount * 3
        chunks.push({ text: currentChunk, score })
      }
      currentChunk = ''
      chineseCount = 0
    }
  }
  if (currentChunk.length >= 6) {
    chunks.push({ text: currentChunk, score: currentChunk.length + chineseCount * 3 })
  }

  // 按分数排序取最好的片段，但在总长度达到 expectedLen 后停止
  chunks.sort((a, b) => b.score - a.score)
  let result = ''
  let collected = 0
  const limit = expectedLen > 0 ? expectedLen * 2 : 10000 // 给予一些余量
  for (const chunk of chunks) {
    if (collected >= limit) break
    result += chunk.text + '\n'
    collected += chunk.text.length
  }

  result = result.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return result
}

/**
 * 从旧版 .doc 文件中提取文本的主入口
 * 优先使用 OLE2 结构化解析，失败时回退到简单扫描
 */
function extractTextFromDoc(arrayBuffer: ArrayBuffer): string {
  const data = new Uint8Array(arrayBuffer)

  try {
    // 1. 解析 OLE2 复合文档
    const streams = parseCFB(data)
    // 2. 从 Word 流中提取文本
    const text = extractTextFromWordStreams(streams)
    if (text.trim().length > 0) return text
  } catch (e) {
    console.warn('OLE2 结构化解析失败，回退到扫描方式:', e)
  }

  // 3. 全部失败：回退到简单 UTF-16LE 扫描
  return extractTextFallbackSimple(data)
}

/** 最简单的回退：直接扫描 UTF-16LE（原始方法的改进版） */
function extractTextFallbackSimple(bytes: Uint8Array): string {
  const chunks: string[] = []
  let currentChunk = ''

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = readUint16LE(bytes, i)

    const isPrintable =
      (code >= 0x20 && code <= 0x7E) ||
      code === 0x0A || code === 0x0D || code === 0x09 ||
      (code >= 0x2000 && code <= 0x206F) ||
      (code >= 0x3000 && code <= 0x9FFF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0x00A0 && code <= 0x024F)

    if (isPrintable) {
      currentChunk += String.fromCharCode(code)
    } else {
      if (currentChunk.length >= 4) {
        chunks.push(currentChunk)
      }
      currentChunk = ''
    }
  }
  if (currentChunk.length >= 4) {
    chunks.push(currentChunk)
  }

  let result = chunks.join('\n')
  result = result.replace(/\n{3,}/g, '\n\n').trim()
  return result
}

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
  isDocxPreview.value = false
  // 清空 docx-preview 容器
  if (docxContainer.value) {
    docxContainer.value.innerHTML = ''
  }
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
        const arrayBuffer = await file.arrayBuffer()
        // 通过文件头魔数检测真实格式，而不是依赖扩展名
        const header = new Uint8Array(arrayBuffer.slice(0, 4))
        const isZip = header[0] === 0x50 && header[1] === 0x4B // PK = ZIP = docx
        
        if (isZip) {
          // docx 格式：使用 docx-preview 保留完整样式
          try {
            isDocxPreview.value = true
            loading.value = false
            await nextTick()
            if (docxContainer.value) {
              const docxPreview = await import('docx-preview')
              await docxPreview.renderAsync(arrayBuffer, docxContainer.value, undefined, {
                className: 'docx-preview-body',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: true,
                ignoreFonts: false,
                breakPages: true,
                ignoreLastRenderedPageBreak: true,
                experimental: false,
                trimXmlDeclaration: true,
                useBase64URL: true,
              })
              // 渲染后检查内容是否为空
              if (docxContainer.value && docxContainer.value.textContent?.trim() === '') {
                throw new Error('渲染结果为空')
              }
            }
          } catch {
            // docx-preview 失败，fallback 到 mammoth
            console.warn('docx-preview 渲染失败，尝试 mammoth 兜底')
            isDocxPreview.value = false
            if (docxContainer.value) {
              docxContainer.value.innerHTML = ''
            }
            const mammoth = await import('mammoth')
            const result = await mammoth.default.convertToHtml({ arrayBuffer })
            htmlContent.value = result.value
          }
        } else {
          // doc (OLE2) 二进制格式：从二进制中提取文本内容
          // mammoth 和 docx-preview 都不支持旧版 .doc，手动提取文本
          const text = extractTextFromDoc(arrayBuffer)
          if (text.trim()) {
            textContent.value = text
          } else {
            error.value = '无法预览旧版 .doc 文件，请将文件另存为 .docx 格式后重试'
          }
        }
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

    <!-- DOCX preview (docx-preview) -->
    <div v-else-if="isDocxPreview" class="preview-docx-container">
      <div ref="docxContainer" class="docx-wrapper"></div>
    </div>

    <!-- HTML content (doc fallback / Markdown) -->
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

/* DOCX Preview (docx-preview library) */
.preview-docx-container {
  flex: 1;
  overflow: auto;
  background: #e8e8e8;
}

.docx-wrapper {
  min-height: 100%;
}

/* docx-preview 生成的页面容器样式覆盖 */
.docx-wrapper :deep(.docx-wrapper) {
  background: #e8e8e8;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.docx-wrapper :deep(.docx-wrapper > section.docx-preview-body) {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  margin: 0 auto;
  border-radius: 2px;
}

/* HTML (doc fallback / Markdown) */
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
