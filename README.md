# 匿名聊天室

一個不用註冊、不用登入的匿名聊天室。所有人在同一個聊天室裡，電腦和手機都能用。

**網址：https://justinchang1070028-netizen.github.io/Ch3/**

前端放在 GitHub Pages，即時傳訊用 Supabase（資料表＋Realtime）。

## 怎麼用

1. 打開網址。
2. 輸入一個代號（1 到 12 個字，中文、英文、數字、表情符號都可以）。
3. 進入聊天室，看到最近 50 則訊息和線上有誰，也可以送出訊息。
4. 想離開時按右上角的「離開」。

想自己試試多人聊天：用兩個瀏覽器分頁（或一台電腦加一支手機）打開同一個網址，各取一個代號。

## 基本功能

- 即時雙向聊天；新進來的人看得到最近 50 則訊息
- 線上名單（電腦在右側常駐，手機點「線上 N 人」展開）；有人進來或離開時，訊息區有置中的提示
- 代號重複會被擋下（不分大小寫、全形半形）
- 重新整理網頁會記住代號，自動進入
- 訊息最多 500 字；電腦 Enter 送出、Shift+Enter 換行，手機 Enter 換行、按鈕送出
- 內容只當純文字顯示（HTML、連結都不會被執行或變成可點的）
- 淺色、深色模式跟著系統設定

## 新增功能

以下是超出原本需求、額外做的（原本需求見 `docs/requirements.md`）。每一項都寫了怎麼自己驗證。

| 功能 | 說明 | 怎麼看到 |
|---|---|---|
| **正在輸入** | 別人打字時，輸入框上方顯示「○○ 正在輸入…」。對方送出訊息、離開，或停止打字約 4 秒後消失。打字時最多每 2.5 秒通知一次，不是每個字都送，節省免費額度 | 兩個分頁各進入聊天室，在其中一個輸入框打字，看另一個 |
| **發送頻率限制** | 同一個代號 10 秒內最多 5 則，第 6 則被**資料庫**擋下（不能靠繞過網頁避開；資料庫需要已執行最新的 `supabase/schema.sql`），畫面提示「送太快了，請稍等幾秒再送」，輸入框的內容保留 | 在輸入框快速連續送出 6 則 |
| **保留代號、禁止看不見的字元** | 不能使用「系統」「管理員」「system」「admin」（含全形、大小寫），也不能包含零寬字元、方向控制字元等看不見的字元。前端和資料庫都擋；輸入代號畫面下方有說明 | 在輸入代號畫面輸入「系統」或「admin」 |
| **分頁標題未讀數** | 切到別的分頁時，別人送來的新訊息會讓標題變成「(3) 匿名聊天室」，切回來恢復，自己送的不算 | 兩個分頁，其中一個切到別的分頁，在另一個送訊息，看瀏覽器分頁的標題 |
| **收到的資料先檢查格式** | 別人送來的訊息、在線登記、廣播，先檢查欄位是否齊全、型別是否正確、長度是否合格、代號是否合法（含假冒「系統」），不合格就丟掉，不顯示 | 程式在 `src/lib/validate.ts`；用 38 組惡意與錯誤資料驗證過 |
| **斷線自動重連、補漏掉的訊息** | 斷線時顯示「連線中斷，重新連線中…」，輸入框暫停；恢復後自動補上斷線期間漏掉的訊息（用訊息編號，不漏不重複） | 開著聊天室，關掉網路再打開 |
| **「離開了」提示防閃斷** | 手機常常短暫斷線又馬上連回來；斷線超過 30 秒才顯示「○○ 離開了」，30 秒內回來就當作沒離開。按「離開」按鈕則立刻通知 | 一個分頁直接關掉，另一個分頁約 30 秒後才看到提示；按「離開」則立刻看到 |
| **連續空行合併** | 有人用一堆換行洗版時，連續空行會合併 | 送出一則中間有很多空行的訊息 |

## 技術

- 前端：Vite ＋ React ＋ TypeScript
- 即時傳訊：Supabase（Postgres 資料表、Realtime 的資料庫變動通知、Presence、Broadcast）
- 部署：GitHub Pages ＋ GitHub Actions（推上 `main` 就自動發佈）
- 畫面只透過 `src/services/chatService.ts` 這個介面跟後端溝通，所以假資料版和 Supabase 版可以互換

完整的設計與理由見 [`docs/architecture.md`](docs/architecture.md)，畫面設計見 [`docs/design.md`](docs/design.md)。

## 本機開發

需要 Node.js 20 以上。

```bash
npm install
```

建立 `.env.local`（這個檔案不會被 commit），放兩個設定值：

```
VITE_SUPABASE_URL=https://你的專案代碼.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_開頭的金鑰
```

這兩個值在 Supabase 專案的「Project Settings → API Keys」，或頁面上方的 Connect 按鈕。範本在 `.env.example`。

```bash
npm run dev      # 本機預覽：http://localhost:5173/Ch3/
npm run build    # 型別檢查＋打包，發佈前要先通過
```

網址可以加參數：

| 參數 | 用途 |
|---|---|
| `?mock` | 不連 Supabase，用假資料（假使用者會自己說話、進出），可以單獨測試畫面 |
| `?mock&debug` | 假資料加上測試工具面板：模擬斷線、有人進出、有人正在輸入 |
| `?trace` | 在瀏覽器的 console 輸出連線過程，方便除錯 |

沒有設定 Supabase 的值時，會自動使用假資料。

## Supabase 設定

1. 在 [supabase.com](https://supabase.com/dashboard) 建立一個免費專案。
2. 左邊選單的 **SQL Editor** → 貼上 [`supabase/schema.sql`](supabase/schema.sql) 整份 → **Run**。這份可以重複執行。執行完會顯示一列檢查結果，預期是 `policy_count = 2`、`rls_enabled = true`、`realtime_enabled = true`、`rate_limit_enabled = true`、`check_count = 2`。
3. **Realtime → Settings** 確認「Allow public access」是開啟的（聊天室不登入，需要公開頻道）。
4. 複製專案網址與 **Publishable key**（`sb_publishable_` 開頭）。

## 部署到 GitHub Pages

1. repo 的 **Settings → Pages**，Source 選「GitHub Actions」。
2. repo 的 **Settings → Secrets and variables → Actions**，新增兩個 Secrets：`VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。
3. 推上 `main`，`.github/workflows/deploy.yml` 會自動打包並發佈。失敗時到 repo 的 **Actions** 分頁看哪一步出錯。

## 關於金鑰

- 前端**只用** Publishable key，它設計上就是公開的，安全靠資料庫規則（RLS）：任何人只能讀訊息、新增符合規則的訊息，不能修改、不能刪除。
- **Secret key（`sb_secret_` 開頭）、`service_role` 金鑰、資料庫密碼絕對不能出現在這個專案裡。**
- `.env.local` 被 `.gitignore` 擋住，不會進 git。

## 專案結構

```
src/components/   畫面元件（輸入代號、聊天室、訊息列表、線上名單、正在輸入…）
src/services/     聊天服務：介面、假資料版、Supabase 版、進出提示規則
src/hooks/        把服務的結果轉成畫面狀態；分頁標題未讀數
src/lib/          代號檢查、收到資料的格式檢查、時間格式
supabase/         資料庫設定（schema.sql）
docs/             需求、架構、畫面設計
```

## 已知限制

- 這是不登入的匿名聊天室：代號不證明身份，任何人都能用任意代號送訊息，也能偽造「某某 離開了」的提示。
- 發送頻率限制只管代號，每次換代號就能繞過。
- 在線名單的更新偶爾會慢 2 到 3 秒。
- Supabase 免費專案**一週沒有任何活動會被暫停**，之後有人打開會連不上，需要登入 Supabase 手動恢復。
- 免費額度：200 條同時連線、每月 200 萬則即時訊息（一則訊息發給 N 個人算 N 則）。

更完整的說明在 `docs/architecture.md` 第 9 節。
