package store.newcitystyle.universalpro

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
    data class Session(val accessToken:String, val email:String)
    data class Page(val items:List<JSONObject>,val count:Int?,val start:Int)

    private fun open(url:String,token:String?=null,method:String="GET"):HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod=method
        conn.connectTimeout=timeout
        conn.readTimeout=timeout
        conn.setRequestProperty("apikey",publicKey)
        conn.setRequestProperty("Accept","application/json")
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
        Session(token,email.trim())
    }
    suspend fun load(session:Session,table:String,start:Int=0,limit:Int=40):Page=withContext(Dispatchers.IO) {
        val allowed=setOf(
            "products","product_variants","pos_sales","purchases","purchase_items",
            "customers","suppliers","supplier_payments","expenses",
            "cash_bank_transactions","pos_sale_items","pos_payments"
        )
        require(table in allowed){"Unsupported table"}
        val columns=when(table){
            "products"->"id,name,brand,category,price,mrp,stock,barcode,image,is_active,sell_online"
            "product_variants"->"id,product_id,size,color,barcode,stock,mrp,selling_price,purchase_price,is_active"
            "pos_sales"->"id,invoice_number,customer_name,total_amount,paid_amount,due_amount,created_at"
            "purchases"->"id,purchase_number,supplier_name,total_amount,paid_amount,due_amount,purchase_date"
            "purchase_items"->"id,purchase_id,product_id,quantity"
            "customers"->"id,full_name,phone,total_orders,total_spent"
            "suppliers"->"id,supplier_name,phone"
            "supplier_payments"->"id,supplier_id,amount,payment_date"
            "expenses"->"id,expense_number,category_name,amount,expense_date"
            "cash_bank_transactions"->"id,transaction_number,entry_type,direction,amount,transaction_date"
            "pos_sale_items"->"id,sale_id,product_id,quantity"
            else->"id,sale_id,amount,payment_method"
        }
        val conn=open(root+"/rest/v1/"+table+"?select="+columns,token=session.accessToken)
        conn.setRequestProperty("Prefer","count=exact")
        conn.setRequestProperty("Range",start.toString()+"-"+(start+limit-1))
        val raw=consumeWithHeader(conn)
        val data=JSONArray(raw.first)
        Page((0 until data.length()).map{data.getJSONObject(it)},raw.second,start)
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
