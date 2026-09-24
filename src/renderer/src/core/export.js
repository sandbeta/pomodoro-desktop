// 历史记录导出 —— 纯函数，无框架依赖（v0.2）
// 数据模型: { id, mode, startedAt, endedAt, durationSec, completed }

const MODE_CN = { focus: '专注', short: '短休息', long: '长休息' }

function localISO(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function toJson(records) {
  return JSON.stringify(
    { app: 'pomodoro-desktop', version: 1, exportedAt: localISO(Date.now()), count: records.length, records },
    null,
    2
  )
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(records) {
  const header = ['id', 'mode', 'started_at', 'ended_at', 'duration_sec', 'completed']
  const lines = [header.join(',')]
  for (const r of records) {
    lines.push(
      [
        csvCell(r.id),
        csvCell(MODE_CN[r.mode] ?? r.mode),
        csvCell(localISO(r.startedAt)),
        csvCell(localISO(r.endedAt)),
        csvCell(r.durationSec),
        r.completed ? 'true' : 'false'
      ].join(',')
    )
  }
  return lines.join('\r\n') + '\r\n'
}

// 文件名带日期，导出落盘由主进程对话框完成
export function defaultName(kind) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `番茄钟记录-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.${kind}`
}
