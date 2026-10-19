import { useEffect, useRef } from 'react'

const BASE_TITLE = '匿名聊天室'

/**
 * 分頁在背景時，別人送來新訊息，網頁標題顯示未讀數，例如「(3) 匿名聊天室」；
 * 切回來就清掉。自己送的訊息不算（呼叫端只累計別人的）。
 */
export function useUnreadTitle(active: boolean, incomingCount: number): void {
  const unread = useRef(0)
  const previous = useRef(incomingCount)

  useEffect(() => {
    const apply = () => {
      document.title = unread.current > 0 ? `(${unread.current}) ${BASE_TITLE}` : BASE_TITLE
    }

    const delta = incomingCount - previous.current
    previous.current = incomingCount

    if (!active) {
      unread.current = 0
      apply()
      return
    }
    if (delta > 0 && document.visibilityState === 'hidden') {
      unread.current += delta
      apply()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        unread.current = 0
        apply()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [active, incomingCount])
}
