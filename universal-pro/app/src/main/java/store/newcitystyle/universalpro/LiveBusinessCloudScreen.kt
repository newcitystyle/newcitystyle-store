package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale

private val cloudBlue=Color(0xFF0A2E73)
private val cloudGold=Color(0xFFD4AF37)
private val cloudInk=Color(0xFF10284D)
private val cloudPaper=Color(0xFFF8F4EC)
private val cloudLabels=listOf(
    "Products" to "products",
    "Variants" to "product_variants",
    "Sales" to "pos_sales",
    "Sale Items" to "pos_sale_items",
    "Payments" to "pos_payments",
    "Purchases" to "purchases",
    "Purchase Items" to "purchase_items",
    "Customers" to "customers",
    "Suppliers" to "suppliers",
    "Supplier Payments" to "supplier_payments",
    "Expenses" to "expenses",
    "Cash / UPI" to "cash_bank_transactions"
)
@Composable
fun LiveBusinessCloudScreen(onBack:()->Unit, initialTable:String="products") {
    val scope=rememberCoroutineScope()
    var email by remember {mutableStateOf("")}
    var password by remember {mutableStateOf("")}
    var session by remember {mutableStateOf(NcsCloud.activeSession)}
    var busy by remember {mutableStateOf(false)}
    var error by remember {mutableStateOf<String?>(null)}
    var selected by remember(initialTable) {mutableStateOf(initialTable)}
    var records by remember {mutableStateOf<List<JSONObject>>(emptyList())}
    var count by remember {mutableStateOf<Int?>(null)}
    var offset by remember {mutableIntStateOf(0)}
    var keyword by remember {mutableStateOf("")}
    var loadedAt by remember {mutableStateOf("")}
    fun reload(table:String,start:Int) {
        val auth=session?:return
        selected=table;offset=start;busy=true;error=null
        scope.launch {
            try {
                val page=NcsCloud.load(auth,table,start,40)
                records=page.items;count=page.count;loadedAt=java.text.SimpleDateFormat("dd MMM, hh:mm a",java.util.Locale.ENGLISH).format(java.util.Date())
            }catch(e:Exception){error=e.message?:"Cloud request failed";records=emptyList()}
            finally{busy=false}
        }
    }
    LaunchedEffect(initialTable, session) {
        val current=session
        if(current!=null){
            selected=initialTable;offset=0;busy=true;error=null
            try { val page=NcsCloud.load(current,initialTable,0,40);records=page.items;count=page.count }
            catch(e:Exception){error=e.message?:"Cloud data request failed";records=emptyList()}
            finally{busy=false}
        }
    }
    Column(Modifier.fillMaxSize().background(cloudPaper)) {
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(cloudBlue,Color(0xFF143F92),Color(0xFF355DAB))))
                .padding(horizontal=13.dp,vertical=15.dp),verticalAlignment=Alignment.CenterVertically
        ) {
            IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)}
            Column(Modifier.weight(1f)) {
                Text("NEW CITY STYLE",fontSize=10.sp,color=cloudGold,fontWeight=FontWeight.Black,letterSpacing=1.sp)
                Text("LIVE BUSINESS CLOUD",fontSize=21.sp,color=Color.White,fontWeight=FontWeight.Black)
            }
            Icon(Icons.Default.CloudDone,null,tint=cloudGold,modifier=Modifier.size(30.dp))
        }
        if(session==null) {
            LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(18.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                item {
                    Text("Owner Sign In",fontSize=25.sp,color=cloudInk,fontWeight=FontWeight.Black)
                    Text("Use the NEW CITY STYLE Supabase account. Your password stays in memory only during sign-in.",color=Color.Gray,fontSize=12.sp)
                }
                item {
                    OutlinedTextField(email,{email=it},label={Text("Account email")},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        leadingIcon={Icon(Icons.Default.Email,null)},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email))
                }
                item {
                    OutlinedTextField(password,{password=it},label={Text("Password")},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        leadingIcon={Icon(Icons.Default.Lock,null)},visualTransformation=PasswordVisualTransformation())
                }
                item {
                    Button(
                        enabled=email.isNotBlank()&&password.isNotBlank()&&!busy,modifier=Modifier.fillMaxWidth(),
                        colors=ButtonDefaults.buttonColors(containerColor=cloudBlue),
                        onClick={
                            busy=true;error=null
                            scope.launch{
                                try {
                                    session=NcsCloud.signIn(email.trim(),password)
                                    password=""
                                    selected=initialTable
                                }catch(e:Exception){error=e.message?:"Login failed"}
                                finally{busy=false}
                            }
                        }
                    ) { Icon(Icons.Default.Login,null);Spacer(Modifier.width(8.dp));Text("SIGN IN & LOAD LIVE DATA") }
                }
                item { Text("This connection displays live cloud records only. Billing, purchases and payment writes are not enabled in this version.",color=Color.Gray,fontSize=12.sp) }
                if(error!=null)item { Text(error!!,color=Color(0xFFB8323D)) }
                if(busy)item { LinearProgressIndicator(modifier=Modifier.fillMaxWidth()) }
            }
        } else {
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){
                item {
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Column(Modifier.weight(1f)){
                            Text("Connected account",color=Color.Gray,fontSize=11.sp)
                            Text(session!!.email,color=cloudInk,fontWeight=FontWeight.Bold,fontSize=12.sp)
                        }
                        OutlinedButton(onClick={session=null;NcsCloud.activeSession=null;records=emptyList();password="";error=null}){Text("Sign out")}
                    }
                }
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=cloudBlue),shape=RoundedCornerShape(17.dp)){
                        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                            Row(verticalAlignment=Alignment.CenterVertically){
                                Icon(Icons.Default.Bolt,null,tint=cloudGold,modifier=Modifier.size(21.dp))
                                Spacer(Modifier.width(7.dp))
                                Text("LIVE BUSINESS DATA",color=Color.White,fontWeight=FontWeight.Black,fontSize=14.sp)
                            }
                            Text("Real cloud records • newest first • pull on demand",color=Color.White.copy(alpha=.75f),fontSize=11.sp)
                            Text("Updated "+loadedAt.ifBlank{"—"}+"  •  Finance writes: disabled",color=cloudGold,fontSize=10.sp,fontWeight=FontWeight.Bold)
                        }
                    }
                }
                item {
                    Text("EXPLORE ALL MODULES",color=cloudBlue,fontSize=10.sp,fontWeight=FontWeight.Black)
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                        cloudLabels.forEach { (label,table)->
                            FilterChip(selected=selected==table,onClick={keyword="";reload(table,0)},label={Text(label,fontSize=11.sp)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=cloudGold,selectedLabelColor=cloudBlue))
                        }
                    }
                }
                item {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)){
                            Text(cloudLabels.firstOrNull{it.second==selected}?.first?:"Cloud Data",color=cloudBlue,fontWeight=FontWeight.Black,fontSize=22.sp)
                            Text((count?.toString()?:"—")+" records • page "+(offset/40+1)+" • newest first",color=Color.Gray,fontSize=11.sp)
                        }
                        IconButton(onClick={reload(selected,offset)}){Icon(Icons.Default.Refresh,null,tint=cloudBlue)}
                    }
                }
                item {
                    OutlinedTextField(keyword,{keyword=it},label={Text("Filter these 40 records")},singleLine=true,modifier=Modifier.fillMaxWidth(),
                        leadingIcon={Icon(Icons.Default.Search,null)})
                }
                if(busy)item{LinearProgressIndicator(modifier=Modifier.fillMaxWidth())}
                if(error!=null)item{Text(error!!,color=Color(0xFFB8323D),fontSize=12.sp)}
                items(records.filter{keyword.isBlank()||it.toString().contains(keyword,true)}){entry->
                    val main=when(selected) {
                        "products"->entry.optString("name","Product")
                        "product_variants"->"Barcode "+entry.optString("barcode")
                        "pos_sales"->"Bill "+entry.optString("invoice_number")
                        "purchases"->"Purchase "+entry.optString("purchase_number")
                        "customers"->entry.optString("full_name")
                        "suppliers"->entry.optString("supplier_name")
                        else->entry.optString("id")
                    }
                    val show=when(selected){
                        "products"->"₹"+entry.optString("price")+"  | MRP ₹"+entry.optString("mrp")+"  | Stock "+entry.optString("stock")
                        "pos_sales"->"Total ₹"+entry.optString("total_amount")+"  | Due ₹"+entry.optString("due_amount")
                        "purchases"->"Supplier "+entry.optString("supplier_name")+"  | ₹"+entry.optString("total_amount")
                        "customers"->"Orders "+entry.optString("total_orders")+"  | Total spent ₹"+entry.optString("total_spent")
                        "product_variants"->"Stock "+entry.optString("stock")+"  | "+entry.optString("size")+"  | "+entry.optString("color")
                        else->entry.optString("amount",entry.optString("phone",entry.optString("quantity","ID: "+entry.optString("id"))))
                    }
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(15.dp)){
                        Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                            if(selected=="products" && entry.optString("image").startsWith("https://")) {
                                AsyncImage(model=entry.optString("image"),contentDescription=main,modifier=Modifier.size(64.dp).background(cloudPaper,RoundedCornerShape(10.dp)),contentScale=ContentScale.Crop)
                            }else{
                                Box(Modifier.size(43.dp).background(cloudPaper,RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center){
                                    Icon(Icons.Default.Inventory2,null,tint=cloudBlue)
                                }
                            }
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)){
                                Text(main,color=cloudInk,fontWeight=FontWeight.Bold,fontSize=13.sp,maxLines=2)
                                Text(show,color=cloudBlue,fontSize=11.sp,maxLines=3)
                                Text(entry.optString("id"),color=Color.Gray,fontSize=9.sp)
                            }
                        }
                    }
                }
                item{
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedButton(enabled=offset>0&&!busy,onClick={reload(selected,(offset-40).coerceAtLeast(0))},modifier=Modifier.weight(1f)){Text("Previous")}
                        Button(enabled=!busy&&records.size==40&&(count==null||offset+40<count!!),onClick={reload(selected,offset+40)},modifier=Modifier.weight(1f),colors=ButtonDefaults.buttonColors(containerColor=cloudBlue)){Text("Next")}
                    }
                }
            }
        }
    }
}
