import { contextBridge, ipcRenderer } from 'electron'

// 渲染层不直连文件系统，一切持久化 / 系统对话框 / 通知都经 IPC 走主进程
const api = {
  ping: () => 'pong',
  meta: {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    }
  },
  records: {
    list: () => ipcRenderer.invoke('records:list'),
    append: (rec) => ipcRenderer.invoke('records:append', rec),
    clear: () => ipcRenderer.invoke('records:clear') // v0.2 清空历史
  },
  settings: {
    // v0.2 设置：主进程白名单校验后持久化
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  notify: (title, body) => ipcRenderer.invoke('notify:send', { title, body }), // v0.2 系统通知
  exportSave: (name, content) => ipcRenderer.invoke('export:save', { name, content }) // v0.2 导出落盘
}

contextBridge.exposeInMainWorld('electronAPI', api)
