# 匿名聊天室

一個不用登入的匿名聊天室：前端放 GitHub Pages，即時傳訊用 Supabase。

## 規則

- 開始任何工作前，先讀 `docs/architecture.md`；做畫面時也讀 `docs/design.md`。
- 目前在「階段一」：前端已完成，使用假資料（`src/services/mockChatService.ts`），不接 Supabase。
- 不可以把金鑰檔案（`.env`、`.env.local` 等）commit 進 git。只有不含真實值的 `.env.example` 可以 commit。
- 畫面只能透過 `src/services/chatService.ts` 的介面跟後端溝通，不要在畫面元件裡直接呼叫 Supabase。階段二只換 `src/services/index.ts` 指向的實作。

## 指令

- `npm run dev`：本機預覽，網址是 http://localhost:5173/Ch3/ （路徑 `/Ch3/` 與 GitHub Pages 相同）。網址加 `?debug` 會出現測試工具（模擬斷線、有人進出）。
- `npm run build`：型別檢查加打包，發佈前要先通過。
- 推上 `main` 後，`.github/workflows/deploy.yml` 會自動發佈到 GitHub Pages。
