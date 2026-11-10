import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { stripVietnamese } from '../../common/utils/files';
import { strs } from '../../common/utils/json';

const PAGE_SIZE = 10;
const groupName = (g: { code: string; name: string }) => (g.name && g.name !== g.code ? `${g.code} · ${g.name}` : `Nhóm ${g.code}`);
const norm = (s: string) => stripVietnamese(s).toLowerCase().replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 0);
const list = (v?: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

export interface SearchQuery {
  q?: string;
  by?: 'topic' | 'name' | 'code' | 'note';
  /** '1' = chỉ bài GV đã đánh dấu bài mẫu */
  sample?: string;
  cohort?: string;
  major?: string;
  semester?: string;
  course?: string;
  section?: string;
  min?: string;
  max?: string;
  sort?: 'relevance' | 'newest' | 'score';
  page?: string;
}

/**
 * Tìm bài nộp cho GV (UC06.8, FR-06.12/13): phạm vi = LHP mình dạy.
 * Không phân biệt dấu/hoa thường, khớp gần đúng theo từng từ.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private async scope(lecturerId: string, q: SearchQuery) {
    const where: Prisma.SubmissionWhereInput = {
      assignment: {
        deletedAt: null,
        section: {
          lecturerId,
          ...(q.section ? { id: q.section } : {}),
          ...(q.semester ? { semester: { code: q.semester } } : {}),
          ...(q.course ? { course: { code: q.course } } : {}),
        },
      },
      // gồm bài chung của nhóm, bài cá nhân và phần cá nhân trong bài nhóm
    };
    return this.prisma.submission.findMany({
      where,
      include: {
        assignment: { include: { section: { include: { course: true, semester: true } }, grades: true } },
        topic: true,
        student: { include: { groupMembers: { include: { group: true } } } },
        group: { include: { members: { include: { student: true }, orderBy: { student: { studentCode: 'asc' } } } } },
        files: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true, fileType: true, originalName: true } },
        lecturerNotes: { where: { lecturerId }, select: { content: true, isSample: true } },
      },
    });
  }

  async search(lecturerId: string, q: SearchQuery) {
    const rows = await this.scope(lecturerId, q);
    const by = q.by ?? 'topic';
    const qTokens = tokens(q.q ?? '');
    const qNorm = norm(q.q ?? '');
    const cohorts = list(q.cohort);
    const min = q.min !== undefined && q.min !== '' ? Number(q.min) : null;
    const max = q.max !== undefined && q.max !== '' ? Number(q.max) : null;

    const items = rows
      .map((s) => {
        const a = s.assignment;
        const members = s.group ? s.group.members.map((m) => m.student) : s.student ? [s.student] : [];
        // phần cá nhân trong bài nhóm: nhóm mà SV thuộc về ở bài tập này
        const partOf = !s.group && s.student ? (s.student.groupMembers.find((m) => m.assignmentId === a.id)?.group ?? null) : null;
        const scores = members.map((m) => a.grades.find((g) => g.studentId === m.id)?.score).filter((x): x is Prisma.Decimal => x != null).map(Number);
        const score = scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
        const title = s.topic?.title ?? a.title;
        const keywords = strs(s.topic?.keywords);
        const note = s.lecturerNotes[0] ?? null;

        // độ liên quan
        let rel = qTokens.length ? 0 : 1;
        if (qTokens.length) {
          if (by === 'topic') {
            const t = norm(title);
            const kw = keywords.map(norm);
            if (qNorm && t.includes(qNorm)) rel += 5;
            if (kw.some((k) => k === qNorm)) rel += 5;
            for (const w of qTokens) {
              if (tokens(title).includes(w)) rel += 2;
              else if (t.includes(w)) rel += 1;
              if (kw.some((k) => tokens(k).includes(w) || k.includes(w))) rel += 2;
            }
            if (norm(a.title).includes(qNorm)) rel += 1;
          } else if (by === 'note') {
            const n = norm(note?.content ?? '');
            if (n) {
              if (qNorm && n.includes(qNorm)) rel += 5;
              for (const w of qTokens) if (tokens(n).includes(w)) rel += 2;
              else if (n.includes(w)) rel += 1;
            }
          } else if (by === 'name') {
            for (const m of members) {
              const n = norm(m.fullName);
              if (n.includes(qNorm)) rel += 5;
              else if (qTokens.every((w) => tokens(n).includes(w))) rel += 3;
            }
          } else {
            for (const m of members) if (m.studentCode.toLowerCase().includes(qNorm.replace(/\s/g, ''))) rel += 5;
          }
        }
        return { s, members, score, title, keywords, rel, partOf, note };
      })
      .filter((x) => x.rel > 0)
      .filter((x) => q.sample !== '1' || !!x.note?.isSample)
      .filter((x) => !cohorts.length || x.members.some((m) => m.cohort && cohorts.includes(m.cohort)))
      .filter((x) => !q.major || x.members.some((m) => m.major === q.major))
      .filter((x) => (min === null && max === null) || (x.score !== null && (min === null || x.score >= min) && (max === null || x.score <= max)));

    const sort = q.sort ?? (qTokens.length ? 'relevance' : 'newest');
    items.sort((x, y) =>
      sort === 'score'
        ? (y.score ?? -1) - (x.score ?? -1)
        : sort === 'relevance' && y.rel !== x.rel
          ? y.rel - x.rel
          : y.s.submittedAt.getTime() - x.s.submittedAt.getTime(),
    );

    const total = items.length;
    const page = Math.max(1, Math.min(Number(q.page) || 1, Math.ceil(total / PAGE_SIZE) || 1));
    const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      items: shown.map(({ s, members, score, title, keywords, partOf, note }) => {
        const a = s.assignment;
        const thumb = s.files.find((f) => f.fileType === 'IMAGE') ?? s.files.find((f) => f.fileType === 'VIDEO') ?? s.files[0] ?? null;
        return {
          submissionId: s.id,
          title,
          keywords,
          assignment: { id: a.id, title: a.title },
          owner: s.group ? groupName(s.group) : partOf ? `Phần cá nhân · ${groupName(partOf)}` : 'Cá nhân',
          individual: !s.group,
          personalPart: !!partOf,
          note: note && { content: note.content, isSample: note.isSample },
          members: members.map((m) => ({ fullName: m.fullName, studentCode: m.studentCode })),
          cohorts: [...new Set(members.map((m) => m.cohort).filter(Boolean))] as string[],
          section: { code: a.section.code, course: a.section.course.name },
          semester: { code: a.section.semester.code, term: a.section.semester.term, academicYear: a.section.semester.academicYear },
          score,
          gradesPublished: !!a.gradesPublishedAt,
          submittedAt: s.submittedAt,
          isLate: s.isLate,
          thumb: thumb && { id: thumb.id, fileType: thumb.fileType, name: thumb.originalName },
          fileCount: s.files.length,
          hasFigma: !!s.figmaUrl,
          hasGit: !!s.gitUrl,
        };
      }),
    };
  }

  /** Giá trị cho các bộ lọc + gợi ý từ khóa phổ biến. */
  async filters(lecturerId: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId },
      include: { course: true, semester: true, students: { include: { student: { select: { cohort: true, major: true } } } } },
      orderBy: [{ semester: { startDate: 'desc' } }, { code: 'asc' }],
    });
    const topics = await this.prisma.topic.findMany({ where: { assignment: { deletedAt: null, section: { lecturerId } } }, select: { keywords: true } });
    const count = new Map<string, { label: string; n: number }>();
    for (const t of topics)
      for (const k of strs(t.keywords)) {
        const key = norm(k);
        const c = count.get(key) ?? { label: k, n: 0 };
        c.n++;
        count.set(key, c);
      }
    const students = sections.flatMap((s) => s.students.map((x) => x.student));
    const uniq = <T,>(a: T[]) => [...new Set(a)];
    return {
      // Khóa: từ D22 đến khóa của năm hiện tại (D22, D23, …), thêm khóa D mới hơn nếu dữ liệu đã có
      cohorts: uniq([
        ...Array.from({ length: Math.max(1, (new Date().getFullYear() % 100) - 21) }, (_, i) => `D${22 + i}`),
        ...students.map((s) => s.cohort).filter((x): x is string => !!x && /^D\d{2}$/i.test(x) && Number(x.slice(1)) >= 22).map((x) => x.toUpperCase()),
      ]).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))),
      majors: uniq(students.map((s) => s.major).filter((x): x is string => !!x)).sort(),
      semesters: uniq(sections.map((s) => s.semester.code)).map((code) => {
        const s = sections.find((x) => x.semester.code === code)!.semester;
        return { code, term: s.term, academicYear: s.academicYear };
      }),
      courses: uniq(sections.map((s) => s.course.code)).map((code) => ({ code, name: sections.find((x) => x.course.code === code)!.course.name })),
      sections: sections.map((s) => ({ id: s.id, code: s.code, course: s.course.name })),
      suggestions: [...count.values()].sort((x, y) => y.n - x.n).slice(0, 6).map((x) => x.label),
    };
  }
}

@Controller('lecturer/search')
@Roles('LECTURER')
export class LecturerSearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  search(@CurrentUser() u: AuthUser, @Query() q: SearchQuery) {
    return this.service.search(u.lecturerId!, q);
  }

  @Get('filters')
  filters(@CurrentUser() u: AuthUser) {
    return this.service.filters(u.lecturerId!);
  }
}

@Module({ controllers: [LecturerSearchController], providers: [SearchService] })
export class SearchModule {}
