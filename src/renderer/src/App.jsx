import { useState, useCallback } from 'react'
import { useStats } from './hooks/useStats'
import { useSettings } from './hooks/useSettings'
import TimerView from './components/TimerView'
import StatsPanel from './components/StatsPanel'
import SettingsPanel from './components/SettingsPanel'

const NOTIFY_TEXT = {
  focus: { title: '专注完成 🍅', body: '做得漂亮，起来喝口茶吧' },
  short: { title: '短休结束 🍵', body: '准备好就继续下一段专注' },
  long: { title: '长休结束 🌿', body: '状态回来了，开始新的番茄吧' }
}

export default function App() {
  const [view, setView] = useState('timer') // timer | stats | settings
  const stats = useStats()
  const { settings, ready, save, bridge } = useSettings()

  // 阶段自然走完 -> 落一条历史记录 + 发系统通知（跳过/重置不会走到这里）
  const handlePhaseComplete = useCallback(
    (info) => {
      stats.appendRecord({
        mode: info.mode,
        startedAt: info.startedAt,
        endedAt: info.at,
        durationSec: info.durationSec,
        completed: info.completed === true
      })
      const t = NOTIFY_TEXT[info.mode]
      if (t && window.electronAPI?.notify) window.electronAPI.notify(t.title, t.body)
    },
    [stats]
  )

  // 设置未就绪前不挂载计时器，否则 usePomodoro 会用默认时长初始化
  if (!ready) return <div className="stage mode-focus" />

  return (
    <>
      {/* 计时视图常挂载（非活动时隐藏），切去设置/统计不会丢倒计时 */}
      <div className={`view-host ${view !== 'timer' ? 'view-hidden' : ''}`}>
        <TimerView
          settings={settings}
          onPhaseComplete={handlePhaseComplete}
          onOpenStats={() => {
            stats.refresh()
            setView('stats')
          }}
          onOpenSettings={() => setView('settings')}
        />
      </div>

      {view === 'stats' && (
        <StatsPanel
          summary={stats.summary}
          daily={stats.daily}
          bridge={stats.bridge}
          onBack={() => {
            stats.refresh()
            setView('timer')
          }}
        />
      )}

      {view === 'settings' && (
        <SettingsPanel
          settings={settings}
          onSave={save}
          bridge={bridge}
          records={stats.records}
          onRecordsChanged={stats.refresh}
          onBack={() => setView('timer')}
        />
      )}
    </>
  )
}
