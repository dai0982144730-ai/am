/**
 * Việc quét hằng đêm — gộp cả sáu bước thành một lệnh.
 *
 * VÌ SAO CẦN: trước đây mỗi tối phải mở terminal gõ sáu lệnh riêng lẻ, đúng thứ
 * tự, và tự nhớ bước nào chạy trước bước nào. Như vậy thì đây là một bộ công cụ
 * chứ chưa phải trợ lý. Bản thiết kế nói rõ: quét tự động một lần mỗi ngày lúc
 * 21:00 giờ Việt Nam, để sáng hôm sau đã có sẵn nội dung.
 *
 * THỨ TỰ SÁU BƯỚC — không đảo được, vì bước sau ăn kết quả bước trước:
 *
 *   1. Quét video mới từ các kênh YouTube đã đăng ký
 *   2. Quét bài mới từ blog và diễn đàn AI
 *   3. Lấy lời thoại cho video mới (nhạc được bỏ qua từ bước 1)
 *   4. Nhờ Claude phân loại vào chuyên mục
 *   5. Chấm điểm chất lượng vòng 1 (bằng số liệu)
 *   6. Vòng 2 — Claude đọc bình luận của nhóm đứng đầu, rồi chấm lại
 *
 * NGUYÊN TẮC: **một bước hỏng không được làm chết cả đêm**. Mạng chập chờn,
 * YouTube đổi API, hết hạn mức — đều là chuyện thường. Mỗi bước tự bắt lỗi của
 * mình, ghi lại, rồi để các bước sau chạy tiếp với dữ liệu đang có.
 */

import { prisma } from "@/lib/db/prisma";
import { phanLoaiHangLoat } from "@/lib/llm/luuPhanLoai";
import { thuatLaiHangLoat } from "@/lib/llm/luuThuatLai";
import { quetBlog } from "@/lib/nguon/quetBlog";
import { chamDiemHangLoat } from "@/lib/scoring/chamDiem";
import { chayVongHai } from "@/lib/scoring/vongHaiBinhLuan";
import { layLoiThoaiHangLoat } from "@/lib/youtube/loiThoai";
import { dongBoNguonTuKenhDaDangKy, quetVideoMoi } from "@/lib/youtube/quetKenh";

/**
 * Giới hạn mỗi đêm.
 *
 * Đặt vừa phải có chủ đích: quét hết mọi thứ trong một đêm sẽ chạm hạn mức
 * YouTube và hạn mức gói Claude Pro. Phần chưa xử lý hết sẽ được làm nốt vào
 * đêm sau — kho vẫn đầy dần lên, chỉ là từ tốn.
 */
export const GIOI_HAN_MOI_DEM = {
  /** Số video xét mỗi kênh */
  videoMoiKenh: 8,
  /** Chỉ lấy nội dung đăng trong ngần này ngày */
  soNgayGanDay: 3,
  /** Số bài xét mỗi nguồn blog */
  baiMoiNguonBlog: 8,
  /** Số video lấy lời thoại */
  soLoiThoai: 120,
  /** Số nội dung nhờ Claude phân loại */
  soPhanLoai: 80,
  /** Số bài viết thuật lại sang tiếng Việt */
  soThuatLai: 5,
  /** Số ứng viên đứng đầu được đọc bình luận */
  soDocBinhLuan: 20,
} as const;

export interface KetQuaMotBuoc {
  ten: string;
  thanhCong: boolean;
  tomTat: string;
  giay: number;
}

export interface KetQuaQuetDem {
  batDau: Date;
  ketThuc: Date;
  cacBuoc: KetQuaMotBuoc[];
  soBuocHong: number;
}

/**
 * Chạy một bước, tự bắt lỗi.
 *
 * Trả về kết quả kể cả khi hỏng, để các bước sau vẫn chạy tiếp.
 */
async function chayMotBuoc(
  ten: string,
  viec: () => Promise<string>,
  bao?: (dong: string) => void,
): Promise<KetQuaMotBuoc> {
  const batDau = Date.now();
  bao?.(`\n▶ ${ten}`);

  try {
    const tomTat = await viec();
    const giay = Math.round((Date.now() - batDau) / 1000);
    bao?.(`  ✓ ${tomTat} (${giay}s)`);
    return { ten, thanhCong: true, tomTat, giay };
  } catch (e) {
    const giay = Math.round((Date.now() - batDau) / 1000);
    const loi = e instanceof Error ? e.message : String(e);
    bao?.(`  ✗ ${loi.slice(0, 160)} (${giay}s)`);
    return { ten, thanhCong: false, tomTat: loi.slice(0, 300), giay };
  }
}

/**
 * Chạy trọn việc quét đêm.
 *
 * Ghi lại vào bảng `JobRun` để biết đêm nào chạy, chạy bao lâu, hỏng ở đâu.
 * Dùng `idempotencyKey` theo ngày nên chạy hai lần trong cùng một ngày sẽ không
 * tạo hai bản ghi — đúng cách bản thiết kế đề ra để job nền chạy lại an toàn.
 */
export async function quetDem(
  bao?: (dong: string) => void,
): Promise<KetQuaQuetDem> {
  const batDau = new Date();
  const ngay = batDau.toISOString().slice(0, 10);
  const khoaChayLai = `quet-dem-${ngay}`;

  const banGhi = await prisma.jobRun.upsert({
    where: { idempotencyKey: khoaChayLai },
    create: {
      jobType: "quet_dem",
      idempotencyKey: khoaChayLai,
      status: "running",
    },
    update: {
      status: "running",
      attemptCount: { increment: 1 },
      startedAt: batDau,
    },
  });

  const cacBuoc: KetQuaMotBuoc[] = [];

  // ----- Bước 1: video mới từ YouTube -----
  cacBuoc.push(
    await chayMotBuoc(
      "Quét video mới từ các kênh đã đăng ký",
      async () => {
        await dongBoNguonTuKenhDaDangKy();
        const kq = await quetVideoMoi({
          soNgayGanDay: GIOI_HAN_MOI_DEM.soNgayGanDay,
          videoMoiKenh: GIOI_HAN_MOI_DEM.videoMoiKenh,
        });
        return `${kq.soKenhQuet} kênh, thêm ${kq.soVideoThemMoi} video mới${
          kq.kenhLoi.length ? `, ${kq.kenhLoi.length} kênh lỗi` : ""
        }`;
      },
      bao,
    ),
  );

  // ----- Bước 2: bài mới từ blog và diễn đàn -----
  cacBuoc.push(
    await chayMotBuoc(
      "Quét bài mới từ blog và diễn đàn AI",
      async () => {
        const kq = await quetBlog(
          GIOI_HAN_MOI_DEM.baiMoiNguonBlog,
          GIOI_HAN_MOI_DEM.soNgayGanDay,
        );
        return `${kq.soNguonQuet} nguồn, thêm ${kq.soBaiThemMoi} bài (${kq.soLayDuocToanVan} lấy được chữ)`;
      },
      bao,
    ),
  );

  // ----- Bước 3: lời thoại -----
  cacBuoc.push(
    await chayMotBuoc(
      "Lấy lời thoại video mới",
      async () => {
        const kq = await layLoiThoaiHangLoat(GIOI_HAN_MOI_DEM.soLoiThoai);
        return `xét ${kq.daXet}, lấy được ${kq.layDuoc}, không có phụ đề ${kq.khongCoPhuDe}`;
      },
      bao,
    ),
  );

  // ----- Bước 4: phân loại -----
  cacBuoc.push(
    await chayMotBuoc(
      "Nhờ Claude phân loại vào chuyên mục",
      async () => {
        const kq = await phanLoaiHangLoat(GIOI_HAN_MOI_DEM.soPhanLoai);
        const theoNhom = Object.entries(kq.theoNhom)
          .map(([nhom, so]) => `${nhom} ${so}`)
          .join(", ");
        return `xong ${kq.thanhCong}/${kq.daXet}${theoNhom ? ` — ${theoNhom}` : ""}`;
      },
      bao,
    ),
  );

  // ----- Bước 5: thuật lại bài nước ngoài -----
  cacBuoc.push(
    await chayMotBuoc(
      "Thuật lại bài nước ngoài sang tiếng Việt",
      async () => {
        const kq = await thuatLaiHangLoat(GIOI_HAN_MOI_DEM.soThuatLai);
        return `thuật lại ${kq.thanhCong} bài, bỏ qua ${kq.boQuaVietSan} bài đã là tiếng Việt`;
      },
      bao,
    ),
  );

  // ----- Bước 6: chấm điểm vòng 1 -----
  cacBuoc.push(
    await chayMotBuoc(
      "Chấm điểm chất lượng (vòng 1 — bằng số liệu)",
      async () => {
        const kq = await chamDiemHangLoat();
        return `chấm ${kq.daCham} nội dung, điểm ${kq.diemThapNhat}–${kq.diemCaoNhat}`;
      },
      bao,
    ),
  );

  // ----- Bước 7: vòng 2 và chấm lại -----
  cacBuoc.push(
    await chayMotBuoc(
      "Claude đọc bình luận nhóm đứng đầu (vòng 2)",
      async () => {
        const kq = await chayVongHai(GIOI_HAN_MOI_DEM.soDocBinhLuan);
        if (kq.daCham > 0) await chamDiemHangLoat();
        return (
          `đọc ${kq.daCham} video, thảo luận trung bình ${kq.diemTrungBinh.toFixed(2)}` +
          `, ${kq.toanEmoji} video toàn emoji, ${kq.toClickbait} bị tố tiêu đề sai`
        );
      },
      bao,
    ),
  );

  const ketThuc = new Date();
  const soBuocHong = cacBuoc.filter((b) => !b.thanhCong).length;

  await prisma.jobRun.update({
    where: { id: banGhi.id },
    data: {
      status: soBuocHong === 0 ? "success" : "partial",
      finishedAt: ketThuc,
      lastError:
        soBuocHong > 0
          ? cacBuoc
              .filter((b) => !b.thanhCong)
              .map((b) => `${b.ten}: ${b.tomTat}`)
              .join("\n")
          : null,
    },
  });

  return { batDau, ketThuc, cacBuoc, soBuocHong };
}
