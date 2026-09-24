import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'node:fs'
import Store from 'electron-store'

// 固定数据目录名：打包后 productName 是中文「番茄钟」，若不固定，
// 安装包/便携版会把历史记录写到 Roaming\番茄钟，与 npm run dev 的 Roaming\pomodoro-desktop 割裂。
// 显式 setName 让三者共用同一份数据（窗口标题仍是「番茄钟」，不受影响）。
app.setName('pomodoro-desktop')

// M4: 历史记录持久化（JSON 落盘在系统 userData 目录，不进仓库）
// 数据模型: { id, mode, startedAt, endedAt, durationSec, completed }
const history = new Store({ name: 'pomodoro-history', defaults: { records: [] } })

const VALID_MODES = new Set(['focus', 'short', 'long'])

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
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
