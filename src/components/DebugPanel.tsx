import { useState } from 'react'
import type { MockDebugControls } from '../services/mockChatService'

/** 只有網址加上 ?debug 才會出現，用來手動觸發很難等到的情況（階段一的測試工具） */
export function DebugPanel({ controls }: { controls: MockDebugControls }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="debug">
      <button type="button" className="debug__toggle" onClick={() => setOpen((value) => !value)}>
        測試工具 {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="debug__body">
          <button type="button" onClick={controls.disconnect}>
            我斷線
          </button>
          <button type="button" onClick={controls.reconnect}>
            我恢復連線
          </button>
          <button type="button" onClick={controls.fakeTyping}>
            有人正在輸入
          </button>
          <button type="button" onClick={controls.fakeJoin}>
            有人進來
          </button>
          <button type="button" onClick={controls.fakeLeave}>
            有人斷線（30 秒後提示）
          </button>
          <button type="button" onClick={controls.fakeExplicitLeave}>
            有人按離開（立刻提示）
          </button>
          <button type="button" onClick={controls.fakeBlip}>
            有人閃斷（8 秒回來，無提示）
          </button>
        </div>
      )}
    </div>
  )
}
