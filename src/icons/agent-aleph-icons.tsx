import type { SVGProps } from 'react'

export type AlephIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  color?: string
  strokeWidth?: number
}

function AlephIcon({
  size = 18,
  color = 'currentColor',
  strokeWidth = 1.7,
  children,
  ...props
}: AlephIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

const Dots = ({ y = 16 }: { y?: number }) => (
  <>
    <circle cx="18" cy={y} r="1.6" fill="currentColor" stroke="none" opacity="0.8" />
    <circle cx="25" cy={y} r="1.6" fill="currentColor" stroke="none" opacity="0.55" />
    <circle cx="32" cy={y} r="1.6" fill="currentColor" stroke="none" opacity="0.35" />
  </>
)

export function AgentIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M32 10 52 21v22L32 54 12 43V21Z" />
      <path d="M12 21 32 32 52 21" />
      <path d="M32 32v22" />
      <circle cx="32" cy="41" r="2.2" fill="currentColor" stroke="none" />
    </AlephIcon>
  )
}

export function CodeIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="10" y="13" width="44" height="38" rx="4" />
      <path d="M10 22h44" />
      <Dots y={17} />
      <path d="m28 31-8 7 8 7" />
      <path d="m36 31 8 7-8 7" />
      <path d="m34 29-6 18" />
    </AlephIcon>
  )
}

export function CliIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="13" y="15" width="38" height="36" rx="5" />
      <path d="m24 29 9 7-9 7" />
      <path d="M36 43h10" />
    </AlephIcon>
  )
}

export function RobotIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M32 11v8" />
      <circle cx="32" cy="9" r="2.5" />
      <rect x="16" y="21" width="36" height="30" rx="8" />
      <path d="M16 32h-5v9h5" />
      <path d="M52 32h5v9h-5" />
      <rect x="24" y="33" width="6" height="5" rx="1.2" />
      <rect x="38" y="33" width="6" height="5" rx="1.2" />
      <path d="M28 45h12" />
    </AlephIcon>
  )
}

export function NexusShellIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M36 7 17 36h18l-7 21 19-31H30Z" />
    </AlephIcon>
  )
}

export function TerminalWindowIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="10" y="13" width="44" height="38" rx="4" />
      <path d="M10 23h44" />
      <Dots y={18} />
      <path d="m22 34 8 6-8 6" />
      <path d="M35 46h11" />
    </AlephIcon>
  )
}

export function CommandIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="10" y="13" width="44" height="38" rx="4" />
      <path d="M10 23h44" />
      <Dots y={18} />
      <path d="M20 38h6" />
      <path d="M31 38h9" />
      <path d="M45 38h4" />
    </AlephIcon>
  )
}

export function SessionIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="18" y="20" width="28" height="28" rx="4" />
      <path d="M24 15h26v26" opacity="0.7" />
      <path d="M29 10h26v26" opacity="0.42" />
    </AlephIcon>
  )
}

export function BroadcastIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" />
      <path d="M22 22a14 14 0 0 0 0 20" />
      <path d="M44 22a14 14 0 0 1 0 20" />
      <path d="M14 15a26 26 0 0 0 0 34" opacity="0.7" />
      <path d="M52 15a26 26 0 0 1 0 34" opacity="0.7" />
    </AlephIcon>
  )
}

export function Layout1x1Icon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="17" y="17" width="30" height="30" rx="3" />
    </AlephIcon>
  )
}

export function Layout1x2Icon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="14" y="17" width="38" height="30" rx="3" />
      <path d="M33 17v30" />
    </AlephIcon>
  )
}

export function Layout2x1Icon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="17" y="14" width="30" height="38" rx="3" />
      <path d="M17 33h30" />
    </AlephIcon>
  )
}

export function LayoutGridIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="13" y="13" width="17" height="17" rx="2.5" />
      <rect x="34" y="13" width="17" height="17" rx="2.5" />
      <rect x="13" y="34" width="17" height="17" rx="2.5" />
      <rect x="34" y="34" width="17" height="17" rx="2.5" />
    </AlephIcon>
  )
}

export function Layout3x3Icon(props: AlephIconProps) {
  const cells = [13, 26, 39]
  return (
    <AlephIcon {...props}>
      {cells.map((x) =>
        cells.map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="10" height="10" rx="1.8" />)
      )}
    </AlephIcon>
  )
}

export function DarkModeIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M42 50a22 22 0 0 1-7-43 22 22 0 1 0 20 27 22 22 0 0 1-13 16Z" />
      <path d="M49 13v6" />
      <path d="M46 16h6" />
      <path d="M40 21v4" />
      <path d="M38 23h4" />
    </AlephIcon>
  )
}

export function LightModeIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <circle cx="32" cy="32" r="11" />
      <path d="M32 8v7" />
      <path d="M32 49v7" />
      <path d="M8 32h7" />
      <path d="M49 32h7" />
      <path d="m15 15 5 5" />
      <path d="m44 44 5 5" />
      <path d="m49 15-5 5" />
      <path d="m20 44-5 5" />
    </AlephIcon>
  )
}

export function SearchIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <circle cx="28" cy="28" r="16" />
      <path d="m40 40 14 14" />
    </AlephIcon>
  )
}

export function CopyIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <rect x="13" y="13" width="24" height="24" rx="3" />
      <rect x="27" y="27" width="24" height="24" rx="3" />
    </AlephIcon>
  )
}

export function DownloadIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M32 10v28" />
      <path d="m20 27 12 12 12-12" />
      <path d="M14 49h38" />
      <path d="M14 40v9" />
      <path d="M52 40v9" />
    </AlephIcon>
  )
}

export function CloseIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M16 16 48 48" />
      <path d="M48 16 16 48" />
    </AlephIcon>
  )
}

export function SettingsIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M32 9 44 16v14l8 6-8 14-12 7-12-7-8-14 8-6V16Z" />
      <circle cx="32" cy="32" r="8" />
    </AlephIcon>
  )
}

export function FolderIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M9 20h18l5 6h23v27H9Z" />
      <path d="M9 20v-6h17l5 6" />
    </AlephIcon>
  )
}

export function PlayIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M22 14v36l30-18Z" />
    </AlephIcon>
  )
}

export function RefreshIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M50 26a18 18 0 0 0-31-10l-5 5" />
      <path d="M14 12v9h9" />
      <path d="M14 38a18 18 0 0 0 31 10l5-5" />
      <path d="M50 52v-9h-9" />
    </AlephIcon>
  )
}

export function SaveIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M14 12h34l6 6v40H14Z" />
      <path d="M22 12v16h24" />
      <path d="M22 58V39h28v19" />
    </AlephIcon>
  )
}

export function BookmarkIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M18 10h28v45L32 45 18 55Z" />
    </AlephIcon>
  )
}

export function CheckIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="m14 34 13 13 23-30" />
    </AlephIcon>
  )
}

export function AlertIcon(props: AlephIconProps) {
  return (
    <AlephIcon {...props}>
      <path d="M32 8 58 54H6Z" />
      <path d="M32 23v15" />
      <circle cx="32" cy="46" r="1.8" fill="currentColor" stroke="none" />
    </AlephIcon>
  )
}
