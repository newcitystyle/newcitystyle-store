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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val customerBlue=Color(0xFF0A2E73)
private val customerGold=Color(0xFFD4AF37)
private val customerPaper=Color(0xFFF8F4EC)
private val customerTeal=Color(0xFF07846E)
private val moneyCustomer=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))
private fun JSONObject.ct(k:String)=optString(k).takeUnless{it=="null"}?:""
private fun JSONObject.cr(k:String)=moneyCustomer.format(optDouble(k,0.0))

@Composable
fun LiveCustomer360Screen(onBack:()->Unit) {
    val scope=rememberCoroutineScope()
    val session=NcsCloud.activeSession
    var loading by remember{mutableStateOf(false)}
    var error by remember{mutableStateOf("")}
    var mode by remember{mutableStateOf("Customers")}
    var list by remember{mutableStateOf<List<JSONObject>>(emptyList())}
    var offset by remember{mutableIntStateOf(0)}
    var count by remember{mutableStateOf<Int?>(null)}
    var search by remember{mutableStateOf("")}
    var customer by remember{mutableStateOf<JSONObject?>(null)}
    var profile by remember{mutableStateOf<JSONObject?>(null)}
    var currentBill by remember{mutableStateOf<String?>(null)}
    var confirmAccount by remember{mutableStateOf<JSONObject?>(null)}
    var sending by remember{mutableStateOf(false)}
    var sendStatus by remember{mutableStateOf("")}

    fun reload(next:Int=0,tab:String=mode){
        val auth=session?:return
        loading=true;error="";offset=next;mode=tab
        scope.launch{
            try{
                val page=NcsCloud.load(auth,if(tab=="Customers")"customers" else "customer_credit_accounts",next,40)
                list=page.items;count=page.count
            }catch(e:Exception){error=e.message?:"Customer data unavailable";list=emptyList()}
            finally{loading=false}
        }
    }
    fun open(entry:JSONObject){
        val auth=session?:return
        customer=entry;profile=null;error="";sendStatus=""
        val id=if(mode=="Customers")entry.optLong("id") else entry.optLong("customer_id")
        if(id<=0)return
        loading=true
        scope.launch {
            try{profile=NcsCloud.customerProfile(auth,id)}
            catch(e:Exception){error=e.message?:"Could not load customer profile"}
            finally{loading=false}
        }
    }
    LaunchedEffect(session){if(session!=null)reload()}
    if(currentBill!=null && session!=null){
        LiveBillDetailPanel(session,currentBill!!,onClose={currentBill=null})
        return
    }
    Column(Modifier.fillMaxSize().background(customerPaper)) {
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(customerBlue,Color(0xFF2859AB))))
                .padding(10.dp),verticalAlignment=Alignment.CenterVertically
        ) {
            IconButton(onClick={
                if(customer!=null){customer=null;profile=null;sendStatus=""}
                else onBack()
            }) {Icon(Icons.Default.ArrowBack,null,tint=Color.White)}
            Column(Modifier.weight(1f)){
                Text("NEW CITY STYLE",color=customerGold,fontWeight=FontWeight.Bold,fontSize=10.sp)
                Text(if(customer!=null)"CUSTOMER 360°" else "CUSTOMER INTELLIGENCE",color=Color.White,fontWeight=FontWeight.Black,fontSize=20.sp)
            }
            IconButton(onClick={
                if(customer==null)reload(offset)
                else customer?.let{open(it)}
            }){Icon(Icons.Default.Refresh,null,tint=Color.White)}
        }
        if(session==null){
            Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){
                Text("Sign in through Products to load real customer records.",color=customerBlue)
            }
        } else if(customer==null){
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                item {
                    Text("REAL CUSTOMER ACCOUNTS",color=customerBlue,fontWeight=FontWeight.Black,fontSize=17.sp)
                    Text("Tap any card for purchase history, bills and due details.",color=Color.Gray,fontSize=11.sp)
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        listOf("Customers","Due Accounts").forEach{tab->
                            FilterChip(selected=mode==tab,onClick={reload(0,tab);search=""},label={Text(tab)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=customerGold))
                        }
                    }
                }
                item {
                    OutlinedTextField(value=search,onValueChange={search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        label={Text("Search this page by name or phone")},leadingIcon={Icon(Icons.Default.Search,null)})
                }
                item {
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Text((count?.toString()?:"—")+" "+mode.lowercase(),color=customerBlue,fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
                        Text("Newest / Due Priority",fontSize=10.sp,color=Color.Gray)
                    }
                }
                if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
                if(error.isNotBlank())item{Text(error,color=Color(0xFFB74444))}
                items(list.filter {search.isBlank()||it.toString().contains(search,true)},key={it.optLong("id")}){entry->
                    val isDue=mode=="Due Accounts"
                    val name=entry.ct(if(isDue)"customer_name" else "full_name")
                    val phone=entry.ct(if(isDue)"customer_phone" else "phone")
                    val due=entry.optDouble("current_balance",0.0)
                    Card(
                        modifier=Modifier.fillMaxWidth().clickable{open(entry)},
                        shape=RoundedCornerShape(18.dp),
                        colors=CardDefaults.cardColors(containerColor=Color.White),
                        elevation=CardDefaults.cardElevation(defaultElevation=2.dp)
                    ) {
                        Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically){
                            Box(Modifier.size(52.dp).background(Color(0xFFE7EDF8),RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){
                                Icon(Icons.Default.Person,null,tint=customerBlue,modifier=Modifier.size(27.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)){
                                Text(name.ifBlank{"Customer"},fontSize=15.sp,fontWeight=FontWeight.Black,color=customerBlue)
                                Text(phone,color=Color.Gray,fontSize=11.sp)
                                if(isDue)Text("Outstanding "+entry.cr("current_balance"),color=if(due>0)Color(0xFFBC4D42) else customerTeal,fontWeight=FontWeight.Bold,fontSize=12.sp)
                                else Text("Store profile • Tap for full history",fontSize=10.sp,color=customerTeal)
                            }
                            Icon(Icons.Default.ChevronRight,null,tint=customerGold)
                        }
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                        OutlinedButton(enabled=offset>0&&!loading,onClick={reload((offset-40).coerceAtLeast(0))},modifier=Modifier.weight(1f)){Text("Previous")}
                        Button(enabled=!loading&&list.size==40&&(count==null||offset+40<count!!),onClick={reload(offset+40)},modifier=Modifier.weight(1f),colors=ButtonDefaults.buttonColors(containerColor=customerBlue)){Text("Next")}
                    }
                }
            }
        } else {
            val entry=customer!!
            val info=profile?.optJSONObject("customer")
            val displayed=info?:entry
            val name=displayed.ct("name").ifBlank{entry.ct("customer_name").ifBlank{entry.ct("full_name")}}
            val accounts=profile?.optJSONArray("credit_accounts")
            val bills=profile?.optJSONArray("bills")
            val ledger=profile?.optJSONArray("credit_ledger")
            val billing=profile?.optJSONArray("billing_app_accounts")
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=customerBlue),shape=RoundedCornerShape(19.dp)){
                        Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                            Icon(Icons.Default.AccountCircle,null,tint=customerGold,modifier=Modifier.size(39.dp))
                            Text(name.ifBlank{"Customer"},color=Color.White,fontWeight=FontWeight.Black,fontSize=22.sp)
                            Text("Phone: "+displayed.ct("phone").ifBlank{entry.ct("customer_phone")},color=Color.White.copy(alpha=.88f),fontSize=12.sp)
                            Text("Email: "+displayed.ct("email"),color=Color.White.copy(alpha=.78f),fontSize=11.sp)
                            Text("Address: "+displayed.ct("address"),color=Color.White.copy(alpha=.78f),fontSize=11.sp)
                        }
                    }
                }
                if(loading)item{LinearProgressIndicator(Modifier.fillMaxWidth())}
                if(error.isNotBlank())item{Text(error,color=Color(0xFFB74444))}
                if(profile!=null){
                    item{
                        Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                            ProfileKpi("TOTAL PURCHASES",profile!!.cr("total_purchases"),customerBlue,Modifier.weight(1f))
                            ProfileKpi("BILLS",profile!!.ct("bill_count"),customerTeal,Modifier.weight(1f))
                        }
                    }
                    item{
                        Text("OUTSTANDING DUES",fontSize=18.sp,fontWeight=FontWeight.Black,color=customerBlue)
                        Text("Website credit and Billing App balances are shown separately to avoid double-counting.",fontSize=11.sp,color=Color.Gray)
                    }
                    if(accounts!=null){
                        for(i in 0 until accounts.length()){
                            val ac=accounts.optJSONObject(i)?:continue
                            item(key="credit"+i){
                                Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(17.dp)){
                                    Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                                        Text("WEBSITE CREDIT ACCOUNT",fontWeight=FontWeight.Black,color=customerBlue,fontSize=12.sp)
                                        Text(ac.cr("current_balance"),color=if(ac.optDouble("current_balance")>0)Color(0xFFB95146) else customerTeal,fontWeight=FontWeight.Black,fontSize=24.sp)
                                        Text("Total credit "+ac.cr("total_credit_given")+" • Paid "+ac.cr("total_credit_paid"),color=Color.Gray,fontSize=11.sp)
                                        Text("Due date: "+ac.ct("next_due_date"),color=Color.Gray,fontSize=11.sp)
                                        Button(
                                            enabled=ac.optDouble("current_balance")>0.009&&!sending,
                                            onClick={confirmAccount=ac},
                                            modifier=Modifier.fillMaxWidth(),
                                            colors=ButtonDefaults.buttonColors(containerColor=customerTeal)
                                        ){
                                            Icon(Icons.Default.Message,null)
                                            Spacer(Modifier.width(7.dp))
                                            Text("SEND WHATSAPP DUE REMINDER")
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if(billing!=null){
                        for(i in 0 until billing.length()){
                            val x=billing.optJSONObject(i)?:continue
                            item(key="billing"+i){
                                Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(14.dp)){
                                    Column(Modifier.padding(14.dp)){
                                        Text("BILLING APP ACCOUNT",fontWeight=FontWeight.Black,color=customerBlue,fontSize=12.sp)
                                        Text("Outstanding "+x.cr("current_due"),fontSize=19.sp,color=Color(0xFFB95146),fontWeight=FontWeight.Black)
                                        Text("Credit "+x.cr("total_credit")+" • Paid "+x.cr("total_paid"),fontSize=11.sp,color=Color.Gray)
                                    }
                                }
                            }
                        }
                    }
                    if(sendStatus.isNotBlank())item{Text(sendStatus,color=customerTeal,fontSize=12.sp)}
                    item{Text("PURCHASE & BILL HISTORY",color=customerBlue,fontWeight=FontWeight.Black,fontSize=19.sp)}
                    if(bills!=null){
                        for(i in 0 until bills.length()){
                            val b=bills.optJSONObject(i)?:continue
                            item(key="bill"+i){
                                Card(
                                    modifier=Modifier.fillMaxWidth().clickable{currentBill=b.ct("id")},
                                    colors=CardDefaults.cardColors(containerColor=Color.White),
                                    shape=RoundedCornerShape(15.dp)
                                ){
                                    Row(Modifier.padding(13.dp),verticalAlignment=Alignment.CenterVertically){
                                        Icon(Icons.Default.ReceiptLong,null,tint=customerGold)
                                        Spacer(Modifier.width(10.dp))
                                        Column(Modifier.weight(1f)){
                                            Text(b.ct("invoice_number"),fontWeight=FontWeight.Black,color=customerBlue)
                                            Text(b.ct("created_at").replace("T"," ").take(16),fontSize=10.sp,color=Color.Gray)
                                            Text("Paid "+b.cr("paid_amount")+" • Due "+b.cr("due_amount"),fontSize=11.sp,color=customerTeal)
                                        }
                                        Text(b.cr("total_amount"),color=customerBlue,fontWeight=FontWeight.Black,fontSize=13.sp)
                                        Icon(Icons.Default.ChevronRight,null,tint=customerGold)
                                    }
                                }
                            }
                        }
                    }
                    item{Text("CREDIT TRANSACTION HISTORY",color=customerBlue,fontWeight=FontWeight.Black,fontSize=18.sp)}
                    if(ledger!=null){
                        for(i in 0 until ledger.length()){
                            val t=ledger.optJSONObject(i)?:continue
                            item(key="ledger"+i){
                                Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(13.dp)){
                                    Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically){
                                        Icon(Icons.Default.History,null,tint=customerTeal)
                                        Spacer(Modifier.width(11.dp))
                                        Column(Modifier.weight(1f)){
                                            Text(t.ct("transaction_type"),fontWeight=FontWeight.Bold,color=customerBlue)
                                            Text(t.ct("created_at").replace("T"," ").take(16),fontSize=10.sp,color=Color.Gray)
                                        }
                                        Text(t.cr("amount_change"),fontWeight=FontWeight.Black,color=customerBlue)
                                    }
                                }
                            }
                        }
                    }
                }else if(entry.optLong("customer_id")<=0){
                    item{Text("This due account is not yet linked to a customer profile. Its existing balance remains visible in the list; use the Website ledger to verify history.",fontSize=12.sp,color=Color.Gray)}
                }
            }
        }
    }
    val account=confirmAccount
    if(account!=null && session!=null){
        AlertDialog(
            onDismissRequest={if(!sending)confirmAccount=null},
            title={Text("Send payment reminder?")},
            text={
                Text("Send NEW CITY STYLE WhatsApp due reminder to "+
                    account.ct("customer_name")+" ("+account.ct("customer_phone")+") for "+
                    account.cr("current_balance")+"? This sends an actual message.")
            },
            confirmButton={
                TextButton(enabled=!sending,onClick={
                    sending=true;sendStatus=""
                    scope.launch {
                        try {
                            NcsCloud.dueReminder(session,account)
                            sendStatus="WhatsApp service confirmed the reminder was sent."
                        }catch(e:Exception){
                            sendStatus="Reminder failed: "+(e.message?:"Unknown error")
                        }finally{sending=false;confirmAccount=null}
                    }
                }){Text(if(sending)"Sending..." else "Send now")}
            },
            dismissButton={TextButton(enabled=!sending,onClick={confirmAccount=null}){Text("Cancel")}}
        )
    }
}
@Composable private fun ProfileKpi(label:String,value:String,tint:Color,modifier:Modifier){
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(15.dp)){
        Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
            Text(label,color=Color.Gray,fontSize=9.sp,fontWeight=FontWeight.Black)
            Text(value,color=tint,fontSize=18.sp,fontWeight=FontWeight.Black,maxLines=1)
        }
    }
}
