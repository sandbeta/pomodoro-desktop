import assert from 'node:assert/strict'
import { toJson, toCsv, defaultName } from './src/renderer/src/core/export.js'

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
assert.equal(lines[0], 'id,mode,started_at,ended_at,duration_sec,completed')
assert.ok(lines[1].includes('专注'))
assert.ok(lines[1].endsWith(',true'))
ok('toCsv 表头与行格式正确，模式中文化')

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

console.log(`\n全部 ${n} 组断言通过 ✅`)
