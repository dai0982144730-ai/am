package vn.scigroup.am.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MaDangNhapTest {
    @Test fun maGhepChuanHoaChuThuongVaDauGach() {
        assertEquals("K7M2QX9P", chuanHoaMaGhep("k7m2-qx9p"))
        assertEquals("K7M2QX9P", chuanHoaMaGhep("  K7M2 QX9P\n"))
    }

    @Test fun maGhepSaiDangBiLoai() {
        assertNull(chuanHoaMaGhep("K7M2QX9"))       // thiếu 1 ký tự
        assertNull(chuanHoaMaGhep("K7M2QX9PP"))     // thừa
        assertNull(chuanHoaMaGhep("O0I1O0I1"))      // toàn chữ dễ nhầm, không có trong bảng
        assertNull(chuanHoaMaGhep(""))
    }

    @Test fun maClaudeBoKhoangTrangVaKiemDang() {
        assertEquals("MA-DUNG-1234567890", chuanHoaMaClaude(" MA-DUNG-\n1234567890 "))
        assertNull(chuanHoaMaClaude("abc"))                       // quá ngắn
        assertNull(chuanHoaMaClaude("abcdefghij\$(rm -rf /)"))    // ký tự lạ
    }
}
