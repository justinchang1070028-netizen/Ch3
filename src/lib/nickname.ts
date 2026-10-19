export const NICKNAME_MAX = 12

const STORAGE_KEY = 'chat.nickname'

/** 不能當代號，避免假冒系統或管理員 */
const RESERVED = ['系統', '管理員', 'system', 'admin']

/** 控制字元、零寬字元等看不見的字元 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u

/** 零寬連接符：組合表情符號（例如家庭、膚色）會用到，所以要放行 */
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d)

/** 以「字」計算長度，表情符號算 1 個（不是 JavaScript 預設的 UTF-16 單位） */
export function charCount(text: string): number {
  return Array.from(text).length
}

/** 重複檢查用：不分大小寫，全形轉半形 */
export function normalizeNickname(nickname: string): string {
  return nickname.normalize('NFKC').toLowerCase()
}

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; message: string }

export function validateNickname(raw: string): NicknameCheck {
  const nickname = raw.trim()
  if (!nickname) return { ok: false, message: '請輸入代號' }
  if (charCount(nickname) > NICKNAME_MAX) {
    return { ok: false, message: `代號最多 ${NICKNAME_MAX} 個字` }
  }
  // 放行零寬連接符（組合表情符號用），其他看不見的字元一律擋下
  if (INVISIBLE.test(nickname.split(ZERO_WIDTH_JOINER).join(''))) {
    return { ok: false, message: '代號不能包含看不見的特殊字元' }
  }
  if (RESERVED.includes(normalizeNickname(nickname))) {
    return { ok: false, message: '這個代號不能使用' }
  }
  return { ok: true, nickname }
}

// 瀏覽器可能封鎖儲存空間（無痕模式等），所以全部包 try/catch，失敗就當作沒有記住

export function loadNickname(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function saveNickname(nickname: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, nickname)
  } catch {
    /* 記不住就算了 */
  }
}

export function clearNickname(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
}
