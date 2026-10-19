/** 顯示用的時間，例如 14:32 */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 連續很多個空行，只留下一個空行，避免有人用換行洗掉版面 */
export function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n')
}
