interface Props {
  members: string[]
  self: string
  /** 手機版：名單是否展開。電腦版一律顯示，不受影響 */
  open: boolean
}

export function OnlineList({ members, self, open }: Props) {
  return (
    <aside id="online-list" className={open ? 'online is-open' : 'online'} aria-label="線上名單">
      <h2 className="online__title">線上 ({members.length})</h2>
      <ul className="online__list">
        {members.map((name) => {
          const isSelf = name === self
          return (
            <li key={name} className={isSelf ? 'online__item online__item--self' : 'online__item'}>
              <span className="online__dot" aria-hidden="true" />
              {name}
              {isSelf && '（你）'}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
