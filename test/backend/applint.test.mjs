// Generated-app linter tests — a clean app passes; targeted broken apps each trip the right rule. Pure (no
// harness/worker boot). This is the static half of "full generated-app testing" (meta-layer #4).
import { makeTally } from "./harness.mjs";
import { lintGeneratedApp } from "../../builder/app-linter.mjs";

const t = makeTally("App linter");

// A clean, well-formed generated app (as the raw ===FILE: === stream, to also exercise parseGeneratedFiles).
const GOOD = `===FILE: index.html===
<!doctype html><html><head><title>Task Board</title><meta name="description" content="A simple task board"></head>
<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
===FILE: src/index.css===
@tailwind base;@tailwind components;@tailwind utilities;
===FILE: src/main.jsx===
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
createRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>)
===FILE: src/App.jsx===
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
export default function App(){ return <Routes><Route path="/" element={<Home/>}/></Routes> }
===FILE: src/pages/Home.jsx===
import { useState } from 'react'
import { Plus } from 'lucide-react'
const API = '/api/db/' + (location.pathname.split('/')[2] || '')
export default function Home(){
  const [title,setTitle]=useState('')
  async function add(e){ e.preventDefault(); await fetch(API+'/rows/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})}); setTitle('') }
  return <form onSubmit={add}><input value={title} onChange={e=>setTitle(e.target.value)}/><button type="submit"><Plus/></button></form>
}
`;

let r = lintGeneratedApp(GOOD);
t.eq(r.ok, true, "a clean app passes with no errors");
t.eq(r.errors.length, 0, "…zero errors");
t.ok(r.routesSeen.includes("rows"), "…and the route scanner saw the rows call");

// Helper: start from the good file map and mutate.
const good = (typeof structuredClone === "function") ? () => structuredClone(parse(GOOD)) : () => ({ ...parse(GOOD) });
function parse(text){ const m={}; const parts=text.split(/^===FILE:\s*(.+?)\s*===[ \t]*$/gm); for(let i=1;i<parts.length;i+=2){ m[parts[i].trim()] = (parts[i+1]||'').replace(/^\r?\n/,'').replace(/\s+$/,''); } return m; }
const has = (res, rule) => res.errors.some((e) => e.rule === rule);
const warned = (res, rule) => res.warnings.some((w) => w.rule === rule);

// --- Missing required file ---
{ const f = good(); delete f["src/App.jsx"]; const res = lintGeneratedApp(f); t.eq(res.ok, false, "missing App.jsx fails"); t.ok(has(res, "required-file"), "…required-file error"); }

// --- Forbidden file ---
{ const f = good(); f["package.json"] = "{}"; const res = lintGeneratedApp(f); t.ok(has(res, "forbidden-file"), "emitting package.json → forbidden-file error"); }

// --- BrowserRouter ---
{ const f = good(); f["src/main.jsx"] = f["src/main.jsx"].replace(/HashRouter/g, "BrowserRouter"); const res = lintGeneratedApp(f); t.ok(has(res, "router"), "BrowserRouter → router error"); }

// --- Disallowed npm import ---
{ const f = good(); f["src/pages/Home.jsx"] = "import axios from 'axios'\n" + f["src/pages/Home.jsx"]; const res = lintGeneratedApp(f); t.ok(has(res, "import"), "importing axios → import error"); }

// --- Unresolved relative import ---
{ const f = good(); f["src/App.jsx"] = f["src/App.jsx"].replace("./pages/Home.jsx", "./pages/Missing.jsx"); const res = lintGeneratedApp(f); t.ok(has(res, "import"), "a relative import with no target file → import error"); }

// --- API call to a non-existent capability ---
{ const f = good(); f["src/pages/Home.jsx"] = f["src/pages/Home.jsx"].replace("/rows/tasks", "/totally-made-up/thing"); const res = lintGeneratedApp(f); t.eq(res.ok, false, "a call to a fake endpoint fails"); t.ok(has(res, "api-route"), "…api-route error (registry cross-check)"); }

// --- A REAL capability route passes the check ---
{ const f = good(); f["src/pages/Home.jsx"] = f["src/pages/Home.jsx"].replace("/rows/tasks", "/punch-cards/coffee/punch"); const res = lintGeneratedApp(f); t.eq(res.ok, true, "a real capability route (punch-cards) passes"); }

// --- External script ---
{ const f = good(); f["index.html"] = f["index.html"].replace("</body>", "<script src=\"https://cdn.example.com/x.js\"></script></body>"); const res = lintGeneratedApp(f); t.ok(has(res, "external") || res.errors.length > 0, "an external <script src=http…> is flagged"); }

// --- index.css without tailwind directives ---
{ const f = good(); f["src/index.css"] = "body{margin:0}"; const res = lintGeneratedApp(f); t.ok(has(res, "index-css"), "index.css without @tailwind → index-css error"); }

// --- index.html missing mount point ---
{ const f = good(); f["index.html"] = f["index.html"].replace('id="root"', 'id="app"'); const res = lintGeneratedApp(f); t.ok(has(res, "index-html"), "no #root → index-html error"); }

// --- Warnings: fake button + dead link (still ok:true) ---
{ const f = good(); f["src/pages/Home.jsx"] = f["src/pages/Home.jsx"].replace("<button type=\"submit\">", "<button onClick={() => {}}>") + "\n<a href=\"#\">dead</a>"; const res = lintGeneratedApp(f); t.ok(warned(res, "fake-button"), "empty onClick → fake-button warning"); }

// --- Empty output ---
{ const res = lintGeneratedApp(""); t.eq(res.ok, false, "empty output fails"); t.ok(has(res, "empty"), "…empty error"); }

t.done();
