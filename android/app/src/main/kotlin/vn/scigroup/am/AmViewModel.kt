package vn.scigroup.am

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import vn.scigroup.am.core.AmApi
import vn.scigroup.am.core.AmApiException
import vn.scigroup.am.core.KetQuaClaude
import vn.scigroup.am.core.KetQuaTimKiem
import vn.scigroup.am.core.TrangThaiClaude
import vn.scigroup.am.core.chuanHoaMaClaude
import vn.scigroup.am.core.chuanHoaMaGhep
import vn.scigroup.am.core.MucKetQua
import vn.scigroup.am.core.TomTatHomNay
import vn.scigroup.am.core.TraLoiTroLy

/** Trạng thái một lần tải dữ liệu. */
sealed interface Tai<out T> {
    data object Chua : Tai<Nothing>
    data object Dang : Tai<Nothing>
    data class Xong<T>(val gia: T) : Tai<T>
    data class Loi(val ma: String, val thongDiep: String) : Tai<Nothing>
}

/** Một tin trong màn Trò chuyện. */
data class TinNhan(
    val laToi: Boolean,
    val chu: String = "",
    val traLoi: TraLoiTroLy? = null,
    val loi: String? = null,
)

class AmViewModel(app: Application) : AndroidViewModel(app) {
    private val cauHinh = CauHinh(app)
    val giong = GiongDoc(app)

    var diaChi by mutableStateOf(cauHinh.diaChi)
        private set
    var token by mutableStateOf(cauHinh.token)
        private set
    var docTo by mutableStateOf(cauHinh.docTo)
        private set

    /** Thẻ thiết bị (sau khi ghép app bằng mã); trống nếu chưa ghép. */
    var the by mutableStateOf(cauHinh.the)
        private set

    /** Thứ app gửi lên máy chủ: thẻ thiết bị nếu đã ghép, không thì token nhập tay. */
    private val tokenDung: String get() = the.ifBlank { token }

    val daCauHinh: Boolean get() = diaChi.isNotBlank() && tokenDung.isNotBlank()

    fun luuCauHinh(diaChiMoi: String, tokenMoi: String, docToMoi: Boolean) {
        cauHinh.diaChi = diaChiMoi
        cauHinh.token = tokenMoi
        cauHinh.docTo = docToMoi
        diaChi = cauHinh.diaChi
        token = cauHinh.token
        docTo = docToMoi
    }

    /** Gọi API ở luồng nền, đổi mọi lỗi thành thông điệp tiếng Việt. */
    private suspend fun <T> goi(tokenGui: String = tokenDung, blok: (AmApi) -> T): Tai<T> = try {
        Tai.Xong(withContext(Dispatchers.IO) { blok(AmApi(diaChi, tokenGui)) })
    } catch (e: CancellationException) {
        throw e
    } catch (e: AmApiException) {
        Tai.Loi(e.ma, e.message ?: "Có lỗi khi gọi máy chủ.")
    } catch (e: Exception) {
        Tai.Loi("loi_la", "Có lỗi không rõ: ${e.message ?: e.javaClass.simpleName}")
    }

    // ---------------- Ghép app với máy chủ ----------------
    var dangGhep by mutableStateOf(false)
        private set
    /** (thành công?, câu hiển thị) của lần ghép gần nhất. */
    var ghepKq by mutableStateOf<Pair<Boolean, String>?>(null)
        private set

    /** Đổi mã ghép (tạo ở trang Vận hành của web) lấy thẻ thiết bị. */
    fun ghepApp(diaChiMoi: String, maTho: String) {
        val ma = chuanHoaMaGhep(maTho)
        if (ma == null) {
            ghepKq = false to "Mã gồm 8 chữ và số, dạng K7M2-QX9P."
            return
        }
        cauHinh.diaChi = diaChiMoi
        diaChi = cauHinh.diaChi
        dangGhep = true
        ghepKq = null
        viewModelScope.launch {
            // Chưa có thẻ nên gọi không kèm token
            when (val kq = goi("") { it.ghepApp(ma) }) {
                is Tai.Xong -> {
                    cauHinh.the = kq.gia.the
                    the = cauHinh.the
                    ghepKq = true to "Đã ghép với máy chủ. Từ giờ không cần nhập token."
                    // Dữ liệu cũ tải bằng token cũ: tải lại bằng thẻ mới
                    banTin = Tai.Chua
                    duyet = Tai.Chua
                }
                is Tai.Loi -> ghepKq = false to kq.thongDiep
                else -> Unit
            }
            dangGhep = false
        }
    }

    /** Bỏ thẻ thiết bị trên điện thoại (máy chủ không cần biết; thẻ tự hết hạn sau 90 ngày). */
    fun boGhep() {
        cauHinh.the = ""
        the = ""
        ghepKq = null
        claudeTT = Tai.Chua
        claudeKq = null
        claudeCoLink = false
        banTin = Tai.Chua
        duyet = Tai.Chua
    }

    // ---------------- Tài khoản Claude của máy chủ (cần thẻ thiết bị) ----------------
    var claudeTT by mutableStateOf<Tai<TrangThaiClaude>>(Tai.Chua)
        private set
    var claudeBan by mutableStateOf(false)
        private set
    /** (thành công?, câu hiển thị) của thao tác Claude gần nhất. */
    var claudeKq by mutableStateOf<Pair<Boolean, String>?>(null)
        private set
    /** Đã lấy link, đang chờ người dùng dán mã. */
    var claudeCoLink by mutableStateOf(false)
        private set

    private fun Tai<KetQuaClaude>.layTrangThai(): Tai<TrangThaiClaude> = when (this) {
        is Tai.Xong -> gia.trangThai?.let { Tai.Xong(it) }
            ?: Tai.Loi("phan_hoi_la", gia.message.ifBlank { "Máy chủ không trả về trạng thái." })
        is Tai.Loi -> this
        Tai.Chua -> Tai.Chua
        Tai.Dang -> Tai.Dang
    }

    fun taiTrangThaiClaude() {
        claudeTT = Tai.Dang
        viewModelScope.launch { claudeTT = goi { it.quanTriClaude("trang_thai") }.layTrangThai() }
    }

    /** Lấy link đăng nhập rồi gọi [moTrinhDuyet] để mở bằng trình duyệt của máy. */
    fun moLinkClaude(moTrinhDuyet: (String) -> Unit) {
        if (claudeBan) return
        claudeBan = true
        claudeKq = null
        viewModelScope.launch {
            when (val kq = goi { it.quanTriClaude("mo_link") }) {
                is Tai.Xong -> {
                    val url = kq.gia.url
                    if (kq.gia.ok && url != null) {
                        claudeCoLink = true
                        moTrinhDuyet(url)
                    } else {
                        claudeKq = false to kq.gia.message.ifBlank { "Không lấy được link đăng nhập." }
                    }
                }
                is Tai.Loi -> claudeKq = false to kq.thongDiep
                else -> Unit
            }
            claudeBan = false
        }
    }

    /** Chuyển mã người dùng dán (từ trang Claude) cho máy chủ. */
    fun nhapMaClaude(maTho: String) {
        val ma = chuanHoaMaClaude(maTho)
        if (ma == null) {
            claudeKq = false to "Mã không đúng dạng. Trên trang Claude bấm chép mã (Copy Code) rồi dán nguyên mã vào đây."
            return
        }
        if (claudeBan) return
        claudeBan = true
        claudeKq = null
        viewModelScope.launch {
            val kq = goi { it.quanTriClaude("nhap_ma", ma) }
            // Thành công hay mã sai thì lượt trên máy chủ đều đã đóng
            claudeCoLink = false
            when (kq) {
                is Tai.Xong -> {
                    claudeKq = kq.gia.ok to kq.gia.message.ifBlank { if (kq.gia.ok) "Đã đăng nhập." else "Đăng nhập không thành công." }
                    if (kq.gia.ok) taiTrangThaiClaude()
                }
                is Tai.Loi -> claudeKq = false to kq.thongDiep
                else -> Unit
            }
            claudeBan = false
        }
    }

    fun huyClaude() {
        claudeCoLink = false
        viewModelScope.launch { goi { it.quanTriClaude("huy") } }
    }

    /** "dang_xuat" hoặc "thu". Đăng xuất xong thì tải lại trạng thái. */
    fun viecClaude(hanhDong: String) {
        if (claudeBan) return
        claudeBan = true
        claudeKq = null
        viewModelScope.launch {
            when (val kq = goi { it.quanTriClaude(hanhDong) }) {
                is Tai.Xong -> {
                    claudeKq = kq.gia.ok to kq.gia.message
                    if (hanhDong == "dang_xuat") taiTrangThaiClaude()
                }
                is Tai.Loi -> claudeKq = false to kq.thongDiep
                else -> Unit
            }
            claudeBan = false
        }
    }

    // ---------------- Bản tin ----------------
    var banTin by mutableStateOf<Tai<TomTatHomNay>>(Tai.Chua)
        private set
    var soNgayBanTin by mutableStateOf(1)
        private set

    fun taiBanTin(soNgay: Int = soNgayBanTin) {
        soNgayBanTin = soNgay
        banTin = Tai.Dang
        viewModelScope.launch { banTin = goi { it.tomTatHomNay(soNgay) } }
    }

    // ---------------- Khám phá ----------------
    var tuKhoa by mutableStateOf("")
    var chuyenMuc by mutableStateOf<String?>(null)
    /** Nội dung 30 ngày gần nhất, nhóm theo chuyên mục: dùng khi chưa gõ từ khoá. */
    var duyet by mutableStateOf<Tai<TomTatHomNay>>(Tai.Chua)
        private set
    var timThay by mutableStateOf<Tai<KetQuaTimKiem>>(Tai.Chua)
        private set
    /** Đang xem kết quả tìm theo từ khoá (true) hay danh sách duyệt (false). */
    var dangTim by mutableStateOf(false)
        private set

    fun taiDuyet() {
        duyet = Tai.Dang
        viewModelScope.launch { duyet = goi { it.tomTatHomNay(30) } }
    }

    fun timKiem() {
        val q = tuKhoa.trim()
        if (q.isEmpty()) {
            xoaTim()
            return
        }
        dangTim = true
        timThay = Tai.Dang
        val cm = chuyenMuc
        viewModelScope.launch { timThay = goi { it.timKiem(q, chuyenMuc = cm, soLuong = 30) } }
    }

    fun xoaTim() {
        tuKhoa = ""
        dangTim = false
        timThay = Tai.Chua
    }

    // ---------------- Xem / nghe ----------------
    var dangXem by mutableStateOf<MucKetQua?>(null)
        private set
    var noiDungXem by mutableStateOf<Tai<MucKetQua>>(Tai.Chua)
        private set

    fun moXem(muc: MucKetQua) {
        giong.dung()
        dangXem = muc
        noiDungXem = Tai.Dang
        viewModelScope.launch { noiDungXem = goi { it.layNoiDung(muc.id) } }
    }

    fun dongXem() {
        giong.dung()
        dangXem = null
        noiDungXem = Tai.Chua
    }

    // ---------------- Trò chuyện ----------------
    val chat = mutableStateListOf<TinNhan>()
    var dangHoi by mutableStateOf(false)
        private set

    fun hoi(cauHoi: String) {
        val q = cauHoi.trim()
        if (q.isEmpty() || dangHoi) return
        chat.add(TinNhan(laToi = true, chu = q))
        dangHoi = true
        viewModelScope.launch {
            when (val kq = goi { it.hoi(q, cheDoGiongNoi = true) }) {
                is Tai.Xong -> {
                    chat.add(TinNhan(laToi = false, chu = kq.gia.traLoiNgan, traLoi = kq.gia))
                    if (docTo) giong.doc(kq.gia.traLoiNgan)
                }
                is Tai.Loi -> chat.add(TinNhan(laToi = false, loi = kq.thongDiep))
                else -> Unit
            }
            dangHoi = false
        }
    }

    override fun onCleared() {
        giong.giai()
    }
}
