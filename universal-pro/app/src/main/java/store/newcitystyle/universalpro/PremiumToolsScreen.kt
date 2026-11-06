package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

private data class ToolAction(val title:String,val subtitle:String,val icon:ImageVector,val tone:Color)
private val allActions=listOf(
    ToolAction("Advanced POS","Billing terminal",Icons.Default.QrCodeScanner,ProBlue),
    ToolAction("Product Studio","Sizes, variants & margin",Icons.Default.Style,ProPurple),
    ToolAction("Purchase Center","Stock inward studio",Icons.Default.LocalShipping,ProTeal),
    ToolAction("Sales Intelligence","Sales & bill records",Icons.Default.AutoGraph,ProSky),
    ToolAction("Customers","CRM & customer dues",Icons.Default.Groups,ProCoral),
    ToolAction("Supplier Ledger","Supplier accounts",Icons.Default.AccountBalance,ProOrange),
    ToolAction("Inventory Radar","Stock health & alerts",Icons.Default.Inventory2,ProTeal),
    ToolAction("Cash & Bank","UPI, cash & expenses",Icons.Default.AccountBalanceWallet,ProSky),
    ToolAction("Online Orders","E-commerce command",Icons.Default.ShoppingBag,ProPurple),
    ToolAction("LIVA AI","Assistant concept",Icons.Default.AutoAwesome,ProCoral),
    ToolAction("Profit Studio","Live margin calculator",Icons.Default.Calculate,ProOrange),
    ToolAction("Sync Center","Desktop / Android integration status",Icons.Default.CloudSync,ProTeal)
)
@Composable fun PremiumToolsScreen(onOpen:(String)->Unit) {
    var search by remember { mutableStateOf("") }
    var selectedGroup by remember { mutableStateOf("All") }
    val visible=allActions.filter{a->
        (selectedGroup=="All" || (selectedGroup=="Finance" && a.title in listOf("Sales Intelligence","Supplier Ledger","Cash & Bank","Profit Studio")) ||
         (selectedGroup=="Operations" && a.title !in listOf("Sales Intelligence","Supplier Ledger","Cash & Bank","Profit Studio"))) &&
         (search.isBlank() || a.title.contains(search,true) || a.subtitle.contains(search,true))
    }
    Column(Modifier.fillMaxSize().background(ProBg)) {
        ProHero("Business Galaxy","Your entire business in one control panel",Icons.Default.Apps,ProGold)
        LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
            item {
                Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                    ProStat("Modules",allActions.size.toString(),"Native entry points",Icons.Default.Dashboard,ProPurple,Modifier.weight(1f))
                    ProStat("Connected","0","Safe preview mode",Icons.Default.Security,ProTeal,Modifier.weight(1f))
                }
            }
            item {
                OutlinedTextField(search,{search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(16.dp),leadingIcon={Icon(Icons.Default.Search,null)},placeholder={Text("Find a business tool instantly")})
            }
            item {
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    listOf("All","Operations","Finance").forEach{g->
                        FilterChip(selected=selectedGroup==g,onClick={selectedGroup=g},label={Text(g)})
                    }
                }
            }
            item {Text("Explore Workspaces",fontSize=21.sp,fontWeight=FontWeight.Black,color=ProInk)}
            visible.chunked(2).forEach{pair->
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(11.dp)){
                        pair.forEach{action->
                            Card(
                                modifier=Modifier.weight(1f).clickable{onOpen(action.title)},
                                colors=CardDefaults.cardColors(containerColor=Color.White),
                                shape=RoundedCornerShape(19.dp)
                            ) {
                                Column(Modifier.fillMaxWidth().padding(15.dp)) {
                                    Surface(color=action.tone.copy(alpha=.13f),shape=RoundedCornerShape(14.dp)){
                                        Box(Modifier.size(49.dp),contentAlignment=Alignment.Center){
                                            Icon(action.icon,null,tint=action.tone,modifier=Modifier.size(27.dp))
                                        }
                                    }
                                    Spacer(Modifier.height(12.dp))
                                    Text(action.title,fontSize=14.sp,color=ProInk,fontWeight=FontWeight.ExtraBold)
                                    Text(action.subtitle,fontSize=10.sp,color=Color.Gray,maxLines=2)
                                    Spacer(Modifier.height(9.dp))
                                    Icon(Icons.Default.ArrowForward,null,tint=action.tone,modifier=Modifier.size(18.dp))
                                }
                            }
                        }
                        if(pair.size==1)Spacer(Modifier.weight(1f))
                    }
                }
            }
            item {ProPill("PREVIEW MODE • ORIGINAL APPS ARE UNCHANGED",ProOrange)}
        }
    }
}
