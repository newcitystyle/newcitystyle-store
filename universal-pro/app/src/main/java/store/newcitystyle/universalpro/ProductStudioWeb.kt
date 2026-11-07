package store.newcitystyle.universalpro

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

internal object ProductStudioWeb {
    private const val origin="https://newcitystyle.store"
    private const val supabase="https://uskpoaszucenqxlzgmcy.supabase.co"

    private fun read(conn:HttpURLConnection):String {
        return try {
            val status=conn.responseCode
            val body=(if(status in 200..299)conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use{it.readText()}?:""
            if(status !in 200..299) {
                val message=runCatching{JSONObject(body).optString("error","Server error")}.getOrDefault("Server error")
                throw IOException("HTTP "+status+" • "+message.take(240))
            }
            body
        } finally {conn.disconnect()}
    }
    suspend fun uploadPhoto(context:Context,uri:Uri,productId:Long):String=withContext(Dispatchers.IO) {
        val mime=context.contentResolver.getType(uri)?:"image/jpeg"
        require(mime in setOf("image/jpeg","image/png","image/webp")){"Only JPG, PNG, WEBP images supported"}
        val bytes=context.contentResolver.openInputStream(uri)?.use {input->
            val output=ByteArrayOutputStream()
            val buffer=ByteArray(16384)
            var size=0
            while(true) {
                val n=input.read(buffer)
                if(n<0)break
                size+=n
                if(size>8*1024*1024)throw IOException("Photo must be smaller than 8 MB")
                output.write(buffer,0,n)
            }
            output.toByteArray()
        }?:throw IOException("Photo cannot be read")
        require(bytes.isNotEmpty()){"Selected photo is empty"}
        val boundary="NCS-"+UUID.randomUUID()
        val c=URL(origin+"/api/r2/upload").openConnection() as HttpURLConnection
        c.requestMethod="POST";c.doOutput=true;c.connectTimeout=20000;c.readTimeout=60000
        c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary)
        val e="\r\n"
        val fileExt=when(mime){"image/png"->"png";"image/webp"->"webp";else->"jpg"}
        c.outputStream.use{out->
            out.write(("--"+boundary+e+"Content-Disposition: form-data; name=\"folder\""+e+e+"products/main"+e).toByteArray())
            out.write(("--"+boundary+e+"Content-Disposition: form-data; name=\"file\"; filename=\"ncs-"+productId+"-"+UUID.randomUUID()+"."+fileExt+"\""+e+"Content-Type: "+mime+e+e).toByteArray())
            out.write(bytes)
            out.write((e+"--"+boundary+"--"+e).toByteArray())
        }
        val result=JSONObject(read(c))
        result.optString("url").takeIf{it.startsWith("https://")}?:throw IOException("Image upload returned no valid URL")
    }
    suspend fun generateDesignName(imageUrl:String):String=withContext(Dispatchers.IO) {
        require(imageUrl.startsWith("https://"))
        val req=JSONObject().put("imageUrl",imageUrl).put("mode","design-name")
        val c=URL(origin+"/api/generate-product-details").openConnection() as HttpURLConnection
        c.requestMethod="POST";c.doOutput=true;c.connectTimeout=20000;c.readTimeout=65000
        c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(req.toString().toByteArray(Charsets.UTF_8))}
        JSONObject(read(c)).optString("productName").trim()
            .takeIf{it.isNotBlank()}?:throw IOException("AI could not name this photo")
    }
    suspend fun generate(imageUrl:String,product:JSONObject):JSONObject=withContext(Dispatchers.IO) {
        val payload=JSONObject()
            .put("imageUrl",imageUrl)
            .put("mode","common-details-lite")
            .put("productContext",JSONObject().apply {
                put("productId",product.optLong("id"))
                put("name",product.optString("name"))
                put("brand",product.optString("brand"))
                put("category",product.optString("category"))
                put("barcode",product.optString("barcode"))
            })
        val c=URL(origin+"/api/generate-product-details").openConnection() as HttpURLConnection
        c.requestMethod="POST";c.doOutput=true;c.connectTimeout=20000;c.readTimeout=65000
        c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))}
        val result=JSONObject(read(c))
        if(result.optJSONObject("details")==null)throw IOException("AI generated no product details")
        result
    }
    // One atomic, owner-authenticated database function updates existing product,
    // design photos and selected size mappings without modifying physical stock.
    suspend fun publishOwnerGuarded(
        session:NcsCloud.Session,
        product:JSONObject,
        imageUrls:List<String>,
        details:JSONObject,
        price:Int,
        variantIds:List<Long>
    ):JSONObject=withContext(Dispatchers.IO) {
        val id=product.optLong("id")
        require(id>0){"Choose an existing product"}
        require(price>0){"Enter a valid online price"}
        require(imageUrls.isNotEmpty() && imageUrls.size<=10 && imageUrls.all{it.startsWith("https://")})
        require(variantIds.isNotEmpty() && variantIds.size<=20)
        val request=JSONObject()
            .put("p_product_id",id)
            .put("p_expected_updated_at",
                product.optString("updated_at","").takeIf{it.isNotBlank()&&it!="null"})
            .put("p_online_price",price)
            .put("p_variant_ids",org.json.JSONArray(variantIds))
            .put("p_photos",org.json.JSONArray(imageUrls))
            .put("p_ai",details)
        val c=URL(supabase+"/rest/v1/rpc/ncs_universal_product_publish_v1").openConnection() as HttpURLConnection
        c.requestMethod="POST";c.doOutput=true;c.connectTimeout=18000;c.readTimeout=30000
        c.setRequestProperty("apikey",NcsCloud.keyForInternalUse())
        c.setRequestProperty("Authorization","Bearer "+session.accessToken)
        c.setRequestProperty("Content-Type","application/json")
        c.outputStream.use{it.write(request.toString().toByteArray(Charsets.UTF_8))}
        val result=JSONObject(read(c))
        if(!result.optBoolean("ok",false))throw IOException("Website did not confirm publication")
        result
    }
}
