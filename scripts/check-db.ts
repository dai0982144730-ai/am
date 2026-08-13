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
