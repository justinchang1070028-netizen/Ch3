import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 的網址是 https://<帳號>.github.io/<repo 名稱>/，
// 所以 base 必須是 /<repo 名稱>/，否則網頁會找不到自己的 CSS 和 JS。
// 本機開發也用同一個路徑，才能提早發現路徑問題。
const REPO_NAME = 'Ch3'

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [react()],
})
