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
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.IOException

private val V17_TABLES = listOf("ncs_desktop_sync_inbox_v1", "pos_sales", "products", "product_variants", "purchases", "customers", "suppliers", "expenses")

/** V17 live cloud read: use the same authenticated Supabase as existing Universal Pro modules.
 * Never report Desktop synchronization merely because cloud is accessible.
 */
@Composable
internal fun CloudBridgeV17Screen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var selected by remember { mutableStateOf("ncs_desktop_sync_inbox_v1") }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf("Sign in through Live Business Cloud, then verify the cloud records.") }
    var rows by remember { mutableStateOf("—") }
    var total by remember { mutableStateOf("—") }
    var newest by remember { mutableStateOf("—") }
    var samples by remember { mutableStateOf(listOf<String>()) }
    val session = NcsCloud.activeSession

    Column(Modifier.fillMaxSize().background(Color(0xFFF6F7FB)).verticalScroll(rememberScrollState()).padding(18.dp)) {
        TextButton(onClick=onBack) { Text("‹ Back") }
        Text("UNIVERSAL PRO V18", style=MaterialTheme.typography.headlineMedium, fontWeight=FontWeight.Black, color=Color(0xFF0A2E73))
        Text("Desktop ⇄ Cloud ⇄ Android", color=Color(0xFFD4AF37), fontWeight=FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text("Desktop sales inbox now on Cloud. Inbox bills are pending accounting reconciliation; the original POS ledger and stock are unchanged.", color=Color.DarkGray)
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
            result="Checking cloud records..."
            rows="—"; total="—"; newest="—"; samples=emptyList()
            scope.launch {
                try {
                    val auth=NcsCloud.restoreActiveSession() ?: throw IOException("Owner sign-in required. Open Live Business Cloud first.")
                    val page=NcsCloud.load(auth,selected,0,10)
                    rows=page.items.size.toString()
                    total=page.count?.toString() ?: "Count unavailable"
                    val first=page.items.firstOrNull()
                    newest=if(selected=="ncs_desktop_sync_inbox_v1") {
                        (first?.optString("offline_invoice_number") ?: "No invoice")+
                            " • "+(first?.optString("original_created_at") ?: "No date")
                    } else if(selected=="pos_sales") {
                        (first?.optString("invoice_number") ?: "No invoice")+
                            " • "+(first?.optString("created_at") ?: "No date")
                    } else (first?.optString("id") ?: "No record")
                    samples=page.items.map { item ->
                        if(selected=="ncs_desktop_sync_inbox_v1") {
                            val invoice=item.optString("offline_invoice_number")
                            val amount=item.optDouble("total_amount",0.0)
                            val state=item.optString("ledger_sync_state")
                            val quick=if(item.optBoolean("requires_quick_item_handling")) " • QUICK ITEM" else ""
                            "$invoice • ₹$amount • $state$quick"
                        } else if(selected=="pos_sales") {
                            item.optString("invoice_number")+" • ₹"+item.optDouble("total_amount",0.0)
                        } else item.optString("id","Record")
                    }
                    result=if(selected=="ncs_desktop_sync_inbox_v1")
                        "DESKTOP INBOX CONNECTED. These bills are visible in Cloud, but NOT posted to the financial ledger."
                    else "LIVE CLOUD DATA: "+selected
                } catch(e:Exception){
                    result="CLOUD READ FAILED: "+(e.message?:"Unknown error")
                } finally { busy=false }
            }
        },enabled=!busy && session!=null,modifier=Modifier.fillMaxWidth()) {
            Text(if(busy) "CHECKING..." else "REFRESH CLOUD DATA")
        }
        Spacer(Modifier.height(12.dp))
        Card(shape=RoundedCornerShape(16.dp), colors=CardDefaults.cardColors(containerColor=Color.White)) {
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Cloud total: "+total, fontWeight=FontWeight.Bold)
                Text("Records loaded: "+rows)
                Text("Latest: "+newest)
                Spacer(Modifier.height(8.dp))
                Text(result)
                samples.forEach { row ->
                    Spacer(Modifier.height(6.dp))
                    Text(row, style=MaterialTheme.typography.bodySmall)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("Safety: Owner login required • Cloud inbox separate from financial sales • No stock or dues modified by this screen.", style=MaterialTheme.typography.bodySmall)
    }
}
