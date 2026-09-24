export default function ProgressRing({
  progress = 0,
  size = 240,
  stroke = 14,
  color = '#E8685A',
  track = 'rgba(74,59,51,0.08)'
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * Math.min(1, Math.max(0, progress))
  return (
    <svg width={size} height={size} className="ring">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          className="ring-fill"
        />
      </g>
    </svg>
  )
}
