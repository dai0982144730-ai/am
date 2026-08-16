/**
 * Cường độ quét — phần TÍNH TOÁN THUẦN, không đụng tới database.
 *
 * ## Vì sao phải tách khỏi `cuongDo.ts`
 *
 * Thanh trượt chạy ở trình duyệt và cần đọc `CUONG_DO_TOI_DA` cùng
 * `CUONG_DO_MAC_DINH`. Nếu mấy thứ đó nằm chung file với hàm hỏi database thì nhập
 * một cái là kéo theo cả prisma và thư viện `pg` xuống trình duyệt — mà `pg`
 * cần `net`, `tls`, `fs`, những thứ trình duyệt không có. Đã vấp thật: trang
 * Vận hành trắng bóc với bảy lỗi "Module not found: Can't resolve 'net'".
 *
 * Cùng lý do `giaLenh.ts` phải tách khỏi `hanMuc.ts` bên YouTube.
 *
 * ## Vì sao là MỘT con số chứ không phải mười một ô nhập
 *
 * `GIOI_HAN_MOI_DEM` có mười một định mức: bao nhiêu video mỗi kênh, bao nhiêu
 * bài mỗi blog, bao nhiêu nội dung nhờ Claude phân loại… Bày cả mười một ra cho
 * người dùng chỉnh là bắt họ hiểu cả đường ống bên trong mới chỉnh nổi, và
 * chỉnh lệch nhau thì ống nghẽn ở khúc giữa: quét về 200 video mà chỉ phân loại
 * 80 thì 120 cái kia nằm chờ vô thời hạn.
 *
 * Nhân đều tất cả bằng một hệ số thì đường ống luôn cân, và câu hỏi người dùng
 * phải trả lời rút xuống còn đúng một câu dễ: *tối nay muốn máy làm nhiều hay
 * ít?*
 *
 * ## Ba mốc có nghĩa
 *
 *   - **0%** — đứng im. Không quét, không gọi Claude, không tiêu một đơn vị hạn
 *     mức nào. Dành cho lúc đi vắng.
 *   - **100%** — như bản thiết kế gốc. Vị trí giữa thanh trượt.
 *   - **200%** — gấp đôi mọi định mức. Sẽ tiêu gấp đôi hạn mức YouTube và gói
 *     Claude Pro, nên trang Vận hành nói thẳng điều đó ngay cạnh thanh trượt.
 */

/**
 * Định mức gốc mỗi đêm, ứng với cường độ 100%.
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
  /** Số tập xét mỗi kênh podcast */
  tapMoiKenhPodcast: 5,
  /**
   * Podcast nhìn ngược lại xa hơn hẳn các nguồn khác.
   *
   * Video và blog ra hàng ngày nên nhìn lại 3 ngày là đủ. Podcast thì mỗi tuần
   * hoặc mỗi hai tuần mới có một tập — lấy mốc 3 ngày thì hầu hết các đêm chẳng
   * thấy gì, mà tập mới ra đúng hôm quét trục trặc là mất luôn. Lấy về trùng
   * không tốn gì: tập đã có trong kho thì bỏ qua ngay.
   */
  soNgayGanDayPodcast: 21,
  /** Số video lấy lời thoại */
  soLoiThoai: 120,
  /** Số nội dung nhờ Claude phân loại */
  soPhanLoai: 80,
  /** Số bài viết thuật lại sang tiếng Việt */
  soThuatLai: 5,
  /** Số ứng viên đứng đầu được đọc bình luận */
  soDocBinhLuan: 20,
  /** Số ghi chú được Claude gắn nhãn */
  soGanNhan: 30,
  /**
   * Số ngăn wiki được viết lại mỗi đêm.
   *
   * Thấp có chủ đích: mỗi ngăn tốn một lần gọi Claude cho TOÀN BỘ ghi chú
   * trong đó, và ngăn không đổi thì vốn đã bị bỏ qua từ trước. Ba ngăn một đêm
   * là dư sức theo kịp tốc độ ghi chú của một người.
   */
  soTongHopWiki: 3,
  /** Số chủ đề đem đi tìm ngoài vùng đã theo dõi. Mỗi chủ đề tốn 101 đơn vị. */
  soChuDeTuTim: 6,
  /**
   * Số bản thuật lại được đọc thành tiếng mỗi đêm.
   *
   * Đặt thấp có chủ đích: mỗi bản khoảng 9.000 ký tự, năm bản là 45.000 — một
   * tháng chạy đều là 1,35 triệu, vẫn dưới trần 4 triệu của giọng Standard
   * nhưng đã vượt trần 1 triệu của giọng Wavenet.
   */
  soDocThanhTieng: 5,
} as const;

export const CUONG_DO_MAC_DINH = 100;
export const CUONG_DO_TOI_DA = 200;

/** Các định mức sau khi đã nhân hệ số. */
export type DinhMucMotDem = { [K in keyof typeof GIOI_HAN_MOI_DEM]: number };

/** Kẹp giá trị vào dải cho phép. */
export function kepCuongDo(x: number): number {
  if (!Number.isFinite(x)) return CUONG_DO_MAC_DINH;
  return Math.max(0, Math.min(CUONG_DO_TOI_DA, Math.round(x)));
}

/**
 * Nhân các định mức theo cường độ.
 *
 * **Không nhân hai trường ngày**: `soNgayGanDay` và `soNgayGanDayPodcast` là
 * cửa sổ thời gian, không phải khối lượng. Nhân đôi chúng nghĩa là moi lại
 * nội dung của sáu ngày trước — mà thứ đó đã nằm trong kho từ các đêm trước
 * rồi, nên chỉ tốn công đọc lại để rồi bỏ đi. Kéo thanh trượt phải làm máy
 * xét *nhiều nguồn hơn*, không phải *ngoái lại xa hơn*.
 *
 * Làm tròn LÊN với hệ số nhỏ hơn 1: ở mức 10% thì `soThuatLai` (vốn là 5) sẽ
 * thành 0,5 — làm tròn xuống là 0, tức là một bước im lặng ngừng chạy hẳn dù
 * thanh trượt chưa về tận cùng bên trái. Chỉ có đúng mức 0 mới được dừng.
 */
export function apCuongDo(cuongDo: number): DinhMucMotDem {
  const heSo = kepCuongDo(cuongDo) / 100;
  const nhan = (x: number) => (heSo === 0 ? 0 : Math.max(1, Math.ceil(x * heSo)));

  return {
    videoMoiKenh: nhan(GIOI_HAN_MOI_DEM.videoMoiKenh),
    soNgayGanDay: GIOI_HAN_MOI_DEM.soNgayGanDay,
    baiMoiNguonBlog: nhan(GIOI_HAN_MOI_DEM.baiMoiNguonBlog),
    tapMoiKenhPodcast: nhan(GIOI_HAN_MOI_DEM.tapMoiKenhPodcast),
    soNgayGanDayPodcast: GIOI_HAN_MOI_DEM.soNgayGanDayPodcast,
    soLoiThoai: nhan(GIOI_HAN_MOI_DEM.soLoiThoai),
    soPhanLoai: nhan(GIOI_HAN_MOI_DEM.soPhanLoai),
    soThuatLai: nhan(GIOI_HAN_MOI_DEM.soThuatLai),
    soDocBinhLuan: nhan(GIOI_HAN_MOI_DEM.soDocBinhLuan),
    soGanNhan: nhan(GIOI_HAN_MOI_DEM.soGanNhan),
    soTongHopWiki: nhan(GIOI_HAN_MOI_DEM.soTongHopWiki),
    soChuDeTuTim: nhan(GIOI_HAN_MOI_DEM.soChuDeTuTim),
    soDocThanhTieng: nhan(GIOI_HAN_MOI_DEM.soDocThanhTieng),
  };
}
