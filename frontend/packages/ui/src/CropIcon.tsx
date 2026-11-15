import type { CropCode } from "@nextcrop/api-client";
import type { ReactNode } from "react";

const SHAPES: Record<CropCode, ReactNode> = {
  maize: (
    <>
      <path d="M20 6c0 8-4 14-8 14S6 17 6 11c0-3 2-5 4-5s2 2 2 2 1-3 3-3 5 1 5 1Z" fill="currentColor" opacity="0.22" />
      <path d="M14 6c-2 4-3 8-3 13M10 8c3 1 5 3 6 6M17 8c-2 3-3 6-3 9" />
      <path d="M14 4c3 1 5 4 5 8s-2 7-5 8" />
    </>
  ),
  sorghum: (
    <>
      <path d="M12 21V9" />
      <path d="M12 11c-3 0-5-2-5-5 3 0 5 2 5 5Zm0 0c3 0 5-2 5-5-3 0-5 2-5 5Z" fill="currentColor" opacity="0.24" />
      <circle cx="9" cy="4.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="3" r="1.2" fill="currentColor" />
      <circle cx="15" cy="4.5" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" />
      <circle cx="13.5" cy="7" r="1" fill="currentColor" />
    </>
  ),
  finger_millet: (
    <>
      <path d="M12 21V10" />
      <path d="M12 11c-2-1-3-3-3-6M12 11c0-2 1-4 3-6M12 13c-2 0-4-1-5-3M12 13c2 0 4-1 5-3M12 16c-2 0-3-1-4-2M12 16c2 0 3-1 4-2" />
      <circle cx="9" cy="5" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="15" cy="5" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="7" cy="10" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="17" cy="10" r="1.4" fill="currentColor" opacity="0.55" />
    </>
  ),
  soya: (
    <>
      <path d="M5 5c5 0 12 4 14 14-8 1-13-5-14-14Z" fill="currentColor" opacity="0.2" />
      <path d="M5 5c5 0 12 4 14 14-8 1-13-5-14-14Z" />
      <circle cx="10" cy="9" r="1.6" fill="currentColor" opacity="0.7" />
      <circle cx="13" cy="12.5" r="1.6" fill="currentColor" opacity="0.7" />
      <circle cx="15.5" cy="16" r="1.6" fill="currentColor" opacity="0.7" />
    </>
  ),
  groundnut: (
    <>
      <path d="M7 9c-2 2-2 5 0 7s4 1 5-1c1 2 3 3 5 1s2-5 0-7-4-1-5 1c-1-2-3-3-5-1Z" fill="currentColor" opacity="0.2" />
      <path d="M7 9c-2 2-2 5 0 7s4 1 5-1c1 2 3 3 5 1s2-5 0-7-4-1-5 1c-1-2-3-3-5-1Z" />
      <path d="M8.5 11.5c.7-.7 1.6-.7 2.3 0M13.2 13c.7-.7 1.6-.7 2.3 0" />
    </>
  ),
  bean: (
    <>
      <path d="M4 15c2-7 8-11 16-9-1 8-7 13-16 9Z" fill="currentColor" opacity="0.2" />
      <path d="M4 15c2-7 8-11 16-9-1 8-7 13-16 9Z" />
      <ellipse cx="9" cy="13.5" rx="1.7" ry="2.2" fill="currentColor" opacity="0.6" transform="rotate(-25 9 13.5)" />
      <ellipse cx="13" cy="10.5" rx="1.7" ry="2.2" fill="currentColor" opacity="0.6" transform="rotate(-25 13 10.5)" />
      <ellipse cx="16.5" cy="8.5" rx="1.5" ry="2" fill="currentColor" opacity="0.6" transform="rotate(-25 16.5 8.5)" />
    </>
  ),
  cowpea: (
    <>
      <path d="M5 4c8 1 13 7 12 15" />
      <path d="M5 4c8 1 13 7 12 15" strokeDasharray="2 2" />
      <circle cx="7.5" cy="7" r="1.4" fill="currentColor" opacity="0.6" />
      <circle cx="10" cy="10.5" r="1.4" fill="currentColor" opacity="0.6" />
      <circle cx="12.5" cy="14" r="1.4" fill="currentColor" opacity="0.6" />
      <circle cx="14.5" cy="17.5" r="1.4" fill="currentColor" opacity="0.6" />
    </>
  ),
  simsim: (
    <>
      <path d="M12 21V6" />
      <path d="M12 13c-3 0-4-2-4-4 2 0 4 1 4 4Zm0 0c3 0 4-2 4-4-2 0-4 1-4 4Zm0-4c-2-1-3-3-3-5 2 0 3 2 3 5Zm0 0c2-1 3-3 3-5-2 0-3 2-3 5Z" fill="currentColor" opacity="0.2" />
      <path d="M12 13c-3 0-4-2-4-4 2 0 4 1 4 4Zm0 0c3 0 4-2 4-4-2 0-4 1-4 4Zm0-4c-2-1-3-3-3-5 2 0 3 2 3 5Zm0 0c2-1 3-3 3-5-2 0-3 2-3 5Z" />
      <path d="M8 21h8" />
    </>
  ),
  sunflower: (
    <>
      <circle cx="12" cy="10" r="3" fill="currentColor" opacity="0.55" />
      <path d="M12 3v4M12 13v4M5 10h4M15 10h4M7 5l2.8 2.8M14.2 12.2 17 15M17 5l-2.8 2.8M9.8 12.2 7 15" />
      <path d="M12 17v4" />
      <path d="M12 21c-2-1-3-2-3-4M12 21c2-1 3-2 3-4" />
    </>
  ),
  cassava: (
    <>
      <path d="M9 20c-2-1-4-3-4-5 0-3 3-5 6-5s5 2 5 4c0 3-3 5-7 6Z" fill="currentColor" opacity="0.2" />
      <path d="M9 20c-2-1-4-3-4-5 0-3 3-5 6-5s5 2 5 4c0 3-3 5-7 6Z" />
      <path d="M13 10V6M13 7c-2 0-4-1-5-3 2-1 4 0 5 3Zm0 0c2 0 4-1 5-3-2-1-4 0-5 3Z" />
    </>
  ),
  other: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c-4 0-7-3-7-7 4 0 7 3 7 7Z" fill="currentColor" opacity="0.2" />
      <path d="M12 12c3 0 5-2 5-5-3 0-5 2-5 5Z" fill="currentColor" opacity="0.2" />
      <path d="M12 14c-4 0-7-3-7-7 4 0 7 3 7 7Zm0-2c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    </>
  ),
};

export interface CropIconProps {
  code: CropCode;
  size?: number;
  label?: string;
}

export const CropIcon = ({ code, size = 32, label }: CropIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    role={label ? "img" : undefined}
    aria-hidden={label ? undefined : true}
    focusable="false"
  >
    {label ? <title>{label}</title> : null}
    {SHAPES[code] ?? SHAPES.other}
  </svg>
);
