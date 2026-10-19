import { charCount, validateNickname } from './nickname'

export const MESSAGE_MAX = 500

/**
 * 收到別人送來的資料時，先檢查格式，合格才顯示（docs/architecture.md 第 9.1 節）。
 *
 * 為什麼要檢查：Supabase 的連線是公開的，懂技術的人可以繞過網頁，直接送格式不對的資料
 * （欄位缺少、型別錯誤、超長、假冒「系統」的代號）。資料庫的規則只管「寫進資料表」的訊息，
 * 管不到在線狀態與廣播，所以收到的一端也要自己擋。不合格的直接丟掉，不顯示、不報錯。
 */

/** 代號：字串、已去掉前後空白、1 到 12 字、沒有看不見的字元、不是保留代號 */
export function isValidNickname(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const check = validateNickname(value)
  return check.ok && check.nickname === value
}

export interface MessageRow {
  id: number
  nickname: string
  content: string
  created_at: string
}

/** 資料表的一列訊息：欄位齊全、型別正確、長度合格 */
export function isValidMessageRow(row: unknown): row is MessageRow {
  if (typeof row !== 'object' || row === null) return false
  const { id, nickname, content, created_at } = row as Record<string, unknown>
  return (
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    isValidNickname(nickname) &&
    typeof content === 'string' &&
    content.trim().length > 0 &&
    charCount(content) <= MESSAGE_MAX &&
    typeof created_at === 'string' &&
    !Number.isNaN(Date.parse(created_at))
  )
}

export interface PresenceMeta {
  nickname: string
  online_at: string
}

/** 線上成員登記的內容：有合格的代號和可解析的上線時間 */
export function isValidPresenceMeta(meta: unknown): meta is PresenceMeta {
  if (typeof meta !== 'object' || meta === null) return false
  const { nickname, online_at } = meta as Record<string, unknown>
  return isValidNickname(nickname) && typeof online_at === 'string' && !Number.isNaN(Date.parse(online_at))
}
