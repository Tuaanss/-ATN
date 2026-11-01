import { HttpException, HttpStatus } from '@nestjs/common';

/** Mã lỗi chuẩn – docs/Specification.md §7 (phần đã hiện thực). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TEMP_LOCKED'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'DRIVE_FOLDER_NOT_FOUND'
  | 'DRIVE_NOT_A_FOLDER'
  | 'DRIVE_NO_WRITE_PERMISSION'
  | 'DRIVE_NOT_SHARED_DRIVE'
  | 'DRIVE_NOT_LINKED'
  | 'ASSIGNMENT_INVALID_DATES'
  | 'ASSIGNMENT_CLOSED'
  | 'ASSIGNMENT_SECTION_NOT_OWNED'
  | 'ASSIGNMENT_HAS_SUBMISSIONS'
  | 'GROUP_NOT_ASSIGNED'
  | 'GROUP_HAS_SUBMISSION'
  | 'GROUP_REPORT_PENDING_EXISTS'
  | 'IMPORT_INVALID_FILE'
  | 'IMPORT_TOO_LARGE'
  | 'IMPORT_JOB_EXPIRED'
  | 'GRADES_LOCKED'
  | 'WORK_MODE_LOCKED'
  | 'TOPIC_REQUIRED'
  | 'AUTH_PROFILE_INCOMPLETE'
  | 'AUTH_MUST_CHANGE_PASSWORD'
  | 'AUTH_TOKEN_INVALID'
  | 'GRADE_REQUEST_PENDING_EXISTS'
  | 'TOPIC_EDIT_CLOSED'
  | 'SUBMISSION_DEADLINE_PASSED'
  | 'PERSONAL_PART_DISABLED'
  | 'SUBMISSION_EMPTY'
  | 'REPORT_REQUIRED'
  | 'FILE_INVALID_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_TOO_MANY'
  | 'LINK_INVALID_DOMAIN';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details }, status);
  }
}

export const notFound = (what = 'Dữ liệu') =>
  new AppException('NOT_FOUND', `${what} không tồn tại`, HttpStatus.NOT_FOUND);

export const forbidden = (message = 'Bạn không có quyền thực hiện thao tác này') =>
  new AppException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
