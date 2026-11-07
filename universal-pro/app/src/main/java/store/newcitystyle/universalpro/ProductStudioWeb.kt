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
    // Restrict updates to the selected existing row and ONLINE CONTENT columns only.
    // Never edit physical barcode, SKU, stock, purchase cost, or POS variant quantities.
    suspend fun publishExisting(session:NcsCloud.Session,product:JSONObject,imageUrls:List<String>,details:JSONObject):JSONObject=withContext(Dispatchers.IO) {
        require(imageUrls.isNotEmpty()&&imageUrls.all{it.startsWith("https://")}){"Valid uploaded photos required"}
        val imageUrl=imageUrls.first()
        val id=product.optLong("id")
        require(id>0){"Existing product required"}
        val productName=details.optString("productName",product.optString("name")).trim()
        val description=details.optString("description").trim()
        if(productName.isBlank() || description.isBlank())throw IOException("AI content incomplete; review required")
        val price=product.optDouble("price",0.0)
        if(price<=0)throw IOException("Product needs a valid existing online price before publishing")
        val payload=JSONObject()
            .put("name",productName)
            .put("description",description)
            .put("tagline",details.optString("tagline"))
            .put("category",details.optString("category",product.optString("category")))
            .put("subcategory",details.optString("subcategory",product.optString("subcategory")))
            .put("image",imageUrl)
            .put("image_url",imageUrl)
            .put("gallery_images",org.json.JSONArray(imageUrls.drop(1)))
            .put("images",org.json.JSONArray(imageUrls))
            .put("seo_title",details.optString("seoTitle",productName+" | NEW CITY STYLE"))
            .put("meta_description",details.optString("metaDescription"))
            .put("seo_keywords",details.optJSONArray("seoKeywords")?.join(", ") ?: "")
            .put("key_features",details.optJSONArray("keyFeatures")?:org.json.JSONArray())
            .put("technical_specifications",details.optJSONArray("technicalSpecifications")?:org.json.JSONArray())
            .put("faqs",details.optJSONArray("faqs")?:org.json.JSONArray())
            .put("tags",details.optJSONArray("productTags")?:org.json.JSONArray())
            .put("material",details.optString("material",product.optString("material")))
            .put("pattern",details.optString("pattern",product.optString("pattern")))
            .put("sell_online",true)
        val currentStamp=product.optString("updated_at","")
        val versionCheck=if(currentStamp.isNotBlank()&&currentStamp!="null")
            "&updated_at=eq."+java.net.URLEncoder.encode(currentStamp,"UTF-8") else ""
        val c=URL(supabase+"/rest/v1/products?id=eq."+id+versionCheck).openConnection() as HttpURLConnection
        c.requestMethod="PATCH";c.doOutput=true;c.connectTimeout=18000;c.readTimeout=22000
        c.setRequestProperty("apikey",NcsCloud.keyForInternalUse())
        c.setRequestProperty("Authorization","Bearer "+session.accessToken)
        c.setRequestProperty("Content-Type","application/json")
        c.setRequestProperty("Prefer","return=representation")
        c.outputStream.use{it.write(payload.toString().toByteArray(Charsets.UTF_8))}
        val arr=org.json.JSONArray(read(c))
        if(arr.length()!=1)throw IOException("Publish was not confirmed for exactly one product")
        arr.getJSONObject(0)
    }
}
