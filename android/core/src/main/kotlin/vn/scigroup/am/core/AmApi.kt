package vn.scigroup.am.core

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Máy khách cho cổng API trợ lý của trang `am`.
 *
 * Các hàm CHẶN luồng (gọi mạng đồng bộ) nên phải gọi từ luồng nền, ví dụ
 * `withContext(Dispatchers.IO)`. Lỗi luôn là [AmApiException] với thông điệp
 * tiếng Việt, nên giao diện chỉ cần hiện `message`.
 */
class AmApi(
    diaChi: String,
    token: String,
    private val client: OkHttpClient = macDinh(),
) {
    private val goc: HttpUrl? = diaChi.trim().trimEnd('/').toHttpUrlOrNull()
    private val token = token.trim()

    fun sucKhoe(): SucKhoe = lay("suc-khoe")

    fun timKiem(
        tuKhoa: String,
        chuyenMuc: String? = null,
        tuNgay: String? = null,
        soLuong: Int = 10,
        kemNoiDung: Boolean = false,
    ): KetQuaTimKiem = goi(
        "tim-kiem",
        buildJsonObject {
            put("tuKhoa", tuKhoa)
            if (!chuyenMuc.isNullOrBlank()) put("chuyenMuc", chuyenMuc)
            if (!tuNgay.isNullOrBlank()) put("tuNgay", tuNgay)
            put("soLuong", soLuong.coerceIn(1, 50))
            if (kemNoiDung) put("kemNoiDung", true)
        }.toString(),
    )

    fun layNoiDung(id: String): MucKetQua = lay("noi-dung", id)

    fun hoi(cauHoi: String, cheDoGiongNoi: Boolean = true): TraLoiTroLy = goi(
        "hoi",
        buildJsonObject {
            put("cauHoi", cauHoi)
            put("cheDoGiongNoi", cheDoGiongNoi)
        }.toString(),
    )

    fun tomTatHomNay(soNgay: Int = 1): TomTatHomNay =
        lay("tom-tat-hom-nay", truyVan = "soNgay" to soNgay.coerceIn(1, 30).toString())

    // ---------------------------------------------------------------

    private fun duongDan(vararg doan: String, truyVan: Pair<String, String>? = null): HttpUrl {
        val g = goc ?: throw AmApiException(
            "cau_hinh_sai",
            "Địa chỉ máy chủ chưa đúng. Vào Cài đặt, nhập dạng https://tên-miền hoặc http://địa-chỉ:3000.",
        )
        val b = g.newBuilder()
        listOf("api", "v1", "tro-ly", *doan).forEach { b.addPathSegment(it) }
        if (truyVan != null) b.addQueryParameter(truyVan.first, truyVan.second)
        return b.build()
    }

    private fun khoiTao(url: HttpUrl): Request.Builder {
        if (token.isEmpty()) {
            throw AmApiException("cau_hinh_sai", "Chưa nhập token. Vào Cài đặt để nhập.")
        }
        return Request.Builder().url(url).header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
    }

    private inline fun <reified T> lay(vararg doan: String, truyVan: Pair<String, String>? = null): T =
        chay(khoiTao(duongDan(*doan, truyVan = truyVan)).get().build())

    private inline fun <reified T> goi(endpoint: String, bodyJson: String): T =
        chay(
            khoiTao(duongDan(endpoint))
                .post(bodyJson.toRequestBody(JSON_MEDIA))
                .build(),
        )

    private inline fun <reified T> chay(yeuCau: Request): T {
        val (maHttp, noiDung) = try {
            client.newCall(yeuCau).execute().use { it.code to (it.body?.string() ?: "") }
        } catch (e: IOException) {
            throw AmApiException(
                "mat_ket_noi",
                "Không nối được tới máy chủ Am. Kiểm tra mạng, địa chỉ máy chủ, và máy chủ đã bật chưa.",
            )
        }

        if (maHttp !in 200..299) {
            val loi = try {
                JSON.decodeFromString<PhanHoiLoi>(noiDung).loi
            } catch (_: SerializationException) {
                null
            }
            throw AmApiException(
                loi?.ma?.ifBlank { null } ?: "loi_he_thong",
                loi?.thongDiep?.ifBlank { null } ?: "Máy chủ báo lỗi $maHttp.",
                maHttp,
            )
        }
        return try {
            JSON.decodeFromString<T>(noiDung)
        } catch (_: SerializationException) {
            throw AmApiException("phan_hoi_la", "Máy chủ trả về dữ liệu app không hiểu.", maHttp)
        }
    }

    companion object {
        private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

        internal val JSON = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            explicitNulls = false
        }

        /** Gọi `hoi` có thể mất vài chục giây vì máy chủ nhờ Claude trả lời. */
        fun macDinh(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .callTimeout(150, TimeUnit.SECONDS)
            .build()
    }
}
