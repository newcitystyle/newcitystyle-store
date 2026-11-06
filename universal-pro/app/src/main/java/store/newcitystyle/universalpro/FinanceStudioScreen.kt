package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private data class FinanceModule(val title:String,val desc:String,val icon:ImageVector,val tint:Color)
private val financeModules=listOf(
    FinanceModule("Sales History","Bills, returns, corrections",Icons.Default.ReceiptLong,ProSky),
    FinanceModule("Profit Studio","Margin reactor & costing",Icons.Default.AutoGraph,ProPurple),
    FinanceModule("Customer Dues","Credit & collections",Icons.Default.Groups,ProCoral),
    FinanceModule("Supplier Dues","Payments & balances",Icons.Default.LocalShipping,ProOrange),
    FinanceModule("Cash / UPI","Cashbook and bank flow",Icons.Default.AccountBalanceWallet,ProTeal),
    FinanceModule("Expenses","Spend intelligence",Icons.Default.Payments,ProCoral),
    FinanceModule("Purchase History","Stock inward register",Icons.Default.Inventory,ProPurple),
    FinanceModule("Returns & Exchange","Receipt-linked adjustments",Icons.Default.SwapHoriz,ProSky)
)
@Composable fun FinanceStudioScreen() {
    var selected by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("All") }
    if(selected=="Profit Studio") {
        ProfitCalculatorScreen(onBack={selected=null})
    } else if(selected!=null) {
        OperationalStudioScreen(when(selected) {
            "Sales History" -> "Sales Intelligence"
            "Customer Dues" -> "Customers"
            "Supplier Dues" -> "Supplier Ledger"
            "Cash / UPI","Expenses" -> "Cash & Bank"
            "Purchase History" -> "Purchase Center"
            else -> selected!!
        },onBack={selected=null})
    } else {
        Column(Modifier.fillMaxSize().background(ProBg)) {
            ProHero("Finance Command","Monitor sales, margin & money flow",Icons.Default.AutoGraph)
            LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp)) {
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        ProStat("Sales","—","Read-only pending",Icons.Default.TrendingUp,ProTeal,Modifier.weight(1f))
                        ProStat("Profit","—","Read-only pending",Icons.Default.Insights,ProPurple,Modifier.weight(1f))
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        ProStat("Receivables","—","Customer dues",Icons.Default.Groups,ProOrange,Modifier.weight(1f))
                        ProStat("Payables","—","Supplier dues",Icons.Default.AccountBalance,ProCoral,Modifier.weight(1f))
                    }
                }
                item {
                    ProPill("SANDBOX MODE  •  ZERO FINANCIAL WRITES",ProOrange)
                    Spacer(Modifier.height(14.dp))
                    Text("Financial Workspaces",fontSize=21.sp,color=ProInk,fontWeight=FontWeight.Black)
                }
                item {
                    OutlinedTextField(query,{query=it},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(16.dp),placeholder={Text("Search accounts, payments, profit...")},leadingIcon={Icon(Icons.Default.Search,null)})
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        listOf("All","Sales","Accounts").forEach{f->
                            FilterChip(selected=filter==f,onClick={filter=f},label={Text(f)})
                        }
                    }
                }
                val visible=financeModules.filter{m ->
                    (filter=="All" || (filter=="Sales" && m.title in listOf("Sales History","Profit Studio","Returns & Exchange")) || (filter=="Accounts" && m.title !in listOf("Sales History","Profit Studio","Returns & Exchange"))) &&
                    (query.isBlank() || m.title.contains(query,true) || m.desc.contains(query,true))
                }
                items(visible.chunked(2)){pair->
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        pair.forEach { m ->
                            Card(
                                modifier=Modifier.weight(1f).clickable{selected=m.title},
                                shape=RoundedCornerShape(19.dp),
                                colors=CardDefaults.cardColors(containerColor=Color.White)
                            ) {
                                Column(Modifier.fillMaxWidth().padding(15.dp)) {
                                    Surface(color=m.tint.copy(alpha=.12f),shape=RoundedCornerShape(13.dp)){
                                        Box(Modifier.size(43.dp),contentAlignment=Alignment.Center){
                                            Icon(m.icon,null,tint=m.tint,modifier=Modifier.size(24.dp))
                                        }
                                    }
                                    Spacer(Modifier.height(12.dp))
                                    Text(m.title,color=ProInk,fontSize=14.sp,fontWeight=FontWeight.ExtraBold)
                                    Spacer(Modifier.height(3.dp))
                                    Text(m.desc,color=Color.Gray,fontSize=10.sp,maxLines=2)
                                    Spacer(Modifier.height(8.dp))
                                    Icon(Icons.Default.ArrowForward,null,tint=m.tint,modifier=Modifier.size(18.dp))
                                }
                            }
                        }
                        if(pair.size==1)Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
