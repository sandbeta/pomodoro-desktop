import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { fmtDuration } from '../core/stats'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const CARDS = [
  { key: 'today', label: '今日', emoji: '🌅' },
  { key: 'week', label: '本周', emoji: '🌿' },
  { key: 'month', label: '本月', emoji: '🍀' }
]

// summary/daily/interrupt/bridge 由父级进入本页时刷新后传入（App 的 view-stats 分支）
export default function StatsPanel({ summary, daily, interrupt, onBack, bridge }) {
  const chartData = useMemo(
    () => ({
      labels: daily.map((d) => d.label),
      datasets: [
        {
          label: '专注分钟',
          data: daily.map((d) => Math.round(d.minutes)),
          backgroundColor: 'rgba(232, 104, 90, 0.55)',
          hoverBackgroundColor: 'rgba(232, 104, 90, 0.8)',
          borderRadius: 8,
          maxBarThickness: 30
        }
      ]
    }),
    [daily]
  )

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(74, 59, 51, 0.85)',
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const d = daily[ctx.dataIndex]
              return `${d.count} 个番茄 · ${fmtDuration(d.minutes)}`
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: 'rgba(74,59,51,0.5)', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(74,59,51,0.06)' },
          border: { display: false },
          ticks: {
            color: 'rgba(74,59,51,0.4)',
            font: { size: 10 },
            stepSize: 30,
            callback: (v) => (v >= 60 ? `${v / 60}h` : `${v}m`)
          }
        }
      }
    }),
    [daily]
  )

  const totalCount = daily.reduce((s, d) => s + d.count, 0)
  const hasData = totalCount > 0

  return (
    <div className="stats-view">
      <div className="stats-head">
        <button className="btn-back" onClick={onBack}>
          ← 返回
        </button>
        <span className="stats-title">专注统计</span>
        <span className="stats-head-pad" />
      </div>

      <div className="stats-cards">
        {CARDS.map((c) => (
          <div className="stat-card" key={c.key}>
            <div className="stat-card-label">
              <span className="stat-emoji">{c.emoji}</span>
              {c.label}
            </div>
            <div className="stat-card-num">{summary[c.key].count}</div>
            <div className="stat-card-sub">
              {summary[c.key].count > 0 ? `专注 ${fmtDuration(summary[c.key].minutes)}` : '继续加油'}
            </div>
          </div>
        ))}
      </div>

      <div className="stats-chart-card">
        <div className="stats-chart-title">近 7 天专注（分钟）</div>
        {hasData ? (
          <div className="stats-chart-box">
            <Bar data={chartData} options={options} />
          </div>
        ) : (
          <div className="stats-empty">
            <div className="stats-empty-emoji">🌱</div>
            <div>还没有走完的番茄</div>
            <div className="stats-empty-sub">完成第一个番茄后，这里会长出小图表</div>
          </div>
        )}
      </div>

      {interrupt && interrupt.total > 0 && (
        <div className="stats-interrupt">
          <div className="stats-interrupt-figure">
            <span className="stats-interrupt-num">{interrupt.interrupted}</span>
            <span className="stats-interrupt-unit">次专注被打断<em>近 7 天</em></span>
          </div>
          <p className="stats-interrupt-note">
            {interrupt.interrupted === 0
              ? '没有一个番茄中途断掉，这很难得。'
              : interrupt.peakMinute
                ? `多数倒在第 ${interrupt.peakMinute} 分钟。那个点通常不是你不够专心，是真的有事来了。`
                : '被打断的时刻很零散，说明干扰还没成规律 —— 先记着，别急着改。'}
          </p>
        </div>
      )}

      {!bridge && <div className="stats-hint">⚠️ 当前环境未连接到本地存储，统计仅供预览</div>}
    </div>
  )
}
