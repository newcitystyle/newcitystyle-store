import { createHmac, scrypt as scryptCallback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-ncs-owner-session" : "ncs-owner-session-local";
const cookieSecure = process.env.NODE_ENV === "production";
// V271: Only the desktop's exact loopback HTTP origin gets a non-Secure,
// host-only HttpOnly signed cookie. Internet production always uses __Host + Secure.
const DESKTOP_ORIGIN_V271 = "http://127.0.0.1:32145";
// V273_LOOPBACK_COOKIE_CANONICALIZATION: Next.js may construct request.url from
// an internal forwarded hostname while the browser is on 127.0.0.1:32145.
// Only the exact local Host is recognized; remote/public hosts are not trusted.
function desktopRequestV271(request?: Request): boolean {
 if (!request) return false;
 try {
  const host = request.headers.get("host") || "";
  const url = new URL(request.url);
  if (host !== "127.0.0.1:32145") return false;
  if (url.protocol !== "http:") return false;
  return (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
         (url.port === "32145" || url.port === "");
 } catch { return false; }
}
function cookieNameV271(request?: Request): string {
 return desktopRequestV271(request) ? "ncs-owner-session-desktop-v271" : COOKIE_NAME;
}
// Owner is a long-lived trusted-browser session, not a forever-valid password/token.
// Activity extends the lifetime by reissuing a fresh signed HttpOnly cookie;
// unused or revoked sessions still expire and require authentication.
const maxAge = 90 * 24 * 60 * 60;
const renewWithinMs = 21 * 24 * 60 * 60 * 1000;
const ownerEmail = "badri.nsv@gmail.com";
function secrets(){
 const v=process.env.NCS_NEON_OWNER_PASSWORD_VERIFIER || "";
 const k=process.env.NCS_NEON_OWNER_SESSION_SECRET || "";
 if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(v) || k.length<48) return null;
 return {v,k};
}
function sign(value:string,key:string){return createHmac("sha256",key).update(value).digest("base64url");}
function eq(a:string,b:string){const ab=Buffer.from(a);const bb=Buffer.from(b);return ab.length===bb.length&&timingSafeEqual(ab,bb);}
export function installed(){return Boolean(secrets());}
export async function verifyOwnerPassword(email:string,password:string){
 const c=secrets(); if(!c||email.trim().toLowerCase()!==ownerEmail||password.length>1024) return false;
 const [,salt,expected]=c.v.split("$");
 const actual=(await scrypt(password,Buffer.from(salt,"hex"),64)) as Buffer;
 return eq(actual.toString("hex"),expected);
}
export function createOwnerCookie(response:NextResponse, request?:Request){
 const c=secrets();if(!c)throw new Error("OWNER_SESSION_NOT_CONFIGURED");
 const until=Date.now()+maxAge*1000;
 const nonce=randomBytes(16).toString("base64url");
 const payload=Buffer.from(JSON.stringify({v:1,sub:"ncs-owner",exp:until,nonce})).toString("base64url");
 response.cookies.set(cookieNameV271(request),`${payload}.${sign(payload,c.k)}`,{httpOnly:true,secure:desktopRequestV271(request)?false:cookieSecure,sameSite:"strict",path:"/",maxAge});
}
export function clearOwnerCookie(response:NextResponse, request?:Request){response.cookies.set(cookieNameV271(request),"",{httpOnly:true,secure:desktopRequestV271(request)?false:cookieSecure,sameSite:"strict",path:"/",maxAge:0});}
function verifiedOwnerCookieExpiry(req: Request): number | null {
 const c=secrets(); if(!c) return null;
 const name=cookieNameV271(req);
 const raw=req.headers.get("cookie")?.split(";").map(x=>x.trim())
   .find(x=>x.startsWith(`${name}=`))?.slice(name.length+1);
 if(!raw || raw.length>1024) return null;
 const dot=raw.lastIndexOf("."); if(dot<1) return null;
 const payload=raw.slice(0,dot), mac=raw.slice(dot+1);
 if(!eq(sign(payload,c.k),mac)) return null;
 try {
   const obj=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
   const now=Date.now();
   if(obj.v!==1 || obj.sub!=="ncs-owner" || !Number.isFinite(obj.exp)
      || obj.exp<=now || obj.exp>now+maxAge*1000+60000) return null;
   return obj.exp as number;
 } catch { return null; }
}
export function ownerSessionValid(req: Request) { return verifiedOwnerCookieExpiry(req)!==null; }
/** Reissue only for a still-authenticated owner. Invalid cookies never renew. */
export function renewOwnerCookieOnStatus(req: Request, res: NextResponse) {
 const exp=verifiedOwnerCookieExpiry(req);
 if(exp!==null && exp-Date.now()<=renewWithinMs) createOwnerCookie(res,req);
}
