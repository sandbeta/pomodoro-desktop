import { app, BrowserWindow, shell, ipcMain, Tray, Menu, Notification, dialog, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'node:fs'
import Store from 'electron-store'

// 固定数据目录名：打包后 productName 是中文「番茄钟」，若不固定，
// 安装包/便携版会把历史记录写到 Roaming\番茄钟，与 npm run dev 的 Roaming\pomodoro-desktop 割裂。
// 显式 setName 让三者共用同一份数据（窗口标题仍是「番茄钟」，不受影响）。
app.setName('pomodoro-desktop')

// v0.2: 单实例锁——托盘常驻的 App 被重复双击时应唤回已有窗口而不是开第二个
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) process.exit(0)

// M4: 历史记录持久化（JSON 落盘在系统 userData 目录，不进仓库）
// 数据模型: { id, mode, startedAt, endedAt, durationSec, completed }
const history = new Store({ name: 'pomodoro-history', defaults: { records: [] } })

const VALID_MODES = new Set(['focus', 'short', 'long'])

// ---- v0.2 设置持久化 ----
// 数值范围与 renderer 的输入约束保持一致；bool 一律 !! 归一
const SETTINGS_DEFAULTS = {
  focus: 25, short: 5, long: 15, longEvery: 4,
  autoStart: false, sound: true, notify: true, minimizeToTray: true
}
const SETTINGS_NUM = { focus: [1, 180], short: [1, 60], long: [1, 180], longEvery: [1, 10] }
const SETTINGS_BOOL = ['autoStart', 'sound', 'notify', 'minimizeToTray']

const settingsStore = new Store({ name: 'pomodoro-settings', defaults: SETTINGS_DEFAULTS })

function sanitizeSettings(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, [min, max]] of Object.entries(SETTINGS_NUM)) {
    if (raw[k] !== undefined) {
      const n = Number(raw[k])
      if (Number.isFinite(n)) out[k] = Math.min(max, Math.max(min, Math.round(n)))
    }
  }
  for (const k of SETTINGS_BOOL) {
    if (raw[k] !== undefined) out[k] = !!raw[k]
  }
  return out
}

function effectiveSettings() {
  const merged = { ...SETTINGS_DEFAULTS }
  for (const k of [...Object.keys(SETTINGS_NUM), ...SETTINGS_BOOL]) {
    const v = settingsStore.get(k)
    if (v !== undefined) merged[k] = v
  }
  return merged
}

function registerIpc() {
  ipcMain.handle('records:list', () => history.get('records', []))
  ipcMain.handle('records:append', (_e, rec) => {
    // 主进程侧做最低限度校验，renderer 传入的数据不可全信
    if (
      !rec ||
      !VALID_MODES.has(rec.mode) ||
      typeof rec.startedAt !== 'number' ||
      typeof rec.endedAt !== 'number' ||
      typeof rec.durationSec !== 'number'
    ) {
      return false
    }
    const records = history.get('records', [])
    records.push({ ...rec, id: String(rec.id ?? Date.now()), completed: rec.completed === true })
    history.set('records', records.slice(-20000)) // 防无限增长，保留最近 2 万条
    return true
  })
  ipcMain.handle('records:clear', () => {
    history.set('records', [])
    return true
  })

  ipcMain.handle('settings:get', () => effectiveSettings())
  ipcMain.handle('settings:set', (_e, patch) => {
    const clean = sanitizeSettings(patch)
    for (const [k, v] of Object.entries(clean)) settingsStore.set(k, v)
    return effectiveSettings()
  })

  // v0.2: 阶段结束系统通知（设置可关；点击通知唤回窗口）
  // 窗口正可见且聚焦时不打扰，只有隐藏/最小化/后台时才弹
  ipcMain.handle('notify:send', (_e, { title, body }) => {
    if (!settingsStore.get('notify')) return false
    if (!Notification.isSupported()) return false
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused()) return false
    const n = new Notification({
      title: String(title ?? ''),
      body: String(body ?? '')
    })
    n.on('click', () => showWindow())
    n.show()
    return true
  })

  // v0.2: 导出保存——内容来自 renderer，落盘经系统保存对话框由主进程写
  ipcMain.handle('export:save', async (_e, { name, content }) => {
    // 对话框必须以可见窗口为父级：托盘隐藏态下直接弹会挂起/不可见，先唤回窗口
    showWindow()
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出历史记录',
      defaultPath: String(name || 'pomodoro-history.json'),
      filters: [
        { name: 'JSON 数据', extensions: ['json'] },
        { name: 'CSV 表格', extensions: ['csv'] }
      ]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    try {
      fs.writeFileSync(filePath, String(content ?? ''), 'utf8')
      return { ok: true, path: filePath }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}

// GPU 渲染策略（自适应，2026-09-24 改造）：
// 旧方案是无条件 --use-angle=swiftshader 强制软件渲染，但软件光栅化呼吸动画 + 80px 光晕
// 会让 gpu-process 吃满 1~2 个核（实测 1100%+ CPU）。现改为：默认硬件加速；
// 仅当上次运行发生 GPU 进程崩溃时，写一个一次性标记，让**下一次启动**降级软件渲染，
// 该次启动后即清除标记、回到硬件模式（崩溃→降级一次→自动重试硬件）。
const gpuFallbackFlag = join(app.getPath('userData'), 'gpu-software-once.flag')

function setupGpuStrategy() {
  let useSoftware = false
  try {
    useSoftware = fs.existsSync(gpuFallbackFlag)
    if (useSoftware) fs.unlinkSync(gpuFallbackFlag) // 一次性：本次降级，下次重试硬件
  } catch (e) {
    console.log('[gpu] flag check failed:', e.message)
  }
  if (useSoftware) {
    console.log('[gpu] previous GPU crash detected -> software rendering this session')
    app.commandLine.appendSwitch('use-angle', 'swiftshader')
  }
  app.on('child-process-gone', (_e, details) => {
    if (details.type === 'GPU') {
      try {
        fs.writeFileSync(gpuFallbackFlag, String(Date.now()))
        console.log(`[gpu] GPU process gone (${details.reason}), next launch will use software rendering`)
      } catch (e) {
        console.log('[gpu] flag write failed:', e.message)
      }
    }
  })
}
setupGpuStrategy()

// electron-vite 在开发模式会注入 ELECTRON_RENDERER_URL
const isDev = !!process.env['ELECTRON_RENDERER_URL']

// dev 时 __dirname = 项目/out/main；打包后同构进 asar（默认 files 规则含 build/）
// 托盘图标用 PNG：nativeImage.createFromBuffer 官方仅解 PNG/JPEG；createFromPath 不认 asar 路径
const trayIconPath = join(__dirname, '../../build/icon.png')

let mainWindow = null
let tray = null
let isQuitting = false
let trayHintShown = false

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (!mainWindow.isVisible()) mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function createTray() {
  let icon = nativeImage.createEmpty()
  try {
    if (fs.existsSync(trayIconPath)) {
      icon = nativeImage.createFromBuffer(fs.readFileSync(trayIconPath))
    }
  } catch (e) {
    console.log('[tray] icon load failed:', e.message)
  }
  tray = new Tray(icon)
  tray.setToolTip('番茄钟')
  const menu = Menu.buildFromTemplate([
    { label: '显示/隐藏窗口', click: () => (mainWindow?.isVisible() ? mainWindow.hide() : showWindow()) },
    { type: 'separator' },
    {
      label: '退出番茄钟',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => (mainWindow?.isVisible() ? mainWindow.hide() : showWindow()))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: '番茄钟',
    backgroundColor: '#FFF6EE',
    webPreferences: {
      // "type":"module" 模式下 electron-vite 的 preload 产物是 .mjs（ESM preload 必须 sandbox:false + .mjs 后缀）
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // v0.2: 托盘常驻后窗口隐藏时计时/动画不被后台节流降频
      backgroundThrottling: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => win.show())

  // v0.2: 点关闭 = 进托盘（可配）；真正退出只走托盘菜单 / before-quit
  win.on('close', (e) => {
    if (isQuitting) return
    if (settingsStore.get('minimizeToTray')) {
      e.preventDefault()
      win.hide()
      if (!trayHintShown && tray) {
        trayHintShown = true
        try {
          tray.displayBalloon({
            title: '番茄钟仍在运行',
            content: '计时不会中断。左键托盘图标可唤回窗口，右键菜单可退出。'
          })
        } catch { /* 非 Win10/11 或通知被禁，忽略 */ }
      }
    }
  })

  // 诊断桥：把渲染进程的控制台输出与加载失败转发到主进程终端，便于排查白屏
  // Electron 32+ 的 console-message 签名变为 (event, details)，兼容两种形态
  win.webContents.on('console-message', (...args) => {
    const [, a, b] = args
    const lvl = a && typeof a === 'object' ? a.level : a
    const msg = a && typeof a === 'object' ? a.message : b
    console.log(`[renderer:${lvl}] ${msg}`)
  })
  win.webContents.on('did-fail-load', (_e, ...rest) => {
    console.log(`[did-fail-load] ${JSON.stringify(rest)}`)
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.log(`[render-process-gone] ${JSON.stringify(details)}`)
  })
  // 兜底：本机偶发 ready-to-show 不触发，页面加载完成或 4 秒后强制显示窗口
  win.webContents.once('did-finish-load', () => {
    console.log('[did-finish-load] page loaded')
    win.show()
  })
  setTimeout(() => {
    if (!win.isDestroyed()) {
      console.log(`[fallback-show] isVisible=${win.isVisible()} url=${win.webContents.getURL()}`)
      if (!win.isVisible()) win.show()
    }
  }, 4000)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// v0.2: 第二次启动（托盘隐藏时又双击 exe）→ 唤回窗口
app.on('second-instance', () => showWindow())

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
