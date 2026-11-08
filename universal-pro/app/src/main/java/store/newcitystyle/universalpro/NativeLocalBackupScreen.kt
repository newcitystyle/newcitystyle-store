package store.newcitystyle.universalpro

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Composable
internal fun NativeLocalBackupScreen(onBack:()->Unit) {
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    var busy by remember{mutableStateOf(false)}
    var status by remember{mutableStateOf("Not exported during this session")}
    val export=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")){uri->
        if(uri!=null){
            busy=true
            scope.launch{
                try{
                    status=withContext(Dispatchers.IO){NcsLocalPosBackup.export(context,uri)}
                }catch(e:Exception){
                    status="Backup NOT confirmed: "+(e.message?:"Unknown error")
                }finally{busy=false}
            }
        }
    }
    val verify=rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ){uri->
        if(uri!=null){
            busy=true
            scope.launch{
                try{
                    status=withContext(Dispatchers.IO){
                        NcsLocalPosBackup.verifyArchive(context,uri)
                    }
                }catch(e:Exception){
                    status="Archive validation failed: "+(e.message?:"Unknown error")
                }finally{busy=false}
            }
        }
    }
    Column(
        modifier=Modifier.fillMaxSize().background(Color(0xFFF7F8FC)).padding(18.dp),
        verticalArrangement=Arrangement.spacedBy(15.dp)
    ) {
        TextButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null);Text("BACK")}
        Text("LOCAL POS BACKUP",style=MaterialTheme.typography.headlineSmall,
            fontWeight=FontWeight.Black,color=Color(0xFF0A2E73))
        Text("Export a verified copy of this phone's local SQLite invoices, items, catalogue and sync queue. Cloud and Desktop records are NOT included.",
            color=Color(0xFF394C65))
        Card(colors=CardDefaults.cardColors(containerColor=Color.White),
            shape=RoundedCornerShape(16.dp)){
            Column(Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement=Arrangement.spacedBy(10.dp)){
                Text("PRIVATE BACKUP • OWNER CONTROLLED",fontWeight=FontWeight.Bold)
                Text("1. Choose a private folder on your phone or your Drive.")
                Text("2. The snapshot is checked for SQLite integrity.")
                Text("3. Keep the ZIP safely. It contains private business data and is NOT encrypted.")
                Text("4. Test Restore checks a separate copy of the database. It never overwrites live bills. Actual restore is still disabled.")
            }
        }
        Button(
            modifier=Modifier.fillMaxWidth(),
            enabled=!busy,
            onClick={
                val name="NCS_LOCAL_POS_"+
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))+
                    ".zip"
                export.launch(name)
            }
        ){
            Icon(Icons.Default.SaveAlt,null)
            Spacer(Modifier.width(8.dp))
            Text(if(busy)"EXPORTING..." else "SAVE POS BACKUP ZIP")
        }
        OutlinedButton(
            modifier=Modifier.fillMaxWidth(),
            enabled=!busy,
            onClick={verify.launch(arrayOf("application/zip","application/octet-stream"))}
        ){
            Icon(Icons.Default.VerifiedUser,null)
            Spacer(Modifier.width(8.dp))
            Text("TEST BACKUP RESTORE SAFELY")
        }
        if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(status,color=Color(0xFF0A2E73),fontWeight=FontWeight.Medium)
        Text("This is an export only. It does not mark bills as synced, create sales, change inventory, or modify dues.",
            color=Color.Gray)
    }
}
