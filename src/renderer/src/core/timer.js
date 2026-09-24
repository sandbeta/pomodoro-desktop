// 番茄钟的纯决策逻辑 —— 不依赖 React / 浏览器，方便单元测试与复用
export const FOCUS = 'focus'
export const SHORT = 'short'
export const LONG = 'long'

// 某模式对应的秒数
export function durationFor(mode, settings) {
  const mins = settings[mode] ?? 25
  return Math.max(1, Math.round(mins * 60))
}

// 已完成 focusDone 个番茄后，接下来应进入短休息还是长休息
export function breakModeAfter(focusDoneCount, settings) {
  return focusDoneCount % settings.longEvery === 0 ? LONG : SHORT
}

// 一个阶段「自然走完」后的状态推进（focus 走完会累加完成数）
export function advanceOnComplete(state, settings) {
  if (state.mode === FOCUS) {
    const done = state.focusCount + 1
    return { mode: breakModeAfter(done, settings), focusCount: done }
  }
  return { mode: FOCUS, focusCount: state.focusCount }
}

// 「跳过」当前阶段后的状态推进（不累加完成数）
export function advanceOnSkip(state, settings) {
  if (state.mode === FOCUS) {
    return { mode: SHORT, focusCount: state.focusCount }
  }
  return { mode: FOCUS, focusCount: state.focusCount }
  void settings
}
