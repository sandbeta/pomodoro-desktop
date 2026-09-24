import { useState } from 'react'

// 通用二次确认弹层（危险操作用）
export default function Confirm({ text, confirmLabel = '确认', danger = true, onOk, onCancel }) {
  return (
    <div className="confirm-mask" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-text">{text}</div>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button className={danger ? 'btn-danger' : 'btn-primary btn-sm'} onClick={onOk}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [state, setState] = useState(null)
  const ask = (opts) => new Promise((resolve) => setState({ ...opts, resolve }))
  const element = state ? (
    <Confirm
      text={state.text}
      confirmLabel={state.confirmLabel}
      danger={state.danger !== false}
      onOk={() => {
        setState(null)
        state.resolve(true)
      }}
      onCancel={() => {
        setState(null)
        state.resolve(false)
      }}
    />
  ) : null
  return { ask, element }
}
