package store.newcitystyle.universalpro

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.*
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private const val NCS_WEB_ORIGIN="https://newcitystyle.store"
private val webPaths=mapOf(
    "Web Dashboard" to "/admin/dashboard",
    "Web Product Studio" to "/admin/products",
    "Advanced Web POS" to "/admin/pos",
    "Web Purchases" to "/admin/purchases",
    "Customer Due Ledger" to "/admin/customer-dues",
    "Sales History" to "/admin/sales-history",
    "Suppliers" to "/admin/suppliers",
    "Stock & Catalogue" to "/admin/products",
    "Web Orders" to "/admin/orders",
    "Web Expense Book" to "/admin/expenses"
)
@Composable
fun LiveWebWorkspace(
    startPath:String="/admin/dashboard",
    onBack:()->Unit
) {
    val context=LocalContext.current
    var browser by remember { mutableStateOf<WebView?>(null) }
    var uploading by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var loading by remember {mutableStateOf(true)}
    var error by remember {mutableStateOf("")}
    var currentUrl by remember {mutableStateOf(NCS_WEB_ORIGIN+startPath)}
    var chooser by remember { mutableStateOf(false) }
    val productEditMode=startPath.startsWith("/admin/products/edit/")
    val productCatalogueMode=startPath=="/admin/products"
    val uploadPicker=rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()){res:ActivityResult->
        val cb=uploading
        uploading=null;chooser=false
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res.resultCode,res.data))
    }
    DisposableEffect(Unit){
        onDispose {
            uploading?.onReceiveValue(null);uploading=null
            browser?.let{it.stopLoading();it.destroy()}
            browser=null
        }
    }
    BackHandler(enabled=true){
        val web=browser
        if(web!=null && web.canGoBack())web.goBack() else onBack()
    }
    Column(Modifier.fillMaxSize().background(Color(0xFFF8F4EC))) {
        Row(Modifier.fillMaxWidth().background(Color(0xFF0A2E73)).padding(6.dp),verticalAlignment=Alignment.CenterVertically) {
            IconButton(onClick={val web=browser;if(web?.canGoBack()==true)web.goBack() else onBack()}){
                Icon(Icons.Default.ArrowBack,null,tint=Color.White)
            }
            Column(Modifier.weight(1f)){
                Text("NEW CITY STYLE  •  WEB LIVE",color=Color(0xFFD4AF37),fontSize=9.sp,fontWeight=androidx.compose.ui.text.font.FontWeight.Bold)
                Text(if(productEditMode)"FULL AI PRODUCT EDITOR" else if(productCatalogueMode)"ADVANCED PRODUCT STUDIO" else "BUSINESS WEB WORKSPACE",
                    color=Color.White,fontSize=15.sp,fontWeight=androidx.compose.ui.text.font.FontWeight.Black)
            }
            IconButton(onClick={browser?.reload()}){Icon(Icons.Default.Refresh,null,tint=Color.White)}
            IconButton(onClick={
                runCatching{context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(currentUrl)))}
            }){Icon(Icons.Default.OpenInBrowser,null,tint=Color(0xFFD4AF37))}
        }
        if(!productEditMode && !productCatalogueMode) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal=9.dp,vertical=4.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)){
                webPaths.forEach{(label,path)->
                    FilterChip(
                        selected=Uri.parse(currentUrl).path==path,
                        onClick={browser?.loadUrl(NCS_WEB_ORIGIN+path)},
                        label={Text(label,fontSize=10.sp)},
                        colors=FilterChipDefaults.filterChipColors(selectedContainerColor=Color(0xFFD4AF37))
                    )
                }
            }
        }
        if(loading)LinearProgressIndicator(Modifier.fillMaxWidth(),color=Color(0xFFD4AF37))
        if(error.isNotBlank())Text(error,Modifier.padding(10.dp),color=Color(0xFFB14545),fontSize=11.sp)
        AndroidView(
            modifier=Modifier.fillMaxSize(),
            factory={ctx->
                WebView(ctx).apply {
                    setBackgroundColor(android.graphics.Color.WHITE)
                    settings.javaScriptEnabled=true
                    settings.domStorageEnabled=true
                    settings.javaScriptCanOpenWindowsAutomatically=false
                    settings.allowFileAccess=false
                    settings.allowContentAccess=true
                    settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
                    settings.cacheMode=WebSettings.LOAD_NO_CACHE
                    settings.setSupportMultipleWindows(false)
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this,false)
                    webViewClient=object:WebViewClient(){
                        override fun shouldOverrideUrlLoading(view:WebView?,request:WebResourceRequest?):Boolean {
                            val uri=request?.url?:return false
                            val scheme=uri.scheme?:""
                            val host=uri.host?:""
                            if(scheme=="https" && (host=="newcitystyle.store"||host=="www.newcitystyle.store"))return false
                            return try {
                                context.startActivity(Intent(Intent.ACTION_VIEW,uri))
                                true
                            }catch(_:Exception){true}
                        }
                        override fun onPageStarted(view:WebView?,url:String?,favicon:android.graphics.Bitmap?){
                            loading=true;currentUrl=url?:currentUrl;error=""
                        }
                        override fun onPageFinished(view:WebView?,url:String?){
                            loading=false;currentUrl=url?:currentUrl
                        }
                        override fun onReceivedError(view:WebView?,request:WebResourceRequest?,err:WebResourceError?){
                            if(request?.isForMainFrame==true){
                                loading=false;error="Website connection failed. Check internet and tap Refresh."
                            }
                        }
                    }
                    webChromeClient=object:WebChromeClient(){
                        override fun onShowFileChooser(
                            webView:WebView?,
                            filePathCallback:ValueCallback<Array<Uri>>?,
                            fileChooserParams:FileChooserParams?
                        ):Boolean {
                            if(filePathCallback==null)return false
                            uploading?.onReceiveValue(null)
                            uploading=filePathCallback
                            val intent=try{fileChooserParams?.createIntent()}catch(_:Exception){null}
                                ?:Intent(Intent.ACTION_GET_CONTENT).apply{type="image/*";addCategory(Intent.CATEGORY_OPENABLE)}
                            intent.addCategory(Intent.CATEGORY_OPENABLE)
                            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true)
                            chooser=true
                            return try {
                                uploadPicker.launch(intent)
                                true
                            }catch(e:ActivityNotFoundException){
                                uploading?.onReceiveValue(null);uploading=null;chooser=false
                                false
                            }
                        }
                    }
                    loadUrl(NCS_WEB_ORIGIN+startPath)
                    browser=this
                }
            }
        )
    }
}
