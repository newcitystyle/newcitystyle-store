package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Deep = Color(0xFF081B43)
private val Royal = Color(0xFF143E94)
private val Shine = Color(0xFFE3BB58)
private val Pale = Color(0xFFF4F6FB)
private val Mint = Color(0xFF0BAA91)
private val Crimson = Color(0xFFE55D69)
private val Purple = Color(0xFF7859D6)

private data class Command(val name: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val tone: Color, val destination: String)
private val commands = listOf(
    Command("New Bill", Icons.Default.QrCodeScanner, Royal, "Advanced POS"),
    Command("Products", Icons.Default.Inventory2, Purple, "Product Studio"),
    Command("Purchases", Icons.Default.LocalShipping, Mint, "Purchase Center"),
    Command("Payments", Icons.Default.AccountBalanceWallet, Color(0xFFF7A02C), "Cash & Bank"),
    Command("Customers", Icons.Default.Groups, Crimson, "Customers"),
    Command("Profit Lab", Icons.Default.AutoGraph, Royal, "Profit Studio")
)

@Composable
fun PremiumDashboard(onNavigate: (String) -> Unit) {
    var range by remember { mutableStateOf("7D") }
    var showAlerts by remember { mutableStateOf(false) }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Pale),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Deep, Royal, Color(0xFF146F80))))
                    .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("NEW CITY STYLE", color = Shine, fontSize = 19.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                        Text("BUSINESS INTELLIGENCE  /  UNIVERSAL PRO", color = Color.White.copy(alpha = 0.7f), fontSize = 8.sp, letterSpacing = 1.sp)
                    }
                    IconButton(onClick = { showAlerts = !showAlerts }) {
                        Icon(Icons.Default.NotificationsActive, "Alerts", tint = Shine)
                    }
                }
                Spacer(Modifier.height(22.dp))
                Text("Command Center", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold)
                Text("Everything about your business, in one glance.", color = Color.White.copy(alpha = .72f), fontSize = 11.sp)
                Spacer(Modifier.height(17.dp))
                Surface(color = Color.White.copy(alpha = .12f), shape = RoundedCornerShape(14.dp)) {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Shield, null, tint = Shine, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("SAFE PREVIEW  •  LIVE DATABASE DISCONNECTED", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                if (showAlerts) {
                    Spacer(Modifier.height(9.dp))
                    Text("Alerts will activate after verified read-only integration.", color = Color.White, fontSize = 11.sp)
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 17.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PremiumMetric("TOTAL SALES", "—", "Live data pending", Icons.Default.TrendingUp, Mint, Modifier.weight(1f))
                    PremiumMetric("NET PROFIT", "—", "Audit required", Icons.Default.AutoGraph, Purple, Modifier.weight(1f))
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PremiumMetric("CUSTOMER DUES", "—", "Read-only bridge pending", Icons.Default.People, Color(0xFFEE9B43), Modifier.weight(1f))
                    PremiumMetric("SUPPLIER DUES", "—", "Ledger verification pending", Icons.Default.AccountBalance, Crimson, Modifier.weight(1f))
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 17.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Business Pulse", fontSize = 21.sp, color = Deep, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
                    listOf("7D","30D","90D").forEach { option ->
                        Box(
                            modifier = Modifier.padding(start = 4.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (range == option) Royal else Color.White)
                                .clickable { range = option }
                                .padding(horizontal = 10.dp, vertical = 7.dp)
                        ) {
                            Text(option, color = if (range == option) Color.White else Royal, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(9.dp))
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
                    Column(Modifier.padding(17.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Sales trajectory", fontWeight = FontWeight.Bold, color = Deep, modifier = Modifier.weight(1f))
                            Text("ILLUSTRATIVE ONLY", color = Crimson, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(10.dp))
                        PulseGraph(range)
                        Spacer(Modifier.height(7.dp))
                        Text("Visual placeholder; not based on actual transactions.", fontSize = 10.sp, color = Color.Gray)
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 17.dp)) {
                Text("Instant Actions", fontSize = 21.sp, color = Deep, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(10.dp))
                commands.chunked(3).forEach { rowCommands ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        rowCommands.forEach { action ->
                            Card(
                                modifier = Modifier.weight(1f).clickable { onNavigate(action.destination) },
                                shape = RoundedCornerShape(17.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White)
                            ) {
                                Column(Modifier.fillMaxWidth().padding(vertical = 15.dp, horizontal = 7.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        Modifier.size(45.dp).clip(RoundedCornerShape(14.dp)).background(action.tone.copy(alpha = .11f)),
                                        contentAlignment = Alignment.Center
                                    ) { Icon(action.icon, null, tint = action.tone, modifier = Modifier.size(23.dp)) }
                                    Spacer(Modifier.height(9.dp))
                                    Text(action.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Deep)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 17.dp)) {
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { onNavigate("LIVA AI") },
                    colors = CardDefaults.cardColors(containerColor = Deep),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AutoAwesome, null, tint = Shine, modifier = Modifier.size(32.dp))
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("LIVA BUSINESS COPILOT", color = Shine, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Voice, insights & smart recommendations", color = Color.White.copy(alpha=.76f), fontSize = 10.sp)
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun PremiumMetric(label: String, value: String, sub: String, glyph: androidx.compose.ui.graphics.vector.ImageVector, accent: Color, modifier: Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Box(Modifier.size(31.dp).clip(RoundedCornerShape(9.dp)).background(accent.copy(alpha=.13f)), contentAlignment=Alignment.Center) {
                Icon(glyph, null, tint=accent, modifier=Modifier.size(17.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(label, fontSize=9.sp, color=Color(0xFF718099), fontWeight=FontWeight.Bold, letterSpacing=.5.sp)
            Text(value, fontSize=27.sp, color=Deep, fontWeight=FontWeight.Black)
            Text(sub, fontSize=9.sp, color=Color.Gray, maxLines=2, lineHeight=11.sp)
        }
    }
}

@Composable
private fun PulseGraph(range:String) {
    val values = when (range) {
        "30D" -> listOf(.3f,.45f,.4f,.61f,.54f,.81f,.73f,.9f,.63f,.95f)
        "90D" -> listOf(.2f,.31f,.4f,.47f,.6f,.58f,.82f,.76f,.9f,.99f)
        else -> listOf(.27f,.6f,.44f,.73f,.61f,.84f,.72f,.95f,.83f,.97f)
    }
    Canvas(Modifier.fillMaxWidth().height(112.dp)) {
        val h=size.height
        val w=size.width
        for (i in 1..3) {
            drawLine(Color(0xFFE9EEF6),Offset(0f,h*i/4),Offset(w,h*i/4),strokeWidth=1.dp.toPx())
        }
        val line=Path()
        values.forEachIndexed { i, value ->
            val x=w*i/(values.size-1)
            val y=h*(1-value)*.84f+6.dp.toPx()
            if (i==0) line.moveTo(x,y) else line.lineTo(x,y)
        }
        drawPath(line,color=Royal,style=Stroke(width=3.dp.toPx(),cap=StrokeCap.Round))
        values.forEachIndexed { i, value ->
            drawCircle(Shine,radius=3.dp.toPx(),center=Offset(w*i/(values.size-1),h*(1-value)*.84f+6.dp.toPx()))
        }
    }
}
