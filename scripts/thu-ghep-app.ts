/**
 * Thử ghép app Android: mã ghép, thẻ thiết bị, và tuyến quản trị Claude.
 *
 *   npx tsx scripts/thu-ghep-app.ts
 *
 * Gọi thẳng các hàm xử lý của tuyến (không cần database, không cần dựng máy chủ),
 * kèm Claude CLI giả. Chưa chứng minh được: bấm nút trên trang Vận hành bằng
 * phiên đăng nhập Google thật, và app Android thật gọi qua mạng.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { taoGiaCli } from "./gia-claude-cli";

const nha = fs.mkdtempSync(path.join(os.tmpdir(), "am-thu-ga-"));
process.env.HOME = nha;
process.env.USERPROFILE = nha;
process.env.AUTH_SECRET = "gia-secret-chi-de-thu-nghiem-123456";
process.env.EMAIL_CHU_DU_AN = "Chu.Thu@Example.com";
process.env.TOKEN_TRO_LY = "token-tinh-du-dai-de-thu-nghiem";
process.env.CLAUDE_CLI_PATH = taoGiaCli(nha);
process.env.GHI_LOG = path.join(nha, "log.jsonl");
process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:5432/khong-ton-tai"; // giả: không có truy vấn nào chạy thật

let loi = 0;
function kiem(ten: string, dung: boolean, chiTiet?: unknown) {
  console.log(`${dung ? "ĐẠT  " : "HỎNG "} ${ten}${dung ? "" : "  → " + JSON.stringify(chiTiet)}`);
  if (!dung) loi++;
}

const goi = (duong: string, than: unknown, tieuDe: Record<string, string> = {}) =>
  new Request(`http://may-chu.test${duong}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...tieuDe },
    body: JSON.stringify(than),
  });
const dang = (token: string) => ({ authorization: `Bearer ${token}` });

async function main() {
  const t = await import("@/lib/troLyChung/theThietBi");
  const xt = await import("@/lib/troLyChung/xacThucTokenTroLy");
  const ghep = await import("@/app/api/v1/tro-ly/ghep-app/route");
  const quanTri = await import("@/app/api/v1/tro-ly/quan-tri/claude/route");

  // ---- Thẻ thiết bị ----
  const the = t.taoThe("chu.thu@example.com")!;
  kiem("thẻ có tiền tố am1.", the.the.startsWith("am1."));
  const k = t.kiemThe(the.the);
  kiem("thẻ hợp lệ, email chuẩn hoá chữ thường", k.hopLe && k.email === "chu.thu@example.com", k);
  kiem("thẻ hết hạn sau 90 ngày", (() => { const r = t.kiemThe(the.the, Date.now() + 91 * 86400_000); return !r.hopLe && r.lyDo === "het_han"; })());
  kiem("thẻ còn hạn ở ngày 89", t.kiemThe(the.the, Date.now() + 89 * 86400_000).hopLe);

  const [phan, ky] = the.the.slice(4).split(".");
  const duLieuGia = Buffer.from(JSON.stringify({ e: "ke.xau@example.com", t: 1, x: 9999999999 })).toString("base64url");
  kiem("sửa nội dung thẻ: sai chữ ký", !t.kiemThe(`am1.${duLieuGia}.${ky}`).hopLe);
  kiem("sửa chữ ký: bị loại", !t.kiemThe(`am1.${phan}.${ky.slice(0, -2)}AA`).hopLe);
  kiem("thẻ thiếu phần: bị loại", !t.kiemThe(`am1.${phan}`).hopLe && !t.kiemThe("am1.").hopLe);
  kiem("thẻ có phần thừa: bị loại", !t.kiemThe(`${the.the}.x`).hopLe);
  kiem("không phải thẻ: khong_phai_the", (() => { const r = t.kiemThe("abc"); return !r.hopLe && r.lyDo === "khong_phai_the"; })());

  process.env.EMAIL_CHU_DU_AN = "nguoi.khac@example.com";
  kiem("đổi email chủ dự án: thẻ cũ mất hiệu lực", (() => { const r = t.kiemThe(the.the); return !r.hopLe && r.lyDo === "sai_chu_nhan"; })());
  process.env.EMAIL_CHU_DU_AN = "Chu.Thu@Example.com";

  const khoaCu = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "khoa-khac-hoan-toan-987654321";
  kiem("đổi AUTH_SECRET: mọi thẻ cũ mất hiệu lực", !t.kiemThe(the.the).hopLe);
  process.env.AUTH_SECRET = khoaCu;
  kiem("thẻ ký bằng khoá cũ lại hợp lệ khi khôi phục khoá", t.kiemThe(the.the).hopLe);

  // ---- Mã ghép ----
  const m = t.taoMaGhep("chu.thu@example.com");
  kiem("mã dạng XXXX-XXXX, không có chữ dễ nhầm", /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(m.ma), m.ma);
  kiem("mã sống đúng 5 phút", Math.abs(m.hetHanLuc - Date.now() - 300_000) < 2000);
  kiem("chuanHoaMaGhep chịu chữ thường và dấu gạch", t.chuanHoaMaGhep(m.ma.toLowerCase()) === m.ma.replace("-", ""));
  kiem("chuanHoaMaGhep loại mã sai dạng", t.chuanHoaMaGhep("ABC") === null && t.chuanHoaMaGhep("0O1I0O1I") === null);

  // đổi mã qua tuyến
  const r1 = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: m.ma.toLowerCase() }, { "x-forwarded-for": "10.0.0.1" }));
  const j1 = (await r1.json()) as { the?: string; hetHanLuc?: string; email?: string };
  kiem("đổi mã đúng: 200 và có thẻ", r1.status === 200 && !!j1.the?.startsWith("am1.") && j1.email === "chu.thu@example.com", j1);
  kiem("hạn thẻ trả về là ngày giờ ISO", !Number.isNaN(Date.parse(j1.hetHanLuc ?? "")));
  const r2 = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: m.ma }, { "x-forwarded-for": "10.0.0.1" }));
  kiem("mã dùng một lần: lần hai 401", r2.status === 401, await r2.clone().text());
  const r3 = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: "xx" }));
  kiem("mã sai dạng: 400", r3.status === 400);
  const r4 = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", {}));
  kiem("thiếu mã: 400", r4.status === 400);
  const r5 = await ghep.POST(new Request("http://may-chu.test/x", { method: "POST", body: "không phải json" }));
  kiem("thân không phải JSON: 400", r5.status === 400);

  // mã hết hạn
  const mh = t.taoMaGhep("chu.thu@example.com", Date.now() - 6 * 60_000);
  const hh = t.doiMaLayThe(mh.ma, "nguon-het-han");
  kiem("mã quá 5 phút: bị từ chối", !hh.ok);

  // đoán sai quá nhiều
  let bi401 = 0, bi429 = 0;
  for (let i = 0; i < 14; i++) {
    const r = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: "AAAA-AAAA" }, { "x-forwarded-for": "9.9.9.9" }));
    if (r.status === 401) bi401++;
    if (r.status === 429) bi429++;
  }
  kiem("đoán sai: 10 lần 401 rồi bị khoá 429", bi401 === 10 && bi429 === 4, { bi401, bi429 });
  const mMoi = t.taoMaGhep("chu.thu@example.com");
  const khoa = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: mMoi.ma }, { "x-forwarded-for": "9.9.9.9" }));
  kiem("nguồn đang bị khoá: mã ĐÚNG cũng bị chặn", khoa.status === 429);
  const khac = await ghep.POST(goi("/api/v1/tro-ly/ghep-app", { ma: mMoi.ma }, { "x-forwarded-for": "8.8.8.8" }));
  kiem("nguồn khác không bị ảnh hưởng", khac.status === 200);

  // giữ tối đa 5 mã chờ
  const dsMa = Array.from({ length: 7 }, () => t.taoMaGhep("chu.thu@example.com").ma);
  kiem("tạo 7 mã: 2 mã cũ nhất bị bỏ", !t.doiMaLayThe(dsMa[0], "n1").ok && t.doiMaLayThe(dsMa[6], "n2").ok);

  // ---- Xác thực: thẻ thiết bị vs token tĩnh ----
  const theTuTuyen = j1.the!;
  const reqThe = new Request("http://may-chu.test/x", { headers: dang(theTuTuyen) });
  const xthe = xt.xacThucTokenTroLy(reqThe);
  kiem("thẻ thiết bị qua xác thực chung, đánh dấu laTheThietBi", xthe.hopLe && xthe.laTheThietBi === true && xthe.nhanToken!.startsWith("the:"), xthe);
  const xtinh = xt.xacThucTokenTroLy(new Request("http://may-chu.test/x", { headers: dang(process.env.TOKEN_TRO_LY!) }));
  kiem("TOKEN_TRO_LY vẫn dùng được, không phải thẻ", xtinh.hopLe && !xtinh.laTheThietBi, xtinh);
  const tokenCu = process.env.TOKEN_TRO_LY;
  delete process.env.TOKEN_TRO_LY;
  kiem("không khai TOKEN_TRO_LY vẫn dùng được thẻ", xt.xacThucTokenTroLy(reqThe).hopLe);
  process.env.TOKEN_TRO_LY = tokenCu;
  const xhong = xt.xacThucTokenTroLy(new Request("http://may-chu.test/x", { headers: dang(theTuTuyen.slice(0, -3) + "AAA") }));
  kiem("thẻ hỏng: 401 token_sai", !xhong.hopLe && xhong.maLoi === "token_sai", xhong);

  // ---- Tuyến quản trị Claude ----
  const qt = (than: unknown, token?: string) =>
    quanTri.POST(goi("/api/v1/tro-ly/quan-tri/claude", than, token ? dang(token) : {}));
  kiem("không có Authorization: 401", (await qt({ hanhDong: "trang_thai" })).status === 401);
  const rTinh = await qt({ hanhDong: "trang_thai" }, process.env.TOKEN_TRO_LY);
  const jTinh = (await rTinh.json()) as { loi?: { ma: string; thongDiep: string } };
  kiem("TOKEN_TRO_LY KHÔNG đủ quyền quản trị: 401", rTinh.status === 401 && /ghép app/.test(jTinh.loi?.thongDiep ?? ""), jTinh);
  kiem("hành động lạ: 400", (await qt({ hanhDong: "xoa_het" }, theTuTuyen)).status === 400);

  const tt0 = (await (await qt({ hanhDong: "trang_thai" }, theTuTuyen)).json()) as { ok: boolean; trangThai: { daCaiCli: boolean; daDangNhap: boolean; dungTaiKhoanRieng: boolean } };
  kiem("trạng thái ban đầu: đã cài CLI, chưa đăng nhập", tt0.ok && tt0.trangThai.daCaiCli && !tt0.trangThai.daDangNhap && !tt0.trangThai.dungTaiKhoanRieng, tt0);

  const ml = (await (await qt({ hanhDong: "mo_link" }, theTuTuyen)).json()) as { ok: boolean; url?: string };
  kiem("mo_link: có link đăng nhập", ml.ok && !!ml.url?.startsWith("https://claude.ai/oauth/authorize?"), ml);

  const ngan = (await (await qt({ hanhDong: "nhap_ma", ma: "abc" }, theTuTuyen)).json()) as { ok: boolean; message: string };
  kiem("nhap_ma: mã sai dạng báo tiếng Việt, chưa chạm vào CLI", !ngan.ok && /không đúng dạng/.test(ngan.message), ngan);
  const sai = (await (await qt({ hanhDong: "nhap_ma", ma: "MA-SAI-0000000000" }, theTuTuyen)).json()) as { ok: boolean; message: string };
  kiem("nhap_ma: mã sai bị CLI từ chối", !sai.ok && /không đúng|quá hạn/.test(sai.message), sai);

  await qt({ hanhDong: "mo_link" }, theTuTuyen);
  const dung = (await (await qt({ hanhDong: "nhap_ma", ma: "MA-DUNG-1234567890" }, theTuTuyen)).json()) as { ok: boolean; message: string };
  kiem("nhap_ma: mã đúng thành công", dung.ok, dung);

  const tt1 = (await (await qt({ hanhDong: "trang_thai" }, theTuTuyen)).json()) as { trangThai: { daDangNhap: boolean; dungTaiKhoanRieng: boolean; email?: string } };
  kiem("sau đăng nhập: trạng thái đúng email, tài khoản riêng", tt1.trangThai.daDangNhap && tt1.trangThai.dungTaiKhoanRieng && tt1.trangThai.email === "chu@vi-du.test", tt1);

  await qt({ hanhDong: "mo_link" }, theTuTuyen);
  const huy = (await (await qt({ hanhDong: "huy" }, theTuTuyen)).json()) as { ok: boolean };
  kiem("huy: ok", huy.ok);

  const xuat = (await (await qt({ hanhDong: "dang_xuat" }, theTuTuyen)).json()) as { ok: boolean; message: string };
  kiem("dang_xuat: xoá được đăng nhập riêng", xuat.ok, xuat);
  const xuat2 = (await (await qt({ hanhDong: "dang_xuat" }, theTuTuyen)).json()) as { ok: boolean };
  kiem("dang_xuat lần hai: báo không có gì để xoá", !xuat2.ok);

  fs.rmSync(nha, { recursive: true, force: true });
  console.log(loi === 0 ? "\nTất cả ĐẠT." : `\n${loi} mục HỎNG.`);
  process.exit(loi === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
