import { useState, useEffect, useCallback } from 'react'
import { toJson, toCsv, defaultName, fromExport, mergeRecords } from '../core/export'
import { useConfirm } from './Confirm'

// 时长类设置：本地编辑，点「保存」才落库（主进程再校验一次）
function NumField({ label, unit, value, onChange, hint }) {
  return (
    <label className="set-field">
      <span className="set-label">{label}</span>
      <span className="set-input-wrap">
        <input
          type="number"
          className="set-input"
          min={1}
          max={180}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="set-unit">{unit}</span>
      </span>
      {hint && <span className="set-hint">{hint}</span>}
    </label>
  )
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="set-field set-toggle-row">
      <span className="set-label-col">
        <span className="set-label">{label}</span>
        {desc && <span className="set-hint">{desc}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`set-switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="set-knob" />
      </button>
    </label>
  )
}

export default function SettingsPanel({ settings, onSave, onBack, bridge, records, onRecordsChanged }) {
  const [draft, setDraft] = useState({
    focus: settings.focus,
    short: settings.short,
    long: settings.long,
    longEvery: settings.longEvery
  })
  const [savedTip, setSavedTip] = useState('')
  const confirm = useConfirm()

  const dirty =
    Number(draft.focus) !== settings.focus ||
    Number(draft.short) !== settings.short ||
    Number(draft.long) !== settings.long ||
    Number(draft.longEvery) !== settings.longEvery

  const flash = (msg) => {
    setSavedTip(msg)
    setTimeout(() => setSavedTip(''), 2200)
  }

  const saveDurations = async () => {
    const ok = await onSave({
      focus: Number(draft.focus),
      short: Number(draft.short),
      long: Number(draft.long),
      longEvery: Number(draft.longEvery)
    })
    flash(ok ? '已保存 ✓' : '保存失败')
  }

  const toggleBehavior = (key, val) => onSave({ [key]: val }).then((ok) => ok && flash('已保存 ✓'))

  const doExport = async (kind) => {
    if (!records || records.length === 0) return flash('暂无记录可导出')
    const name = defaultName(kind)
    const content = kind === 'json' ? toJson(records) : toCsv(records)
    const r = await window.electronAPI.exportSave(name, content)
    if (r?.ok) flash(`已导出 ${r.path}`)
    else if (!r?.canceled) flash('导出失败')
  }

  const doClear = async () => {
    const yes = await confirm.ask({ text: '将永久删除所有专注记录，且不可恢复。确定清空吗？', confirmLabel: '确认清空' })
    if (!yes) return
    await window.electronAPI.records.clear()
    onRecordsChanged()
    flash('记录已清空')
  }

  // 历史记录文件的实际路径（自定义目录时指向那里）
  const [dataPath, setDataPath] = useState('')
  const canPickDir = typeof window !== 'undefined' && !!window.electronAPI?.data?.pickDir
  const canImport = typeof window !== 'undefined' && !!window.electronAPI?.data?.openJson

  const refreshPath = useCallback(() => {
    window.electronAPI?.records?.where?.().then((p) => setDataPath(String(p || ''))).catch(() => {})
  }, [])
  useEffect(() => {
    refreshPath()
  }, [refreshPath])

  const doImport = async () => {
    const res = await window.electronAPI.data.openJson()
    if (res?.canceled) return
    if (!res?.ok) return flash(res?.error || '无法读取该文件')
    const parsed = fromExport(res.text)
    if (!parsed.ok) return flash(parsed.error)
    if (!parsed.records.length) return flash('文件里没有可用记录')
    const cur = await window.electronAPI.records.list()
    const m = mergeRecords(cur, parsed.records)
    await window.electronAPI.records.replace(m.records)
    onRecordsChanged()
    flash(`已导入 ${m.added} 条${parsed.skipped ? ` · 跳过 ${parsed.skipped} 条不合格式` : ''}`)
  }

  // 换目录后两边可能各有记录，取并集回写，避免任何一边的历史被"切"没
  const switchDir = async (dir) => {
    const before = await window.electronAPI.records.list()
    const ok = await onSave({ dataDir: dir })
    if (!ok) return flash('切换失败')
    const after = await window.electronAPI.records.list()
    const m = mergeRecords(before, after)
    await window.electronAPI.records.replace(m.records)
    onRecordsChanged()
    refreshPath()
    flash(dir ? '记录目录已切换' : '已回到默认目录')
  }

  const doChangeDir = async () => {
    const pick = await window.electronAPI.data.pickDir()
    if (!pick?.ok) return
    await switchDir(pick.path)
  }

  // 清空后经 onRecordsChanged 通知 App 刷新统计

  return (
    <div className="settings-view">
      <div className="stats-head">
        <button className="btn-back" onClick={onBack}>
          ← 返回
        </button>
        <span className="stats-title">设置</span>
        <span className="stats-head-pad" />
      </div>

      {!bridge && <div className="set-warn">⚠️ 当前环境未连接本地存储，设置仅本次有效</div>}

      <section className="set-card">
        <h3 className="set-card-title">🍅 时长</h3>
        <div className="set-grid">
          <NumField label="专注" unit="分钟" value={draft.focus} onChange={(v) => setDraft({ ...draft, focus: v })} />
          <NumField label="短休息" unit="分钟" value={draft.short} onChange={(v) => setDraft({ ...draft, short: v })} />
          <NumField label="长休息" unit="分钟" value={draft.long} onChange={(v) => setDraft({ ...draft, long: v })} />
          <NumField label="长休节奏" unit="个" value={draft.longEvery} onChange={(v) => setDraft({ ...draft, longEvery: v })} hint="每完成几个进长休息" />
        </div>
        <button className="btn-primary btn-sm" disabled={!dirty} onClick={saveDurations}>
          保存时长
        </button>
        <p className="set-note">修改时长会在下一个番茄周期生效，不影响当前倒计时。</p>
      </section>

      <section className="set-card">
        <h3 className="set-card-title">⚙️ 行为</h3>
        <Toggle label="自动开始下一阶段" desc="番茄结束后不等待，直接进入休息" checked={settings.autoStart} onChange={(v) => toggleBehavior('autoStart', v)} />
        <Toggle label="提示音" desc="阶段结束播放合成提示音" checked={settings.sound} onChange={(v) => toggleBehavior('sound', v)} />
        <Toggle label="系统通知" desc="阶段结束弹出桌面通知，点击可唤回窗口" checked={settings.notify} onChange={(v) => toggleBehavior('notify', v)} />
        <Toggle label="关闭时最小化到托盘" desc="点窗口关闭不退出，缩到托盘继续计时" checked={settings.minimizeToTray} onChange={(v) => toggleBehavior('minimizeToTray', v)} />
      </section>

      <section className="set-card">
        <h3 className="set-card-title">📦 数据</h3>
        <div className="set-data-row">
          <button className="btn-ghost" onClick={() => doExport('json')}>导出 JSON</button>
          <button className="btn-ghost" onClick={() => doExport('csv')}>导出 CSV</button>
          {canImport && <button className="btn-ghost" onClick={doImport}>导入…</button>}
          <button className="btn-danger btn-sm" onClick={doClear}>清空记录</button>
        </div>
        <p className="set-note">共 {records?.length || 0} 条记录 · 全部保存在本机，不会上传。</p>

        {dataPath && (
          <div className="set-datadir">
            <span className="set-label">历史记录文件</span>
            <code className="set-path" title={dataPath}>{dataPath}</code>
            {canPickDir && (
              <div className="set-data-row">
                <button className="btn-ghost" onClick={doChangeDir}>改存到别的目录…</button>
                {!!settings.dataDir && <button className="btn-ghost" onClick={() => switchDir('')}>回到默认目录</button>}
              </div>
            )}
            <p className="set-note">
              把这个文件放进 Dropbox / iCloud / Syncthing 的同步目录，就能多台机器共用同一份历史，
              不需要账号也没有后端。用 OneDrive 的话请把该文件夹设为「始终保留在本设备」——
              它的「按需文件」在未下载时只是个占位符，读起来会失败。
            </p>
          </div>
        )}
      </section>

      <div className="set-foot">{savedTip}</div>

      {confirm.element}
    </div>
  )
}
