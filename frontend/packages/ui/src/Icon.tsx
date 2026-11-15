import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "arrow-right"
  | "arrow-left"
  | "check"
  | "close"
  | "alert"
  | "info"
  | "clock"
  | "pin"
  | "map"
  | "wifi-off"
  | "wifi"
  | "download"
  | "print"
  | "user"
  | "users"
  | "shield"
  | "chart"
  | "leaf"
  | "plus"
  | "trash"
  | "edit"
  | "menu"
  | "phone"
  | "lock"
  | "file"
  | "search"
  | "refresh"
  | "send"
  | "rain"
  | "cloud"
  | "sun"
  | "chevron-down"
  | "chevron-right"
  | "globe"
  | "sprout"
  | "logout"
  | "key"
  | "sparkle"
  | "warning"
  | "play";

const PATHS: Record<IconName, ReactNode> = {
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5m6 6-6-6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 3.5 2.8 20h18.4L12 3.5Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3.5 2.8 20h18.4L12 3.5Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.6" r="0.7" fill="currentColor" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="M2 8.5a16 16 0 0 1 6-3.2M14 5.1a16 16 0 0 1 8 3.4M5 12a11 11 0 0 1 4.2-2.1M15 9.9A11 11 0 0 1 19 12M8.5 15.5a6 6 0 0 1 4-1.3M2 2l20 20" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" />
    </>
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M17 14a6 6 0 0 1 4.5 6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.8 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6M20 16V6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z" />
      <path d="M4 21c2-5 6-8 11-10" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13C8 13 5 10.5 5 6c4 0 7 2.5 7 7Z" />
      <path d="M12 11c3.5 0 6-2 6-6-3.5 0-6 2-6 6Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m14 6 4 4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  send: <path d="M4 12 21 4l-6 17-3.5-7L4 12Z" />,
  rain: (
    <>
      <path d="M6 15a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1A3.5 3.5 0 0 1 18 15H6Z" />
      <path d="M8 18v2M12 18v3M16 18v2" />
    </>
  ),
  cloud: <path d="M6 17a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1A3.5 3.5 0 0 1 18 17H6Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M17 17l2-2M14 14l2-2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </>
  ),
  play: <path d="M8 5v14l11-7L8 5Z" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  title?: string;
}

export const Icon = ({ name, size = 20, title, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
    {...props}
  >
    {title ? <title>{title}</title> : null}
    {PATHS[name]}
  </svg>
);

