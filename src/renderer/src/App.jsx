import { useState, useCallback } from 'react'
import { usePomodoro, DEFAULT_SETTINGS } from './hooks/usePomodoro'
import { useStats } from './hooks/useStats'
import ProgressRing from './components/ProgressRing'
import StatsPanel from './components/StatsPanel'
import { testChime } from './utils/sound'

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

const EMOJI = { focus: '🍅', short: '🍵', long: '🌿' }
const RING_COLOR = { focus: '#E8685A', short: '#6BA368', long: '#5B8FB0' }

export default function App() {
  const [view, setView] = useState('timer') // timer | stats
  const stats = useStats()

  // M4: 阶段自然走完 -> 落一条历史记录（跳过/重置不会走到这里）
  const handlePhaseComplete = useCallback(
    (info) => {
      stats.appendRecord({
        mode: info.mode,
        startedAt: info.startedAt,
        endedAt: info.at,
        durationSec: info.durationSec,
        completed: info.completed === true
      })
    },
    [stats]
  )

  const p = usePomodoro(DEFAULT_SETTINGS, handlePhaseComplete)

  const litDots = p.focusCount % DEFAULT_SETTINGS.longEvery

  if (view === 'stats') {
    return (
      <StatsPanel
        summary={stats.summary}
        daily={stats.daily}
        bridge={stats.bridge}
        onBack={() => {
          setView('timer')
          stats.refresh()
        }}
      />
    )
  }

  return (
    <div className={`stage mode-${p.mode}`}>
      <div className="halo" />

      <button
        className="stats-toggle"
        onClick={() => {
          stats.refresh() // 进统计页总是拿最新数据
          setView('stats')
        }}
        title="查看专注统计"
      >
        📊 统计
      </button>

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
          <button className="btn-ghost" onClick={p.skip}>跳过</button>
        </div>
      </div>

      <div className="tomatoes">
        {Array.from({ length: DEFAULT_SETTINGS.longEvery }).map((_, i) => (
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
