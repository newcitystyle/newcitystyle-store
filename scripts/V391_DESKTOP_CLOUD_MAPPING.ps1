$ErrorActionPreference = 'Stop'
$source = 'D:\NCS_LOCAL_DB\V183\ncs_local_receipts.sqlite'
if (!(Test-Path -LiteralPath $source)) { throw 'V391_RECEIPT_DATABASE_NOT_FOUND' }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'V391_NODE_NOT_AVAILABLE' }
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$outdir = Join-Path 'D:\NCS_BACKUP\V391_SYNC_RECONCILIATION' $stamp
New-Item -ItemType Directory -Path $outdir -Force | Out-Null
$env:NCS_V391_DB = $source
$env:NCS_V391_OUT = $outdir
try {
@'
const { DatabaseSync, backup } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const source = process.env.NCS_V391_DB;
const outdir = process.env.NCS_V391_OUT;
const sha256 = x => crypto.createHash('sha256').update(String(x)).digest('hex');
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const validNumber = v => finite(v) ? Number(v) : NaN;
const positiveInt = v => Number.isSafeInteger(Number(v)) && Number(v) > 0;
const money2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
(async () => {
  const sourceDb = new DatabaseSync(source, {readOnly:true});
  const snapshot = path.join(outdir,'receipts_verified_backup.sqlite');
  try {
    await backup(sourceDb, snapshot);
  } finally {
    sourceDb.close();
  }
  const db = new DatabaseSync(snapshot,{readOnly:true});
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if(Object.values(integrity)[0] !== 'ok') throw Error('V391_BACKUP_INTEGRITY_FAILED');
    const records = db.prepare('SELECT tx_id,payload_json,recorded_at FROM receipts ORDER BY recorded_at').all();
    const report = {
      version:'V391',
      source:'V183 receipts SQLite snapshot',
      noCloudWrites:true,
      noCustomerPII:true,
      createdAt:new Date().toISOString(),
      summary:{receipts:records.length,test:0,quickHold:0,eligibleForCloudPreflight:0,reviewRequired:0,alreadyClaimedSynced:0},
      transactions:[]
    };
    const seen = new Set();
    for(const record of records) {
      let s;
      try {s = JSON.parse(record.payload_json)}
      catch(e) {report.summary.reviewRequired++; continue}
      if(s.testOnly === true) {report.summary.test++;continue}
      const tx = String(s.clientTransactionId || '').trim();
      const items = Array.isArray(s.items)?s.items:[];
      const quick = items.some(i => i.isQuickItem===true || String(i.sku||'').startsWith('QUICK-'));
      const total = validNumber(s.finalPayable);
      const paid = validNumber(s.paidAmount);
      const due = validNumber(s.dueAmount);
      const method = String(s.paymentMethod||'').toLowerCase();
      const issues = [];
      if(!tx || String(record.tx_id||'').trim() !== tx) issues.push('TX_ID_INVALID');
      if(seen.has(tx)) issues.push('DUPLICATE_LOCAL_TX_ID');
      if(tx) seen.add(tx);
      if(!String(s.offlineInvoiceNumber||'').trim()) issues.push('OFFLINE_INVOICE_MISSING');
      if(items.length === 0) issues.push('ITEMS_EMPTY');
      if(![total,paid,due].every(Number.isFinite) || !(total>0) || Math.abs(total-paid-due) > 0.02) issues.push('PAYMENT_TOTAL_MISMATCH');
      if(!['cash','upi','credit','card'].includes(method)) issues.push('PAYMENT_METHOD_UNSUPPORTED');
      if(method === 'credit' && (!finite(due) || due <= 0)) issues.push('CREDIT_DUE_MISMATCH');
      if(method !== 'credit' && finite(due) && due > 0) issues.push('PARTIAL_PAYMENT_UNSUPPORTED');
      const cleanItems = items.map(i=>{
        const productId = validNumber(i.productId);
        const variantId = i.variantId==null || i.variantId==='' ? null : validNumber(i.variantId);
        const quantity = validNumber(i.quantity);
        const price = validNumber(i.price);
        const mrp = validNumber(i.mrp);
        const tax = validNumber(i.taxPercent ?? 0);
        if(!positiveInt(productId)) issues.push('PRODUCT_ID_INVALID');
        if(variantId!==null && !positiveInt(variantId)) issues.push('VARIANT_ID_INVALID');
        if(!positiveInt(quantity)) issues.push('QTY_INVALID');
        if(!Number.isFinite(price) || price < 0) issues.push('PRICE_INVALID');
        if(!Number.isFinite(mrp) || mrp < 0) issues.push('MRP_INVALID');
        if(!Number.isFinite(tax) || tax < 0) issues.push('TAX_INVALID');
        return {
          productId:Number.isFinite(productId)?productId:null,
          variantId:variantId===null?null:(Number.isFinite(variantId)?variantId:null),
          quantity:Number.isFinite(quantity)?quantity:null,
          unitPrice:Number.isFinite(price)?price:null,
          mrp:Number.isFinite(mrp)?mrp:null,
          taxPercent:Number.isFinite(tax)?tax:null,
          quickItem:i.isQuickItem===true,
          offlinePhysicalPiece:i.offlinePhysicalPiece===true
        };
      });
      const billDiscount = validNumber(s.billDiscountAmount||0);
      const rewardDiscount = validNumber(s.rewardDiscountAmount||0);
      const roundOff = validNumber(s.roundOffAmount||0);
      const computed = cleanItems.reduce((a,i)=>a + (i.unitPrice||0)*(i.quantity||0),0) - billDiscount - rewardDiscount - roundOff;
      if(Number.isFinite(total) && Math.abs(money2(computed) - total)>0.02)issues.push('RECALCULATED_TOTAL_DIFFERS');
      if(s.syncStatus && String(s.syncStatus).toUpperCase()==='SYNCED')issues.push('ALREADY_CLAIMED_SYNCED');
      if(s.cloudSaleId || s.cloudInvoiceNumber) issues.push('CLOUD_SALE_REFERENCE_PRESENT');
      const uniqueIssues=[...new Set(issues)];
      let state;
      if(quick){state='QUICK_ITEM_HOLD'; report.summary.quickHold++}
      else if(uniqueIssues.length){state='REVIEW_REQUIRED';report.summary.reviewRequired++}
      else{state='NEEDS_LIVE_CLOUD_CHECK';report.summary.eligibleForCloudPreflight++}
      if(s.cloudSaleId || s.cloudInvoiceNumber)report.summary.alreadyClaimedSynced++;
      report.transactions.push({
        clientTransactionId:tx,
        offlineInvoiceNumber:String(s.offlineInvoiceNumber||''),
        createdAt:String(s.createdAt||''),
        paymentMethod:method,
        finalPayable:Number.isFinite(total)?total:null,
        paidAmount:Number.isFinite(paid)?paid:null,
        dueAmount:Number.isFinite(due)?due:null,
        billDiscount:Number.isFinite(billDiscount)?billDiscount:null,
        rewardDiscount:Number.isFinite(rewardDiscount)?rewardDiscount:null,
        roundOff:Number.isFinite(roundOff)?roundOff:null,
        localSyncStatus:String(s.syncStatus||''),
        state,
        issues:uniqueIssues,
        items:cleanItems
      });
    }
    const filename=path.join(outdir,'V391_SALES_MAPPING_NO_CUSTOMER_DETAILS.json');
    fs.writeFileSync(filename,JSON.stringify(report,null,2));
    console.log('V391_SNAPSHOT='+snapshot);
    console.log('V391_MAPPING_FILE='+filename);
    for(const [k,v] of Object.entries(report.summary))console.log(k.toUpperCase()+'='+v);
    const issueCounts={};
    for(const tx of report.transactions)for(const issue of tx.issues)issueCounts[issue]=(issueCounts[issue]||0)+1;
    console.log('REVIEW_ISSUES='+JSON.stringify(issueCounts));
    console.log('NO_CLOUD_WRITES_NO_FINANCIAL_CHANGES');
  } finally {db.close()}
})().catch(e=>{console.error('V391_FAILED='+e.message);process.exitCode=1});
'@ | node -
if ($LASTEXITCODE -ne 0) { throw 'V391_FAILED' }
Write-Host 'V391_RECONCILIATION_COMPLETED' -ForegroundColor Green
} finally {
  Remove-Item Env:NCS_V391_DB,Env:NCS_V391_OUT -ErrorAction SilentlyContinue
}
