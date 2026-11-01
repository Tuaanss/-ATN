// Chuyển dữ liệu một lần từ PostgreSQL cũ (backend/.pgdata) sang MySQL. Chạy xong có thể xóa file này.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// cột DATE giữ nguyên dạng YYYY-MM-DD (không đổi sang giờ địa phương)
pg.types.setTypeParser(1082, (v) => v);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pgs = new EmbeddedPostgres({ databaseDir: path.join(root, '.pgdata'), user: 'edu', password: 'edu', port: 5433, persistent: true });
await pgs.start();
const src = new pg.Client({ connectionString: 'postgresql://edu:edu@localhost:5433/eduportfolio' });
await src.connect();
const dst = new PrismaClient();

const tables = (await dst.$queryRawUnsafe("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'")).map((r) => r.t);
const report = [];
try {
  await dst.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of tables) {
        const exists = await src.query('SELECT to_regclass($1) AS r', [`public.${t}`]);
        if (!exists.rows[0].r) {
          report.push(`${t}: (không có trong PostgreSQL)`);
          continue;
        }
        const cols = (await tx.$queryRawUnsafe('SELECT COLUMN_NAME AS c, DATA_TYPE AS d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', t)).map((r) => ({ c: r.c, json: r.d === 'json' }));
        const { rows } = await src.query(`SELECT * FROM "${t}"`);
        await tx.$executeRawUnsafe(`DELETE FROM \`${t}\``);
        for (const row of rows) {
          const vals = cols.map(({ c, json }) => {
            const v = row[c];
            if (v == null) return null;
            // mảng enum PostgreSQL trả về dạng chuỗi {A,B}
            if (json && typeof v === 'string' && /^\{.*\}$/.test(v)) return JSON.stringify(v.slice(1, -1).split(',').filter(Boolean).map((x) => x.replace(/^"|"$/g, '')));
            if (json) return JSON.stringify(v);
            if (Array.isArray(v)) return JSON.stringify(v);
            return v;
          });
          await tx.$executeRawUnsafe(`INSERT INTO \`${t}\` (${cols.map((x) => `\`${x.c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...vals);
        }
        report.push(`${t}: ${rows.length}`);
      }
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    },
    { timeout: 600_000, maxWait: 60_000 },
  );
  console.log(report.join('\n'));
} finally {
  await src.end();
  await dst.$disconnect();
  await pgs.stop();
}
