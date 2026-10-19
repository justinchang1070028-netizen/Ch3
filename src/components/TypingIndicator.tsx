interface Props {
  /** 正在輸入的人（已排除自己） */
  names: string[]
}

/** 「○○ 正在輸入…」。永遠佔著一行的高度，出現或消失時，訊息區不會跳動 */
export function TypingIndicator({ names }: Props) {
  let text = ''
  if (names.length === 1) text = `${names[0]} 正在輸入…`
  else if (names.length === 2) text = `${names[0]}、${names[1]} 正在輸入…`
  else if (names.length > 2) text = `${names.length} 人正在輸入…`

  return (
    <div className="typing" role="status" aria-live="polite">
      {text}
    </div>
  )
}
