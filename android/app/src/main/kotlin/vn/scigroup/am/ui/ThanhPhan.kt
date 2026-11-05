package vn.scigroup.am.ui

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import vn.scigroup.am.Tai
import vn.scigroup.am.core.DongMd
import vn.scigroup.am.core.KieuDong
import vn.scigroup.am.core.MucKetQua
import vn.scigroup.am.core.docMarkdown

/** Tên hiển thị và màu của từng chuyên mục (khớp bản demo). */
fun tenChuyenMuc(ma: String?): String = when (ma) {
    "ai" -> "AI"
    "triet_hoc" -> "Triết học"
    "truyen" -> "Truyện"
    "music" -> "Music"
    "khoa_hoc" -> "Khoa học"
    "new_search" -> "Ngẫu hứng"
    else -> "Khác"
}

fun mauChuyenMuc(ma: String?): Color = when (ma) {
    "ai" -> Color(0xFF2F6FA8)
    "triet_hoc" -> Color(0xFF7857A0)
    "truyen" -> Color(0xFFB0453A)
    "music" -> Color(0xFF1F7A6B)
    "khoa_hoc" -> Color(0xFF3D7D4F)
    "new_search" -> Color(0xFF9A6A18)
    else -> Color(0xFF7A6F5D)
}

fun dinhDangThoiLuong(giay: Int): String {
    val h = giay / 3600
    val m = giay % 3600 / 60
    val s = giay % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

/** Dòng phụ của một nội dung: nguồn · thời lượng · ngày. */
fun dongPhu(m: MucKetQua): String = listOfNotNull(
    m.nguon,
    m.thoiLuongGiay?.takeIf { it > 0 }?.let { dinhDangThoiLuong(it) },
    m.ngay,
).joinToString(" · ")

@Composable
fun TheNoiDung(muc: MucKetQua, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .padding(top = 6.dp)
                .size(10.dp)
                .clip(CircleShape)
                .background(mauChuyenMuc(muc.chuyenMuc)),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                muc.tieuDe,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            val phu = dongPhu(muc)
            Text(
                listOf(tenChuyenMuc(muc.chuyenMuc), phu).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (muc.tomTat.isNotBlank()) {
                Text(
                    muc.tomTat,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        muc.diemChatLuong?.let { diem ->
            Text(
                "%.1f".format(diem).replace('.', ','),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** Vẽ markdown nhẹ của câu trả lời đầy đủ. */
@Composable
fun HienMarkdown(van: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        docMarkdown(van).forEach { d ->
            when (d.kieu) {
                KieuDong.TRONG -> Spacer(Modifier.height(6.dp))
                KieuDong.TIEU_DE -> Text(
                    chuoiDam(d),
                    style = if (d.capTieuDe <= 2) MaterialTheme.typography.titleMedium else MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp),
                )
                KieuDong.GACH_DAU_DONG -> Row {
                    Text("•  ")
                    Text(chuoiDam(d))
                }
                KieuDong.THUONG -> Text(chuoiDam(d))
            }
        }
    }
}

private fun chuoiDam(d: DongMd) = buildAnnotatedString {
    d.doan.forEach {
        if (it.dam) withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(it.chu) } else append(it.chu)
    }
}

/** Hiện trạng thái tải: vòng quay, lỗi kèm nút thử lại, hoặc nội dung. */
@Composable
fun <T> HienTai(
    tai: Tai<T>,
    thuLai: () -> Unit,
    modifier: Modifier = Modifier,
    noiDung: @Composable (T) -> Unit,
) {
    when (tai) {
        is Tai.Chua, is Tai.Dang -> Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        is Tai.Loi -> Column(
            modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(tai.thongDiep, color = MaterialTheme.colorScheme.error)
            Button(onClick = thuLai) { Text("Thử lại") }
        }
        is Tai.Xong -> noiDung(tai.gia)
    }
}

@Composable
fun ThongBaoChuaNoi(moCaiDat: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Chưa nối với máy chủ Am", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text("Nhập địa chỉ máy chủ và token trong Cài đặt để app lấy được nội dung.")
        TextButton(onClick = moCaiDat) { Text("Mở Cài đặt") }
    }
}

/** Trả về hàm mở bộ nhận giọng nói của máy (tiếng Việt); nói xong thì gọi [khiNoi]. */
@Composable
fun rememberNoiBangGiong(khiNoi: (String) -> Unit): () -> Unit {
    val ctx = LocalContext.current
    val mo = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { kq ->
        val chu = kq.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (kq.resultCode == Activity.RESULT_OK && !chu.isNullOrBlank()) khiNoi(chu)
    }
    return {
        try {
            mo.launch(
                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "vi-VN")
                    .putExtra(RecognizerIntent.EXTRA_PROMPT, "Bạn cần gì?"),
            )
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(ctx, "Máy chưa có dịch vụ nhận giọng nói.", Toast.LENGTH_LONG).show()
        }
    }
}
