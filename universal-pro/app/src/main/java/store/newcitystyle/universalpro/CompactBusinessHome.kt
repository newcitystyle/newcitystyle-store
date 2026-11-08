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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val cpBg=Color(0xFF080F20)
private val cpSurface=Color(0xFF16243C)
private val cpText=Color(0xFFF5F8FF)
private val cpMuted=Color(0xFF9CADCB)
private val cpGold=Color(0xFFF2C96C)
private val cpTeal=Color(0xFF69DBC8)
private val cpCurrency=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private data class WorkAction(val title:String,val route:String,val description:String,val isWrite:Boolean)

private val workGroups=linkedMapOf(
 "OPERATIONS" to listOf(
   WorkAction("New Bill","Advanced POS","Offline native POS + local save",true),
   WorkAction("Product Studio","Product Studio","Edit name and brand on cloud",true),
   WorkAction("Customer Dues","Customer Dues","Live dues and WhatsApp reminder",true),
   WorkAction("Inventory Radar","Inventory Radar","Sizes, colors and low stock",false)
 ),
 "FINANCE" to listOf(
   WorkAction("Sales History","Sales History","Verified cloud bill records",false),
   WorkAction("Cash & Bank","Cash & Bank","Cloud records; entry pending",false),
   WorkAction("Supplier Ledger","Supplier Ledger","Cloud records; payment pending",false),
   WorkAction("Expenses","Expenses","Cloud records; entry pending",false)
 ),
 "MANAGEMENT" to listOf(
   WorkAction("Purchases","Purchase Center","Cloud records; new purchase pending",false),
   WorkAction("Sync Center","Sync Center","Offline bills vs cloud inbox",false),
   WorkAction("Local Backup","Local Backup","Export SQLite POS snapshot",true),
   WorkAction("Online Orders","Online Orders","Real website orders and payment status",false),
   WorkAction("Customers","Customers","Live customer due accounts",false),
   WorkAction("Cloud Data","Live Business Cloud","Read-only cloud record browser",false)
 )
)
@Composable
internal fun CompactBusinessHome(onNavigate:(String)->Unit){
 val scope=rememberCoroutineScope()
 var group by remember{mutableStateOf("OPERATIONS")}
 var metrics by remember{mutableStateOf<JSONObject?>(null)}
 var totals by remember{mutableStateOf<JSONObject?>(null)}
 var inboxCount by remember{mutableStateOf<Int?>(null)}
 var loading by remember{mutableStateOf(false)}
 var status by remember{mutableStateOf("Refresh for verified cloud totals. Offline and unreconciled bills are separate.")}
 var search by remember{mutableStateOf("")}
 fun reload(){
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
    status=if(metrics==null)"Cloud sales feed unavailable; dashboard numbers not verified"
      else "Cloud sales only. Offline desktop bills remain in reconciliation inbox."
   }catch(e:Exception){
    status="Cloud disconnected: "+(e.message?:"Unknown error")
    metrics=null
    totals=null
    inboxCount=null
   }finally{loading=false}
  }
 }
 LaunchedEffect(NcsCloud.activeSession){reload()}
 val tasks=workGroups[group].orEmpty().filter{search.isBlank()||it.title.contains(search,true)||it.description.contains(search,true)}
 Column(Modifier.fillMaxSize().background(cpBg)){
  Column(Modifier.fillMaxWidth().background(Color(0xFF10244C)).padding(horizontal=17.dp,vertical=13.dp)){
   Row(verticalAlignment=Alignment.CenterVertically){
    Box(Modifier.size(42.dp).background(cpGold,RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center){
     Text("NCS",fontWeight=FontWeight.Black,color=cpBg)
    }
    Spacer(Modifier.width(11.dp))
    Column(Modifier.weight(1f)){
     Text("NEW CITY STYLE",fontSize=19.sp,fontWeight=FontWeight.Black,color=cpText)
     Text("UNIVERSAL BUSINESS",fontSize=10.sp,fontWeight=FontWeight.Bold,color=cpGold)
    }
    IconButton(onClick={reload()},enabled=!loading){Icon(Icons.Default.Refresh,"Refresh",tint=cpTeal)}
   }
   if(loading)LinearProgressIndicator(Modifier.fillMaxWidth(),color=cpGold)
   Spacer(Modifier.height(12.dp))
   Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
    Button(onClick={onNavigate("Advanced POS")},modifier=Modifier.weight(1f),
     colors=ButtonDefaults.buttonColors(containerColor=cpGold,contentColor=cpBg)){
     Icon(Icons.Default.ReceiptLong,null,Modifier.size(18.dp))
     Spacer(Modifier.width(5.dp))
     Text("NEW BILL",fontWeight=FontWeight.Black)
    }
    OutlinedButton(onClick={onNavigate("Sync Center")},modifier=Modifier.weight(1f)){
     Icon(Icons.Default.Sync,null,Modifier.size(18.dp))
     Spacer(Modifier.width(5.dp))
     Text("SYNC",color=cpText,fontWeight=FontWeight.Bold)
    }
   }
  }
  Row(Modifier.fillMaxWidth().padding(12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
   CompactKpi("CLOUD TODAY",metrics?.let{cpCurrency.format(it.optDouble("today_sales"))}?:"—",cpTeal,Modifier.weight(1f))
   CompactKpi("CLOUD MONTH",metrics?.let{cpCurrency.format(it.optDouble("month_sales"))}?:"—",cpGold,Modifier.weight(1f))
  }
  Row(Modifier.fillMaxWidth().padding(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
   CompactKpi("CUSTOMER DUES",totals?.let{cpCurrency.format(it.optDouble("website_customer_dues"))}?:"—",Color(0xFFFFAC91),Modifier.weight(1f))
   CompactKpi("BILLS IN INBOX",inboxCount?.toString()?:"—",Color(0xFFB7ADFF),Modifier.weight(1f))
  }
  Text(status,modifier=Modifier.padding(horizontal=16.dp,vertical=9.dp),fontSize=10.sp,color=cpMuted,maxLines=2)
  SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal=12.dp)){
   val categories=listOf("OPERATIONS","FINANCE","MANAGEMENT")
   categories.forEachIndexed{index,value->
    SegmentedButton(selected=group==value,onClick={group=value;search=""},
     shape=SegmentedButtonDefaults.itemShape(index=index,count=categories.size),
     label={Text(value,fontSize=10.sp,maxLines=1)})
   }
  }
  OutlinedTextField(search,{search=it},modifier=Modifier.fillMaxWidth().padding(horizontal=13.dp,vertical=7.dp),
    label={Text("Find an action")},singleLine=true,leadingIcon={Icon(Icons.Default.Search,null)})
  LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(horizontal=13.dp,vertical=5.dp),
   verticalArrangement=Arrangement.spacedBy(8.dp)){
   items(tasks,key={it.title}){task->
    Card(onClick={onNavigate(task.route)},
     colors=CardDefaults.cardColors(containerColor=cpSurface),
     shape=RoundedCornerShape(13.dp)){
      Row(Modifier.fillMaxWidth().padding(horizontal=15.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically){
       Column(Modifier.weight(1f)){
        Text(task.title,fontWeight=FontWeight.Bold,fontSize=15.sp,color=cpText)
        Text(task.description,fontSize=11.sp,color=cpMuted,maxLines=1)
       }
       Text(if(task.isWrite)"OPEN" else "VIEW",color=if(task.isWrite)cpTeal else cpGold,fontSize=10.sp,fontWeight=FontWeight.Black)
       Spacer(Modifier.width(8.dp))
       Icon(Icons.Default.ChevronRight,null,tint=cpGold,modifier=Modifier.size(18.dp))
      }
     }
   }
  }
  Text("Financial sync is not complete. Do not count inbox bills as settled sales.",
   modifier=Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=7.dp),
   fontSize=10.sp,color=cpMuted)
 }
}
@Composable
private fun CompactKpi(label:String,value:String,tint:Color,modifier:Modifier){
 Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=cpSurface),
  shape=RoundedCornerShape(13.dp)){
  Column(Modifier.padding(horizontal=12.dp,vertical=11.dp)){
   Text(label,fontSize=9.sp,color=cpMuted,fontWeight=FontWeight.Bold)
   Spacer(Modifier.height(3.dp))
   Text(value,fontSize=17.sp,color=tint,fontWeight=FontWeight.Black,maxLines=1)
  }
 }
}
