package vn.scigroup.am.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.Tai
import vn.scigroup.am.core.MucKetQua
import androidx.compose.material3.Text as M3Text

@Composable
fun ManKhamPha(vm: AmViewModel, moCaiDat: () -> Unit, modifier: Modifier = Modifier) {
    LaunchedEffect(vm.daCauHinh) {
        if (vm.daCauHinh && vm.duyet is Tai.Chua) vm.taiDuyet()
    }
    if (!vm.daCauHinh) {
        ThongBaoChuaNoi(moCaiDat)
        return
    }
    val noi = rememberNoiBangGiong { chu ->
        vm.tuKhoa = chu
        vm.timKiem()
    }

    Column(modifier.fillMaxSize()) {
        OutlinedTextField(
            value = vm.tuKhoa,
            onValueChange = { vm.tuKhoa = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            singleLine = true,
            placeholder = { Text("Tìm trong kho của Am") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            trailingIcon = {
                Row {
                    if (vm.tuKhoa.isNotEmpty() || vm.dangTim) {
                        IconButton(onClick = { vm.xoaTim() }) {
                            Icon(Icons.Filled.Close, contentDescription = "Xoá từ khoá")
                        }
                    }
                    IconButton(onClick = noi) {
                        Icon(Icons.Filled.Mic, contentDescription = "Nói để tìm")
                    }
                }
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { vm.timKiem() }),
        )

        // Chip chuyên mục: lấy từ các nhóm của danh sách duyệt, số đếm đúng bằng số thẻ hiện ra
        val nhom = (vm.duyet as? Tai.Xong)?.gia?.nhom.orEmpty()
        val tatCa = nhom.sumOf { it.noiDung.size }
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                FilterChip(
                    selected = vm.chuyenMuc == null,
                    onClick = { vm.chuyenMuc = null; if (vm.dangTim) vm.timKiem() },
                    label = { M3Text(if (nhom.isEmpty()) "Tất cả" else "Tất cả $tatCa") },
                )
            }
            items(nhom, key = { it.chuyenMuc }) { n ->
                FilterChip(
                    selected = vm.chuyenMuc == n.chuyenMuc,
                    onClick = { vm.chuyenMuc = n.chuyenMuc; if (vm.dangTim) vm.timKiem() },
                    label = { M3Text("${n.tenHienThi.ifBlank { tenChuyenMuc(n.chuyenMuc) }} ${n.noiDung.size}") },
                )
            }
        }

        if (vm.dangTim) {
            HienTai(vm.timThay, thuLai = { vm.timKiem() }) { kq ->
                DanhSach(
                    kq.ketQua,
                    trong = "Không thấy \"${vm.tuKhoa}\" trong kho.",
                    mo = vm::moXem,
                )
            }
        } else {
            HienTai(vm.duyet, thuLai = { vm.taiDuyet() }) { bt ->
                val chon = vm.chuyenMuc
                val ds = bt.nhom.filter { chon == null || it.chuyenMuc == chon }.flatMap { it.noiDung }
                DanhSach(ds, trong = "Chưa có nội dung nào trong 30 ngày qua.", mo = vm::moXem)
            }
        }
    }
}

@Composable
private fun DanhSach(ds: List<MucKetQua>, trong: String, mo: (MucKetQua) -> Unit) {
    if (ds.isEmpty()) {
        Text(trong, modifier = Modifier.padding(24.dp))
        return
    }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(ds, key = { it.id }) { muc ->
            TheNoiDung(muc, onClick = { mo(muc) }, modifier = Modifier.fillMaxWidth())
        }
    }
}
