import { useState, useEffect, useCallback } from 'react'
import { summarize, dailyFocusBuckets } from '../core/stats'

// 从主进程拉取历史记录并聚合统计；appendRecord 供完成回调落库
// electronAPI 缺失（如浏览器直开 dev 页）时优雅降级为空数据，不崩
const hasBridge = typeof window !== 'undefined' && !!window.electronAPI?.records

export function useStats() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!hasBridge) {
      setLoading(false)
      return
    }
    try {
      const list = await window.electronAPI.records.list()
      setRecords(Array.isArray(list) ? list : [])
    } catch (e) {
      console.warn('[useStats] list failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const appendRecord = useCallback(
    async (rec) => {
      if (!hasBridge) return false
      const ok = await window.electronAPI.records.append(rec)
      if (ok) refresh()
      return ok
    },
    [refresh]
  )

  const summary = summarize(records)
  const daily = dailyFocusBuckets(records, 7)

  return { records, summary, daily, loading, refresh, appendRecord, bridge: hasBridge }
}
