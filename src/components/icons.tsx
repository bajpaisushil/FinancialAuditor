import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const ShieldIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9.5 12 1.8 1.8 3.4-3.6" /></svg>
);

export const WifiOffIcon = (p: P) => (
  <svg {...base} {...p}><path d="m2 2 20 20" /><path d="M8.5 16.4a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 3.2-2.1" /><path d="M19 12.9a10 10 0 0 0-5.5-2.8" /><path d="M2 8.8a16 16 0 0 1 4.3-2.6" /><path d="M22 8.8a16 16 0 0 0-9.6-3.7" /><path d="M12 20h.01" /></svg>
);

export const UploadIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></svg>
);

export const TrendUpIcon = (p: P) => (
  <svg {...base} {...p}><path d="m4 16 5-5 3.5 3.5L20 7" /><path d="M15 7h5v5" /></svg>
);

export const RepeatIcon = (p: P) => (
  <svg {...base} {...p}><path d="m17 2 3 3-3 3" /><path d="M20 5H8a4 4 0 0 0-4 4v1" /><path d="m7 22-3-3 3-3" /><path d="M4 19h12a4 4 0 0 0 4-4v-1" /></svg>
);

export const CoffeeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M5 9h12v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" /><path d="M17 10h2a2 2 0 0 1 0 4h-2" /><path d="M8 3v2M11 3v2M14 3v2" /></svg>
);

export const LockIcon = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);

export const BoltIcon = (p: P) => (
  <svg {...base} {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></svg>
);

export const XIcon = (p: P) => (
  <svg {...base} {...p}><path d="m6 6 12 12M18 6 6 18" /></svg>
);

export const HeartIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 20s-7-4.4-9.3-8.5C1 8 2.6 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.4 0 5 3.5 3.3 7C19 15.6 12 20 12 20Z" /></svg>
);

export const ChevronIcon = (p: P) => (
  <svg {...base} {...p}><path d="m9 6 6 6-6 6" /></svg>
);

export const FileIcon = (p: P) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></svg>
);

export const ArrowRightIcon = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
);

export const EyeOffIcon = (p: P) => (
  <svg {...base} {...p}><path d="M2 2 22 22" /><path d="M6.7 6.7C4.5 8 3 10 2 12c2 4 6 7 10 7 1.8 0 3.5-.5 5-1.4" /><path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c4 0 8 3 10 7-.7 1.4-1.7 2.7-2.8 3.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
