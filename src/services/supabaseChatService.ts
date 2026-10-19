import {
  createClient,
  type RealtimePresenceJoinPayload,
  type RealtimePresenceLeavePayload,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { normalizeNickname } from '../lib/nickname'
import type { ConnectionStatus, JoinResult, Message, Notice } from '../types'
import type { ChatService, Unsubscribe } from './chatService'
import { PresenceNotices } from './presenceNotices'

/**
 * 階段二的真聊天服務，用 Supabase（docs/architecture.md 第 3.2、5、6 節）：
 * - 訊息：資料表 messages ＋ Realtime「資料庫變動通知」（Postgres Changes）
 * - 誰在線上、進出：Realtime Presence
 * - 主動按「離開」：自訂的廣播事件 member_left，讓其他人不用等 30 秒
 */

const CHANNEL_NAME = 'chat-room'
const JOIN_TIMEOUT_MS = 10000
const SYNC_TIMEOUT_MS = 4000
const AFTER_TRACK_SYNC_MS = 1500
const BACKFILL_LIMIT = 500
const RETRY_MS = 3000

interface PresenceMeta {
  nickname: string
  online_at: string
}

interface MessageRow {
  id: number
  nickname: string
  content: string
  created_at: string
}

interface PresenceEntry {
  key: string
  nickname: string
  onlineAt: string
}

/** 除錯用：網址加上 ?trace 才會在 console 輸出連線過程 */
const trace: (...args: unknown[]) => void = new URLSearchParams(window.location.search).has('trace')
  ? (...args) => console.log('[svc]', Math.round(performance.now()), ...args)
  : () => {}

type Listeners<T> = Set<(value: T) => void>

function subscribe<T>(set: Listeners<T>, cb: (value: T) => void): Unsubscribe {
  set.add(cb)
  return () => {
    set.delete(cb)
  }
}

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  nickname: row.nickname,
  content: row.content,
  createdAt: row.created_at,
})

/** 兩人搶同一個代號時的先後順序：上線時間早的優先，時間相同就比 key，雙方算出來的結果一致 */
function compareEntries(a: { onlineAt: string; key: string }, b: { onlineAt: string; key: string }): number {
  if (a.onlineAt !== b.onlineAt) return a.onlineAt < b.onlineAt ? -1 : 1
  if (a.key !== b.key) return a.key < b.key ? -1 : 1
  return 0
}

export class SupabaseChatService implements ChatService {
  private client: SupabaseClient
  private channel: RealtimeChannel | null = null
  private self: string | null = null
  private clientId = ''
  private meta: PresenceMeta | null = null

  private connection: ConnectionStatus = 'connected'
  /** 已收到的最大訊息編號，斷線重連後用它補漏掉的訊息 */
  private lastId = 0
  /** join 全部完成，才開始顯示進出提示與名單 */
  private ready = false
  private leaving = false
  private syncedOnce = false
  private syncWaiters: Array<() => void> = []
  /** 剛按「離開」的人：之後 Presence 的 leave 事件不要再重複提示 */
  private explicitLeft = new Map<string, ReturnType<typeof setTimeout>>()
  private resyncTimer: ReturnType<typeof setTimeout> | undefined

  private messageListeners: Listeners<Message> = new Set()
  private memberListeners: Listeners<string[]> = new Set()
  private noticeListeners: Listeners<Notice> = new Set()
  private connectionListeners: Listeners<ConnectionStatus> = new Set()
  private kickedListeners: Listeners<void> = new Set()

  private notices = new PresenceNotices((notice) => {
    if (this.connection === 'connected') this.noticeListeners.forEach((cb) => cb(notice))
  })

  constructor(url: string, publishableKey: string) {
    // 不登入，所以不需要 Supabase 的登入狀態管理
    this.client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    window.addEventListener('offline', () => {
      trace('window offline, ready=', this.ready)
      if (this.ready) this.setConnection('reconnecting')
    })
    window.addEventListener('online', () => {
      trace('window online, channel.state=', this.channel?.state)
      // 網路回來了；若連線其實沒斷（沒有觸發重新連線），主動重新同步一次
      setTimeout(() => {
        if (this.ready && this.connection === 'reconnecting' && this.channel?.state === 'joined') {
          void this.resync()
        }
      }, 1000)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.ready) return
      // 手機切回來：連線可能在背景被系統中斷，補一次漏掉的訊息
      if (this.connection === 'reconnecting' && this.channel?.state === 'joined') void this.resync()
      else void this.backfill().catch(() => {})
    })
  }

  // ---- ChatService ----

  async join(nickname: string): Promise<JoinResult> {
    if (this.channel) await this.teardown()

    this.self = nickname
    this.clientId = crypto.randomUUID()
    this.meta = { nickname, online_at: new Date().toISOString() }
    this.leaving = false
    this.ready = false
    this.syncedOnce = false
    this.connection = 'connected'

    const channel = this.client.channel(CHANNEL_NAME, {
      config: { presence: { key: this.clientId }, broadcast: { self: false } },
    })
    this.channel = channel
    channel
      .on('presence', { event: 'sync' }, () => this.handleSync())
      .on('presence', { event: 'join' }, (payload) => this.handlePresenceJoin(payload))
      .on('presence', { event: 'leave' }, (payload) => this.handlePresenceLeave(payload))
      .on('broadcast', { event: 'member_left' }, ({ payload }) => this.handleMemberLeft(payload?.nickname))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
        this.handleInsert(payload.new as MessageRow),
      )

    try {
      await this.subscribeChannel(channel)
      trace('subscribed')

      // 先看看已經在線上的人，代號重複就不登記
      await this.waitForSync(SYNC_TIMEOUT_MS)
      trace('first sync done, syncedOnce=', this.syncedOnce, 'entries=', this.entries().length)
      if (this.entries().some((e) => normalizeNickname(e.nickname) === normalizeNickname(nickname))) {
        await this.teardown()
        return { ok: false, reason: 'taken' }
      }

      // 登記在線；兩人同一瞬間搶同一個代號時，登記後再確認一次，上線時間早的保留
      const synced = this.waitForNextSync(AFTER_TRACK_SYNC_MS)
      await channel.track(this.meta)
      await synced
      trace('track done, entries=', this.entries().length)
      if (this.lostNicknameRace()) {
        await this.teardown()
        return { ok: false, reason: 'taken' }
      }

      this.ready = true
      trace('ready')
      this.emitMembers()
      return { ok: true }
    } catch (error) {
      await this.teardown()
      throw error
    }
  }

  async leave(): Promise<void> {
    const channel = this.channel
    if (channel && this.ready && this.self) {
      // 先通知大家「我主動離開」，其他人就會立刻顯示提示，不用等 30 秒
      try {
        await channel.send({ type: 'broadcast', event: 'member_left', payload: { nickname: this.self } })
      } catch {
        /* 通知失敗就算了，其他人會在 30 秒後看到提示 */
      }
    }
    await this.teardown()
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.self) throw new Error('尚未進入聊天室')
    if (this.connection !== 'connected') throw new Error('連線中斷')
    trace('send start')
    // 不做樂觀更新：等 Realtime 把這筆新增事件推回來才顯示，所有人（含自己）走同一條路
    const { error } = await this.client.from('messages').insert({ nickname: this.self, content })
    trace('send done', error ? error.message : 'ok')
    if (error) throw new Error(error.message)
  }

  async loadRecent(limit: number): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('id, nickname, content, created_at')
      .order('id', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    const messages = (data as MessageRow[]).map(toMessage).reverse()
    for (const message of messages) this.lastId = Math.max(this.lastId, message.id)
    return messages
  }

  onMessage(cb: (message: Message) => void): Unsubscribe {
    return subscribe(this.messageListeners, cb)
  }

  onMembers(cb: (members: string[]) => void): Unsubscribe {
    const unsubscribe = subscribe(this.memberListeners, cb)
    if (this.ready) cb(this.members())
    return unsubscribe
  }

  onNotice(cb: (notice: Notice) => void): Unsubscribe {
    return subscribe(this.noticeListeners, cb)
  }

  onConnection(cb: (status: ConnectionStatus) => void): Unsubscribe {
    const unsubscribe = subscribe(this.connectionListeners, cb)
    cb(this.connection)
    return unsubscribe
  }

  onKicked(cb: () => void): Unsubscribe {
    return subscribe(this.kickedListeners, cb)
  }

  // ---- 連線 ----

  /** 連上頻道。第一次成功時回傳；之後的狀態變化（斷線、重連）由這裡持續處理 */
  private subscribeChannel(channel: RealtimeChannel): Promise<void> {
    return new Promise((resolve, reject) => {
      let first = true
      const timer = setTimeout(() => {
        if (!first) return
        first = false
        reject(new Error('連線逾時'))
      }, JOIN_TIMEOUT_MS)

      channel.subscribe((status, error) => {
        trace('status', status, 'first=', first, error ? String(error) : '')
        if (status === 'SUBSCRIBED') {
          if (first) {
            first = false
            clearTimeout(timer)
            resolve()
          } else if (!this.leaving) {
            void this.resync()
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (first) {
            first = false
            clearTimeout(timer)
            reject(error ?? new Error(`連線失敗（${status}）`))
          } else if (!this.leaving) {
            this.setConnection('reconnecting')
          }
        }
      })
    })
  }

  /** 重新連上後：重新登記在線、確認代號沒被佔走、補上漏掉的訊息，然後恢復正常 */
  private async resync(): Promise<void> {
    clearTimeout(this.resyncTimer)
    const channel = this.channel
    trace('resync start, ready=', this.ready, 'leaving=', this.leaving)
    if (!channel || !this.ready || this.leaving || !this.meta) return
    try {
      const synced = this.waitForNextSync(AFTER_TRACK_SYNC_MS)
      await channel.track(this.meta)
      trace('resync tracked')
      await synced
      if (this.lostNicknameRace()) {
        await this.teardown()
        this.kickedListeners.forEach((cb) => cb())
        return
      }
      await this.backfill()
      trace('resync backfilled')
      this.setConnection('connected')
      this.emitMembers()
    } catch (error) {
      trace('resync failed', String(error))
      this.resyncTimer = setTimeout(() => void this.resync(), RETRY_MS)
    }
  }

  /** 向資料庫要「編號比最後收到的還大」的訊息。用編號而不是時間，才不會漏也不會重複 */
  private async backfill(): Promise<void> {
    const { data, error } = await this.client
      .from('messages')
      .select('id, nickname, content, created_at')
      .gt('id', this.lastId)
      .order('id', { ascending: true })
      .limit(BACKFILL_LIMIT)
    if (error) throw new Error(error.message)
    for (const row of data as MessageRow[]) {
      this.lastId = Math.max(this.lastId, row.id)
      const message = toMessage(row)
      this.messageListeners.forEach((cb) => cb(message))
    }
  }

  private setConnection(status: ConnectionStatus): void {
    if (this.connection === status) return
    this.connection = status
    this.connectionListeners.forEach((cb) => cb(status))
  }

  private async teardown(): Promise<void> {
    this.leaving = true
    this.ready = false
    clearTimeout(this.resyncTimer)
    this.explicitLeft.forEach((timer) => clearTimeout(timer))
    this.explicitLeft.clear()
    this.notices.reset()
    const channel = this.channel
    this.channel = null
    if (channel) {
      try {
        await channel.untrack()
        await this.client.removeChannel(channel)
      } catch {
        /* 已經斷線也沒關係 */
      }
    }
    this.self = null
    this.meta = null
    this.syncedOnce = false
    this.syncWaiters = []
    this.lastId = 0
    this.connection = 'connected'
  }

  // ---- 在線名單（Presence）----

  private entries(): PresenceEntry[] {
    const state = this.channel?.presenceState<PresenceMeta>() ?? {}
    return Object.entries(state).flatMap(([key, metas]) =>
      metas.map((meta) => ({ key, nickname: meta.nickname, onlineAt: meta.online_at })),
    )
  }

  /** 目前線上名單：自己排第一，其他人依上線先後 */
  private members(): string[] {
    const self = this.self
    if (!self) return []
    const mine = normalizeNickname(self)
    const others = this.entries()
      .filter((e) => normalizeNickname(e.nickname) !== mine)
      .sort(compareEntries)
      .map((e) => e.nickname)
    return [self, ...Array.from(new Set(others))]
  }

  private emitMembers(): void {
    if (!this.ready || this.connection !== 'connected') return
    const members = this.members()
    this.memberListeners.forEach((cb) => cb(members))
  }

  /** 登記之後，是否輸給了同一個代號的另一個人（對方上線時間比我早） */
  private lostNicknameRace(): boolean {
    if (!this.meta) return false
    const mine = { key: this.clientId, onlineAt: this.meta.online_at }
    const wanted = normalizeNickname(this.meta.nickname)
    return this.entries().some(
      (e) => e.key !== this.clientId && normalizeNickname(e.nickname) === wanted && compareEntries(e, mine) < 0,
    )
  }

  private handleSync(): void {
    trace('presence sync, entries=', this.entries().length, 'ready=', this.ready)
    this.syncedOnce = true
    const waiters = this.syncWaiters
    this.syncWaiters = []
    waiters.forEach((resolve) => resolve())
    this.emitMembers()
  }

  /** 等到第一次拿到完整線上名單（已經拿到就立刻回來）。逾時也繼續，不卡死 */
  private waitForSync(timeoutMs: number): Promise<void> {
    return this.syncedOnce ? Promise.resolve() : this.waitForNextSync(timeoutMs)
  }

  private waitForNextSync(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(() => {
        this.syncWaiters = this.syncWaiters.filter((w) => w !== done)
        resolve()
      }, timeoutMs)
      this.syncWaiters.push(done)
    })
  }

  private handlePresenceJoin({ key, newPresences }: RealtimePresenceJoinPayload<Record<string, unknown>>): void {
    // 還沒登記完成時，連上當下會把「已經在線的人」都當成剛加入，不能提示；自己的也不提示
    trace('presence join', key === this.clientId ? 'self' : 'other', 'ready=', this.ready)
    if (!this.ready || key === this.clientId) return
    for (const meta of newPresences as unknown as PresenceMeta[]) this.notices.userJoined(meta.nickname)
  }

  private handlePresenceLeave({ key, leftPresences }: RealtimePresenceLeavePayload<Record<string, unknown>>): void {
    trace('presence leave', key === this.clientId ? 'self' : 'other', 'ready=', this.ready)
    if (!this.ready || key === this.clientId) return
    for (const meta of leftPresences as unknown as PresenceMeta[]) {
      const pending = this.explicitLeft.get(meta.nickname)
      if (pending !== undefined) {
        // 這個人剛按過「離開」，提示已經顯示了，不要重複
        clearTimeout(pending)
        this.explicitLeft.delete(meta.nickname)
        continue
      }
      this.notices.userLeft(meta.nickname)
    }
  }

  private handleMemberLeft(nickname: unknown): void {
    if (!this.ready || typeof nickname !== 'string' || nickname === this.self) return
    const previous = this.explicitLeft.get(nickname)
    if (previous !== undefined) clearTimeout(previous)
    this.explicitLeft.set(
      nickname,
      setTimeout(() => this.explicitLeft.delete(nickname), 15000),
    )
    this.notices.userLeft(nickname, true)
  }

  // ---- 訊息 ----

  private handleInsert(row: MessageRow): void {
    this.lastId = Math.max(this.lastId, row.id)
    const message = toMessage(row)
    this.messageListeners.forEach((cb) => cb(message))
  }
}
