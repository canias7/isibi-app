// The sheet. State is { months: { "YYYY-MM": { expenses: [...], income: [...] } } };
// a row is { id, section?, extra?, app, what, amount }.
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Math.random().toString(36).slice(2, 10);
const ym = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const label = (k) => { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" }); };

let state = { months: {} };
let current = ym(new Date());
let view = "month"; // or "year"
let selected = null; // { list: "expenses"|"income", id }

const fresh = () => ({
  expenses: MONEY_DEFAULTS.expenses.map((r) => ({ id: uid(), amount: 0, ...r })),
  income: MONEY_DEFAULTS.income.map((r) => ({ id: uid(), amount: 0, ...r })),
});
// A new month copies the rows of the latest month (bills repeat), amounts kept.
function newMonth(key) {
  const keys = Object.keys(state.months).sort();
  const last = keys.length ? state.months[keys[keys.length - 1]] : null;
  state.months[key] = last
    ? { expenses: last.expenses.map((r) => ({ ...r, id: uid() })), income: last.income.map((r) => ({ ...r, id: uid() })) }
    : fresh();
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { await window.money.save(state); $("saved").textContent = "Saved"; setTimeout(() => ($("saved").textContent = ""), 1200); }, 300);
}

const sum = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
const monthRows = () => (view === "year" ? yearRows() : state.months[current]);
// The year view sums each row (by section + app + what) across the year's months; read-only.
function yearRows() {
  const y = current.slice(0, 4);
  const acc = { expenses: new Map(), income: new Map() };
  for (const [k, m] of Object.entries(state.months)) {
    if (!k.startsWith(y)) continue;
    for (const list of ["expenses", "income"]) for (const r of m[list]) {
      const key = [r.section || "", r.extra ? 1 : 0, r.app, r.what].join("|");
      const cur = acc[list].get(key) || { ...r, id: key, amount: 0 };
      cur.amount += Number(r.amount) || 0;
      acc[list].set(key, cur);
    }
  }
  return { expenses: [...acc.expenses.values()], income: [...acc.income.values()] };
}

function cell(list, r, field, cls) {
  if (view === "year") return `<td class="ro ${cls || ""}">${field === "amount" ? money(r.amount) : esc(r[field] || "")}</td>`;
  const v = field === "amount" ? (Number(r.amount) || 0).toFixed(2) : esc(r[field] || "");
  return `<td class="${cls || ""}"><input data-list="${list}" data-id="${r.id}" data-f="${field}" value="${v}"${field === "amount" ? ' inputmode="decimal"' : ""}></td>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function render() {
  const m = monthRows();
  let n = 1;
  const head = (a, b) => `<tr class="cols"><td class="rn"></td><td>A</td><td>B</td><td>C</td></tr><tr class="hdr"><td class="rn">1</td><td>${a}</td><td>${b}</td><td class="num">Amount</td></tr>`;
  const row = (list, r) => `<tr class="${r.extra ? "xtra" : "main"}${selected && selected.id === r.id ? " sel" : ""}" data-list="${list}" data-id="${r.id}"><td class="rn">${++n}</td>${cell(list, r, "app")}${cell(list, r, "what")}${cell(list, r, "amount", "num")}</tr>`;
  const div = (t) => `<tr class="div"><td class="rn">${++n}</td><td colspan="3">${t}</td></tr>`;
  const sub = (t, v) => `<tr class="sub"><td class="rn">${++n}</td><td class="ro"></td><td class="ro">${t}</td><td class="ro num">${money(v)}</td></tr>`;
  const P = m.expenses.filter((r) => r.section === "platform"), B = m.expenses.filter((r) => r.section !== "platform");
  const E = sum(m.expenses), I = sum(m.income);
  $("exT").innerHTML = head("App", "What it's for") + div("PLATFORM — gofarther.dev") + P.map((r) => row("expenses", r)).join("") + sub("Platform subtotal", sum(P))
    + div("BUILDER — customer sites") + B.map((r) => row("expenses", r)).join("") + sub("Builder subtotal", sum(B))
    + `<tr class="total"><td class="rn">${++n}</td><td class="ro"></td><td class="ro">Total</td><td class="ro num ex">${money(E)}</td></tr>`;
  n = 1;
  $("inT").innerHTML = head("Source", "Via") + m.income.map((r) => row("income", r)).join("")
    + `<tr class="total"><td class="rn">${++n}</td><td class="ro"></td><td class="ro">Total</td><td class="ro num in">${money(I)}</td></tr>`;
  $("tIn").textContent = money(I); $("tEx").textContent = money(E);
  $("tPr").textContent = money(I - E); $("tPr").className = I - E < 0 ? "ex" : "";
  const keys = Object.keys(state.months).sort().reverse();
  $("month").innerHTML = keys.map((k) => `<option value="${k}"${k === current ? " selected" : ""}>${label(k)}</option>`).join("");
  $("tabs").innerHTML = keys.slice(0, 6).map((k) => `<span data-k="${k}" class="${view === "month" && k === current ? "on" : ""}">${label(k).split(" ")[0]}</span>`).join("")
    + `<span data-year="1" class="${view === "year" ? "on" : ""}">Year ${current.slice(0, 4)}</span>`;
  for (const id of ["addP", "addB", "addX", "addI", "del"]) $(id).disabled = view === "year";
}

document.addEventListener("input", (e) => {
  const t = e.target; if (!t.dataset || !t.dataset.f) return;
  const r = state.months[current][t.dataset.list].find((x) => x.id === t.dataset.id); if (!r) return;
  r[t.dataset.f] = t.dataset.f === "amount" ? parseFloat(t.value.replace(/[^0-9.\-]/g, "")) || 0 : t.value;
  persist();
  // Totals update without redrawing the cell being typed in.
  const m = state.months[current], E = sum(m.expenses), I = sum(m.income);
  $("tIn").textContent = money(I); $("tEx").textContent = money(E); $("tPr").textContent = money(I - E);
});
// Redraw after the edit settles (formats the number, updates subtotals); deferred so
// it never runs inside the browser's own blur handling.
document.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.f === "amount") setTimeout(render, 0); });
document.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (tr) { selected = { list: tr.dataset.list, id: tr.dataset.id }; document.querySelectorAll("tr.sel").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel"); }
  const tab = e.target.closest(".tabs span");
  if (tab) { if (tab.dataset.year) view = "year"; else { view = "month"; current = tab.dataset.k; } selected = null; render(); }
});
$("month").onchange = (e) => { current = e.target.value; view = "month"; selected = null; render(); };
$("newMonth").onclick = () => {
  const keys = Object.keys(state.months).sort();
  const [y, m] = (keys[keys.length - 1] || ym(new Date())).split("-").map(Number);
  const key = ym(new Date(y, m, 1));
  if (!state.months[key]) newMonth(key);
  current = key; view = "month"; render(); persist();
};
const add = (list, extra) => {
  const m = state.months[current];
  if (extra) {
    if (!selected || selected.list !== "expenses") return alert("Click a row in Expenses first.");
    const i = m.expenses.findIndex((r) => r.id === selected.id);
    let j = i + 1; while (j < m.expenses.length && m.expenses[j].extra) j++;
    m.expenses.splice(j, 0, { id: uid(), section: m.expenses[i].section, extra: true, app: "↳ extra", what: "", amount: 0 });
  } else m[list === "income" ? "income" : "expenses"].push({ id: uid(), section: list === "income" ? undefined : list, app: "", what: "", amount: 0 });
  render(); persist();
};
$("addP").onclick = () => add("platform");
$("addB").onclick = () => add("builder");
$("addX").onclick = () => add("builder", true);
$("addI").onclick = () => add("income");
$("del").onclick = () => {
  if (!selected) return alert("Click a row first.");
  const m = state.months[current], list = m[selected.list];
  const r = list.find((x) => x.id === selected.id);
  if (!r || !confirm(`Delete "${r.app || "this row"}"?`)) return;
  m[selected.list] = list.filter((x) => x.id !== selected.id);
  selected = null; render(); persist();
};
$("csv").onclick = () => {
  const m = monthRows();
  const q = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const lines = [["Side", "Section", "App", "What", "Amount"].map(q).join(",")];
  for (const r of m.expenses) lines.push(["Expense", r.section || "", r.app, r.what, (Number(r.amount) || 0).toFixed(2)].map(q).join(","));
  for (const r of m.income) lines.push(["Income", "", r.app, r.what, (Number(r.amount) || 0).toFixed(2)].map(q).join(","));
  window.money.exportCsv(`go-farther-money-${view === "year" ? current.slice(0, 4) : current}.csv`, lines.join("\n"));
};

(async () => {
  const saved = await window.money.load();
  if (saved && saved.months) state = saved;
  if (!state.months[current]) { newMonth(current); persist(); }
  render();
})();
