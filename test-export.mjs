import assert from 'node:assert/strict'
import {
  toJson, toCsv, defaultName, fromExport, mergeRecords, normalizeRecord, recordKey, SCHEMA_VERSION
} from './src/renderer/src/core/export.js'

let n = 0
const ok = (msg) => {
  n++
  console.log(`  ✓ ${msg}`)
}

const rec = (over = {}) => ({
  id: '1',
  mode: 'focus',
  startedAt: new Date(2026, 8, 24, 9, 0, 0).getTime(),
  endedAt: new Date(2026, 8, 24, 9, 25, 0).getTime(),
  durationSec: 1500,
  completed: true,
  ...over
})

// toJson：合法 JSON、含元信息、原样保留记录
const json = toJson([rec(), rec({ mode: 'short', completed: false })])
const parsed = JSON.parse(json)
assert.equal(parsed.app, 'pomodoro-desktop')
assert.equal(parsed.count, 2)
assert.equal(parsed.records[0].durationSec, 1500)
assert.equal(parsed.records[1].mode, 'short')
ok('toJson 输出带元信息的合法 JSON')

// toCsv：表头 + 中文模式 + 布尔
const csv = toCsv([rec()])
const lines = csv.trim().split('\r\n')
assert.equal(lines[0], 'id,mode,started_at,ended_at,duration_sec,elapsed_sec,completed')
assert.ok(lines[1].includes('专注'))
assert.ok(lines[1].endsWith(',true'))
ok('toCsv 表头与行格式正确，模式中文化')

// 中断记录：elapsed_sec 有值；完成记录该列留空
const mixed = toCsv([rec(), rec({ completed: false, elapsedSec: 1080, startedAt: rec().startedAt + 1 })])
  .trim()
  .split('\r\n')
assert.ok(mixed[1].includes(',,true')) // 完成记录没有 elapsedSec，该列空着
assert.ok(mixed[2].endsWith(',1080,false'))
ok('toCsv 输出 elapsed_sec，完成记录该列留空')

// 转义：值里带逗号/引号不能破坏列结构
const dirty = toCsv([rec({ id: 'a,"b"' })])
assert.ok(dirty.includes('"a,""b"""'))
ok('toCsv 对逗号/引号做 RFC 转义')

// 空数组：只有表头
const empty = toCsv([]).trim().split('\r\n')
assert.equal(empty.length, 1)
assert.equal(JSON.parse(toJson([])).count, 0)
ok('空记录导出合法')

// 文件名带日期后缀
assert.match(defaultName('csv'), /^番茄钟记录-\d{8}\.csv$/)
ok('defaultName 生成带日期的文件名')

// ---------- fromExport：导入解析 ----------

// 自己导出的文件必须能原样读回来
const roundTrip = fromExport(toJson([rec(), rec({ completed: false, elapsedSec: 900 })]))
assert.equal(roundTrip.ok, true)
assert.equal(roundTrip.records.length, 2)
assert.equal(roundTrip.records[1].completed, false)
assert.equal(roundTrip.records[1].elapsedSec, 900)
assert.equal(roundTrip.version, SCHEMA_VERSION)
ok('fromExport 能读回 toJson 的产物，含中断字段')

// 裸数组也要接受（用户可能手工从文件里摘出来）
const bare = fromExport(JSON.stringify([rec()]))
assert.equal(bare.ok, true)
assert.equal(bare.records.length, 1)
ok('fromExport 兼容裸数组')

// v1 文件没有 elapsed_sec / completed 语义未变，必须照样能导
const v1 = fromExport(JSON.stringify({ app: 'pomodoro-desktop', version: 1, records: [rec()] }))
assert.equal(v1.ok, true)
assert.equal(v1.records.length, 1)
assert.equal(v1.records[0].elapsedSec, undefined)
assert.equal(v1.warning, '')
ok('fromExport 向下兼容 version 1')

// 比本程序更新的文件：能用，但要给出警告而不是静默丢弃语义
const future = fromExport(JSON.stringify({ version: SCHEMA_VERSION + 3, records: [rec()] }))
assert.equal(future.ok, true)
assert.match(future.warning, /高于本程序/)
ok('fromExport 对更高版本给警告不拒绝')

// 坏输入一律不抛异常
assert.equal(fromExport('不是 JSON').ok, false)
assert.equal(fromExport(JSON.stringify({ foo: 1 })).ok, false)
assert.equal(fromExport('').ok, false)
ok('fromExport 对坏输入返回错误而非抛异常')

// 不合格记录被跳过并计数，不污染可用记录
const messy = fromExport(
  JSON.stringify([rec(), { mode: 'bogus', startedAt: 1, endedAt: 2, durationSec: 3 }, { mode: 'focus', startedAt: 'x', endedAt: 2, durationSec: 3 }])
)
assert.equal(messy.records.length, 1)
assert.equal(messy.skipped, 2)
ok('fromExport 跳过不合规格的记录并计数')

// ---------- mergeRecords：跨设备合并 ----------

// 关键设计：id 是 Date.now()，两台机器同一毫秒开始一个番茄会撞号。
// 所以身份是 startedAt|mode|durationSec，id 不同也必须判为同一条。
const devA = rec({ id: '1758000000000' })
const devB = rec({ id: '1758999999999' }) // 同一番茄，另一台设备写的
assert.notEqual(devA.id, devB.id)
assert.equal(recordKey(devA), recordKey(devB))
const deduped = mergeRecords([devA], [devB])
assert.equal(deduped.records.length, 1)
assert.equal(deduped.added, 0)
ok('mergeRecords 按时间/模式/时长去重，不被撞号的 id 骗过')

// 不同番茄要各自保留，并按开始时间升序
const other = rec({ startedAt: rec().startedAt - 86400e3, endedAt: rec().endedAt - 86400e3 })
const merged = mergeRecords([devA], [other])
assert.equal(merged.records.length, 2)
assert.equal(merged.added, 1)
assert.ok(merged.records[0].startedAt < merged.records[1].startedAt)
ok('mergeRecords 保留不同记录并升序排列')

// 中断与完成的同阶段记录不该互相吞掉（durationSec 相同但 startedAt 必然不同）
assert.equal(mergeRecords([rec()], [rec({ completed: false, elapsedSec: 600 })]).records.length, 1)
ok('mergeRecords 把同一番茄的重复上报收敛成一条')

// normalizeRecord 白名单：不认识的字段不得穿透
assert.equal(normalizeRecord(rec({ evil: 'x' })).evil, undefined)
assert.equal(normalizeRecord({ mode: 'focus', startedAt: 1, endedAt: 2 }), null) // 缺 durationSec
ok('normalizeRecord 逐字段白名单，拒绝不完整记录')

console.log(`\n全部 ${n} 组断言通过 ✅`)
