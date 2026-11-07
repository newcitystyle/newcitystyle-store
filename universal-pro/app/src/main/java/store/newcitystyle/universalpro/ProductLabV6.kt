package store.newcitystyle.universalpro

import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

private data class LabItem(
    val sku: String, val name: String, val brand: String, val category: String,
    val color: String, val sizes: String, val cost: Int, val mrp: Int,
    val price: Int, val stock: Int
)
private val initialLab = listOf(
    LabItem("NCS-DEMO-101","Signature Oxford Shirt","NCS Studio","Men","Royal Navy","M,L,XL",360,899,699,17),
    LabItem("NCS-DEMO-102","Modern Slim Denim","NCS Denim","Men","Indigo","30,32,34",710,1499,1199,5),
    LabItem("NCS-DEMO-103","Classic Cotton Saree","NCS Sarees","Sarees","Wine","Free Size",520,1299,999,3),
    LabItem("NCS-DEMO-104","Essential Crewneck Tee","NCS Active","Men","Ivory","S,M,L",220,649,449,28),
    LabItem("NCS-DEMO-105","Kids Celebration Wear","NCS Kids","Kids","Coral","4Y,6Y,8Y",410,1099,799,9)
)
private const val PREF_NAME="ncs_universal_pro_v6_demo_lab"
private fun parseLab(ctx: Context): List<LabItem> {
    val saved=ctx.getSharedPreferences(PREF_NAME,Context.MODE_PRIVATE).getString("items",null) ?: return initialLab
    return try {
        val a=JSONArray(saved)
        (0 until a.length()).map { i ->
            val p=a.getJSONObject(i)
            LabItem(
                p.getString("sku"),p.getString("name"),p.getString("brand"),
                p.getString("category"),p.getString("color"),p.getString("sizes"),
                p.getInt("cost"),p.getInt("mrp"),p.getInt("price"),p.getInt("stock")
            )
        }
    } catch (_: Exception) { initialLab }
}
private fun saveLab(ctx:Context, list:List<LabItem>) {
    val a=JSONArray()
    list.forEach { p -> a.put(JSONObject().apply{
        put("sku",p.sku);put("name",p.name);put("brand",p.brand)
        put("category",p.category);put("color",p.color);put("sizes",p.sizes)
        put("cost",p.cost);put("mrp",p.mrp);put("price",p.price);put("stock",p.stock)
    })}
    ctx.getSharedPreferences(PREF_NAME,Context.MODE_PRIVATE).edit().putString("items",a.toString()).apply()
}
private val labNavy=Color(0xFF0A2E73)
private val labTeal=Color(0xFFD4AF37)
private val labGold=Color(0xFFF8F4EC)
private val labPurple=Color(0xFF3768BC)

@Composable
fun ProductLabV6() {
    val context=LocalContext.current
    val catalogue=remember { mutableStateListOf<LabItem>().apply{addAll(parseLab(context))} }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    var selected by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<String?>(null) }
    var creating by remember { mutableStateOf(false) }
    var confirmReset by remember { mutableStateOf(false) }
    var photoMode by remember { mutableStateOf(false) }
    val record=catalogue.firstOrNull {it.sku==selected}
    val low=catalogue.count{it.stock in 1..5}
    val out=catalogue.count{it.stock==0}
    val visible=catalogue.filter {p->
        (category=="All" || (category=="Low" && p.stock in 1..5) ||
            (category=="Out" && p.stock==0) || p.category==category) &&
            (search.isBlank() || listOf(p.name,p.brand,p.sku,p.color,p.sizes).any{it.contains(search,true)})
    }
    Column(Modifier.fillMaxSize().background(Color(0xFF071F4B))) {
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(Color(0xFF0A2E73),Color(0xFF2758A0))))
                .padding(horizontal=16.dp,vertical=17.dp),verticalAlignment=Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text("PRODUCT INTELLIGENCE",color=labNavy,fontSize=9.sp,fontWeight=FontWeight.Black,letterSpacing=1.sp)
                Text("Advanced Product Studio",color=Color.White,fontSize=22.sp,fontWeight=FontWeight.Black)
                Text("NATIVE LAB  /  OFFLINE DEMO",color=labGold,fontSize=10.sp,fontWeight=FontWeight.Bold)
            }
            IconButton(onClick={creating=true;editing=null;selected=null}){
                Icon(Icons.Default.AddCircle,null,tint=Color.White,modifier=Modifier.size(28.dp))
            }
        }
        if(photoMode){
            PhotoProductIntakeV6(onBack={photoMode=false},onManualDraft={photoMode=false;creating=true;editing=null})
        } else if(creating||editing!=null){
            val old=catalogue.firstOrNull{it.sku==editing}
            LabEditor(
                original=old,
                onBack={creating=false;editing=null},
                onSave={product ->
                    if(old==null) catalogue.add(product)
                    else {
                        val index=catalogue.indexOfFirst{it.sku==old.sku}
                        if(index>=0) catalogue[index]=product
                    }
                    saveLab(context,catalogue)
                    creating=false;editing=null;selected=product.sku
                },
                existingCodes=catalogue.filter{it.sku!=old?.sku}.map{it.sku}
            )
        } else if(record!=null) {
            LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp)) {
                item {
                    TextButton(onClick={selected=null}){Text("← Product Explorer",color=labTeal)}
                    LabSurface {
                        Text(record.name,fontSize=23.sp,fontWeight=FontWeight.Black,color=Color.White)
                        Text(record.brand+"  •  "+record.sku,color=labGold,fontSize=12.sp)
                        Text(record.category+" / "+record.color,color=Color.White.copy(alpha=.7f))
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        LabMetric("STOCK",record.stock.toString(),labTeal,Modifier.weight(1f))
                        LabMetric("MARGIN","₹"+(record.price-record.cost),labGold,Modifier.weight(1f))
                    }
                }
                item {
                    LabSurface {
                        Text("SIZE / COLOR INTELLIGENCE",fontWeight=FontWeight.Bold,color=labGold)
                        Text("Color: "+record.color,color=Color.White)
                        Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                            record.sizes.split(",").forEach {s->
                                Surface(color=labPurple.copy(alpha=.3f),shape=RoundedCornerShape(10.dp)){
                                    Text(s.trim(),Modifier.padding(horizontal=12.dp,vertical=8.dp),color=Color.White,fontSize=12.sp)
                                }
                            }
                        }
                        HorizontalDivider(color=Color.White.copy(alpha=.14f))
                        Text("Purchase Cost: ₹"+record.cost,color=Color.White)
                        Text("MRP: ₹"+record.mrp,color=Color.White)
                        Text("Selling Price: ₹"+record.price,color=labTeal,fontWeight=FontWeight.Bold)
                        Text("Gross gain per item: ₹"+(record.price-record.cost),color=labGold)
                    }
                }
                item {
                    Button(onClick={editing=record.sku},modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=labTeal)){
                        Icon(Icons.Default.Edit,null);Spacer(Modifier.width(8.dp));Text("Edit Product & Variants",color=labNavy,fontWeight=FontWeight.Black)
                    }
                }
                item {Text("Changes are saved only in this separate demo app, never to Desktop or Supabase.",color=Color.White.copy(alpha=.65f),fontSize=11.sp)}
            }
        } else {
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF173B74)),shape=RoundedCornerShape(18.dp),modifier=Modifier.fillMaxWidth().clickable{photoMode=true}) {
                        Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically){
                            Icon(Icons.Default.AddAPhoto,null,tint=labGold,modifier=Modifier.size(28.dp))
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)){
                                Text("AI PHOTO PRODUCT STUDIO",color=Color.White,fontWeight=FontWeight.Black,fontSize=14.sp)
                                Text("Photo-first entry and product approval workflow",color=labTeal,fontSize=10.sp)
                            }
                            Icon(Icons.Default.ArrowForward,null,tint=labGold)
                        }
                    }
                }
                item {
                    LabSurface {
                        Text("PRODUCT INTELLIGENCE  •  LOCAL",color=labTeal,fontSize=11.sp,fontWeight=FontWeight.Black)
                        Text("Know your stock before it becomes a problem.",color=Color.White,fontSize=12.sp)
                        Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
                            LabMetric("PRODUCTS",catalogue.size.toString(),labTeal,Modifier.weight(1f))
                            LabMetric("LOW",low.toString(),labGold,Modifier.weight(1f))
                            LabMetric("OUT",out.toString(),Color(0xFFFF7987),Modifier.weight(1f))
                        }
                    }
                }
                item {
                    OutlinedTextField(
                        search,{search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        placeholder={Text("Search barcode, size, color, brand")},
                        leadingIcon={Icon(Icons.Default.Search,null,tint=labTeal)},
                        colors=OutlinedTextFieldDefaults.colors(
                            focusedTextColor=Color.White,unfocusedTextColor=Color.White,
                            focusedBorderColor=labTeal,unfocusedBorderColor=Color.White.copy(alpha=.5f),
                            focusedPlaceholderColor=Color.White.copy(alpha=.55f),
                            unfocusedPlaceholderColor=Color.White.copy(alpha=.55f)
                        ),shape=RoundedCornerShape(16.dp)
                    )
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                        listOf("All","Men","Women","Kids","Sarees","Low","Out").forEach{c->
                            FilterChip(selected=category==c,onClick={category=c},label={Text(c)},
                                colors=FilterChipDefaults.filterChipColors(selectedContainerColor=labTeal))
                        }
                    }
                }
                item {
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Text("PRODUCT EXPLORER",color=Color.White,fontSize=17.sp,fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
                        Text(visible.size.toString()+" found",color=labTeal,fontSize=12.sp)
                    }
                }
                items(visible,key={it.sku}){p->
                    Card(
                        modifier=Modifier.fillMaxWidth().clickable{selected=p.sku},
                        colors=CardDefaults.cardColors(containerColor=Color(0xFF173B74)),
                        shape=RoundedCornerShape(20.dp)
                    ) {
                        Column {
                            Box(Modifier.fillMaxWidth().height(4.dp).background(Brush.horizontalGradient(listOf(labTeal,labPurple,labGold))))
                            Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
                                Box(Modifier.size(56.dp).background(labTeal.copy(alpha=.13f),RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){
                                    Icon(Icons.Default.Inventory2,null,tint=labTeal,modifier=Modifier.size(29.dp))
                                }
                                Spacer(Modifier.width(11.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(p.name,color=Color.White,fontWeight=FontWeight.Bold,fontSize=15.sp)
                                    Text(p.brand+" • "+p.category,color=Color.White.copy(alpha=.58f),fontSize=10.sp)
                                    Spacer(Modifier.height(4.dp))
                                    Text("₹"+p.price,color=labTeal,fontWeight=FontWeight.Black,fontSize=20.sp)
                                    Text("MRP ₹"+p.mrp+"  |  "+p.sizes,color=Color.White.copy(alpha=.65f),fontSize=10.sp,maxLines=1)
                                }
                                Column(horizontalAlignment=Alignment.End){
                                    Text("STOCK "+p.stock,color=if(p.stock<=5)labGold else labTeal,fontSize=10.sp,fontWeight=FontWeight.Black)
                                    Spacer(Modifier.height(12.dp))
                                    Icon(Icons.Default.ChevronRight,null,tint=labGold)
                                }
                            }
                            Text("     "+p.sku+"   •   "+p.color,Modifier.padding(bottom=11.dp),color=Color.White.copy(alpha=.5f),fontSize=10.sp)
                        }
                    }
                }
                item {
                    OutlinedButton(onClick={confirmReset=true},modifier=Modifier.fillMaxWidth()){
                        Icon(Icons.Default.RestartAlt,null);Spacer(Modifier.width(7.dp));Text("Reset demo catalogue")
                    }
                }
            }
        }
        if(confirmReset) {
            AlertDialog(
                onDismissRequest={confirmReset=false},title={Text("Reset demo products?")},
                text={Text("This replaces your local test edits with sample products. Business data is unaffected.")},
                confirmButton={TextButton(onClick={catalogue.clear();catalogue.addAll(initialLab);saveLab(context,catalogue);confirmReset=false}){Text("Reset demo")}},
                dismissButton={TextButton(onClick={confirmReset=false}){Text("Cancel")}}
            )
        }
    }
}
@Composable private fun LabMetric(label:String,value:String,tint:Color,modifier:Modifier){
    Column(modifier.background(Color.White.copy(alpha=.055f),RoundedCornerShape(13.dp)).padding(10.dp)){
        Text(label,color=Color.White.copy(alpha=.55f),fontSize=9.sp,fontWeight=FontWeight.Bold)
        Text(value,color=tint,fontSize=21.sp,fontWeight=FontWeight.Black)
    }
}
@Composable private fun LabSurface(content:@Composable ColumnScope.()->Unit){
    Column(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF12366F),Color(0xFF204D91))),RoundedCornerShape(21.dp)).padding(17.dp),verticalArrangement=Arrangement.spacedBy(11.dp),content=content)
}
@Composable private fun LabEditor(
    original: LabItem?, existingCodes:List<String>, onBack:()->Unit, onSave:(LabItem)->Unit
) {
    var sku by remember(original?.sku){mutableStateOf(original?.sku?:"")}
    var name by remember(original?.sku){mutableStateOf(original?.name?:"")}
    var brand by remember(original?.sku){mutableStateOf(original?.brand?:"")}
    var category by remember(original?.sku){mutableStateOf(original?.category?:"Men")}
    var color by remember(original?.sku){mutableStateOf(original?.color?:"")}
    var sizes by remember(original?.sku){mutableStateOf(original?.sizes?:"")}
    var cost by remember(original?.sku){mutableStateOf(original?.cost?.toString()?:"")}
    var mrp by remember(original?.sku){mutableStateOf(original?.mrp?.toString()?:"")}
    var price by remember(original?.sku){mutableStateOf(original?.price?.toString()?:"")}
    var stock by remember(original?.sku){mutableStateOf(original?.stock?.toString()?:"")}
    val amounts=listOf(cost,mrp,price,stock).map{it.toIntOrNull()}
    val valid=sku.isNotBlank()&&name.isNotBlank()&&sizes.isNotBlank()&&
        sku !in existingCodes&&amounts.all{it!=null&&it>=0}&&
        (amounts[2]?:0)<=(amounts[1]?:0)
    LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){
        item {TextButton(onClick=onBack){Text("← Product Explorer",color=labTeal)}}
        item {Text(if(original==null)"CREATE PRODUCT" else "EDIT PRODUCT",fontSize=25.sp,color=Color.White,fontWeight=FontWeight.Black)}
        item {Text("Saves only inside Universal Pro V6 demo storage.",color=labGold,fontSize=11.sp)}
        item {LabInput("Barcode / SKU",sku,{sku=it},enabled=original==null)}
        item {LabInput("Product Name",name,{name=it})}
        item {LabInput("Brand",brand,{brand=it})}
        item {
            Text("CATEGORY",color=Color.White,fontWeight=FontWeight.Bold,fontSize=11.sp)
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                listOf("Men","Women","Kids","Sarees","Other").forEach{c->
                    FilterChip(selected=category==c,onClick={category=c},label={Text(c)})
                }
            }
        }
        item {LabInput("Color",color,{color=it})}
        item {LabInput("Sizes (comma separated)",sizes,{sizes=it})}
        item {LabInput("Purchase Cost ₹",cost,{cost=it.filter(Char::isDigit)})}
        item {LabInput("MRP ₹",mrp,{mrp=it.filter(Char::isDigit)})}
        item {LabInput("Selling Price ₹",price,{price=it.filter(Char::isDigit)})}
        item {LabInput("Stock Quantity",stock,{stock=it.filter(Char::isDigit)})}
        item {
            Text("Gross gain: "+if(amounts[0]!=null&&amounts[2]!=null)"₹"+((amounts[2]?:0)-(amounts[0]?:0)) else "—",color=labTeal,fontWeight=FontWeight.Bold)
        }
        item {
            Button(
                enabled=valid, modifier=Modifier.fillMaxWidth(),
                colors=ButtonDefaults.buttonColors(containerColor=labTeal),
                onClick={onSave(LabItem(sku.trim(),name.trim(),brand.trim(),category,color.trim(),sizes.trim(),
                    amounts[0]?:0,amounts[1]?:0,amounts[2]?:0,amounts[3]?:0))}
            ){Icon(Icons.Default.Save,null);Spacer(Modifier.width(8.dp));Text("SAVE LOCAL DEMO PRODUCT",color=labNavy,fontWeight=FontWeight.Bold)}
        }
        item {Text("Validation: unique SKU, quantity ≥ 0 and selling price ≤ MRP.",color=Color.White.copy(alpha=.58f),fontSize=11.sp)}
    }
}
@Composable private fun LabInput(label:String,value:String,onChange:(String)->Unit,enabled:Boolean=true){
    OutlinedTextField(
        value,onChange,modifier=Modifier.fillMaxWidth(),label={Text(label)},singleLine=true,
        enabled=enabled,colors=OutlinedTextFieldDefaults.colors(
            focusedTextColor=Color.White,unfocusedTextColor=Color.White,
            focusedLabelColor=labTeal,unfocusedLabelColor=Color.White.copy(alpha=.75f),
            focusedBorderColor=labTeal,unfocusedBorderColor=Color.White.copy(alpha=.4f)
        )
    )
}
