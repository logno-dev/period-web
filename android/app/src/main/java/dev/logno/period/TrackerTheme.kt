package dev.logno.period

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Shared with src/app.css and the web calendar's phase legend.
object TrackerColors {
    val Accent = Color(0xFFEC4899)
    val Success = Color(0xFF10B981)
    val Error = Color(0xFFEF4444)
    val Brand = Color(0xFF8B5CF6)
    val Menstrual = Color(0xFFD53F8C)
    val Follicular = Color(0xFFFBB6CE)
    val Ovulation = Color(0xFF3182CE)
    val Luteal = Color(0xFF805AD5)
    val Predicted = Color(0xFFFFE4E1)
}

fun Phase.color() = when (this) {
    Phase.MENSTRUAL -> TrackerColors.Menstrual
    Phase.FOLLICULAR -> TrackerColors.Follicular
    Phase.OVULATION -> TrackerColors.Ovulation
    Phase.LUTEAL -> TrackerColors.Luteal
}

private val LightColors = lightColorScheme(
    primary = TrackerColors.Accent, onPrimary = Color.White,
    primaryContainer = Color(0xFFFCE7F3), onPrimaryContainer = Color(0xFF9D174D),
    secondary = Color(0xFF3B82F6), onSecondary = Color.White,
    secondaryContainer = Color(0xFFEFF6FF), onSecondaryContainer = Color(0xFF1D4ED8),
    tertiary = TrackerColors.Success, onTertiary = Color.White,
    background = Color.White, onBackground = Color(0xFF0F172A),
    surface = Color.White, onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF8FAFC), onSurfaceVariant = Color(0xFF64748B),
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFF8FAFC),
    surfaceContainer = Color(0xFFF8FAFC), surfaceContainerHigh = Color(0xFFF1F5F9),
    surfaceContainerHighest = Color(0xFFE2E8F0), surfaceTint = Color.Transparent,
    outline = Color(0xFFE2E8F0), outlineVariant = Color(0xFFE2E8F0),
    error = TrackerColors.Error, onError = Color.White,
)
private val DarkColors = darkColorScheme(
    primary = TrackerColors.Accent, onPrimary = Color.White,
    primaryContainer = Color(0xFF453047), onPrimaryContainer = Color(0xFFFBCFE8),
    secondary = Color(0xFF7C3AED), onSecondary = Color.White,
    secondaryContainer = Color(0xFF3C2F52), onSecondaryContainer = Color(0xFFDDD6FE),
    tertiary = TrackerColors.Success, onTertiary = Color.White,
    background = Color(0xFF1A1625), onBackground = Color(0xFFF1F5F9),
    surface = Color(0xFF1A1625), onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF2A2438), onSurfaceVariant = Color(0xFFA78BFA),
    surfaceContainerLowest = Color(0xFF1A1625), surfaceContainerLow = Color(0xFF2A2438),
    surfaceContainer = Color(0xFF2A2438), surfaceContainerHigh = Color(0xFF3C2F52),
    surfaceContainerHighest = Color(0xFF453C5C), surfaceTint = Color.Transparent,
    outline = Color(0xFF453C5C), outlineVariant = Color(0xFF453C5C),
    error = TrackerColors.Error, onError = Color.White,
)

@Composable
fun TrackerTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        shapes = Shapes(
            extraSmall = RoundedCornerShape(6.dp), small = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(8.dp), large = RoundedCornerShape(12.dp), extraLarge = RoundedCornerShape(16.dp),
        ),
        typography = Typography(
            titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp),
            titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
            titleSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
            bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, lineHeight = 24.sp),
            bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, lineHeight = 20.sp),
            bodySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 12.sp, lineHeight = 16.sp),
        ),
        content = content,
    )
}
