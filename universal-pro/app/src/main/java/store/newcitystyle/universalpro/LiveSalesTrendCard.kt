package store.newcitystyle.universalpro

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.text.NumberFormat
import java.util.Locale

private val chartBlue=Color(0xFF0A2E73)
private val chartGold=Color(0xFFD4AF37)
private val chartMint=Color(0xFF00C59E)
private val chartMoney=NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IN"))

@Composable
fun LiveSalesTrendCard() {
    val session=NcsCloud.activeSession
    val scope=rememberCoroutineScope()
    var data by remember(session){mutableStateOf(JSONArray())}
    var loading by remember(session){mutableStateOf(false)}
    var error by remember(session){mutableStateOf("")}
    fun refresh(){
        val active=session?:return
        loading=true;error=""
        scope.launch{
            try{data=NcsCloud.salesTrend(active)}
            catch(e:Exception){error=e.message?:"Trend unavailable"}
            finally{loading=false}
        }
    }
    LaunchedEffect(session){if(session!=null)refresh()}
    Card(
        modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp),
        colors=CardDefaults.cardColors(containerColor=Color(0xFF0C254C)),
        shape=RoundedCornerShape(19.dp)
    ){
        Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Row(verticalAlignment=Alignment.CenterVertically){
                Icon(Icons.Default.TrendingUp,null,tint=chartMint,modifier=Modifier.size(22.dp))
                Spacer(Modifier.width(9.dp))
                Column(Modifier.weight(1f)){
                    Text("SALES TRAJECTORY",color=Color.White,fontWeight=FontWeight.Black,fontSize=17.sp)
                    Text("Last 14 days • Actual live bills • India time",color=Color.White.copy(alpha=.68f),fontSize=10.sp)
                }
                TextButton(onClick={refresh()},enabled=!loading){Text("REFRESH",color=chartGold,fontSize=10.sp)}
            }
            val points=(0 until data.length()).map { i -> data.optJSONObject(i)?.optDouble("sales",0.0)?:0.0 }
            val total=points.sum()
            Row(verticalAlignment=Alignment.CenterVertically){
                Text(chartMoney.format(total),fontSize=24.sp,color=Color.White,fontWeight=FontWeight.Black)
                Spacer(Modifier.width(9.dp))
                Text("14-day sales",color=chartMint,fontSize=11.sp)
            }
            if(loading)LinearProgressIndicator(modifier=Modifier.fillMaxWidth(),color=chartGold)
            if(error.isNotBlank())Text(error,color=Color(0xFFFFC0B3),fontSize=11.sp)
            if(points.size>=2){
                val ceiling=(points.maxOrNull()?:1.0).coerceAtLeast(1.0)
                Canvas(Modifier.fillMaxWidth().height(140.dp)){
                    val w=size.width;val h=size.height
                    for(step in 1..3){
                        val y=h*step/4
                        drawLine(Color.White.copy(alpha=.12f),Offset(0f,y),Offset(w,y),strokeWidth=1.dp.toPx())
                    }
                    val path=Path()
                    points.forEachIndexed{index,value->
                        val x=(index.toFloat()/(points.size-1))*w
                        val y=(h-12.dp.toPx())-(value/ceiling).toFloat()*(h-26.dp.toPx())
                        if(index==0)path.moveTo(x,y) else path.lineTo(x,y)
                    }
                    drawPath(path,Brush.horizontalGradient(listOf(chartGold,chartMint)),style=Stroke(width=3.dp.toPx(),cap=StrokeCap.Round))
                    points.forEachIndexed{index,value->
                        if(index==0||index==points.lastIndex||index%3==0){
                            val x=(index.toFloat()/(points.size-1))*w
                            val y=(h-12.dp.toPx())-(value/ceiling).toFloat()*(h-26.dp.toPx())
                            drawCircle(chartGold,3.5.dp.toPx(),Offset(x,y))
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                    Text(data.optJSONObject(0)?.optString("date")?.takeLast(5)?:"",color=Color.White.copy(alpha=.64f),fontSize=10.sp)
                    Text("LIVE SALES",color=chartMint,fontSize=10.sp,fontWeight=FontWeight.Bold)
                    Text(data.optJSONObject(data.length()-1)?.optString("date")?.takeLast(5)?:"",color=Color.White.copy(alpha=.64f),fontSize=10.sp)
                }
            }else if(!loading){
                Text(if(session==null)"Sign in to show live sales history" else "No sales trajectory available yet",color=Color.White.copy(alpha=.7f),fontSize=11.sp)
            }
        }
    }
}
