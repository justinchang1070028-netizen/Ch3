import { ChatRoom } from './components/ChatRoom'
import { DebugPanel } from './components/DebugPanel'
import { JoinScreen } from './components/JoinScreen'
import { useChat } from './hooks/useChat'
import { useUnreadTitle } from './hooks/useUnreadTitle'
import { chatService, debugControls } from './services'

const showDebug = new URLSearchParams(window.location.search).has('debug')

export default function App() {
  const chat = useChat(chatService)
  useUnreadTitle(chat.phase === 'room', chat.incomingCount)

  return (
    <>
      {chat.phase === 'resuming' && (
        <main className="loading" role="status">
          連線中…
        </main>
      )}
      {chat.phase === 'join' && (
        <JoinScreen busy={chat.busy} error={chat.error} onSubmit={chat.join} onEdit={chat.clearError} />
      )}
      {chat.phase === 'room' && (
        <ChatRoom
          nickname={chat.nickname}
          items={chat.items}
          members={chat.members}
          connection={chat.connection}
          onSend={chat.send}
          onLeave={chat.leave}
        />
      )}
      {showDebug && debugControls && <DebugPanel controls={debugControls} />}
    </>
  )
}
