package store.newcitystyle.universalpro

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val productBlue = Color(0xFF0A2E73)
private data class ProductPreview(
    val sku: String, val title: String, val brand: String, val color: String,
    val sizes: List<String>, val stock: Int, val purchase: Int, val mrp: Int, val price: Int
)
private val sampleInventory = listOf(
    ProductPreview("SH-001", "Signature Oxford Shirt", "NCS Studio", "Navy", listOf("M","L","XL"), 17, 360, 899, 699),
    ProductPreview("JN-018", "Modern Slim Denim", "NCS Denim", "Indigo", listOf("30","32","34"), 5, 710, 1499, 1199),
    ProductPreview("SR-042", "Classic Cotton Saree", "NCS Sarees", "Maroon", listOf("Free Size"), 3, 520, 1299, 999),
    ProductPreview("TS-105", "Essential Crewneck Tee", "NCS Active", "White", listOf("S","M","L"), 28, 220, 649, 449)
)
@Composable
fun ProductStudioScreen() {
    var search by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("All") }
    var selected by remember { mutableStateOf<ProductPreview?>(null) }
    val visible = sampleInventory.filter { p ->
        (filter == "All" || (filter == "Low Stock" && p.stock <= 5)) &&
            (search.isBlank() || listOf(p.title,p.sku,p.brand,p.color).any { it.contains(search, ignoreCase = true) })
    }
    Column(Modifier.fillMaxSize()) {
        if (selected != null) {
            val p = selected!!
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                TextButton(onClick = {selected = null}) {Text("← Product Studio")}
                Text(p.title, fontWeight = FontWeight.Black, fontSize = 24.sp, color = productBlue)
                Text("DEMO • " + p.sku + " • " + p.brand, fontSize = 12.sp)
                InfoLine("Color",p.color)
                InfoLine("Sizes",p.sizes.joinToString("  •  "))
                InfoLine("Stock",p.stock.toString())
                InfoLine("Purchase cost","₹" + p.purchase)
                InfoLine("MRP","₹" + p.mrp)
                InfoLine("Selling price","₹" + p.price)
                InfoLine("Gross margin per item (before expenses)","₹" + (p.price - p.purchase))
                Text("Read-only demo. Production variants and actual inventory not connected.", fontSize = 12.sp, color = Color.Gray)
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                item {
                    Text("Product Studio", fontSize = 26.sp, fontWeight = FontWeight.Black, color = productBlue)
                    Text("Native product & variant explorer", fontSize = 12.sp, color = Color.Gray)
                    Spacer(Modifier.height(10.dp))
                    Surface(color = Color(0xFFFFF3D8), shape = RoundedCornerShape(10.dp)) {
                        Text("SAMPLE INVENTORY ONLY — NO LIVE STOCK", Modifier.padding(10.dp), fontSize = 10.sp, color = Color(0xFF885900))
                    }
                }
                item {
                    OutlinedTextField(
                        value = search, onValueChange = { search = it },
                        placeholder = { Text("Search SKU, brand, color or name") },
                        leadingIcon = {Icon(Icons.Default.Search, null)},
                        modifier = Modifier.fillMaxWidth(), singleLine = true,
                        shape = RoundedCornerShape(14.dp)
                    )
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("All","Low Stock").forEach { name ->
                            FilterChip(selected = filter == name, onClick = {filter = name}, label = {Text(name)})
                        }
                    }
                }
                item {Text(visible.size.toString() + " sample products", fontWeight = FontWeight.SemiBold, color = productBlue)}
                items(visible, key = {it.sku}) { p ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable {selected = p},
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Inventory2, null, tint = productBlue)
                                Spacer(Modifier.width(8.dp))
                                Text(p.title, modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
                            }
                            Text(p.sku + " • " + p.brand + " • " + p.color, fontSize = 11.sp, color = Color.Gray)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("₹" + p.price, color = productBlue, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                                Spacer(Modifier.width(10.dp))
                                Text("MRP ₹" + p.mrp, fontSize = 11.sp, color = Color.Gray)
                                Spacer(Modifier.weight(1f))
                                Text("Stock " + p.stock, color = if (p.stock <= 5) Color(0xFFB74331) else Color(0xFF247D64), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
@Composable private fun InfoLine(k:String,v:String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Row(Modifier.fillMaxWidth().padding(15.dp)) {
            Text(k, modifier = Modifier.weight(1f), color = Color.Gray)
            Text(v, fontWeight = FontWeight.SemiBold)
        }
    }
}
