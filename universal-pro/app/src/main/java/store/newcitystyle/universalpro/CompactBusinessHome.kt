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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

// NEW CITY STYLE — Premium native command center. All values come from the existing
// authenticated data calls; UI does not create, post or modify financial records.
private val deepNavy=Color(0xFF071638)
private val royal=Color(0xFF0A2E73)
private val brightBlue=Color(0xFF1B5DDC)
private val gold=Color(0xFFD4AF37)
private val mint=Color(0xFF00BC9A)
private val ink=Color(0xFF172440)
private val muted=Color(0xFF67758F)
private val canvas=Color(0xFFF4F7FD)
private val white=Color.White
private val currency=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private data class WorkAction(val title:String,val route:String,val description:String,val isWrite:Boolean)
private val workGroups=linkedMapOf(
 "OPERATIONS" to listOf(
   WorkAction("New Bill","Advanced POS","Offline billing and local invoice save",true),
   WorkAction("Product Studio","Product Studio","Products, variants and images",true),
   WorkAction("Customer Dues","Customer Dues","Live customer ledger and reminders",true),
   WorkAction("Inventory Radar","Inventory Radar","Sizes, colours and low stock",false)
 ),
 "FINANCE" to listOf(
   WorkAction("Sales History","Sales History","Verified cloud invoices",false),
   WorkAction("Cash & Bank","Cash & Bank","Cash and UPI cloud records",false),
   WorkAction("Supplier Ledger","Supplier Ledger","Supplier balances and records",false),
   WorkAction("Expenses","Expenses","Expense ledger and history",false)
 ),
 "MANAGEMENT" to listOf(
   WorkAction("Purchases","Purchase Center","Purchase history and inward stock",false),
   WorkAction("Sync Center","Sync Center","Desktop, phone and cloud inbox",false),
   WorkAction("Local Backup","Local Backup","Verified phone POS ZIP backup",true),
   WorkAction("Online Orders","Online Orders","Website orders and payment state",false),
   WorkAction("Customers","Customers","Customer accounts and credit",false),
   WorkAction("Cloud Data","Live Business Cloud","Owner cloud records",false)
 )
)

private fun actionIcon(route:String):ImageVector=when(route){
 "Advanced POS"->Icons.Default.ReceiptLong
 "Product Studio"->Icons.Default.Style
 "Customer Dues","Customers"->Icons.Default.Groups
 "Inventory Radar"->Icons.Default.Inventory2
 "Sales History"->Icons.Default.BarChart
 "Cash & Bank"->Icons.Default.AccountBalanceWallet
 "Supplier Ledger"->Icons.Default.LocalShipping
 "Expenses"->Icons.Default.Payments
 "Purchase Center"->Icons.Default.ShoppingCart
 "Sync Center"->Icons.Default.Sync
 "Local Backup"->Icons.Default.Backup
 "Online Orders"->Icons.Default.Storefront
 else->Icons.Default.Cloud
}
private fun actionTint(route:String):Color=when(route){
 "Advanced POS","Cash & Bank"->Color(0xFF1763E5)
 "Product Studio","Purchase Center"->Color(0xFF8053DD)
 "Customer Dues","Customers"->Color(0xFF00A78A)
 "Inventory Radar","Supplier Ledger"->Color(0xFFFF914D)
 "Sales History","Expenses"->Color(0xFFED6586)
 else->Color(0xFF2786B4)
}

@Composable
internal fun CompactBusinessHome(onNavigate:(String)->Unit){
 val scope=rememberCoroutineScope()
 var group by remember{mutableStateOf("OPERATIONS")}
 var metrics by remember{mutableStateOf<JSONObject?>(null)}
 var totals by remember{mutableStateOf<JSONObject?>(null)}
 var inboxCount by remember{mutableStateOf<Int?>(null)}
 var loading by remember{mutableStateOf(false)}
 var status by remember{mutableStateOf("Refresh to verify cloud totals. Inbox bills are not settled sales.")}
 var search by remember{mutableStateOf("")}

 fun reload(){
  if(loading)return
  loading=true
  scope.launch{
   try{
    val user=NcsCloud.restoreActiveSession()?:error("Owner sign-in required")
    val resultMetrics=runCatching{NcsCloud.dashboard(user)}
    val resultTotals=runCatching{NcsCloud.businessTotals(user)}
    val resultInbox=runCatching{NcsCloud.load(user,"ncs_desktop_sync_inbox_v1",0,100)}
    metrics=resultMetrics.getOrNull()
    totals=resultTotals.getOrNull()
    inboxCount=resultInbox.getOrNull()?.count?:resultInbox.getOrNull()?.items?.size
    status=if(metrics==null)"Cloud sales unavailable. Totals are not verified."
      else "Cloud totals only • Inbox invoices await financial reconciliation"
   }catch(e:Exception){
    status="Cloud disconnected: "+(e.message?:"Unknown error")
    metrics=null;totals=null;inboxCount=null
   }finally{loading=false}
  }
 }
 LaunchedEffect(NcsCloud.activeSession){reload()}
 val tasks=workGroups[group].orEmpty().filter{
  search.isBlank()||it.title.contains(search,true)||it.description.contains(search,true)
 }
 Column(Modifier.fillMaxSize().background(canvas)){
  LazyColumn(
   modifier=Modifier.fillMaxSize(),
   contentPadding=PaddingValues(bottom=22.dp),
   verticalArrangement=Arrangement.spacedBy(13.dp)
  ){
   item{
    Column(
     Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(deepNavy,royal,brightBlue)))
       .padding(start=18.dp,end=18.dp,top=20.dp,bottom=22.dp)
    ){
     Row(verticalAlignment=Alignment.CenterVertically){
      Box(Modifier.size(53.dp).clip(RoundedCornerShape(17.dp))
        .background(Brush.linearGradient(listOf(Color(0xFFF7DC9D),gold))),
        contentAlignment=Alignment.Center){
       Text("NCS",color=deepNavy,fontWeight=FontWeight.Black,fontSize=18.sp)
      }
      Spacer(Modifier.width(12.dp))
      Column(Modifier.weight(1f)){
       Text("NEW CITY STYLE",color=white,fontSize=21.sp,fontWeight=FontWeight.Black,letterSpacing=0.4.sp,maxLines=1)
       Text("UNIVERSAL PRO  •  BUSINESS HUB",color=Color(0xFFFFDEA1),fontSize=10.sp,fontWeight=FontWeight.Bold)
      }
      IconButton(onClick={reload()},enabled=!loading){
       Icon(Icons.Default.Refresh,contentDescription="Refresh live figures",tint=Color(0xFF78F3D9))
      }
     }
     Spacer(Modifier.height(18.dp))
     Text("Your business, one powerful workspace",color=white.copy(alpha=.88f),fontSize=13.sp)
     Spacer(Modifier.height(14.dp))
     Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
      Button(
       onClick={onNavigate("Advanced POS")},
       modifier=Modifier.weight(1f).height(49.dp),
       shape=RoundedCornerShape(16.dp),
       colors=ButtonDefaults.buttonColors(containerColor=Color(0xFFF3CF79),contentColor=deepNavy)
      ){
       Icon(Icons.Default.ReceiptLong,null,Modifier.size(19.dp))
       Spacer(Modifier.width(7.dp))
       Text("NEW BILL",fontWeight=FontWeight.ExtraBold,fontSize=13.sp)
      }
      OutlinedButton(
       onClick={onNavigate("Sync Center")},
       modifier=Modifier.weight(1f).height(49.dp),
       shape=RoundedCornerShape(16.dp),
       border=BorderStroke(1.dp,white.copy(alpha=.48f))
      ){
       Icon(Icons.Default.Sync,null,tint=white,modifier=Modifier.size(18.dp))
       Spacer(Modifier.width(7.dp))
       Text("SYNC CENTER",color=white,fontSize=11.sp,fontWeight=FontWeight.Bold,maxLines=1)
      }
     }
     if(loading){
      Spacer(Modifier.height(10.dp))
      LinearProgressIndicator(Modifier.fillMaxWidth(),color=gold)
     }
    }
   }
   item{
    Row(Modifier.fillMaxWidth().padding(horizontal=15.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
     PremiumKpi("TODAY'S SALES",metrics?.let{currency.format(it.optDouble("today_sales"))}?:"—",
       Icons.Default.TrendingUp,Color(0xFF0BAD92),Color(0xFFE0FBF4),Modifier.weight(1f))
     PremiumKpi("THIS MONTH",metrics?.let{currency.format(it.optDouble("month_sales"))}?:"—",
       Icons.Default.CalendarMonth,Color(0xFF286CE0),Color(0xFFE8F0FF),Modifier.weight(1f))
    }
   }
   item{
    Row(Modifier.fillMaxWidth().padding(horizontal=15.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
     PremiumKpi("CUSTOMER DUES",totals?.let{currency.format(it.optDouble("website_customer_dues"))}?:"—",
       Icons.Default.AccountBalanceWallet,Color(0xFFEA7A4C),Color(0xFFFFF0E7),Modifier.weight(1f))
     PremiumKpi("BILLS IN INBOX",inboxCount?.toString()?:"—",
       Icons.Default.CloudQueue,Color(0xFF8659D9),Color(0xFFF2EAFF),Modifier.weight(1f))
    }
   }
   item{
    Row(
     Modifier.fillMaxWidth().padding(horizontal=15.dp).clip(RoundedCornerShape(13.dp))
       .background(Color(0xFFFFF4DF)).padding(11.dp),
     verticalAlignment=Alignment.CenterVertically
    ){
     Icon(Icons.Default.Info,null,tint=Color(0xFFAB721B),modifier=Modifier.size(17.dp))
     Spacer(Modifier.width(9.dp))
     Text(status,color=Color(0xFF775521),fontSize=11.sp,lineHeight=15.sp)
    }
   }
   item{
    Row(
     Modifier.fillMaxWidth().padding(horizontal=15.dp).clip(RoundedCornerShape(17.dp))
       .background(Color(0xFFE7EDF7)).padding(4.dp),
     horizontalArrangement=Arrangement.spacedBy(4.dp)
    ){
     listOf("OPERATIONS","FINANCE","MANAGEMENT").forEach{tab->
      val active=tab==group
      Box(
       Modifier.weight(1f).clip(RoundedCornerShape(13.dp))
        .background(if(active)royal else Color.Transparent)
        .clickable{group=tab;search=""}
        .padding(vertical=12.dp),
       contentAlignment=Alignment.Center
      ){
       Text(tab,fontSize=10.sp,fontWeight=FontWeight.ExtraBold,
        color=if(active)white else Color(0xFF4D5E7B),maxLines=1)
      }
     }
    }
   }
   item{
    OutlinedTextField(
     value=search,onValueChange={search=it},
     modifier=Modifier.fillMaxWidth().padding(horizontal=15.dp),
     singleLine=true,
     placeholder={Text("Search business actions",fontSize=13.sp,color=muted)},
     leadingIcon={Icon(Icons.Default.Search,null,tint=Color(0xFF607CA8))},
     shape=RoundedCornerShape(17.dp),
     colors=OutlinedTextFieldDefaults.colors(
      focusedContainerColor=white,unfocusedContainerColor=white,
      focusedBorderColor=brightBlue,unfocusedBorderColor=Color(0xFFDCE5F4)
     )
    )
   }
   item{
    Row(Modifier.fillMaxWidth().padding(horizontal=17.dp),verticalAlignment=Alignment.CenterVertically){
     Text("QUICK ACCESS",fontSize=13.sp,color=ink,fontWeight=FontWeight.Black,letterSpacing=1.sp)
     Spacer(Modifier.weight(1f))
     Text("${tasks.size} TOOLS",fontSize=10.sp,color=muted,fontWeight=FontWeight.Bold)
    }
   }
   items(tasks,key={it.route}){task->
    val tint=actionTint(task.route)
    Card(
     onClick={onNavigate(task.route)},
     modifier=Modifier.fillMaxWidth().padding(horizontal=15.dp),
     colors=CardDefaults.cardColors(containerColor=white),
     elevation=CardDefaults.cardElevation(defaultElevation=2.dp),
     shape=RoundedCornerShape(20.dp)
    ){
     Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){
      Box(
       Modifier.size(48.dp).clip(RoundedCornerShape(15.dp)).background(tint.copy(alpha=.12f)),
       contentAlignment=Alignment.Center
      ){
       Icon(actionIcon(task.route),null,tint=tint,modifier=Modifier.size(25.dp))
      }
      Spacer(Modifier.width(13.dp))
      Column(Modifier.weight(1f)){
       Text(task.title,color=ink,fontSize=15.sp,fontWeight=FontWeight.ExtraBold,maxLines=1)
       Spacer(Modifier.height(4.dp))
       Text(task.description,color=muted,fontSize=11.sp,maxLines=2,
         overflow=TextOverflow.Ellipsis,lineHeight=15.sp)
      }
      Spacer(Modifier.width(7.dp))
      Icon(Icons.Default.ArrowForwardIos,null,tint=tint,modifier=Modifier.size(15.dp))
     }
    }
   }
   if(tasks.isEmpty()){
    item{
     Text("No matching action",modifier=Modifier.padding(24.dp),
      color=muted,fontSize=14.sp)
    }
   }
   item{
    Text("Inbox upload is not final settlement. Verify financial sync before counting it as a sale.",
     modifier=Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=8.dp),
     color=muted,fontSize=10.sp,lineHeight=15.sp)
   }
  }
 }
}

@Composable
private fun PremiumKpi(label:String,value:String,icon:ImageVector,tint:Color,soft:Color,modifier:Modifier){
 Card(modifier=modifier,shape=RoundedCornerShape(19.dp),
  colors=CardDefaults.cardColors(containerColor=white),
  elevation=CardDefaults.cardElevation(defaultElevation=2.dp)){
  Column(Modifier.fillMaxWidth().padding(13.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Box(Modifier.size(33.dp).clip(RoundedCornerShape(11.dp)).background(soft),contentAlignment=Alignment.Center){
    Icon(icon,null,tint=tint,modifier=Modifier.size(18.dp))
   }
   Text(label,fontSize=9.sp,color=muted,fontWeight=FontWeight.ExtraBold,maxLines=1)
   Text(value,fontSize=18.sp,color=ink,fontWeight=FontWeight.Black,maxLines=1,
    overflow=TextOverflow.Ellipsis)
  }
 }
}
