package store.newcitystyle.universalpro

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val tools = listOf(
    "Sales History" to "Bill records, corrections and returns",
    "Profit Studio" to "Purchase price versus selling price",
    "Customer Dues" to "Outstanding credit and collections",
    "Supplier Dues" to "Purchases, payments and opening adjustments",
    "Cash / UPI" to "Payment methods and cashbook",
    "Expenses" to "Business expense categories",
    "Purchase History" to "Supplier inward and payments",
    "Returns & Exchange" to "Bill-linked adjustments"
)

@Composable fun FinanceStudioScreen() {
    var selected by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    val navy = Color(0xFF0A2E73)
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (selected == "Profit Studio") {
            ProfitCalculatorScreen(onBack = { selected = null })
        } else if (selected != null) {
            OperationalStudioScreen(when(selected) {
                "Sales History" -> "Sales Intelligence"
                "Customer Dues" -> "Customers"
                "Supplier Dues" -> "Supplier Ledger"
                "Cash / UPI", "Expenses" -> "Cash & Bank"
                "Purchase History" -> "Purchase Center"
                else -> selected!!
            }, onBack = { selected = null })
        } else {
            Text("Finance Studio", fontSize = 25.sp, color = navy, fontWeight = FontWeight.Bold)
            Text("DEMO MODE • No real account values", fontSize = 11.sp, color = Color.Gray)
            OutlinedTextField(query, {query = it}, label = {Text("Search tools")}, singleLine = true, modifier = Modifier.fillMaxWidth())
            LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                items(tools.filter { it.first.contains(query,true) || it.second.contains(query,true) }) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { selected = item.first },
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(15.dp)
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(item.first, color = navy, fontWeight = FontWeight.Bold)
                            Text(item.second, fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
