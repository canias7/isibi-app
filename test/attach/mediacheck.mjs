const { chromium } = await import(process.env.PLAYWRIGHT_PATH
  || "/opt/node22/lib/node_modules/playwright/index.mjs");
import { readFileSync } from "node:fs";
const OUT = process.env.ATTACH_OUT || "/tmp/attach-check";
const session=JSON.parse(readFileSync(`${OUT}/session.json`,"utf8"));
const b=await chromium.launch({args:["--no-sandbox"]});
const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();
await p.addInitScript((s)=>localStorage.setItem("zephyr_session_v1",JSON.stringify(s)),session);
await p.goto((process.env.APP_URL || "http://127.0.0.1:8099") + "/index.html",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(2500);
const out=await p.evaluate(()=>{
  const res={audio:[],image:[]};
  mode="video";
  // AUDIO: duration x size against every audio-taking model
  for (const m of Object.keys(MODEL_OPTS)) {
    model=m;
    if(!((currentOpts()||{}).caps||{}).audio) continue;
    for (const [dur,mb,type] of [[1,1,"audio/mpeg"],[5,1,"audio/mpeg"],[16,1,"audio/mpeg"],
                                 [61,1,"audio/mpeg"],[5,6,"audio/mpeg"],[5,20,"audio/mpeg"],
                                 [5,1,"audio/wav"]]) {
      attachments.audio="data:"+type+";base64,AAAA";
      awDur=dur; awSize=mb*1048576; awType=type;
      let issue=""; try{ issue=audioIssue(); }catch(e){ issue="(no audioIssue)"; }
      res.audio.push({model:m,dur,mb,type,verdict:issue?"REJECT":"accept",why:(issue||"").slice(0,52)});
      attachments.audio=null; awDur=0; awSize=0;
    }
  }
  // IMAGE: dimensions/aspect against the models that constrain them
  for (const m of Object.keys(MODEL_OPTS)) {
    model=m;
    if(!((currentOpts()||{}).caps||{}).image) continue;
    for (const [w,h] of [[1024,1024],[200,200],[4000,600],[600,4000],[512,300]]) {
      imgMeta.image={w,h};
      attachments.image="data:image/png;base64,AAAA";
      let issue=""; try{ issue=imageAttachIssue("image"); }catch(e){ issue="(err)"; }
      res.image.push({model:m,dims:w+"x"+h,verdict:issue?"REJECT":"accept",why:(issue||"").slice(0,52)});
      attachments.image=null; delete imgMeta.image;
    }
  }
  return res;
});
console.log(JSON.stringify(out));
await b.close();
