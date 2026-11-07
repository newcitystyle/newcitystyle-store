import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireRecoveryAdmin } from "@/lib/ncs-recovery-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const H = { "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff", Vary:"Authorization" };
const TABLES = ["products","product_variants","pos_sales","sale_items","purchases","purchase_items","customers","suppliers","customer_payments","supplier_payments","cash_bank_transactions","expenses"] as const;
type Table = typeof TABLES[number];
const TABLE_SET: ReadonlySet<string> = new Set(TABLES);
const fail = (code:string,status:number) => Response.json({ok:false,code},{status,headers:H});

export async function GET(request: Request) {
  if (!/^Bearer\s+\S+$/i.test(request.headers.get("authorization") || "")) return fail("OWNER_TOKEN_REQUIRED",401);
  let authorization: Awaited<ReturnType<typeof requireRecoveryAdmin>>;
  try { authorization = await requireRecoveryAdmin(request); }
  catch { return fail("OWNER_AUTH_UNAVAILABLE",503); }
  if (!authorization.ok) return fail("OWNER_AUTH_DENIED",403);
  const url = new URL(request.url);
  const table = url.searchParams.get("table") || "";
  if (!TABLE_SET.has(table)) return fail("UNKNOWN_DATASET",400);
  const take = url.searchParams.get("limit") || "50";
  const skip = url.searchParams.get("offset") || "0";
  if (!/^\d{1,3}$/.test(take) || !/^\d{1,8}$/.test(skip)) return fail("INVALID_PAGE",400);
  const limit=Number(take),offset=Number(skip);
  if(limit<1 || limit>100 || offset>1000000) return fail("PAGE_OUT_OF_RANGE",400);
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
  if(!base || !key) return fail("SUPABASE_SERVER_CONFIG_MISSING",503);
  try {
    const db=createClient(base,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const result=await db.from(table as Table).select("*").order("id",{ascending:true}).range(offset,offset+limit);
    if(result.error) return fail("CLOUD_DATASET_UNAVAILABLE",503);
    if(!Array.isArray(result.data)) return fail("INVALID_CLOUD_RESPONSE",503);
    const hasMore=result.data.length>limit;
    return Response.json({ok:true,version:"V380",source:"SUPABASE_OWNER_LIVE",dataset:table,rows:result.data.slice(0,limit),offset,limit,nextOffset:hasMore?offset+limit:null,hasMore,fetchedAt:new Date().toISOString(),writable:false,note:"Paged cloud read. Do not interpret as an atomic cross-table snapshot."},{headers:H});
  } catch { return fail("CLOUD_READ_FAILED",503); }
}
export async function POST(){return fail("WRITES_NOT_ENABLED",405);}
export async function PUT(){return fail("WRITES_NOT_ENABLED",405);}
export async function DELETE(){return fail("WRITES_NOT_ENABLED",405);}
