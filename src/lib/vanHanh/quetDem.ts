/**
 * Việc quét hằng đêm — gộp cả chín bước thành một lệnh.
 *
 * VÌ SAO CẦN: trước đây mỗi tối phải mở terminal gõ sáu lệnh riêng lẻ, đúng thứ
 * tự, và tự nhớ bước nào chạy trước bước nào. Như vậy thì đây là một bộ công cụ
 * chứ chưa phải trợ lý. Bản thiết kế nói rõ: quét tự động một lần mỗi ngày lúc
 * 21:00 giờ Việt Nam, để sáng hôm sau đã có sẵn nội dung.
 *
 * THỨ TỰ CÁC BƯỚC — không đảo được, vì bước sau ăn kết quả bước trước:
 *
 *   1. Quét video mới từ các kênh YouTube đã đăng ký
 *   2. Quét bài mới từ blog và diễn đàn AI
 *   3. Tìm theo từ khoá đang quan tâm (chuyên mục "New")
 *   3b. Đi tìm ngoài vùng đã theo dõi, theo chủ đề rút từ thứ chấm điểm cao
 *   4. Lấy lời thoại cho video mới (nhạc được bỏ qua từ bước 1)
 *   5. Nhờ Claude phân loại vào chuyên mục
 *   6. Thuật lại bài nước ngoài sang tiếng Việt
 *   7. Chấm điểm chất lượng vòng 1 (bằng số liệu)
 *   8. Vòng 2 — Claude đọc bình luận của nhóm đứng đầu, rồi chấm lại
 *   9. Viết bản tin cho sáng mai — thứ người dùng thật sự đọc
 *
 * NGUYÊN TẮC: **một bước hỏng không được làm chết cả đêm**. Mạng chập chờn,
 * YouTube đổi API, hết hạn mức — đều là chuyện thường. Mỗi bước tự bắt lỗi của
 * mình, ghi lại, rồi để các bước sau chạy tiếp với dữ liệu đang có.
 */

import { prisma } from "@/lib/db/prisma";
import { apCuongDo, docCuongDo } from "@/lib/vanHanh/cuongDo";
import { phanLoaiHangLoat } from "@/lib/llm/luuPhanLoai";
import { thuatLaiHangLoat } from "@/lib/llm/luuThuatLai";
import { quetBlog } from "@/lib/nguon/quetBlog";
import { quetPodcast } from "@/lib/nguon/quetPodcast";
import { ganNhanHangLoat } from "@/lib/ghiChu/ganNhan";
import { timNguonMoi } from "@/lib/khamPha/timNguonMoi";
import { quetTuKhoaQuanTam } from "@/lib/quanTam/quetTuKhoa";
import { chamDiemHangLoat } from "@/lib/scoring/chamDiem";
import { chayVongHai } from "@/lib/scoring/vongHaiBinhLuan";
import { taoBanTin } from "@/lib/troLy/taoBanTin";
import { daCauHinh } from "@/lib/tts/doc";
import {
  taoAmThanhChoBanTin,
  taoAmThanhChoThuatLai,
} from "@/lib/tts/taoAmThanh";
import { layLoiThoaiHangLoat } from "@/lib/youtube/loiThoai";
import { dongBoNguonTuKenhDaDangKy, quetVideoMoi } from "@/lib/youtube/quetKenh";


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
 *
 * Lượng việc mỗi bước lấy từ thanh trượt cường độ trong trang Vận hành. Kéo hết
 * sang trái thì hàm này **không làm gì cả** và trả về ngay.
 */
export async function quetDem(
  bao?: (dong: string) => void,
): Promise<KetQuaQuetDem> {
  const batDau = new Date();
  const ngay = batDau.toISOString().slice(0, 10);
  const khoaChayLai = `quet-dem-${ngay}`;

  const cuongDo = await docCuongDo();
  const dinhMuc = apCuongDo(cuongDo);

  // ----- Cường độ 0: đứng im -----
  //
  // Thoát TRƯỚC khi tạo bản ghi `JobRun`. Tạo rồi mới thoát thì trang Vận hành
  // hiện một lượt chạy "thành công" mỗi đêm trong khi thật ra chẳng có gì chạy
  // — đúng kiểu màn hình nói dối mà cả trang Vận hành sinh ra để chống.
  if (cuongDo === 0) {
    bao?.("Cường độ đang đặt 0% — trợ lý đứng im, không quét gì đêm nay.");
    const ketThucNgay = new Date();
    return { batDau, ketThuc: ketThucNgay, cacBuoc: [], soBuocHong: 0 };
  }

  if (cuongDo !== 100) {
    bao?.(`Cường độ đang đặt ${cuongDo}% — mọi định mức nhân theo hệ số này.`);
  }

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
          soNgayGanDay: dinhMuc.soNgayGanDay,
          videoMoiKenh: dinhMuc.videoMoiKenh,
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
          dinhMuc.baiMoiNguonBlog,
          dinhMuc.soNgayGanDay,
        );
        return `${kq.soNguonQuet} nguồn, thêm ${kq.soBaiThemMoi} bài (${kq.soLayDuocToanVan} lấy được chữ)`;
      },
      bao,
    ),
  );

  // ----- Dọn lịch sử xem quá một tuần -----
  //
  // Chủ dự án chốt chỉ giữ bảy ngày. Trang Lịch sử chỉ LỌC để hiện; việc xoá
  // thật nằm ở đây, vì vẽ một trang mà lại xoá dữ liệu là tác dụng phụ đặt sai
  // chỗ — Next có thể vẽ lại trang bất cứ lúc nào, kể cả khi chỉ tải trước.
  //
  // Xoá khỏi lịch sử còn có tác dụng thứ hai: nội dung ấy quay lại luồng chính
  // thay vì bị chặn vĩnh viễn chỉ vì lỡ mở một lần cách đây hàng tháng.
  cacBuoc.push(
    await chayMotBuoc(
      "Dọn lịch sử xem quá một tuần",
      async () => {
        const kq = await prisma.watchHistory.deleteMany({
          where: {
            lastOpenedAt: { lt: new Date(Date.now() - 7 * 86_400_000) },
          },
        });
        return kq.count === 0 ? "không có mục nào quá hạn" : `xoá ${kq.count} mục`;
      },
      bao,
    ),
  );

  // ----- Bước 2a: tập mới từ podcast -----
  //
  // Đặt cạnh việc quét blog vì cùng tính chất: đọc feed RSS, không tốn hạn mức
  // YouTube, không gọi Claude. Rẻ nhất trong cả lượt chạy đêm.
  cacBuoc.push(
    await chayMotBuoc(
      "Quét tập mới từ podcast",
      async () => {
        const kq = await quetPodcast(
          dinhMuc.tapMoiKenhPodcast,
          dinhMuc.soNgayGanDayPodcast,
        );
        if (kq.soKenhQuet === 0) return "chưa thêm kênh podcast nào";
        return `${kq.soKenhQuet} kênh, thêm ${kq.soTapThemMoi} tập (${kq.soCoMoTa} tập có mô tả riêng)`;
      },
      bao,
    ),
  );

  // ----- Bước 2b: tìm theo từ khoá quan tâm -----
  //
  // Đặt sau việc quét kênh có chủ đích: quét kênh là việc chính và rẻ, tìm kiếm
  // thì đắt gấp 100 lần. Hết hạn mức thì thứ bị mất phải là phần tuỳ hứng, chứ
  // không phải các kênh đã theo dõi.
  cacBuoc.push(
    await chayMotBuoc(
      "Tìm theo từ khoá đang quan tâm",
      async () => {
        const kq = await quetTuKhoaQuanTam(dinhMuc.soNgayGanDay);
        if (kq.cacTuKhoa.length === 0) return "chưa đặt từ khoá nào";
        const hong = kq.cacTuKhoa.filter((t) => t.loi).length;
        return (
          `${kq.cacTuKhoa.length} từ khoá, thêm ${kq.tongThemMoi} nội dung, ` +
          `tiêu ${kq.hanMucDaTieu} đơn vị hạn mức` +
          (hong ? `, ${hong} từ lỗi` : "")
        );
      },
      bao,
    ),
  );

  // ----- Bước 2c: đi tìm ngoài vùng đã theo dõi -----
  //
  // Xếp SAU cả quét kênh lẫn từ khoá chủ nhà tự gõ, và đó là thứ tự đúng khi
  // hạn mức eo hẹp: kênh đã theo dõi là việc chính, từ khoá chủ nhà gõ là thứ
  // họ chủ động muốn, còn phần máy tự đi tìm là thứ hy sinh được.
  cacBuoc.push(
    await chayMotBuoc(
      "Tìm nội dung ngoài vùng đã theo dõi",
      async () => {
        const kq = await timNguonMoi(dinhMuc.soChuDeTuTim);
        if (kq.cacChuDe.length === 0) {
          return "chưa đủ nội dung điểm cao để rút ra chủ đề";
        }
        const loc = kq.cacChuDe.reduce((t, c) => t + c.soBiLoc, 0);
        return (
          `${kq.cacChuDe.length} chủ đề, thêm ${kq.tongThemMoi} nội dung từ ` +
          `${kq.tongKenhMoi} kênh mới, lọc bỏ ${loc}, ` +
          `tiêu ${kq.hanMucDaTieu} đơn vị hạn mức` +
          (kq.soNguonBiBo ? `, bỏ qua ${kq.soNguonBiBo} nguồn từng bị chê` : "")
        );
      },
      bao,
    ),
  );

  // ----- Bước 3: lời thoại -----
  cacBuoc.push(
    await chayMotBuoc(
      "Lấy lời thoại video mới",
      async () => {
        const kq = await layLoiThoaiHangLoat(dinhMuc.soLoiThoai);
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
        const kq = await phanLoaiHangLoat(dinhMuc.soPhanLoai);
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
        const kq = await thuatLaiHangLoat(dinhMuc.soThuatLai);
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
        const kq = await chayVongHai(dinhMuc.soDocBinhLuan);
        if (kq.daCham > 0) await chamDiemHangLoat();
        return (
          `đọc ${kq.daCham} video, thảo luận trung bình ${kq.diemTrungBinh.toFixed(2)}` +
          `, ${kq.toanEmoji} video toàn emoji, ${kq.toClickbait} bị tố tiêu đề sai`
        );
      },
      bao,
    ),
  );

  // ----- Bước 8b: gắn nhãn ghi chú mới -----
  //
  // Đặt sau mọi bước lấy nội dung: ghi chú cần đọc lời thoại quanh mốc thời
  // gian, mà lời thoại thì bước 4 mới lấy về.
  cacBuoc.push(
    await chayMotBuoc(
      "Gắn nhãn cho ghi chú mới",
      async () => {
        const kq = await ganNhanHangLoat(dinhMuc.soGanNhan);
        if (kq.daXet === 0) return "không có ghi chú mới";
        return (
          `xong ${kq.thanhCong}/${kq.daXet}` +
          (kq.soViecCanLam ? `, ${kq.soViecCanLam} việc cần làm` : "") +
          (kq.boSuuTapMoi.length ? `, ${kq.boSuuTapMoi.length} ngăn mới` : "")
        );
      },
      bao,
    ),
  );

  // ----- Bước 9: viết bản tin cho sáng mai -----
  cacBuoc.push(
    await chayMotBuoc(
      "Viết bản tin cho sáng mai",
      async () => {
        const kq = await taoBanTin(true);
        return `chắt ${kq.soNoiBat} mục nổi bật + ${kq.soXemThem} mục xem thêm từ ${kq.tongMoi} nội dung`;
      },
      bao,
    ),
  );

  // ----- Bước cuối: đọc thành tiếng -----
  //
  // Đặt SAU CÙNG, sau cả bản tin, vì nó cần bản tin đã viết xong mới có gì để
  // đọc. Và vì đây là bước duy nhất tiêu tiền thật — hỏng thì phần còn lại của
  // đêm vẫn nguyên vẹn.
  cacBuoc.push(
    await chayMotBuoc(
      "Đọc bản tin và bản thuật lại thành tiếng",
      async () => {
        if (!daCauHinh()) return "chưa cấu hình TTS_API_KEY, bỏ qua";

        const bt = await taoAmThanhChoBanTin();
        const tl = await taoAmThanhChoThuatLai(dinhMuc.soDocThanhTieng);

        const phan = [
          bt.daTao ? "bản tin xong" : `bản tin: ${bt.lyDo}`,
          tl.daXet === 0
            ? "không có bản thuật lại nào chờ"
            : `${tl.thanhCong}/${tl.daXet} bản thuật lại, ${tl.soKyTu.toLocaleString("vi-VN")} ký tự`,
        ];
        if (tl.hetHanMuc) phan.push("DỪNG vì chạm ngưỡng khoá hạn mức");
        return phan.join(" · ");
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
