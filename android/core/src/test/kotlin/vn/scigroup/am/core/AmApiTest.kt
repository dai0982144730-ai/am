package vn.scigroup.am.core

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AmApiTest {
    private lateinit var may: MockWebServer
    private lateinit var api: AmApi

    @Before fun dung() {
        may = MockWebServer().also { it.start() }
        api = AmApi(may.url("/").toString(), "  token-thu  ")
    }

    @After fun tat() = may.shutdown()

    private fun tra(body: String, ma: Int = 200) =
        may.enqueue(MockResponse().setResponseCode(ma).setBody(body))

    @Test fun timKiemGuiDungYeuCauVaDocDuocKhungKetQua() {
        // Ví dụ lấy nguyên từ docs/API-TRO-LY.md
        tra(
            """{"ketQua":[{"id":"clx1","tieuDe":"Bàn về ý thức","loai":"video",
            "tomTat":"Buổi vấn đáp về...","ngay":"2026-08-10","duongDan":"https://youtube.com/watch?v=x",
            "doLienQuan":0.87,"duLieuRieng":{"chuyenMuc":"triet_hoc","nguon":"Tên kênh",
            "thoiLuongGiay":3600,"luotXem":12000,"diemChatLuong":8.7,"truongPhaiTriet":"phat_giao_nguyen_thuy"}}],
            "tongSo":24,"truongLa":1}""",
        )
        val kq = api.timKiem("ý thức", chuyenMuc = "triet_hoc", soLuong = 5)

        val yc = may.takeRequest()
        assertEquals("POST", yc.method)
        assertEquals("/api/v1/tro-ly/tim-kiem", yc.path)
        assertEquals("Bearer token-thu", yc.getHeader("Authorization"))
        val gui = yc.body.readUtf8()
        assertTrue("\"tuKhoa\":\"ý thức\"" in gui, gui)
        assertTrue("\"chuyenMuc\":\"triet_hoc\"" in gui, gui)
        assertTrue("\"soLuong\":5" in gui, gui)

        assertEquals(24, kq.tongSo)
        val m = kq.ketQua.single()
        assertEquals("triet_hoc", m.chuyenMuc)
        assertEquals("Tên kênh", m.nguon)
        assertEquals(3600, m.thoiLuongGiay)
        assertEquals(8.7, m.diemChatLuong)
        assertEquals(0.87, m.doLienQuan)
    }

    @Test fun soLuongBiKepTrongKhoang1Den50() {
        tra("""{"ketQua":[],"tongSo":0}""")
        api.timKiem("a", soLuong = 999)
        assertTrue("\"soLuong\":50" in may.takeRequest().body.readUtf8())
    }

    @Test fun mucThieuTruongVanDocDuoc() {
        tra("""{"ketQua":[{"id":"a","tieuDe":"T","ngay":null,"duongDan":null}],"tongSo":1}""")
        val m = api.timKiem("x").ketQua.single()
        assertNull(m.ngay)
        assertNull(m.chuyenMuc)
        assertNull(m.thoiLuongGiay)
        assertEquals("", m.tomTat)
    }

    @Test fun hoiTraVeHaiBanTraLoi() {
        tra(
            """{"traLoiNgan":"Có ba video.","traLoiDay":"## Video\n- **A**",
            "nguonThamKhao":[{"id":"1","tieuDe":"A","duongDan":null}],"trang":"am"}""",
        )
        val kq = api.hoi("Có gì hay?")
        assertEquals("Có ba video.", kq.traLoiNgan)
        assertEquals(1, kq.nguonThamKhao.size)
        assertTrue("\"cheDoGiongNoi\":true" in may.takeRequest().body.readUtf8())
    }

    @Test fun layNoiDungMaHoaIdTrongDuongDan() {
        tra("""{"id":"a b","tieuDe":"T","noiDung":"Toàn văn"}""")
        val m = api.layNoiDung("a b")
        assertEquals("Toàn văn", m.noiDung)
        assertEquals("/api/v1/tro-ly/noi-dung/a%20b", may.takeRequest().path)
    }

    @Test fun tomTatHomNayDocNhomVaCo() {
        tra(
            """{"trang":"am","tuNgay":"2026-08-11","tongSo":12,"nhom":[{"chuyenMuc":"ai","tenHienThi":"AI",
            "soLuong":7,"noiDung":[{"id":"1","tieuDe":"A"}]}],"traLoiNgan":"Có mười hai.","traLoiDay":"## x",
            "tuBanTinDaSoan":true}""",
        )
        val t = api.tomTatHomNay(soNgay = 99)
        assertEquals("/api/v1/tro-ly/tom-tat-hom-nay?soNgay=30", may.takeRequest().path)
        assertEquals("AI", t.nhom.single().tenHienThi)
        assertTrue(t.tuBanTinDaSoan)
    }

    @Test fun loiMayChuDuocDichRaThongDiepVaMa() {
        tra("""{"loi":{"ma":"token_sai","thongDiep":"Token không hợp lệ."}}""", 401)
        val e = assertFailsWith<AmApiException> { api.sucKhoe() }
        assertEquals("token_sai", e.ma)
        assertEquals("Token không hợp lệ.", e.message)
        assertEquals(401, e.httpStatus)
    }

    @Test fun loiKhongPhaiJsonVanRaThongDiepTiengViet() {
        tra("<html>Bad gateway</html>", 502)
        val e = assertFailsWith<AmApiException> { api.sucKhoe() }
        assertEquals("loi_he_thong", e.ma)
        assertEquals("Máy chủ báo lỗi 502.", e.message)
    }

    @Test fun phanHoiRacBaoLoiDeHieu() {
        tra("không phải json")
        assertEquals("phan_hoi_la", assertFailsWith<AmApiException> { api.sucKhoe() }.ma)
    }

    @Test fun matKetNoiBaoLoiTiengViet() {
        may.shutdown()
        assertEquals("mat_ket_noi", assertFailsWith<AmApiException> { api.sucKhoe() }.ma)
    }

    @Test fun diaChiSaiVaTokenTrongBaoTruocKhiGoiMang() {
        assertEquals("cau_hinh_sai", assertFailsWith<AmApiException> { AmApi("abc", "t").sucKhoe() }.ma)
        assertEquals("cau_hinh_sai", assertFailsWith<AmApiException> { AmApi("http://x.test", " ").sucKhoe() }.ma)
    }

    @Test fun diaChiCoDauGachCuoiVaDuongDanConVanDung() {
        val a = AmApi(may.url("/").toString().trimEnd('/') + "///", "t")
        tra("""{"trang":"am","database":"ok"}""")
        assertEquals("ok", a.sucKhoe().database)
        assertEquals("/api/v1/tro-ly/suc-khoe", may.takeRequest().path)
    }

    // Ba phản hồi dưới đây lấy nguyên văn từ máy chủ Am thật (next dev, database giả)
    @Test fun phanHoiThatCuaMayChu() {
        tra("""{"trang":"am","phienBanApi":"v1","database":"loi","soBanGhi":{},"thoiGianPhanHoiMs":211,"loi":"Không kết nối được tới máy chủ database. (mã P1001)"}""")
        val s = api.sucKhoe()
        assertEquals("loi", s.database)
        assertTrue(s.loi!!.contains("P1001"))

        tra("""{"loi":{"ma":"token_sai","thongDiep":"Token không hợp lệ."}}""", 401)
        assertEquals("token_sai", assertFailsWith<AmApiException> { api.sucKhoe() }.ma)

        tra("""{"loi":{"ma":"tham_so_sai","thongDiep":"tuKhoa: thiếu, hoặc không phải chuỗi chữ"}}""", 400)
        val e = assertFailsWith<AmApiException> { api.timKiem("x") }
        assertEquals("tham_so_sai", e.ma)
        assertEquals(400, e.httpStatus)
    }
}
