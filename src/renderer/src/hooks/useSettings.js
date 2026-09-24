import { useState, useEffect, useCallback } from 'react'

export const DEFAULT_SETTINGS = {
  focus: 25, // 分钟
  short: 5,
  long: 15,
  longEvery: 4, // 每完成几个番茄后安排一次长休息
  autoStart: false, // 阶段结束后是否自动开始下一阶段
  sound: true,
  notify: true, // v0.2 系统通知
  minimizeToTray: true // v0.2 关闭=进托盘
}

/**
 * v0.2: 设置不再硬编码，从主进程加载、可保存回写。
 * bridge 缺失（浏览器直开 dev 页）时退回默认值并允许本地改（不持久化）。
 */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const bridge = typeof window !== 'undefined' && !!window.electronAPI?.settings

  useEffect(() => {
    let alive = true
    if (!bridge) {
      setReady(true)
      return
    }
    window.electronAPI.settings
      .get()
      .then((s) => {
        if (alive && s) setSettings({ ...DEFAULT_SETTINGS, ...s })
      })
      .catch((e) => console.warn('[useSettings] load failed', e))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [bridge])

  // patch 只带改动字段；保存后以主进程返回的（已校验）值为准
  const save = useCallback(
    async (patch) => {
      if (!bridge) {
        setSettings((prev) => ({ ...prev, ...patch }))
        return true
      }
      try {
        const next = await window.electronAPI.settings.set(patch)
        if (next) setSettings({ ...DEFAULT_SETTINGS, ...next })
        return true
      } catch (e) {
        console.warn('[useSettings] save failed', e)
        return false
      }
    },
    [bridge]
  )

  return { settings, ready, save, bridge }
}
