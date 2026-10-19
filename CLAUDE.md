# 匿名聊天室

一個不用登入的匿名聊天室：前端放 GitHub Pages，即時傳訊用 Supabase。

## 規則

- 開始任何工作前，先讀 `docs/architecture.md`；做畫面時也讀 `docs/design.md`。
- 目前在「階段二」：已接上 Supabase（`src/services/supabaseChatService.ts`）。沒有設定 Supabase 的環境變數，或網址加上 `?mock`，會改用假資料（`mockChatService.ts`）。資料庫設定在 `supabase/schema.sql`（改了要到 Supabase 的 SQL Editor 重新執行）。
- 不可以把金鑰檔案（`.env`、`.env.local` 等）commit 進 git。只有不含真實值的 `.env.example` 可以 commit。
- 收到別人送來的資料（訊息、在線登記、廣播），一律先用 `src/lib/validate.ts` 檢查格式，不合格就丟掉。
- 前端只能用 Supabase 的 Publishable key（`sb_publishable_` 開頭）。Secret key、`service_role` 金鑰和資料庫密碼絕對不能出現在專案裡。
- 畫面只能透過 `src/services/chatService.ts` 的介面跟後端溝通，不要在畫面元件裡直接呼叫 Supabase。階段二只換 `src/services/index.ts` 指向的實作。

## 指令

- `npm run dev`：本機預覽，網址是 http://localhost:5173/Ch3/ （路徑 `/Ch3/` 與 GitHub Pages 相同）。網址加 `?mock&debug` 會用假資料並出現測試工具（模擬斷線、有人進出）；加 `?trace` 會在 console 輸出 Supabase 連線過程，方便除錯。
- `npm run build`：型別檢查加打包，發佈前要先通過。
- 推上 `main` 後，`.github/workflows/deploy.yml` 會自動發佈到 GitHub Pages。
