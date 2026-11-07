package store.newcitystyle.universalpro

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject

private val studioRoyal = Color(0xFF0A2E73)
private val studioIvory = Color(0xFFF8F4EC)
private val studioGold = Color(0xFFD4AF37)
private val studioMuted = Color(0xFF566780)
private val studioGreen = Color(0xFF15795D)
private fun JSONObject.str(k:String) = optString(k,"").takeIf{it!="null"}?:""
private fun JSONObject.money(k:String)="₹"+str(k).ifBlank{"—"}

@Composable
fun LiveProductStudioScreen() {
    val scope=rememberCoroutineScope()
    var auth by remember { mutableStateOf(NcsCloud.activeSession) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var page by remember { mutableIntStateOf(0) }
    var total by remember { mutableStateOf<Int?>(null) }
    var products by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var search by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<JSONObject?>(null) }
    var variants by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var designs by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var designLinks by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var showPhoto by remember { mutableStateOf(false) }
    fun loadProducts(next:Int) {
        val session=auth?:return
        loading=true;error="";page=next
        scope.launch {
            try {
                val result=NcsCloud.load(session,"products",next*40,40)
                products=result.items;total=result.count
            } catch(e:Exception){error=e.message?:"Could not load products"}
            finally {loading=false}
        }
    }
    fun openProduct(product:JSONObject) {
        selected=product;variants=emptyList();designs=emptyList();designLinks=emptyList()
        val session=auth?:return
        val id=product.optLong("id",0)
        if(id<=0)return
        loading=true;error=""
        scope.launch {
            try {
                variants=NcsCloud.forProduct(session,"product_variants",id)
                designs=NcsCloud.forProduct(session,"product_design_units",id)
                designLinks=NcsCloud.forProduct(session,"product_design_unit_variants",id)
            }catch(e:Exception){error=e.message?:"Could not load product designs"}
            finally{loading=false}
        }
    }
    Column(Modifier.fillMaxSize().background(studioIvory)) {
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(studioRoyal,Color(0xFF164B9B))))
                .padding(horizontal=15.dp,vertical=17.dp),verticalAlignment=Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)){
                Text("NEW CITY STYLE • PRODUCT STUDIO",color=studioGold,fontSize=9.sp,fontWeight=FontWeight.Bold,letterSpacing=1.sp)
                Text(if(selected==null)"Real Product Catalogue" else "Product #"+selected!!.str("id"),color=Color.White,fontWeight=FontWeight.Black,fontSize=22.sp)
                Text("Website catalogue • Sizes • Designs",color=Color.White.copy(alpha=.74f),fontSize=11.sp)
            }
            IconButton(onClick={if(selected==null)loadProducts(page) else selected?.let{openProduct(it)}}){
                Icon(Icons.Default.Refresh,null,tint=Color.White)
            }
        }
        if(auth==null) {
            LazyColumn(contentPadding=PaddingValues(19.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                item {
                    Text("Connect real NEW CITY STYLE account",color=studioRoyal,fontSize=23.sp,fontWeight=FontWeight.Black)
                    Text("No fictional catalogue. Your existing Supabase login is required to load actual records.",color=studioMuted,fontSize=12.sp)
                }
                item {OutlinedTextField(email,{email=it},label={Text("Owner account email")},modifier=Modifier.fillMaxWidth(),singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email))}
                item {OutlinedTextField(password,{password=it},label={Text("Password")},modifier=Modifier.fillMaxWidth(),singleLine=true,visualTransformation=PasswordVisualTransformation())}
                item {
                    Button(
                        enabled=email.isNotBlank()&&password.isNotBlank()&&!loading,
                        onClick={
                            loading=true;error=""
                            scope.launch{
                                try {
                                    auth=NcsCloud.signIn(email.trim(),password)
                                    password=""
                                    loadProducts(0)
                                }catch(e:Exception){error=e.message?:"Sign in failed"}
                                finally{loading=false}
                            }
                        },modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=studioRoyal)
                    ) {Icon(Icons.Default.LockOpen,null);Spacer(Modifier.width(8.dp));Text("CONNECT REAL CATALOGUE")}
                }
                item {Text("This screen reads actual products only; it does not change physical stock or publish online.",fontSize=11.sp,color=studioMuted)}
                if(loading)item{LinearProgressIndicator(modifier=Modifier.fillMaxWidth())}
                if(error.isNotBlank())item{Text(error,color=Color(0xFFB43E39))}
            }
        } else if(selected==null) {
            LazyColumn(contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                item {
                    Row(verticalAlignment=Alignment.CenterVertically){
                        Text("LIVE PRODUCT INTELLIGENCE",color=studioRoyal,fontWeight=FontWeight.Black,fontSize=14.sp,modifier=Modifier.weight(1f))
                        Surface(color=Color(0xFFE8F3ED),shape=RoundedCornerShape(9.dp)){Text("CLOUD",Modifier.padding(9.dp),color=studioGreen,fontWeight=FontWeight.Bold,fontSize=10.sp)}
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        LiveCounter("PRODUCTS",(total?:products.size).toString(),studioRoyal,Modifier.weight(1f))
                        LiveCounter("THIS PAGE",products.size.toString(),Color(0xFF896512),Modifier.weight(1f))
                    }
                }
                item {
                    OutlinedTextField(search,{search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,
                        leadingIcon={Icon(Icons.Default.Search,null)},placeholder={Text("Search displayed products or barcode")})
                }
                item {
                    Text("Tap a product to see its actual variants and existing designs.",color=studioMuted,fontSize=11.sp)
                }
                if(loading)item{LinearProgressIndicator(modifier=Modifier.fillMaxWidth())}
                if(error.isNotBlank())item{Text(error,color=Color(0xFFAE3A37))}
                items(products.filter{search.isBlank()||listOf(it.str("name"),it.str("barcode"),it.str("brand")).any{x->x.contains(search,true)}},key={it.optLong("id")}){p->
                    Card(
                        modifier=Modifier.fillMaxWidth().clickable{openProduct(p)},
                        colors=CardDefaults.cardColors(containerColor=Color.White),
                        shape=RoundedCornerShape(17.dp)
                    ){
                        Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                            Box(Modifier.size(50.dp).background(studioIvory,RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center){
                                Icon(Icons.Default.Inventory2,null,tint=studioRoyal)
                            }
                            Spacer(Modifier.width(11.dp))
                            Column(Modifier.weight(1f)){
                                Text(p.str("name"),fontWeight=FontWeight.Black,color=studioRoyal,fontSize=14.sp,maxLines=2)
                                Text(p.str("brand")+" • "+p.str("category"),fontSize=11.sp,color=studioMuted)
                                Text(p.money("price")+"  •  MRP "+p.money("mrp"),fontWeight=FontWeight.Bold,color=studioRoyal,fontSize=12.sp)
                                Text("Stock "+p.str("stock")+"  |  "+p.str("barcode"),color=studioGreen,fontSize=11.sp)
                            }
                            Icon(Icons.Default.ChevronRight,null,tint=studioGold)
                        }
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        OutlinedButton(enabled=page>0&&!loading,onClick={loadProducts(page-1)},modifier=Modifier.weight(1f)){Text("Previous")}
                        Button(enabled=!loading&&products.size==40&&(total==null||(page+1)*40<total!!),onClick={loadProducts(page+1)},modifier=Modifier.weight(1f),
                            colors=ButtonDefaults.buttonColors(containerColor=studioRoyal)){Text("Next")}
                    }
                }
                item {
                    TextButton(onClick={auth=null;NcsCloud.activeSession=null;products=emptyList();selected=null}){
                        Text("Sign out",color=studioMuted)
                    }
                }
            }
        } else {
            val p=selected!!
            val ctx=LocalContext.current
            val photoPicker=rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) {uris->
                // Local selection only. Never transmit unreviewed photos to the live store.
                pendingPhotos.clear();pendingPhotos.addAll(uris)
            }
            LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
                item {TextButton(onClick={selected=null;showPhoto=false}){Text("← All Products",color=studioRoyal)}}
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(19.dp)) {
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                            Text(p.str("name"),fontWeight=FontWeight.Black,fontSize=21.sp,color=studioRoyal)
                            Text("Product #"+p.str("id")+"  |  "+p.str("barcode"),color=studioMuted,fontSize=12.sp)
                            Text(p.money("price")+"  •  MRP "+p.money("mrp"),color=studioRoyal,fontWeight=FontWeight.Bold,fontSize=17.sp)
                            Text(p.str("brand")+"  •  "+p.str("category"),color=studioMuted,fontSize=12.sp)
                            Surface(color=Color(0xFFE8F4ED),shape=RoundedCornerShape(9.dp)){
                                Text("Physical barcode & stock are not changed by viewing this screen.",Modifier.padding(10.dp),fontSize=11.sp,color=studioGreen)
                            }
                        }
                    }
                }
                if(loading)item{LinearProgressIndicator(modifier=Modifier.fillMaxWidth())}
                if(error.isNotBlank())item{Text(error,color=Color(0xFFB13B35),fontSize=12.sp)}
                item {StudioStep(1,"PHOTOS","Upload one photo or several, then review before publishing.")}
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(17.dp)){
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                            Button(onClick={photoPicker.launch("image/*")},modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=studioRoyal)){
                                Icon(Icons.Default.CloudUpload,null);Spacer(Modifier.width(8.dp));Text("SELECT PRODUCT PHOTOS")
                            }
                            Text(pendingPhotos.size.toString()+" photos selected locally",color=studioMuted,fontSize=12.sp)
                            Text("Live upload requires the same verified web product-studio endpoint; no sample images are published.",color=studioMuted,fontSize=10.sp)
                        }
                    }
                }
                item {StudioStep(2,"AI DETAILS","Name, SEO, tags, product description, specs and FAQ from the existing Web AI.")}
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color(0xFFFFF9E8)),shape=RoundedCornerShape(17.dp)){
                        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                            Text("AI Complete Product",fontWeight=FontWeight.Black,color=studioRoyal,fontSize=17.sp)
                            Text("Primary AI + backup engine: original Web API verification required.",color=studioMuted,fontSize=11.sp)
                            OutlinedButton(onClick={showPhoto=!showPhoto},modifier=Modifier.fillMaxWidth()){
                                Text(if(showPhoto)"Hide Current Website Details" else "Preview Current Website Details",color=studioRoyal)
                            }
                            if(showPhoto){
                                Text(p.str("name"),fontWeight=FontWeight.Bold,color=studioRoyal)
                                Text("Description and SEO must be loaded from Web Product Studio before AI publish is enabled.",color=studioMuted,fontSize=11.sp)
                            }
                        }
                    }
                }
                item {StudioStep(3,"PUBLISH","Use the same website database and existing design links.")}
                item {
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(17.dp)){
                        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
                            Text("Real variants: "+variants.size+"  •  Existing designs: "+designs.size,fontWeight=FontWeight.Bold,color=studioRoyal)
                            Text("Publishing is unavailable until authenticated Web AI/upload APIs are verified. No duplicate products will be created.",color=studioMuted,fontSize=11.sp)
                        }
                    }
                }
                item {StudioStep(4,"EXISTING DESIGNS","Real design photos, quantities and size links from the store.")}
                if(designs.isEmpty()&&!loading)item{Text("No design records found for this product or access was restricted.",color=studioMuted,fontSize=12.sp)}
                items(designs,key={it.optLong("id")}){d->
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(13.dp)){
                        Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){
                            Text(d.str("design_name").ifBlank{"Design #"+d.str("id")},fontWeight=FontWeight.Bold,color=studioRoyal)
                            Text("Quantity "+d.str("unit_quantity")+"  •  "+d.str("status"),color=studioGreen,fontSize=12.sp)
                            Text("Barcode "+d.str("parent_barcode"),fontSize=11.sp,color=studioMuted)
                            Text("Size links: "+designLinks.count{it.optLong("design_unit_id")==d.optLong("id")},fontSize=11.sp,color=studioMuted)
                        }
                    }
                }
                item {StudioStep(5,"SIZES & STOCK","Existing product variants from the live catalogue.")}
                items(variants,key={it.optLong("id")}){v->
                    Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(13.dp)){
                        Column(Modifier.padding(13.dp)){
                            Text(v.str("size")+"  •  "+v.str("color"),fontWeight=FontWeight.Bold,color=studioRoyal)
                            Text("Stock "+v.str("stock")+"  •  MRP "+v.money("mrp")+"  •  Selling "+v.money("selling_price"),fontSize=12.sp,color=studioMuted)
                            Text("Barcode "+v.str("barcode"),fontSize=11.sp,color=studioGreen)
                        }
                    }
                }
            }
        }
    }
}
// Photos belong to this app session only, not the production database.
private val pendingPhotos = mutableStateListOf<android.net.Uri>()
@Composable private fun LiveCounter(label:String,value:String,tint:Color,modifier:Modifier){
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(14.dp)){
        Column(Modifier.padding(14.dp)){
            Text(label,color=studioMuted,fontSize=10.sp,fontWeight=FontWeight.Bold)
            Text(value,color=tint,fontSize=24.sp,fontWeight=FontWeight.Black)
        }
    }
}
@Composable private fun StudioStep(n:Int,title:String,description:String){
    Row(verticalAlignment=Alignment.Top){
        Surface(color=studioRoyal,shape=RoundedCornerShape(11.dp)){
            Text(n.toString(),Modifier.padding(horizontal=14.dp,vertical=10.dp),fontWeight=FontWeight.Black,color=studioGold)
        }
        Spacer(Modifier.width(11.dp))
        Column{
            Text(title,color=studioRoyal,fontSize=21.sp,fontWeight=FontWeight.Black)
            Text(description,color=studioMuted,fontSize=11.sp)
        }
    }
}
