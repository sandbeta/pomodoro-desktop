// 统计纯函数 —— 与 core/timer.js 同一分层原则：无 React / 浏览器依赖，可单测
// 记录数据模型: { id, mode, startedAt, endedAt, durationSec, completed, elapsedSec? }
// durationSec 恒为该阶段的「计划时长」；elapsedSec 仅中断记录携带，表示实际坚持了多久

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

/**
 * 近 days 天内专注阶段的「完成 / 中断」画像。
 * 中断不是一种失败，而是一个有信息量的结果：它回答「你通常倒在第几分钟」。
 * 只统计 mode==='focus' 的记录；completed 非 true 即视为中断。
 */
export function interruptStats(records, days = 7, now = Date.now()) {
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (days - 1))
  const fromTs = from.getTime()

  let completed = 0
  let interrupted = 0
  let elapsedSum = 0
  const perMinute = new Map()

  for (const r of records || []) {
    if (!r || r.mode !== 'focus') continue
    if (!(r.startedAt >= fromTs)) continue
    if (r.completed === true) {
      completed++
      continue
    }
    interrupted++
    const sec = Number.isFinite(r.elapsedSec) && r.elapsedSec > 0 ? r.elapsedSec : 0
    elapsedSum += sec
    const min = Math.max(1, Math.round(sec / 60))
    perMinute.set(min, (perMinute.get(min) || 0) + 1)
  }

  const total = completed + interrupted
  // 取出现次数最多的「倒下分钟数」；并列时取更早的那个（更早中断更值得提醒）
  let peakMinute = null
  let peakCount = 0
  for (const [min, c] of [...perMinute.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > peakCount) {
      peakCount = c
      peakMinute = min
    }
  }

  return {
    completed,
    interrupted,
    total,
    ratio: total ? interrupted / total : 0,
    avgElapsedSec: interrupted ? elapsedSum / interrupted : 0,
    peakMinute
  }
}

/** 分钟数 → 人类可读时长（<60 用分钟，否则小时保留一位小数） */
export function fmtDuration(minutes) {
  if (minutes <= 0) return '0 分钟'
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  const h = minutes / 60
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)} 小时`
}
