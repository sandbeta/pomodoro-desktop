// 统计纯函数 —— 与 core/timer.js 同一分层原则：无 React / 浏览器依赖，可单测
// 记录数据模型: { id, mode, startedAt, endedAt, durationSec, completed }

export function dayKey(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// 本周一 00:00 的时间戳（本地时区）
export function mondayStart(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // 周一=0 ... 周日=6
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

function isCompletedFocus(r) {
  return r && r.mode === 'focus' && r.completed === true
}

/** 按日/周/月聚合今日、本周、本月的番茄数与专注分钟数 */
export function summarize(records, now = Date.now()) {
  const n = new Date(now)
  const todayK = dayKey(now)
  const weekFrom = mondayStart(now)
  const monthFrom = new Date(n.getFullYear(), n.getMonth(), 1).getTime()
  const acc = () => ({ count: 0, minutes: 0 })
  const today = acc(), week = acc(), month = acc()
  for (const r of records || []) {
    if (!isCompletedFocus(r)) continue
    const mins = (r.durationSec || 0) / 60
    if (dayKey(r.endedAt) === todayK) {
      today.count++
      today.minutes += mins
    }
    if (r.endedAt >= weekFrom) {
      week.count++
      week.minutes += mins
    }
    if (r.endedAt >= monthFrom) {
      month.count++
      month.minutes += mins
    }
  }
  return { today, week, month }
}

/** 最近 days 天（含今天）的每日番茄数与分钟数，缺日补 0 */
export function dailyFocusBuckets(records, days = 7, now = Date.now()) {
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)
  const out = []
  const index = new Map()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    const key = dayKey(d)
    index.set(key, out.length)
    out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, minutes: 0 })
  }
  for (const r of records || []) {
    if (!isCompletedFocus(r)) continue
    const i = index.get(dayKey(r.endedAt))
    if (i !== undefined) {
      out[i].count++
      out[i].minutes += (r.durationSec || 0) / 60
    }
  }
  return out
}

/** 分钟数 → 人类可读时长（<60 用分钟，否则小时保留一位小数） */
export function fmtDuration(minutes) {
  if (minutes <= 0) return '0 分钟'
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  const h = minutes / 60
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)} 小时`
}
