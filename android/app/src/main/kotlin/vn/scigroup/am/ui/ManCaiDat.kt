package vn.scigroup.am.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.core.AmApi
import vn.scigroup.am.core.AmApiException

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManCaiDat(vm: AmViewModel, quayLai: () -> Unit) {
    var diaChi by remember { mutableStateOf(vm.diaChi) }
    var token by remember { mutableStateOf(vm.token) }
    var docTo by remember { mutableStateOf(vm.docTo) }
    var ketQua by remember { mutableStateOf<String?>(null) }
    var dangThu by remember { mutableStateOf(false) }
    val phamVi = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cài đặt") },
                navigationIcon = {
                    IconButton(onClick = quayLai) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Quay lại")
                    }
                },
            )
        },
    ) { vien ->
        Column(
            Modifier.padding(vien).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Máy chủ Am", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = diaChi,
                onValueChange = { diaChi = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Địa chỉ máy chủ") },
                placeholder = { Text("https://am.scigroup.vn") },
                singleLine = true,
            )
            OutlinedTextField(
                value = token,
                onValueChange = { token = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Token (TOKEN_TRO_LY trong .env)") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
            Text(
                "Dùng địa chỉ https khi có thể. Với http thường, token đi qua mạng không được mã hoá.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Tự đọc câu trả lời")
                    Text(
                        "Đọc bản ngắn của trợ lý thành tiếng, chi tiết hiện trên màn hình.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = docTo, onCheckedChange = { docTo = it })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = {
                    vm.luuCauHinh(diaChi, token, docTo)
                    ketQua = "Đã lưu."
                }) { Text("Lưu") }
                OutlinedButton(
                    enabled = !dangThu,
                    onClick = {
                        dangThu = true
                        ketQua = "Đang thử…"
                        phamVi.launch {
                            val dc = diaChi
                            val tk = token
                            ketQua = try {
                                val s = withContext(Dispatchers.IO) { AmApi(dc, tk).sucKhoe() }
                                if (s.database == "ok") {
                                    "Nối được. Kho có ${s.soBanGhi["noiDung"] ?: 0} nội dung."
                                } else {
                                    "Nối được máy chủ nhưng database báo lỗi: ${s.loi ?: "không rõ"}"
                                }
                            } catch (e: AmApiException) {
                                e.message
                            } catch (e: Exception) {
                                "Có lỗi không rõ: ${e.message}"
                            }
                            dangThu = false
                        }
                    },
                ) { Text("Thử kết nối") }
            }
            ketQua?.let { Text(it) }

            Text("Trợ lý giữ nút nguồn", style = MaterialTheme.typography.titleMedium)
            Text(
                "Vào Cài đặt máy, Ứng dụng, Ứng dụng mặc định, Ứng dụng trợ lý số, chọn Am. " +
                    "Tên mục có thể khác đôi chút trên HyperOS. Sau đó giữ nút nguồn để gọi Am.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
