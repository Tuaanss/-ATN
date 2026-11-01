import { stripVietnamese } from '../../common/utils/files';

const STOP = new Set(['ung', 'dung', 'app', 'he', 'thong', 'cho', 'va', 'cua', 'web', 'trang', 'de', 'tai', 'the', 'mot']);

const tokens = (s: string) =>
  new Set(
    stripVietnamese(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );

/** Độ tương đồng tên đề tài (Jaccard trên từ đã bỏ dấu, bỏ từ chung) – cảnh báo trùng FR-05.10. */
export function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export const SIMILAR_THRESHOLD = 0.5;
