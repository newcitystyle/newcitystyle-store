package store.newcitystyle.universalpro

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val ProInk = Color(0xFF111C3D)
val ProBlue = Color(0xFF163A91)
val ProGold = Color(0xFFECC565)
val ProBg = Color(0xFFF3F5FA)
val ProTeal = Color(0xFF009E8E)
val ProPurple = Color(0xFF7159CD)
val ProCoral = Color(0xFFE46472)
val ProOrange = Color(0xFFF1A243)
val ProSky = Color(0xFF3286D2)

@Composable fun ProHero(title: String, subtitle: String, icon: ImageVector, accent: Color = ProGold) {
    Row(
        Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(ProInk, ProBlue, Color(0xFF186D87))))
            .padding(horizontal = 19.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text("NCS  /  UNIVERSAL PRO", fontSize = 9.sp, color = accent, letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(title, fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color.White)
            Text(subtitle, fontSize = 11.sp, color = Color.White.copy(alpha = .75f))
        }
        Surface(color = Color.White.copy(alpha = .14f), shape = RoundedCornerShape(17.dp)) {
            Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = accent, modifier = Modifier.size(29.dp))
            }
        }
    }
}

@Composable fun ProPill(label: String, tint: Color = ProOrange) {
    Surface(color = tint.copy(alpha = .13f), shape = RoundedCornerShape(11.dp)) {
        Text(label, Modifier.padding(horizontal = 11.dp, vertical = 8.dp), fontSize = 10.sp, color = tint, fontWeight = FontWeight.Bold)
    }
}

@Composable fun ProStat(label: String, value: String, subtitle: String, icon: ImageVector, tint: Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(19.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Surface(color = tint.copy(alpha = .13f), shape = RoundedCornerShape(11.dp)) {
                Box(Modifier.size(36.dp), contentAlignment=Alignment.Center) {
                    Icon(icon, null, tint=tint, modifier=Modifier.size(20.dp))
                }
            }
            Spacer(Modifier.height(11.dp))
            Text(label.uppercase(), color=Color(0xFF74819C), fontSize=9.sp, fontWeight=FontWeight.Bold)
            Spacer(Modifier.height(3.dp))
            Text(value, color=ProInk, fontSize=24.sp, fontWeight=FontWeight.Black)
            Text(subtitle, color=Color.Gray, fontSize=10.sp, maxLines=2)
        }
    }
}
