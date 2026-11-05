package vn.scigroup.am.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import vn.scigroup.am.AmViewModel

private enum class Tab(val nhan: String, val bieuTuong: ImageVector) {
    BanTin("Bản tin", Icons.Filled.AutoAwesome),
    KhamPha("Khám phá", Icons.Filled.Explore),
    TroChuyen("Trò chuyện", Icons.AutoMirrored.Filled.Chat),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AmRoot(vm: AmViewModel = viewModel()) {
    var tab by rememberSaveable { mutableStateOf(Tab.BanTin) }
    var caiDat by rememberSaveable { mutableStateOf(false) }

    BackHandler(enabled = vm.dangXem != null || caiDat) {
        if (vm.dangXem != null) vm.dongXem() else caiDat = false
    }

    when {
        caiDat -> ManCaiDat(vm) { caiDat = false }
        vm.dangXem != null -> ManXem(vm)
        else -> Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(tab.nhan) },
                    actions = {
                        IconButton(onClick = { caiDat = true }) {
                            Icon(Icons.Filled.Settings, contentDescription = "Cài đặt")
                        }
                    },
                )
            },
            bottomBar = {
                NavigationBar {
                    Tab.entries.forEach { t ->
                        NavigationBarItem(
                            selected = tab == t,
                            onClick = { tab = t },
                            icon = { Icon(t.bieuTuong, contentDescription = null) },
                            label = { Text(t.nhan) },
                        )
                    }
                }
            },
        ) { vien ->
            val m = Modifier.padding(vien)
            when (tab) {
                Tab.BanTin -> ManBanTin(vm, moCaiDat = { caiDat = true }, modifier = m)
                Tab.KhamPha -> ManKhamPha(vm, moCaiDat = { caiDat = true }, modifier = m)
                Tab.TroChuyen -> ManTroChuyen(vm, moCaiDat = { caiDat = true }, modifier = m)
            }
        }
    }
}
