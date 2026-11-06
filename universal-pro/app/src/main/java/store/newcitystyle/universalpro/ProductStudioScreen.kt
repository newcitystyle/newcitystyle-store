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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private data class StudioProduct(val sku:String,val name:String,val brand:String,val category:String,val shade:String,val color:Color,val sizes:List<String>,val stock:Int,val cost:Int,val mrp:Int,val price:Int)
private val studioProducts=listOf(
    StudioProduct("SH-001","Signature Oxford Shirt","NCS Studio","Men","Royal Navy",Color(0xFF294D86),listOf("M","L","XL"),17,360,899,699),
    StudioProduct("JN-018","Modern Slim Denim","NCS Denim","Men","Indigo",Color(0xFF536CAA),listOf("30","32","34"),5,710,1499,1199),
    StudioProduct("SR-042","Classic Cotton Saree","NCS Sarees","Sarees","Wine",Color(0xFF97375D),listOf("Free Size"),3,520,1299,999),
    StudioProduct("TS-105","Essential Crewneck Tee","NCS Active","Men","Ivory",Color(0xFFE0DACA),listOf("S","M","L"),28,220,649,449),
    StudioProduct("KD-205","Kids Celebration Wear","NCS Kids","Kids","Coral",Color(0xFFDF8B97),listOf("4Y","6Y","8Y"),9,410,1099,799)
)
@Composable fun ProductStudioScreen() {
    var query by remember { mutableStateOf("") }
    var segment by remember { mutableStateOf("All") }
    var chosen by remember { mutableStateOf<StudioProduct?>(null) }
    var selectedSize by remember { mutableStateOf<String?>(null) }
    val low=studioProducts.count{it.stock<=5}
    val shown=studioProducts.filter{p->
        (segment=="All" || (segment=="Low Stock" && p.stock<=5) || p.category==segment) &&
        (query.isBlank() || listOf(p.name,p.brand,p.sku,p.shade).any{it.contains(query,true)})
    }
    Column(Modifier.fillMaxSize().background(ProBg)) {
        if(chosen!=null) {
            val p=chosen!!
            ProHero("Variant Lab","Detailed product intelligence",Icons.Default.Inventory2,ProGold)
            LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                item {TextButton(onClick={chosen=null;selectedSize=null}){Text("← Back to catalogue")}}
                item {
                    Card(shape=RoundedCornerShape(22.dp),colors=CardDefaults.cardColors(containerColor=Color.White)){
                        Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                Box(Modifier.size(70.dp).background(p.color.copy(alpha=.22f),RoundedCornerShape(17.dp)),contentAlignment=Alignment.Center){
                                    Icon(Icons.Default.Checkroom,null,tint=p.color,modifier=Modifier.size(35.dp))
                                }
                                Spacer(Modifier.width(13.dp))
                                Column {
                                    Text(p.name,fontSize=21.sp,color=ProInk,fontWeight=FontWeight.Black)
                                    Text(p.brand+"  •  "+p.sku,fontSize=11.sp,color=Color.Gray)
                                    ProPill(p.category,ProPurple)
                                }
                            }
                            HorizontalDivider()
                            Text("Available sizes",fontWeight=FontWeight.Bold,color=ProInk)
                            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                                p.sizes.forEach {size->
                                    FilterChip(selected=selectedSize==size,onClick={selectedSize=size},label={Text(size)})
                                }
                            }
                            Text("Variant: "+p.shade,color=ProInk)
                            Text("Stock (sample): "+p.stock,color=if(p.stock<=5)ProCoral else ProTeal,fontWeight=FontWeight.Bold)
                        }
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        ProStat("Purchase","₹"+p.cost,"Sample cost",Icons.Default.ShoppingBag,ProOrange,Modifier.weight(1f))
                        ProStat("Selling","₹"+p.price,"Sample price",Icons.Default.Sell,ProTeal,Modifier.weight(1f))
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        ProStat("MRP","₹"+p.mrp,"Product MRP",Icons.Default.LocalOffer,ProSky,Modifier.weight(1f))
                        ProStat("Gross Gain","₹"+(p.price-p.cost),"Before expenses",Icons.Default.AutoGraph,ProPurple,Modifier.weight(1f))
                    }
                }
                item { ProPill("DEMO VARIANTS • NO INVENTORY CHANGES",ProOrange) }
            }
        } else {
            ProHero("Product Studio","Colors, variants, stock & profitability",Icons.Default.Style,ProGold)
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                        ProStat("Catalogue",studioProducts.size.toString(),"Sample products",Icons.Default.Inventory2,ProSky,Modifier.weight(1f))
                        ProStat("Low Stock",low.toString(),"Attention needed",Icons.Default.WarningAmber,ProCoral,Modifier.weight(1f))
                    }
                }
                item {
                    ProPill("DESIGN PREVIEW • STOCK NOT CONNECTED",ProOrange)
                    Spacer(Modifier.height(13.dp))
                    OutlinedTextField(
                        query,{query=it},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        placeholder={Text("Barcode, SKU, name or color")},
                        leadingIcon={Icon(Icons.Default.Search,null)},shape=RoundedCornerShape(16.dp)
                    )
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                        listOf("All","Men","Kids","Sarees","Low Stock").forEach {item->
                            FilterChip(selected=segment==item,onClick={segment=item},label={Text(item)})
                        }
                    }
                }
                item {Text("Product Explorer",fontSize=20.sp,fontWeight=FontWeight.Black,color=ProInk)}
                items(shown,key={it.sku}){p->
                    Card(
                        modifier=Modifier.fillMaxWidth().clickable{chosen=p;selectedSize=null},
                        colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(20.dp)
                    ){
                        Column {
                            Box(Modifier.fillMaxWidth().height(5.dp).background(Brush.horizontalGradient(listOf(p.color,ProPurple,ProSky))))
                            Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                                Box(Modifier.size(65.dp).background(p.color.copy(alpha=.16f),RoundedCornerShape(16.dp)),contentAlignment=Alignment.Center){
                                    Icon(Icons.Default.Checkroom,null,tint=p.color,modifier=Modifier.size(30.dp))
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)){
                                    Text(p.name,fontWeight=FontWeight.Bold,color=ProInk,fontSize=15.sp)
                                    Text(p.brand+"  •  "+p.sku,fontSize=10.sp,color=Color.Gray)
                                    Spacer(Modifier.height(4.dp))
                                    Text("₹"+p.price,fontSize=21.sp,color=ProBlue,fontWeight=FontWeight.Black)
                                    Text("MRP ₹"+p.mrp+"  |  Gross gain ₹"+(p.price-p.cost),fontSize=10.sp,color=Color.Gray)
                                }
                                Column(horizontalAlignment=Alignment.End){
                                    ProPill("STOCK "+p.stock,if(p.stock<=5)ProCoral else ProTeal)
                                    Spacer(Modifier.height(8.dp))
                                    Icon(Icons.Default.ArrowForward,null,tint=ProBlue)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
