package vn.scigroup.am.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

/*
 * Dữ liệu cổng API trợ lý của trang `am` (đường dẫn /api/v1/tro-ly/...).
 * Khớp với src/lib/troLyChung/kieuDuLieu.ts và docs/API-TRO-LY.md ở gốc repo.
 * Mọi trường có giá trị mặc định: máy chủ thiếu một trường thì app vẫn chạy.
 */

/** Một mục kết quả (video hoặc bài viết). */
@Serializable
data class MucKetQua(
    val id: String,
    val tieuDe: String = "",
    /** "video" hoặc "baiViet" (ba loại còn lại thuộc trang khác). */
    val loai: String = "baiViet",
    val tomTat: String = "",
    /** yyyy-mm-dd, hoặc null khi nguồn không cho biết. */
    val ngay: String? = null,
    val duongDan: String? = null,
    /** 0–1, càng gần 1 càng khớp. */
    val doLienQuan: Double = 0.0,
    val duLieuRieng: JsonObject = JsonObject(emptyMap()),
    /** Toàn văn / lời thoại, chỉ có khi gọi kèm nội dung. */
    val noiDung: String? = null,
) {
    private fun chuoi(khoa: String): String? =
        (duLieuRieng[khoa] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull

    /** ai · triet_hoc · truyen · music · new_search · other */
    val chuyenMuc: String? get() = chuoi("chuyenMuc")
    val nguon: String? get() = chuoi("nguon")
    val thoiLuongGiay: Int? get() = (duLieuRieng["thoiLuongGiay"] as? JsonPrimitive)?.intOrNull
    val diemChatLuong: Double? get() = (duLieuRieng["diemChatLuong"] as? JsonPrimitive)?.doubleOrNull
}

@Serializable
data class KetQuaTimKiem(
    val ketQua: List<MucKetQua> = emptyList(),
    val tongSo: Int = 0,
)

@Serializable
data class NguonThamKhao(
    val id: String = "",
    val tieuDe: String = "",
    val duongDan: String? = null,
)

/**
 * Câu trả lời của trợ lý. Hai bản: [traLoiNgan] để ĐỌC thành tiếng (không
 * markdown, không URL), [traLoiDay] để HIỆN lên màn hình.
 */
@Serializable
data class TraLoiTroLy(
    val traLoiNgan: String = "",
    val traLoiDay: String = "",
    val nguonThamKhao: List<NguonThamKhao> = emptyList(),
    val trang: String = "am",
)

@Serializable
data class NhomNoiDung(
    val chuyenMuc: String = "",
    val tenHienThi: String = "",
    val soLuong: Int = 0,
    val noiDung: List<MucKetQua> = emptyList(),
)

@Serializable
data class TomTatHomNay(
    val trang: String = "am",
    val tuNgay: String? = null,
    val tongSo: Int = 0,
    val nhom: List<NhomNoiDung> = emptyList(),
    val traLoiNgan: String = "",
    val traLoiDay: String = "",
    /** true = bản tin Claude đã soạn; false = tự gom nội dung mới nhất. */
    val tuBanTinDaSoan: Boolean = false,
)

@Serializable
data class SucKhoe(
    val trang: String = "am",
    val phienBanApi: String = "",
    /** "ok" hoặc "loi". */
    val database: String = "",
    val soBanGhi: Map<String, Int> = emptyMap(),
    val thoiGianPhanHoiMs: Int = 0,
    val loi: String? = null,
)

@Serializable
internal data class PhanHoiLoi(val loi: ChiTietLoi? = null)

@Serializable
internal data class ChiTietLoi(val ma: String = "", val thongDiep: String = "")

/**
 * Lỗi khi gọi cổng API. [ma] là mã của máy chủ (thieu_token, token_sai,
 * goi_qua_nhieu, tham_so_sai, khong_tim_thay, loi_he_thong) hoặc mã do app tự
 * đặt: cau_hinh_sai, mat_ket_noi, phan_hoi_la.
 * [message] luôn là câu tiếng Việt đọc được ngay cho người dùng.
 */
class AmApiException(
    val ma: String,
    thongDiep: String,
    val httpStatus: Int = 0,
) : Exception(thongDiep)
