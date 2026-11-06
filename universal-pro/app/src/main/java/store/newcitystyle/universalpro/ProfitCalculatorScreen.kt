package store.newcitystyle.universalpro

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.math.BigDecimal
import java.math.RoundingMode

private val profitNavy = Color(0xFF0A2E73)
private fun parseAmount(value: String): BigDecimal? =
    value.trim().takeIf { it.isNotEmpty() }?.toBigDecimalOrNull()?.takeIf { it >= BigDecimal.ZERO }
private fun asMoney(value: BigDecimal): String =
    "₹" + value.setScale(2, RoundingMode.HALF_UP).toPlainString()

@Composable
fun ProfitCalculatorScreen(onBack: () -> Unit) {
    var purchase by remember { mutableStateOf("") }
    var selling by remember { mutableStateOf("") }
    var count by remember { mutableStateOf("1") }

    val buy = parseAmount(purchase)
    val sale = parseAmount(selling)
    val quantity = count.toIntOrNull()?.takeIf { it in 1..100000 }
    val valid = buy != null && sale != null && quantity != null
    val profit = if (valid) (sale!! - buy!!) * BigDecimal(quantity!!) else null
    val margin = if (valid && sale!! > BigDecimal.ZERO) {
        (sale - buy!!) * BigDecimal(100) / sale
    } else null

    Column(modifier = Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        TextButton(onClick = onBack) { Text("← Finance Studio") }
        Text("Profit Reactor", color = profitNavy, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold)
        Text("Instant local calculation. Nothing is saved or synced.", color = Color.Gray, fontSize = 12.sp)
        OutlinedTextField(
            value = purchase, onValueChange = { purchase = it },
            label = { Text("Purchase price (₹)") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
        )
        OutlinedTextField(
            value = selling, onValueChange = { selling = it },
            label = { Text("Selling price (₹)") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
        )
        OutlinedTextField(
            value = count, onValueChange = { count = it },
            label = { Text("Quantity") }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("Gross item profit", color = Color.Gray)
                Text(
                    if (profit != null) asMoney(profit) else "—",
                    fontSize = 31.sp, fontWeight = FontWeight.Black,
                    color = if (profit != null && profit < BigDecimal.ZERO) Color(0xFFC3413B) else profitNavy
                )
                Text(
                    "Margin on sales: " + (margin?.setScale(2, RoundingMode.HALF_UP)?.toPlainString()?.plus("%") ?: "—"),
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        if (!valid) Text("Enter valid non-negative prices and quantity (1–100000).", color = Color.Gray, fontSize = 12.sp)
        Text(
            "Estimate only: excludes GST, discounts, returns, wages and overheads. Quick-item profits are not included in actual financial reports.",
            fontSize = 11.sp, color = Color.Gray
        )
    }
}
