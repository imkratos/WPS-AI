// WPS 文档操作封装
// 统一处理宿主环境检测和空值保护

/**
 * 检查 WPS 宿主是否可用
 * @returns {boolean}
 */
function isWpsAvailable() {
  return typeof window !== 'undefined' && !!window.Application
}

/**
 * 获取当前选区文本
 * @returns {string} 选区文本，无选区或非 WPS 环境返回空字符串
 */
function getSelection() {
  if (!isWpsAvailable()) return ''
  try {
    const sel = window.Application.Selection
    if (!sel) return ''
    return sel.Text || ''
  } catch {
    return ''
  }
}

/**
 * 获取当前选区文本和 Range 位置信息
 * @returns {{text: string, start: number|null, end: number|null, docName: string, isSelection: boolean}}
 */
function getSelectionRangeInfo() {
  if (!isWpsAvailable()) {
    return { text: '', start: null, end: null, docName: '', isSelection: false }
  }

  try {
    const sel = window.Application.Selection
    const range = sel?.Range
    const text = sel?.Text || ''
    return {
      text,
      start: typeof range?.Start === 'number' ? range.Start : null,
      end: typeof range?.End === 'number' ? range.End : null,
      docName: getDocName(),
      isSelection: !!text && text.length > 0
    }
  } catch {
    return { text: '', start: null, end: null, docName: '', isSelection: false }
  }
}

/**
 * 获取当前光标或选区所在段落文本
 * @returns {{text: string, start: number|null, end: number|null, docName: string}}
 */
function getCurrentParagraphInfo() {
  if (!isWpsAvailable()) {
    return { text: '', start: null, end: null, docName: '' }
  }

  try {
    const sel = window.Application.Selection
    const range = sel?.Range
    const paragraphs = range?.Paragraphs
    const paragraph = paragraphs?.Item ? paragraphs.Item(1) : paragraphs?.[0]
    const paragraphRange = paragraph?.Range
    const text = normalizeParagraphText(paragraphRange?.Text || '')
    if (text) {
      return {
        text,
        start: typeof paragraphRange?.Start === 'number' ? paragraphRange.Start : null,
        end: typeof paragraphRange?.End === 'number' ? paragraphRange.End : null,
        docName: getDocName()
      }
    }
  } catch {
    // 继续走全文定位兜底。
  }

  return getCurrentParagraphInfoFromFullText()
}

function getCurrentParagraphInfoFromFullText() {
  try {
    const selectionInfo = getSelectionRangeInfo()
    const documentInfo = getDocumentRangeInfo()
    const fullText = documentInfo.text || ''
    if (!fullText || !Number.isFinite(selectionInfo.start)) {
      return { text: '', start: null, end: null, docName: getDocName() }
    }

    const docStart = Number.isFinite(documentInfo.start) ? documentInfo.start : 0
    const cursor = Math.max(selectionInfo.start - docStart, 0)
    const paragraphStartIndex = fullText.lastIndexOf('\r', Math.max(cursor - 1, 0)) + 1
    const nextBreakIndex = fullText.indexOf('\r', cursor)
    const paragraphEndIndex = nextBreakIndex >= 0 ? nextBreakIndex : fullText.length
    const text = normalizeParagraphText(fullText.slice(paragraphStartIndex, paragraphEndIndex))

    return {
      text,
      start: docStart + paragraphStartIndex,
      end: docStart + paragraphEndIndex,
      docName: documentInfo.docName || getDocName()
    }
  } catch {
    return { text: '', start: null, end: null, docName: getDocName() }
  }
}

function normalizeParagraphText(text) {
  return String(text || '').replace(/[\r\n]+$/g, '').trim()
}

/**
 * 获取当前文档全文文本
 * @returns {string} 全文文本，无文档或非 WPS 环境返回空字符串
 */
function getFullText() {
  if (!isWpsAvailable()) return ''
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) return ''
    // Content.Text 获取全文，不同版本 WPS 支持方式略有差异
    const content = doc.Content
    return content ? content.Text || '' : ''
  } catch {
    return ''
  }
}

/**
 * 获取当前文档全文和 Range 位置信息
 * @returns {{text: string, start: number|null, end: number|null, docName: string, isSelection: boolean}}
 */
function getDocumentRangeInfo() {
  if (!isWpsAvailable()) {
    return { text: '', start: null, end: null, docName: '', isSelection: false }
  }

  try {
    const doc = window.Application.ActiveDocument
    const content = doc?.Content
    return {
      text: content?.Text || '',
      start: typeof content?.Start === 'number' ? content.Start : null,
      end: typeof content?.End === 'number' ? content.End : null,
      docName: doc?.Name || '',
      isSelection: false
    }
  } catch {
    return { text: '', start: null, end: null, docName: '', isSelection: false }
  }
}

/**
 * 获取当前文档名
 * @returns {string}
 */
function getDocName() {
  if (!isWpsAvailable()) return ''
  try {
    const doc = window.Application.ActiveDocument
    return doc ? doc.Name || '' : ''
  } catch {
    return ''
  }
}

/**
 * 替换当前选区文本
 * 如果没有选区，则在光标位置插入
 * @param {string} text
 * @returns {boolean} 是否成功
 */
function replaceSelection(text) {
  if (!isWpsAvailable()) return false
  try {
    const sel = window.Application.Selection
    if (!sel) return false
    sel.Text = text
    // 触发 WPS 重绘
    const rg = window.Application.Selection.Range
    if (rg) rg.Select()
    return true
  } catch {
    return false
  }
}

/**
 * 选中文档指定 Range
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function selectRange(start, end) {
  if (!isWpsAvailable()) return false
  try {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false
    const doc = window.Application.ActiveDocument
    const range = doc?.Range(start, end)
    if (!range?.Select) return false
    range.Select()
    return true
  } catch {
    return false
  }
}

/**
 * 在基准 Range 内按出现序号查找文本并选中。
 * occurrenceIndex 从 0 开始；返回 Range 位置，便于调用方做兜底替换。
 * @param {string} text
 * @param {number|null} baseStart
 * @param {number|null} baseEnd
 * @param {number} occurrenceIndex
 * @returns {{ok: boolean, start: number|null, end: number|null, count: number}}
 */
function findAndSelect(text, baseStart = null, baseEnd = null, occurrenceIndex = 0) {
  if (!isWpsAvailable() || !text) return { ok: false, start: null, end: null, count: 0 }
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) return { ok: false, start: null, end: null, count: 0 }

    const baseRange =
      Number.isFinite(baseStart) && Number.isFinite(baseEnd) ? doc.Range(baseStart, baseEnd) : doc.Content
    const baseText = baseRange?.Text || ''
    const indexes = findAllIndexes(baseText, text)
    const index = indexes[occurrenceIndex]
    if (!Number.isFinite(index)) {
      return { ok: false, start: null, end: null, count: indexes.length }
    }

    const start = (Number.isFinite(baseStart) ? baseStart : baseRange.Start || 0) + index
    const end = start + text.length
    return { ok: selectRange(start, end), start, end, count: indexes.length }
  } catch {
    return { ok: false, start: null, end: null, count: 0 }
  }
}

/**
 * 替换文档指定 Range 内容
 * @param {number} start
 * @param {number} end
 * @param {string} text
 * @returns {boolean}
 */
function replaceRange(start, end, text) {
  if (!isWpsAvailable()) return false
  try {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return false
    const doc = window.Application.ActiveDocument
    const range = doc?.Range(start, end)
    if (!range) return false
    range.Text = text
    const newEnd = start + String(text || '').length
    selectRange(start, newEnd)
    return true
  } catch {
    return false
  }
}

function findAllIndexes(source, target) {
  const indexes = []
  if (!source || !target) return indexes
  let from = 0
  for (;;) {
    const index = source.indexOf(target, from)
    if (index < 0) break
    indexes.push(index)
    from = index + Math.max(target.length, 1)
  }
  return indexes
}

/**
 * 在选区末尾之后插入文本（续写场景）
 * @param {string} text
 * @returns {boolean}
 */
function insertAfterSelection(text) {
  if (!isWpsAvailable()) return false
  try {
    const sel = window.Application.Selection
    if (!sel) return false
    // 将光标移动到选区末尾，再插入
    sel.Collapse(0) // 0 = wdCollapseEnd
    sel.Text = text
    const rg = window.Application.Selection.Range
    if (rg) rg.Select()
    return true
  } catch {
    return false
  }
}

/**
 * 在文档末尾插入文本（帮我写场景）
 * @param {string} text
 * @returns {boolean}
 */
function insertAtEnd(text) {
  if (!isWpsAvailable()) return false
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) return false
    const range = doc.Range()
    // 移到文档末尾
    range.Collapse(0)
    range.Text = text
    const rg = window.Application.Selection.Range
    if (rg) rg.Select()
    return true
  } catch {
    return false
  }
}

/**
 * 在文档末尾插入 Markdown，并把标题转换为 WPS 中可见的标题样式。
 * 当前重点处理 AI 常见输出：# 标题、## 小标题、列表、引用和普通段落。
 * @param {string} markdown
 * @returns {boolean}
 */
function insertMarkdownAtEnd(markdown) {
  if (!isWpsAvailable()) return false
  const blocks = parseMarkdownBlocks(markdown)
  if (!blocks.length) return false

  try {
    const doc = window.Application.ActiveDocument
    if (!doc) return false

    const range = doc.Range()
    range.Collapse(0)
    const insertStart = typeof range.Start === 'number' ? range.Start : null
    const text = `\n\n${blocks.map((block) => block.text).join('\n')}`
    range.Text = text

    if (Number.isFinite(insertStart)) {
      applyMarkdownBlockFormats(doc, blocks, insertStart + 2)
    }

    const rg = window.Application.Selection.Range
    if (rg) rg.Select()
    return true
  } catch {
    return false
  }
}

function parseMarkdownBlocks(markdown) {
  const source = String(markdown || '')
    .replace(/\r\n?/g, '\n')
    .trim()
  if (!source) return []

  const blocks = []
  let inCodeBlock = false

  source.split('\n').forEach((rawLine) => {
    const line = rawLine.trim()
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock
      return
    }

    if (!line) {
      blocks.push({ type: 'blank', text: '' })
      return
    }

    if (!inCodeBlock && /^-{3,}$|^\*{3,}$|^_{3,}$/.test(line)) {
      blocks.push({ type: 'blank', text: '' })
      return
    }

    if (!inCodeBlock) {
      const heading = line.match(/^(#{1,6})\s+(.+)$/)
      if (heading) {
        blocks.push({
          type: 'heading',
          level: heading[1].length,
          text: stripInlineMarkdown(heading[2])
        })
        return
      }

      const unordered = line.match(/^[-*+]\s+(.+)$/)
      if (unordered) {
        blocks.push({ type: 'list', text: `• ${stripInlineMarkdown(unordered[1])}` })
        return
      }

      const ordered = line.match(/^(\d+)[.)]\s+(.+)$/)
      if (ordered) {
        blocks.push({ type: 'list', text: `${ordered[1]}. ${stripInlineMarkdown(ordered[2])}` })
        return
      }

      const quote = line.match(/^>\s*(.+)$/)
      if (quote) {
        blocks.push({ type: 'quote', text: stripInlineMarkdown(quote[1]) })
        return
      }
    }

    blocks.push({ type: inCodeBlock ? 'code' : 'paragraph', text: stripInlineMarkdown(line) })
  })

  return trimBlankBlocks(blocks)
}

function stripInlineMarkdown(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim()
}

function trimBlankBlocks(blocks) {
  const result = [...blocks]
  while (result[0]?.type === 'blank') result.shift()
  while (result[result.length - 1]?.type === 'blank') result.pop()
  return result
}

function applyMarkdownBlockFormats(doc, blocks, start) {
  let cursor = start
  blocks.forEach((block, index) => {
    const end = cursor + block.text.length
    if (block.text) {
      try {
        const range = doc.Range(cursor, end)
        applyBlockFormat(range, block)
      } catch {
        // 不同 WPS 版本的样式 API 有差异；单段失败不影响正文插入。
      }
    }
    cursor = end + (index < blocks.length - 1 ? 1 : 0)
  })
}

function applyBlockFormat(range, block) {
  if (block.type === 'heading') {
    applyHeadingFormat(range, block.level)
    return
  }

  if (range.Font) {
    range.Font.Name = '宋体'
    range.Font.Size = block.type === 'code' ? 10.5 : 12
    range.Font.Bold = false
  }

  if (range.ParagraphFormat) {
    range.ParagraphFormat.FirstLineIndent = block.type === 'paragraph' ? 21 : 0
    range.ParagraphFormat.SpaceBefore = 0
    range.ParagraphFormat.SpaceAfter = block.type === 'blank' ? 0 : 6
    range.ParagraphFormat.LineSpacing = 20
  }
}

function applyHeadingFormat(range, level = 1) {
  const normalizedLevel = Math.min(Math.max(Number(level) || 1, 1), 6)
  tryApplyHeadingStyle(range, normalizedLevel)

  if (range.Font) {
    range.Font.Name = '宋体'
    range.Font.Bold = true
    range.Font.Size = getHeadingFontSize(normalizedLevel)
  }

  if (range.ParagraphFormat) {
    range.ParagraphFormat.FirstLineIndent = 0
    range.ParagraphFormat.SpaceBefore = normalizedLevel <= 2 ? 12 : 8
    range.ParagraphFormat.SpaceAfter = normalizedLevel <= 2 ? 8 : 6
    range.ParagraphFormat.LineSpacing = 24
  }
}

function tryApplyHeadingStyle(range, level) {
  const styleNames = [`标题 ${level}`, `Heading ${level}`, `标题${level}`]
  for (const styleName of styleNames) {
    try {
      range.Style = styleName
      return
    } catch {
      // 继续尝试其他语言或格式的内置样式名称。
    }
  }
}

function getHeadingFontSize(level) {
  const sizeMap = {
    1: 18,
    2: 16,
    3: 14,
    4: 13,
    5: 12,
    6: 12
  }
  return sizeMap[level] || 12
}

/**
 * 替换整篇文档文本
 * @param {string} text
 * @returns {boolean}
 */
function replaceAllText(text) {
  if (!isWpsAvailable()) return false
  try {
    const doc = window.Application.ActiveDocument
    if (!doc || !doc.Content) return false
    doc.Content.Text = text
    return true
  } catch {
    return false
  }
}

/**
 * 插入图片。WPS 不同宿主版本对远程 URL 支持不完全一致，失败时返回 false。
 * @param {string} src 图片 URL 或本地路径
 * @returns {boolean}
 */
function insertImage(src) {
  if (!isWpsAvailable() || !src) return false
  try {
    const sel = window.Application.Selection
    if (sel?.InlineShapes?.AddPicture) {
      sel.InlineShapes.AddPicture(src)
      return true
    }

    const doc = window.Application.ActiveDocument
    if (doc?.InlineShapes?.AddPicture) {
      doc.InlineShapes.AddPicture(src)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 对当前文档应用基础排版规则。
 * @param {'general'|'paper'|'official'} preset
 * @returns {{ok: boolean, message: string}}
 */
function applyLayoutPreset(preset = 'general') {
  if (!isWpsAvailable()) {
    return { ok: false, message: '当前不在 WPS 宿主环境中，无法直接排版文档' }
  }

  try {
    const doc = window.Application.ActiveDocument
    if (!doc || !doc.Content) {
      return { ok: false, message: '当前没有可排版的文档' }
    }

    const content = doc.Content
    const fontMap = {
      general: { name: '宋体', size: 12 },
      paper: { name: '宋体', size: 10.5 },
      official: { name: '仿宋_GB2312', size: 16 }
    }
    const cfg = fontMap[preset] || fontMap.general

    if (content.Font) {
      content.Font.Name = cfg.name
      content.Font.Size = cfg.size
    }

    if (content.ParagraphFormat) {
      content.ParagraphFormat.FirstLineIndent = preset === 'official' ? 32 : 21
      content.ParagraphFormat.SpaceBefore = 0
      content.ParagraphFormat.SpaceAfter = preset === 'paper' ? 0 : 6
      content.ParagraphFormat.LineSpacing = preset === 'official' ? 28 : 20
    }

    if (doc.PageSetup) {
      if (preset === 'official') {
        doc.PageSetup.TopMargin = 72
        doc.PageSetup.BottomMargin = 72
        doc.PageSetup.LeftMargin = 79
        doc.PageSetup.RightMargin = 79
      } else {
        doc.PageSetup.TopMargin = 72
        doc.PageSetup.BottomMargin = 72
        doc.PageSetup.LeftMargin = 90
        doc.PageSetup.RightMargin = 90
      }
    }

    return { ok: true, message: '已应用基础排版规则' }
  } catch (err) {
    return { ok: false, message: err.message || '排版失败' }
  }
}

/**
 * 检查当前是否有选区（非折叠状态）
 * @returns {boolean}
 */
function hasSelection() {
  if (!isWpsAvailable()) return false
  try {
    const sel = window.Application.Selection
    if (!sel) return false
    // Type 2 = wdSelectionNormal（有选中文本）
    return sel.Type === 2 || (sel.Text && sel.Text.length > 0)
  } catch {
    return false
  }
}

export default {
  isWpsAvailable,
  getSelection,
  getSelectionRangeInfo,
  getCurrentParagraphInfo,
  getFullText,
  getDocumentRangeInfo,
  getDocName,
  replaceSelection,
  selectRange,
  findAndSelect,
  replaceRange,
  insertAfterSelection,
  insertAtEnd,
  insertMarkdownAtEnd,
  replaceAllText,
  insertImage,
  applyLayoutPreset,
  hasSelection
}
