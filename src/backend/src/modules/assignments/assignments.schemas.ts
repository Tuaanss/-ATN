import { z } from 'zod';

const productType = z.enum(['IMAGE', 'FIGMA', 'VIDEO', 'SOURCE', 'GIT_LINK', 'REPORT']);

/** Thông tin chung của bài tập (UC04.2, FR-04.02). */
export const assignmentCommonSchema = z
  .object({
    title: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(200),
    description: z.string().max(20000).optional().default(''),
    /** GROUP: nhóm theo danh sách Excel GV tải lên sau khi giao */
    workMode: z.enum(['INDIVIDUAL', 'GROUP']),
    productTypes: z.array(productType).min(1, 'Chọn ít nhất một loại sản phẩm'),
    allowLate: z.boolean().default(false),
    lateDays: z.number().int().min(1).max(14).optional(),
    weight: z.number().int().min(1, 'Trọng số 1–100%').max(100, 'Trọng số 1–100%').default(10),
    hasIndividualPart: z.boolean().default(false),
    folderUrl: z.string().trim().optional(),
    publishNow: z.boolean().default(true),
    /** Lưu nháp: không mở cho SV đến khi GV bấm "Giao bài" */
    saveDraft: z.boolean().default(false),
    suggestedTopics: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.hasIndividualPart && v.workMode !== 'GROUP')
      ctx.addIssue({ code: 'custom', path: ['hasIndividualPart'], message: 'Phần cá nhân chỉ áp dụng cho bài nhóm' });
    if (v.allowLate && !v.lateDays)
      ctx.addIssue({ code: 'custom', path: ['lateDays'], message: 'Nhập số ngày cho phép nộp muộn' });
  });

/** Thời hạn riêng từng LHP (UC04.8). */
export const sectionScheduleSchema = z.object({
  sectionId: z.string().uuid(),
  openAt: z.coerce.date(),
  dueAt: z.coerce.date(),
});

export const batchCreateSchema = z.object({
  common: assignmentCommonSchema,
  sections: z.array(sectionScheduleSchema).min(1, 'Chọn ít nhất một lớp học phần').max(20),
});

export const singleCreateSchema = z.object({
  common: assignmentCommonSchema,
  schedule: sectionScheduleSchema.omit({ sectionId: true }),
});

export const editSchema = z.object({
  common: assignmentCommonSchema,
  schedule: sectionScheduleSchema.omit({ sectionId: true }),
  /** Đổi thư mục nhận bài: move = chuyển thư mục nhóm/cá nhân sang; new = chỉ bài nộp mới */
  folderMode: z.enum(['move', 'new']).optional(),
});

export const checkFolderSchema = z.object({ folderUrl: z.string().trim().min(1, 'Dán link thư mục Google Drive') });
export const driveLinkSchema = z.object({ folderUrl: z.string().trim().min(1, 'Dán link thư mục Google Drive') });
export const commitSchema = z.object({ onlyValid: z.boolean().optional() });
export const resolveReportSchema = z.object({ note: z.string().trim().max(500).optional() });
export const publishSectionSchema = z.object({ allowIncomplete: z.boolean().optional() });

export type AssignmentCommon = z.infer<typeof assignmentCommonSchema>;
export type SectionSchedule = z.infer<typeof sectionScheduleSchema>;
export type BatchCreateDto = z.infer<typeof batchCreateSchema>;
export type SingleCreateDto = z.infer<typeof singleCreateSchema>;
export type AssignmentUpdate = z.infer<typeof editSchema>;
