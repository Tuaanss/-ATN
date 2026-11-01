import { Assignment } from '@prisma/client';

/** Hạn cuối thực tế: hạn muộn nếu cho nộp muộn, ngược lại là hạn nộp (Specification §4.2). */
export function finalDeadline(a: Pick<Assignment, 'allowLate' | 'lateDueAt' | 'dueAt'>): Date {
  return a.allowLate && a.lateDueAt ? a.lateDueAt : a.dueAt;
}

/** Bài tập đang nhận bài? */
export function isAcceptingSubmissions(a: Pick<Assignment, 'status' | 'openAt' | 'allowLate' | 'lateDueAt' | 'dueAt'>, now = new Date()) {
  return a.status === 'OPEN' && a.openAt <= now && now <= finalDeadline(a);
}

/**
 * Trạng thái hiển thị cho GV – suy ra từ dữ liệu, không lưu cột riêng.
 * Hệ thống chỉ lưu kết quả nên không theo dõi tiến độ từng bước.
 */
export type AssignmentPhase = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'ENDED' | 'PUBLISHED';

export function assignmentPhase(a: Pick<Assignment, 'status' | 'autoOpen' | 'openAt' | 'dueAt' | 'allowLate' | 'lateDueAt' | 'gradesPublishedAt'>, now = new Date()): AssignmentPhase {
  if (a.status === 'DRAFT') return a.autoOpen && a.openAt > now ? 'SCHEDULED' : 'DRAFT';
  if (a.gradesPublishedAt) return 'PUBLISHED';
  if (a.status === 'CLOSED' || now > finalDeadline(a)) return 'ENDED';
  return 'OPEN';
}
