package vn.scigroup.am.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.Tai

@Composable
fun ManBanTin(vm: AmViewModel, moCaiDat: () -> Unit, modifier: Modifier = Modifier) {
    LaunchedEffect(vm.daCauHinh) {
        if (vm.daCauHinh && vm.banTin is Tai.Chua) vm.taiBanTin()
    }
    if (!vm.daCauHinh) {
        ThongBaoChuaNoi(moCaiDat)
        return
    }
    HienTai(vm.banTin, thuLai = { vm.taiBanTin() }, modifier = modifier) { bt ->
        LazyColumn(
            modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(1 to "Hôm nay", 3 to "3 ngày", 7 to "7 ngày").forEach { (so, nhan) ->
                        FilterChip(
                            selected = vm.soNgayBanTin == so,
                            onClick = { vm.taiBanTin(so) },
                            label = { Text(nhan) },
                        )
                    }
                }
            }
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            if (bt.tuBanTinDaSoan) "Bản tin Am đã soạn" else "Nội dung mới nhất",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Text(
                            bt.traLoiNgan.ifBlank { "Chưa có nội dung mới trong khoảng này." },
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        if (bt.traLoiNgan.isNotBlank()) {
                            val dangDoc = vm.giong.dangDoc
                            Button(onClick = { if (dangDoc) vm.giong.dung() else vm.giong.doc(bt.traLoiNgan) }) {
                                Icon(
                                    if (dangDoc) Icons.Filled.Stop else Icons.AutoMirrored.Filled.VolumeUp,
                                    contentDescription = null,
                                )
                                Text(if (dangDoc) "  Dừng" else "  Nghe bản tin")
                            }
                            vm.giong.thongBao?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
            bt.nhom.forEach { nhom ->
                item(key = "tieu-de-" + nhom.chuyenMuc) {
                    Text(
                        "${nhom.tenHienThi.ifBlank { tenChuyenMuc(nhom.chuyenMuc) }} · ${nhom.noiDung.size}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                items(nhom.noiDung, key = { nhom.chuyenMuc + "/" + it.id }) { muc ->
                    TheNoiDung(muc, onClick = { vm.moXem(muc) }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}
