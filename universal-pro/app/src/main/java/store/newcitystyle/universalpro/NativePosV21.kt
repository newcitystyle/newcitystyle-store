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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.Locale

internal data class NProduct(val id:Long,val variant:Long,val name:String,val size:String,val color:String,val price:Double,val stock:Int,val barcode:String="")
internal data class NCart(val product:NProduct,val qty:Int,val quick:Boolean=false)
internal data class NBill(val id:String,val invoice:String,val amount:Double,val method:String,val created:String)
internal class NPosStore(ctx:Context):SQLiteOpenHelper(ctx,"ncs_native_pos_v21.sqlite",null,2){
 override fun onCreate(db:SQLiteDatabase){
  db.execSQL("CREATE TABLE catalog(variant INTEGER PRIMARY KEY,product INTEGER NOT NULL,name TEXT,size TEXT,color TEXT,price REAL,stock INTEGER,barcode TEXT)")
  db.execSQL("CREATE TABLE bills(id TEXT PRIMARY KEY,invoice TEXT,amount REAL,method TEXT,customer TEXT,phone TEXT,created TEXT,status TEXT)")
  db.execSQL("CREATE TABLE bill_items(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_id TEXT,product INTEGER,variant INTEGER,name TEXT,qty INTEGER,price REAL,quick INTEGER)")
  db.execSQL("CREATE TABLE sync_queue(id TEXT PRIMARY KEY,status TEXT,created TEXT)")
 }
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int){
  if(oldVersion<2)db.execSQL("ALTER TABLE catalog ADD COLUMN barcode TEXT")
 }
 fun catalog():List<NProduct>{
  val a=mutableListOf<NProduct>()
  readableDatabase.rawQuery("SELECT product,variant,name,size,color,price,stock,barcode FROM catalog ORDER BY name",null).use { c ->
   while(c.moveToNext())a.add(NProduct(c.getLong(0),c.getLong(1),c.getString(2)?:"",c.getString(3)?:"",c.getString(4)?:"",c.getDouble(5),c.getInt(6),c.getString(7)?:""))
  }
  return a
 }
 fun cache(rows:List<NProduct>){
  val db=writableDatabase
  db.beginTransaction()
  try{
   for(p in rows)db.execSQL("INSERT INTO catalog(variant,product,name,size,color,price,stock,barcode) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(variant) DO UPDATE SET name=excluded.name,size=excluded.size,color=excluded.color,price=excluded.price,stock=excluded.stock,barcode=excluded.barcode",
     arrayOf(p.variant,p.id,p.name,p.size,p.color,p.price,p.stock,p.barcode))
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
 fun pendingInboxPayloads():List<JSONObject>{
  val db=readableDatabase
  val out=mutableListOf<JSONObject>()
  db.rawQuery("SELECT b.id,b.invoice,b.amount,b.method,b.created FROM bills b JOIN sync_queue q ON q.id=b.id WHERE q.status='PENDING' ORDER BY b.created LIMIT 100",null).use{bills->
   while(bills.moveToNext()){
    val tx=bills.getString(0)
    val total=bills.getDouble(2)
    val method=bills.getString(3).lowercase(Locale.ROOT)
    val paid=if(method=="credit")0.0 else total
    val due=total-paid
    val items=org.json.JSONArray()
    var quick=false
    var original=0.0
    db.rawQuery("SELECT product,variant,name,qty,price,quick FROM bill_items WHERE bill_id=?",arrayOf(tx)).use{c->
     while(c.moveToNext()){
      val isQuick=c.getInt(5)==1
      quick=quick||isQuick
      val unit=c.getDouble(4)
      val qty=c.getInt(3)
      original+=unit*qty
      items.put(JSONObject()
       .put("productId",if(c.isNull(0))0 else c.getLong(0))
       .put("variantId",if(c.isNull(1))JSONObject.NULL else c.getLong(1))
       .put("quantity",qty).put("unitPrice",unit).put("mrp",unit)
       .put("taxPercent",0).put("quickItem",isQuick)
       .put("offlinePhysicalPiece",false))
     }
    }
    if(items.length()==0)continue
    val discount=kotlin.math.round((original-total)*100.0)/100.0
    if(discount < -0.02)continue
    out+=JSONObject().put("client_transaction_id",tx)
     .put("offline_invoice_number",bills.getString(1))
     .put("original_created_at",bills.getString(4))
     .put("payment_method",method)
     .put("total_amount",total).put("paid_amount",paid).put("due_amount",due)
     .put("bill_discount",discount.coerceAtLeast(0.0))
     .put("reward_discount",0).put("round_off",0)
     .put("items",items).put("requires_quick_item_handling",quick)
     .put("source","ANDROID_NATIVE_POS")
   }
  }
  return out
 }
 fun inboxPendingCount():Int=readableDatabase.rawQuery(
  "SELECT count(*) FROM sync_queue WHERE status='PENDING'",null
 ).use{c->c.moveToFirst();c.getInt(0)}
 fun markInboxConfirmed(tx:String){
  val db=writableDatabase
  db.execSQL("UPDATE sync_queue SET status='INBOX_UPLOADED' WHERE id=? AND status='PENDING'",arrayOf(tx))
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
 var sendingInbox by remember { mutableStateOf(false) }
 var pendingInbox by remember { mutableIntStateOf(store.inboxPendingCount()) }
 fun uploadPendingInbox(){
  if(sendingInbox)return
  sendingInbox=true
  scope.launch{
   var success=0
   try{
    val session=NcsCloud.restoreActiveSession()?:error("Owner login required")
    val pending=withContext(Dispatchers.IO){store.pendingInboxPayloads()}
    for(bill in pending){
     NcsCloud.postNativeOfflineBillToInbox(session,bill)
     withContext(Dispatchers.IO){store.markInboxConfirmed(bill.getString("client_transaction_id"))}
     success++
    }
    notice="Uploaded and verified "+success+" bills to CLOUD INBOX only. Financial accounting still pending."
   }catch(e:Exception){
    notice="Cloud inbox upload stopped after "+success+" confirmed: "+(e.message?:"Unknown")
   }finally{
    pendingInbox=store.inboxPendingCount()
    sendingInbox=false
   }
  }
 }

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
      variants.add(NProduct(productId,id,productNames[productId]?:"Product",v.optString("size",""),v.optString("color",""),price,v.optInt("stock",0),v.optString("barcode","")))
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
    OutlinedTextField(query,{query=it},label={Text("Scan barcode or search products")},
     modifier=Modifier.fillMaxWidth().padding(horizontal=10.dp),singleLine=true,
     keyboardOptions=KeyboardOptions(imeAction=ImeAction.Done),
     keyboardActions=KeyboardActions(onDone={
      val matches=catalogue.filter{it.barcode.isNotBlank()&&it.barcode.trim().equals(query.trim(),ignoreCase=true)}
      if(matches.size==1){
       val p=matches[0]
       val key=p.variant.toString()
       val old=cart[key]?.qty?:0
       if(old<store.available(p)){
        cart[key]=NCart(p,old+1)
        notice="Added "+p.name+" • "+p.size+"/"+p.color
        query=""
       }else notice="Out of available local stock: "+p.name
      }else if(matches.size>1){
       notice="Barcode matches multiple variants. Choose the correct size / colour."
      }
     }))
    LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(10.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
     items(catalogue.filter{query.isBlank()||it.name.contains(query,true)||it.size.contains(query,true)||it.color.contains(query,true)||it.barcode.contains(query,true)}.take(150),key={it.variant}){p->
      val key=p.variant.toString()
      val q=cart[key]?.qty?:0
      val available=store.available(p)
      Card{Row(Modifier.fillMaxWidth().padding(10.dp)){
       Column(Modifier.weight(1f)){
        Text(p.name,fontWeight=FontWeight.Bold)
        Text(p.size+" / "+p.color+" • ₹"+p.price+" • Available "+available)
        if(p.barcode.isNotBlank())Text("Barcode: "+p.barcode,color=Color.Gray)
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
        cart.clear();history=store.history();pendingInbox=store.inboxPendingCount();tab="HISTORY"
        notice="Saved LOCAL bill "+bill.invoice+"; financial cloud sync not yet enabled"
       }catch(e:Exception){notice="Bill save error: "+(e.message?:"unknown")}
      },enabled=cart.isNotEmpty()&&total>0,modifier=Modifier.fillMaxWidth()){Text("SAVE OFFLINE BILL")}
     }
    }
   }
   else->{
    LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
     item{Text("Saved local bills — never mock records",fontWeight=FontWeight.Bold)}
     item{
      Card {
       Column(Modifier.fillMaxWidth().padding(12.dp)){
        Text("Unuploaded local bills: "+pendingInbox,fontWeight=FontWeight.Bold)
        Text("Cloud INBOX backup only; not posted to accounting, dues or stock.",
         color=Color.Gray)
        Button(enabled=!sendingInbox && pendingInbox>0,onClick={uploadPendingInbox()}){
         Text(if(sendingInbox)"UPLOADING..." else "UPLOAD TO CLOUD INBOX")
        }
       }
      }
     }
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