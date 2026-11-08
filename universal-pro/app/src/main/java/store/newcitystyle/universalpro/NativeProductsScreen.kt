package store.newcitystyle.universalpro

import android.content.Context
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
    var busy by remember { mutableStateOf(false) }
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
    if(selected!=null) {
        val product=selected!!
        AlertDialog(
            onDismissRequest={if(!busy)selected=null},
            title={Text("EDIT PRODUCT • Native")},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(9.dp)){
                    Text("Product #"+product.optLong("id"))
                    OutlinedTextField(value=name,onValueChange={name=it.take(150)},
                        label={Text("Product name")},singleLine=true)
                    OutlinedTextField(value=brand,onValueChange={brand=it.take(80)},
                        label={Text("Brand")},singleLine=true)
                    Text("Only Name and Brand are edited. Prices, Stock, Sales and Dues remain unchanged.",
                        color=Color.Gray)
                }
            },
            confirmButton={
                TextButton(enabled=!busy&&name.trim().length>=2,onClick={
                    busy=true
                    scope.launch {
                        try {
                            val user=NcsCloud.restoreActiveSession()?:error("Owner session expired")
                            val before=product.optString("brand").takeUnless{it=="null"||it.isBlank()}
                            val result=NcsCloud.updateProductMetadata(
                                user,product.optLong("id"),product.optString("name"),
                                before,name,brand.takeIf{it.isNotBlank()}
                            )
                            if(!result.optBoolean("ok"))error("Cloud did not confirm save")
                            status="Product #"+product.optLong("id")+" saved on Cloud"
                            selected=null
                            refresh()
                        }catch(e:Exception){
                            status="Save not completed: "+(e.message?:"Unknown")
                        }finally{busy=false}
                    }
                }){Text(if(busy)"Saving..." else "SAVE TO CLOUD")}
            },
            dismissButton={TextButton(onClick={selected=null},enabled=!busy){Text("Cancel")}}
        )
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
                    Column(Modifier.fillMaxWidth().padding(13.dp)){
                        Text(p.optString("name","Product"),fontWeight=FontWeight.Bold)
                        Text("Brand: "+p.optString("brand","—")+" • #"+p.optLong("id"))
                        Text("Tap to edit Name / Brand",color=Color(0xFF0A2E73))
                    }
                }
            }
        }
    }
}
