package store.newcitystyle.universalpro

import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Navy = Color(0xFF0A2E73)
private val Gold = Color(0xFFD4AF37)
private val Paper = Color(0xFFF6F7FB)
private val Ink = Color(0xFF16233C)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(10, 46, 115)
        NcsCloud.initialize(applicationContext)
        androidx.lifecycle.lifecycleScope.launchWhenStarted { NcsCloud.restoreActiveSession() }
        setContent { UniversalApp() }
    }
}

private data class Module(val title: String, val subtitle: String)
private val modules = listOf(
    Module("Advanced POS", "Barcode, smart billing & returns"),
    Module("Product Studio", "Variants, images, brands & stock"),
    Module("Purchase Center", "Inward, invoices & supplier accounts"),
    Module("Sales Intelligence", "Sales trends, margin & profit"),
    Module("Customers", "Profiles, dues & collections"),
    Module("Supplier Ledger", "Payments, dues & reconciliation"),
    Module("Inventory Radar", "Stock alerts, sizes & colors"),
    Module("Cash & Bank", "Cash, UPI & expenses"),
    Module("Online Orders", "E-commerce order control"),
    Module("LIVA AI", "Business assistant — future integration")
)

@Composable
private fun UniversalApp() {
    var selected by remember { mutableStateOf("Home") }
    var openedModule by remember { mutableStateOf<String?>(null) }
    val tabs = listOf("Home", "Billing", "Products", "Insights", "More")
    MaterialTheme(colorScheme = lightColorScheme(primary = Navy, secondary = Gold, background = Paper, surface = Color.White)) {
        Scaffold(
            containerColor = Paper,
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF0D1B3F), tonalElevation = 8.dp) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = selected == tab,
                            onClick = { selected = tab; openedModule = null },
                            icon = {
                                Icon(
                                    when (tab) {
                                        "Home" -> Icons.Default.Home
                                        "Billing" -> Icons.Default.Receipt
                                        "Products" -> Icons.Default.Inventory2
                                        "Insights" -> Icons.Default.BarChart
                                        else -> Icons.Default.Apps
                                    },
                                    contentDescription = tab
                                )
                            },
                            label = { Text(tab, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color(0xFF0D1B3F),
                                selectedTextColor = Color(0xFFF0C86B),
                                unselectedIconColor = Color.White.copy(alpha = .68f),
                                unselectedTextColor = Color.White.copy(alpha = .68f),
                                indicatorColor = when (tab) {
                                    "Home" -> Color(0xFFEAC267)
                                    "Billing" -> Color(0xFF6BD5C6)
                                    "Products" -> Color(0xFFAE93F4)
                                    "Insights" -> Color(0xFFFF9A83)
                                    else -> Color(0xFF80B5FF)
                                }
                            )
                        )
                    }
                }
            }
        ) { pad ->
            Column(modifier = Modifier.padding(pad).fillMaxSize()) {
                if (openedModule != null) {
                    when (openedModule) {
                        "Product Studio" -> LiveProductStudioScreen()
                        "Full Web Admin" -> LiveWebWorkspace(startPath="/admin/dashboard",onBack={openedModule=null})
                        "Web Product Studio" -> LiveWebWorkspace(startPath="/admin/products",onBack={openedModule=null})
                        "Customer Due Ledger" -> LiveWebWorkspace(startPath="/admin/customer-dues",onBack={openedModule=null})
                        "Advanced Web POS" -> LiveWebWorkspace(startPath="/admin/pos",onBack={openedModule=null})
                        "Profit Studio" -> ProfitCalculatorScreen(onBack = { openedModule = null })
                        "Sync Center" -> SyncCenterScreen(onBack = { openedModule = null })
                        "Live Business Cloud" -> LiveBusinessCloudScreen(onBack = { openedModule = null })
                        "Sales Intelligence", "Advanced POS" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "pos_sales")
                        "Purchase Center" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "purchases")
                        "Customers" -> LiveCustomer360Screen(onBack = { openedModule = null })
                        "Supplier Ledger" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "suppliers")
                        "Cash & Bank" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "cash_bank_transactions")
                        "Expenses" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "expenses")
                        "Inventory Radar" -> LiveBusinessCloudScreen(onBack = { openedModule = null }, initialTable = "product_variants")
                        "Customer 360" -> LiveCustomer360Screen(onBack = { openedModule = null })
                        else -> LiveBusinessCloudScreen(onBack = { openedModule = null })
                    }
                } else {
                    when (selected) {
                        "Home" -> LiveBusinessHub(onNavigate = { target ->
                            if (target == "Product Studio") { selected = "Products"; openedModule = null }
                            else openedModule = target
                        })
                        "Billing" -> LiveBusinessCloudScreen(onBack = { selected = "Home" }, initialTable = "pos_sales")
                        "Products" -> LiveProductStudioScreen()
                        "Insights" -> LiveBusinessCloudScreen(onBack = { selected = "Home" }, initialTable = "cash_bank_transactions")
                        else -> PremiumToolsScreen(onOpen = { openedModule = it })
                    }
                }
            }
        }
    }
}

@Composable private fun Header() {
    Column(
        Modifier.fillMaxWidth().background(Navy).padding(horizontal = 20.dp, vertical = 20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("NEW CITY STYLE", fontSize = 21.sp, color = Gold, fontWeight = FontWeight.Black)
                Text("UNIVERSAL PRO  •  NATIVE ANDROID", fontSize = 10.sp, color = Color.White)
            }
            Icon(Icons.Default.AutoAwesome, null, tint = Gold, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(8.dp))
        Text("Your business. One intelligent workspace.", color = Color.White.copy(alpha = .82f), fontSize = 12.sp)
    }
}

@Composable private fun DemoTag() {
    Surface(color = Color(0xFFFFF3DA), shape = RoundedCornerShape(24.dp)) {
        Text("DEMO MODE • NO LIVE FINANCIAL DATA", modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), color = Color(0xFF845600), fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable private fun HomeScreen(onOpen: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            DemoTag()
            Spacer(Modifier.height(18.dp))
            Text("Command Center", fontSize = 25.sp, color = Ink, fontWeight = FontWeight.ExtraBold)
            Text("Built for the way you run your store.", color = Color.Gray, fontSize = 12.sp)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricTile("Today's Sales", "—", "Live sync not connected", Modifier.weight(1f))
                MetricTile("Net Profit", "—", "Verification required", Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricTile("Customer Dues", "—", "Read-only planned", Modifier.weight(1f))
                MetricTile("Supplier Dues", "—", "Read-only planned", Modifier.weight(1f))
            }
        }
        item { Text("Quick Launch", fontSize = 20.sp, color = Ink, fontWeight = FontWeight.Bold) }
        items(modules.take(6)) { m -> ModuleCard(m, onOpen) }
    }
}

@Composable private fun MetricTile(title: String, value: String, detail: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(15.dp)) {
            Text(title, fontSize = 12.sp, color = Ink)
            Spacer(Modifier.height(10.dp))
            Text(value, color = Navy, fontSize = 27.sp, fontWeight = FontWeight.Black)
            Text(detail, fontSize = 10.sp, color = Color.Gray, lineHeight = 13.sp)
        }
    }
}

@Composable private fun ModuleCard(module: Module, onOpen: (String) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOpen(module.title) },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).background(Color(0xFFEDF2FC), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.AutoAwesome, null, tint = Navy)
            }
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f)) {
                Text(module.title, fontWeight = FontWeight.Bold, color = Ink)
                Text(module.subtitle, fontSize = 11.sp, color = Color.Gray)
            }
            Icon(Icons.Default.ChevronRight, null, tint = Navy)
        }
    }
}

@Composable private fun ModulesScreen(onOpen: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("All Business Tools", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink) }
        item { DemoTag() }
        items(modules) { m -> ModuleCard(m, onOpen) }
    }
}
@Composable private fun FeatureScreen(title: String, subtitle: String, actions: List<String>, onOpen: () -> Unit) {
    LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(title, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text(subtitle, color = Color.Gray, fontSize = 12.sp)
            Spacer(Modifier.height(12.dp))
            DemoTag()
        }
        items(actions) { action ->
            Card(Modifier.fillMaxWidth().clickable(onClick = onOpen), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(action, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
                    Icon(Icons.Default.ChevronRight, null, tint = Navy)
                }
            }
        }
    }
}
