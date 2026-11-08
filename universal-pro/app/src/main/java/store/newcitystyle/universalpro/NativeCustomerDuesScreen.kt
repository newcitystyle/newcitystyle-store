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
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

private val dueRoyal=Color(0xFF0A2E73)
private val dueGold=Color(0xFFD4AF37)
private val dueCurrency=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))

@Composable
internal fun NativeCustomerDuesScreen(onBack:()->Unit){
    val scope=rememberCoroutineScope()
    var rows by remember{mutableStateOf<List<JSONObject>>(emptyList())}
    var totalRecords by remember{mutableStateOf<Int?>(null)}
    var search by remember{mutableStateOf("")}
    var offset by remember{mutableIntStateOf(0)}
    var busy by remember{mutableStateOf(false)}
    var sending by remember{mutableStateOf(false)}
    var status by remember{mutableStateOf("Connect owner account to load live customer dues")}
    var selected by remember{mutableStateOf<JSONObject?>(null)}
    var confirmSend by remember{mutableStateOf(false)}
    var lastSuccess by remember{mutableStateOf("")}
    fun load(next:Int){
        busy=true
        scope.launch{
            try{
                val owner=NcsCloud.restoreActiveSession()?:error("Owner login required")
                val page=NcsCloud.load(owner,"customer_credit_accounts",next,50)
                rows=page.items
                offset=next
                totalRecords=page.count
                status="Live customer dues • "+(page.count ?: rows.size)+" accounts"
            }catch(e:Exception){
                status="Could not refresh dues: "+(e.message?:"Unknown")
            }finally{busy=false}
        }
    }
    LaunchedEffect(Unit){load(0)}
    if(confirmSend && selected!=null){
        val account=selected!!
        AlertDialog(onDismissRequest={if(!sending)confirmSend=false},
            title={Text("Send WhatsApp due reminder?")},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
                    Text(account.optString("customer_name","Customer"),fontWeight=FontWeight.Bold)
                    Text("Due: "+dueCurrency.format(account.optDouble("current_balance",0.0)))
                    Text("The server re-checks the current balance and phone number before sending.")
                    Text("This sends a real message, not a preview.",color=Color(0xFF954C14))
                }
            },
            confirmButton={
                TextButton(enabled=!sending,onClick={
                    sending=true
                    scope.launch{
                        try{
                            val owner=NcsCloud.restoreActiveSession()?:error("Owner login expired")
                            NcsCloud.dueReminder(owner,account)
                            lastSuccess="WhatsApp reminder confirmed sent"
                            status="Reminder confirmed for selected account"
                            selected=null
                            confirmSend=false
                            load(offset)
                        }catch(e:Exception){
                            status="Reminder NOT confirmed: "+(e.message?:"Unknown")
                            confirmSend=false
                        }finally{sending=false}
                    }
                }){Text(if(sending)"SENDING..." else "CONFIRM SEND")}
            },
            dismissButton={TextButton(enabled=!sending,onClick={confirmSend=false}){Text("CANCEL")}}
        )
    }
    Column(Modifier.fillMaxSize().background(Color(0xFFF5F7FC))){
        Row(Modifier.fillMaxWidth().background(dueRoyal).padding(10.dp)){
            TextButton(onClick=onBack){Text("‹ Back",color=Color.White)}
            Column(Modifier.weight(1f)){
                Text("CUSTOMER DUES",color=dueGold,fontWeight=FontWeight.Black)
                Text("Native • live ledger • verified reminders",color=Color.White)
            }
            TextButton(enabled=!busy,onClick={load(0)}){Text("REFRESH",color=Color.White)}
        }
        if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(status,Modifier.padding(12.dp),color=dueRoyal)
        if(lastSuccess.isNotBlank())Text(lastSuccess,Modifier.padding(horizontal=12.dp),color=Color(0xFF087B55))
        OutlinedTextField(search,{search=it},label={Text("Search name or phone on current page")},
            modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp),singleLine=true)
        val filtered=rows.filter{
            search.isBlank() ||
            it.optString("customer_name").contains(search,true) ||
            it.optString("customer_phone").contains(search)
        }
        LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(12.dp),
            verticalArrangement=Arrangement.spacedBy(9.dp)){
            items(filtered,key={it.optLong("id")}){account->
                val outstanding=account.optDouble("current_balance",0.0)
                Card {
                    Column(Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement=Arrangement.spacedBy(5.dp)){
                        Text(account.optString("customer_name","Customer"),fontWeight=FontWeight.Bold)
                        Text(account.optString("customer_phone",""),color=Color.Gray)
                        Text("Outstanding: "+dueCurrency.format(outstanding),
                            color=if(outstanding>0)Color(0xFFAD453D) else Color(0xFF087B55),
                            fontWeight=FontWeight.Black)
                        Row {
                            TextButton(enabled=outstanding>0.009&&!sending,onClick={
                                selected=account
                                confirmSend=true
                            }){Text("SEND REMINDER")}
                            Spacer(Modifier.width(6.dp))
                            Text("Receive Payment: not activated",modifier=Modifier.padding(top=12.dp),
                                color=Color.Gray)
                        }
                    }
                }
            }
            item{
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                    OutlinedButton(enabled=offset>0&&!busy,onClick={load((offset-50).coerceAtLeast(0))},
                        modifier=Modifier.weight(1f)){Text("PREVIOUS")}
                    Button(enabled=!busy&&rows.size==50&&(totalRecords==null||offset+50<totalRecords!!),
                        onClick={load(offset+50)},modifier=Modifier.weight(1f)){Text("NEXT")}
                }
            }
        }
        Text("No payment or due balance is changed here. Reminders require confirmation.",
            modifier=Modifier.padding(12.dp),color=Color.Gray)
    }
}
