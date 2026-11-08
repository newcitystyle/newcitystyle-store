package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.IOException

private const val BRIDGE_V17 = "https://new-city-style-1xve3y13f-newcitystyle-store.vercel.app/api/ncs-universal/v17/snapshot"
private val V17_TABLES = listOf("products", "product_variants", "pos_sales", "purchases", "customers", "suppliers", "expenses")

/** Read-only preview of the authenticated V380 cloud gateway. No local data is uploaded. */
@Composable
internal fun CloudBridgeV17Screen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var selected by remember { mutableStateOf("products") }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf("Not checked. Sign in to your owner account first.") }
    var rows by remember { mutableStateOf("—") }
    val session = NcsCloud.activeSession

    Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB)).verticalScroll(rememberScrollState()).padding(18.dp)) {
        TextButton(onClick=onBack) { Text("‹ Back") }
        Text("UNIVERSAL PRO V17", style=MaterialTheme.typography.headlineMedium, fontWeight=FontWeight.Black, color=Color(0xFF0A2E73))
        Text("Desktop ⇄ Cloud ⇄ Android", color=Color(0xFFD4AF37), fontWeight=FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text("V380 authenticated cloud read test. This preview does NOT enable financial writes or Desktop upload.", color=Color.DarkGray)
        Spacer(Modifier.height(14.dp))
        Text("Owner session: " + if(session==null) "Sign-in required" else "Available", color=Color(0xFF0A2E73))
        V17_TABLES.forEach { table ->
            Row {
                RadioButton(selected=selected==table, onClick={selected=table}, enabled=!busy)
                Text(table, modifier=Modifier.padding(top=12.dp))
            }
        }
        Button(onClick={
            busy=true
            result="Checking authenticated cloud bridge..."
            rows="—"
            scope.launch {
                try {
                    val auth=NcsCloud.restoreActiveSession() ?: throw IOException("Owner sign-in required. Open Live Business Cloud first.")
                    val response=withContext(Dispatchers.IO) { bridgeV17Read(auth.accessToken,selected) }
                    rows=response.optJSONArray("rows")?.length()?.toString() ?: "0"
                    result="CLOUD READ OK • version="+response.optString("version")+" • dataset="+response.optString("dataset")+
                        "\nNext offset: "+response.optString("nextOffset","none")
                } catch(e:Exception){
                    result="NOT CONNECTED: "+(e.message?:"Unknown error")
                } finally { busy=false }
            }
        },enabled=!busy && session!=null,modifier=Modifier.fillMaxWidth()) {
            Text(if(busy) "CHECKING..." else "VERIFY CLOUD CONNECTION")
        }
        Spacer(Modifier.height(12.dp))
        Card(shape=RoundedCornerShape(16.dp), colors=CardDefaults.cardColors(containerColor=Color.White)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Cloud records returned: "+rows, fontWeight=FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(result)
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("Safety: Owner bearer login required • Max 1 record requested • No POST, PUT, DELETE • No automatic local sync.", style=MaterialTheme.typography.bodySmall)
    }
}

private fun bridgeV17Read(token:String,table:String):JSONObject {
    require(table in V17_TABLES)
    val address=BRIDGE_V17+"?table="+table+"&limit=1&offset=0"
    val conn=URL(address).openConnection() as HttpURLConnection
    try {
        conn.requestMethod="GET"
        conn.connectTimeout=15000
        conn.readTimeout=20000
        conn.instanceFollowRedirects=false
        conn.setRequestProperty("Authorization","Bearer "+token)
        conn.setRequestProperty("Accept","application/json")
        conn.setRequestProperty("Cache-Control","no-store")
        val code=conn.responseCode
        val stream=if(code in 200..299) conn.inputStream else conn.errorStream
        val body=stream?.bufferedReader()?.use { it.readText() } ?: ""
        if(code !in 200..299) throw IOException("HTTP "+code+" • "+body.take(150))
        val json=JSONObject(body)
        if(!json.optBoolean("ok",false) || json.optString("version")!="V380") {
            throw IOException("Unexpected cloud bridge response")
        }
        return json
    } finally {conn.disconnect()}
}
