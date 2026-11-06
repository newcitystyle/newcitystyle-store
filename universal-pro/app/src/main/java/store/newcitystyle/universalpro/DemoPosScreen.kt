package store.newcitystyle.universalpro

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale

private val primaryBlue = Color(0xFF0A2E73)
private data class DemoProduct(val sku: String, val name: String, val size: String, val price: Int)
private val demoProducts = listOf(
    DemoProduct("DEMO-SH01", "Classic Cotton Shirt", "L", 649),
    DemoProduct("DEMO-JN02", "Denim Jeans", "32", 1099),
    DemoProduct("DEMO-TS03", "Essential T-Shirt", "M", 399),
    DemoProduct("DEMO-SR04", "Festive Saree", "Free Size", 1499)
)
private fun money(v: Int) = "₹" + NumberFormat.getIntegerInstance(Locale("en", "IN")).format(v)

@Composable
fun DemoPosScreen() {
    val cart = remember { mutableStateMapOf<String, Int>() }
    val total = demoProducts.sumOf { it.price * (cart[it.sku] ?: 0) }
    val count = cart.values.sum()
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().background(primaryBlue).padding(horizontal = 18.dp, vertical = 13.dp)) {
            Text("SMART POS • DEMO", color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text("Try the native billing flow", color = Color.White, fontSize = 12.sp)
        }
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Surface(color = Color(0xFFFFF2D4), shape = RoundedCornerShape(12.dp)) {
                    Text("TEST CATALOG ONLY • NOT A REAL BILL", Modifier.padding(12.dp), fontSize = 11.sp, color = Color(0xFF805600), fontWeight = FontWeight.Bold)
                }
            }
            items(demoProducts, key = { it.sku }) { p ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                    Row(Modifier.padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(p.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text(p.sku + "  •  " + p.size, fontSize = 10.sp, color = Color.Gray)
                            Spacer(Modifier.height(6.dp))
                            Text(money(p.price), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = primaryBlue)
                        }
                        val qty = cart[p.sku] ?: 0
                        if (qty > 0) {
                            IconButton(onClick = { if (qty == 1) cart.remove(p.sku) else cart[p.sku] = qty - 1 }) {
                                Icon(Icons.Default.Remove, "Remove")
                            }
                            Text(qty.toString(), fontWeight = FontWeight.Bold)
                        }
                        IconButton(onClick = { cart[p.sku] = qty + 1 }) {
                            Icon(Icons.Default.Add, "Add", tint = primaryBlue)
                        }
                    }
                }
            }
        }
        Surface(shadowElevation = 12.dp, color = Color.White) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Cart • $count items", modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                    Text(money(total), color = primaryBlue, fontSize = 23.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.height(8.dp))
                Text("No save, payment, printer, stock adjustment or cloud request.", fontSize = 11.sp, color = Color.Gray)
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { cart.clear() },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = cart.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = primaryBlue),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.DeleteOutline, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Clear Demo Cart")
                }
            }
        }
    }
}
