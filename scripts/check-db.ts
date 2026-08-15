/**
 * Kiểm tra tình trạng database.
 *
 *   npx tsx scripts/check-db.ts
 *
 * Dùng để xác nhận kết nối chạy được, bảng đã tạo đủ, và pgvector đã bật.
 */
import "dotenv/config";
import { Client } from "pg";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Thiếu DATABASE_URL trong file .env");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const tables = await client.query<{ count: string }>(
    `SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  console.log(`Số bảng trong database: ${tables.rows[0].count}`);

  const ext = await client.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
  );
  console.log(`pgvector: ${ext.rowCount ? "đã bật" : "CHƯA bật"}`);

  const vectorCols = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'vector'`,
  );
  console.log(
    `Cột vector: ${
      vectorCols.rowCount
        ? vectorCols.rows.map((r) => r.table_name).join(", ")
        : "CHƯA có"
    }`,
  );

  // Hai chỉ mục HNSW cho tìm kiếm ngữ nghĩa. Đây là thứ DỄ MẤT NHẤT trong cả
  // database: Prisma không biết chúng tồn tại nên lần nào tạo migration cũng
  // chèn sẵn lệnh `DROP INDEX`. Quên xoá hai dòng đó một lần là mất, mà mất thì
  // không có gì báo — tìm kiếm vẫn chạy, chỉ chậm dần đi. Nên phải kiểm ở đây.
  const idx = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname LIKE '%_vector_idx'`,
  );
  const CAN_CO = ["ContentEmbedding_vector_idx", "NoteEmbedding_vector_idx"];
  const dangCo = idx.rows.map((r) => r.indexname);
  const thieu = CAN_CO.filter((t) => !dangCo.includes(t));
  console.log(
    `Chỉ mục tìm kiếm ngữ nghĩa: ${
      thieu.length === 0
        ? `đủ cả ${CAN_CO.length}`
        : `THIẾU ${thieu.join(", ")} — xem mục "Cạm bẫy" trong CLAUDE.md`
    }`,
  );

  const migrations = await client.query<{ migration_name: string; finished_at: Date | null }>(
    `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`,
  );
  console.log("\nCác migration đã chạy:");
  for (const m of migrations.rows) {
    console.log(`  ${m.finished_at ? "✓" : "… đang chạy"}  ${m.migration_name}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("Lỗi:", err.message);
  process.exit(1);
});
