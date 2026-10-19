import type { ChatService } from './chatService'
import { MockChatService, type MockDebugControls } from './mockChatService'
import { SupabaseChatService } from './supabaseChatService'

// 用哪一個聊天服務：
// - 有設定 Supabase 的網址與金鑰：用真的（階段二）
// - 沒設定，或網址加上 ?mock：用假資料（階段一，方便不連線就測試畫面）
// 畫面完全不知道差別，只認 ChatService 介面。
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const forceMock = new URLSearchParams(window.location.search).has('mock')

let service: ChatService
let debug: MockDebugControls | null = null

if (url && key && !forceMock) {
  service = new SupabaseChatService(url, key)
} else {
  if (!forceMock) console.warn('沒有設定 Supabase（VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY），改用假資料')
  const mock = new MockChatService()
  service = mock
  debug = mock.debug
}

export const chatService: ChatService = service
export const debugControls: MockDebugControls | null = debug
