package vn.scigroup.am.core

/*
 * Kiểm tra sơ bộ hai loại mã người dùng gõ hoặc dán, để báo lỗi ngay trong app
 * thay vì đi một vòng tới máy chủ. Máy chủ vẫn kiểm lại lần nữa.
 * Phải khớp với src/lib/troLyChung/theThietBi.ts và src/lib/llm/dangNhapClaude.ts.
 */

private const val BANG_CHU_GHEP = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
private val RE_MA_CLAUDE = Regex("^[A-Za-z0-9_\\-.~#=%/+]{10,2000}$")

/**
 * Mã ghép app (tạo ở trang Vận hành), dạng K7M2-QX9P. Trả mã 8 ký tự viết hoa, hoặc
 * null nếu sai dạng. Bỏ khoảng trắng và dấu gạch; không có I, O, 0, 1.
 */
fun chuanHoaMaGhep(tho: String): String? {
    val s = tho.replace(Regex("[\\s-]+"), "").uppercase()
    return s.takeIf { it.length == 8 && it.all { c -> c in BANG_CHU_GHEP } }
}

/** Mã trang Claude hiện sau khi đăng nhập (bấm Copy Code). Trả mã đã bỏ khoảng trắng, hoặc null. */
fun chuanHoaMaClaude(tho: String): String? {
    val s = tho.replace(Regex("\\s+"), "")
    return s.takeIf { RE_MA_CLAUDE.matches(it) }
}
