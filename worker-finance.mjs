// Pure stateless finance/money helpers extracted from worker.js (meta-layer #5: modularizing the
// monolith). No request-scope dependencies — imported back into worker.js. Behavior is byte-for-byte identical.
export function toCents(v) { const n = Number(v); if (!Number.isFinite(n)) return null; return Math.round(n * 100); }
// Depreciation schedule (stateless calculator) — straight-line or declining-balance. Cents
// throughout so it ties out exactly: the final period absorbs any rounding residual so
// total depreciation = cost − salvage to the cent, and book value ends exactly at salvage.
// Pairs with recurring journals (post each period's amount) + a normal assets table.
export function depreciationSchedule(opts) {
  const costC = toCents(opts.cost); if (costC == null || costC <= 0) return { err: "cost must be a positive number" };
  const salvageC = opts.salvage != null && opts.salvage !== "" ? toCents(opts.salvage) : 0;
  if (salvageC == null || salvageC < 0) return { err: "salvage must be ≥ 0" };
  if (salvageC > costC) return { err: "salvage can't exceed cost" };
  const life = Math.floor(Number(opts.life));
  if (!Number.isFinite(life) || life < 1 || life > 1200) return { err: "life must be 1–1200 periods" };
  const m = String(opts.method || "straight_line").toLowerCase();
  const isDB = m === "declining_balance" || m === "declining" || m === "ddb" || m === "double_declining";
  const depreciable = costC - salvageC;
  const sched = []; let book = costC, acc = 0;
  if (isDB) {
    let factor = Number(opts.factor); if (!Number.isFinite(factor) || factor < 1 || factor > 5) factor = 2;
    const rate = factor / life;
    for (let p = 1; p <= life; p++) {
      let dep;
      if (p === life) dep = book - salvageC; // final period cleans up any residual
      else { dep = Math.round(book * rate); if (book - dep < salvageC) dep = book - salvageC; if (dep < 0) dep = 0; }
      book -= dep; acc += dep;
      sched.push({ period: p, depreciation: dep / 100, accumulated: acc / 100, book_value: book / 100 });
    }
  } else {
    const per = Math.round(depreciable / life);
    for (let p = 1; p <= life; p++) {
      const dep = p === life ? (depreciable - per * (life - 1)) : per;
      book -= dep; acc += dep;
      sched.push({ period: p, depreciation: dep / 100, accumulated: acc / 100, book_value: book / 100 });
    }
  }
  // Optional per-period dates from a start + frequency.
  const start = /^\d{4}-\d{2}-\d{2}/.test(String(opts.start || "")) ? String(opts.start).slice(0, 10) : null;
  const freq = String(opts.freq || "").toLowerCase();
  if (start && ["month", "quarter", "year"].includes(freq)) {
    const [y, mo, d] = start.split("-").map(Number); const step = freq === "year" ? 12 : freq === "quarter" ? 3 : 1;
    for (let i = 0; i < sched.length; i++) { const dt = new Date(Date.UTC(y, mo - 1, d)); dt.setUTCMonth(dt.getUTCMonth() + i * step); sched[i].date = dt.toISOString().slice(0, 10); }
  }
  return { method: isDB ? "declining_balance" : "straight_line", cost: costC / 100, salvage: salvageC / 100, life, total_depreciable: depreciable / 100, schedule: sched };
}
// Loan amortization schedule (stateless calculator) — a level-payment (annuity) loan, cents
// throughout so it ties out: principal is repaid to the exact cent (the final period clears any
// residual). Powers mortgages, auto/BNPL/loan-management (LMS), lease schedules. Optional `extra`
// principal per period pays the loan off early (fewer periods, less interest). Pairs with the
// ledger (post each period's interest + principal) + a normal loans table.
export function amortizationSchedule(opts) {
  const principalC = toCents(opts.principal); if (principalC == null || principalC <= 0) return { err: "principal must be a positive number" };
  const rate = Number(opts.rate); if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { err: "rate must be an annual percentage 0–1000" };
  const term = Math.floor(Number(opts.term)); if (!Number.isFinite(term) || term < 1 || term > 1200) return { err: "term must be 1–1200 periods" };
  let freq = Math.floor(Number(opts.freq)); if (!Number.isFinite(freq) || freq < 1 || freq > 366) freq = 12; // payments per year (12 = monthly)
  const extraC = (opts.extra != null && opts.extra !== "") ? (toCents(opts.extra) || 0) : 0;
  if (extraC < 0) return { err: "extra must be ≥ 0" };
  const r = rate / 100 / freq; // periodic rate
  let paymentC = r === 0 ? Math.round(principalC / term) : Math.round(principalC * r / (1 - Math.pow(1 + r, -term)));
  if (paymentC < 1) paymentC = 1;
  const sched = []; let balance = principalC, totalInterest = 0;
  for (let p = 1; p <= term; p++) {
    const interest = Math.round(balance * r);
    let principalPay = paymentC + extraC - interest, pay = paymentC + extraC;
    if (p === term || principalPay >= balance) { principalPay = balance; pay = balance + interest; } // last period / early payoff clears the remainder
    if (principalPay < 0) { principalPay = 0; pay = interest; }
    balance -= principalPay; totalInterest += interest;
    sched.push({ period: p, payment: pay / 100, interest: interest / 100, principal: principalPay / 100, balance: balance / 100 });
    if (balance <= 0) { balance = 0; break; }
  }
  const start = /^\d{4}-\d{2}-\d{2}/.test(String(opts.start || "")) ? String(opts.start).slice(0, 10) : null;
  const monthsPer = { 12: 1, 6: 2, 4: 3, 3: 4, 2: 6, 1: 12 }[freq]; // payments/yr → months between payments (common cases)
  if (start && monthsPer) { const [y, mo, d] = start.split("-").map(Number); for (let i = 0; i < sched.length; i++) { const dt = new Date(Date.UTC(y, mo - 1, d)); dt.setUTCMonth(dt.getUTCMonth() + (i + 1) * monthsPer); sched[i].date = dt.toISOString().slice(0, 10); } }
  return { principal: principalC / 100, rate, term, freq, payment: paymentC / 100, periods: sched.length, total_interest: totalInterest / 100, total_paid: (principalC + totalInterest) / 100, schedule: sched };
}
// Capital-budgeting / investment analysis (stateless calculator) — given a series of period net
// cashflows (index 0 = t0, usually the negative up-front investment) and a discount rate, compute
// NPV, IRR (solved numerically), payback + discounted payback, and the profitability index. Powers
// FP&A / CPM / EPM "should we do this project?" analysis. Any signed-in member (touches no data).
export function investmentAnalysis(opts) {
  const raw = opts.cashflows || opts.cash_flows || opts.flows;
  if (!Array.isArray(raw) || raw.length < 2) return { err: "cashflows must be an array of ≥2 period amounts (t0 first)" };
  const cf = raw.slice(0, 600).map((x) => Number((x && typeof x === "object") ? (x.amount != null ? x.amount : x.value) : x));
  if (cf.some((x) => !Number.isFinite(x))) return { err: "every cashflow must be a number" };
  const rate = Number(opts.rate);
  if (!Number.isFinite(rate) || rate <= -100 || rate > 100000) return { err: "rate must be a percentage > -100" };
  const r = rate / 100;
  const npvAt = (rr) => { let s = 0; for (let t = 0; t < cf.length; t++) s += cf[t] / Math.pow(1 + rr, t); return s; };
  const npv = npvAt(r);
  // IRR — scan for the first sign change in NPV(rate), then bisect to the root.
  let irr = null;
  { let prev = npvAt(-0.99);
    for (let g = -0.98; g <= 10.0001; g = Math.round((g + 0.01) * 1e6) / 1e6) {
      const cur = npvAt(g);
      if (Number.isFinite(prev) && Number.isFinite(cur) && (prev <= 0) !== (cur <= 0)) {
        let a = g - 0.01, b = g, fa = npvAt(a), mid = (a + b) / 2;
        for (let i = 0; i < 200; i++) { mid = (a + b) / 2; const fm = npvAt(mid); if (Math.abs(fm) < 1e-9 || (b - a) < 1e-12) break; if ((fa <= 0) !== (fm <= 0)) b = mid; else { a = mid; fa = fm; } }
        irr = Math.round(mid * 1e6) / 1e6; break;
      }
      prev = cur;
    }
  }
  // Payback (fractional): the time cumulative cashflow first turns non-negative. `disc` = discounted.
  const payback = (disc) => {
    let cum = 0;
    for (let t = 0; t < cf.length; t++) {
      const v = disc ? cf[t] / Math.pow(1 + r, t) : cf[t];
      const before = cum; cum += v;
      if (before < 0 && cum >= 0) return Math.round(((t - 1) + (v !== 0 ? (-before) / v : 0)) * 1e6) / 1e6;
    }
    return null;
  };
  let pvIn = 0, pvOut = 0, totalIn = 0, totalOut = 0;
  for (let t = 0; t < cf.length; t++) { const d = cf[t] / Math.pow(1 + r, t); if (cf[t] >= 0) { pvIn += d; totalIn += cf[t]; } else { pvOut += -d; totalOut += -cf[t]; } }
  const c2 = (x) => Math.round(x * 100) / 100;
  return {
    rate, npv: c2(npv), irr, irr_pct: irr != null ? Math.round(irr * 1e4) / 100 : null,
    payback_period: payback(false), discounted_payback: payback(true),
    profitability_index: pvOut > 0 ? Math.round((pvIn / pvOut) * 1e6) / 1e6 : null,
    total_inflow: c2(totalIn), total_outflow: c2(totalOut), periods: cf.length - 1,
  };
}
// Inverse standard-normal CDF (Acklam's rational approximation) — the z-score for a probability.
// Used to turn a service level (e.g. 95%) into a safety-stock multiplier. Returns null out of range.
function invNorm(p) {
  if (!(p > 0 && p < 1)) return null;
  const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2, 1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0];
  const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2, 6.680131188771972e+1, -1.328068155288572e+1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0, -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0, 3.754408661907416e+0];
  const plow = 0.02425, phigh = 1 - plow; let q, r;
  if (p < plow) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p <= phigh) { q = p - 0.5; r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}
// EOQ (economic order quantity, stateless) — the order size that minimizes total (ordering +
// holding) cost, plus orders/year, cycle time, and total annual cost. Optionally computes the
// reorder point (demand over the lead time + safety stock) — safety stock from an explicit value
// or a service level + daily demand σ. Powers IMS/SCM/WMS inventory planning.
export function eoqCalc(opts) {
  const D = Number(opts.demand), S = Number(opts.order_cost != null ? opts.order_cost : opts.orderCost), H = Number(opts.holding_cost != null ? opts.holding_cost : opts.holdingCost);
  if (!Number.isFinite(D) || D <= 0) return { err: "demand (annual) must be positive" };
  if (!Number.isFinite(S) || S <= 0) return { err: "order_cost must be positive" };
  if (!Number.isFinite(H) || H <= 0) return { err: "holding_cost (per unit per year) must be positive" };
  const eoq = Math.sqrt(2 * D * S / H), ordersPerYear = D / eoq;
  const r2 = (x) => Math.round(x * 100) / 100;
  const out = { eoq: r2(eoq), eoq_rounded: Math.ceil(eoq), orders_per_year: r2(ordersPerYear), cycle_time_days: r2(365 / ordersPerYear), annual_order_cost: r2(ordersPerYear * S), annual_holding_cost: r2((eoq / 2) * H), total_annual_cost: r2(ordersPerYear * S + (eoq / 2) * H) };
  const lead = Number(opts.lead_time != null ? opts.lead_time : opts.leadTime);
  if (Number.isFinite(lead) && lead >= 0) {
    const dailyD = D / 365; let ss = 0;
    const explicitSS = Number(opts.safety_stock != null ? opts.safety_stock : opts.safetyStock);
    const sigma = Number(opts.demand_std != null ? opts.demand_std : opts.demandStd);
    const sl = Number(opts.service_level != null ? opts.service_level : opts.serviceLevel);
    if (Number.isFinite(explicitSS) && explicitSS >= 0) ss = explicitSS;
    else if (Number.isFinite(sigma) && sigma >= 0 && Number.isFinite(sl) && sl > 0 && sl < 100) { const z = invNorm(sl / 100); if (z != null) { ss = z * sigma * Math.sqrt(lead); out.z = r2(z); } }
    ss = Math.max(0, ss);
    out.demand_during_lead = r2(dailyD * lead); out.safety_stock = r2(ss); out.reorder_point = r2(dailyD * lead + ss);
  }
  return out;
}
// Break-even / CVP (cost-volume-profit, stateless) — the units + revenue at which contribution
// covers fixed cost, contribution margin + ratio, optional target-profit volume, and (given a
// unit count) profit + margin of safety. Cents throughout for the money. Powers pricing/planning.
export function breakevenCalc(opts) {
  const priceC = toCents(opts.price), vcC = toCents(opts.variable_cost != null ? opts.variable_cost : opts.variableCost), fcC = toCents(opts.fixed_cost != null ? opts.fixed_cost : opts.fixedCost);
  if (priceC == null || priceC <= 0) return { err: "price must be a positive number" };
  if (vcC == null || vcC < 0) return { err: "variable_cost must be ≥ 0" };
  if (fcC == null || fcC < 0) return { err: "fixed_cost must be ≥ 0" };
  const cmC = priceC - vcC;
  if (cmC <= 0) return { err: "no break-even: price must exceed variable cost" };
  const beUnits = fcC / cmC, r4 = (x) => Math.round(x * 1e4) / 1e4;
  const out = {
    contribution_margin: cmC / 100, cm_ratio: Math.round((cmC / priceC) * 1e4) / 1e4,
    break_even_units: r4(beUnits), break_even_units_rounded: Math.ceil(beUnits),
    break_even_revenue: Math.round(fcC * priceC / cmC) / 100,
  };
  const tpRaw = opts.target_profit != null ? opts.target_profit : opts.targetProfit;
  if (tpRaw != null && tpRaw !== "") { const tp = toCents(tpRaw); if (tp != null && tp >= 0) { const u = (fcC + tp) / cmC; out.target_profit = tp / 100; out.units_for_target = r4(u); out.units_for_target_rounded = Math.ceil(u); } }
  const units = Number(opts.units);
  if (Number.isFinite(units) && units >= 0) {
    out.units = units; out.profit_at_units = Math.round(units * cmC - fcC) / 100;
    out.margin_of_safety_units = r4(units - beUnits);
    out.margin_of_safety_pct = units > 0 ? Math.round(((units - beUnits) / units) * 1e4) / 100 : null;
  }
  return out;
}
// Demand forecast (stateless) over a numeric time series. linear (least-squares trend),
// moving_average (mean of last `window`), or exp_smoothing (level via alpha). Returns the
// next `horizon` periods. Serves SCM demand planning (feed the shortfall into reorder/MRP).
export function demandForecast(opts) {
  const raw = Array.isArray(opts.series) ? opts.series : null;
  if (!raw || raw.length < 2) return { err: "series must have at least 2 points" };
  if (raw.length > 5000) return { err: "series too long (max 5000)" };
  const vals = raw.map((p) => (p && typeof p === "object") ? Number(p.value) : Number(p));
  if (vals.some((v) => !Number.isFinite(v))) return { err: "series values must be numbers" };
  const n = vals.length;
  const horizon = Math.min(100, Math.max(1, Math.floor(Number(opts.horizon) || 3)));
  const method = String(opts.method || "linear").toLowerCase();
  const r2 = (x) => Math.round(x * 100) / 100;
  const forecast = [];
  if (method === "moving_average" || method === "ma") {
    const w = Math.min(n, Math.max(1, Math.floor(Number(opts.window) || 3)));
    const avg = vals.slice(n - w).reduce((s, v) => s + v, 0) / w;
    for (let k = 1; k <= horizon; k++) forecast.push({ step: n + k, value: r2(avg) });
    return { method: "moving_average", window: w, forecast };
  }
  if (method === "exp_smoothing" || method === "ses" || method === "exponential") {
    let alpha = Number(opts.alpha); if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) alpha = 0.5;
    let level = vals[0];
    for (let i = 1; i < n; i++) level = alpha * vals[i] + (1 - alpha) * level;
    for (let k = 1; k <= horizon; k++) forecast.push({ step: n + k, value: r2(level) });
    return { method: "exp_smoothing", alpha, forecast };
  }
  // linear least-squares: fit y = intercept + slope·x over x = 0..n-1
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += vals[i]; sxx += i * i; sxy += i * vals[i]; }
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  for (let k = 1; k <= horizon; k++) { const x = n + k - 1; forecast.push({ step: n + k, value: r2(intercept + slope * x) }); }
  return { method: "linear", slope: r2(slope), intercept: r2(intercept), forecast };
}
// Installment / payment-plan schedule (stateless calculator) — split a `total` into `count` equal
// installments after an optional `down` payment. With `rate` (annual %) > 0 it's an amortized plan
// over the financed amount (`total − down`), reusing the SAME annuity math as amortizationSchedule
// (periodic rate = rate/100/freq, freq default 12; the final installment clears the residual so the
// balance ends EXACTLY 0 and principal ties out to the cent); rate 0 → an equal-principal split with
// no interest. `start`+`freq` stamps each row's due date. Cents-exact. Powers BNPL / financing /
// pay-over-time plans. Any signed-in member (touches no data).
export function installmentPlan(opts) {
  const totalC = toCents(opts.total); if (totalC == null || totalC <= 0) return { err: "total must be a positive number" };
  const count = Math.floor(Number(opts.count)); if (!Number.isFinite(count) || count < 1 || count > 600) return { err: "count must be 1–600 installments" };
  const downC = (opts.down != null && opts.down !== "") ? toCents(opts.down) : 0;
  if (downC == null || downC < 0 || downC > totalC) return { err: "down must be between 0 and total" };
  const rate = Number(opts.rate != null && opts.rate !== "" ? opts.rate : 0); if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return { err: "rate must be an annual percentage 0–1000" };
  let freq = Math.floor(Number(opts.freq)); if (!Number.isFinite(freq) || freq < 1 || freq > 366) freq = 12; // installments per year
  const financedC = totalC - downC; const r = rate / 100 / freq; // periodic rate
  const sched = []; let balance = financedC, totalInterest = 0, paymentC;
  if (financedC === 0) { paymentC = 0; for (let p = 1; p <= count; p++) sched.push({ n: p, amount: 0, principal: 0, interest: 0, balance: 0 }); } // fully covered by the down payment
  else {
    paymentC = r === 0 ? Math.round(financedC / count) : Math.round(financedC * r / (1 - Math.pow(1 + r, -count)));
    if (paymentC < 1) paymentC = 1;
    for (let p = 1; p <= count; p++) {
      const interest = Math.round(balance * r);
      let principalPay = paymentC - interest, pay = paymentC;
      if (p === count || principalPay >= balance) { principalPay = balance; pay = balance + interest; } // final installment clears the residual
      if (principalPay < 0) { principalPay = 0; pay = interest; }
      balance -= principalPay; totalInterest += interest;
      sched.push({ n: p, amount: pay / 100, interest: interest / 100, principal: principalPay / 100, balance: balance / 100 });
      if (balance <= 0) balance = 0;
    }
  }
  const start = /^\d{4}-\d{2}-\d{2}/.test(String(opts.start || "")) ? String(opts.start).slice(0, 10) : null;
  const monthsPer = { 12: 1, 6: 2, 4: 3, 3: 4, 2: 6, 1: 12 }[freq]; // installments/yr → months between (common cases)
  if (start && monthsPer) { const [y, mo, d] = start.split("-").map(Number); for (let i = 0; i < sched.length; i++) { const dt = new Date(Date.UTC(y, mo - 1, d)); dt.setUTCMonth(dt.getUTCMonth() + (i + 1) * monthsPer); sched[i].date = dt.toISOString().slice(0, 10); } }
  return { total: totalC / 100, down: downC / 100, financed: financedC / 100, payment: paymentC / 100, count, total_interest: totalInterest / 100, total_paid: (financedC + totalInterest) / 100, schedule: sched };
}
// Sales/VAT tax calculator (stateless) — cents-exact. One `rate` (defaults its line to "tax") or a
// `rates[]` list of jurisdictions (state + county + city), each `{name?, rate, compound?}`. An
// additive rate charges on the base subtotal; a `compound:true` rate charges on the running total
// (subtotal + prior taxes — tax-on-tax, e.g. an old QST-on-GST). `inclusive:true` means the given
// `subtotal` is tax-inclusive: the net is backed out and the per-jurisdiction split ties to the
// cent (the rounding residual is absorbed by the last line). Compound + inclusive is rejected (the
// back-out is ambiguous). Powers invoicing / POS / checkout. Any signed-in member (touches no data).
export function taxCalc(opts) {
  const subtotalC = toCents(opts.subtotal != null ? opts.subtotal : opts.amount);
  if (subtotalC == null || subtotalC < 0) return { err: "subtotal must be a number ≥ 0" };
  let rates;
  if (Array.isArray(opts.rates)) rates = opts.rates.map((r) => (r && typeof r === "object") ? { name: r.name != null && r.name !== "" ? String(r.name).slice(0, 64) : null, rate: Number(r.rate), compound: r.compound === true || r.compound === "true" } : { name: null, rate: Number(r), compound: false });
  else if (opts.rate != null && opts.rate !== "") rates = [{ name: opts.name != null && opts.name !== "" ? String(opts.name).slice(0, 64) : "tax", rate: Number(opts.rate), compound: false }];
  else return { err: "provide rate or rates[]" };
  if (!rates.length) return { err: "at least one rate is required" };
  if (rates.length > 20) return { err: "too many rates (max 20)" };
  if (rates.some((r) => !Number.isFinite(r.rate) || r.rate < 0 || r.rate > 100)) return { err: "each rate must be a percentage 0–100" };
  const inclusive = opts.inclusive === true || opts.inclusive === "true";
  if (inclusive && rates.some((r) => r.compound)) return { err: "compound rates can't be combined with inclusive pricing" };
  const taxes = []; let netC, taxC, totalC;
  if (!inclusive) {
    netC = subtotalC; let running = subtotalC;
    for (const r of rates) { const onC = r.compound ? running : subtotalC; const amt = Math.round(onC * r.rate / 100); taxes.push({ name: r.name, rate: r.rate, amount: amt / 100 }); running += amt; }
    totalC = running; taxC = totalC - netC;
  } else {
    totalC = subtotalC; // the given amount is tax-inclusive (all rates additive here)
    let sum = 0; for (const r of rates) sum += r.rate;
    netC = Math.round(totalC / (1 + sum / 100)); taxC = totalC - netC;
    for (const r of rates) { const amt = Math.round(netC * r.rate / 100); taxes.push({ name: r.name, rate: r.rate, amount: amt / 100 }); }
    const lineSum = taxes.reduce((s, l) => s + Math.round(l.amount * 100), 0), resid = taxC - lineSum;
    if (resid !== 0 && taxes.length) taxes[taxes.length - 1].amount = Math.round(taxes[taxes.length - 1].amount * 100 + resid) / 100;
  }
  return { subtotal: netC / 100, tax: taxC / 100, total: totalC / 100, inclusive, taxes };
}
// Tiered / marginal commission calculator (stateless) — a flat `rate` or `brackets[]` where each
// bracket's rate applies ONLY to the portion of `amount` inside it (marginal, like income-tax
// brackets), cents-exact. A bracket's `up_to` is its upper bound; the last bracket omits it (open-
// ended). Optional flat `base` is added on top. Powers sales-comp / payroll / SPM. Any member.
export function commissionCalc(opts) {
  const amountC = toCents(opts.amount);
  if (amountC == null || amountC < 0) return { err: "amount must be a number ≥ 0" };
  let brackets;
  if (Array.isArray(opts.brackets) && opts.brackets.length) brackets = opts.brackets.map((b) => ({ up_to: (b.up_to != null && b.up_to !== "") ? toCents(b.up_to) : ((b.upTo != null && b.upTo !== "") ? toCents(b.upTo) : null), rate: Number(b.rate) }));
  else if (opts.rate != null && opts.rate !== "") brackets = [{ up_to: null, rate: Number(opts.rate) }];
  else return { err: "provide rate or brackets[]" };
  if (brackets.length > 50) return { err: "too many brackets (max 50)" };
  if (brackets.some((b) => !Number.isFinite(b.rate) || b.rate < 0 || b.rate > 100000)) return { err: "each bracket rate must be a percentage 0–100000" };
  if (brackets.some((b) => b.up_to != null && (!Number.isFinite(b.up_to) || b.up_to < 0))) return { err: "each bracket up_to must be ≥ 0" };
  brackets.sort((a, b) => (a.up_to == null ? Infinity : a.up_to) - (b.up_to == null ? Infinity : b.up_to));
  const lines = []; let lower = 0, totalC = 0;
  for (const b of brackets) {
    if (lower >= amountC) break;
    const cap = b.up_to == null ? amountC : Math.min(b.up_to, amountC), span = cap - lower;
    if (span > 0) { const c = Math.round(span * b.rate / 100); lines.push({ from: lower / 100, to: b.up_to == null ? null : b.up_to / 100, rate: b.rate, portion: span / 100, commission: c / 100 }); totalC += c; }
    lower = b.up_to == null ? amountC : b.up_to;
  }
  const baseC = (opts.base != null && opts.base !== "") ? (toCents(opts.base) || 0) : 0;
  totalC += Math.max(0, baseC);
  const eff = amountC > 0 ? Math.round((totalC / amountC) * 1e4) / 100 : 0;
  return { amount: amountC / 100, base: Math.max(0, baseC) / 100, commission: totalC / 100, effective_rate: eff, brackets: lines };
}
