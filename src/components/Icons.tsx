import type { ReactNode } from 'react'

// 設計稿使用的內嵌圖示（描邊 2px、圓角端點），用 currentColor 上色。純裝飾，所以對讀屏軟體隱藏。

function Icon({ size = 18, strokeWidth = 2, children }: { size?: number; strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

type IconProps = { size?: number }

export const ChatIcon = ({ size = 18 }: IconProps) => (
  <Icon size={size}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
)

export const LogoutIcon = ({ size = 18 }: IconProps) => (
  <Icon size={size}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
)

export const ChevronIcon = ({ size = 16, up = false }: IconProps & { up?: boolean }) => (
  <Icon size={size}>
    <path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
  </Icon>
)

export const ArrowDownIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size} strokeWidth={2.4}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Icon>
)

export const SendIcon = ({ size = 20 }: IconProps) => (
  <Icon size={size}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </Icon>
)

export const RefreshIcon = ({ size = 18 }: IconProps) => (
  <Icon size={size}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </Icon>
)

export const AlertIcon = ({ size = 16 }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </Icon>
)
