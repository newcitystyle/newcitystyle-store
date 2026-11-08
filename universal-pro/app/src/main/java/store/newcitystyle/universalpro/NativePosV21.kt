package store.newcitystyle.universalpro

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

private data class NProduct(val id:Long,val variant:Long,val name:String,val size:String,val color:String,val price:Double,val stock:Int)
private data class NCart(val product:NProduct,val qty:Int,val quick:Boolean=false)
private data class NBill(val id:String,val invoice:String,val amount:Double,val method:String,val created:String)
private class NPosStore(ctx:Context):SQLiteOpenHelper(ctx,"ncs_native_pos_v21.sqlite",null,1){
 override fun onCreate(db:SQLiteDatabase){
  db.execSQL("CREATE TABLE catalog(variant INTEGER PRIMARY KEY,product INTEGER NOT NULL,name TEXT,size TEXT,color TEXT,price REAL,stock INTEGER)")
  db.execSQL("CREATE TABLE bills(id TEXT PRIMARY KEY,invoice TEXT,amount REAL,method TEXT,customer TEXT,phone TEXT,created TEXT,status TEXT)")
  db.execSQL("CREATE TABLE bill_items(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_id TEXT,product INTEGER,variant INTEGER,name TEXT,qty INTEGER,price REAL,quick INTEGER)")
  db.execSQL("CREATE TABLE sync_queue(id TEXT PRIMARY KEY,status TEXT,created TEXT)")
 }
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){}
 fun catalog():List<NProduct>{
  val a=mutableListOf<NProduct>()
  readableDatabase.rawQuery("SELECT product,variant,name,size,color,price,stock FROM catalog ORDER BY name",null).use { c ->
   while(c.moveToNext())a.add(NProduct(c.getLong(0),c.getLong(1),c.getString(2)?:"",c.getString(3)?:"",c.getString(4)?:"",c.getDouble(5),c.getInt(6)))
  }
  return a
 }
 fun cache(rows:List<NProduct>){
  val db=writableDatabase
  db.beginTransaction()
  try{
   for(p in rows)db.execSQL("INSERT INTO catalog(variant,product,name,size,color,price,stock) VALUES(?,?,?,?,?,?,?) ON CONFLICT(variant) DO UPDATE SET name=excluded.name,size=excluded.size,color=excluded.color,price=excluded.price,stock=excluded.stock",
     arrayOf(p.variant,p.id,p.name,p.size,p.color,p.price,p.stock))
   db.setTransactionSuccessful()
  }finally{db.endTransaction()}
 }
 private fun reservations(db:SQLiteDatabase,variant:Long):Int {
  return db.rawQuery("SELECT coalesce(sum(i.qty),0) FROM bill_items i JOIN bills b ON b.id=i.bill_id WHERE i.variant=? AND b.status='PENDING'",arrayOf(variant.toString())).use { c->c.moveToFirst();c.getInt(0)}
 }
 fun available(p:NProduct):Int=(p.stock-reservations(readableDatabase,p.variant)).coerceAtLeast(0)
 fun save(cart:List<NCart>,customer:String,phone:String,payment:String,discount:Double):NBill{
  require(cart.isNotEmpty()){"Empty bill"}
  require(payment in listOf("CASH","UPI","CREDIT")){"Payment method required"}
  require(discount.isFinite()&&discount>=0){"Invalid discount"}
  val gross=cart.sumOf{it.qty*it.product.price}
  val total=(kotlin.math.round((gross-discount)*100.0)/100.0)
  require(total>0&&total.isFinite()){"Invalid bill amount"}
  val tx="NCS-ANDROID-"+UUID.randomUUID().toString()
  val invoice="NCSA-"+System.currentTimeMillis().toString()
  val now=Instant.now().toString()
  val db=writableDatabase
  db.beginTransaction()
  try{
   for(line in cart.filter{!it.quick}){
    require(line.qty>0&&line.qty<=line.product.stock-reservations(db,line.product.variant)){"Stock insufficient for "+line.product.name}
   }
   db.execSQL("INSERT INTO bills VALUES(?,?,?,?,?,?,?,?)",arrayOf(tx,invoice,total,payment,customer,phone,now,"PENDING"))
   for(line in cart){
    db.execSQL("INSERT INTO bill_items(bill_id,product,variant,name,qty,price,quick) VALUES(?,?,?,?,?,?,?)",arrayOf(tx,if(line.quick)null else line.product.id,if(line.quick)null else line.product.variant,line.product.name,line.qty,line.product.price,if(line.quick)1 else 0))
   }
   db.execSQL("INSERT INTO sync_queue VALUES(?,?,?)",arrayOf(tx,"PENDING",now))
   db.setTransactionSuccessful()
  }finally{db.endTransaction()}
  return NBill(tx,invoice,total,payment,now)
 }
 fun history():List<NBill>{
  val out=mutableListOf<NBill>()
  readableDatabase.rawQuery("SELECT id,invoice,amount,method,created FROM bills ORDER BY created DESC LIMIT 100",null).use{c->
   while(c.moveToNext())out.add(NBill(c.getString(0),c.getString(1),c.getDouble(2),c.getString(3),c.getString(4)))
  }
  return out
 }
}
@Composable
internal fun NativePosV21(onBack:()->Unit){
 val context=LocalContext.current
 val store=remember{NPosStore(context.applicationContext)}
 val scope=rememberCoroutineScope()
 var catalogue by remember{mutableStateOf(store.catalog())}
 var history by remember{mutableStateOf(store.history())}
 var notice by remember{mutableStateOf("Native Android POS. Offline bills save to phone. Cloud accounting sync pending.")}
 var loading by remember{mutableStateOf(false)}
 var tab by remember{mutableStateOf("CATALOG")}
 var query by remember{mutableStateOf("")}
 var customer by remember{mutableStateOf("Walk-in Customer")}
 var phone by remember{mutableStateOf("")}
 var discount by remember{mutableStateOf("0")}
 var payment by remember{mutableStateOf("CASH")}
 var quickName by remember{mutableStateOf("")}
 var quickPrice by remember{mutableStateOf("")}
 val cart=remember{mutableStateMapOf<String,NCart>()}
 suspend fun refresh(){
  loading=true
  try{
   val session=NcsCloud.restoreActiveSession()?:throw IllegalStateException("Owner cloud login required")
   val productNames=mutableMapOf<Long,String>()
   var start=0
   while(true){
    val page=NcsCloud.load(session,"products",start,100)
    for(p in page.items)productNames[p.optLong("id")]=p.optString("name","Product")
    start+=page.items.size
    if(page.items.size<100||start>=10000)break
   }
   start=0
   val variants=mutableListOf<NProduct>()
   while(true){
    val page=NcsCloud.load(session,"product_variants",start,100)
    for(v in page.items){
     val productId=v.optLong("product_id")
     val id=v.optLong("id")
     val price=v.optDouble("selling_price",0.0)
     if(id>0&&productNames.containsKey(productId)&&price>0&&v.optBoolean("is_active",true)){
      variants.add(NProduct(productId,id,productNames[productId]?:"Product",v.optString("size",""),v.optString("color",""),price,v.optInt("stock",0)))
     }
    }
    start+=page.items.size
    if(page.items.size<100||start>=10000)break
   }
   withContext(Dispatchers.IO){store.cache(variants)}
   catalogue=store.catalog()
   notice="Catalog saved offline: "+catalogue.size+" variants"
  }catch(e:Exception){notice="Cloud refresh failed: "+(e.message?:"unknown")}
  finally{loading=false}
 }
 LaunchedEffect(Unit){if(catalogue.isEmpty()&&NcsCloud.activeSession!=null)refresh()}
 val total=cart.values.sumOf{it.qty*it.product.price}-(discount.toDoubleOrNull()?:0.0)
 Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB))){
  Row(Modifier.fillMaxWidth().background(Color(0xFF0A2E73)).padding(8.dp)){
   TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
   Column(Modifier.weight(1f)){Text("NATIVE POS",color=Color(0xFFD4AF37),fontWeight=FontWeight.Black);Text("Offline SQLite • Real local save",color=Color.White)}
   TextButton(onClick={scope.launch{refresh()}},enabled=!loading){Text("Refresh",color=Color.White)}
  }
  if(loading)LinearProgressIndicator(Modifier.fillMaxWidth())
  Text(notice,Modifier.padding(10.dp),color=Color(0xFF0A2E73))
  Row(Modifier.padding(9.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
   listOf("CATALOG","CART","HISTORY").forEach{t->FilterChip(selected=tab==t,onClick={tab=t},label={Text(t)})}
  }
  when(tab){
   "CATALOG"->{
    OutlinedTextField(query,{query=it},label={Text("Search product, size or colour")},modifier=Modifier.fillMaxWidth().padding(horizontal=10.dp))
    LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(10.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
     items(catalogue.filter{query.isBlank()||it.name.contains(query,true)||it.size.contains(query,true)||it.color.contains(query,true)}.take(150),key={it.variant}){p->
      val key=p.variant.toString()
      val q=cart[key]?.qty?:0
      val available=store.available(p)
      Card{Row(Modifier.fillMaxWidth().padding(10.dp)){
       Column(Modifier.weight(1f)){
        Text(p.name,fontWeight=FontWeight.Bold)
        Text(p.size+" / "+p.color+" • ₹"+p.price+" • Available "+available)
       }
       TextButton(onClick={if(q<=1)cart.remove(key) else cart[key]=NCart(p,q-1)},enabled=q>0){Text("−")}
       Text(q.toString(),Modifier.padding(top=13.dp))
       TextButton(onClick={if(q<available)cart[key]=NCart(p,q+1)},enabled=q<available){Text("+")}
      }}
     }
    }
   }
   "CART"->{
    LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     item{OutlinedTextField(customer,{customer=it},label={Text("Customer name")},modifier=Modifier.fillMaxWidth())}
     item{OutlinedTextField(phone,{phone=it.filter(Char::isDigit).take(15)},label={Text("Phone (optional)")},modifier=Modifier.fillMaxWidth())}
     item{OutlinedTextField(discount,{discount=it.filter{ch->ch.isDigit()||ch=='.'}},label={Text("Discount ₹")},modifier=Modifier.fillMaxWidth())}
     item{Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){listOf("CASH","UPI","CREDIT").forEach{p->FilterChip(selected=payment==p,onClick={payment=p},label={Text(p)})}}}
     item{Text("Quick Item",fontWeight=FontWeight.Bold)}
     item{OutlinedTextField(quickName,{quickName=it},label={Text("Quick item name")},modifier=Modifier.fillMaxWidth())}
     item{OutlinedTextField(quickPrice,{quickPrice=it.filter{ch->ch.isDigit()||ch=='.'}},label={Text("Selling price ₹")},modifier=Modifier.fillMaxWidth())}
     item{OutlinedButton(onClick={
       val price=quickPrice.toDoubleOrNull()
       if(quickName.isNotBlank()&&price!=null&&price>0){
        val id="quick-"+UUID.randomUUID()
        cart[id]=NCart(NProduct(0,-1,quickName,"","",price,0),1,true)
        quickName="";quickPrice=""
       }
      }){Text("Add Quick Item")}}
     items(cart.entries.toList(),key={it.key}){entry->
      Card{Row(Modifier.fillMaxWidth().padding(10.dp)){
       Column(Modifier.weight(1f)){Text(entry.value.product.name);Text("Qty "+entry.value.qty+" × ₹"+entry.value.product.price)}
       TextButton(onClick={cart.remove(entry.key)}){Text("Remove")}
      }}
     }
     item{Text("TOTAL ₹"+String.format(Locale.US,"%.2f",total.coerceAtLeast(0.0)),fontWeight=FontWeight.Black)}
     item{
      Button(onClick={
       try{
        val bill=store.save(cart.values.toList(),customer,phone,payment,discount.toDoubleOrNull()?:0.0)
        cart.clear();history=store.history();tab="HISTORY"
        notice="Saved LOCAL bill "+bill.invoice+"; financial cloud sync not yet enabled"
       }catch(e:Exception){notice="Bill save error: "+(e.message?:"unknown")}
      },enabled=cart.isNotEmpty()&&total>0,modifier=Modifier.fillMaxWidth()){Text("SAVE OFFLINE BILL")}
     }
    }
   }
   else->{
    LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     item{Text("Saved local bills — never mock records",fontWeight=FontWeight.Bold)}
     items(history,key={it.id}){b->Card{Column(Modifier.fillMaxWidth().padding(12.dp)){
      Text(b.invoice,fontWeight=FontWeight.Bold);Text("₹"+b.amount+" • "+b.method+" • CLOUD PENDING")
      Text(b.created)
     }}}
    }
   }
  }
  Surface(color=Color.White,shadowElevation=4.dp){
   Row(Modifier.fillMaxWidth().padding(12.dp)){
    Text("Items "+cart.values.sumOf{it.qty}+" • ₹"+String.format(Locale.US,"%.2f",total.coerceAtLeast(0.0)),Modifier.weight(1f),fontWeight=FontWeight.Bold)
    TextButton(onClick={tab=if(tab=="CART")"CATALOG" else "CART"}){Text(if(tab=="CART")"Products" else "Review")}
   }
  }
 }
}