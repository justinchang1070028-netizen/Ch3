import { useEffect, useState } from 'react'
import type { ConnectionStatus, TimelineItem } from '../types'
import { ConnectionBanner } from './ConnectionBanner'
import { ChevronIcon, LogoutIcon } from './Icons'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'
import { OnlineList } from './OnlineList'

interface Props {
  nickname: string
  items: TimelineItem[]
  members: string[]
  connection: ConnectionStatus
  onSend: (content: string) => Promise<void>
  onLeave: () => void
}

export function ChatRoom({ nickname, items, members, connection, onSend, onLeave }: Props) {
  // 手機版線上名單是否展開（電腦版名單常駐，這個狀態沒作用）
  const [onlineOpen, setOnlineOpen] = useState(false)
  const offline = connection === 'reconnecting'

  useEffect(() => {
    if (!onlineOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOnlineOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onlineOpen])

  return (
    <div className="room">
      <div className="room__main">
        <header className="topbar">
          <h1 className="topbar__title">匿名聊天室</h1>
          <div className="topbar__actions">
            <button
              type="button"
              className={onlineOpen ? 'online-toggle is-open' : 'online-toggle'}
              aria-expanded={onlineOpen}
              aria-controls="online-list"
              aria-label={`${onlineOpen ? '收起' : '展開'}線上名單，目前線上 ${members.length} 人`}
              onClick={() => setOnlineOpen((open) => !open)}
            >
              <span className="online__dot" aria-hidden="true" />
              線上 {members.length} 人
              <ChevronIcon up={onlineOpen} />
            </button>
            <button type="button" className="leave" onClick={onLeave}>
              <LogoutIcon />
              離開
            </button>
          </div>
        </header>

        {offline && <ConnectionBanner />}

        <MessageList items={items} self={nickname} />
        <MessageInput disabled={offline} onSend={onSend} />
      </div>

      {onlineOpen && (
        <button
          type="button"
          className="scrim"
          aria-label="關閉線上名單"
          tabIndex={-1}
          onClick={() => setOnlineOpen(false)}
        />
      )}
      <OnlineList members={members} self={nickname} open={onlineOpen} />
    </div>
  )
}
