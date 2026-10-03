// واجهة المحفظة الافتراضية (1 أكتوبر 2026) — نفس الملف في الصفحة المحلية وموقع جت هب.
// PortfolioView.render(element, dashboardData) — dashboardData من /api/virtual-portfolio/dashboard أو data.json.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => {
    if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
    const n = Number(v);
    const digits = d ?? (Math.abs(n) >= 1000 ? 0 : 2);
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
  };
  const signed = (v, suffix = "", d) => (v === null || v === undefined) ? "—" : ((v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d) + suffix);
  const cls = v => (v === null || v === undefined || v === 0) ? "" : (v > 0 ? "pos" : "neg");
  const TYPES = ["مضاربة", "متوسط", "طويل"];
  const TYPE_COLOR = { "مضاربة": "var(--t-spec)", "متوسط": "var(--t-mid)", "طويل": "var(--t-long)", "بدون خطة": "var(--t-none)" };
  const chip = t => t ? `<span class="pv-chip ${TYPES.includes(t) ? "pv-c-" + t : "pv-c-none"}">${esc(t)}</span>` : "";
  const CONF = { low: "منخفضة", medium: "متوسطة", high: "عالية" };
  const REASON = { "وقف_خسارة": "وقف خسارة", "تصفية_محفظة": "تصفية الجولة", "تصفية_كاملة": "تصفية من القرار" };
  const reasonText = r => esc(REASON[r] || String(r || "—").replace(/_/g, " "));

  function equityChart(d) {
    const h = (d.equity_history || []).filter(p => p.total);
    if (h.length < 2) return `<div class="pv-empty" style="padding:14px;">منحنى القيمة بيتكوّن من أول جلسة في الجولة</div>`;
    const vals = h.map(p => p.total), base = d.initial_capital || vals[0];
    let lo = Math.min(...vals, base), hi = Math.max(...vals, base);
    if (hi - lo < base * 0.004) { lo -= base * 0.002; hi += base * 0.002; }
    const W = 300, H = 90, pad = 6;
    const x = i => (i / (h.length - 1)) * W;                  // الزمن من الشمال لليمين زي شارتات المنصات
    const y = v => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad);
    const pts = h.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
    const up = vals[vals.length - 1] >= base;
    const col = up ? "#35c46b" : "#f04a4a";
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="منحنى قيمة المحفظة">
        <line x1="0" y1="${y(base).toFixed(1)}" x2="${W}" y2="${y(base).toFixed(1)}" stroke="#3a4150" stroke-dasharray="4 4"/>
        <polygon fill="${up ? "rgba(53,196,107,.10)" : "rgba(240,74,74,.10)"}" points="${pts} ${x(h.length - 1)},${H} ${x(0)},${H}"/>
        <polyline fill="none" stroke="${col}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${pts}"/>
      </svg>
      <div class="muted" style="font-size:11px;display:flex;justify-content:space-between;direction:ltr;">
        <span>${esc(h[0].session)}</span><span dir="rtl">الخط المتقطع = رأس المال</span><span>${esc(h[h.length - 1].session)}</span></div>`;
  }

  function hero(d) {
    const a = d.allocation || {}, total = a.total || d.total || 1;
    const parts = [
      ...TYPES.map(t => ({ label: t, v: (a.by_type || {})[t] || 0, color: TYPE_COLOR[t] })),
      { label: "بدون خطة", v: (a.by_type || {})["بدون خطة"] || 0, color: TYPE_COLOR["بدون خطة"] },
      { label: "محجوز لأوامر شراء", v: a.reserved || 0, color: "repeating-linear-gradient(45deg,#3a4150 0 6px,#2a2f3a 6px 12px)", dot: "#3a4150" },
      { label: "كاش", v: a.cash || 0, color: "var(--pv-cash)" },
    ].filter(p => p.v > 0.5);
    const pct = v => Math.round(v / total * 1000) / 10;
    const st = d.closed_stats || {};
    const b = d.budget;
    const budgetHtml = b ? `
      <div style="margin-top:12px;max-width:440px;">
        <div class="muted" style="display:flex;justify-content:space-between;gap:8px;"><span>🎯 ميزانية المضاربة ${num(b.budget_pct)}%</span><span class="num">${num(b.used_value)} من ${num(b.budget_value)} ج.م</span></div>
        <div class="pv-meter"><span style="width:${Math.min(100, b.budget_value ? b.used_value / b.budget_value * 100 : 0)}%;background:var(--t-spec)"></span></div>
        <div class="muted" style="font-size:11px;margin-top:2px;">${b.reason ? "السبب: " + esc(b.reason) + " · " : ""}${b.brake_active ? '<span class="neg">⛔ فرامل المضاربة شغالة</span>' : "الفرامل مقفولة ✅"}</div>
      </div>` : "";
    return `<div class="pv-card"><div class="pv-hero"><div>
        <div class="muted">قيمة المحفظة — الجولة ${esc(d.round_number)}${d.system_version && d.system_version !== "29" ? ` (خطة ${esc(String(d.system_version).split(".")[0])})` : ""} · من ${esc(String(d.round_started_at || "").slice(0, 10))}</div>
        <div class="pv-big num">${num(d.total, 0)} <small>ج.م</small></div>
        <div class="pv-delta num ${cls(d.total_pnl)}">${d.total_pnl > 0 ? "▲" : d.total_pnl < 0 ? "▼" : "■"} ${signed(d.total_pnl, "", 0)} (${signed(d.total_pnl_pct, "%")}) <span class="muted" style="font-weight:400">من رأس المال ${num(d.initial_capital, 0)}</span></div>
        <div class="pv-kpis">
          <div class="pv-kpi"><div class="l">آخر جلسة</div><div class="v num ${cls(d.last_session_change_pct)}">${signed(d.last_session_change_pct, "%")}</div></div>
          <div class="pv-kpi"><div class="l">صفقات مفتوحة</div><div class="v num">${(d.open_trades || []).length}</div></div>
          <div class="pv-kpi"><div class="l">مقفولة · نسبة الكسب</div><div class="v num">${st.count || 0}${st.win_rate !== null && st.win_rate !== undefined ? " · " + st.win_rate + "%" : ""}</div></div>
        </div></div>
        <div>${equityChart(d)}</div></div>
      <div style="margin-top:14px;"><div class="muted">الفلوس رايحة فين</div>
        <div class="pv-alloc">${parts.map(p => `<span title="${esc(p.label)} ${num(p.v, 0)} ج.م" style="width:${pct(p.v)}%;background:${p.color}"></span>`).join("")}</div>
        <div class="pv-legend">${parts.map(p => `<span><i class="pv-dot" style="background:${p.dot || p.color}"></i>${esc(p.label)} ${pct(p.v)}% <span class="num">(${num(p.v, 0)})</span></span>`).join("")}</div>
        ${budgetHtml}</div></div>`;
  }

  function tonight(d, opts) {
    const t = d.tonight || {};
    const steps = t.steps || [];
    const KIND = { cancel: ["pv-c-cancel", "إلغاء"], buy: ["pv-c-buy", "شراء"], sell: ["pv-c-sell", "بيع"], stop: ["pv-c-stop", "وقف"] };
    const summary = t.summary ? `<div class="pv-summary">💬 ${esc(t.summary)}</div>` : "";
    const list = steps.length ? `<div class="pv-steps">${steps.map((s, i) => `
      <div class="pv-step ${s.kind}"><span class="n">${i + 1}</span>
        <div><div class="main"><span class="pv-chip ${KIND[s.kind][0]}">${KIND[s.kind][1]}</span> <b>${esc(s.name || s.ticker)}</b> <span class="muted">${esc(s.ticker)}</span> · <span class="num">${num(s.quantity, 0)}</span> سهم ${chip(s.trade_type)}</div>
          <div class="sub">${esc(String(s.purpose || "").replace(/_/g, " "))}${s.planned_stop ? ` · وقف بعد التنفيذ ${num(s.planned_stop)}` : ""}</div></div>
        <div class="px num">${num(s.price)}</div></div>`).join("")}</div>` : `<div class="pv-empty">مفيش أوامر جديدة الليلة — الأوامر القايمة من قبل لسه سارية.</div>`;
    const FILL = { buy_filled: "✅ شراء", sell_filled: "✅ بيع", stop_filled: "🛑 وقف", dividend: "💰 توزيعة" };
    const fills = (t.fills || []).length ? `<div class="muted" style="margin-top:10px;">اتنفذ في آخر جلسة: ${t.fills.map(f => `${FILL[f.kind] || ""} ${esc(f.name || f.ticker)} ${num(f.quantity, 0)} سهم عند ${num(f.price)}`).join(" · ")}</div>` : "";
    const title = opts.public ? "🌙 إجراءات آخر ليلة" : "🌙 أوامر الليلة";
    const sub = t.for_session_after ? (opts.public ? `— بعد جلسة ${esc(t.for_session_after)}` : `— اتحطت بعد جلسة ${esc(t.for_session_after)}، وتتحط على المنصة بالترتيب ده`) : "";
    return `<div class="pv-card"><h2>${title} <span class="count">${sub}</span></h2>${summary}${list}${fills}</div>`;
  }

  function ladder(tr) {
    const pts = [];
    (tr.markers || []).forEach(m => pts.push({ ...m }));
    const prices = pts.map(m => m.price).concat(tr.price ? [tr.price] : []);
    if (!prices.length) return "";
    let lo = Math.min(...prices), hi = Math.max(...prices);
    if (tr.trailing) { hi = hi + (hi - lo || hi * 0.05) * 0.18; pts.push({ kind: "trail", price: hi, label: "متحرك" }); }
    const span = (hi - lo) || hi * 0.05 || 1;
    lo -= span * 0.04; hi += span * 0.04;
    const pos = p => 3 + (p - lo) / (hi - lo) * 94;
    // دمج العلامات المتطابقة تقريبًا (وقف = دخول بعد التعادل)
    const merged = [];
    pts.sort((a, b) => a.price - b.price).forEach(m => {
      const last = merged[merged.length - 1];
      if (last && Math.abs(pos(m.price) - pos(last.price)) < 2.5) { last.kinds.push(m.kind); }
      else merged.push({ ...m, kinds: [m.kind] });
    });
    const NAME = { stop: "وقف", entry: "دخول", tp: "هدف", trail: "متحرك" };
    let lastRow1 = -100;
    const html = merged.map(m => {
      const p = pos(m.price);
      const row2 = p - lastRow1 < 16;
      if (!row2) lastRow1 = p;
      const kind = m.kinds.includes("stop") ? "stop" : m.kinds.includes("entry") ? "entry" : m.kinds[0];
      const label = m.kinds.map(k => NAME[k]).join(" = ") + (m.kind === "trail" ? "" : " " + num(m.price));
      return `<div class="pv-mk ${kind}${row2 ? " row2" : ""}" style="right:${p.toFixed(1)}%"><i></i><span class="lb">${esc(label)}</span></div>`;
    }).join("");
    const now = tr.price ? `<div class="pv-mk now" style="right:${pos(tr.price).toFixed(1)}%"><span class="lb">${num(tr.price)}</span><i></i></div>` : "";
    return `<div class="pv-ladder"><div class="track"></div>${html}${now}</div>`;
  }

  function trades(d) {
    const list = d.open_trades || [];
    const body = list.length ? `<div class="pv-trades">${list.map(tr => {
      const legs = (tr.legs || []).map(g => {
        const left = (g.quantity || 0) - (g.filled_qty || 0);
        return g.status === "open"
          ? `<div class="pv-leg"><span>⏳ جزء ${esc(g.leg)} — ${num(left, 0)} سهم · ${g.hold ? "🌊 يكمّل لبعد النتائج" : (g.tp ? "هدف " + num(g.tp) : "متحرك")}</span><span class="muted">وقف ${num(g.stop)}</span></div>`
          : `<div class="pv-leg"><span>✅ جزء ${esc(g.leg)} — ${esc(g.exit_kind || "اتقفل")} ${g.filled_price ? "عند " + num(g.filled_price) : ""}</span><span class="${cls(g.r)}">${g.r !== null && g.r !== undefined ? signed(g.r, "R") : ""}</span></div>`;
      }).join("");
      const ts = tr.time_stop_sessions ? `<div class="muted" style="font-size:11px;margin-top:8px;">⏱️ وقف الوقت: جلسة ${num(tr.sessions_held || 0, 0)} من ${num(tr.time_stop_sessions, 0)}
          <div class="pv-meter"><span style="width:${Math.min(100, (tr.sessions_held || 0) / tr.time_stop_sessions * 100)}%;background:var(--t-spec)"></span></div></div>` : "";
      const pnl = tr.unrealized_pnl;
      return `<div class="pv-trade t-${esc(tr.trade_type)}">
        <div class="head"><div>
            <div class="name">${esc(tr.name)} <span class="tk">${esc(tr.ticker)}</span></div>
            ${chip(tr.trade_type)} <span class="muted">· ${esc(tr.strategy || "—")}${(tr.patterns || []).length ? " · نمط: " + tr.patterns.map(esc).join("، ") : ""}</span></div>
          <div class="pnl num ${cls(tr.unrealized_pct)}">${signed(tr.unrealized_pct, "%")}
            <span class="muted">${tr.r_now !== null && tr.r_now !== undefined ? signed(tr.r_now, "R") + " · " : ""}${signed(pnl, " ج.م", 0)}</span></div></div>
        ${ladder(tr)}
        <div class="pv-facts"><span>الكمية <b class="num">${num(tr.quantity, 0)}</b>${tr.original_quantity > tr.quantity ? " من " + num(tr.original_quantity, 0) : ""}</span>
          <span>متوسط الدخول <b class="num">${num(tr.entry_price)}</b></span><span>القيمة <b class="num">${num(tr.value, 0)}</b></span>
          ${tr.entry_date ? `<span>من <b>${esc(tr.entry_date)}</b></span>` : ""}${tr.confidence ? `<span>ثقة <b>${esc(CONF[tr.confidence] || tr.confidence)}</b></span>` : ""}
          ${tr.realized_pnl ? `<span>محقق <b class="${cls(tr.realized_pnl)}">${signed(tr.realized_pnl, "", 0)}</b></span>` : ""}
          ${tr.breakeven_armed ? `<span>🔒 الوقف على التعادل</span>` : ""}${tr.rescue_used ? `<span>🛟 إنقاذ</span>` : ""}
          ${tr.dividend_due ? `<span>توزيعة مستحقة <b class="num">${num(tr.dividend_due, 0)}</b></span>` : ""}</div>
        ${tr.trail_state ? `<div class="muted" style="font-size:11px;margin-top:6px;">🔁 الوقف المتحرك: ${esc(tr.trail_state.state)} (${num(tr.trail_state.k)}×ATR) — ${esc(tr.trail_state.reason || "")}</div>` : ""}
        ${tr.results ? `<div class="muted" style="font-size:11px;margin-top:4px;">📊 نتائج ${esc(tr.results.period || "")}: ${(tr.results.status || {}).published ? "اتنشرت" + ((tr.results.status || {}).published_source ? " (" + esc(tr.results.status.published_source) + ")" : "") : "لسه — الموسم لحد " + esc(tr.results.season_end || "")}${tr.results.verdict ? " · الحكم: " + esc(tr.results.verdict) + (tr.results.verdict_basis ? " (" + esc(tr.results.verdict_basis) + ")" : "") : ""}</div>` : ""}
        ${legs ? `<div class="pv-legs">${legs}</div>` : ""}${ts}</div>`;
    }).join("")}</div>` : `<div class="pv-empty">مفيش صفقات مفتوحة دلوقتي</div>`;
    return `<div class="pv-card"><h2>📈 الصفقات المفتوحة <span class="count">— ${list.length}</span></h2>${body}</div>`;
  }

  function pendingBuys(d) {
    const list = d.pending_buys || [];
    if (!list.length) return "";
    const reserved = list.reduce((s, o) => s + (o.reserved || 0), 0);
    return `<div class="pv-card"><h2>⏳ أوامر شراء مستنية التنفيذ <span class="count">— ${list.length} · محجوز ${num(reserved, 0)} ج.م</span></h2>
      <table class="pv-table"><thead><tr><th>السهم</th><th>النوع</th><th>السعر</th><th>الكمية</th><th>البعد عن آخر إغلاق</th><th>قايم من</th></tr></thead><tbody>
      ${list.map(o => `<tr><td data-l=""><b>${esc(o.name)}</b> <span class="muted">${esc(o.ticker)}</span></td><td data-l="النوع">${chip(o.trade_type) || "—"}</td>
        <td data-l="السعر" class="num">${num(o.price)}</td><td data-l="الكمية" class="num">${num(o.quantity, 0)}</td>
        <td data-l="البعد" class="num">${signed(o.distance_pct, "%")}</td>
        <td data-l="قايم من" class="muted">${o.sessions_waiting ? o.sessions_waiting + " جلسة" : "الليلة"}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  function closed(d) {
    const rows = d.closed || [];
    const st = d.closed_stats || {};
    const head = st.count ? `— ${st.count} صفقة · كسب ${st.wins} · خسارة ${st.losses}${st.avg_r !== null && st.avg_r !== undefined ? " · متوسط " + signed(st.avg_r, "R") : ""} · الصافي <span class="${cls(st.total_pnl)}">${signed(st.total_pnl, " ج.م", 0)}</span>` : "";
    const body = rows.length ? `<table class="pv-table"><thead><tr><th></th><th>السهم</th><th>النوع</th><th>دخول ← خروج</th><th>النتيجة</th><th>R</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>
      ${rows.map(r => { const rv = r.r ?? r.trade_r; return `<tr><td data-l="">${r.pnl > 0 ? "🟢" : r.pnl < 0 ? "🔴" : "⚪"}</td>
        <td data-l=""><b>${esc(r.name)}</b>${r.part ? ` <span class="muted">جزء ${r.part}</span>` : ""}</td><td data-l="النوع">${chip(r.trade_type)}</td>
        <td data-l="دخول ← خروج" class="num">${num(r.entry_price)} ← ${num(r.exit_price)}</td>
        <td data-l="النتيجة" class="num ${cls(r.pnl)}">${signed(r.pnl, " ج.م", 0)} (${signed(r.pnl_pct, "%")})</td>
        <td data-l="R" class="r num ${cls(rv)}">${rv !== null && rv !== undefined ? signed(rv, "R") : "—"}</td>
        <td data-l="السبب" class="muted">${reasonText(r.reason)}</td><td data-l="التاريخ" class="muted">${esc(String(r.closed_at || "").slice(0, 10))}</td></tr>`; }).join("")}
      </tbody></table>` : `<div class="pv-empty">لسه مفيش صفقات اتقفلت في الجولة دي</div>`;
    return `<div class="pv-card"><h2>✅ الصفقات المقفولة <span class="count">${head}</span></h2>${body}</div>`;
  }

  function render(el, d, opts) {
    opts = opts || {};
    if (!el) return;
    if (!d) { el.innerHTML = `<div class="pv-empty">مفيش بيانات للمحفظة</div>`; return; }
    el.classList.add("pv-root");
    const rv = d.market_reversal;
    const rvColor = !rv ? "" : (rv.state === "فشل" ? "var(--bad, #c0392b)" : "var(--good, #1e8e5a)");
    const rvHtml = rv ? `<div class="pv-reversal" style="border-inline-start:4px solid ${rvColor}">${esc(rv.note)}</div>` : "";
    el.innerHTML = rvHtml + hero(d) + tonight(d, opts) + trades(d) + pendingBuys(d) + closed(d);
  }
  window.PortfolioView = { render, chip, esc, num };
})();
