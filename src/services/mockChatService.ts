import { normalizeNickname } from '../lib/nickname'
import type { ConnectionStatus, JoinResult, Message, Notice } from '../types'
import type { ChatService, Unsubscribe } from './chatService'
import { PresenceNotices } from './presenceNotices'

/** 階段一的假聊天服務：全部在記憶體裡，用計時器模擬別人說話、進出。重新整理網頁就重來 */

const INITIAL_ONLINE = ['小明', '小華', '阿傑', '路人乙']
const RESERVE_NAMES = ['阿明', '小琪', '大雄', 'Amy', 'Kevin', '貓貓']
const PHRASES = [
  '大家好，有人在嗎？',
  '今天終於不下雨了。',
  '晚上有人要一起聊電影嗎？',
  '我剛下班，好累喔。',
  '推薦一下最近好聽的歌吧。',
  '哈哈哈，這也太好笑了。',
  '有人吃飽了嗎？',
  '我覺得這個聊天室滿舒服的。',
  '週末有人有計畫嗎？',
  '剛剛看到一隻超可愛的貓。',
  '咖啡還是茶？我選咖啡。',
  '晚安，明天見！',
  '今天的天空顏色很漂亮。',
  '有人玩過最近那款新遊戲嗎？',
  '這句話很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長很長，用來測試長訊息會不會自動換行。',
  'https://example.com/這是一個很長的連結只會顯示成文字不能點',
]
const HISTORY_COUNT = 60
const MAX_KEPT_MESSAGES = 500

/** 只在 ?debug 時顯示的測試按鈕，用來手動觸發難以等到的情況 */
export interface MockDebugControls {
  /** 模擬自己斷線 */
  disconnect(): void
  /** 恢復連線（並補上斷線期間漏掉的訊息） */
  reconnect(): void
  /** 一位假使用者進來 */
  fakeJoin(): void
  /** 一位假使用者斷線離開（30 秒後才會出現「離開了」提示） */
  fakeLeave(): void
  /** 一位假使用者按「離開」（立刻出現提示） */
  fakeExplicitLeave(): void
  /** 一位假使用者閃斷：8 秒後回來，不會出現任何提示 */
  fakeBlip(): void
}

type Listeners<T> = Set<(value: T) => void>

function subscribe<T>(set: Listeners<T>, cb: (value: T) => void): Unsubscribe {
  set.add(cb)
  return () => {
    set.delete(cb)
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export class MockChatService implements ChatService {
  private self: string | null = null
  private online = new Set<string>(INITIAL_ONLINE)
  private messages: Message[] = []
  private nextId = 1
  private connection: ConnectionStatus = 'connected'
  private missed: Message[] = []

  private messageListeners: Listeners<Message> = new Set()
  private memberListeners: Listeners<string[]> = new Set()
  private noticeListeners: Listeners<Notice> = new Set()
  private connectionListeners: Listeners<ConnectionStatus> = new Set()

  private notices = new PresenceNotices((notice) => {
    if (this.connection === 'connected') this.noticeListeners.forEach((cb) => cb(notice))
  })
  private speakTimer: ReturnType<typeof setTimeout> | undefined
  private churnTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.seedHistory()
  }

  // ---- ChatService ----

  async join(nickname: string): Promise<JoinResult> {
    await sleep(400)
    const wanted = normalizeNickname(nickname)
    const taken = Array.from(this.online).some((name) => normalizeNickname(name) === wanted)
    if (taken) return { ok: false, reason: 'taken' }
    this.self = nickname
    this.startActivity()
    return { ok: true }
  }

  async leave(): Promise<void> {
    this.stopActivity()
    this.notices.reset()
    this.self = null
    this.connection = 'connected'
    this.missed = []
  }

  async sendMessage(content: string): Promise<void> {
    if (this.self === null) throw new Error('尚未進入聊天室')
    if (this.connection !== 'connected') throw new Error('連線中斷')
    await sleep(120)
    this.addMessage(this.self, content)
  }

  async loadRecent(limit: number): Promise<Message[]> {
    await sleep(150)
    return this.messages.slice(-limit)
  }

  onMessage(cb: (message: Message) => void): Unsubscribe {
    return subscribe(this.messageListeners, cb)
  }

  onMembers(cb: (members: string[]) => void): Unsubscribe {
    const unsubscribe = subscribe(this.memberListeners, cb)
    cb(this.members())
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

  // ---- 測試用 ----

  readonly debug: MockDebugControls = {
    disconnect: () => {
      if (this.self === null || this.connection === 'reconnecting') return
      this.connection = 'reconnecting'
      this.connectionListeners.forEach((cb) => cb(this.connection))
    },
    reconnect: () => {
      if (this.self === null || this.connection === 'connected') return
      this.connection = 'connected'
      this.connectionListeners.forEach((cb) => cb(this.connection))
      // 補上斷線期間漏掉的訊息（階段二是向資料庫要「編號比最後收到的大」的訊息）
      const missed = this.missed
      this.missed = []
      missed.forEach((message) => this.messageListeners.forEach((cb) => cb(message)))
      this.emitMembers()
    },
    fakeJoin: () => this.fakeJoin(),
    fakeLeave: () => {
      const name = this.randomOnlineFake()
      if (!name) return
      this.online.delete(name)
      this.notices.userLeft(name)
      this.emitMembers()
    },
    fakeExplicitLeave: () => {
      const name = this.randomOnlineFake()
      if (!name) return
      this.online.delete(name)
      this.notices.userLeft(name, true)
      this.emitMembers()
    },
    fakeBlip: () => {
      const name = this.randomOnlineFake()
      if (!name) return
      this.online.delete(name)
      this.notices.userLeft(name)
      this.emitMembers()
      setTimeout(() => {
        this.online.add(name)
        this.notices.userJoined(name)
        this.emitMembers()
      }, 8000)
    },
  }

  // ---- 內部 ----

  private members(): string[] {
    return this.self === null ? Array.from(this.online) : [this.self, ...this.online]
  }

  private emitMembers(): void {
    if (this.connection !== 'connected') return
    const members = this.members()
    this.memberListeners.forEach((cb) => cb(members))
  }

  private addMessage(nickname: string, content: string, createdAt = new Date().toISOString()): Message {
    const message: Message = { id: this.nextId++, nickname, content, createdAt }
    this.messages.push(message)
    if (this.messages.length > MAX_KEPT_MESSAGES) this.messages.shift()
    if (this.connection === 'connected') {
      this.messageListeners.forEach((cb) => cb(message))
    } else {
      this.missed.push(message)
    }
    return message
  }

  private seedHistory(): void {
    const now = Date.now()
    for (let i = 0; i < HISTORY_COUNT; i++) {
      const createdAt = new Date(now - (HISTORY_COUNT - i) * 60000).toISOString()
      this.messages.push({ id: this.nextId++, nickname: pick(INITIAL_ONLINE), content: pick(PHRASES), createdAt })
    }
  }

  private randomOnlineFake(): string | undefined {
    const fakes = Array.from(this.online)
    return fakes.length > 0 ? pick(fakes) : undefined
  }

  private fakeJoin(): void {
    const me = this.self === null ? null : normalizeNickname(this.self)
    const pool = RESERVE_NAMES.filter((name) => !this.online.has(name) && normalizeNickname(name) !== me)
    if (pool.length === 0) return
    const name = pick(pool)
    this.online.add(name)
    this.notices.userJoined(name)
    this.emitMembers()
  }

  private startActivity(): void {
    this.stopActivity()
    const speak = () => {
      this.speakTimer = setTimeout(() => {
        const speaker = this.randomOnlineFake()
        if (speaker) this.addMessage(speaker, pick(PHRASES))
        speak()
      }, 4000 + Math.random() * 8000)
    }
    const churn = () => {
      this.churnTimer = setTimeout(() => {
        if (Math.random() < 0.55 && this.online.size < 7) this.fakeJoin()
        else if (this.online.size > 3) this.debug.fakeLeave()
        churn()
      }, 20000 + Math.random() * 20000)
    }
    speak()
    churn()
  }

  private stopActivity(): void {
    clearTimeout(this.speakTimer)
    clearTimeout(this.churnTimer)
  }
}
