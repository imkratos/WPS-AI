import Util from './js/util.js'
import SystemDemo from './js/systemdemo.js'
import WpsDoc from './js/wpsDoc.js'

// 加载项初始化，是整个 wps 加载项中第一个执行的函数
function OnAddinLoad(ribbonUI) {
  if (typeof window.Application.ribbonUI != 'object') {
    window.Application.ribbonUI = ribbonUI
  }

  if (typeof window.Application.Enum != 'object') {
    // 如果没有内置枚举值，手动补充
    window.Application.Enum = Util.WPS_Enum
  }

  // 暴露给外部业务系统调用的函数
  window.openOfficeFileFromSystemDemo = SystemDemo.openOfficeFileFromSystemDemo
  window.InvokeFromSystemDemo = SystemDemo.InvokeFromSystemDemo

  window.Application.PluginStorage.setItem('EnableFlag', false)
  window.Application.PluginStorage.setItem('ApiEventFlag', false)
  return true
}

var WebNotifycount = 0
const PRODUCT_NAME = '文策 AI'

const AI_QUICK_ACTION_MAP = {
  btnAiContinueQuick: 'btnAiContinue',
  btnAiExpandQuick: 'btnAiExpand',
  btnAiRewriteQuick: 'btnAiRewrite',
  btnAiShortenQuick: 'btnAiShorten',
  btnAiPolishQuick: 'btnAiPolish',
  btnAiFormalQuick: 'btnAiFormal',
  btnAiPartyQuick: 'btnAiParty',
  btnAiProofreadQuick: 'btnAiProofread',
  btnAiFullPolishQuick: 'btnAiFullPolish',
  btnAiPaperLayoutQuick: 'btnAiPaperLayout',
  btnAiOfficialLayoutQuick: 'btnAiOfficialLayout',
  btnAiSelectionContinue: 'btnAiContinue',
  btnAiSelectionExpand: 'btnAiExpand',
  btnAiSelectionRewrite: 'btnAiRewrite',
  btnAiSelectionShorten: 'btnAiShorten',
  btnAiSelectionPolish: 'btnAiPolish',
  btnAiSelectionFormal: 'btnAiFormal',
  btnAiSelectionParty: 'btnAiParty',
  btnAiSelectionProofread: 'btnAiProofread'
}

const AI_SELECTION_ACTION_IDS = new Set([
  'btnAiSelectionContinue',
  'btnAiSelectionExpand',
  'btnAiSelectionRewrite',
  'btnAiSelectionShorten',
  'btnAiSelectionPolish',
  'btnAiSelectionFormal',
  'btnAiSelectionParty',
  'btnAiSelectionProofread'
])

const TASKPANE_STORAGE_KEYS = [
  'taskpane_id',
  'ai_taskpane_id',
  'ai_edit_taskpane_id',
  'ai_history_pane_id',
  // 兼容旧版本按功能分别创建的 AI 任务窗格，避免历史 ID 导致多窗格并存。
  'ai_taskpane_id_write',
  'ai_taskpane_id_companion',
  'ai_taskpane_id_qa'
]

function OnAction(control) {
  const eleId = AI_QUICK_ACTION_MAP[control.Id] || control.Id
  switch (eleId) {
    // ===== 原有演示按钮 =====
    case 'btnShowMsg': {
      const doc = window.Application.ActiveDocument
      if (!doc) {
        alert('当前没有打开任何文档')
        return
      }
      alert(doc.Name)
      break
    }
    case 'btnIsEnbable': {
      let bFlag = window.Application.PluginStorage.getItem('EnableFlag')
      window.Application.PluginStorage.setItem('EnableFlag', !bFlag)
      window.Application.ribbonUI.InvalidateControl('btnIsEnbable')
      window.Application.ribbonUI.InvalidateControl('btnShowDialog')
      window.Application.ribbonUI.InvalidateControl('btnShowTaskPane')
      break
    }
    case 'btnShowDialog': {
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/dialog',
        '这是一个对话框网页',
        400 * window.devicePixelRatio,
        400 * window.devicePixelRatio,
        false
      )
      break
    }
    case 'btnShowTaskPane': {
      closeOtherTaskPanes('taskpane_id')
      const title = getTaskPaneTitle('任务窗格')
      let tsId = window.Application.PluginStorage.getItem('taskpane_id')
      if (!tsId) {
        let tskpane = window.Application.CreateTaskPane(
          Util.GetUrlPath() + Util.GetRouterHash() + '/taskpane',
          title
        )
        window.Application.PluginStorage.setItem('taskpane_id', tskpane.ID)
        tskpane.Visible = true
      } else {
        let tskpane = window.Application.GetTaskPane(tsId)
        setTaskPaneTitle(tskpane, title)
        tskpane.Visible = !tskpane.Visible
      }
      break
    }
    case 'btnApiEvent': {
      let bFlag = window.Application.PluginStorage.getItem('ApiEventFlag')
      let bRegister = !bFlag
      window.Application.PluginStorage.setItem('ApiEventFlag', bRegister)
      if (bRegister) {
        window.Application.ApiEvent.AddApiEventListener('DocumentNew', 'ribbon.OnNewDocumentApiEvent')
      } else {
        window.Application.ApiEvent.RemoveApiEventListener('DocumentNew', 'ribbon.OnNewDocumentApiEvent')
      }
      window.Application.ribbonUI.InvalidateControl('btnApiEvent')
      break
    }
    case 'btnWebNotify': {
      let currentTime = new Date()
      let timeStr =
        currentTime.getHours() + ':' + currentTime.getMinutes() + ':' + currentTime.getSeconds()
      window.Application.OAAssist.WebNotify(
        '这行内容由wps加载项主动送达给业务系统，可以任意自定义, 比如时间值:' +
          timeStr +
          '，次数：' +
          ++WebNotifycount,
        true
      )
      break
    }

    // ===== AI 功能按钮 =====

    // 帮我写：打开 AI 任务窗格（write tab）
    case 'btnAiWrite':
      openAiTaskPane('write')
      break

    // 帮我改下拉子菜单
    case 'btnAiContinue':
      openAiDialogTaskPane('continue')
      break
    case 'btnAiExpand':
      openAiDialogTaskPane('expand')
      break
    case 'btnAiRewrite':
      openAiDialogTaskPane('rewrite')
      break
    case 'btnAiShorten':
      openAiDialogTaskPane('shorten')
      break
    case 'btnAiParty':
      openAiDialogTaskPane('party')
      break
    case 'btnAiPolish':
      openAiDialogTaskPane('polish')
      break
    case 'btnAiFormal':
      openAiDialogTaskPane('formal')
      break
    case 'btnAiProofread':
      openAiDialogTaskPane('proofread')
      break
    case 'btnAiFullPolish':
      openAiDialogTaskPane('full-polish')
      break

    // 伴写：打开 AI 任务窗格（companion tab）
    case 'btnAiCompanion':
      openAiTaskPane('companion')
      break

    // 文档问答：打开 AI 任务窗格（qa tab）
    case 'btnAiQA':
      openAiTaskPane('qa')
      break

    // 全文总结：对话框
    case 'btnAiSummary':
      openAiDialog('summary')
      break

    // AI 排版系列：对话框（占位提示）
    case 'btnAiAiLayout':
      openAiDialog('layout')
      break
    case 'btnAiPaperLayout':
      openAiDialog('paper-layout')
      break
    case 'btnAiOfficialLayout':
      openAiDialog('official-layout')
      break

    // 文档生成 PPT：对话框（占位提示）
    case 'btnAiPPT':
      openAiDialog('ppt')
      break

    // AI 生成图片：对话框（占位提示）
    case 'btnAiImage':
      openAiDialog('image')
      break

    // AI 总结生图：对话框（占位提示）
    case 'btnAiSummaryImage':
      openAiDialog('summary-image')
      break

    // 历史会话：任务窗格
    case 'btnAiHistory':
      openAiHistory()
      break

    // 设置：对话框
    case 'btnAiSettings':
      openAiSettings()
      break

    default:
      break
  }
  return true
}

// ===== AI 窗口辅助函数 =====

/**
 * 打开 AI 任务窗格
 * @param {string} mode - 'write' | 'companion' | 'qa'
 */
function openAiTaskPane(mode) {
  const storageKey = 'ai_taskpane_id'
  const url = Util.GetUrlPath() + Util.GetRouterHash() + '/ai-pane?mode=' + mode
  const title = getTaskPaneTitle(getAiTaskPaneModeTitle(mode))
  closeOtherTaskPanes(storageKey)
  let tsId = window.Application.PluginStorage.getItem(storageKey)
  if (!tsId) {
    let tskpane = window.Application.CreateTaskPane(url, title)
    window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
    tskpane.Visible = true
  } else {
    try {
      let tskpane = window.Application.GetTaskPane(tsId)
      tskpane.Navigate(url)
      setTaskPaneTitle(tskpane, title)
      tskpane.Visible = true
    } catch {
      // 任务窗格已失效，重新创建
      let tskpane = window.Application.CreateTaskPane(url, title)
      window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
      tskpane.Visible = true
    }
  }
}

/**
 * 打开 AI 对话框
 * @param {string} mode - AiDialog 支持的 mode 参数
 */
function openAiDialog(mode) {
  // 根据不同功能设置合适的窗口大小
  const largeDialogs = ['summary', 'full-polish', 'proofread', 'layout', 'paper-layout', 'official-layout', 'ppt', 'image', 'summary-image']
  const width = largeDialogs.includes(mode) ? 680 : 600
  const height = largeDialogs.includes(mode) ? 560 : 500
  const url = Util.GetUrlPath() + Util.GetRouterHash() + '/ai-dialog?mode=' + mode
  window.Application.ShowDialog(
    url,
    getDialogTitle(mode),
    width * window.devicePixelRatio,
    height * window.devicePixelRatio,
    false
  )
}

/**
 * 在共享任务窗格中打开原对话框类 AI 功能
 * @param {string} mode - AiDialog 支持的 mode 参数
 */
function openAiDialogTaskPane(mode) {
  const storageKey = 'ai_edit_taskpane_id'
  const titleStorageKey = `${storageKey}_title`
  const title = getTaskPaneTitle(getDialogTitle(mode))
  const url =
    Util.GetUrlPath() +
    Util.GetRouterHash() +
    '/ai-dialog?mode=' +
    mode +
    '&paneKey=' +
    storageKey
  closeOtherTaskPanes(storageKey)
  let tsId = window.Application.PluginStorage.getItem(storageKey)
  const lastTitle = window.Application.PluginStorage.getItem(titleStorageKey)

  if (tsId && lastTitle !== title) {
    closeTaskPaneByStorageKey(storageKey)
    tsId = ''
  }

  if (!tsId) {
    let tskpane = window.Application.CreateTaskPane(url, title)
    window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
    window.Application.PluginStorage.setItem(titleStorageKey, title)
    setAiTaskPaneWidth(tskpane, mode)
    tskpane.Visible = true
    return
  }

  try {
    let tskpane = window.Application.GetTaskPane(tsId)
    tskpane.Navigate(url)
    setTaskPaneTitle(tskpane, title)
    window.Application.PluginStorage.setItem(titleStorageKey, title)
    setAiTaskPaneWidth(tskpane, mode)
    tskpane.Visible = true
  } catch {
    // 任务窗格已失效，重新创建
    let tskpane = window.Application.CreateTaskPane(url, title)
    window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
    window.Application.PluginStorage.setItem(titleStorageKey, title)
    setAiTaskPaneWidth(tskpane, mode)
    tskpane.Visible = true
  }
}

function setAiTaskPaneWidth(tskpane, mode) {
  const largeModes = ['full-polish', 'proofread']
  const width = largeModes.includes(mode) ? 500 : 420
  try {
    tskpane.MinWidth = 360
    tskpane.Width = width
  } catch {
    // 宿主版本不支持宽度设置时忽略
  }
}

/**
 * 打开设置对话框
 */
function openAiSettings() {
  const url = Util.GetUrlPath() + Util.GetRouterHash() + '/ai-settings'
  window.Application.ShowDialog(
    url,
    '文策 AI 设置',
    480 * window.devicePixelRatio,
    520 * window.devicePixelRatio,
    false
  )
}

/**
 * 打开历史会话任务窗格
 */
function openAiHistory() {
  const storageKey = 'ai_history_pane_id'
  const url = Util.GetUrlPath() + Util.GetRouterHash() + '/ai-history'
  const title = getTaskPaneTitle('历史会话')
  closeOtherTaskPanes(storageKey)
  let tsId = window.Application.PluginStorage.getItem(storageKey)
  if (!tsId) {
    let tskpane = window.Application.CreateTaskPane(url, title)
    window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
    tskpane.Visible = true
  } else {
    try {
      let tskpane = window.Application.GetTaskPane(tsId)
      setTaskPaneTitle(tskpane, title)
      tskpane.Visible = !tskpane.Visible
    } catch {
      let tskpane = window.Application.CreateTaskPane(url, title)
      window.Application.PluginStorage.setItem(storageKey, tskpane.ID)
      tskpane.Visible = true
    }
  }
}

function closeOtherTaskPanes(activeStorageKey) {
  TASKPANE_STORAGE_KEYS.forEach((storageKey) => {
    if (storageKey === activeStorageKey) return
    closeTaskPaneByStorageKey(storageKey)
  })
}

function closeTaskPaneByStorageKey(storageKey) {
  const tsId = window.Application.PluginStorage.getItem(storageKey)
  if (!tsId) return

  try {
    const tskpane = window.Application.GetTaskPane(tsId)
    tskpane.Visible = false
  } catch {
    // 宿主中任务窗格已失效时忽略，后续打开会重新创建。
  }
}

function getTaskPaneTitle(featureName) {
  return `${PRODUCT_NAME} | ${featureName}`
}

function setTaskPaneTitle(tskpane, title) {
  try {
    tskpane.Title = title
  } catch {
    // 部分 WPS 版本只支持创建时传入标题，复用时无法动态修改。
  }
}

function getAiTaskPaneModeTitle(mode) {
  const titles = {
    write: '帮我写',
    companion: '伴写',
    qa: '文档问答'
  }
  return titles[mode] || 'AI 任务窗格'
}

/**
 * 根据 mode 返回对话框标题
 */
function getDialogTitle(mode) {
  const titles = {
    continue: '续写',
    expand: '扩写',
    rewrite: '重写',
    shorten: '缩写',
    party: '党政风转换',
    polish: '润色',
    formal: '更正式',
    proofread: 'AI 纠错',
    'full-polish': '全文润色',
    summary: '全文总结',
    layout: 'AI 排版',
    'paper-layout': '论文排版',
    'official-layout': '公文排版',
    ppt: '文档生成 PPT',
    image: 'AI 生成图片',
    'summary-image': 'AI 总结生图'
  }
  return titles[mode] || '文策 AI'
}

function GetImage(control) {
  const eleId = AI_QUICK_ACTION_MAP[control.Id] || control.Id
  switch (eleId) {
    case 'btnShowMsg':
      return 'images/1.svg'
    case 'btnIsEnbable':
    case 'btnShowDialog':
      return 'images/2.svg'
    case 'btnShowTaskPane':
    case 'btnApiEvent':
    case 'btnWebNotify':
      return 'images/3.svg'
    case 'btnAiWrite':
      return 'images/ai-write.svg'
    case 'menuAiSelectionText':
    case 'menuAiEdit':
    case 'btnAiContinue':
    case 'btnAiExpand':
    case 'btnAiRewrite':
    case 'btnAiShorten':
    case 'btnAiParty':
    case 'btnAiPolish':
    case 'btnAiFormal':
    case 'btnAiProofread':
    case 'btnAiFullPolish':
      return 'images/ai-edit.svg'
    case 'btnAiCompanion':
      return 'images/ai-companion.svg'
    case 'btnAiQA':
      return 'images/ai-qa.svg'
    case 'btnAiSummary':
      return 'images/ai-summary.svg'
    case 'btnAiAiLayout':
    case 'menuAiLayout':
    case 'btnAiPaperLayout':
    case 'btnAiOfficialLayout':
      return 'images/ai-layout.svg'
    case 'btnAiPPT':
      return 'images/ai-ppt.svg'
    case 'btnAiImage':
      return 'images/ai-image.svg'
    case 'btnAiSummaryImage':
      return 'images/ai-summary-image.svg'
    case 'btnAiHistory':
      return 'images/ai-history.svg'
    case 'btnAiSettings':
      return 'images/ai-settings.svg'
    default:
      return 'images/newFromTemp.svg'
  }
}

function OnGetEnabled(control) {
  const eleId = control.Id
  if (AI_SELECTION_ACTION_IDS.has(eleId)) {
    return WpsDoc.hasSelection()
  }

  switch (eleId) {
    case 'btnShowMsg':
      return true
    case 'btnShowDialog': {
      return !!window.Application.PluginStorage.getItem('EnableFlag')
    }
    case 'btnShowTaskPane': {
      return !!window.Application.PluginStorage.getItem('EnableFlag')
    }
    default:
      break
  }
  return true
}

function OnGetVisible(control) {
  const eleId = control.Id
  console.log(eleId)
  return true
}

function OnGetLabel(control) {
  const eleId = control.Id
  switch (eleId) {
    case 'btnIsEnbable': {
      let bFlag = window.Application.PluginStorage.getItem('EnableFlag')
      return bFlag ? '按钮Disable' : '按钮Enable'
    }
    case 'btnApiEvent': {
      let bFlag = window.Application.PluginStorage.getItem('ApiEventFlag')
      return bFlag ? '清除新建文件事件' : '注册新建文件事件'
    }
  }
  return ''
}

function OnNewDocumentApiEvent(doc) {
  alert('新建文件事件响应，取文件名: ' + doc.Name)
}

// 暴露给 WPS 宿主调用的函数
export default {
  OnAddinLoad,
  OnAction,
  GetImage,
  OnGetEnabled,
  OnGetVisible,
  OnGetLabel,
  OnNewDocumentApiEvent
}
