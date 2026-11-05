package vn.scigroup.am.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel

/**
 * Xem và nghe một nội dung. Bản này đọc to phần chữ (bản thuật lại hoặc lời thoại)
 * bằng giọng của máy; chưa phát video hay nhạc trong app, và cũng không có nút đưa
 * người dùng ra ngoài app.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManXem(vm: AmViewModel) {
    val muc = vm.dangXem ?: return
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Đang nghe", style = MaterialTheme.typography.titleMedium) },
                navigationIcon = {
                    IconButton(onClick = vm::dongXem) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Quay lại")
                    }
                },
            )
        },
    ) { vien ->
        Column(
            Modifier
                .padding(vien)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(muc.tieuDe, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                listOf(tenChuyenMuc(muc.chuyenMuc), dongPhu(muc)).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            HienTai(vm.noiDungXem, thuLai = { vm.moXem(muc) }) { day ->
                val van = day.noiDung?.takeIf { it.isNotBlank() } ?: day.tomTat
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    day.diemChatLuong?.let {
                        Text(
                            "Điểm chất lượng ${"%.1f".format(it).replace('.', ',')} trên 10",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    if (van.isBlank()) {
                        Text(
                            if (day.chuyenMuc == "music") {
                                "Đây là nhạc nên Am không đọc nội dung. Bản này của app chưa phát nhạc."
                            } else {
                                "Nội dung này chưa có bản chữ để đọc."
                            },
                        )
                    } else {
                        val dangDoc = vm.giong.dangDoc
                        Button(onClick = { if (dangDoc) vm.giong.dung() else vm.giong.doc(van) }) {
                            Icon(
                                if (dangDoc) Icons.Filled.Stop else Icons.AutoMirrored.Filled.VolumeUp,
                                contentDescription = null,
                            )
                            Text(if (dangDoc) "  Dừng" else "  Nghe")
                        }
                        vm.giong.thongBao?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        Text(van, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}
