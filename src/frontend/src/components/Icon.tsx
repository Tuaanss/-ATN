import type { CSSProperties } from 'react';

// Bộ biểu tượng lấy nguyên từ các trang mẫu (d:\doan\project) – stroke 1.8, viewBox 24.

const PATHS = {
  // FrameUp: khung ảnh/video (4 góc) + mũi tên tải lên
  logo: "<path d=\"M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5\"/><path d=\"M12 16V8M8.5 11.5 12 8l3.5 3.5\"/>",
  image: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"2\"/><path d=\"m21 17-5-5-9 8\"/>",
  video: "<rect x=\"3\" y=\"6\" width=\"13\" height=\"12\" rx=\"2\"/><path d=\"m16 10 5-3v10l-5-3\"/>",
  code: "<path d=\"m8 7-5 5 5 5M16 7l5 5-5 5\"/>",
  folder: "<path d=\"M3 6h6l2 2h10v12H3z\"/>",
  warn: "<path d=\"M12 3 2 20h20z\"/><path d=\"M12 10v4M12 17h.01\"/>",
  home: "<path d=\"M3 10.5 12 3l9 7.5V21H3z\"/><path d=\"M9 21v-7h6v7\"/>",
  list: "<path d=\"M8 6h13M8 12h13M8 18h13\"/><path d=\"M3 6h.01M3 12h.01M3 18h.01\"/>",
  chart: "<path d=\"M4 20V10\"/><path d=\"M10 20V4\"/><path d=\"M16 20v-7\"/><path d=\"M22 20H2\"/>",
  shield: "<path d=\"M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z\"/>",
  user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>",
  logout: "<path d=\"M15 4h4v16h-4\"/><path d=\"m10 8-4 4 4 4\"/><path d=\"M6 12h10\"/>",
  search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/>",
  bell: "<path d=\"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z\"/><path d=\"M10 21h4\"/>",
  file: "<path d=\"M14 3H6v18h12V7z\"/><path d=\"M14 3v4h4\"/>",
  users: "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20a6.5 6.5 0 0 1 13 0\"/><path d=\"M16 4.5a3.5 3.5 0 0 1 0 7\"/><path d=\"M18 14a6 6 0 0 1 3.5 6\"/>",
  building: "<path d=\"M4 21V4h10v17\"/><path d=\"M14 9h6v12\"/><path d=\"M8 8h2M8 12h2M8 16h2M2 21h20\"/>",
  clock: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  grid: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>",
  plus: "<path d=\"M12 5v14M5 12h14\"/>",
  trend: "<path d=\"m3 17 6-6 4 4 8-8\"/><path d=\"M14 7h7v7\"/>",
  drive: "<path d=\"M8 3h8l6 11-4 7H6l-4-7z\"/><path d=\"M2 14h20\"/><path d=\"m8 3 10 18\"/>",
  check: "<path d=\"m5 12 5 5 9-10\"/>",
  chevronRight: "<path d=\"m9 5 7 7-7 7\"/>",
  listAlt: "<path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/>",
  download: "<path d=\"M12 4v12\"/><path d=\"m7 11 5 5 5-5\"/><path d=\"M4 20h16\"/>",
  refresh: "<path d=\"M20 11a8 8 0 1 0-2.3 5.7\"/><path d=\"M20 4v7h-7\"/>",
  chevronDown: "<path d=\"m6 9 6 6 6-6\"/>",
  lock: "<rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/>",
  eye: "<path d=\"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  edit: "<path d=\"M4 20h4L20 8l-4-4L4 16z\"/>",
  close: "<path d=\"M6 6l12 12M18 6 6 18\"/>",
  upload: "<path d=\"M12 16V4\"/><path d=\"m7 9 5-5 5 5\"/><path d=\"M4 16v4h16v-4\"/>",
  key: "<circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"m11 12 9-9M17 6l3 3\"/>",
  tag: "<path d=\"M3 12V3h9l9 9-9 9z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\"1.5\"/>",
  link: "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>",
  chevronRightSm: "<path d=\"m9 18 6-6-6-6\"/>",
  chevronLeft: "<path d=\"m15 18-6-6 6-6\"/>",
  trash: "<path d=\"M4 7h16\"/><path d=\"M9 7V4h6v3\"/><path d=\"M6 7l1 14h10l1-14\"/>",
  grip: "<circle cx=\"9\" cy=\"6\" r=\"1\"/><circle cx=\"15\" cy=\"6\" r=\"1\"/><circle cx=\"9\" cy=\"12\" r=\"1\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"18\" r=\"1\"/><circle cx=\"15\" cy=\"18\" r=\"1\"/>",
  imageAlt: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"2\"/><path d=\"m21 16-5-5-9 9\"/>",
  play: "<path d=\"M7 4v16l13-8z\"/>",
  chevronLeftLg: "<path d=\"m15 5-7 7 7 7\"/>",
  zoomIn: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4M11 8v6M8 11h6\"/>",
  fullscreen: "<path d=\"M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5\"/>",
  star: "<path d=\"m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z\"/>",
  cap: "<path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5\"/><path d=\"M22 9v6\"/>",
  calendar: "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/>",
  settings: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/>",
  unlock: "<rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 7.5-2\"/>",
  phone: "<path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2\"/>",
  swap: "<path d=\"M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7\"/>",
  copy: "<rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1\"/>",
  sheet: "<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"M4 9h16M4 15h16M10 3v18\"/>",
  info: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5M12 8h.01\"/>",
  note: "<path d=\"M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5\"/>",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, strokeWidth = 1.8, style }: { name: IconName; size?: number; strokeWidth?: number; style?: CSSProperties }) {
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
      style={{ flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
