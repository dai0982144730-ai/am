import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Đọc từ file .env — file này không nằm trong Git, mỗi máy tự tạo
    url: process.env["DATABASE_URL"],
  },
});
