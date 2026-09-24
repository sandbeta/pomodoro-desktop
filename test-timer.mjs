// 纯逻辑单元测试：node test-timer.mjs
import assert from 'node:assert/strict'
import {
  FOCUS,
  SHORT,
  LONG,
  durationFor,
  breakModeAfter,
  advanceOnComplete,
  advanceOnSkip
} from './src/renderer/src/core/timer.js'

const S = { focus: 25, short: 5, long: 15, longEvery: 4 }
let n = 0
const ok = (msg) => {
  n++
  console.log(`  ✓ ${msg}`)
}

// durationFor
assert.equal(durationFor(FOCUS, S), 1500)
assert.equal(durationFor(SHORT, S), 300)
assert.equal(durationFor(LONG, S), 900)
ok('durationFor 按分钟换算为秒')

// 长休息节奏：第4个番茄后才是 long
assert.equal(breakModeAfter(1, S), SHORT)
assert.equal(breakModeAfter(2, S), SHORT)
assert.equal(breakModeAfter(3, S), SHORT)
assert.equal(breakModeAfter(4, S), LONG)
assert.equal(breakModeAfter(8, S), LONG)
ok('breakModeAfter 每 longEvery 个番茄触发长休息')

// 完整走一遍 4 个番茄的节奏
let st = { mode: FOCUS, focusCount: 0 }
const seq = []
for (let i = 0; i < 8; i++) {
  st = advanceOnComplete(st, S)
  seq.push(`${st.mode}#${st.focusCount}`)
}
// 期望: 完成第1个番茄->short, 休息完->focus, 第2->short, 完->focus, 第3->short, 完->focus, 第4->long, 完->focus
assert.deepEqual(seq, [
  'short#1',
  'focus#1',
  'short#2',
  'focus#2',
  'short#3',
  'focus#3',
  'long#4',
  'focus#4'
])
ok('advanceOnComplete 驱动完整的 番茄→休息→番茄 循环')

// skip 不增加完成数
const before = { mode: FOCUS, focusCount: 2 }
const afterSkip = advanceOnSkip(before, S)
assert.equal(afterSkip.focusCount, 2)
assert.equal(afterSkip.mode, SHORT)
ok('advanceOnSkip 跳过番茄但不累加完成数')

const afterSkipBreak = advanceOnSkip({ mode: SHORT, focusCount: 2 }, S)
assert.equal(afterSkipBreak.mode, FOCUS)
ok('advanceOnSkip 跳过休息回到番茄')

console.log(`\n全部 ${n} 组断言通过 ✅`)
