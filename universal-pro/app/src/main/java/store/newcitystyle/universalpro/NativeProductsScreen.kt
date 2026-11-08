package store.newcitystyle.universalpro

import android.content.Context
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
private fun nativeProductPhoto(p:JSONObject):String {
    val direct=listOf("image_url","image")
        .map{p.optString(it,"")}
        .firstOrNull{it.startsWith("https://") || it.startsWith("http://")}
    if(!direct.isNullOrBlank())return direct
    val photos=p.optJSONArray("images")
    for(i in 0 until (photos?.length()?:0)){
        val entry=photos?.optString(i,"")?:""
        if(entry.startsWith("https://")||entry.startsWith("http://"))return entry
    }
    return ""
}
@Composable
internal fun NativeProductsScreen(onBack:()->Unit){
    val context=LocalContext.current
    val prefs=remember{context.getSharedPreferences("ncs_native_products",Context.MODE_PRIVATE)}
    fun fromCache():List<JSONObject> = runCatching {
        val a=JSONArray(prefs.getString("last_catalogue","[]"))
        (0 until a.length()).map{a.getJSONObject(it)}
    }.getOrDefault(emptyList())
    var products by remember { mutableStateOf(fromCache()) }
    var selected by remember { mutableStateOf<JSONObject?>(null) }
    var name by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var productTab by remember { mutableStateOf("DETAILS") }
    var variants by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var variantStatus by remember { mutableStateOf("Select a product to load variants") }
    var busy by remember { mutableStateOf(false) }
    var loginEmail by remember { mutableStateOf("") }
    var loginPassword by remember { mutableStateOf("") }
    var loginError by remember { mutableStateOf("") }
    var loginBusy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Native catalogue • Offline cache available • Owner login required for saves") }
    val scope=rememberCoroutineScope()
    fun refresh(){
        busy=true
        scope.launch {
            try{
                val user=NcsCloud.restoreActiveSession()?:error("Owner account login required")
                val result=mutableListOf<JSONObject>()
                var offset=0
                while(true){
                    val page=NcsCloud.load(user,"products",offset,100)
                    result.addAll(page.items)
                    offset+=page.items.size
                    if(page.items.size<100||offset>=10000)break
                }
                withContext(Dispatchers.IO){
                    val array=JSONArray()
                    result.forEach{array.put(it)}
                    prefs.edit().putString("last_catalogue",array.toString()).apply()
                }
                products=result
                status="Live cloud products: "+result.size+" • Cached offline"
            }catch(e:Exception){
                products=fromCache()
                status="Offline cache • "+(e.message?:"Network not available")
            }finally{busy=false}
        }
    }
    LaunchedEffect(Unit){if(NcsCloud.activeSession!=null)refresh()}
    // Native sign-in: offline inventory remains visible from last cache.
    // This is deliberately a Compose screen, never a WebView.
    if(NcsCloud.activeSession==null) {
        Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB))
            .verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement=Arrangement.spacedBy(13.dp)){
            Text("NEW CITY STYLE",color=Color(0xFF0A2E73),fontWeight=FontWeight.Black)
            Text("OWNER BUSINESS LOGIN",fontWeight=FontWeight.Black,color=Color(0xFF0A2E73))
            Text("Sign in once to edit products and refresh real cloud records. Existing offline data is not deleted.",
                color=Color.Gray)
            OutlinedTextField(loginEmail,{loginEmail=it.trim()},label={Text("Owner email")},
                modifier=Modifier.fillMaxWidth(),singleLine=true)
            OutlinedTextField(loginPassword,{loginPassword=it},label={Text("Password")},
                modifier=Modifier.fillMaxWidth(),singleLine=true,
                visualTransformation=androidx.compose.ui.text.input.PasswordVisualTransformation())
            if(loginError.isNotBlank())Text(loginError,color=Color(0xFFAD3434))
            Button(onClick={
                loginBusy=true;loginError=""
                scope.launch {
                    try{
                        NcsCloud.signIn(loginEmail,loginPassword)
                        loginPassword=""
                        refresh()
                    }catch(e:Exception){loginError=e.message?:"Login failed"}
                    finally{loginBusy=false}
                }
            },enabled=loginEmail.isNotBlank()&&loginPassword.isNotBlank()&&!loginBusy,
                modifier=Modifier.fillMaxWidth()){
                Text(if(loginBusy)"VERIFYING..." else "SIGN IN SECURELY")
            }
            OutlinedButton(onClick=onBack,modifier=Modifier.fillMaxWidth()){Text("BACK TO WORKSPACE")}
            if(products.isNotEmpty()){
                Text("OFFLINE PRODUCT CACHE • "+products.size+" products",fontWeight=FontWeight.Bold)
                products.take(12).forEach{p->Text("• "+p.optString("name","Item"))}
            }
        }
        return
    }

    LaunchedEffect(selected?.optLong("id")){
        val productId=selected?.optLong("id")?:0
        if(productId<=0){variants=emptyList();return@LaunchedEffect}
        productTab="DETAILS"
        variantStatus="Loading sizes and colours..."
        try{
            val owner=NcsCloud.restoreActiveSession() ?: error("Owner login required")
            variants=NcsCloud.forProduct(owner,"product_variants",productId)
            variantStatus="Live variants: "+variants.size
        }catch(e:Exception){
            variants=emptyList()
            variantStatus="Variants unavailable: "+(e.message?:"Unknown")
        }
    }
    if(selected!=null) {
        val product=selected!!
        ModalBottomSheet(onDismissRequest={if(!busy)selected=null}) {
            Column(Modifier.fillMaxWidth().padding(horizontal=17.dp).heightIn(max=660.dp)){
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
                    verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                    Column(Modifier.weight(1f)){
                        Text(product.optString("name","Product"),
                            fontWeight=FontWeight.Black,color=Color(0xFF0A2E73))
                        Text("Product #"+product.optLong("id")+" • "+product.optString("category",""),
                            color=Color.Gray)
                    }
                    TextButton(enabled=!busy,onClick={selected=null}){Text("CLOSE")}
                }
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                    listOf("DETAILS","VARIANTS","EDIT").forEach{t->
                        FilterChip(selected=productTab==t,onClick={productTab=t},label={Text(t)})
                    }
                }
                when(productTab){
                    "DETAILS" -> Column(Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement=Arrangement.spacedBy(9.dp)){
                        Text("Brand: "+product.optString("brand","—"))
                        val photo=nativeProductPhoto(product)
                        if(photo.isNotBlank()){
                            AsyncImage(model=photo,contentDescription=product.optString("name"),
                                modifier=Modifier.fillMaxWidth().height(180.dp),
                                contentScale=ContentScale.Fit)
                        }
                        Text("Barcode: "+product.optString("barcode","—"))
                        Text("Price: ₹"+product.optString("price","—"))
                        Text("MRP: ₹"+product.optString("mrp","—"))
                        Text("Cloud stock (summary): "+product.optString("stock","—"))
                        Text("For size/colour stock, open VARIANTS. No stock changed here.",
                            color=Color.Gray)
                        Spacer(Modifier.height(30.dp))
                    }
                    "VARIANTS" -> Column {
                        Text(variantStatus,color=Color(0xFF0A2E73))
                        LazyColumn(Modifier.heightIn(max=460.dp),
                            verticalArrangement=Arrangement.spacedBy(7.dp)){
                            items(variants,key={it.optLong("id")}){v->
                                Card {Column(Modifier.fillMaxWidth().padding(12.dp)){
                                    Text(v.optString("size","Free")+" / "+v.optString("color",""),
                                        fontWeight=FontWeight.Bold)
                                    Text("Stock: "+v.optString("stock","—")+" • Sale ₹"+
                                        v.optString("selling_price","—")+" • MRP ₹"+
                                        v.optString("mrp","—"))
                                }}
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                    else -> Column(Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedTextField(value=name,onValueChange={name=it.take(150)},
                            label={Text("Product name")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                        OutlinedTextField(value=brand,onValueChange={brand=it.take(80)},
                            label={Text("Brand")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                        Text("Save changes to Cloud (owner only). No prices, stock, sales or dues affected.",
                            color=Color.Gray)
                        Button(enabled=!busy&&name.trim().length>=2,
                            onClick={
                                busy=true
                                scope.launch{
                                    try{
                                        val owner=NcsCloud.restoreActiveSession() ?: error("Owner session expired")
                                        val before=product.optString("brand").takeUnless{it=="null"||it.isBlank()}
                                        val result=NcsCloud.updateProductMetadata(
                                            owner,product.optLong("id"),product.optString("name"),
                                            before,name,brand.takeIf{it.isNotBlank()})
                                        if(!result.optBoolean("ok"))error("Cloud did not confirm save")
                                        status="Product saved. Refreshing catalogue."
                                        selected=null
                                        refresh()
                                    }catch(e:Exception){
                                        status="Save failed: "+(e.message?:"Unknown")
                                    }finally{busy=false}
                                }
                            },modifier=Modifier.fillMaxWidth()){
                            Text(if(busy)"SAVING..." else "SAVE TO CLOUD")
                        }
                        Spacer(Modifier.height(20.dp))
                    }
                }
            }
        }
    }
    Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB))){
        Row(Modifier.fillMaxWidth().background(Color(0xFF0A2E73)).padding(8.dp)){
            TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
            Column(Modifier.weight(1f)){
                Text("PRODUCT STUDIO",color=Color(0xFFD4AF37),fontWeight=FontWeight.Black)
                Text("Native catalogue • secure cloud metadata save",color=Color.White)
            }
            TextButton(onClick={refresh()},enabled=!busy){Text("Refresh",color=Color.White)}
        }
        if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(status,Modifier.padding(12.dp),color=Color(0xFF0A2E73))
        OutlinedTextField(query,{query=it},label={Text("Search product, barcode, brand")},
            modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp),singleLine=true)
        val rows=products.filter{query.isBlank()||it.optString("name").contains(query,true)
            ||it.optString("brand").contains(query,true)||it.optString("barcode").contains(query,true)}
        LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),
            verticalArrangement=Arrangement.spacedBy(8.dp)){
            items(rows.take(500),key={it.optLong("id")}){p->
                Card(onClick={
                    selected=p
                    name=p.optString("name","")
                    brand=p.optString("brand","").takeUnless{it=="null"}?:""
                }){
                    Row(Modifier.fillMaxWidth().padding(11.dp),verticalAlignment=Alignment.CenterVertically){
                        val photo=nativeProductPhoto(p)
                        if(photo.isNotBlank()){
                            AsyncImage(model=photo,contentDescription=p.optString("name"),
                                modifier=Modifier.size(63.dp).background(Color(0xFFF2F4F8),RoundedCornerShape(10.dp)),
                                contentScale=ContentScale.Crop)
                            Spacer(Modifier.width(12.dp))
                        }
                        Column(Modifier.weight(1f)){
                            Text(p.optString("name","Product"),fontWeight=FontWeight.Bold)
                            Text("Brand: "+p.optString("brand","—")+" • #"+p.optLong("id"),
                                color=Color.DarkGray)
                            Text("DETAILS • VARIANTS • EDIT",color=Color(0xFF0A2E73))
                        }
                    }
                }
            }
        }
    }
}
