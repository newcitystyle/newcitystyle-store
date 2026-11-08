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

private val orderNavy=Color(0xFF0A2E73)
@Composable
internal fun NativeOnlineOrdersScreen(onBack:()->Unit) {
    val scope=rememberCoroutineScope()
    var orders by remember{mutableStateOf<List<JSONObject>>(emptyList())}
    var offset by remember{mutableIntStateOf(0)}
    var loading by remember{mutableStateOf(false)}
    var status by remember{mutableStateOf("Owner sign-in required to see real website orders")}
    var search by remember{mutableStateOf("")}
    var selected by remember{mutableStateOf<JSONObject?>(null)}
    val currency=remember{NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))}
    fun refresh(next:Int) {
        loading=true
        scope.launch{
            try {
                val owner=NcsCloud.restoreActiveSession()?:error("Owner cloud sign-in required; use Products tab")
                orders=NcsCloud.onlineOrders(owner,next,40)
                offset=next
                status="Live online orders • Page "+(next/40+1)+". This does not include POS sales."
            }catch(e:Exception){
                status="Online orders not available: "+(e.message?:"Unknown error")
            }finally{loading=false}
        }
    }
    LaunchedEffect(Unit){refresh(0)}
    if(selected!=null){
        val o=selected!!
        AlertDialog(
            onDismissRequest={selected=null},
            title={Text("Order #"+o.optLong("id"))},
            text={Column(verticalArrangement=Arrangement.spacedBy(7.dp)){
                Text("Customer: "+o.optString("customer_name"))
                Text("Total: "+currency.format(o.optDouble("total_amount",0.0)))
                Text("Order: "+o.optString("order_status"))
                Text("Payment: "+o.optString("payment_status")+" • "+o.optString("payment_method"))
                Text("Tracking: "+o.optString("tracking_id").ifBlank{"Not assigned"})
                Text("Order changes are not enabled on this screen.",color=Color.Gray)
            }},
            confirmButton={TextButton(onClick={selected=null}){Text("CLOSE")}}
        )
    }
    Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FC))){
        Row(Modifier.fillMaxWidth().background(orderNavy).padding(10.dp)){
            TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
            Column(Modifier.weight(1f)){
                Text("ONLINE ORDERS",fontWeight=FontWeight.Black,color=Color.White)
                Text("Native orders • not POS sales",color=Color(0xFFD4AF37))
            }
            TextButton(enabled=!loading,onClick={refresh(0)}){Text("REFRESH",color=Color.White)}
        }
        if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(status,Modifier.padding(12.dp),color=orderNavy)
        OutlinedTextField(search,{search=it},label={Text("Search order or customer on this page")},
            modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp),singleLine=true)
        val filtered=orders.filter{search.isBlank()||it.optString("id").contains(search)
            ||it.optString("customer_name").contains(search,true)}
        LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)){
            items(filtered,key={it.optLong("id")}){o->
                Card(onClick={selected=o}){
                    Column(Modifier.fillMaxWidth().padding(13.dp),
                        verticalArrangement=Arrangement.spacedBy(4.dp)){
                        Text("#"+o.optLong("id")+" • "+o.optString("customer_name","Customer"),
                            fontWeight=FontWeight.Black)
                        Text(currency.format(o.optDouble("total_amount",0.0))+" • "+o.optString("order_status"),
                            color=orderNavy)
                        Text("Payment: "+o.optString("payment_status"),color=Color.Gray)
                    }
                }
            }
            item{
                Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    OutlinedButton(onClick={refresh((offset-40).coerceAtLeast(0))},
                        enabled=!loading&&offset>0,modifier=Modifier.weight(1f)){Text("PREVIOUS")}
                    Button(onClick={refresh(offset+40)},enabled=!loading&&orders.size==40,
                        modifier=Modifier.weight(1f)){Text("NEXT")}
                }
            }
        }
    }
}
