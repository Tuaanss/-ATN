import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.module';

const noteSchema = z.object({
  content: z.string().max(2000, 'Ghi chú tối đa 2000 ký tự').default(''),
  isSample: z.boolean().default(false),
});

/**
 * Ghi chú riêng của GV trên bài nộp (mỗi bài một ô ghi chú).
 * Chỉ GV phụ trách lớp mới ghi được, và chỉ thấy ghi chú của chính mình; SV không bao giờ thấy.
 */
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async own(lecturerId: string, submissionId: string) {
    const s = await this.prisma.submission.findUnique({ where: { id: submissionId }, select: { assignment: { select: { section: { select: { lecturerId: true } } } } } });
    if (!s) throw notFound('Bài nộp');
    if (s.assignment.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách lớp của bài nộp này');
  }

  async get(lecturerId: string, submissionId: string) {
    await this.own(lecturerId, submissionId);
    const n = await this.prisma.lecturerNote.findUnique({ where: { submissionId_lecturerId: { submissionId, lecturerId } } });
    return { content: n?.content ?? '', isSample: n?.isSample ?? false, updatedAt: n?.updatedAt ?? null };
  }

  async save(lecturerId: string, submissionId: string, dto: z.infer<typeof noteSchema>) {
    await this.own(lecturerId, submissionId);
    const key = { submissionId_lecturerId: { submissionId, lecturerId } };
    const content = dto.content.trim();
    if (!content && !dto.isSample) {
      await this.prisma.lecturerNote.deleteMany({ where: { submissionId, lecturerId } });
      return { content: '', isSample: false, updatedAt: null };
    }
    const n = await this.prisma.lecturerNote.upsert({ where: key, create: { submissionId, lecturerId, content, isSample: dto.isSample }, update: { content, isSample: dto.isSample } });
    return { content: n.content, isSample: n.isSample, updatedAt: n.updatedAt };
  }
}

const feedbackSchema = z.object({ content: z.string().trim().max(2000, 'Nhận xét tối đa 2000 ký tự') });

/**
 * Nhận xét của GV gửi sinh viên trên bài nộp – khác ghi chú riêng: SV của bài (cả nhóm với bài chung)
 * và phụ huynh xem được, SV nhận thông báo mỗi khi GV gửi / sửa nhận xét.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async own(lecturerId: string, submissionId: string) {
    const s = await this.prisma.submission.findUnique({ where: { id: submissionId }, include: { assignment: { include: { section: true } }, group: { include: { members: { include: { student: true } } } }, student: true } });
    if (!s) throw notFound('Bài nộp');
    if (s.assignment.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách lớp của bài nộp này');
    return s;
  }

  async get(lecturerId: string, submissionId: string) {
    await this.own(lecturerId, submissionId);
    const f = await this.prisma.submissionFeedback.findUnique({ where: { submissionId_lecturerId: { submissionId, lecturerId } } });
    return { content: f?.content ?? '', updatedAt: f?.updatedAt ?? null };
  }

  async save(lecturerId: string, userId: string, submissionId: string, content: string) {
    const s = await this.own(lecturerId, submissionId);
    const key = { submissionId_lecturerId: { submissionId, lecturerId } };
    const old = await this.prisma.submissionFeedback.findUnique({ where: key });
    if (!content) {
      if (old) await this.prisma.submissionFeedback.delete({ where: key });
      return { content: '', updatedAt: null };
    }
    if (old?.content === content) return { content, updatedAt: old.updatedAt };
    const f = await this.prisma.submissionFeedback.upsert({ where: key, create: { submissionId, lecturerId, content }, update: { content } });
    const students = s.kind === 'GROUP_SHARED' && s.group ? s.group.members.map((m) => m.student) : s.student ? [s.student] : [];
    await this.notifications.notify(
      students.map((x) => x.userId),
      {
        type: 'GRADE_FEEDBACK',
        title: `Giảng viên ${old ? 'cập nhật nhận xét' : 'nhận xét'} bài “${s.assignment.title}”`,
        body: content.slice(0, 300),
        link: `/student/assignments/${s.assignmentId}`,
        dedupeKey: `fb:${f.id}:${f.updatedAt.getTime()}`,
      },
    );
    await this.audit.log({ actorId: userId, action: old ? 'FEEDBACK_UPDATE' : 'FEEDBACK_CREATE', entityType: 'submission', entityId: submissionId, summary: `${old ? 'Sửa' : 'Gửi'} nhận xét bài ${s.assignment.title}${s.group ? ` · Nhóm ${s.group.code}` : s.student ? ` · ${s.student.studentCode}` : ''}` });
    return { content: f.content, updatedAt: f.updatedAt };
  }
}

@Controller('lecturer/submissions')
@Roles('LECTURER')
export class LecturerNotesController {
  constructor(
    private readonly service: NotesService,
    private readonly feedback: FeedbackService,
  ) {}

  @Get(':id/feedback')
  getFeedback(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.get(u.lecturerId!, id);
  }

  @Put(':id/feedback')
  saveFeedback(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(feedbackSchema)) dto: { content: string }) {
    return this.feedback.save(u.lecturerId!, u.sub, id, dto.content);
  }

  @Get(':id/note')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(u.lecturerId!, id);
  }

  @Put(':id/note')
  save(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(noteSchema)) dto: z.infer<typeof noteSchema>) {
    return this.service.save(u.lecturerId!, id, dto);
  }
}

@Module({ controllers: [LecturerNotesController], providers: [NotesService, FeedbackService] })
export class NotesModule {}
