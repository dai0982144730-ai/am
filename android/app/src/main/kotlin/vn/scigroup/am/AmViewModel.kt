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
import vn.scigroup.am.core.KetQuaTimKiem
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

    val daCauHinh: Boolean get() = diaChi.isNotBlank() && token.isNotBlank()

    fun luuCauHinh(diaChiMoi: String, tokenMoi: String, docToMoi: Boolean) {
        cauHinh.diaChi = diaChiMoi
        cauHinh.token = tokenMoi
        cauHinh.docTo = docToMoi
        diaChi = cauHinh.diaChi
        token = cauHinh.token
        docTo = docToMoi
    }

    /** Gọi API ở luồng nền, đổi mọi lỗi thành thông điệp tiếng Việt. */
    private suspend fun <T> goi(blok: (AmApi) -> T): Tai<T> = try {
        Tai.Xong(withContext(Dispatchers.IO) { blok(AmApi(diaChi, token)) })
    } catch (e: CancellationException) {
        throw e
    } catch (e: AmApiException) {
        Tai.Loi(e.ma, e.message ?: "Có lỗi khi gọi máy chủ.")
    } catch (e: Exception) {
        Tai.Loi("loi_la", "Có lỗi không rõ: ${e.message ?: e.javaClass.simpleName}")
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
