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
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun NativeInventoryScreen(onBack:()->Unit) {
    val context=LocalContext.current
    val db=remember { NPosStore(context.applicationContext) }
    val scope=rememberCoroutineScope()
    var records by remember { mutableStateOf(db.catalog()) }
    var query by remember { mutableStateOf("") }
    var lowOnly by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Local catalogue • Stock from last cloud refresh") }
    suspend fun refreshStock() {
        busy=true
        try {
            val owner=NcsCloud.restoreActiveSession() ?: error("Owner sign-in required")
            val labels=mutableMapOf<Long,String>()
            var offset=0
            while (true) {
                val page=NcsCloud.load(owner,"products",offset,100)
                page.items.forEach { labels[it.optLong("id")]=it.optString("name","Product") }
                offset += page.items.size
                if (page.items.size<100 || offset>=10000) break
            }
            val fresh=mutableListOf<NProduct>()
            offset=0
            while(true) {
                val page=NcsCloud.load(owner,"product_variants",offset,100)
                page.items.forEach { v ->
                    val productId=v.optLong("product_id")
                    val id=v.optLong("id")
                    val label=labels[productId]
                    val price=v.optDouble("selling_price",0.0)
                    if (label!=null && id>0 && price>0 && v.optBoolean("is_active",true)) {
                        fresh.add(NProduct(productId,id,label,
                            v.optString("size",""),v.optString("color",""),
                            price,v.optInt("stock",0)))
                    }
                }
                offset+=page.items.size
                if(page.items.size<100 || offset>=10000)break
            }
            withContext(Dispatchers.IO){db.cache(fresh)}
            records=db.catalog()
            status="Cloud catalogue refreshed • "+records.size+" variants cached"
        }catch(e:Exception){
            records=db.catalog()
            status="Offline inventory • Refresh issue: "+(e.message?:"Unknown")
        }finally{busy=false}
    }
    LaunchedEffect(Unit) { if(records.isEmpty() && NcsCloud.activeSession!=null) refreshStock() }
    val visible=records.filter {
        (!lowOnly || db.available(it)<=3) &&
        (query.isBlank() || it.name.contains(query,true) ||
            it.size.contains(query,true) || it.color.contains(query,true) ||
            it.variant.toString().contains(query))
    }
    Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB))) {
        Row(Modifier.fillMaxWidth().background(Color(0xFF0A2E73)).padding(10.dp)) {
            TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
            Column(Modifier.weight(1f)) {
                Text("INVENTORY RADAR",fontWeight=FontWeight.Black,color=Color(0xFFD4AF37))
                Text("Native • offline-aware stock",color=Color.White)
            }
            TextButton(onClick={scope.launch{refreshStock()}},enabled=!busy) {
                Text("Refresh",color=Color.White)
            }
        }
        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(status,Modifier.padding(12.dp),color=Color(0xFF0A2E73))
        Row(Modifier.fillMaxWidth().padding(horizontal=12.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Card(Modifier.weight(1f)){Column(Modifier.padding(12.dp)){Text("VARIANTS");Text(records.size.toString(),fontWeight=FontWeight.Black)}}
            Card(Modifier.weight(1f)){Column(Modifier.padding(12.dp)){Text("LOW STOCK");Text(records.count{db.available(it)<=3}.toString(),fontWeight=FontWeight.Black)}}
        }
        OutlinedTextField(query,{query=it},label={Text("Search product, size or color")},
            modifier=Modifier.fillMaxWidth().padding(12.dp),singleLine=true)
        Row(Modifier.padding(horizontal=12.dp)) {
            FilterChip(selected=lowOnly,onClick={lowOnly=!lowOnly},label={Text("Low stock only")})
            Spacer(Modifier.width(8.dp))
            Text("Stock is not edited here",modifier=Modifier.padding(top=13.dp),color=Color.Gray)
        }
        LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            items(visible.take(350),key={it.variant}) { p ->
                val available=db.available(p)
                Card {
                    Column(Modifier.fillMaxWidth().padding(13.dp)) {
                        Text(p.name,fontWeight=FontWeight.Bold)
                        Text("Variant #"+p.variant+" • "+p.size+" / "+p.color,color=Color.DarkGray)
                        Text("₹"+p.price+" • Available: "+available,
                            color=if(available<=3)Color(0xFFA83B31) else Color(0xFF08765D),
                            fontWeight=FontWeight.Bold)
                    }
                }
            }
        }
        Text("Cached cloud stock minus pending local POS bills. No stock writes.",
            modifier=Modifier.padding(12.dp),color=Color.Gray)
    }
}
