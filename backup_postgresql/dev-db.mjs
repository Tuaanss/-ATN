// Chạy PostgreSQL 16 nhúng (không cần cài PostgreSQL / Docker) cho môi trường phát triển.
// Dữ liệu lưu ở backend/.pgdata, cổng 5433, tài khoản edu/edu, CSDL eduportfolio.
// Dừng bằng Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.pgdata');
const firstRun = !existsSync(path.join(dataDir, 'PG_VERSION'));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'edu',
  password: 'edu',
  port: 5433,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const stop = async () => {
  console.log('\nĐang dừng PostgreSQL...');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

if (firstRun) {
  console.log('Khởi tạo cụm PostgreSQL lần đầu...');
  await pg.initialise();
}
await pg.start();
if (firstRun) {
  await pg.createDatabase('eduportfolio');
  console.log('Đã tạo CSDL eduportfolio. Chạy tiếp: npm run db:setup');
}
console.log('PostgreSQL đang chạy tại postgresql://edu:edu@localhost:5433/eduportfolio (Ctrl+C để dừng)');
