/**
 * Bật pgvector trong database rồi dựng lại hai chỉ mục HNSW.
 *
 * Chạy SAU `scripts/cai-pgvector.ps1`.
 *
 * ## Vì sao phải dựng chỉ mục ở đây chứ không để Prisma lo
 *
 * Prisma không hiểu chỉ mục HNSW nên **mỗi lần `prisma migrate dev` nó đều định
 * xoá đi** — cạm bẫy đã ghi trong `CLAUDE.md`. Để hai chỉ mục này nằm ngoài
 * migration, dựng bằng một lệnh riêng có thể chạy lại bất cứ lúc nào, thì không
 * có gì để Prisma xoá nhầm.
 *
 *   npx tsx scripts/bat-pgvector.ts
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";

/**
 * Hai bảng cần cột `vector`, và hai chỉ mục HNSW đi kèm.
 *
 * **CỘT CHƯA HỀ TỒN TẠI TRONG DATABASE.** Đã kiểm 2026-08-16: hai bảng có đủ
 * `id`, `sourceText`, `embeddingModel`, `createdAt` — nhưng không có cột
 * `vector` nào cả. Lý do dễ đoán: lượt migration đầu tiên chạy trên bản Postgres
 * không có pgvector, câu tạo cột hỏng, và phần còn lại vẫn đi tiếp. Schema
 * Prisma khai `Unsupported("vector(1024)")` nên nhìn vào file thì tưởng có.
 *
 * Nên script này tạo cột TRƯỚC rồi mới dựng chỉ mục.
 *
 * `vector_cosine_ops` chứ không phải L2: embedding của Voyage đã chuẩn hoá độ
 * dài, nên khoảng cách góc mới là thứ có nghĩa; khoảng cách thẳng chỉ lặp lại
 * đúng thông tin đó một cách vòng vo.
 */
const CAN_DUNG = [
  {
    bang: "ContentEmbedding",
    chiMuc: "ContentEmbedding_vector_idx",
  },
  {
    bang: "NoteEmbedding",
    chiMuc: "NoteEmbedding_vector_idx",
  },
];

async function main() {
  const coSan = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM pg_available_extensions WHERE name = 'vector'",
  );
  if (coSan.length === 0) {
    console.error(
      "PostgreSQL không thấy pgvector. Chạy scripts/cai-pgvector.ps1 trước.",
    );
    process.exit(1);
  }

  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  const ban = await prisma.$queryRawUnsafe<{ extversion: string }[]>(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  console.log(`✓ pgvector ${ban[0]?.extversion ?? "?"} đã bật`);

  for (const c of CAN_DUNG) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${c.bang}" ADD COLUMN IF NOT EXISTS vector vector(1024)`,
    );
    console.log(`✓ cột ${c.bang}.vector`);

    // Chỉ mục HNSW dựng ở đây chứ không nằm trong migration, và đó là chủ ý:
    // Prisma không hiểu loại chỉ mục này nên mỗi lần `migrate dev` nó đều định
    // xoá đi (xem CLAUDE.md). Nằm ngoài migration thì không có gì để xoá nhầm.
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${c.chiMuc}"
       ON "${c.bang}" USING hnsw (vector vector_cosine_ops)`,
    );
    console.log(`✓ chỉ mục ${c.chiMuc}`);
  }

  const dem = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_vector_idx'`,
  );
  console.log(`\nĐang có ${dem.length} chỉ mục vector:`);
  for (const d of dem) console.log(`  ${d.indexname}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
