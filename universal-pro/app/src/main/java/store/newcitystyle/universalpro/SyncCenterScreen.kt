package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val navySync = Color(0xFF0B1F4F)
private val tealSync = Color(0xFF00AB97)
private val goldSync = Color(0xFFF6C660)
private val violetSync = Color(0xFF8664DC)

@Composable
fun SyncCenterScreen(onBack: () -> Unit) {
    var details by remember { mutableStateOf("Overview") }
    Column(Modifier.fillMaxSize().background(Color(0xFFF4F6FB))) {
        Row(
            Modifier.fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(navySync, Color(0xFF174B97), Color(0xFF087C82))))
                .padding(horizontal=12.dp, vertical=17.dp),
            verticalAlignment=Alignment.CenterVertically
        ) {
            IconButton(onClick=onBack) { Icon(Icons.Default.ArrowBack, null, tint=Color.White) }
            Column(Modifier.weight(1f)) {
                Text("UNIVERSAL SYNC", fontSize=22.sp, fontWeight=FontWeight.Black, color=Color.White)
                Text("Desktop  ⇄  Cloud  ⇄  Android", fontSize=11.sp, color=goldSync)
            }
            Icon(Icons.Default.Hub, null, tint=goldSync, modifier=Modifier.size(31.dp))
        }
        LazyColumn(contentPadding=PaddingValues(17.dp), verticalArrangement=Arrangement.spacedBy(14.dp)) {
            item {
                Card(colors=CardDefaults.cardColors(containerColor=navySync), shape=RoundedCornerShape(21.dp)) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            Icon(Icons.Default.Shield, null, tint=goldSync)
                            Spacer(Modifier.width(9.dp))
                            Text("Production sync not activated", color=Color.White, fontWeight=FontWeight.Bold)
                        }
                        Text("The existing financial APIs and device authentication must be verified before new-device writes. This preview never edits your business records.", color=Color.White.copy(alpha=.8f), fontSize=12.sp, lineHeight=18.sp)
                        Surface(color=Color.White.copy(alpha=.13f), shape=RoundedCornerShape(10.dp)) {
                            Text("ZERO FINANCIAL WRITES • ZERO DUPLICATE BILLS", Modifier.padding(10.dp), color=goldSync, fontSize=10.sp, fontWeight=FontWeight.Bold)
                        }
                    }
                }
            }
            item {
                Text("Integration roadmap", fontSize=21.sp, fontWeight=FontWeight.ExtraBold, color=navySync)
                Spacer(Modifier.height(9.dp))
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                    SyncMetric("Source Apps","3",tealSync,Modifier.weight(1f))
                    SyncMetric("Sync Writes","OFF",Color(0xFFE05F6B),Modifier.weight(1f))
                    SyncMetric("Local Demo","ON",violetSync,Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    listOf("Overview","Rules","Safety").forEach { option ->
                        FilterChip(selected=details==option,onClick={details=option},label={Text(option)})
                    }
                }
            }
            when(details) {
                "Overview" -> {
                    item { SyncModule("PRODUCTS & VARIANTS","Catalogue, barcode, size, color, prices, stock",Icons.Default.Inventory2,tealSync,"Needs API contract") }
                    item { SyncModule("SALES & PAYMENTS","Bills, due settlements, UPI, cash and profits",Icons.Default.ReceiptLong,violetSync,"Needs idempotency tests") }
                    item { SyncModule("PURCHASES & DUES","Supplier/customer ledgers and adjustments",Icons.Default.AccountBalanceWallet,Color(0xFFE4A44D),"Needs reconciliation") }
                    item { SyncModule("OFFLINE QUEUE","Store locally, retry after internet returns",Icons.Default.CloudSync,Color(0xFF3C8CE6),"Planned") }
                }
                "Rules" -> {
                    item { SyncModule("UNIQUE TRANSACTION ID","A retry must not create a second bill or payment",Icons.Default.Fingerprint,tealSync,"Required") }
                    item { SyncModule("STOCK CONFLICT DETECTION","Prevent simultaneous mobile/desktop stock overwrites",Icons.Default.SyncProblem,Color(0xFFD77D49),"Required") }
                    item { SyncModule("VERIFIED BALANCES","Use authoritative server ledger, never derived missing payment values",Icons.Default.FactCheck,violetSync,"Required") }
                }
                else -> {
                    item { SyncModule("OLD APPS UNCHANGED","Dedicated package and separate local storage",Icons.Default.Security,tealSync,"Protected") }
                    item { SyncModule("LIVE FINANCIAL WRITES","Disabled until tested API and authentication",Icons.Default.Lock,Color(0xFFE05F6B),"Disabled") }
                    item { SyncModule("REAL DATA","Not loaded, invented or copied in this preview",Icons.Default.Storage,Color(0xFF3C8CE6),"Not connected") }
                }
            }
        }
    }
}

@Composable private fun SyncMetric(label:String, value:String, tint:Color, modifier:Modifier) {
    Card(modifier=modifier, colors=CardDefaults.cardColors(containerColor=Color.White), shape=RoundedCornerShape(15.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text(label,color=Color.Gray,fontSize=10.sp)
            Spacer(Modifier.height(7.dp))
            Text(value,color=tint,fontWeight=FontWeight.Black,fontSize=20.sp)
        }
    }
}
@Composable private fun SyncModule(title:String, desc:String, icon:androidx.compose.ui.graphics.vector.ImageVector, tint:Color, state:String) {
    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(15.dp), verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Surface(color=tint.copy(alpha=.13f),shape=RoundedCornerShape(13.dp)) {
                    Box(Modifier.size(43.dp),contentAlignment=Alignment.Center) {Icon(icon,null,tint=tint)}
                }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(title,color=navySync,fontWeight=FontWeight.Bold,fontSize=13.sp)
                    Text(desc,color=Color.Gray,fontSize=11.sp)
                }
            }
            Surface(color=tint.copy(alpha=.1f),shape=RoundedCornerShape(9.dp)) {
                Text(state,Modifier.padding(horizontal=10.dp,vertical=6.dp),color=tint,fontSize=10.sp,fontWeight=FontWeight.Bold)
            }
        }
    }
}
