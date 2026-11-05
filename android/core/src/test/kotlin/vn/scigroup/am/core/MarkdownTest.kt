package vn.scigroup.am.core

import kotlin.test.Test
import kotlin.test.assertEquals

class MarkdownTest {
    @Test fun docTieuDeGachDauDongVaChuDam() {
        val d = docMarkdown("## Video tuần này\n\n- **Bàn về ý thức** (1 giờ)\n* mục hai\nChữ thường")
        assertEquals(KieuDong.TIEU_DE, d[0].kieu)
        assertEquals(2, d[0].capTieuDe)
        assertEquals("Video tuần này", d[0].doan.single().chu)
        assertEquals(KieuDong.TRONG, d[1].kieu)
        assertEquals(KieuDong.GACH_DAU_DONG, d[2].kieu)
        assertEquals(listOf(DoanChu("Bàn về ý thức", true), DoanChu(" (1 giờ)")), d[2].doan)
        assertEquals(KieuDong.GACH_DAU_DONG, d[3].kieu)
        assertEquals(KieuDong.THUONG, d[4].kieu)
    }

    @Test fun lienKetGiuChuBoUrl() {
        val d = docMarkdown("Xem [bài này](https://x.y/z) nhé")
        assertEquals("Xem bài này nhé", d.single().doan.joinToString("") { it.chu })
    }
}
