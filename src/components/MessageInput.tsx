import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { charCount } from '../lib/nickname'
import { MESSAGE_MAX } from '../lib/validate'
import { RateLimitError } from '../services/chatService'
import { SendIcon } from './Icons'

interface Props {
  /** 斷線時暫停輸入 */
  disabled: boolean
  onSend: (content: string) => Promise<void>
  /** 使用者正在輸入時呼叫（服務會自己節流） */
  onTyping: () => void
}

export function MessageInput({ disabled, onSend, onTyping }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  const length = charCount(text.trim())
  const over = length - MESSAGE_MAX
  const canSend = !disabled && !sending && length > 0 && over <= 0

  // 輸入框隨內容長高（有上限），超過就在框內捲動
  useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])

  async function submit() {
    if (!canSend) return
    setSending(true)
    setFailure(null)
    try {
      await onSend(text.trim())
      setText('')
    } catch (error) {
      // 保留輸入的內容，讓使用者可以再送一次
      setFailure(error instanceof RateLimitError ? '送太快了，請稍等幾秒再送' : '送出失敗，請再試一次')
    } finally {
      setSending(false)
      field.current?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    // 中文輸入法選字時按 Enter 是「確認選字」，不是送出
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    // 手機（觸控裝置）：Enter 換行，用按鈕送出。電腦：Enter 送出
    if (window.matchMedia('(pointer: coarse)').matches) return
    event.preventDefault()
    void submit()
  }

  return (
    <div className="composer">
      {over > 0 && (
        <p className="composer__over" role="alert">
          超過 {over} 字（-{over}）
        </p>
      )}
      {failure && (
        <p className="composer__over" role="alert">
          {failure}
        </p>
      )}
      <div className="composer__row">
        <textarea
          ref={field}
          className={over > 0 ? 'composer__field is-over' : 'composer__field'}
          rows={1}
          value={text}
          disabled={disabled}
          aria-label="訊息內容"
          aria-invalid={over > 0 ? true : undefined}
          placeholder={disabled ? '連線中斷，暫時無法輸入' : '輸入訊息…'}
          onChange={(event) => {
            setText(event.target.value)
            setFailure(null)
            if (event.target.value.trim()) onTyping()
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="composer__send"
          disabled={!canSend}
          aria-label={disabled ? '送出訊息（目前無法使用）' : '送出訊息'}
          onClick={() => void submit()}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
