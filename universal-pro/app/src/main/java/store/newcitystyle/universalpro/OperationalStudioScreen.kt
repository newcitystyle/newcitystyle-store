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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val studioNavy=Color(0xFF0A2E73)
private val studioGold=Color(0xFFE1B850)
private data class DemoRecord(val id:String,val title:String,val info:String,val amount:Int,val note:String)
private val purchaseRecords=listOf(
    DemoRecord("P-1008","POOMBUKAR DISTRIBUTORS","Invoice 2572 • 23 pieces",26049,"October 07 • Sample entry"),
    DemoRecord("P-1009","South Fashion Hub","Invoice 874 • 14 pieces",12850,"October 12 • Sample entry"),
    DemoRecord("P-1010","Classic Textiles","Invoice 620 • 34 pieces",39800,"October 18 • Sample entry")
)
private val customerRecords=listOf(
    DemoRecord("C-101","Anitha","2 credit bills • 1 partial payment",4200,"Last visit 2 days ago"),
    DemoRecord("C-102","Ramesh","1 credit bill",1250,"Last visit yesterday"),
    DemoRecord("C-103","Lakshmi","3 credit bills",7990,"Last visit last week")
)
private val supplierRecords=listOf(
    DemoRecord("S-001","POOMBUKAR DISTRIBUTORS","7 purchases • 4 payments",18200,"Balance example"),
    DemoRecord("S-002","South Fashion Hub","5 purchases • 3 payments",14000,"Balance example"),
    DemoRecord("S-003","Classic Textiles","6 purchases • 2 payments",35600,"Balance example")
)
private val saleRecords=listOf(
    DemoRecord("B-501","Walk-in Customer","2 items • Cash",1599,"Today 11:42 AM"),
    DemoRecord("B-502","Anitha","3 items • UPI",2699,"Today 12:18 PM"),
    DemoRecord("B-503","Ramesh","1 item • Credit",899,"Today 04:11 PM")
)
private val paymentsRecords=listOf(
    DemoRecord("TX-31","Customer Collection","Cash receipt",750,"Today 10:40 AM"),
    DemoRecord("TX-32","Supplier Payment","UPI outgoing",3500,"Today 12:25 PM"),
    DemoRecord("TX-33","Shop Expense","Electricity",1250,"Yesterday")
)

@Composable
fun OperationalStudioScreen(title:String,onBack:()->Unit) {
    val records=when(title){
        "Purchase Center" -> purchaseRecords
        "Customers" -> customerRecords
        "Supplier Ledger" -> supplierRecords
        "Sales Intelligence" -> saleRecords
        "Cash & Bank" -> paymentsRecords
        "Inventory Radar" -> purchaseRecords
        "Online Orders" -> saleRecords
        else -> paymentsRecords
    }
    var query by remember(title){mutableStateOf("")}
    var filter by remember(title){mutableStateOf("All")}
    var selected by remember(title){mutableStateOf<DemoRecord?>(null)}
    var newMode by remember(title){mutableStateOf(false)}
    var draftName by remember(title){mutableStateOf("")}
    var draftAmount by remember(title){mutableStateOf("")}
    val drafts=remember(title){mutableStateListOf<DemoRecord>()}
    val all=records+drafts
    val shown=all.filter { (filter=="All"||it.amount>=5000) && (it.title.contains(query,true)||it.info.contains(query,true)||it.id.contains(query,true)) }
    val accent=when(title) { "Customers"->ProCoral; "Supplier Ledger"->ProOrange; "Purchase Center"->ProPurple; "Sales Intelligence"->ProTeal; "Cash & Bank"->ProSky; else->ProPurple }
    Column(Modifier.fillMaxSize().background(ProBg)) {
        Row(
            Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(ProInk,accent,ProBlue))).padding(horizontal=12.dp,vertical=7.dp),
            verticalAlignment=Alignment.CenterVertically
        ){
            IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,null,tint=Color.White)}
            Column(Modifier.weight(1f)){
                Text(title,color=Color.White,fontWeight=FontWeight.Black,fontSize=20.sp)
                Text("UNIVERSAL BUSINESS STUDIO",color=studioGold,fontSize=9.sp)
            }
            IconButton(onClick={newMode=true;selected=null}){Icon(Icons.Default.AddCircleOutline,null,tint=studioGold)}
        }
        if(selected!=null){
            val record=selected!!
            Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
                TextButton(onClick={selected=null}){Text("← Records")}
                Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(21.dp)){
                    Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                        Text(record.id,color=studioNavy,fontSize=12.sp,fontWeight=FontWeight.Bold)
                        Text(record.title,color=studioNavy,fontSize=23.sp,fontWeight=FontWeight.Black)
                        HorizontalDivider()
                        Text(record.info)
                        Text("₹"+record.amount,color=studioNavy,fontSize=29.sp,fontWeight=FontWeight.Black)
                        Text(record.note,color=Color.Gray)
                    }
                }
                Text("Sample detail view only. There are no actual transactions or database writes.",color=Color.Gray,fontSize=12.sp)
            }
        } else if(newMode){
            Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                TextButton(onClick={newMode=false}){Text("← All records")}
                Text("New Demo Entry",color=studioNavy,fontWeight=FontWeight.Black,fontSize=24.sp)
                Text("This entry stays in memory until the app closes.",color=Color.Gray,fontSize=12.sp)
                OutlinedTextField(draftName,{draftName=it},modifier=Modifier.fillMaxWidth(),label={Text("Name / reference")},singleLine=true)
                OutlinedTextField(draftAmount,{draftAmount=it.filter(Char::isDigit).take(9)},modifier=Modifier.fillMaxWidth(),label={Text("Amount ₹")},singleLine=true)
                Button(
                    enabled=draftName.isNotBlank()&&draftAmount.toIntOrNull()!=null,
                    onClick={
                        drafts.add(DemoRecord("D-"+(drafts.size+1),draftName,"New test entry",draftAmount.toIntOrNull()?:0,"Not saved; demo session only"))
                        draftName="";draftAmount="";newMode=false
                    },
                    modifier=Modifier.fillMaxWidth(),colors=ButtonDefaults.buttonColors(containerColor=studioNavy)
                ){Text("Add to Demo List")}
            }
        } else {
            LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(11.dp)){
                item {
                    Surface(color=Color(0xFFFFF0CB),shape=RoundedCornerShape(12.dp)){
                        Text("SAMPLE DATA ONLY • NOT YOUR REAL BUSINESS BALANCES",Modifier.padding(10.dp),color=Color(0xFF875800),fontSize=10.sp,fontWeight=FontWeight.Bold)
                    }
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                        ProStat("Records",all.size.toString(),"Sample records",Icons.Default.FolderOpen,accent,Modifier.weight(1f))
                        ProStat("Sample Total","₹"+all.sumOf{it.amount},"Not real balance",Icons.Default.AutoGraph,ProTeal,Modifier.weight(1f))
                    }
                }
                item { ProPill("INTERACTIVE DEMO • TEST VALUES ONLY",accent) }
                item {
                    OutlinedTextField(query,{query=it},modifier=Modifier.fillMaxWidth(),placeholder={Text("Find name, ID, invoice or notes")},leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true,shape=RoundedCornerShape(16.dp))
                }
                item {
                    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
                        listOf("All","₹5k+").forEach{f->
                            val value=if(f=="₹5k+")"High" else "All"
                            FilterChip(selected=filter==value,onClick={filter=value},label={Text(f)})
                        }
                    }
                }
                items(shown,key={it.id}){record->
                    Card(
                        modifier=Modifier.fillMaxWidth().clickable{selected=record},
                        colors=CardDefaults.cardColors(containerColor=Color.White),
                        shape=RoundedCornerShape(17.dp)
                    ){
                        Column(Modifier.fillMaxWidth().height(4.dp).background(Brush.horizontalGradient(listOf(accent,ProBlue)))) {}
                        Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically){
                            Column(Modifier.weight(1f)){
                                Text(record.id,fontSize=10.sp,color=Color(0xFF71809A),fontWeight=FontWeight.Bold)
                                Text(record.title,color=studioNavy,fontWeight=FontWeight.Bold,fontSize=15.sp)
                                Text(record.info,fontSize=11.sp,color=Color.Gray)
                                Text(record.note,fontSize=10.sp,color=Color.Gray)
                            }
                            Column(horizontalAlignment=Alignment.End){
                                Text("₹"+record.amount,fontWeight=FontWeight.Black,color=studioNavy,fontSize=18.sp)
                                Icon(Icons.Default.ChevronRight,null,tint=accent)
                            }
                        }
                    }
                }
                item {
                    OutlinedButton(onClick={newMode=true},modifier=Modifier.fillMaxWidth()){
                        Icon(Icons.Default.Add,null);Spacer(Modifier.width(7.dp));Text("Create Demo Entry")
                    }
                }
            }
        }
    }
}
@Composable private fun StudioMetric(label:String,value:String,modifier:Modifier){
    Card(modifier=modifier,colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(17.dp)){
        Column(Modifier.padding(15.dp)){
            Text(label,fontSize=11.sp,color=Color.Gray)
            Text(value,fontWeight=FontWeight.Black,fontSize=21.sp,color=studioNavy)
        }
    }
}
