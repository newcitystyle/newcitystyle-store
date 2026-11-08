package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val cmBg=Color(0xFF071227)
private val cmNavy=Color(0xFF122B56)
private val cmDeep=Color(0xFF0C1E3B)
private val cmGold=Color(0xFFFFCE6B)
private val cmMint=Color(0xFF67E6D0)
private val cmFaded=Color(0xFFA1B3D0)
private val cmMoney=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private data class CommandTile(val title:String,val detail:String,val route:String,val icon:ImageVector,val accent:Color,val active:Boolean=true)

private val commandTiles=listOf(
    CommandTile("SMART BILLING","Local POS + saved bills","Advanced POS",Icons.Default.ReceiptLong,cmMint),
    CommandTile("PRODUCT STUDIO","Native edit + catalogue","Product Studio",Icons.Default.Inventory2,cmGold),
    CommandTile("CUSTOMER DUES","Balances + WhatsApp","Customer Dues",Icons.Default.Groups,Color(0xFFFF9A99)),
    CommandTile("INVENTORY RADAR","Variants + low stock","Inventory Radar",Icons.Default.QueryStats,Color(0xFFAFA0FF)),
    CommandTile("SYNC CONTROL","Desktop inbox status","Sync Center",Icons.Default.Sync,Color(0xFF8FB7FF)),
    CommandTile("SALES HISTORY","Cloud records","Sales History",Icons.Default.Receipt,Color(0xFF7FDDCA)),
    CommandTile("PURCHASES","Records only; save pending","Purchase Center",Icons.Default.LocalShipping,Color(0xFFACB7FF),false),
    CommandTile("SUPPLIER LEDGER","Records only; pay pending","Supplier Ledger",Icons.Default.AccountBalanceWallet,Color(0xFFFFD18B),false),
    CommandTile("CASH & BANK","Records; entries pending","Cash & Bank",Icons.Default.AccountBalance,Color(0xFF8BDDEC),false),
    CommandTile("EXPENSES","Records; entries pending","Expenses",Icons.Default.Payments,Color(0xFFFFA18A),false)
)

@Composable
internal fun NativeCommandCenter(onNavigate:(String)->Unit){
    val context=LocalContext.current
    val store=remember { NPosStore(context.applicationContext) }
    val scope=rememberCoroutineScope()
    val session=NcsCloud.activeSession
    var totals by remember(session){mutableStateOf<JSONObject?>(null)}
    var metrics by remember(session){mutableStateOf<JSONObject?>(null)}
    var count by remember(session){mutableStateOf<Int?>(null)}
    var inboxValue by remember(session){mutableStateOf<Double?>(null)}
    var busy by remember{mutableStateOf(false)}
    var message by remember{mutableStateOf("Cloud totals and offline desktop sales are separate until reconciliation")}
    var filter by remember{mutableStateOf("")}
    var localPending by remember{mutableIntStateOf(store.inboxPendingCount())}
    var localBills by remember{mutableIntStateOf(store.history().size)}
    fun refresh(){
        localPending=store.inboxPendingCount()
        localBills=store.history().size
        busy=true
        scope.launch {
            try{
                val owner=NcsCloud.restoreActiveSession() ?: error("Owner login required")
                val newMetrics=runCatching{NcsCloud.dashboard(owner)}
                val newTotals=runCatching{NcsCloud.businessTotals(owner)}
                if(newMetrics.isSuccess)metrics=newMetrics.getOrNull()
                if(newTotals.isSuccess)totals=newTotals.getOrNull()
                val inbox=NcsCloud.load(owner,"ncs_desktop_sync_inbox_v1",0,100)
                count=inbox.count?:inbox.items.size
                inboxValue=inbox.items.sumOf{it.optDouble("total_amount",0.0)}
                message=if(newMetrics.isSuccess&&newTotals.isSuccess)
                    "Cloud connected • Ledger figures exclude unreconciled desktop bills"
                else "Cloud partially available • Some ledger figures could not be refreshed"
            }catch(e:Exception){
                message="Cloud feed unavailable • Local POS remains accessible: "+(e.message?:"Unknown")
            }finally{busy=false}
        }
    }
    LaunchedEffect(session){refresh()}
    val visible=commandTiles.filter{filter.isBlank()||it.title.contains(filter,true)||it.detail.contains(filter,true)}
    val cloudToday=metrics?.let { cmMoney.format(it.optDouble("today_sales",0.0)) } ?: "—"
    val cloudMonth=metrics?.let { cmMoney.format(it.optDouble("month_sales",0.0)) } ?: "—"
    val due=totals?.let{cmMoney.format(it.optDouble("website_customer_dues",0.0))} ?: "—"
    LazyColumn(
        modifier=Modifier.fillMaxSize().background(cmBg),
        contentPadding=PaddingValues(bottom=24.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)
    ){
        item{
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Color(0xFF081A36),Color(0xFF153A77),Color(0xFF0A2E73))))
                    .padding(horizontal=18.dp,vertical=22.dp),
                verticalArrangement=Arrangement.spacedBy(15.dp)
            ){
                Row(verticalAlignment=Alignment.CenterVertically){
                    Box(Modifier.size(48.dp).background(cmGold,RoundedCornerShape(16.dp)),contentAlignment=Alignment.Center){
                        Text("NCS",fontWeight=FontWeight.Black,fontSize=17.sp,color=cmBg)
                    }
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)){
                        Text("NEW CITY STYLE",fontWeight=FontWeight.Black,fontSize=22.sp,color=Color.White)
                        Text("UNIVERSAL BUSINESS COMMAND",fontSize=10.sp,fontWeight=FontWeight.Bold,color=cmGold)
                    }
                    FilledTonalIconButton(onClick={refresh()},colors=IconButtonDefaults.filledTonalIconButtonColors(containerColor=Color.White.copy(alpha=.15f))){
                        Icon(Icons.Default.Refresh,null,tint=Color.White)
                    }
                }
                Text("OWNER WORKSPACE  /  MOBILE",fontSize=11.sp,fontWeight=FontWeight.Bold,color=cmMint)
                Text("Your store.\nEverywhere.",fontSize=33.sp,lineHeight=36.sp,fontWeight=FontWeight.Black,color=Color.White)
                Text("Direct native tools for billing, products, customers and stock.",color=Color(0xFFC8DAF1),fontSize=12.sp)
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp),verticalAlignment=Alignment.CenterVertically){
                    Icon(if(session==null)Icons.Default.CloudOff else Icons.Default.CloudDone,null,tint=cmMint,modifier=Modifier.size(18.dp))
                    Text(if(session==null)"OWNER LOGIN REQUIRED" else "OWNER SESSION CONNECTED",color=Color.White,fontSize=10.sp,fontWeight=FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    Text("NATIVE ANDROID",color=cmGold,fontSize=10.sp,fontWeight=FontWeight.Black)
                }
                if(busy)LinearProgressIndicator(Modifier.fillMaxWidth(),color=cmGold)
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                    Button(
                        onClick={onNavigate("Advanced POS")},
                        modifier=Modifier.weight(1f),shape=RoundedCornerShape(14.dp),
                        colors=ButtonDefaults.buttonColors(containerColor=cmGold,contentColor=cmBg)
                    ){Icon(Icons.Default.Add,null,modifier=Modifier.size(18.dp));Spacer(Modifier.width(5.dp));Text("NEW BILL",fontWeight=FontWeight.Black)}
                    OutlinedButton(
                        onClick={onNavigate("Product Studio")},modifier=Modifier.weight(1f),
                        shape=RoundedCornerShape(14.dp),
                        border=BorderStroke(1.dp,Color.White.copy(alpha=.45f))
                    ){Icon(Icons.Default.Inventory2,null,modifier=Modifier.size(18.dp),tint=Color.White);Spacer(Modifier.width(4.dp));Text("PRODUCTS",color=Color.White,fontSize=12.sp)}
                }
            }
        }
        item{
            Column(Modifier.padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                Row(verticalAlignment=Alignment.CenterVertically){
                    Icon(Icons.Default.Insights,null,tint=cmMint)
                    Spacer(Modifier.width(8.dp))
                    Text("BUSINESS PULSE",fontSize=18.sp,fontWeight=FontWeight.Black,color=Color.White)
                    Spacer(Modifier.weight(1f))
                    Text("CLOUD LEDGER",fontSize=10.sp,color=cmGold,fontWeight=FontWeight.Bold)
                }
                Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    CommandMetric("TODAY / CLOUD",cloudToday,cmMint,Modifier.weight(1f))
                    CommandMetric("MONTH / CLOUD",cloudMonth,cmGold,Modifier.weight(1f))
                }
                Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    CommandMetric("CUSTOMER DUES / CLOUD",due,Color(0xFFFFBC96),Modifier.weight(1f))
                    CommandMetric("LOCAL POS SAVED",localBills.toString(),Color(0xFF9FACFF),Modifier.weight(1f))
                }
            }
        }
        item {
            Card(
                modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp),
                colors=CardDefaults.cardColors(containerColor=Color(0xFF193750)),
                shape=RoundedCornerShape(19.dp)
            ){
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Icon(Icons.Default.Shield,null,tint=cmMint)
                        Spacer(Modifier.width(8.dp))
                        Text("FINANCIAL SYNC WATCH",color=Color.White,fontWeight=FontWeight.Black,fontSize=15.sp)
                    }
                    Text(message,color=Color(0xFFC8DCEA),fontSize=11.sp)
                    HorizontalDivider(color=Color.White.copy(alpha=.12f))
                    Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                        Column(Modifier.weight(1f)){
                            Text("DESKTOP CLOUD INBOX",fontSize=10.sp,color=cmFaded)
                            Text(if(count==null)"—" else count.toString()+" bills",fontSize=18.sp,color=cmMint,fontWeight=FontWeight.Black)
                            Text(if(inboxValue==null)"Not fetched" else cmMoney.format(inboxValue!!),fontSize=12.sp,color=Color.White)
                        }
                        Column(Modifier.weight(1f)){
                            Text("PHONE NOT UPLOADED",fontSize=10.sp,color=cmFaded)
                            Text(localPending.toString()+" bills",fontSize=18.sp,color=cmGold,fontWeight=FontWeight.Black)
                            Text("Local inbox queue",fontSize=12.sp,color=Color.White)
                        }
                    }
                    Text("Inbox bills are NOT included in financial sales, stock or dues until reconciled.",fontSize=10.sp,color=Color(0xFFFFC6A0))
                    OutlinedButton(onClick={onNavigate("Sync Center")},shape=RoundedCornerShape(13.dp)){
                        Icon(Icons.Default.Sync,null,modifier=Modifier.size(17.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("OPEN SYNC CENTER")
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                Text("QUICK OPERATIONS",fontSize=18.sp,fontWeight=FontWeight.Black,color=Color.White)
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                    CommandQuick("BILLING",Icons.Default.ReceiptLong,cmMint,Modifier.weight(1f)){onNavigate("Advanced POS")}
                    CommandQuick("DUES",Icons.Default.People,cmGold,Modifier.weight(1f)){onNavigate("Customer Dues")}
                    CommandQuick("STOCK",Icons.Default.Inventory2,Color(0xFFBBA4FF),Modifier.weight(1f)){onNavigate("Inventory Radar")}
                    CommandQuick("SYNC",Icons.Default.Sync,Color(0xFF8ABCF9),Modifier.weight(1f)){onNavigate("Sync Center")}
                }
            }
        }
        item{
            Column(Modifier.padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                Text("ALL WORKSTATIONS",color=Color.White,fontWeight=FontWeight.Black,fontSize=19.sp)
                OutlinedTextField(filter,{filter=it},modifier=Modifier.fillMaxWidth(),
                    singleLine=true,label={Text("Find an action")},
                    leadingIcon={Icon(Icons.Default.Search,null)},
                    colors=OutlinedTextFieldDefaults.colors(focusedTextColor=Color.White,
                      unfocusedTextColor=Color.White,focusedBorderColor=cmGold,
                      unfocusedBorderColor=cmFaded,focusedLabelColor=cmGold,
                      unfocusedLabelColor=cmFaded,focusedLeadingIconColor=cmGold,
                      unfocusedLeadingIconColor=cmFaded))
            }
        }
        items(visible.chunked(2)){pair->
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                for(tile in pair){
                    Card(
                        modifier=Modifier.weight(1f).clickable{onNavigate(tile.route)},
                        colors=CardDefaults.cardColors(containerColor=cmNavy),
                        shape=RoundedCornerShape(18.dp),
                        border=BorderStroke(1.dp,tile.accent.copy(alpha=.27f))
                    ){
                        Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                            Box(Modifier.size(43.dp).background(tile.accent.copy(alpha=.14f),RoundedCornerShape(12.dp)),
                                contentAlignment=Alignment.Center){
                                Icon(tile.icon,null,tint=tile.accent,modifier=Modifier.size(23.dp))
                            }
                            Text(tile.title,color=Color.White,fontWeight=FontWeight.Black,fontSize=12.sp)
                            Text(tile.detail,color=cmFaded,fontSize=10.sp,minLines=2,maxLines=2)
                            Text(if(tile.active)"OPEN TOOL  ›" else "VIEW RECORDS  ›",
                                color=tile.accent,fontWeight=FontWeight.Bold,fontSize=10.sp)
                        }
                    }
                }
                if(pair.size==1)Spacer(Modifier.weight(1f))
            }
        }
        item{
            Text("SAFE MODE: Unreconciled Desktop and Phone bills never inflate the cloud financial totals.",
                modifier=Modifier.padding(horizontal=17.dp),color=cmFaded,fontSize=10.sp)
        }
    }
}
@Composable
private fun CommandMetric(label:String,value:String,color:Color,modifier:Modifier){
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=cmDeep),
        shape=RoundedCornerShape(18.dp),border=BorderStroke(1.dp,color.copy(alpha=.25f))){
        Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
            Text(label,color=cmFaded,fontSize=10.sp,fontWeight=FontWeight.Bold)
            Text(value,color=color,fontSize=20.sp,maxLines=1,fontWeight=FontWeight.Black)
            Box(Modifier.fillMaxWidth().height(3.dp).background(color.copy(alpha=.7f),RoundedCornerShape(2.dp)))
        }
    }
}
@Composable
private fun CommandQuick(label:String,icon:ImageVector,tint:Color,modifier:Modifier,onClick:()->Unit){
    Column(modifier.clickable(onClick=onClick).background(cmNavy,RoundedCornerShape(15.dp)).padding(vertical=14.dp,horizontal=3.dp),
        horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(8.dp)){
        Icon(icon,null,tint=tint,modifier=Modifier.size(24.dp))
        Text(label,color=Color.White,fontSize=9.sp,fontWeight=FontWeight.Bold)
    }
}
