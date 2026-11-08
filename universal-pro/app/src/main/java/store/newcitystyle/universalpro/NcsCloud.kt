package store.newcitystyle.universalpro

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// Publishable client key only: NEVER embed service_role or secret keys in Android.
internal object NcsCloud {
    private const val root = "https://uskpoaszucenqxlzgmcy.supabase.co"
    private const val publicKey = "sb_publishable_t2qY6zyXSPrtao7ox5eC2A_kBsTNuy3"
    private const val timeout = 14000
    internal fun keyForInternalUse():String = publicKey
    data class Session(val accessToken:String, val email:String,val refreshToken:String="",val expiresAt:Long=0)
    var activeSession:Session? by mutableStateOf(null)
        private set
    private var appContext:Context?=null
    fun initialize(context:Context) {
        appContext=context.applicationContext
        activeSession=NcsSecureSession.restore(context.applicationContext)
    }
    fun signOut(){
        activeSession=null
        appContext?.let{NcsSecureSession.clear(it)}
    }
    private fun rememberSession(session:Session):Session {
        activeSession=session
        appContext?.let { NcsSecureSession.save(it,session) }
        return session
    }
    suspend fun restoreActiveSession():Session? {
        val old=activeSession?:return null
        return if(old.expiresAt>0 && System.currentTimeMillis()/1000>=old.expiresAt-120) {
            try{renew(old)}catch(_:Exception){signOut();null}
        } else old
    }
    suspend fun renew(old:Session):Session=withContext(Dispatchers.IO){
        if(old.refreshToken.isBlank())throw IOException("Please sign in again")
        val conn=open(root+"/auth/v1/token?grant_type=refresh_token",method="POST")
        conn.doOutput=true
        conn.setRequestProperty("Content-Type","application/json")
        val payload=JSONObject().put("refresh_token",old.refreshToken)
        conn.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))}
        val response=JSONObject(consume(conn))
        val token=response.optString("access_token")
        if(token.isBlank())throw IOException("Refresh session unavailable")
        rememberSession(Session(
            token,old.email,response.optString("refresh_token",old.refreshToken),
            System.currentTimeMillis()/1000+response.optLong("expires_in",3600)
        ))
    }
    data class Page(val items:List<JSONObject>,val count:Int?,val start:Int)

    private fun open(url:String,token:String?=null,method:String="GET"):HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod=method
        conn.connectTimeout=timeout
        conn.readTimeout=timeout
        conn.setRequestProperty("apikey",publicKey)
        conn.setRequestProperty("Accept","application/json")
        conn.setRequestProperty("Cache-Control","no-cache, no-store, max-age=0")
        conn.setRequestProperty("Pragma","no-cache")
        conn.useCaches=false
        if(token!=null)conn.setRequestProperty("Authorization","Bearer "+token)
        return conn
    }
    private fun consume(conn:HttpURLConnection):String {
        return try {
            val code=conn.responseCode
            val stream=if(code in 200..299) conn.inputStream else conn.errorStream
            val response=stream?.bufferedReader()?.use{it.readText()}?:""
            if(code !in 200..299) {
                val msg=try{
                    val j=JSONObject(response)
                    j.optString("msg",j.optString("message",j.optString("error_description","Request rejected")))
                }catch(_:Exception){"Request rejected"}
                throw IOException("HTTP "+code+" • "+msg.take(160))
            }
            response
        } finally { conn.disconnect() }
    }
    suspend fun signIn(email:String,password:String):Session=withContext(Dispatchers.IO) {
        val conn=open(root+"/auth/v1/token?grant_type=password",method="POST")
        conn.setRequestProperty("Content-Type","application/json")
        conn.doOutput=true
        val bytes=JSONObject().put("email",email).put("password",password).toString().toByteArray(Charsets.UTF_8)
        conn.outputStream.use{it.write(bytes)}
        val j=JSONObject(consume(conn))
        val token=j.optString("access_token")
        if(token.isBlank()) throw IOException("Sign-in did not return a session token")
        rememberSession(Session(token,email.trim(),
            j.optString("refresh_token"),
            System.currentTimeMillis()/1000+j.optLong("expires_in",3600)))
    }
    suspend fun load(session:Session,table:String,start:Int=0,limit:Int=40):Page=withContext(Dispatchers.IO) {
        val allowed=setOf(
            "products","product_variants","product_design_units","product_design_unit_variants","customer_credit_accounts","customer_credit_transactions","billing_customers","pos_sales","purchases","purchase_items",
            "customers","suppliers","supplier_payments","expenses",
            "cash_bank_transactions","pos_sale_items","pos_payments","ncs_desktop_sync_inbox_v1"
        )
        require(table in allowed){"Unsupported table"}
        val columns=when(table){
            "products"->"id,name,brand,category,price,mrp,stock,barcode,image,image_url,images,is_active,sell_online,updated_at"
            "product_variants"->"id,product_id,size,color,barcode,stock,mrp,selling_price,purchase_price,is_active"
            "product_design_units"->"id,product_id,design_name,image_url,status,unit_quantity,parent_barcode"
            "product_design_unit_variants"->"id,product_id,design_unit_id,variant_id,status,mrp,online_price,online_quantity,online_mrp"
            "pos_sales"->"id,invoice_number,customer_name,total_amount,paid_amount,due_amount,created_at"
            "ncs_desktop_sync_inbox_v1"->"client_transaction_id,offline_invoice_number,total_amount,paid_amount,due_amount,payment_method,original_created_at,requires_quick_item_handling,ledger_sync_state"
            "purchases"->"id,purchase_number,supplier_name,total_amount,paid_amount,due_amount,purchase_date"
            "purchase_items"->"id,purchase_id,product_id,quantity"
            "customers"->"id,full_name,phone,total_orders,total_spent,created_at"
            "customer_credit_accounts"->"id,customer_id,customer_name,customer_phone,current_balance,total_credit_given,total_credit_paid,last_payment_date,updated_at"
            "customer_credit_transactions"->"id,credit_account_id,customer_id,amount_change,transaction_type,balance_after,created_at"
            "billing_customers"->"id,customer_name,phone,current_due,total_credit,total_paid,updated_at"
            "suppliers"->"id,supplier_name,phone"
            "supplier_payments"->"id,supplier_id,amount,payment_date"
            "expenses"->"id,expense_number,category_name,amount,expense_date"
            "cash_bank_transactions"->"id,transaction_number,entry_type,direction,amount,transaction_date"
            "pos_sale_items"->"id,sale_id,product_id,quantity"
            else->"id,sale_id,amount,payment_method"
        }
        val sort=when(table){
            "products","product_variants","product_design_units","product_design_unit_variants","customers","suppliers","billing_customers" -> "&order=id.desc"
            "supplier_payments" -> "&order=payment_date.desc,id.desc"
            "customer_credit_accounts" -> "&order=current_balance.desc"
            "customer_credit_transactions" -> "&order=created_at.desc"
            "cash_bank_transactions" -> "&order=transaction_date.desc,created_at.desc"
            "expenses" -> "&order=expense_date.desc,created_at.desc"
            "purchases" -> "&order=purchase_date.desc,created_at.desc"
            "ncs_desktop_sync_inbox_v1" -> "&order=original_created_at.desc"
            "pos_sales","pos_payments","pos_sale_items","purchase_items" -> "&order=created_at.desc"
            else -> "&order=id.desc"
        }
        val conn=open(root+"/rest/v1/"+table+"?select="+columns+sort,token=session.accessToken)
        conn.setRequestProperty("Prefer","count=exact")
        conn.setRequestProperty("Range",start.toString()+"-"+(start+limit-1))
        val raw=consumeWithHeader(conn)
        val data=JSONArray(raw.first)
        Page((0 until data.length()).map{data.getJSONObject(it)},raw.second,start)
    }
    private suspend fun rpc(session:Session,function:String,body:JSONObject=JSONObject()):String=withContext(Dispatchers.IO) {
        require(function in setOf(
            "ncs_universal_customer_profile_v14","ncs_universal_credit_profile_v14","ncs_universal_bill_detail_v14",
            "ncs_universal_sales_trend_v14", "ncs_universal_owner_product_metadata_v1"
        ))
        val c=open(root+"/rest/v1/rpc/"+function,token=session.accessToken,method="POST")
        c.doOutput=true;c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
        consume(c)
    }
    suspend fun updateProductMetadata(
        session:Session,
        productId:Long,
        expectedName:String,
        expectedBrand:String?,
        newName:String,
        newBrand:String?
    ):JSONObject {
        require(productId>0 && newName.trim().length in 2..150 &&
            (newBrand?.length ?: 0)<=80){"Invalid product details"}
        require(activeSession?.email?.equals(session.email,ignoreCase=true)==true){"Owner login required"}
        val payload=JSONObject()
            .put("p_product_id",productId)
            .put("p_expected_name",expectedName)
            .put("p_expected_brand",expectedBrand ?: JSONObject.NULL)
            .put("p_new_name",newName.trim())
            .put("p_new_brand",newBrand?.trim() ?: JSONObject.NULL)
        return JSONObject(rpc(session,"ncs_universal_owner_product_metadata_v1",payload))
    }
    suspend fun customerProfile(session:Session,id:Long):JSONObject {
        require(id>0)
        return JSONObject(rpc(session,"ncs_universal_customer_profile_v14",JSONObject().put("p_customer_id",id)))
    }
    suspend fun creditProfile(session:Session,id:Long):JSONObject {
        require(id>0)
        return JSONObject(rpc(session,"ncs_universal_credit_profile_v14",JSONObject().put("p_account_id",id)))
    }
    suspend fun billDetails(session:Session,id:String):JSONObject {
        require(id.matches(Regex("[0-9a-fA-F-]{36}")))
        return JSONObject(rpc(session,"ncs_universal_bill_detail_v14",JSONObject().put("p_sale_id",id)))
    }
    suspend fun salesTrend(session:Session):JSONArray {
        return JSONArray(rpc(session,"ncs_universal_sales_trend_v14"))
    }
    suspend fun dueReminder(session:Session,account:JSONObject):JSONObject=withContext(Dispatchers.IO) {
        require(activeSession?.accessToken==session.accessToken){"Owner session expired"}
        val accountId=account.optLong("id")
        require(accountId>0){"Choose a real credit account"}
        val fresh=creditProfile(session,accountId).optJSONArray("credit_accounts")?.optJSONObject(0)
            ?:throw IOException("Could not verify current outstanding balance")
        require(fresh.optLong("id")==accountId){"Credit account changed"}
        val due=fresh.optDouble("current_balance",0.0)
        val phone=fresh.optString("customer_phone").filter(Char::isDigit)
        require(due>0.009){"This customer's due has been settled; reminder not sent"}
        require(phone.length==10 || (phone.length==12 && phone.startsWith("91"))){"Invalid customer phone"}
        require(phone==account.optString("customer_phone").filter(Char::isDigit)){"Phone changed. Refresh before sending"}
        val payload=JSONObject()
            .put("type","DUE_REMINDER")
            .put("to",phone)
            .put("customerName",fresh.optString("customer_name"))
            .put("currentDue",due)
        val c=URL("https://newcitystyle.store/api/whatsapp/customer-message").openConnection() as HttpURLConnection
        c.requestMethod="POST";c.doOutput=true;c.connectTimeout=20000;c.readTimeout=45000
        c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))}
        val body=consume(c)
        val result=JSONObject(body)
        if(!result.optBoolean("success",false) || !result.optBoolean("directWhatsAppSent",false)) throw IOException(result.optString("error","WhatsApp service did not confirm sending"))
        result
    }
    suspend fun businessTotals(session:Session):JSONObject=withContext(Dispatchers.IO) {
        val conn=open(root+"/rest/v1/rpc/ncs_universal_business_totals_v15",token=session.accessToken,method="POST")
        conn.doOutput=true;conn.setRequestProperty("Content-Type","application/json")
        conn.outputStream.use{it.write("{}".toByteArray(Charsets.UTF_8))}
        JSONObject(consume(conn))
    }
    suspend fun dashboard(session:Session):JSONObject = withContext(Dispatchers.IO) {
        val conn=open(root+"/rest/v1/rpc/ncs_universal_dashboard_v13",token=session.accessToken,method="POST")
        conn.doOutput=true
        conn.setRequestProperty("Content-Type","application/json")
        conn.outputStream.use{it.write("{}".toByteArray(Charsets.UTF_8))}
        JSONObject(consume(conn))
    }
    suspend fun searchProducts(session:Session,term:String):List<JSONObject> = withContext(Dispatchers.IO) {
        val clean=term.trim().take(70).filter { it.isLetterOrDigit() || it==' ' || it=='-' || it=='_' }
        require(clean.length>=2){"Enter at least 2 characters or a product barcode"}
        val filter="(name.ilike.*"+clean+"*,barcode.ilike.*"+clean+"*)"
        val encoded=java.net.URLEncoder.encode(filter,"UTF-8")
        val cols="id,name,brand,category,price,mrp,stock,barcode,image,image_url,images,is_active,sell_online,updated_at"
        val conn=open(root+"/rest/v1/products?select="+cols+"&or="+encoded+"&limit=75",token=session.accessToken)
        val arr=JSONArray(consume(conn))
        (0 until arr.length()).map{arr.getJSONObject(it)}
    }
    suspend fun forProduct(session:Session,table:String,productId:Long):List<JSONObject> = withContext(Dispatchers.IO) {
        require(table in setOf("product_variants","product_design_units","product_design_unit_variants"))
        val cols=when(table) {
            "product_variants"->"id,product_id,size,color,stock,mrp,selling_price,purchase_price,barcode,sell_online,online_price,online_stock_limit"
            "product_design_units"->"id,product_id,design_name,image_url,unit_quantity,status,parent_barcode"
            else->"id,product_id,design_unit_id,variant_id,status,mrp,online_price,online_quantity"
        }
        val conn=open(root+"/rest/v1/"+table+"?select="+cols+"&product_id=eq."+productId+"&limit=200",token=session.accessToken)
        val arr=JSONArray(consume(conn))
        (0 until arr.length()).map{arr.getJSONObject(it)}
    }
    private fun consumeWithHeader(conn:HttpURLConnection):Pair<String,Int?> {
        return try {
            val status=conn.responseCode
            val stream=if(status in 200..299)conn.inputStream else conn.errorStream
            val body=stream?.bufferedReader()?.use{it.readText()}?:""
            if(status !in 200..299) {
                throw IOException("HTTP "+status+" • Cloud table cannot be accessed with this login")
            }
            val count=conn.getHeaderField("Content-Range")?.substringAfter("/", "")?.toIntOrNull()
            body to count
        } finally {conn.disconnect()}
    }
}
