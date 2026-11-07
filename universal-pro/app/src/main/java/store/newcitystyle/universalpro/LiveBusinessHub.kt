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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val royal=Color(0xFF0A2E73)
private val gold=Color(0xFFD4AF37)
private val ivory=Color(0xFFF8F4EC)
private val dark=Color(0xFF14294D)
private val secondary=Color(0xFF61718C)
private val emerald=Color(0xFF067B69)
private val blue=Color(0xFF235EC0)
private val coral=Color(0xFFB95456)
private val purple=Color(0xFF7751AF)
private val amt=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private fun JSONObject.rupees(field:String) = amt.format(optDouble(field,0.0))
private data class Action(val label:String,val desc:String,val icon:ImageVector,val shade:Color,val route:String)
private val actions=listOf(
    Action("AI Product Studio","Photo → Design Names → Publish",Icons.Default.AutoAwesome,purple,"Product Studio"),
    Action("FULL WEB STUDIO","All original AI + photo tools",Icons.Default.Language,Color(0xFF005A90),"Web Product Studio"),
    Action("FULL WEB ADMIN","All existing website modules",Icons.Default.Public,Color(0xFF557DAA),"Full Web Admin"),
    Action("Sales History","All bills • Payments • Returns",Icons.Default.ReceiptLong,blue,"Sales Intelligence"),
    Action("Purchase Center","Supplier stock • Invoices",Icons.Default.LocalShipping,emerald,"Purchase Center"),
    Action("Inventory Radar","Barcode • Variants • Stock",Icons.Default.Inventory2,Color(0xFFB47427),"Inventory Radar"),
    Action("Customer Accounts","Customer records • Dues",Icons.Default.Groups,coral,"Customers"),
    Action("CUSTOMER DUES","Reminder • Receive • Ledger",Icons.Default.AccountBalanceWallet,Color(0xFFB65D46),"Customer Dues"),
    Action("Supplier Ledger","Payments • Account history",Icons.Default.AccountBalanceWallet,purple,"Supplier Ledger"),
    Action("Cash & UPI","Actual cash & bank entries",Icons.Default.AccountBalance,blue,"Cash & Bank"),
    Action("Expenses","Real business expenses",Icons.Default.Receipt,emerald,"Expenses")
)
@Composable
fun LiveBusinessHub(onNavigate:(String)->Unit) {
    val scope=rememberCoroutineScope()
    var session by remember { mutableStateOf(NcsCloud.activeSession) }
    var summary by remember { mutableStateOf<JSONObject?>(null) }
    var totals by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var refreshedAt by remember { mutableStateOf("") }

    fun refresh() {
        session=NcsCloud.activeSession
        val auth=session ?: return
        busy=true;error=""
        scope.launch {
            try {
                summary=NcsCloud.dashboard(auth)
                totals=NcsCloud.businessTotals(auth)
                refreshedAt=summary?.optString("generated_at")?.replace("T"," ")?.take(19)?:""
            }catch(e:Exception){error=e.message?:"Unable to load live dashboard";summary=null}
            finally{busy=false}
        }
    }
    LaunchedEffect(session) {
        val current=session
        if(current!=null) {
            while(true) {
                busy=true
                try {
                    summary=NcsCloud.dashboard(current)
                    totals=NcsCloud.businessTotals(current)
                    refreshedAt=summary?.optString("generated_at")?.replace("T"," ")?.take(19)?:""
                    error=""
                }catch(e:Exception){error=e.message?:"Live dashboard unavailable"}
                finally{busy=false}
                delay(90000)
            }
        }
    }
    LazyColumn(
        modifier=Modifier.fillMaxSize().background(ivory),
        contentPadding=PaddingValues(bottom=24.dp),
        verticalArrangement=Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Color(0xFF071C49),royal,Color(0xFF285EB2))))
                    .padding(horizontal=19.dp,vertical=23.dp),
                verticalArrangement=Arrangement.spacedBy(11.dp)
            ) {
                Row(verticalAlignment=Alignment.CenterVertically){
                    Column(Modifier.weight(1f)) {
                        Text("N E W   C I T Y   S T Y L E",color=gold,fontSize=11.sp,fontWeight=FontWeight.Black)
                        Text("UNIVERSAL PRO",color=Color.White,fontSize=31.sp,fontWeight=FontWeight.Black,letterSpacing=.25.sp)
                        Text("BUSINESS OPERATING SYSTEM",color=Color.White.copy(alpha=.68f),fontSize=9.sp,fontWeight=FontWeight.Bold)
                    }
                    Surface(color=Color.White.copy(alpha=.14f),shape=RoundedCornerShape(15.dp)){
                        Icon(Icons.Default.Diamond,null,tint=gold,modifier=Modifier.padding(12.dp).size(26.dp))
                    }
                }
                HorizontalDivider(color=Color.White.copy(alpha=.19f))
                Text("One business. Every screen. Real data.",color=Color.White.copy(alpha=.87f),fontSize=12.sp)
                Row(verticalAlignment=Alignment.CenterVertically){
                    Icon(if(session!=null)Icons.Default.CloudDone else Icons.Default.CloudOff,null,tint=if(session!=null)Color(0xFF76E2B3) else gold,modifier=Modifier.size(19.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if(session!=null)"CLOUD CONNECTED" else "SIGN IN TO VIEW LIVE DATA",color=Color.White,fontWeight=FontWeight.Bold,fontSize=11.sp,modifier=Modifier.weight(1f))
                    IconButton(onClick={refresh()}){Icon(Icons.Default.Refresh,null,tint=gold)}
                }
                if(busy)LinearProgressIndicator(modifier=Modifier.fillMaxWidth(),color=gold)
                if(error.isNotEmpty())Text(error,color=Color(0xFFFFBBAE),fontSize=11.sp)
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().padding(horizontal=16.dp),
                verticalAlignment=Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)){
                    Text("BUSINESS PULSE",color=royal,fontWeight=FontWeight.Black,fontSize=20.sp)
                    Text(if(summary!=null)"Auto refresh every 90 sec • India time" else "Connect the owner account in Products",color=secondary,fontSize=11.sp)
                }
                Surface(color=Color(0xFFE5F2E9),shape=RoundedCornerShape(9.dp)){
                    Text(if(summary!=null)"LIVE" else "LOGIN",Modifier.padding(horizontal=12.dp,vertical=7.dp),color=emerald,fontSize=10.sp,fontWeight=FontWeight.Black)
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                PulseMetric("TODAY'S SALES",summary?.rupees("today_sales")?:"—",Icons.Default.TrendingUp,emerald,Modifier.weight(1f))
                PulseMetric("MONTH SALES",summary?.rupees("month_sales")?:"—",Icons.Default.CalendarMonth,blue,Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                PulseMetric("TODAY'S BILLS",summary?.optString("today_bills")?:"—",Icons.Default.ReceiptLong,purple,Modifier.weight(1f))
                PulseMetric("TODAY EXPENSE",summary?.rupees("today_expenses")?:"—",Icons.Default.Payments,coral,Modifier.weight(1f))
            }
        }
        item {
            val last=summary?.optString("last_sale_at","")?:""
            val day=last.take(10)
            val lastDay=runCatching{java.time.LocalDate.parse(day)}.getOrNull()
            val now=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
            val stale=lastDay==null||lastDay.isBefore(now.minusDays(1))
            if(stale && summary!=null){
                Card(
                    modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp),
                    colors=CardDefaults.cardColors(containerColor=Color(0xFFFFF1E4)),
                    shape=RoundedCornerShape(14.dp)
                ){
                    Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                        Icon(Icons.Default.CloudOff,null,tint=coral)
                        Spacer(Modifier.width(11.dp))
                        Column {
                            Text("DESKTOP → CLOUD SYNC IS BEHIND",color=Color(0xFF9E462F),fontWeight=FontWeight.Black,fontSize=12.sp)
                            Text("Last synced cloud bill: "+day.ifBlank{"unknown"}+". New Desktop bills are not in Cloud yet.",color=Color(0xFF79574A),fontSize=11.sp)
                        }
                    }
                }
            }
        }
        item {
            Text("ALL-TIME CLOUD BUSINESS TOTALS",Modifier.padding(horizontal=17.dp),color=royal,fontWeight=FontWeight.Black,fontSize=17.sp)
            Text("Data received by Cloud only • Desktop local bills may not be synchronized",Modifier.padding(horizontal=17.dp),color=secondary,fontSize=10.sp)
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){
                PulseMetric("TOTAL CLOUD BILLS",totals?.optString("all_time_cloud_bills")?:"—",Icons.Default.ReceiptLong,blue,Modifier.weight(1f))
                PulseMetric("CLOUD SALES",totals?.rupees("all_time_cloud_sales")?:"—",Icons.Default.TrendingUp,emerald,Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){
                PulseMetric("WEB CUSTOMER DUES",totals?.rupees("website_customer_dues")?:"—",Icons.Default.Groups,coral,Modifier.weight(1f))
                PulseMetric("SUPPLIER DUES",totals?.rupees("supplier_balance")?:"—",Icons.Default.AccountBalanceWallet,purple,Modifier.weight(1f))
            }
        }
        item { LiveSalesTrendCard() }
        item {
            Text("INVENTORY INTELLIGENCE",Modifier.padding(horizontal=17.dp),color=royal,fontWeight=FontWeight.Black,fontSize=17.sp)
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){
                MiniMetric("PRODUCTS",summary?.optString("products")?:"—",blue,Modifier.weight(1f))
                MiniMetric("LOW STOCK",summary?.optString("low_stock_variants")?:"—",Color(0xFFBB832D),Modifier.weight(1f))
                MiniMetric("OUT STOCK",summary?.optString("out_stock_variants")?:"—",coral,Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),verticalAlignment=Alignment.CenterVertically){
                Text("QUICK LAUNCH",color=royal,fontWeight=FontWeight.Black,fontSize=20.sp,modifier=Modifier.weight(1f))
                Text(actions.size.toString()+" WORKSPACES",color=secondary,fontSize=10.sp,fontWeight=FontWeight.Bold)
            }
        }
        actions.chunked(2).forEach {pair->
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    pair.forEach{action->
                        Card(
                            modifier=Modifier.weight(1f).clickable {onNavigate(action.route)},
                            shape=RoundedCornerShape(19.dp),
                            colors=CardDefaults.cardColors(containerColor=Color.White),
                            elevation=CardDefaults.cardElevation(defaultElevation=2.dp)
                        ) {
                            Column(Modifier.fillMaxWidth()) {
                                Box(Modifier.fillMaxWidth().height(5.dp).background(Brush.horizontalGradient(listOf(action.shade,action.shade.copy(alpha=.55f)))))
                                Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                                    Box(Modifier.size(47.dp).background(action.shade.copy(alpha=.13f),RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){
                                        Icon(action.icon,null,tint=action.shade,modifier=Modifier.size(25.dp))
                                    }
                                    Text(action.label,color=dark,fontSize=14.sp,fontWeight=FontWeight.Black,maxLines=2)
                                    Text(action.desc,color=secondary,fontSize=10.sp,minLines=2,maxLines=2)
                                    Row(verticalAlignment=Alignment.CenterVertically){
                                        Text("OPEN",color=action.shade,fontSize=10.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                                        Icon(Icons.Default.ArrowForward,null,tint=action.shade,modifier=Modifier.size(16.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        item {
            Card(
                modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp).clickable{onNavigate("Live Business Cloud")},
                colors=CardDefaults.cardColors(containerColor=royal),shape=RoundedCornerShape(17.dp)
            ){
                Row(Modifier.padding(17.dp),verticalAlignment=Alignment.CenterVertically){
                    Icon(Icons.Default.Dataset,null,tint=gold,modifier=Modifier.size(29.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)){
                        Text("ALL LIVE BUSINESS RECORDS",color=Color.White,fontWeight=FontWeight.Black,fontSize=14.sp)
                        Text("Detailed tables, paging, search and refresh",color=Color.White.copy(alpha=.75f),fontSize=11.sp)
                    }
                    Icon(Icons.Default.ChevronRight,null,tint=gold)
                }
            }
        }
        item {
            Text("Live summary is calculated from Cloud records. Financial write operations and direct Desktop offline synchronization remain separate from this version.",
                Modifier.padding(horizontal=18.dp),color=secondary,fontSize=10.sp)
        }
    }
}
@Composable private fun PulseMetric(title:String,value:String,icon:ImageVector,tint:Color,modifier:Modifier){
    Card(modifier=modifier,shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=Color.White),elevation=CardDefaults.cardElevation(2.dp)){
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
            Row(verticalAlignment=Alignment.CenterVertically){
                Icon(icon,null,tint=tint,modifier=Modifier.size(18.dp))
                Spacer(Modifier.width(7.dp))
                Text(title,color=secondary,fontSize=9.sp,fontWeight=FontWeight.Black)
            }
            Text(value,color=royal,fontSize=20.sp,fontWeight=FontWeight.Black,maxLines=1)
            Box(Modifier.fillMaxWidth().height(3.dp).background(tint.copy(alpha=.65f),RoundedCornerShape(2.dp)))
        }
    }
}
@Composable private fun MiniMetric(label:String,value:String,tint:Color,modifier:Modifier){
    Card(modifier=modifier,shape=RoundedCornerShape(14.dp),colors=CardDefaults.cardColors(containerColor=Color.White)){
        Column(Modifier.padding(11.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){
            Text(label,color=secondary,fontSize=9.sp,fontWeight=FontWeight.Bold)
            Text(value,color=tint,fontWeight=FontWeight.Black,fontSize=23.sp)
        }
    }
}
