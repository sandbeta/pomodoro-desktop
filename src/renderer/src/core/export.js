// 历史记录导入导出 —— 纯函数，无框架依赖（v0.2 起）
// 数据模型: { id, mode, startedAt, endedAt, durationSec, completed, elapsedSec? }
// durationSec 恒为「计划时长」；elapsedSec 仅中断记录携带。
//
// 导出格式一旦让用户自己保管文件就成了公开契约，因此：版本号只增不减，
// 导入侧向下兼容，遇到不认识的高版本只警告不拒绝（字段是加出来的，不是改出来的）。

const MODE_CN = { focus: '专注', short: '短休息', long: '长休息' }
const VALID_MODES = new Set(['focus', 'short', 'long'])

export const SCHEMA_VERSION = 2
export const MAX_RECORDS = 20000

function localISO(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function toJson(records) {
  return JSON.stringify(
    { app: 'pomodoro-desktop', version: SCHEMA_VERSION, exportedAt: localISO(Date.now()), count: records.length, records },
    null,
    2
  )
}

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(records) {
  const header = ['id', 'mode', 'started_at', 'ended_at', 'duration_sec', 'elapsed_sec', 'completed']
  const lines = [header.join(',')]
  for (const r of records) {
    lines.push(
      [
        csvCell(r.id),
        csvCell(MODE_CN[r.mode] ?? r.mode),
        csvCell(localISO(r.startedAt)),
        csvCell(localISO(r.endedAt)),
        csvCell(r.durationSec),
        csvCell(r.elapsedSec ?? ''),
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

/**
 * 记录的天然身份。
 * 故意不含 id —— id 落库时取 Date.now()，两台设备同一毫秒开始一个番茄就会撞，
 * 用它去重会把另一台机器的记录当成重复丢掉。
 */
export function recordKey(r) {
  return `${r.startedAt}|${r.mode}|${r.durationSec}`
}

/** 单条记录清洗：不合法返回 null，合法则归一化字段类型 */
export function normalizeRecord(r) {
  if (!r || typeof r !== 'object') return null
  if (!VALID_MODES.has(r.mode)) return null
  if (typeof r.startedAt !== 'number' || !Number.isFinite(r.startedAt)) return null
  if (typeof r.endedAt !== 'number' || !Number.isFinite(r.endedAt)) return null
  if (typeof r.durationSec !== 'number' || !Number.isFinite(r.durationSec)) return null
  const out = {
    id: r.id === undefined || r.id === null ? String(r.startedAt) : String(r.id),
    mode: r.mode,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationSec: r.durationSec,
    completed: r.completed === true
  }
  if (typeof r.elapsedSec === 'number' && Number.isFinite(r.elapsedSec)) out.elapsedSec = r.elapsedSec
  return out
}

/**
 * 解析导出文件。接受 { app, version, records: [...] } 包装，也接受裸数组。
 * 返回 { ok, records, skipped, version, warning }，永不抛异常。
 */
export function fromExport(text) {
  let data
  try {
    data = JSON.parse(String(text ?? ''))
  } catch (e) {
    return { ok: false, error: '不是合法的 JSON 文件', records: [], skipped: 0 }
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : null
  if (!list) return { ok: false, error: '文件里找不到 records 数组', records: [], skipped: 0 }

  const records = []
  let skipped = 0
  for (const raw of list) {
    const clean = normalizeRecord(raw)
    if (clean) records.push(clean)
    else skipped++
  }

  const version = Array.isArray(data) ? SCHEMA_VERSION : Number(data.version) || 1
  const warning = version > SCHEMA_VERSION ? `文件版本 ${version} 高于本程序认识的 ${SCHEMA_VERSION}，未知字段会被忽略` : ''

  return { ok: true, records, skipped, version, warning }
}

/** 按 startedAt 取并集去重后升序排列，只保留最近 MAX_RECORDS 条 */
export function mergeRecords(existing, incoming) {
  const byKey = new Map()
  for (const r of existing || []) {
    const clean = normalizeRecord(r)
    if (clean) byKey.set(recordKey(clean), clean)
  }
  let added = 0
  for (const r of incoming || []) {
    const clean = normalizeRecord(r)
    if (!clean) continue
    const k = recordKey(clean)
    if (byKey.has(k)) continue
    byKey.set(k, clean)
    added++
  }
  const all = [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt)
  return { records: all.slice(-MAX_RECORDS), added, total: all.length }
}
