import { supabase } from "@/lib/supabase";
export type NcsV49CanonicalRow={
 id:number;name:string;phone:string|null;due:number;credit:number;paid:number;
 updated_at:string|null;opening_adjustment:number;
 public_supplier_id?:number|null;
};
export type NcsV49Snapshot={
 ok:true;source:"NCS_ACCOUNTS_V69_CANONICAL";readOnly:true;
 customers:NcsV49CanonicalRow[];suppliers:NcsV49CanonicalRow[];
};
export async function readNcsV49Ledger():Promise<NcsV49Snapshot>{
 const {data}=await supabase.auth.getSession();
 const token=data.session?.access_token;
 const headers:Record<string,string>={};
 if(token)headers.Authorization="Bearer "+token;
 const response=await fetch("/api/ncs-finance/v49/canonical-ledgers",{
   method:"GET",headers,cache:"no-store",credentials:"same-origin"
 });
 if(!response.ok)throw Error("V69 ledger verification unavailable (HTTP "+response.status+"). Keeping the previously displayed data; do not record payment from an unverified balance.");
 const value:unknown=await response.json();
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid canonical ledger response");
 const result=value as Record<string,unknown>;
 if(result.ok!==true||result.readOnly!==true||
   result.source!=="NCS_ACCOUNTS_V69_CANONICAL"||
   !Array.isArray(result.customers)||!Array.isArray(result.suppliers))
   throw Error("Unverified canonical ledger source");
 const parse=(x:unknown):NcsV49CanonicalRow=>{
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Bad canonical account");
  const r=x as Record<string,unknown>;
  const id=Number(r.id),due=Number(r.due),credit=Number(r.credit),paid=Number(r.paid);
  if(!Number.isSafeInteger(id)||!Number.isFinite(due)||!Number.isFinite(credit)||
    !Number.isFinite(paid)||due<0||typeof r.name!=="string")
    throw Error("Bad canonical account amounts");
  return {id,name:r.name,phone:typeof r.phone==="string"?r.phone:null,due,credit,paid,
   updated_at:typeof r.updated_at==="string"?r.updated_at:null,
   opening_adjustment:Number(r.opening_adjustment)||0,
   public_supplier_id:r.public_supplier_id==null?null:Number(r.public_supplier_id)};
 };
 return {ok:true,source:"NCS_ACCOUNTS_V69_CANONICAL",readOnly:true,
   customers:result.customers.map(parse),suppliers:result.suppliers.map(parse)};
}
