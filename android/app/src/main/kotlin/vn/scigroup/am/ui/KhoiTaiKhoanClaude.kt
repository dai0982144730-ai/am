package vn.scigroup.am.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.Tai
import vn.scigroup.am.core.chuanHoaMaClaude

/**
 * Mục "Tài khoản Claude" trong Cài đặt: đăng nhập tài khoản Claude của MÁY CHỦ Am
 * ngay từ điện thoại. Chỉ hiện khi app đã ghép với máy chủ (có thẻ thiết bị).
 *
 *   1. Bấm "Đăng nhập Claude": trình duyệt của máy mở trang đăng nhập Claude.
 *   2. Đăng nhập xong, trang Claude hiện một mã: bấm chép mã (Copy Code).
 *   3. Quay lại app, dán mã vào ô. Dán xong là tự gửi.
 */
@Composable
fun KhoiTaiKhoanClaude(vm: AmViewModel) {
    val ctx = LocalContext.current
    var ma by rememberSaveable { mutableStateOf("") }

    // Mỗi lần có thẻ (ghép xong, hoặc mở màn Cài đặt) thì hỏi trạng thái
    LaunchedEffect(vm.the) { vm.taiTrangThaiClaude() }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Tài khoản Claude của máy chủ", style = MaterialTheme.typography.titleMedium)
        Text(
            "Am gọi Claude qua gói đăng ký trên máy chủ. Đăng nhập tại đây thì không phải " +
                "ngồi trước máy chủ. Chưa đăng nhập riêng thì máy chủ dùng tài khoản Claude mặc định của nó.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        HienTai(vm.claudeTT, thuLai = vm::taiTrangThaiClaude, modifier = Modifier.padding(vertical = 4.dp)) { tt ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                when {
                    !tt.daCaiCli -> Text("Máy chủ chưa có Claude CLI.", color = MaterialTheme.colorScheme.error)
                    tt.daDangNhap -> {
                        Text(
                            "Đã đăng nhập" + (tt.email?.let { ": $it" } ?: "") + (tt.goi?.let { " · gói $it" } ?: ""),
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        )
                        Text(
                            if (tt.dungTaiKhoanRieng) "Đăng nhập riêng của Am." else "Đang mượn tài khoản mặc định của máy chủ.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    else -> Text("Chưa đăng nhập.")
                }
            }
        }

        if (vm.claudeCoLink) {
            Text("Đăng nhập xong, trang Claude hiện một mã. Bấm chép mã (Copy Code), quay lại đây và dán vào ô. Dán xong là tự gửi.")
            OutlinedTextField(
                value = ma,
                onValueChange = { v ->
                    // Dán nghĩa là chữ tăng vọt một lúc: gửi luôn, không bắt bấm thêm
                    val vuaDan = v.length - ma.length > 10
                    ma = v
                    if (vuaDan && chuanHoaMaClaude(v) != null) {
                        vm.nhapMaClaude(v)
                        ma = ""
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Mã trang Claude hiện ra") },
                singleLine = true,
                enabled = !vm.claudeBan,
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { vm.nhapMaClaude(ma); ma = "" },
                    enabled = !vm.claudeBan && ma.isNotBlank(),
                ) { Text(if (vm.claudeBan) "Đang xác nhận…" else "Xong") }
                TextButton(onClick = { vm.huyClaude(); ma = "" }, enabled = !vm.claudeBan) { Text("Huỷ") }
                Text(
                    "Link dùng được 15 phút; mỗi mã chỉ dùng một lần.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            val tt = when (val t = vm.claudeTT) {
                is Tai.Xong -> t.gia
                else -> null
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (tt?.daCaiCli == true) {
                    Button(
                        enabled = !vm.claudeBan,
                        onClick = {
                            vm.moLinkClaude { url ->
                                try {
                                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                } catch (_: ActivityNotFoundException) {
                                    Toast.makeText(ctx, "Máy chưa có trình duyệt để mở link.", Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                    ) {
                        Text(
                            when {
                                vm.claudeBan -> "Đang lấy link…"
                                tt.daDangNhap && tt.dungTaiKhoanRieng -> "Đăng nhập lại"
                                tt.daDangNhap -> "Đăng nhập tài khoản riêng"
                                else -> "Đăng nhập Claude"
                            },
                        )
                    }
                }
                if (tt?.daDangNhap == true) {
                    OutlinedButton(onClick = { vm.viecClaude("thu") }, enabled = !vm.claudeBan) { Text("Thử trợ lý") }
                }
                if (tt?.dungTaiKhoanRieng == true) {
                    OutlinedButton(onClick = { vm.viecClaude("dang_xuat") }, enabled = !vm.claudeBan) { Text("Đăng xuất") }
                }
            }
        }

        vm.claudeKq?.let { (ok, chu) ->
            Text(chu, color = if (ok) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
        }
    }
}
