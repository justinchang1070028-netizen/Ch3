import type { ChatService } from './chatService'
import { MockChatService, type MockDebugControls } from './mockChatService'

// 階段一：使用假資料。
// 階段二：把這裡換成 supabaseChatService，並把 debugControls 設為 null。畫面程式不用改。
const mock = new MockChatService()

export const chatService: ChatService = mock
export const debugControls: MockDebugControls | null = mock.debug
