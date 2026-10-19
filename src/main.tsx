import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// 不使用 React.StrictMode：它在開發模式會把「進入聊天室」跑兩次，
// 第二次會被自己的代號擋下（代號已有人使用）。
createRoot(document.getElementById('root')!).render(<App />)
