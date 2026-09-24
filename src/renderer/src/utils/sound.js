// 用 Web Audio API 现场合成柔和提示音，不依赖任何外部音频文件（开源友好）
let ctx = null

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/**
 * 播放一声柔和的提示音
 * @param {'done'|'break'} type  done=专注结束(上扬的三音), break=休息结束(回落双音)
 */
export function playChime(type = 'done') {
  const ac = ensureCtx()
  if (!ac) return
  try {
    if (ac.state === 'suspended') ac.resume()
    const now = ac.currentTime
    const freqs = type === 'done' ? [523.25, 659.25, 783.99] : [659.25, 523.25]
    freqs.forEach((f, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const t = now + i * 0.13
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  } catch (e) {
    // 忽略音频错误，绝不因提示音崩溃主流程
  }
}

// 供用户手动试听 / 测试
export function testChime() {
  playChime('done')
}
