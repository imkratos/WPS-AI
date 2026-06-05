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
  getFullText,
  getDocName,
  replaceSelection,
  insertAfterSelection,
  insertAtEnd,
  replaceAllText,
  insertImage,
  applyLayoutPreset,
  hasSelection
}
