// 畫面與聊天服務共用的資料格式（對應 docs/architecture.md 第 5.1 節）

export interface Message {
  id: number
  nickname: string
  content: string
  /** ISO 時間字串。階段二由 Supabase 資料庫填入（欄位 created_at） */
  createdAt: string
}

export interface Notice {
  id: string
  type: 'join' | 'leave'
  nickname: string
  time: string
}

export type ConnectionStatus = 'connected' | 'reconnecting'

export type JoinResult = { ok: true } | { ok: false; reason: 'taken' | 'invalid' }

/** 訊息列表裡的一項：真正的訊息，或置中的進出提示 */
export type TimelineItem =
  | { kind: 'message'; message: Message }
  | { kind: 'notice'; notice: Notice }
