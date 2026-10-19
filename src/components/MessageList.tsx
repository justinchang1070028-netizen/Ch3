import { useLayoutEffect, useRef, useState } from 'react'
import type { TimelineItem } from '../types'
import { ArrowDownIcon } from './Icons'
import { MessageItem } from './MessageItem'

/** 距離底部小於這個距離，就算「在最底部」 */
const BOTTOM_THRESHOLD = 80

interface Props {
  items: TimelineItem[]
  self: string
}

export function MessageList({ items, self }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const seen = useRef(0)
  const [unseen, setUnseen] = useState(0)

  function scrollToBottom(smooth = false) {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  function handleScroll() {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    if (atBottom.current) setUnseen(0)
  }

  useLayoutEffect(() => {
    const added = items.slice(seen.current)
    const isFirst = seen.current === 0
    seen.current = items.length
    if (added.length === 0) return

    const sentByMe = added.some((item) => item.kind === 'message' && item.message.nickname === self)
    if (isFirst || atBottom.current || sentByMe) {
      // 在最底部、剛進來、或是自己剛送出：捲到最新
      scrollToBottom()
      atBottom.current = true
    } else {
      // 正在看舊訊息：不拉走畫面，改顯示「有新訊息」按鈕
      const newMessages = added.filter((item) => item.kind === 'message').length
      if (newMessages > 0) setUnseen((count) => count + newMessages)
    }
  }, [items, self])

  return (
    <div className="messages">
      <div className="messages__scroll" ref={scroller} onScroll={handleScroll} role="log" aria-label="聊天訊息">
        {items.length === 0 ? (
          <div className="messages__empty">
            <p>還沒有人說話，來打聲招呼吧</p>
          </div>
        ) : (
          items.map((item) => (
            <MessageItem
              key={item.kind === 'message' ? `m${item.message.id}` : item.notice.id}
              item={item}
              self={self}
            />
          ))
        )}
      </div>
      {unseen > 0 && (
        <button
          type="button"
          className="new-messages"
          onClick={() => {
            scrollToBottom(true)
            setUnseen(0)
          }}
        >
          有新訊息
          <ArrowDownIcon />
        </button>
      )}
    </div>
  )
}
