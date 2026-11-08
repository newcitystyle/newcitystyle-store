package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val salesBlue=Color(0xFF0A2E73)
private val salesMoney=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))

/* Real cloud POS sales ledger and itemized invoice detail.
   No fake sales, no offline inbox amounts mixed into accounting, no financial writes.
   Existing authenticated server RPC enforces owner access. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativeSalesHistoryScreen(onBack:()->Unit){
 val scope=rememberCoroutineScope()
 var rows by remember{mutableStateOf<List<JSONObject>>(emptyList())}
 var count by remember{mutableStateOf<Int?>(null)}
 var offset by remember{mutableIntStateOf(0)}
 var search by remember{mutableStateOf("")}
 var loading by remember{mutableStateOf(false)}
 var detailLoading by remember{mutableStateOf(false)}
 var notice by remember{mutableStateOf("Load real sales recorded in the cloud ledger")}
 var selected by remember{mutableStateOf<JSONObject?>(null)}
 var invoice by remember{mutableStateOf<JSONObject?>(null)}
 fun load(next:Int){
  loading=true
  scope.launch{
   try{
    val owner=NcsCloud.restoreActiveSession() ?: error("Sign in as owner from Products")
    val page=NcsCloud.load(owner,"pos_sales",next,40)
    rows=page.items
    count=page.count
    offset=next
    notice="Cloud financial sales: "+(count?:rows.size)+" records • not offline inbox bills"
   }catch(e:Exception){
    notice="Unable to load real ledger: "+(e.message?:"Unknown")
   }finally{loading=false}
  }
 }
 fun openDetails(bill:JSONObject){
  selected=bill;invoice=null;detailLoading=true
  scope.launch{
   try{
    val owner=NcsCloud.restoreActiveSession() ?: error("Owner session expired")
    invoice=NcsCloud.billDetails(owner,bill.optString("id"))
   }catch(e:Exception){
    notice="Invoice details unavailable: "+(e.message?:"Unknown")
   }finally{detailLoading=false}
  }
 }
 LaunchedEffect(Unit){load(0)}
 if(selected!=null){
  val entry=selected!!
  ModalBottomSheet(onDismissRequest={selected=null}){
   Column(Modifier.fillMaxWidth().heightIn(max=640.dp).padding(horizontal=17.dp)){
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
     Text("INVOICE DETAILS",fontWeight=FontWeight.Black,color=salesBlue)
     TextButton(onClick={selected=null}){Text("CLOSE")}
    }
    if(detailLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
    if(invoice==null&&!detailLoading)Text("Details unavailable. Refresh ledger and retry.",color=Color.Gray)
    invoice?.let{response->
     val bill=response.optJSONObject("bill")?:entry
     val lines=response.optJSONArray("items")
     val payments=response.optJSONArray("payments")
     LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){
      item{
       Text(bill.optString("invoice_number","Invoice"),fontWeight=FontWeight.Black,color=salesBlue)
       Text("Customer: "+bill.optString("customer_name","Walk-in"))
       Text("Total: "+salesMoney.format(bill.optDouble("total_amount",0.0)),
        fontWeight=FontWeight.Bold)
       Text("Paid: "+salesMoney.format(bill.optDouble("paid_amount",0.0))+
        "  • Due: "+salesMoney.format(bill.optDouble("due_amount",0.0)))
       Text("Method: "+bill.optString("payment_method","—")+
        "  • Status: "+bill.optString("sale_status","—"))
       HorizontalDivider()
       Text("ITEMS",fontWeight=FontWeight.Black)
      }
      items(lines?.length()?:0){i->
       val x=lines?.optJSONObject(i)?:JSONObject()
       Card{Column(Modifier.fillMaxWidth().padding(10.dp)){
        Text(x.optString("product_name","Product"),fontWeight=FontWeight.Bold)
        Text(x.optString("size","")+" / "+x.optString("color","")+
         "  • Qty "+x.optInt("quantity"))
        Text("Price: "+salesMoney.format(x.optDouble("unit_price",0.0))+
         "  • Line "+salesMoney.format(x.optDouble("line_total",0.0)))
       }}
      }
      item{
       HorizontalDivider()
       Text("PAYMENT RECORDS",fontWeight=FontWeight.Black)
      }
      items(payments?.length()?:0){i->
       val x=payments?.optJSONObject(i)?:JSONObject()
       Text(x.optString("payment_method","Payment")+" • "+
        salesMoney.format(x.optDouble("amount",0.0))+" • "+
        x.optString("payment_status",""))
      }
      item{
       Text("Financial edits, delete and returns are not enabled in this view.",
        color=Color.Gray)
       Spacer(Modifier.height(24.dp))
      }
     }
    }
   }
  }
 }
 Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FC))){
  Row(Modifier.fillMaxWidth().background(salesBlue).padding(10.dp)){
   TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
   Column(Modifier.weight(1f)){
    Text("SALES HISTORY",fontWeight=FontWeight.Black,color=Color.White)
    Text("Native itemized invoices • verified cloud records",color=Color(0xFFD4AF37))
   }
   TextButton(onClick={load(0)},enabled=!loading){Text("REFRESH",color=Color.White)}
  }
  if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  Text(notice,Modifier.padding(12.dp),color=salesBlue)
  OutlinedTextField(search,{search=it},label={Text("Invoice or customer on current page")},
   modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp),singleLine=true)
  val filtered=rows.filter{search.isBlank()||it.optString("invoice_number").contains(search,true)
   ||it.optString("customer_name").contains(search,true)}
  LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),
   verticalArrangement=Arrangement.spacedBy(8.dp)){
   items(filtered,key={it.optString("id")}){bill->
    Card(onClick={openDetails(bill)}){
     Column(Modifier.fillMaxWidth().padding(13.dp),
      verticalArrangement=Arrangement.spacedBy(4.dp)){
      Text(bill.optString("invoice_number","Invoice"),fontWeight=FontWeight.Black)
      Text(bill.optString("customer_name","Walk-in Customer"),color=Color.DarkGray)
      Text(salesMoney.format(bill.optDouble("total_amount",0.0))+
       "  • Due "+salesMoney.format(bill.optDouble("due_amount",0.0)),
       color=salesBlue,fontWeight=FontWeight.Bold)
      Text(bill.optString("created_at","").take(16),color=Color.Gray)
     }
    }
   }
   item{
    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
     OutlinedButton(onClick={load((offset-40).coerceAtLeast(0))},
      enabled=!loading&&offset>0,modifier=Modifier.weight(1f)){Text("PREVIOUS")}
     Button(onClick={load(offset+40)},
      enabled=!loading&&rows.size==40&&(count==null||offset+40<count!!),
      modifier=Modifier.weight(1f)){Text("NEXT")}
    }
   }
  }
  Text("Offline device bills awaiting cloud accounting are NOT included here.",
   modifier=Modifier.padding(12.dp),color=Color.Gray)
 }
}
