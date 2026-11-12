import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { installed, verifyOwnerPassword, createOwnerCookie, clearOwnerCookie, ownerSessionValid, renewOwnerCookieOnStatus } from "@/lib/ncs-neon-vercel-owner-session";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const respond=(data:Record<string,unknown>,status=200)=>NextResponse.json(data,{status,headers});
const attempts=new Map<string,{count:number,until:number}>();
export async function GET(req:NextRequest){
 const authenticated=ownerSessionValid(req);
 const res=respond({ok:true,configured:installed(),authenticated});
 if(authenticated)renewOwnerCookieOnStatus(req,res);
 return res;
}
export async function POST(req:NextRequest){
 if(!installed())return respond({ok:false,code:"OWNER_LOGIN_NOT_CONFIGURED"},503);
 const origin=req.headers.get("origin");
 if(origin){
  let valid=false;
  try{
   const u=new URL(origin),t=new URL(req.url);
   const local=(h:string)=>h==="localhost"||h==="127.0.0.1";
   valid=u.origin===t.origin || (u.protocol==="http:"&&t.protocol==="http:"&&local(u.hostname)&&local(t.hostname)&&u.port===t.port);
  }catch{valid=false;}
  if(!valid)return respond({ok:false,code:"ORIGIN_NOT_ALLOWED"},403);
 }
 const authorization=req.headers.get("authorization")||"";
 if(authorization){
  const bearer=/^Bearer\s+([^\s]{20,8192})$/i.exec(authorization);
  if(!bearer)return respond({ok:false,code:"INVALID_OWNER_TOKEN"},401);
  const authUrl=process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_URL||"https://uskpoaszucenqxlzgmcy.supabase.co";
  const anon=process.env.NEXT_PUBLIC_NCS_OWNER_AUTH_ANON_KEY||"";
  if(!anon||!authUrl.startsWith("https://"))return respond({ok:false,code:"OWNER_AUTH_PROVIDER_NOT_CONFIGURED"},503);
  try{
   const client=createClient(authUrl,anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const {data,error}=await client.auth.getUser(bearer[1]);
   if(error||!data.user||data.user.email?.trim().toLowerCase()!=="badri.nsv@gmail.com")return respond({ok:false,code:"OWNER_IDENTITY_NOT_VERIFIED"},401);
   const res=respond({ok:true,authenticated:true});createOwnerCookie(res,req);return res;
  }catch{return respond({ok:false,code:"OWNER_AUTH_PROVIDER_UNAVAILABLE"},503);}
 }
 const length=Number(req.headers.get("content-length")||0);
 if(length>4096)return respond({ok:false,code:"INVALID_REQUEST"},413);
 let payload:Record<string,unknown>;
 try{const raw=await req.text();if(Buffer.byteLength(raw)>4096)return respond({ok:false,code:"INVALID_REQUEST"},413);payload=JSON.parse(raw);}
 catch{return respond({ok:false,code:"INVALID_REQUEST"},400);}
 if(typeof payload.email!=="string"||typeof payload.password!=="string"||payload.email.length>254||payload.password.length>1024)return respond({ok:false,code:"INVALID_REQUEST"},400);
 const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim().slice(0,128);
 const now=Date.now();if(attempts.size>5000)attempts.clear();
 const prev=attempts.get(ip);if(prev&&prev.until>now&&prev.count>=5)return respond({ok:false,code:"TOO_MANY_ATTEMPTS"},429);
 if(!await verifyOwnerPassword(payload.email,payload.password)){
  attempts.set(ip,{count:(prev&&prev.until>now?prev.count:0)+1,until:now+15*60*1000});
  return respond({ok:false,code:"INVALID_OWNER_CREDENTIALS"},401);
 }
 attempts.delete(ip);
 const res=respond({ok:true});createOwnerCookie(res,req);return res;
}
export async function DELETE(req:NextRequest){const res=respond({ok:true});clearOwnerCookie(res,req);return res;}
