import { RefreshIcon } from './Icons'

export function ConnectionBanner() {
  return (
    <div className="banner" role="status">
      <span className="banner__icon">
        <RefreshIcon />
      </span>
      連線中斷，重新連線中…
    </div>
  )
}
