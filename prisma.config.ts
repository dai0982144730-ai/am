import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Việc tạo/sửa bảng cần kết nối trực tiếp, không đi qua pooler của Neon.
    // Nếu chưa khai báo DIRECT_URL thì dùng tạm DATABASE_URL.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
