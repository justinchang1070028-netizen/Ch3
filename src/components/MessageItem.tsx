import { collapseBlankLines, formatTime } from '../lib/format'
import type { TimelineItem } from '../types'

interface Props {
  item: TimelineItem
  self: string
}

export function MessageItem({ item, self }: Props) {
  if (item.kind === 'notice') {
    const { notice } = item
    return (
      <div className="notice">
        {notice.nickname} {notice.type === 'join' ? '進來了' : '離開了'}
      </div>
    )
  }

  const { message } = item
  const own = message.nickname === self
  return (
    <div className={own ? 'msg msg--own' : 'msg'}>
      {!own && <span className="msg__meta">{message.nickname}</span>}
      {/* 內容一律當純文字顯示（React 預設會跳脫），連結也不會變成可點的 */}
      <div className="bubble">{collapseBlankLines(message.content)}</div>
      <span className="msg__meta">{formatTime(message.createdAt)}</span>
    </div>
  )
}
