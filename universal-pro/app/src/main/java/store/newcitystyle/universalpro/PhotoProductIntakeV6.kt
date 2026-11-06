package store.newcitystyle.universalpro

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val photoTeal = Color(0xFF25CEBA)
private val photoGold = Color(0xFFFFD079)
private val photoSurface = Color(0xFF12302F)

@Composable
fun PhotoProductIntakeV6(onBack: () -> Unit, onManualDraft: () -> Unit) {
    val context = LocalContext.current
    var photo by remember { mutableStateOf<Uri?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        photo = uri
    }
    val bitmap = remember(photo) {
        photo?.let { uri ->
            try {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    BitmapFactory.Options().apply { inSampleSize = 2 }.let { opts ->
                        BitmapFactory.decodeStream(stream, null, opts)?.asImageBitmap()
                    }
                }
            } catch (_: Exception) { null }
        }
    }
    Column(
        Modifier.fillMaxSize().background(Color(0xFF071720)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        TextButton(onClick = onBack) { Text("← Product Studio", color = photoTeal) }
        Text("AI PHOTO STUDIO", color = photoGold, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text("One photo. Complete product.", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Black)
        Text("Select a product image to begin the native product creation flow.", color = Color.White.copy(alpha=.7f), fontSize = 12.sp)
        Card(
            modifier = Modifier.fillMaxWidth().height(218.dp),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = photoSurface)
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                if(bitmap != null) {
                    Image(bitmap, contentDescription = "Selected product photo", contentScale = ContentScale.Fit, modifier=Modifier.fillMaxSize())
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Default.AddPhotoAlternate, null, tint = photoTeal, modifier = Modifier.size(58.dp))
                        Text("Choose a product photo", color = Color.White, fontWeight = FontWeight.Bold)
                        Text("JPG / PNG • Android photo picker", color = Color.White.copy(alpha=.55f), fontSize = 11.sp)
                    }
                }
            }
        }
        Button(
            onClick = { picker.launch("image/*") },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = photoTeal)
        ) {
            Icon(Icons.Default.PhotoLibrary, null, tint = Color(0xFF071720))
            Spacer(Modifier.width(9.dp))
            Text(if(photo == null) "SELECT PRODUCT PHOTO" else "CHANGE PRODUCT PHOTO", color = Color(0xFF071720), fontWeight = FontWeight.Black)
        }
        Surface(color = Color(0xFF152B3C), shape = RoundedCornerShape(17.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement=Arrangement.spacedBy(11.dp)) {
                Text("AUTOMATION PIPELINE", color=photoGold, fontSize=12.sp, fontWeight=FontWeight.Black)
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, null, tint=photoTeal)
                    Spacer(Modifier.width(10.dp))
                    Text("1. Native photo selection", color=Color.White, fontSize=12.sp)
                }
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Pending, null, tint=photoGold)
                    Spacer(Modifier.width(10.dp))
                    Text("2. AI details and category extraction — not connected", color=Color.White, fontSize=12.sp)
                }
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Pending, null, tint=photoGold)
                    Spacer(Modifier.width(10.dp))
                    Text("3. Product approval and Web Store publish — not connected", color=Color.White, fontSize=12.sp)
                }
            }
        }
        if(photo != null && bitmap == null) {
            Text("This photo could not be previewed. Choose another image.",color=Color(0xFFFF9B8A),fontSize=12.sp)
        }
        Text("Existing Web AI endpoint and authorized publishing contract must be verified before enabling automatic entry. This demo never uploads photos or publishes products.", color=Color.White.copy(alpha=.68f), fontSize=11.sp)
        OutlinedButton(onClick=onManualDraft,modifier=Modifier.fillMaxWidth()){
            Icon(Icons.Default.Edit,null,tint=photoTeal)
            Spacer(Modifier.width(8.dp))
            Text("Continue to local product draft",color=photoTeal)
        }
    }
}
