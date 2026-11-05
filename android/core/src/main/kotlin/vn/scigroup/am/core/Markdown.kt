package vn.scigroup.am.core

/**
 * Đọc markdown nhẹ của `traLoiDay` thành các dòng để giao diện tự vẽ.
 * Chỉ hiểu thứ máy chủ thật sự sinh ra: tiêu đề (#), gạch đầu dòng (- hoặc *),
 * và chữ đậm (**...**). Đường dẫn dạng [chữ](url) giữ phần chữ, bỏ url, vì app
 * không đưa người dùng ra khỏi app.
 */
data class DoanChu(val chu: String, val dam: Boolean = false)

enum class KieuDong { TIEU_DE, GACH_DAU_DONG, THUONG, TRONG }

data class DongMd(val kieu: KieuDong, val doan: List<DoanChu>, val capTieuDe: Int = 0)

fun docMarkdown(van: String): List<DongMd> =
    van.replace("\r\n", "\n").split('\n').map { dong ->
        val g = dong.trim()
        when {
            g.isEmpty() -> DongMd(KieuDong.TRONG, emptyList())
            g.startsWith("#") -> {
                val cap = g.takeWhile { it == '#' }.length.coerceAtMost(6)
                DongMd(KieuDong.TIEU_DE, doanDam(g.drop(cap).trim()), cap)
            }
            g.startsWith("- ") || g.startsWith("* ") ->
                DongMd(KieuDong.GACH_DAU_DONG, doanDam(g.drop(2).trim()))
            else -> DongMd(KieuDong.THUONG, doanDam(g))
        }
    }

private val LIEN_KET = Regex("""\[([^\]]+)]\([^)]*\)""")

private fun doanDam(chu: String): List<DoanChu> {
    val sach = chu.replace(LIEN_KET, "$1")
    val ra = mutableListOf<DoanChu>()
    var dam = false
    sach.split("**").forEach { phan ->
        if (phan.isNotEmpty()) ra += DoanChu(phan, dam)
        dam = !dam
    }
    return ra
}
