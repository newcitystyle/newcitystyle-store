package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
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
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.launch

private val orbitBase=Color(0xFF07142B)
private val orbitPanel=Color(0xFF102E60)
private val orbitBlue=Color(0xFF0A2E73)
private val orbitGold=Color(0xFFD4AF37)
private val orbitMint=Color(0xFF58E9D0)
private val orbitGrey=Color(0xFFA5BDDE)
private val orbitMoney=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))

private data class OrbitModule(val title:String,val desc:String,val icon:ImageVector,val route:String,val color:Color)
private val orbitModules=listOf(
    OrbitModule("AI PRODUCT STUDIO","Real photos & AI publish",Icons.Default.AutoAwesome,"Product Studio",Color(0xFFD4AF37)),
    OrbitModule("LIVE POS & BILLS","Sales and invoices",Icons.Default.ReceiptLong,"Sales Intelligence",Color(0xFF5FE6D5)),
    OrbitModule("CUSTOMER DUES","Receive • Reminder • Ledger",Icons.Default.Groups,"Customer Dues",Color(0xFFFFBC70)),
    OrbitModule("PURCHASES","Supplier incoming stock",Icons.Default.LocalShipping,"Purchase Center",Color(0xFF9CADFF)),
    OrbitModule("STOCK RADAR","Sizes • Colors • Low Stock",Icons.Default.Inventory2,"Inventory Radar",Color(0xFFBB98F4)),
    OrbitModule("FINANCE CENTER","Cash • UPI • Accounts",Icons.Default.AccountBalance,"Cash & Bank",Color(0xFF76D5E7)),
    OrbitModule("FULL WEB ADMIN","All existing edit & save tools",Icons.Default.Language,"Full Web Admin",Color(0xFFF0CB82)),
    OrbitModule("ALL CLOUD RECORDS","Detailed business listings",Icons.Default.CloudDone,"Live Business Cloud",Color(0xFF80E5B7))
)

@Composable
fun OrbitBusinessHubV16(onNavigate:(String)->Unit) {
    val scope=rememberCoroutineScope()
    val session=NcsCloud.activeSession
    var metrics by remember(session){mutableStateOf<JSONObject?>(null)}
    var totals by remember(session){mutableStateOf<JSONObject?>(null)}
    var busy by remember(session){mutableStateOf(false)}
    var error by remember(session){mutableStateOf("")}
    var desktopInboxCount by remember(session){mutableStateOf<Int?>(null)}
    var desktopInboxTotal by remember(session){mutableStateOf<Double?>(null)}
    var desktopInboxError by remember(session){mutableStateOf("")}
    suspend fun refreshInbox(user:NcsCloud.Session){
        try {
            val page=NcsCloud.load(user,"ncs_desktop_sync_inbox_v1",0,100)
            desktopInboxCount=page.count ?: page.items.size
            desktopInboxTotal=page.items.sumOf{it.optDouble("total_amount",0.0)}
            desktopInboxError=""
        } catch(e:Exception){
            desktopInboxError="Desktop inbox unavailable: "+(e.message?:"Unknown error")
        }
    }
    fun refresh(){
        val user=session?:return
        busy=true;error=""
        scope.launch {
            try{
                metrics=NcsCloud.dashboard(user)
                totals=NcsCloud.businessTotals(user)
                refreshInbox(user)
            }catch(e:Exception){error=e.message?:"Cloud data not accessible"}
            finally{busy=false}
        }
    }
    LaunchedEffect(session) {
        if(session!=null){
            while(true) {
                try {
                    metrics=NcsCloud.dashboard(session)
                    totals=NcsCloud.businessTotals(session)
                    refreshInbox(session)
                    error=""
                } catch(e:Exception) { error=e.message?:"Cloud data not accessible" }
                delay(90000)
            }
        }
    }
    val last=metrics?.optString("last_sale_at","")?:""
    val lastDay=last.take(10)
    val today=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
    val lastBillDate=runCatching{java.time.LocalDate.parse(lastDay)}.getOrNull()
    val syncStale=metrics!=null && (lastBillDate==null || lastBillDate.isBefore(today.minusDays(1)))

    LazyColumn(
        modifier=Modifier.fillMaxSize().background(orbitBase),
        contentPadding=PaddingValues(bottom=25.dp),
        verticalArrangement=Arrangement.spacedBy(16.dp)
    ){
        item{
            Column(
                Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF061730),Color(0xFF0A3279),Color(0xFF133F83))))
                    .padding(horizontal=19.dp,vertical=22.dp),
                verticalArrangement=Arrangement.spacedBy(13.dp)
            ){
                Row(verticalAlignment=Alignment.CenterVertically){
                    Box(Modifier.size(49.dp).background(orbitGold,RoundedCornerShape(13.dp)),contentAlignment=Alignment.Center){
                        Text("NCS",fontSize=16.sp,fontWeight=FontWeight.Black,color=orbitBase)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)){
                        Text("NEW CITY STYLE",color=Color.White,fontWeight=FontWeight.Black,fontSize=21.sp,letterSpacing=.5.sp)
                        Text("UNIVERSAL BUSINESS MATRIX",color=orbitGold,fontWeight=FontWeight.Bold,fontSize=10.sp)
                    }
                    Icon(Icons.Default.Verified,null,tint=orbitMint,modifier=Modifier.size(24.dp))
                }
                HorizontalDivider(color=Color.White.copy(alpha=.16f))
                Row(verticalAlignment=Alignment.CenterVertically){
                    Column(Modifier.weight(1f)){
                        Text("FLIGHT DECK",fontSize=11.sp,color=orbitMint,fontWeight=FontWeight.Black,letterSpacing=1.sp)
                        Text("Sales trajectory",color=Color.White,fontWeight=FontWeight.Black,fontSize=26.sp)
                        Text("Live cloud feed • India time",color=orbitGrey,fontSize=11.sp)
                    }
                    IconButton(onClick={refresh()}){Icon(Icons.Default.Refresh,null,tint=orbitGold)}
                }
                Row(verticalAlignment=Alignment.CenterVertically){
                    Icon(if(session!=null)Icons.Default.CloudDone else Icons.Default.CloudOff,null,tint=if(session!=null)orbitMint else orbitGold)
                    Spacer(Modifier.width(8.dp))
                    Text(if(session!=null)"OWNER CLOUD CONNECTED" else "SIGN IN FROM PRODUCTS",color=Color.White,fontSize=11.sp,fontWeight=FontWeight.Bold)
                }
                if(busy)LinearProgressIndicator(Modifier.fillMaxWidth(),color=orbitGold)
                if(error.isNotBlank())Text(error,color=Color(0xFFFFB0A4),fontSize=11.sp)
            }
        }
        item{
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                OrbitMetric("TODAY SALES",metrics?.optDouble("today_sales"),"₹",orbitMint,Modifier.weight(1f))
                OrbitMetric("MONTH SALES",metrics?.optDouble("month_sales"),"₹",orbitGold,Modifier.weight(1f))
            }
        }
        item{
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                OrbitTextMetric("BILLS TODAY",metrics?.optString("today_bills")?:"—",Color(0xFF96C2FF),Modifier.weight(1f))
                OrbitTextMetric("TODAY EXPENSE",metrics?.let{orbitMoney.format(it.optDouble("today_expenses",0.0))}?:"—",Color(0xFFFFB68B),Modifier.weight(1f))
            }
        }
        if(desktopInboxCount!=null) item {
            Card(
                modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp)
                    .clickable{ onNavigate("Sync Center") },
                colors=CardDefaults.cardColors(containerColor=Color(0xFF123C51)),
                shape=RoundedCornerShape(15.dp)
            ){
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Icon(Icons.Default.CloudDone,null,tint=orbitMint)
                        Spacer(Modifier.width(9.dp))
                        Text("DESKTOP BILLS IN CLOUD INBOX",color=Color.White,
                            fontWeight=FontWeight.Black,fontSize=12.sp)
                    }
                    Text("${desktopInboxCount ?: 0} bills • "+
                        orbitMoney.format(desktopInboxTotal ?: 0.0),
                        color=orbitMint,fontWeight=FontWeight.Bold,fontSize=20.sp)
                    Text("Awaiting accounting reconciliation. NOT included in Today's Sales, Stock or Dues.",
                        color=Color(0xFFD4E7F1),fontSize=11.sp)
                    Text("VIEW DESKTOP BILLS",color=orbitGold,
                        fontSize=11.sp,fontWeight=FontWeight.Bold)
                }
            }
        }
        if(desktopInboxError.isNotBlank()) item {
            Text(desktopInboxError,
                modifier=Modifier.padding(horizontal=18.dp),
                color=Color(0xFFFFC9A6),fontSize=11.sp)
        }
        if(syncStale && (desktopInboxCount ?: 0)==0) item{
            Card(
                modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp),
                colors=CardDefaults.cardColors(containerColor=Color(0xFF563527)),
                shape=RoundedCornerShape(15.dp)
            ){
                Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically){
                    Icon(Icons.Default.CloudOff,null,tint=Color(0xFFFFCE88),modifier=Modifier.size(26.dp))
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("DESKTOP BILLS NOT YET SYNCED",color=Color.White,fontWeight=FontWeight.Black,fontSize=12.sp)
                        Text("Last cloud bill: "+lastDay.ifBlank{"unavailable"}+". Today's desktop totals are not included.",color=Color(0xFFFFD8B9),fontSize=11.sp)
                    }
                }
            }
        }
        item {LiveSalesTrendCard()}
        item {
            Column(Modifier.padding(horizontal=17.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                Text("CONTROL ORBIT",color=orbitGold,fontWeight=FontWeight.Black,fontSize=12.sp,letterSpacing=1.sp)
                Row(horizontalArrangement=Arrangement.spacedBy(11.dp)){
                    OrbitShortcut("SALES",Icons.Default.TrendingUp,Color(0xFF69DADB),Modifier.weight(1f)){onNavigate("Sales Intelligence")}
                    OrbitShortcut("DUES",Icons.Default.AccountBalanceWallet,Color(0xFFE6B766),Modifier.weight(1f)){onNavigate("Customer Dues")}
                    OrbitShortcut("PRODUCTS",Icons.Default.Inventory2,Color(0xFFA58EF4),Modifier.weight(1f)){onNavigate("Product Studio")}
                    OrbitShortcut("CASH",Icons.Default.Payments,Color(0xFF7ED3B5),Modifier.weight(1f)){onNavigate("Cash & Bank")}
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                OrbitTextMetric("TOTAL CLOUD BILLS",totals?.optString("all_time_cloud_bills")?:"—",orbitMint,Modifier.weight(1f))
                OrbitTextMetric("CLOUD CUSTOMER DUES",totals?.let{orbitMoney.format(it.optDouble("website_customer_dues"))}?:"—",orbitGold,Modifier.weight(1f))
            }
        }
        item{
            Text("UNIVERSAL WORKSTATIONS",Modifier.padding(horizontal=17.dp),color=Color.White,fontWeight=FontWeight.Black,fontSize=21.sp)
        }
        orbitModules.chunked(2).forEach {pair->
            item{
                Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    pair.forEach{module->
                        Card(
                            modifier=Modifier.weight(1f).clickable{onNavigate(module.route)},
                            colors=CardDefaults.cardColors(containerColor=orbitPanel),
                            shape=RoundedCornerShape(17.dp),
                            border=BorderStroke(1.dp,module.color.copy(alpha=.28f))
                        ){
                            Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                                Box(Modifier.size(46.dp).background(module.color.copy(alpha=.15f),RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center){
                                    Icon(module.icon,null,tint=module.color,modifier=Modifier.size(25.dp))
                                }
                                Text(module.title,color=Color.White,fontWeight=FontWeight.Black,fontSize=12.sp)
                                Text(module.desc,color=orbitGrey,fontSize=10.sp,minLines=2,maxLines=2)
                                Text("OPEN  ›",color=module.color,fontSize=10.sp,fontWeight=FontWeight.Black)
                            }
                        }
                    }
                }
            }
        }
        item{
            Text("LIVE CLOUD FIGURES ONLY. Offline desktop totals require a separate verified sync connection.",
                Modifier.padding(horizontal=17.dp),color=orbitGrey,fontSize=10.sp)
        }
    }
}

@Composable private fun OrbitMetric(title:String,value:Double?,prefix:String,tint:Color,modifier:Modifier){
    OrbitTextMetric(title,if(value==null)"—" else orbitMoney.format(value),tint,modifier)
}
@Composable private fun OrbitTextMetric(title:String,value:String,tint:Color,modifier:Modifier){
    Card(
        modifier=modifier,
        colors=CardDefaults.cardColors(containerColor=orbitPanel),
        shape=RoundedCornerShape(18.dp),
        border=BorderStroke(1.dp,tint.copy(alpha=.26f))
    ){
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
            Text(title,color=orbitGrey,fontSize=10.sp,fontWeight=FontWeight.Bold)
            Text(value,color=tint,fontWeight=FontWeight.Black,fontSize=20.sp,maxLines=1)
            Box(Modifier.fillMaxWidth().height(3.dp).background(tint.copy(alpha=.65f),RoundedCornerShape(2.dp)))
        }
    }
}
@Composable private fun OrbitShortcut(label:String,icon:ImageVector,color:Color,modifier:Modifier,onClick:()->Unit){
    Column(modifier.clickable{onClick()}.background(orbitPanel,RoundedCornerShape(14.dp)).padding(vertical=14.dp,horizontal=5.dp),
        horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(8.dp)){
        Icon(icon,null,tint=color,modifier=Modifier.size(24.dp))
        Text(label,color=Color.White,fontWeight=FontWeight.Bold,fontSize=9.sp)
    }
}
