import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException } from '../../common/errors/app-exception';
import { similarity, SIMILAR_THRESHOLD } from './similarity';
import { NotificationsService } from '../notifications/notifications.module';
import { finalDeadline } from '../assignments/assignment-status';
import { StudentWorkService } from '../submissions/student-work.service';
import { strs } from '../../common/utils/json';

export interface TopicInput {
  title: string;
  keywords: string[];
}

export { similarity, SIMILAR_THRESHOLD };

/** Đề tài: SV nhập tên + 1–5 từ khóa, không cần GV duyệt (UC05.7–5.8). */
@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly work: StudentWorkService,
  ) {}

  async save(studentId: string, userId: string, assignmentId: string, dto: TopicInput) {
    const a = await this.work.accessibleAssignment(studentId, assignmentId);
    if (new Date() > finalDeadline(a) || a.status === 'CLOSED')
      throw new AppException('TOPIC_EDIT_CLOSED', 'Đã qua hạn, không sửa được đề tài', HttpStatus.CONFLICT);

    const group = await this.work.myGroup(studentId, a.id);
    if (a.workMode === 'GROUP' && !group)
      throw new AppException('GROUP_NOT_ASSIGNED', 'Bạn chưa có tên trong danh sách nhóm giảng viên tải lên', HttpStatus.CONFLICT);

    const seen = new Set<string>();
    const keywords = dto.keywords
      .map((k) => k.trim().replace(/\s+/g, ' '))
      .filter((k) => k && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()));
    const title = dto.title.trim().replace(/\s+/g, ' ');

    const existing = group ? group.topic : await this.prisma.topic.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } } });
    const changed = !existing || existing.title !== title || strs(existing.keywords).join('|') !== keywords.join('|');
    if (!changed) return this.work.myWork(studentId, a.id);

    const topic = group
      ? await this.prisma.topic.upsert({ where: { groupId: group.id }, create: { assignmentId: a.id, groupId: group.id, title, keywords }, update: { title, keywords } })
      : await (async () => {
          await this.prisma.individualWork.upsert({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } }, create: { assignmentId: a.id, studentId }, update: {} });
          return this.prisma.topic.upsert({
            where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
            create: { assignmentId: a.id, studentId, title, keywords },
            update: { title, keywords },
          });
        })();
    await this.prisma.topicHistory.create({
      data: { topicId: topic.id, actorId: userId, action: existing ? 'UPDATE' : 'CREATE', title, note: keywords.join(', ') },
    });
    if (group) {
      const me = group.members.find((m) => m.studentId === studentId);
      await this.notifications.notify(
        group.members.filter((m) => m.studentId !== studentId).map((m) => m.student.userId),
        { type: 'TOPIC_UPDATED', title: `${me?.student.fullName ?? 'Thành viên'} đã ${existing ? 'cập nhật' : 'nhập'} đề tài nhóm`, body: title, link: `/student/assignments/${a.id}` },
      );
    }
    return this.work.myWork(studentId, a.id);
  }
}
