import type { ConnectionStatus, JoinResult, Message, Notice } from '../types'

export type Unsubscribe = () => void

/** 送出太快，被頻率限制擋下（每個代號 10 秒最多 5 則）。畫面據此提示「請稍等幾秒」 */
export class RateLimitError extends Error {
  constructor() {
    super('rate_limited')
    this.name = 'RateLimitError'
  }
}

/**
 * 聊天服務窗口：畫面和後端之間的唯一接口（docs/architecture.md 第 4、5 節）。
 *
 * 畫面只認這份約定，不知道後面是假資料還是 Supabase。
 * 階段一：mockChatService。階段二：supabaseChatService，換掉 services/index.ts 的一行即可。
 */
export interface ChatService {
  /** 用代號進入聊天室。代號已有人在線上時回傳 taken */
  join(nickname: string): Promise<JoinResult>
  /** 離開聊天室（其他人會立刻看到「離開了」，不等 30 秒） */
  leave(): Promise<void>
  /** 送出訊息。連線中斷時會失敗（丟出錯誤）；送太快會丟出 RateLimitError */
  sendMessage(content: string): Promise<void>
  /** 取得最近 N 則訊息，由舊到新 */
  loadRecent(limit: number): Promise<Message[]>

  /** 收到新訊息（包含自己送出的，不做樂觀更新） */
  onMessage(cb: (message: Message) => void): Unsubscribe
  /** 線上名單變動。訂閱當下會立刻回報一次目前名單，自己排在第一個 */
  onMembers(cb: (members: string[]) => void): Unsubscribe
  /** 進來、離開提示（已套用「斷線 30 秒才算離開」的規則） */
  onNotice(cb: (notice: Notice) => void): Unsubscribe
  /** 連線狀態變動。訂閱當下會立刻回報一次目前狀態 */
  onConnection(cb: (status: ConnectionStatus) => void): Unsubscribe
  /**
   * 斷線重連後發現代號已被別人佔走：服務已自行退出聊天室，畫面要回到輸入代號
   * （docs/architecture.md 第 6.4 節第 5 點）
   */
  onKicked(cb: () => void): Unsubscribe
  /** 通知其他人「我正在輸入」。每次輸入都可以呼叫，服務會自己節流 */
  sendTyping(): void
  /** 別人正在輸入（只在別人身上觸發，不包含自己） */
  onTyping(cb: (nickname: string) => void): Unsubscribe
}
