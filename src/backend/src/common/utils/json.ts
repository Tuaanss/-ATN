import type { Prisma } from '@prisma/client';

/** Cột danh sách lưu dạng JSON (MySQL không có kiểu mảng): đọc ra mảng chuỗi an toàn. */
export const strs = <T extends string = string>(v: Prisma.JsonValue | null | undefined): T[] => (Array.isArray(v) ? (v.filter((x) => typeof x === 'string') as T[]) : []);
