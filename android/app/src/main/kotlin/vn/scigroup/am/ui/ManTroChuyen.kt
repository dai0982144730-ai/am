package vn.scigroup.am.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import vn.scigroup.am.AmViewModel
import vn.scigroup.am.TinNhan
import vn.scigroup.am.core.MucKetQua

@Composable
fun ManTroChuyen(vm: AmViewModel, moCaiDat: () -> Unit, modifier: Modifier = Modifier) {
    if (!vm.daCauHinh) {
        ThongBaoChuaNoi(moCaiDat)
        return
    }
    var o by rememberSaveable { mutableStateOf("") }
    val gui = { cau: String -> vm.hoi(cau); o = "" }
    val noi = rememberNoiBangGiong { gui(it) }
    val dsCuon = rememberLazyListState()
    LaunchedEffect(vm.chat.size, vm.dangHoi) {
        val cuoi = vm.chat.size + (if (vm.dangHoi) 1 else 0) - 1
        if (cuoi >= 0) dsCuon.animateScrollToItem(cuoi)
    }

    Column(modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            state = dsCuon,
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (vm.chat.isEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Hỏi Am về những gì đã quét", style = MaterialTheme.typography.titleMedium)
                        listOf("Tuần này có gì hay về ý thức?", "Tôi có 20 phút lái xe, nghe gì?", "Có gì mới về AI agent?")
                            .forEach { g -> AssistChip(onClick = { gui(g) }, label = { Text(g) }) }
                    }
                }
            }
            items(vm.chat.size) { i -> TinNhanView(vm.chat[i], vm) }
            if (vm.dangHoi) {
                item { CircularProgressIndicator(Modifier.padding(8.dp)) }
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = o,
                onValueChange = { o = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Hỏi Am…") },
                maxLines = 3,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { gui(o) }),
            )
            IconButton(onClick = { gui(o) }, enabled = o.isNotBlank() && !vm.dangHoi) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Gửi")
            }
            IconButton(onClick = noi) { Icon(Icons.Filled.Mic, contentDescription = "Nói câu hỏi") }
        }
    }
}

@Composable
fun TinNhanView(tin: TinNhan, vm: AmViewModel) {
    if (tin.laToi) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
            Text(
                tin.chu,
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp, 6.dp, 20.dp, 20.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(12.dp),
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        return
    }
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp, 20.dp, 20.dp, 20.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (tin.loi != null) {
            Text(tin.loi, color = MaterialTheme.colorScheme.error)
            return@Column
        }
        val day = tin.traLoi
        if (day != null && day.traLoiDay.isNotBlank()) HienMarkdown(day.traLoiDay) else Text(tin.chu)
        if (tin.chu.isNotBlank()) {
            TextButton(onClick = { vm.giong.doc(tin.chu) }) {
                Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null)
                Text("  Nghe câu trả lời")
            }
        }
        day?.nguonThamKhao?.forEach { n ->
            AssistChip(
                onClick = { vm.moXem(MucKetQua(id = n.id, tieuDe = n.tieuDe)) },
                label = { Text(n.tieuDe, maxLines = 1) },
            )
        }
    }
}
