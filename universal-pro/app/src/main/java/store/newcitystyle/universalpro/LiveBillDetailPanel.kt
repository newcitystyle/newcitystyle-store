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
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val blueBill=Color(0xFF0A2E73)
private val goldBill=Color(0xFFD4AF37)
private val creamBill=Color(0xFFF8F4EC)
private val tealBill=Color(0xFF178870)
private val moneyBill=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private fun JSONObject.bv(k:String)=optString(k).takeUnless{it=="null"}?:""
private fun JSONObject.ba(k:String)=moneyBill.format(optDouble(k,0.0))

@Composable
internal fun LiveBillDetailPanel(session:NcsCloud.Session,billId:String,onClose:()->Unit) {
    val scope=rememberCoroutineScope()
    var loading by remember(billId){mutableStateOf(true)}
    var details by remember(billId){mutableStateOf<JSONObject?>(null)}
    var error by remember(billId){mutableStateOf("")}
    fun load(){
        loading=true;error=""
        scope.launch{
            try{details=NcsCloud.billDetails(session,billId)}
            catch(e:Exception){error=e.message?:"Unable to load bill details"}
            finally{loading=false}
        }
    }
    LaunchedEffect(billId){load()}
    Column(Modifier.fillMaxSize().background(creamBill)){
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(blueBill,Color(0xFF2C60AA))))
                .padding(9.dp),verticalAlignment=Alignment.CenterVertically
        ) {
            IconButton(onClick=onClose){Icon(Icons.Default.ArrowBack,null,tint=Color.White)}
            Column(Modifier.weight(1f)){
                Text("NEW CITY STYLE",color=goldBill,fontWeight=FontWeight.Bold,fontSize=11.sp)
                Text("ADVANCED BILL DETAILS",color=Color.White,fontWeight=FontWeight.Black,fontSize=20.sp)
            }
            IconButton(onClick={load()}){Icon(Icons.Default.Refresh,null,tint=Color.White)}
        }
        LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(13.dp)) {
            if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
            if(error.isNotBlank())item{Text(error,color=Color(0xFFB84747))}
            val doc=details
            if(doc!=null){
                val b=doc.optJSONObject("bill")?:JSONObject()
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=blueBill),shape=RoundedCornerShape(20.dp)){
                        Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                            Text("INVOICE  •  "+b.bv("invoice_number"),color=goldBill,fontWeight=FontWeight.Bold,fontSize=12.sp)
                            Text(b.ba("total_amount"),color=Color.White,fontWeight=FontWeight.Black,fontSize=31.sp)
                            Text("Customer: "+b.bv("customer_name"),color=Color.White,fontSize=13.sp)
                            Text("Phone: "+b.bv("customer_phone"),color=Color.White.copy(alpha=.8f),fontSize=11.sp)
                            Text("Date: "+b.bv("created_at").replace("T"," ").take(19),color=Color.White.copy(alpha=.75f),fontSize=11.sp)
                        }
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                        BillStat("PAID",b.ba("paid_amount"),tealBill,Modifier.weight(1f))
                        BillStat("DUE",b.ba("due_amount"),Color(0xFFB85146),Modifier.weight(1f))
                    }
                }
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(16.dp)){
                        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                            Text("PAYMENT BREAKDOWN",fontWeight=FontWeight.Black,color=blueBill,fontSize=14.sp)
                            Text("Subtotal "+b.ba("subtotal"),color=blueBill)
                            Text("Tax "+b.ba("tax_amount"),color=blueBill)
                            Text("Bill Discount "+b.ba("bill_discount"),color=blueBill)
                            Text("Method: "+b.bv("payment_method").uppercase(),color=tealBill,fontWeight=FontWeight.Bold)
                            Text("Status: "+b.bv("sale_status"),color=blueBill)
                        }
                    }
                }
                item{Text("PURCHASED ITEMS",color=blueBill,fontWeight=FontWeight.Black,fontSize=19.sp)}
                val items=doc.optJSONArray("items")
                if(items!=null){
                    for(i in 0 until items.length()){
                        val x=items.optJSONObject(i)?:continue
                        item(key="item-"+i){
                            Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(15.dp)){
                                Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                                    Box(Modifier.size(44.dp).background(creamBill,RoundedCornerShape(11.dp)),contentAlignment=Alignment.Center){
                                        Icon(Icons.Default.Checkroom,null,tint=goldBill)
                                    }
                                    Spacer(Modifier.width(11.dp))
                                    Column(Modifier.weight(1f)){
                                        Text(x.bv("product_name"),color=blueBill,fontWeight=FontWeight.Bold,fontSize=13.sp)
                                        Text(x.bv("size")+" / "+x.bv("color")+" • "+x.bv("barcode"),color=Color.Gray,fontSize=10.sp)
                                        Text("Qty "+x.bv("quantity")+" × "+x.ba("unit_price"),color=tealBill,fontSize=11.sp)
                                    }
                                    Text(x.ba("line_total"),color=blueBill,fontWeight=FontWeight.Black,fontSize=13.sp)
                                }
                            }
                        }
                    }
                }
                item{Text("PAYMENT HISTORY",color=blueBill,fontWeight=FontWeight.Black,fontSize=18.sp)}
                val pays=doc.optJSONArray("payments")
                if(pays!=null){
                    for(i in 0 until pays.length()){
                        val x=pays.optJSONObject(i)?:continue
                        item(key="payment-"+i){
                            Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(13.dp)){
                                Row(Modifier.padding(13.dp),verticalAlignment=Alignment.CenterVertically){
                                    Icon(Icons.Default.Payments,null,tint=tealBill)
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)){
                                        Text(x.bv("payment_method"),color=blueBill,fontWeight=FontWeight.Bold)
                                        Text(x.bv("paid_at").replace("T"," ").take(16),color=Color.Gray,fontSize=11.sp)
                                    }
                                    Text(x.ba("amount"),color=tealBill,fontWeight=FontWeight.Black)
                                }
                            }
                        }
                    }
                }
                item {Text("Live cloud invoice • Original sale has not been modified.",fontSize=11.sp,color=Color.Gray)}
            }
        }
    }
}
@Composable private fun BillStat(label:String,value:String,tint:Color,modifier:Modifier) {
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(15.dp)){
        Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){
            Text(label,color=Color.Gray,fontWeight=FontWeight.Bold,fontSize=10.sp)
            Text(value,color=tint,fontWeight=FontWeight.Black,fontSize=17.sp,maxLines=1)
        }
    }
}
