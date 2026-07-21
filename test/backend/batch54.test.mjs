import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 54");

// TOTP generator (same RFC-6238 algorithm as the worker) for the test
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32dec(s){let bits=0,val=0;const out=[];for(const ch of s.toUpperCase().replace(/[^A-Z2-7]/g,"")){const i=B32.indexOf(ch);if(i<0)continue;val=(val<<5)|i;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&0xff);bits-=8;}}return new Uint8Array(out);}
async function totp(secret, off=0){
  const key=await crypto.subtle.importKey("raw",b32dec(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const buf=new Uint8Array(8);let ctr=Math.floor(Date.now()/1000/30)+off;for(let i=7;i>=0;i--){buf[i]=ctr&0xff;ctr=Math.floor(ctr/256);}
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,buf));const o=sig[sig.length-1]&0x0f;
  const bin=((sig[o]&0x7f)<<24)|(sig[o+1]<<16)|(sig[o+2]<<8)|sig[o+3];return String(bin%1000000).padStart(6,"0");
}

const slug="b54";
await c.ensure(slug);
let token=(await c.signup(slug,"a@x.dev","Str0ng-pass-9")).json.token;
// setup -> secret
let r=await c.post(`/api/db/${slug}/auth/2fa/setup`,{},{token});
t.ok(r.json.ok && /^[A-Z2-7]{32}$/.test(r.json.secret), "setup -> base32 secret");
t.ok(r.json.otpauth.startsWith("otpauth://totp/"), "setup -> otpauth URL for QR");
const secret=r.json.secret;
// enable with wrong code -> 403
t.ok((await c.post(`/api/db/${slug}/auth/2fa/enable`,{code:"000000"},{token})).status===403, "enable wrong code -> 403");
// enable with valid code
t.ok((await c.post(`/api/db/${slug}/auth/2fa/enable`,{code:await totp(secret)},{token})).json.enabled===true, "enable valid code -> on");
// login WITHOUT code -> 401 need:2fa
r=await c.login(slug,"a@x.dev","Str0ng-pass-9");
t.ok(r.status===401 && r.json.need==="2fa", "login without code -> 401 need:2fa");
// login with WRONG code -> 401
t.ok((await c.call("POST",`/api/db/${slug}/auth/login`,{body:{email:"a@x.dev",password:"Str0ng-pass-9",code:"000000"}})).status===401, "login wrong code -> 401");
// login with VALID code -> ok
r=await c.call("POST",`/api/db/${slug}/auth/login`,{body:{email:"a@x.dev",password:"Str0ng-pass-9",code:await totp(secret)}});
t.ok(r.json.ok && r.json.token, "login with valid code -> ok");
// wrong PASSWORD still fails even with a valid code
t.ok((await c.call("POST",`/api/db/${slug}/auth/login`,{body:{email:"a@x.dev",password:"WrongPass-123",code:await totp(secret)}})).status===401, "wrong password -> 401 (2fa doesn't bypass password)");
// disable requires a valid code
t.ok((await c.post(`/api/db/${slug}/auth/2fa/disable`,{code:"000000"},{token})).status===403, "disable wrong code -> 403");
t.ok((await c.post(`/api/db/${slug}/auth/2fa/disable`,{code:await totp(secret)},{token})).json.enabled===false, "disable valid code -> off");
// after disable, plain login works
t.ok((await c.login(slug,"a@x.dev","Str0ng-pass-9")).json.ok, "after disable -> plain login works");
// 2fa endpoints need auth
t.ok((await c.post(`/api/db/${slug}/auth/2fa/setup`,{})).status===401, "setup needs auth -> 401");
t.done(); h.restore();
