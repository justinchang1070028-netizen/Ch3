import { useCallback, useEffect, useRef, useState } from 'react'
import { clearNickname, loadNickname, saveNickname, validateNickname } from '../lib/nickname'
import type { ChatService, Unsubscribe } from '../services/chatService'
import type { ConnectionStatus, Message, TimelineItem } from '../types'

const RECENT_COUNT = 50
const TAKEN_MESSAGE = '這個代號已有人使用，請換一個'
const KICKED_MESSAGE = '連線中斷期間，這個代號被別人使用了，請重新取名'
/** 重新整理後自動進入：舊連線可能還沒被伺服器釋放，短暫重試幾次再放棄 */
const RESUME_RETRIES = 3
const RESUME_RETRY_DELAY_MS = 1500

/** join＝輸入代號畫面；resuming＝記住了代號，正在自動進入；room＝聊天室 */
export type Phase = 'join' | 'resuming' | 'room'

const toItem = (message: Message): TimelineItem => ({ kind: 'message', message })

/** 把聊天服務的結果，轉成畫面要用的狀態 */
export function useChat(service: ChatService) {
  const [phase, setPhase] = useState<Phase>(() => (loadNickname() ? 'resuming' : 'join'))
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [members, setMembers] = useState<string[]>([])
  const [connection, setConnection] = useState<ConnectionStatus>('connected')
  /** 別人送來的新訊息累計數（只算進入後的即時訊息），給分頁標題的未讀數用 */
  const [incomingCount, setIncomingCount] = useState(0)

  const unsubscribers = useRef<Unsubscribe[]>([])
  const selfRef = useRef('')
  const resumed = useRef(false)

  const unsubscribeAll = useCallback(() => {
    unsubscribers.current.forEach((unsubscribe) => unsubscribe())
    unsubscribers.current = []
  }, [])

  /** 清掉聊天室狀態，回到輸入代號畫面 */
  const backToJoin = useCallback(
    (message: string | null) => {
      unsubscribeAll()
      clearNickname()
      selfRef.current = ''
      setNickname('')
      setItems([])
      setMembers([])
      setConnection('connected')
      setIncomingCount(0)
      setError(message)
      setPhase('join')
    },
    [unsubscribeAll],
  )

  /** 進入聊天室：成功回傳 null，失敗回傳要顯示的錯誤文字 */
  const enter = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const result = await service.join(name)
        if (!result.ok) {
          return result.reason === 'taken' ? TAKEN_MESSAGE : '這個代號不能使用'
        }
        selfRef.current = name
        unsubscribeAll()
        // 先訂閱再讀歷史，才不會漏掉中間送來的訊息；重複的用編號去掉
        unsubscribers.current = [
          service.onMessage((message) => {
            setItems((prev) =>
              prev.some((item) => item.kind === 'message' && item.message.id === message.id)
                ? prev
                : [...prev, toItem(message)],
            )
            if (message.nickname !== selfRef.current) setIncomingCount((count) => count + 1)
          }),
          service.onNotice((notice) => setItems((prev) => [...prev, { kind: 'notice', notice }])),
          service.onMembers(setMembers),
          service.onConnection(setConnection),
          service.onKicked(() => backToJoin(KICKED_MESSAGE)),
        ]
        const recent = await service.loadRecent(RECENT_COUNT)
        setItems((prev) => {
          const known = new Set(
            prev.flatMap((item) => (item.kind === 'message' ? [item.message.id] : [])),
          )
          return [...recent.filter((message) => !known.has(message.id)).map(toItem), ...prev]
        })
        setNickname(name)
        saveNickname(name)
        setPhase('room')
        return null
      } catch {
        unsubscribeAll()
        return '連線失敗，請稍後再試'
      }
    },
    [service, unsubscribeAll, backToJoin],
  )

  // 重新整理後：有記住代號就自動進入
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    const stored = loadNickname()
    if (!stored) return
    void (async () => {
      let message = await enter(stored)
      for (let i = 0; i < RESUME_RETRIES && message === TAKEN_MESSAGE; i++) {
        await new Promise((resolve) => setTimeout(resolve, RESUME_RETRY_DELAY_MS))
        message = await enter(stored)
      }
      if (message) backToJoin(message)
    })()
  }, [enter, backToJoin])

  const join = useCallback(
    async (raw: string) => {
      const check = validateNickname(raw)
      if (!check.ok) {
        setError(check.message)
        return
      }
      setBusy(true)
      setError(null)
      const message = await enter(check.nickname)
      setBusy(false)
      if (message) setError(message)
    },
    [enter],
  )

  const leave = useCallback(async () => {
    unsubscribeAll()
    await service.leave()
    backToJoin(null)
  }, [service, unsubscribeAll, backToJoin])

  const send = useCallback((content: string) => service.sendMessage(content), [service])

  const clearError = useCallback(() => setError(null), [])

  return { phase, nickname, busy, error, items, members, connection, incomingCount, join, leave, send, clearError }
}
