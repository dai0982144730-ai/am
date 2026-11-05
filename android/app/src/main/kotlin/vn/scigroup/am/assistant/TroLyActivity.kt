package vn.scigroup.am.assistant

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.MainActivity
import vn.scigroup.am.ui.AmTheme
import vn.scigroup.am.ui.HienMarkdown
import vn.scigroup.am.ui.rememberNoiBangGiong

/**
 * Màn trợ lý giọng nói: mở ra là tự nghe câu hỏi, hỏi trang `am`, đọc bản ngắn thành
 * tiếng và hiện bản đầy đủ lên màn hình.
 */
class TroLyActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AmTheme {
                ManTroLy(
                    moAm = {
                        startActivity(Intent(this, MainActivity::class.java))
                        finish()
                    },
                    dong = { finish() },
                )
            }
        }
    }
}

@Composable
private fun ManTroLy(moAm: () -> Unit, dong: () -> Unit, vm: AmViewModel = viewModel()) {
    val noi = rememberNoiBangGiong { vm.hoi(it) }
    // Chỉ tự nghe khi đã nối máy chủ và chưa có câu hỏi nào
    LaunchedEffect(Unit) {
        if (vm.daCauHinh && vm.chat.isEmpty()) noi()
    }

    val cauHoi = vm.chat.lastOrNull { it.laToi }?.chu
    val traLoi = vm.chat.lastOrNull { !it.laToi }

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.fillMaxSize().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when {
                    !vm.daCauHinh -> Text("Chưa nối với máy chủ Am. Mở Am và nhập địa chỉ máy chủ, token trong Cài đặt.")
                    cauHoi == null -> Text("Bạn cần gì?", style = MaterialTheme.typography.headlineSmall)
                    else -> Text(cauHoi, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                }
                if (vm.dangHoi) CircularProgressIndicator()
                if (traLoi != null) {
                    if (traLoi.loi != null) {
                        Text(traLoi.loi, color = MaterialTheme.colorScheme.error)
                    } else {
                        val day = traLoi.traLoi
                        if (day != null && day.traLoiDay.isNotBlank()) HienMarkdown(day.traLoiDay) else Text(traLoi.chu)
                    }
                }
                vm.giong.thongBao?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = noi, enabled = vm.daCauHinh && !vm.dangHoi) {
                    Icon(Icons.Filled.Mic, contentDescription = null)
                    Text("  Hỏi câu khác")
                }
                OutlinedButton(onClick = moAm) { Text("Mở Am") }
                OutlinedButton(onClick = dong) { Text("Đóng") }
            }
        }
    }
}
