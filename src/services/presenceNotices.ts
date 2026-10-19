import type { Notice } from '../types'

export const LEAVE_NOTICE_DELAY_MS = 30000

/**
 * 把「誰在線上」的變化，轉成「進來了／離開了」提示。
 *
 * 規則（docs/architecture.md 第 6.3 節）：
 * - 有人進來：立刻提示
 * - 有人斷線：等 30 秒才提示「離開了」；30 秒內回來就當作沒離開，什麼都不顯示
 * - 有人按「離開」：立刻提示，不等
 *
 * 假資料版和 Supabase 版都用這一份，所以階段二不用重寫這條規則。
 */
export class PresenceNotices {
  private pending = new Map<string, ReturnType<typeof setTimeout>>()
  private seq = 0

  constructor(
    private emit: (notice: Notice) => void,
    private delayMs: number = LEAVE_NOTICE_DELAY_MS,
  ) {}

  userJoined(nickname: string): void {
    const timer = this.pending.get(nickname)
    if (timer !== undefined) {
      // 30 秒內又回來了：取消離開提示，也不顯示進來提示
      clearTimeout(timer)
      this.pending.delete(nickname)
      return
    }
    this.emit(this.make('join', nickname))
  }

  userLeft(nickname: string, explicit = false): void {
    const existing = this.pending.get(nickname)
    if (explicit) {
      if (existing !== undefined) {
        clearTimeout(existing)
        this.pending.delete(nickname)
      }
      this.emit(this.make('leave', nickname))
      return
    }
    if (existing !== undefined) return
    const timer = setTimeout(() => {
      this.pending.delete(nickname)
      this.emit(this.make('leave', nickname))
    }, this.delayMs)
    this.pending.set(nickname, timer)
  }

  reset(): void {
    this.pending.forEach((timer) => clearTimeout(timer))
    this.pending.clear()
  }

  private make(type: Notice['type'], nickname: string): Notice {
    this.seq += 1
    return { id: `notice-${Date.now()}-${this.seq}`, type, nickname, time: new Date().toISOString() }
  }
}
