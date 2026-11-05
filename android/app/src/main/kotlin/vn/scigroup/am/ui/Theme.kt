package vn.scigroup.am.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Màu lấy theo app web và bản demo: nền be, điểm nhấn cam. Tối là nền gần đen, cam dịu hơn.
private val Sang = lightColorScheme(
    primary = Color(0xFFC2551A),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFAE2D1),
    onPrimaryContainer = Color(0xFF5A2208),
    secondaryContainer = Color(0xFFFAE2D1),
    onSecondaryContainer = Color(0xFF5A2208),
    background = Color(0xFFFBF8F3),
    onBackground = Color(0xFF2C2720),
    surface = Color(0xFFFBF8F3),
    onSurface = Color(0xFF2C2720),
    surfaceVariant = Color(0xFFF4EEE4),
    onSurfaceVariant = Color(0xFF5A5142),
    outlineVariant = Color(0xFFE2D7C5),
    error = Color(0xFFB3261E),
)

private val Toi = darkColorScheme(
    primary = Color(0xFFD4845F),
    onPrimary = Color(0xFF14110D),
    primaryContainer = Color(0xFF2E1F17),
    onPrimaryContainer = Color(0xFFFAE2D1),
    secondaryContainer = Color(0xFF2E1F17),
    onSecondaryContainer = Color(0xFFFAE2D1),
    background = Color(0xFF0E0E0E),
    onBackground = Color(0xFFF2F2F2),
    surface = Color(0xFF0E0E0E),
    onSurface = Color(0xFFF2F2F2),
    surfaceVariant = Color(0xFF1A1A1A),
    onSurfaceVariant = Color(0xFFC9C9C9),
    outlineVariant = Color(0xFF2C2C2C),
    error = Color(0xFFF2B8B5),
)

@Composable
fun AmTheme(noiDung: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Toi else Sang,
        content = noiDung,
    )
}
