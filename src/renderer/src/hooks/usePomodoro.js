import { useState, useRef, useEffect, useCallback } from 'react'
import { playChime } from '../utils/sound'
import { FOCUS, SHORT, LONG, durationFor, advanceOnComplete, advanceOnSkip } from '../core/timer'

export const DEFAULT_SETTINGS = {
  focus: 25, // 分钟
  short: 5,
  long: 15,
  longEvery: 4, // 每完成几个番茄后安排一次长休息
  autoStart: false, // 阶段结束后是否自动开始下一阶段
  sound: true
}

export const MODE_LABEL = {
  [FOCUS]: '专注',
  [SHORT]: '短休息',
  [LONG]: '长休息'
}

/**
 * 番茄钟核心 hook
 * @param {object} settings 时长配置
 * @param {(info:{mode:string,at:number})=>void} [onPhaseComplete] 阶段自然走完时的回调(供 M4 写历史)
 */
export function usePomodoro(settings = DEFAULT_SETTINGS, onPhaseComplete) {
  const [mode, setMode] = useState(FOCUS)
  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(() => durationFor(FOCUS, settings))
  const [remaining, setRemaining] = useState(() => durationFor(FOCUS, settings))
  const [focusCount, setFocusCount] = useState(0)
  const endAtRef = useRef(0)
  const startedAtRef = useRef(0) // 本阶段首次开始（含暂停后恢复）的起始时刻
  const totalRef = useRef(durationFor(FOCUS, settings))

  const cbRef = useRef(onPhaseComplete)
  cbRef.current = onPhaseComplete

  // 进入某阶段并重置倒计时
  const gotoPhase = useCallback(
    (next, startNow) => {
      const dur = durationFor(next, settings)
      setMode(next)
      setTotal(dur)
      setRemaining(dur)
      totalRef.current = dur
      startedAtRef.current = 0
      if (startNow) {
        startedAtRef.current = Date.now()
        endAtRef.current = Date.now() + dur * 1000
        setRunning(true)
      } else {
        setRunning(false)
      }
    },
    [settings]
  )

  // 阶段自然走完 -> 提示音 + 按纯逻辑推进
  const completePhase = useCallback(() => {
    const at = Date.now()
    cbRef.current?.({
      mode,
      at,
      startedAt: startedAtRef.current || at - totalRef.current * 1000,
      durationSec: totalRef.current,
      completed: true
    })
    if (settings.sound) playChime(mode === FOCUS ? 'done' : 'break')
    const next = advanceOnComplete({ mode, focusCount }, settings)
    if (next.focusCount !== focusCount) setFocusCount(next.focusCount)
    gotoPhase(next.mode, settings.autoStart)
  }, [mode, focusCount, settings, gotoPhase])

  // 计时循环：以结束时间戳为基准，避免 setInterval 漂移
  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = Math.round((endAtRef.current - Date.now()) / 1000)
      if (left <= 0) {
        setRemaining(0)
        completePhase()
      } else {
        setRemaining((prev) => (prev !== left ? left : prev))
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [running, completePhase])

  const start = useCallback(() => {
    if (remaining <= 0) return
    if (!startedAtRef.current) startedAtRef.current = Date.now()
    endAtRef.current = Date.now() + remaining * 1000
    setRunning(true)
  }, [remaining])

  const pause = useCallback(() => setRunning(false), [])

  const toggle = useCallback(() => {
    if (running) setRunning(false)
    else {
      if (remaining <= 0) return
      if (!startedAtRef.current) startedAtRef.current = Date.now()
      endAtRef.current = Date.now() + remaining * 1000
      setRunning(true)
    }
  }, [running, remaining])

  const reset = useCallback(() => gotoPhase(mode, false), [mode, gotoPhase])

  const skip = useCallback(() => {
    const next = advanceOnSkip({ mode, focusCount }, settings)
    if (next.focusCount !== focusCount) setFocusCount(next.focusCount)
    gotoPhase(next.mode, false)
  }, [mode, focusCount, settings, gotoPhase])

  /**
   * 标记中断：把「被打断」如实记成一条 completed:false 的记录，再进入下一阶段。
   * 与「跳过」的区别只在于留下数据 —— 被打断是番茄钟最常见的真实结局，
   * 不记下来就永远无法回答「你通常倒在第几分钟」。
   * 只记专注阶段：打断休息没有分析价值，徒增流水账。
   */
  const markInterrupted = useCallback(() => {
    if (startedAtRef.current && mode === FOCUS) {
      const at = Date.now()
      cbRef.current?.({
        mode,
        at,
        startedAt: startedAtRef.current,
        durationSec: totalRef.current,
        elapsedSec: Math.max(0, totalRef.current - remaining),
        completed: false
      })
    }
    const next = advanceOnSkip({ mode, focusCount }, settings)
    if (next.focusCount !== focusCount) setFocusCount(next.focusCount)
    gotoPhase(next.mode, false)
  }, [mode, focusCount, remaining, settings, gotoPhase])

  const resetCount = useCallback(() => {
    setFocusCount(0)
    gotoPhase(FOCUS, false)
  }, [gotoPhase])

  const progress = total > 0 ? (total - remaining) / total : 0

  return {
    mode,
    modeLabel: MODE_LABEL[mode],
    running,
    remaining,
    total,
    progress,
    focusCount,
    start,
    pause,
    toggle,
    reset,
    skip,
    markInterrupted,
    resetCount
  }
}
