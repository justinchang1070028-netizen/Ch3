import { useState, type ChangeEvent, type FormEvent } from 'react'
import { NICKNAME_MAX, charCount, validateNickname } from '../lib/nickname'
import { AlertIcon, ChatIcon } from './Icons'

interface Props {
  busy: boolean
  /** 來自聊天服務的錯誤，例如代號已被使用 */
  error: string | null
  onSubmit: (nickname: string) => void
  /** 使用者開始修改代號時呼叫，用來清掉舊的錯誤 */
  onEdit: () => void
}

export function JoinScreen({ busy, error, onSubmit, onEdit }: Props) {
  const [value, setValue] = useState('')
  const check = validateNickname(value)
  const canSubmit = check.ok && !busy
  // 還沒輸入時不吵使用者；輸入了但不合格，即時提示原因
  const message = error ?? (value && !check.ok ? check.message : null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // 超過 12 個字就不能再輸入（以「字」計算，表情符號算 1 個）
    setValue(Array.from(event.target.value).slice(0, NICKNAME_MAX).join(''))
    onEdit()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit) onSubmit(value)
  }

  return (
    <main className="join">
      <div className="join__card">
        <div className="join__intro">
          <div className="join__logo">
            <ChatIcon size={32} />
          </div>
          <h1 className="join__title">匿名聊天室</h1>
          <p className="join__lead">不用註冊、不用登入。取一個代號，就能和大家聊天。</p>
        </div>

        <form className="join__form" onSubmit={handleSubmit} noValidate>
          <div className="join__label-row">
            <label htmlFor="nickname" className="join__label">
              你的代號
            </label>
            <span className="join__counter">
              {charCount(value)} / {NICKNAME_MAX}
            </span>
          </div>
          <input
            id="nickname"
            className="join__input"
            type="text"
            value={value}
            onChange={handleChange}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? 'nickname-message' : undefined}
          />
          {message && (
            <p id="nickname-message" className="join__error" role="alert">
              <AlertIcon />
              {message}
            </p>
          )}
          <button type="submit" className="join__submit" disabled={!canSubmit}>
            {busy ? '連線中…' : '進入聊天室'}
          </button>
        </form>

        <p className="join__hint">
          代號為 1 到 12 個字，中文、英文、數字、表情符號都可以。
          <br />
          不能使用「系統」「管理員」「admin」等保留代號，也不能包含看不見的特殊字元。
        </p>
      </div>
    </main>
  )
}
