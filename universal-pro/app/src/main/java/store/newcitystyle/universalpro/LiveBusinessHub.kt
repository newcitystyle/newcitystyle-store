package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

private val royalHub=Color(0xFF0A2E73)
private val goldHub=Color(0xFFD4AF37)
private val ivoryHub=Color(0xFFF8F4EC)
private data class HubAction(val title:String,val note:String,val icon:ImageVector,val shade:Color,val key:String)
private val hubActions=listOf(
    HubAction("Product Studio","Live catalogue • AI • Publish",Icons.Default.AutoAwesome,Color(0xFF124DAB),"Product Studio"),
    HubAction("Sales & Bills","Live sales history",Icons.Default.ReceiptLong,Color(0xFF008E86),"Sales Intelligence"),
    HubAction("Purchases","Incoming stock & invoices",Icons.Default.LocalShipping,Color(0xFF6A48B4),"Purchase Center"),
    HubAction("Customers","Actual customer records",Icons.Default.Groups,Color(0xFFB34B68),"Customers"),
    HubAction("Suppliers","Supplier ledger entries",Icons.Default.AccountBalanceWallet,Color(0xFFD08A2E),"Supplier Ledger"),
    HubAction("Expenses","Expense transactions",Icons.Default.Payments,Color(0xFFB94C3F),"Expenses"),
    HubAction("Cash / UPI","Bank & cash transactions",Icons.Default.AccountBalance,Color(0xFF1975AD),"Cash & Bank"),
    HubAction("Stock & Sizes","Actual product variants",Icons.Default.Inventory2,Color(0xFF397C60),"Inventory Radar")
)
@Composable
fun LiveBusinessHub(onNavigate:(String)->Unit) {
    LazyColumn(
        modifier=Modifier.fillMaxSize().background(ivoryHub),
        contentPadding=PaddingValues(bottom=24.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)
    ) {
        item {
            Column(
                Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(royalHub,Color(0xFF164CA1),Color(0xFF2958A7))))
                    .padding(horizontal=19.dp,vertical=24.dp),
                verticalArrangement=Arrangement.spacedBy(8.dp)
            ) {
                Text("NEW CITY STYLE",color=goldHub,fontSize=19.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp)
                Text("UNIVERSAL BUSINESS CENTER",color=Color.White.copy(alpha=.76f),fontSize=10.sp,fontWeight=FontWeight.Bold)
                Spacer(Modifier.height(11.dp))
                Text("Your business. Connected.",color=Color.White,fontSize=27.sp,fontWeight=FontWeight.Black)
                Text("Products • Sales • Purchases • Inventory • Accounts",color=Color.White.copy(alpha=.8f),fontSize=11.sp)
                Spacer(Modifier.height(5.dp))
                val connected=NcsCloud.activeSession!=null
                Surface(color=Color.White.copy(alpha=.13f),shape=RoundedCornerShape(12.dp)){
                    Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically){
                        Icon(if(connected) Icons.Default.CloudDone else Icons.Default.Lock, null,tint=goldHub,modifier=Modifier.size(19.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(if(connected)"Owner session active • Live Cloud" else "Sign in through Products or any workspace",color=Color.White,fontWeight=FontWeight.SemiBold,fontSize=11.sp)
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                HubMini("LIVE","Supabase",Icons.Default.CloudDone,Color(0xFF267EB0),Modifier.weight(1f))
                HubMini("STUDIO","Web AI",Icons.Default.AutoAwesome,Color(0xFF9160BD),Modifier.weight(1f))
                HubMini("OWNER","Protected",Icons.Default.VerifiedUser,Color(0xFF178876),Modifier.weight(1f))
            }
        }
        item {
            Text("BUSINESS WORKSPACES",Modifier.padding(horizontal=17.dp),fontSize=20.sp,color=royalHub,fontWeight=FontWeight.Black)
        }
        hubActions.chunked(2).forEach{pair->
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    pair.forEach{entry->
                        Card(
                            modifier=Modifier.weight(1f).clickable {onNavigate(entry.key)},
                            colors=CardDefaults.cardColors(containerColor=Color.White),
                            shape=RoundedCornerShape(19.dp)
                        ){
                            Column(Modifier.fillMaxWidth()) {
                                Box(Modifier.fillMaxWidth().height(5.dp).background(entry.shade))
                                Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                                    Surface(color=entry.shade.copy(alpha=.12f),shape=RoundedCornerShape(12.dp)){
                                        Box(Modifier.size(45.dp),contentAlignment=Alignment.Center){
                                            Icon(entry.icon,null,tint=entry.shade,modifier=Modifier.size(24.dp))
                                        }
                                    }
                                    Text(entry.title,color=royalHub,fontSize=15.sp,fontWeight=FontWeight.ExtraBold)
                                    Text(entry.note,color=Color(0xFF62718C),fontSize=10.sp,maxLines=2)
                                    Icon(Icons.Default.ArrowForward,null,tint=entry.shade,modifier=Modifier.size(17.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal=17.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text("LIVE CONNECTION STATUS",color=royalHub,fontWeight=FontWeight.Black,fontSize=17.sp)
                Text("Records above come from your authenticated cloud account. The new app has not yet replaced the existing offline Desktop billing or its two-way financial synchronization.",color=Color(0xFF62718C),fontSize=11.sp)
            }
        }
    }
}
@Composable
private fun HubMini(title:String,sub:String,icon:ImageVector,color:Color,modifier:Modifier) {
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(15.dp)){
        Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
            Icon(icon,null,tint=color,modifier=Modifier.size(20.dp))
            Text(title,color=royalHub,fontWeight=FontWeight.Black,fontSize=11.sp)
            Text(sub,color=Color.Gray,fontSize=10.sp)
        }
    }
}
