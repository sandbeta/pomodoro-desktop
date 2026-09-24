import { contextBridge, ipcRenderer } from 'electron'

// M1 占位能力保留；M4 新增历史记录通道（持久化统一经主进程，renderer 不直连文件系统）
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
    append: (rec) => ipcRenderer.invoke('records:append', rec)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
