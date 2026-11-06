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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale

private val posBlue = Color(0xFF0A2E73)
private val posGold = Color(0xFFD4AF37)
private data class PosItem(val id: String, val name: String, val category: String, val variant: String, val price: Int, val stock: Int)
private val posSamples = listOf(
    PosItem("D-SH01","Classic Cotton Shirt","Men","Navy / L",649,18),
    PosItem("D-JN02","Premium Denim Jeans","Men","Indigo / 32",1099,9),
    PosItem("D-TS03","Essential T-Shirt","Men","Black / M",399,24),
    PosItem("D-SR04","Kanchipuram Style Saree","Sarees","Maroon / Free",1499,5),
    PosItem("D-KD05","Kids Party Dress","Kids","Pink / 6Y",899,12),
    PosItem("D-LG06","Comfort Leggings","Women","Blue / XL",349,20)
)
private fun rupees(n:Int)="₹"+NumberFormat.getIntegerInstance(Locale("en","IN")).format(n)

@Composable
fun DemoPosScreen() {
    val quantities = remember { mutableStateMapOf<String,Int>() }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    var customer by remember { mutableStateOf("Walk-in Customer") }
    var discount by remember { mutableStateOf("0") }
    var payMethod by remember { mutableStateOf("Cash") }
    var cartView by remember { mutableStateOf(false) }
    var preview by remember { mutableStateOf(false) }
    val units=quantities.values.sum()
    val sub=posSamples.sumOf { it.price*(quantities[it.id]?:0) }
    val disc=(discount.toIntOrNull()?:0).coerceIn(0,sub)
    val total=sub-disc
    val filtered=posSamples.filter { (category=="All" || it.category==category) && (search.isBlank() || it.name.contains(search,true)||it.id.contains(search,true)||it.variant.contains(search,true)) }
    Column(Modifier.fillMaxSize().background(Color(0xFFF4F6FB))) {
        Row(Modifier.fillMaxWidth().padding(horizontal=15.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("SMART POS",fontSize=22.sp,fontWeight=FontWeight.Black,color=posBlue)
                Text("Express counter  •  offline design",fontSize=11.sp,color=Color.Gray)
            }
            Surface(color=Color(0xFFFFEBC3),shape=RoundedCornerShape(12.dp)) {Text("DEMO",Modifier.padding(9.dp),fontSize=10.sp,fontWeight=FontWeight.Bold)}
            IconButton(onClick={cartView=!cartView}){BadgedBox(badge={if(units>0) Badge{Text(units.toString())}}){Icon(Icons.Default.ShoppingCart,null,tint=posBlue)}}
        }
        if(preview) {
            LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                item { Text("Bill Preview",fontSize=25.sp,fontWeight=FontWeight.Bold,color=posBlue) }
                item { Text("SIMULATION ONLY — no receipt is saved or transmitted",fontSize=11.sp,color=Color(0xFFB26020)) }
                item {Text("Customer: "+customer,fontWeight=FontWeight.Medium)}
                items(posSamples.filter{(quantities[it.id]?:0)>0}){p->
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(p.name+" × "+quantities[p.id]);Text(rupees(p.price*(quantities[p.id]?:0)))}
                }
                item {HorizontalDivider();Text("Subtotal "+rupees(sub));Text("Discount "+rupees(disc));Text("Payment "+payMethod);Text("Grand Total "+rupees(total),fontSize=24.sp,fontWeight=FontWeight.Black,color=posBlue)}
                item {Button(onClick={preview=false},modifier=Modifier.fillMaxWidth()){Text("Back to bill")}}
            }
        } else if(cartView){
            LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){
                item {Text("Current Bill",fontSize=23.sp,fontWeight=FontWeight.Bold,color=posBlue)}
                item {OutlinedTextField(customer,{customer=it},label={Text("Customer name")},singleLine=true,modifier=Modifier.fillMaxWidth())}
                items(posSamples.filter{(quantities[it.id]?:0)>0}){p->
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White)){
                        Row(Modifier.fillMaxWidth().padding(12.dp),verticalAlignment=Alignment.CenterVertically){
                            Column(Modifier.weight(1f)){Text(p.name,fontWeight=FontWeight.Bold);Text(rupees(p.price)+" • "+p.variant,fontSize=11.sp)}
                            IconButton(onClick={val q=quantities[p.id]?:0;if(q<=1)quantities.remove(p.id) else quantities[p.id]=q-1}){Icon(Icons.Default.Remove,null)}
                            Text((quantities[p.id]?:0).toString())
                            IconButton(onClick={val q=quantities[p.id]?:0;if(q<p.stock) quantities[p.id]=q+1}){Icon(Icons.Default.Add,null)}
                        }
                    }
                }
                item {OutlinedTextField(discount,{discount=it.filter(Char::isDigit).take(7)},label={Text("Flat discount ₹")},singleLine=true,modifier=Modifier.fillMaxWidth())}
                item {
                    Text("Payment method",fontWeight=FontWeight.Bold)
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                        listOf("Cash","UPI","Card","Credit").forEach{p->
                            FilterChip(selected=payMethod==p,onClick={payMethod=p},label={Text(p,fontSize=10.sp)})
                        }
                    }
                }
                item {
                    Button(enabled=units>0,onClick={preview=true},modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=posBlue)){
                        Icon(Icons.Default.Receipt,null);Spacer(Modifier.width(8.dp));Text("Preview Bill • "+rupees(total))
                    }
                }
            }
        } else {
            OutlinedTextField(search,{search=it},placeholder={Text("Search barcode, item, size, color")},leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth().padding(horizontal=15.dp),singleLine=true,shape=RoundedCornerShape(15.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(12.dp),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                listOf("All","Men","Women","Kids","Sarees").forEach{c->FilterChip(selected=category==c,onClick={category=c},label={Text(c)})}
            }
            LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(horizontal=15.dp,vertical=3.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                items(filtered,key={it.id}){p->
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(16.dp)){
                        Row(Modifier.fillMaxWidth().padding(13.dp),verticalAlignment=Alignment.CenterVertically){
                            Column(Modifier.weight(1f)) {
                                Text(p.name,fontWeight=FontWeight.Bold,fontSize=14.sp)
                                Text(p.id+" • "+p.variant,fontSize=10.sp,color=Color.Gray)
                                Text(rupees(p.price),fontSize=19.sp,fontWeight=FontWeight.Black,color=posBlue)
                                Text("Sample stock "+p.stock,fontSize=10.sp,color=Color(0xFF17836A))
                            }
                            val q=quantities[p.id]?:0
                            if(q>0){
                                IconButton(onClick={if(q==1)quantities.remove(p.id) else quantities[p.id]=q-1}){Icon(Icons.Default.Remove,null)}
                                Text(q.toString(),fontWeight=FontWeight.Bold)
                            }
                            FilledTonalIconButton(onClick={if(q<p.stock)quantities[p.id]=q+1},colors=IconButtonDefaults.filledTonalIconButtonColors(containerColor=Color(0xFFEAF0FF))){
                                Icon(Icons.Default.Add,null,tint=posBlue)
                            }
                        }
                    }
                }
            }
        }
        Surface(shadowElevation=7.dp,color=Color.White){
            Row(Modifier.fillMaxWidth().padding(horizontal=15.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically){
                Column(Modifier.weight(1f)){
                    Text(units.toString()+" items • "+rupees(total),fontSize=19.sp,fontWeight=FontWeight.Black,color=posBlue)
                    Text("No live payment or stock change",fontSize=10.sp,color=Color.Gray)
                }
                Button(onClick={cartView=!cartView;preview=false},colors=ButtonDefaults.buttonColors(containerColor=posBlue)){
                    Text(if(cartView)"Catalog" else "Review Bill")
                }
            }
        }
    }
}
