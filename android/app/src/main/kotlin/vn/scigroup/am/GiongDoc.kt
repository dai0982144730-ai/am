package vn.scigroup.am

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

/**
 * Đọc to bằng giọng tiếng Việt có sẵn trên máy (Android TextToSpeech).
 * Bản này chưa chạy nền khi tắt màn hình: thoát khỏi app là dừng đọc.
 */
class GiongDoc(context: Context) {
    private var tts: TextToSpeech? = null

    /** Máy có giọng tiếng Việt dùng được. */
    var san by mutableStateOf(false)
        private set
    var dangDoc by mutableStateOf(false)
        private set
    /** Lý do không đọc được, để hiện cho người dùng. */
    var thongBao by mutableStateOf<String?>(null)
        private set

    init {
        tts = TextToSpeech(context.applicationContext) { trangThai ->
            val may = tts
            if (trangThai != TextToSpeech.SUCCESS || may == null) {
                thongBao = "Máy không bật được tính năng đọc to."
                return@TextToSpeech
            }
            val kq = may.setLanguage(Locale.forLanguageTag("vi-VN"))
            san = kq != TextToSpeech.LANG_MISSING_DATA && kq != TextToSpeech.LANG_NOT_SUPPORTED
            if (!san) {
                thongBao = "Máy chưa có giọng đọc tiếng Việt. Vào Cài đặt máy, " +
                    "mục Chuyển văn bản thành giọng nói, để cài giọng tiếng Việt."
            }
            may.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}

                override fun onDone(utteranceId: String?) {
                    // Mã có dạng "am-<thứ tự>-<tổng>"; xong đoạn cuối là hết
                    val p = utteranceId?.split("-") ?: return
                    if (p.size == 3 && p[1].toIntOrNull() == (p[2].toIntOrNull() ?: 0) - 1) dangDoc = false
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    dangDoc = false
                }
            })
        }
    }

    /** Đọc [van]. Bỏ đường dẫn, và chia nhỏ vì mỗi lần đọc có giới hạn độ dài. */
    fun doc(van: String) {
        val may = tts ?: return
        if (!san) return
        val phan = chia(sach(van))
        if (phan.isEmpty()) return
        phan.forEachIndexed { i, p ->
            may.speak(
                p,
                if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD,
                null,
                "am-$i-${phan.size}",
            )
        }
        dangDoc = true
    }

    fun dung() {
        tts?.stop()
        dangDoc = false
    }

    fun giai() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        dangDoc = false
    }

    private fun sach(van: String): String =
        van.replace(Regex("""https?://\S+"""), "").replace(Regex("""[#*_`>]+"""), "").trim()

    private fun chia(van: String, toiDa: Int = 1500): List<String> {
        val ra = mutableListOf<String>()
        val cau = van.split(Regex("""(?<=[.!?…])\s+|\n+""")).filter { it.isNotBlank() }
        val dem = StringBuilder()
        for (c in cau) {
            if (dem.isNotEmpty() && dem.length + c.length + 1 > toiDa) {
                ra += dem.toString()
                dem.clear()
            }
            // Một câu dài hơn mức cho phép: cắt cứng cho an toàn
            if (c.length > toiDa) {
                c.chunked(toiDa).forEach { ra += it }
            } else {
                if (dem.isNotEmpty()) dem.append(' ')
                dem.append(c)
            }
        }
        if (dem.isNotEmpty()) ra += dem.toString()
        return ra
    }
}
