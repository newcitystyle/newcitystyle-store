$ErrorActionPreference = "Stop"
$source = 'D:\NCS_LOCAL_DB\V183\ncs_local_receipts.sqlite'
$mirror = 'D:\NCS_LOCAL_DB\V331_CLOUD_MIRROR\cloud_pos_sales_mirror.sqlite'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outdir = Join-Path 'D:\NCS_BACKUP\V390_SAFE_SYNC' $stamp
if (!(Test-Path $source)) { throw "LOCAL_RECEIPT_DB_NOT_FOUND" }
if (!(Test-Path $mirror)) { throw "CLOUD_MIRROR_NOT_FOUND" }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw "NODE_NOT_INSTALLED" }
New-Item -ItemType Directory -Force -Path $outdir | Out-Null
$env:NCS_V390_SOURCE=$source
$env:NCS_V390_MIRROR=$mirror
$env:NCS_V390_OUTDIR=$outdir
@'
const fs=require("fs"), path=require("path");
const crypto=require("crypto");
const {DatabaseSync,backup}=require("node:sqlite");
const dbfile=process.env.NCS_V390_SOURCE, mirrorfile=process.env.NCS_V390_MIRROR;
const out=process.env.NCS_V390_OUTDIR;
const hash=s=>crypto.createHash("sha256").update(String(s)).digest("hex").slice(0,24);
(async()=>{
 const src=new DatabaseSync(dbfile,{readOnly:true});
 const dest=path.join(out,"receipts_safe_backup.sqlite");
 try{await backup(src,dest)}finally{src.close()}
 const d=new DatabaseSync(dest,{readOnly:true});
 const m=new DatabaseSync(mirrorfile,{readOnly:true});
 try{
  const integrity=d.prepare("PRAGMA integrity_check").get();
  if(Object.values(integrity)[0]!=="ok")throw Error("BACKUP_INTEGRITY_FAIL");
  const receipts=d.prepare("SELECT tx_id,payload_json FROM receipts").all();
  const cloudIds=new Set(m.prepare("SELECT client_transaction_id FROM cloud_pos_sales").all().map(x=>String(x.client_transaction_id||"")));
  const summary={total:receipts.length,tests:0,quick_hold:0,nonquick_pending_live_check:0,already_in_mirror:0,unsafe_hold:0};
  const details=[];
  for(const r of receipts){
   let p;
   try{p=JSON.parse(r.payload_json)}catch{summary.unsafe_hold++;continue}
   if(p.testOnly===true){summary.tests++;continue}
   const items=Array.isArray(p.items)?p.items:[];
   const tx=String(p.clientTransactionId||"");
   const total=Number(p.finalPayable),paid=Number(p.paidAmount),due=Number(p.dueAmount);
   const valid=tx && tx===String(r.tx_id||"") && String(p.offlineInvoiceNumber||"") && items.length>0 && Number.isFinite(total)&&total>0&& Number.isFinite(paid)&&Number.isFinite(due)&&Math.abs(total-paid-due)<0.03 && ["cash","upi","credit","card"].includes(String(p.paymentMethod).toLowerCase());
   const quick=items.some(i=>i.isQuickItem===true || String(i.sku||"").startsWith("QUICK-"));
   let state;
   if(!valid){state="UNSAFE_HOLD";summary.unsafe_hold++}
   else if(cloudIds.has(tx)){state="MIRROR_MATCH";summary.already_in_mirror++}
   else if(quick){state="QUICK_ATOMIC_HOLD";summary.quick_hold++}
   else{state="NEEDS_LIVE_CLOUD_RECONCILIATION";summary.nonquick_pending_live_check++}
   details.push({transactionHash:hash(tx),state,paymentMethod:p.paymentMethod,itemCount:items.length,localStatus:p.syncStatus,createdAt:p.createdAt});
  }
  fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(summary,null,2));
  fs.writeFileSync(path.join(out,"status_no_pii.json"),JSON.stringify(details,null,2));
  console.log("V390_BACKUP="+dest);
  for(const [k,v] of Object.entries(summary))console.log(k.toUpperCase()+"="+v);
  console.log("NO_CLOUD_WRITES_NO_FINANCIAL_CHANGES");
 }finally{d.close();m.close()}
})().catch(e=>{console.error("V390_ERROR="+e.message);process.exitCode=1});
'@ | node -
if ($LASTEXITCODE -ne 0) {throw "V390_BACKUP_OR_RECONCILIATION_FAILED"}
Remove-Item Env:NCS_V390_SOURCE,Env:NCS_V390_MIRROR,Env:NCS_V390_OUTDIR -ErrorAction SilentlyContinue
Write-Host "V390_SAFE_SYNC_PREPARATION_COMPLETE" -ForegroundColor Green
