/**
 * Nộp bài hàng loạt thay sinh viên (nạp dữ liệu thật / demo) – không cần đăng nhập từng tài khoản.
 * Gọi thẳng SubmissionsService.submit nên mọi kiểm tra (đề tài, loại tệp, dung lượng, hạn nộp) giữ nguyên;
 * tệp được đưa vào data/pending và API server đang chạy sẽ tự đẩy lên Drive ở lần quét kế tiếp (≤ 2 phút).
 *
 * Chạy trong thư mục backend (cùng .env với API server):
 *   npm run build
 *   node dist/cli/bulk-submit.js --section MH01_HK1_2526_01 --assignment "Bài tập lớn" --dir "D:/bai-nop/MH01" [--dry-run]
 *
 * Cấu trúc thư mục --dir (mỗi thư mục con là một chủ bài):
 *   <dir>/
 *     SV1001/                  bài cá nhân: tên thư mục = MSV
 *       info.json              (tuỳ chọn) { "topic": "...", "keywords": ["..."], "figmaUrl": "...", "gitUrl": "...", "note": "..." }
 *       anh1.png  baocao.pdf ...
 *     N01/                     bài nhóm: tên thư mục = mã nhóm (GV đã import danh sách nhóm)
 *       info.json              (tuỳ chọn) như trên – đề tài của nhóm
 *       ...tệp bài chung...
 *       SV1002/                (tuỳ chọn, khi bài có phần cá nhân) phần cá nhân của thành viên
 *         info.json            (tuỳ chọn) { "contributionPercent": 30, "note": "...", "figmaUrl": "...", "gitUrl": "..." }
 */
import '../load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../infra/storage/storage.service';
import { SubmissionsService, SubmitInput } from '../modules/submissions/submissions.service';
import { DriveSyncService } from '../modules/submissions/drive-sync.service';
import { TopicsService } from '../modules/topics/topics.service';
import { AssignmentsScheduler } from '../modules/assignments/assignments.module';

// Script chạy song song với API server: tắt các tác vụ nền để không làm trùng việc của server
// (server tự quét data/pending và đẩy lên Drive; không được xoá thư mục uploads server đang dùng).
DriveSyncService.prototype.onApplicationBootstrap = () => undefined;
DriveSyncService.prototype.enqueue = () => undefined;
SubmissionsService.prototype.cleanupUploads = async () => undefined;
AssignmentsScheduler.prototype.onModuleInit = () => undefined;

interface Info {
  topic?: string;
  keywords?: string[];
  figmaUrl?: string;
  gitUrl?: string;
  note?: string;
  contributionPercent?: number;
}

function args() {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const section = get('section');
  const assignment = get('assignment');
  const dir = get('dir');
  if (!section || !assignment || !dir) {
    console.error('Cách dùng: node dist/cli/bulk-submit.js --section <mã lớp HP> --assignment "<tên bài tập>" --dir <thư mục> [--dry-run]');
    process.exit(1);
  }
  return { section, assignment, dir: path.resolve(dir), dryRun: a.includes('--dry-run') };
}

async function readInfo(dir: string): Promise<Info> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'info.json'), 'utf8')) as Info;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`info.json trong ${dir} không hợp lệ: ${(e as Error).message}`);
  }
}

async function list(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return {
    files: entries.filter((e) => e.isFile() && e.name !== 'info.json' && !e.name.startsWith('.')).map((e) => path.join(dir, e.name)),
    dirs: entries.filter((e) => e.isDirectory()).map((e) => e.name),
  };
}

const msg = (e: unknown) => (e as { message?: string })?.message ?? String(e);

async function main() {
  const opt = args();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const log = { log: (m: string) => console.log(m), error: (m: string) => console.error(m) };
  const prisma = app.get(PrismaService);
  const storage = app.get(StorageService);
  const submissions = app.get(SubmissionsService);
  const topics = app.get(TopicsService);

  try {
    const a = await prisma.assignment.findFirst({
      where: { title: opt.assignment, deletedAt: null, section: { code: opt.section } },
      include: { groups: { include: { members: { include: { student: true }, orderBy: [{ role: 'asc' }] } } } },
    });
    if (!a) throw new Error(`Không thấy bài tập "${opt.assignment}" trong lớp ${opt.section}`);
    log.log(`Bài tập: ${a.title} · ${a.workMode === 'GROUP' ? `nhóm (${a.groups.length} nhóm)` : 'cá nhân'}${a.hasIndividualPart ? ' · có phần cá nhân' : ''}`);

    // Sao chép tệp vào uploads như multer – submit() sẽ chuyển/xoá bản sao, tệp gốc giữ nguyên
    const asUploads = async (paths: string[]) =>
      Promise.all(
        paths.map(async (p) => {
          const dest = path.join(storage.uploadsDir, randomUUID());
          await fs.copyFile(p, dest);
          const size = (await fs.stat(dest)).size;
          return { path: dest, originalname: path.basename(p), size, mimetype: 'application/octet-stream' } as Express.Multer.File;
        }),
      );

    const student = async (code: string) => {
      const s = await prisma.student.findFirst({ where: { studentCode: code }, include: { user: true } });
      if (!s) throw new Error(`Không có sinh viên ${code}`);
      if (!(await prisma.sectionStudent.findUnique({ where: { sectionId_studentId: { sectionId: a.sectionId, studentId: s.id } } })))
        throw new Error(`${code} không thuộc lớp ${opt.section}`);
      return s;
    };

    let ok = 0;
    let fail = 0;
    let profiles = 0;
    const ensureProfile = async (s: { id: string; profileCompletedAt: Date | null }) => {
      if (s.profileCompletedAt || opt.dryRun) return;
      await prisma.student.update({ where: { id: s.id }, data: { profileCompletedAt: new Date() } });
      profiles++;
    };

    const submitOne = async (label: string, s: { id: string; userId: string; profileCompletedAt: Date | null }, dir: string, kind: SubmitInput['kind'], info: Info, topicFallback?: string) => {
      const { files } = await list(dir);
      if (opt.dryRun) {
        log.log(`[thử] ${label}: ${files.length} tệp${info.figmaUrl ? ' + Figma' : ''}${info.gitUrl ? ' + Git' : ''}`);
        ok++;
        return;
      }
      await ensureProfile(s);
      if (topicFallback !== undefined) {
        const has = await prisma.topic.findFirst({ where: kind === 'GROUP_SHARED' ? { assignmentId: a.id, group: { members: { some: { studentId: s.id } } } } : { assignmentId: a.id, studentId: s.id } });
        if (info.topic || !has)
          await topics.save(s.id, s.userId, a.id, { title: (info.topic ?? topicFallback).slice(0, 200), keywords: info.keywords?.length ? info.keywords : [a.title.slice(0, 50)] });
      }
      await submissions.submit(s.id, a.id, { kind, figmaUrl: info.figmaUrl, gitUrl: info.gitUrl, note: info.note, contributionPercent: info.contributionPercent }, await asUploads(files));
      log.log(`✓ ${label}: ${files.length} tệp`);
      ok++;
    };

    const { dirs } = await list(opt.dir);
    for (const name of dirs) {
      const dir = path.join(opt.dir, name);
      try {
        const info = await readInfo(dir);
        if (a.workMode === 'INDIVIDUAL') {
          const s = await student(name.toUpperCase());
          await submitOne(`${s.studentCode} ${s.fullName}`, s, dir, 'PERSONAL', info, `${a.title} - ${s.fullName}`);
          continue;
        }
        const g = a.groups.find((x) => x.code.toUpperCase() === name.toUpperCase());
        if (!g) throw new Error(`Không có nhóm ${name} (GV cần import danh sách nhóm trước)`);
        const actor = g.members.find((m) => m.studentId === g.leaderId) ?? g.members[0];
        if (!actor) throw new Error(`Nhóm ${name} chưa có thành viên`);
        await submitOne(`Nhóm ${g.code}`, actor.student, dir, 'GROUP_SHARED', info, `${a.title} - ${g.name || g.code}`);
        // phần cá nhân của từng thành viên
        for (const sub of (await list(dir)).dirs) {
          const m = g.members.find((x) => x.student.studentCode.toUpperCase() === sub.toUpperCase());
          try {
            if (!m) throw new Error(`${sub} không thuộc nhóm ${g.code}`);
            await submitOne(`  └ ${m.student.studentCode} (phần cá nhân)`, m.student, path.join(dir, sub), 'PERSONAL', await readInfo(path.join(dir, sub)));
          } catch (e) {
            fail++;
            log.error(`✗ ${name}/${sub}: ${msg(e)}`);
          }
        }
      } catch (e) {
        fail++;
        log.error(`✗ ${name}: ${msg(e)}`);
      }
    }
    log.log(`Xong: ${ok} bài nộp thành công, ${fail} lỗi${profiles ? ` · đánh dấu đã khai báo hồ sơ cho ${profiles} SV` : ''}${opt.dryRun ? ' (chạy thử, chưa ghi gì)' : ''}`);
    if (!opt.dryRun && ok) log.log('Tệp nằm ở data/pending – API server sẽ đẩy lên Drive trong vòng ~2 phút.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(msg(e));
  process.exit(1);
});
