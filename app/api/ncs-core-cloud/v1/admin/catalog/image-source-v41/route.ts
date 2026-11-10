import "server-only";
import {ownerSessionValid} from "@/lib/ncs-neon-vercel-owner-session";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const MAX=8*1024*1024;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const fail=(error:string,status:number)=>Response.json({ok:false,error},{status,headers});
/** Owner-only bounded R2 byte read. Browser performs JPEG conversion from this
 * same-origin response; no sharp/native binary, redirect following or public proxy. */
export async function GET(req:Request){
 if(!ownerSessionValid(req))return fail('OWNER_LOGIN_REQUIRED',401);
 const source=new URL(req.url).searchParams.get('src')||'';
 if(source.length>2048)return fail('INVALID_IMAGE_SOURCE',400);
 let url:URL;
 try {
  const base=new URL(process.env.R2_PUBLIC_BASE_URL||'');url=new URL(source);
  if(base.protocol!=='https:'||url.protocol!=='https:'||url.origin!==base.origin||
    url.username||url.password||!url.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/'))
   return fail('IMAGE_SOURCE_NOT_ALLOWED',400);
 }catch{return fail('IMAGE_SOURCE_NOT_ALLOWED',400);}
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try {
  const upstream=await fetch(url,{cache:'no-store',redirect:'error',signal:controller.signal});
  if(!upstream.ok)return fail('SOURCE_IMAGE_UNAVAILABLE',502);
  const type=(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!['image/webp','image/jpeg','image/jpg','image/png'].includes(type))return fail('SOURCE_NOT_SUPPORTED_IMAGE',415);
  if(Number(upstream.headers.get('content-length')||0)>MAX)return fail('SOURCE_IMAGE_TOO_LARGE',413);
  if(!upstream.body)return fail('EMPTY_SOURCE_IMAGE',502);
  const reader=upstream.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try {
   while(true){const part=await reader.read();if(part.done)break;
    total+=part.value.byteLength;if(total>MAX){await reader.cancel();return fail('SOURCE_IMAGE_TOO_LARGE',413);}
    chunks.push(part.value);
   }
  }finally{reader.releaseLock();}
  if(!total)return fail('EMPTY_SOURCE_IMAGE',502);
  const output=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}
  return new Response(output.buffer as ArrayBuffer,{headers:{...headers,'Content-Type':type,'Content-Length':String(total)}});
 }catch{return fail(controller.signal.aborted?'IMAGE_SOURCE_TIMEOUT':'IMAGE_SOURCE_FETCH_FAILED',502);}
 finally{clearTimeout(timer);}
}
