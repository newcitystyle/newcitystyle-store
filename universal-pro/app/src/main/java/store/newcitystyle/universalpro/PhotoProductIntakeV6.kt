package store.newcitystyle.universalpro

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

private val aqua = Color(0xFFD4AF37)
private val amber = Color(0xFFF8F4EC)
private val panel = Color(0xFF173B74)
private val ink = Color(0xFF0A2E73)

@Composable
fun PhotoProductIntakeV6(onBack: () -> Unit, onManualDraft: () -> Unit) {
    val context=LocalContext.current
    var photo by remember { mutableStateOf<Uri?>(null) }
    var price by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("NEW CITY STYLE") }
    var category by remember { mutableStateOf("Men") }
    var size by remember { mutableStateOf("") }
    var material by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("") }
    var approved by remember { mutableStateOf(false) }
    var showCopyNotice by remember { mutableStateOf(false) }
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) {uri->photo=uri;approved=false}
    val bitmap=remember(photo) {
        photo?.let {uri->
            try {
                context.contentResolver.openInputStream(uri)?.use {s->
                    BitmapFactory.decodeStream(s,null,BitmapFactory.Options().apply{inSampleSize=2})?.asImageBitmap()
                }
            } catch (_:Exception){null}
        }
    }
    val amount=price.toIntOrNull()
    val ready=photo!=null && bitmap!=null && amount!=null && amount>0 && title.isNotBlank()
    val cleanTitle=title.trim()
    val desc=if(title.isNotBlank()){
        cleanTitle+" from "+brand.trim()+". "+(if(material.isBlank())"Quality fabric" else material.trim()+" fabric")+
            (if(color.isBlank())"" else " in "+color.trim())+
            ". Explore this "+category.lowercase()+" style for everyday fashion and special occasions."
    } else ""
    val faq=listOf(
        "Q: What is the product?\nA: "+(cleanTitle.ifBlank{"Enter a product name"})+".",
        "Q: Which sizes are available?\nA: "+(size.ifBlank{"Sizes must be confirmed by the store"})+".",
        "Q: What is the material?\nA: "+(material.ifBlank{"Material must be confirmed by the store"})+".",
        "Q: What is the price?\nA: ₹"+(amount?:0)+"."
    )
    val seo=(cleanTitle+" | "+brand).take(65)
    val draft=desc+"\n\n"+faq.joinToString("\n\n")+"\n\nSEO: "+seo
    LazyColumn(
        modifier=Modifier.fillMaxSize().background(ink),
        contentPadding=PaddingValues(16.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)
    ){
        item { TextButton(onClick=onBack){Text("← Product Studio",color=aqua)} }
        item {
            Text("PHOTO-TO-LISTING STUDIO",color=amber,fontWeight=FontWeight.Black,fontSize=12.sp)
            Text("Create your product listing",color=Color.White,fontWeight=FontWeight.Black,fontSize=25.sp)
            Text("Photo + selling price + review. Draft previews are built locally; AI and web publishing are not yet connected.",color=Color.White.copy(alpha=.7f),fontSize=12.sp)
        }
        item {
            Card(
                modifier=Modifier.fillMaxWidth().height(190.dp),
                shape=RoundedCornerShape(21.dp),
                colors=CardDefaults.cardColors(containerColor=panel)
            ){
                Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){
                    if(bitmap!=null)Image(bitmap,contentDescription="Selected product photo",contentScale=ContentScale.Fit,modifier=Modifier.fillMaxSize())
                    else Column(horizontalAlignment=Alignment.CenterHorizontally){
                        Icon(Icons.Default.AddPhotoAlternate,null,tint=aqua,modifier=Modifier.size(50.dp))
                        Text("Add product image",color=Color.White)
                    }
                }
            }
        }
        item {
            Button(
                onClick={picker.launch("image/*")},modifier=Modifier.fillMaxWidth(),
                colors=ButtonDefaults.buttonColors(containerColor=aqua)
            ){Icon(Icons.Default.PhotoLibrary,null,tint=ink);Spacer(Modifier.width(9.dp));Text("SELECT PHOTO",color=ink,fontWeight=FontWeight.Black)}
        }
        item {
            Card(colors=CardDefaults.cardColors(containerColor=panel),shape=RoundedCornerShape(18.dp)){
                Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                    Text("PRODUCT INFORMATION",color=amber,fontSize=12.sp,fontWeight=FontWeight.Bold)
                    StudioField("Selling price ₹",price,{price=it.filter(Char::isDigit).take(8)},true)
                    StudioField("Product name (review / enter)",title,{title=it})
                    StudioField("Brand",brand,{brand=it})
                    Text("CATEGORY",color=Color.White,fontSize=11.sp,fontWeight=FontWeight.Bold)
                    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
                        listOf("Men","Women","Kids","Sarees","Footwear").forEach {x->
                            FilterChip(selected=category==x,onClick={category=x},label={Text(x)})
                        }
                    }
                    StudioField("Size(s)",size,{size=it})
                    StudioField("Color",color,{color=it})
                    StudioField("Material",material,{material=it})
                }
            }
        }
        item {
            Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF214985)),shape=RoundedCornerShape(18.dp)){
                Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Icon(Icons.Default.AutoStories,null,tint=amber)
                        Spacer(Modifier.width(9.dp))
                        Text("Listing preview",color=Color.White,fontWeight=FontWeight.Black)
                    }
                    Text("PRODUCT DESCRIPTION",color=aqua,fontWeight=FontWeight.Bold,fontSize=10.sp)
                    Text(desc.ifEmpty{"Enter product name to preview the listing."},color=Color.White,fontSize=12.sp)
                    Text("FAQ PREVIEW",color=aqua,fontWeight=FontWeight.Bold,fontSize=10.sp)
                    faq.forEach{Text(it,color=Color.White.copy(alpha=.8f),fontSize=11.sp)}
                    Text("SEO TITLE",color=aqua,fontWeight=FontWeight.Bold,fontSize=10.sp)
                    Text(seo,color=Color.White,fontSize=12.sp)
                    Text("These are editable rule-based drafts, not AI-generated descriptions.",color=amber,fontSize=10.sp)
                }
            }
        }
        item {
            Row(verticalAlignment=Alignment.CenterVertically){
                Checkbox(checked=approved,onCheckedChange={approved=it})
                Text("I reviewed the product details",color=Color.White,fontSize=12.sp)
            }
        }
        item {
            Button(
                enabled=ready&&approved,
                modifier=Modifier.fillMaxWidth(),
                colors=ButtonDefaults.buttonColors(containerColor=aqua),
                onClick={
                    val obj=JSONObject().apply{
                        put("title",cleanTitle);put("brand",brand.trim());put("category",category)
                        put("size",size.trim());put("color",color.trim());put("material",material.trim())
                        put("price",amount);put("description",desc);put("faq",faq.joinToString("\n\n"));put("seo",seo)
                        put("imageUri",photo.toString())
                    }
                    context.getSharedPreferences("ncs_v7_photo_draft",0).edit().putString("latest",obj.toString()).apply()
                    showCopyNotice=true
                }
            ){
                Icon(Icons.Default.Save,null,tint=ink)
                Spacer(Modifier.width(8.dp))
                Text("SAVE REVIEWED DRAFT ON PHONE",color=ink,fontWeight=FontWeight.Black)
            }
        }
        if(showCopyNotice) item {
            Text("Saved locally. Nothing has been sent to your Web Store.",color=aqua,fontSize=12.sp)
        }
        item {
            OutlinedButton(onClick=onManualDraft,modifier=Modifier.fillMaxWidth()){
                Icon(Icons.Default.Edit,null,tint=aqua)
                Spacer(Modifier.width(8.dp))
                Text("Open manual inventory editor",color=aqua)
            }
        }
        item {
            Text("Web AI (primary/backup), original images, and web publish APIs still require a verified connection. Saving this draft does not change financial or product records on the server.",color=Color.White.copy(alpha=.58f),fontSize=10.sp)
        }
    }
}
@Composable private fun StudioField(label:String,value:String,onChange:(String)->Unit,numeric:Boolean=false){
    OutlinedTextField(
        value=value,onValueChange=onChange,
        label={Text(label)},
        modifier=Modifier.fillMaxWidth(),singleLine=true,
        keyboardOptions=KeyboardOptions(keyboardType=if(numeric) KeyboardType.Number else KeyboardType.Text),
        colors=OutlinedTextFieldDefaults.colors(
            focusedTextColor=Color.White,unfocusedTextColor=Color.White,
            focusedBorderColor=aqua,unfocusedBorderColor=Color.White.copy(alpha=.42f),
            focusedLabelColor=aqua,unfocusedLabelColor=Color.White.copy(alpha=.7f)
        )
    )
}
