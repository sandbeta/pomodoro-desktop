// 统计纯逻辑单元测试：node test-stats.mjs
import assert from 'node:assert/strict'
import { dayKey, mondayStart, summarize, dailyFocusBuckets, fmtDuration } from './src/renderer/src/core/stats.js'

let n = 0
const ok = (msg) => {
  n++
  console.log(`  ✓ ${msg}`)
}

const mk = (mode, endedAt, durationSec = 1500, completed = true) => ({
  id: String(endedAt),
  mode,
  startedAt: endedAt - durationSec * 1000,
  endedAt,
  durationSec,
  completed
})

// ---- dayKey / mondayStart ----
assert.equal(dayKey(new Date(2026, 8, 24, 13, 0).getTime()), '2026-09-24')
ok('dayKey 输出本地日期 YYYY-MM-DD')

const thu = new Date(2026, 8, 24, 13, 0).getTime() // 周四
const mon = new Date(2026, 8, 21, 0, 0).getTime() // 周一
assert.equal(mondayStart(thu), mon)
const sun = new Date(2026, 8, 27, 23, 0).getTime() // 周日
assert.equal(mondayStart(sun), mon)
ok('mondayStart 周一起算，周日归上周')

// ---- summarize ----
const NOW = new Date(2026, 8, 24, 20, 0).getTime() // 周四晚
const todayRec = mk('focus', new Date(2026, 8, 24, 9, 0).getTime(), 1500)
const todayRec2 = mk('focus', new Date(2026, 8, 24, 11, 0).getTime(), 1500)
const thisWeekRec = mk('focus', new Date(2026, 8, 22, 9, 0).getTime(), 1500) // 周二
const lastWeekRec = mk('focus', new Date(2026, 8, 18, 9, 0).getTime(), 1500) // 上周五
const thisMonthRec = mk('focus', new Date(2026, 8, 3, 9, 0).getTime(), 1500) // 本月早些天
const breakRec = mk('short', new Date(2026, 8, 24, 9, 30).getTime(), 300) // 休息不计番茄
const skipped = mk('focus', new Date(2026, 8, 24, 15, 0).getTime(), 900, false) // 未完成不计

const sum = summarize(
  [todayRec, todayRec2, thisWeekRec, lastWeekRec, thisMonthRec, breakRec, skipped],
  NOW
)
assert.equal(sum.today.count, 2)
assert.equal(sum.today.minutes, 50)
assert.equal(sum.week.count, 3) // 昨日+今日+周一 => 上周的不算
assert.equal(sum.month.count, 5) // 本月内的全部（不含上月）
assert.equal(sum.month.minutes, 125)
ok('summarize 按日/周/月聚合，只计 completed 的 focus')

const empty = summarize([], NOW)
assert.equal(empty.today.count, 0)
assert.equal(empty.today.minutes, 0)
ok('summarize 空数据返回全 0')

// ---- dailyFocusBuckets ----
const buckets = dailyFocusBuckets([todayRec, todayRec2, thisWeekRec, breakRec, skipped], 7, NOW)
assert.equal(buckets.length, 7)
assert.equal(buckets[6].key, '2026-09-24') // 最后一天 = 今天
assert.equal(buckets[6].count, 2)
assert.equal(buckets[4].count, 1) // 9/22 周二
assert.equal(buckets[0].count, 0) // 缺日补 0
assert.equal(buckets[0].minutes, 0)
ok('dailyFocusBuckets 近 N 天连续分桶、缺日补 0')

// 跨月边界：月初第一天的记录不能漏
const monthStart = new Date(2026, 8, 1, 10, 0).getTime()
const buckets2 = dailyFocusBuckets([mk('focus', monthStart)], 7, new Date(2026, 8, 1, 23, 0).getTime())
assert.equal(buckets2[6].count, 1)
ok('dailyFocusBuckets 正确处理跨月/月首')

// ---- fmtDuration ----
assert.equal(fmtDuration(0), '0 分钟')
assert.equal(fmtDuration(50), '50 分钟')
assert.equal(fmtDuration(60), '1.0 小时')
assert.equal(fmtDuration(125), '2.1 小时')
assert.equal(fmtDuration(750), '13 小时')
ok('fmtDuration 分钟/小时自适应')

console.log(`\n全部 ${n} 组断言通过 ✅`)
