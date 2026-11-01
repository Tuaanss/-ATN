// Nạp backend/.env (Node.js ≥ 21.7 có sẵn process.loadEnvFile, không cần dotenv).
// Phải được import đầu tiên trong main.ts, trước khi đọc cấu hình.
import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch {
  // Không có .env: dùng biến môi trường của hệ thống (Docker, CI)
}
