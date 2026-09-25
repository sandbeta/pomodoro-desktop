import { usePomodoro } from '../hooks/usePomodoro'
import ProgressRing from './ProgressRing'
import { testChime } from '../utils/sound'

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

const EMOJI = { focus: '🍅', short: '🍵', long: '🌿' }
const RING_COLOR = { focus: '#E8685A', short: '#6BA368', long: '#5B8FB0' }

/**
 * 计时主界面。
 * 单独成组件的原因：usePomodoro 的阶段时长在首次挂载时从 settings 取初值，
 * 必须等设置从主进程加载完成后再挂载，否则用户自定义时长不生效。
 */
export default function TimerView({ settings, onPhaseComplete, onOpenStats, onOpenSettings }) {
  const p = usePomodoro(settings, onPhaseComplete)
  const litDots = p.focusCount % settings.longEvery
  // 只有真的开始跑过才谈得上「中断」；没起步时这个按钮没有意义
  const hasProgress = p.running || p.remaining !== p.total

  return (
    <div className={`stage mode-${p.mode}`}>
      <div className="halo" />

      <div className="top-actions">
        <button className="icon-btn" onClick={onOpenStats} title="查看专注统计">
          📊
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="设置">
          ⚙️
        </button>
      </div>

      <div className={`character ${p.running ? 'breathing' : ''}`} key={p.mode}>
        <span className="character-emoji">{EMOJI[p.mode]}</span>
      </div>

      <div className="dial">
        <ProgressRing progress={p.progress} color={RING_COLOR[p.mode]} size={248} stroke={16} />
        <div className="dial-center">
          <div className="dial-mode">{p.modeLabel}</div>
          <div className="dial-time">{fmt(p.remaining)}</div>
        </div>
      </div>

      <div className="controls">
        <button className="btn-primary" onClick={p.toggle}>
          {p.running ? '暂停一下' : '开始专注'}
        </button>
        <div className="controls-sub">
          <button className="btn-ghost" onClick={p.reset}>重置</button>
          {hasProgress && (
            <button className="btn-ghost" onClick={p.markInterrupted} title="记下这次被打断了，然后进入下一阶段">
              标记中断
            </button>
          )}
          <button className="btn-ghost" onClick={p.skip}>跳过</button>
        </div>
      </div>

      <div className="tomatoes">
        {Array.from({ length: settings.longEvery }).map((_, i) => (
          <span key={i} className={`tom ${i < litDots ? 'ripe' : ''}`}>
            {i < litDots ? '🍅' : '○'}
          </span>
        ))}
        <span className="ripe-count">已完成 {p.focusCount} 个</span>
      </div>

      <div className="foot-note">
        <button className="link" onClick={testChime}>试听提示音</button>
        <span className="dot-sep">·</span>
        <button className="link" onClick={p.resetCount}>重新开始一轮</button>
      </div>
    </div>
  )
}
