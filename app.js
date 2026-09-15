// عرض-فقط بالكامل: بيقرأ data.json (ملف ثابت جنب الصفحة) ويعرضه — بدون أي fetch لأي API حي،
// وبدون أي زرار أو فورم بيبعت حاجة لأي سيرفر. نفس دوال العرض المستخدمة في الواجهة الأصلية.

const TARGET_PRICE_OUTLIER_THRESHOLD_PERCENT = 30;
const RECOMMENDATION_LABELS = { buy: "شراء", hold: "احتفاظ", watch: "مراقبة", sell: "بيع", take_partial_profit: "جني أرباح جزئي", full_exit: "خروج كامل", re_entry: "دخول جديد" };
const RECOMMENDATION_BADGE_CLASS = { buy: "badge-buy", hold: "badge-hold", watch: "badge-watch", sell: "badge-sell", take_partial_profit: "badge-watch", full_exit: "badge-sell", re_entry: "badge-buy" };

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function fmtNum(v) {
  if (v === null || v === undefined || v === "" || v === "NA") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtPct(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
function pctClass(v) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (Number.isNaN(n) || n === 0) return "";
  return n > 0 ? "positive" : "negative";
}
function recommendationBadgeHtml(type) {
  if (!type) return `<span class="badge badge-none">لا توجد توصية بعد</span>`;
  const cls = RECOMMENDATION_BADGE_CLASS[type] || "badge-none";
  const label = RECOMMENDATION_LABELS[type] || type;
  return `<span class="badge ${cls}">${label}</span>`;
}
function targetPriceOutlierBadgeHtml(deviationPercent) {
  const n = Number(deviationPercent);
  if (!Number.isFinite(n) || Math.abs(n) < TARGET_PRICE_OUTLIER_THRESHOLD_PERCENT) return "";
  const sign = n > 0 ? "+" : "";
  return `<span class="badge badge-outlier" title="فجوة متطرفة بين السعر المستهدف والسعر الحالي">⚠️ ${sign}${n.toFixed(0)}%</span>`;
}
function sparklineSVG(values, width = 100, height = 32) {
  const nums = (values || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (nums.length < 2) return "";
  const min = Math.min(...nums); const max = Math.max(...nums); const range = max - min || 1;
  const stepX = width / (nums.length - 1);
  const points = nums.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`);
  const rising = nums[nums.length - 1] >= nums[0];
  const color = rising ? "var(--green)" : "var(--red)";
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" style="display:block;"><polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" /></svg>`;
}

const TECH_CHART_COLORS = { buy: "#639922", take_profit: "#378ADD", stop_loss: "#E24B4A", support_main: "#854F0B", support_near: "#BA7517", resistance_main: "#534AB7", resistance_near: "#7F77DD", current_price: "#D85A30" };
function _extractBuyPriceNumber(buyPrice) {
  if (buyPrice === null || buyPrice === undefined || buyPrice === "") return null;
  if (typeof buyPrice === "object") { const n = Number(buyPrice.price); return Number.isFinite(n) ? n : null; }
  const direct = Number(buyPrice);
  if (Number.isFinite(direct)) return direct;
  const match = String(buyPrice).match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}
function _buildTechnicalPoints(data) {
  const points = [];
  if (data.currentPrice !== null && data.currentPrice !== undefined) points.push({ value: Number(data.currentPrice), side: "below", tier: 0, color: TECH_CHART_COLORS.current_price, label: "السعر الحالي", isMain: true });
  (data.support || []).forEach(s => { const isFib = s.source === "fibonacci_projection"; const baseLabel = s.is_main ? "دعم رئيسي" : "أقرب دعم"; points.push({ value: Number(s.price), side: "below", tier: 1, color: s.is_main ? TECH_CHART_COLORS.support_main : TECH_CHART_COLORS.support_near, label: isFib ? `${baseLabel} (فيبوناتشي)` : baseLabel, isMain: !!s.is_main, isProjected: isFib }); });
  (data.resistance || []).forEach(r => { const isFib = r.source === "fibonacci_projection"; const baseLabel = r.is_main ? "مقاومة رئيسية" : "أقرب مقاومة"; points.push({ value: Number(r.price), side: "below", tier: 1, color: r.is_main ? TECH_CHART_COLORS.resistance_main : TECH_CHART_COLORS.resistance_near, label: isFib ? `${baseLabel} (فيبوناتشي)` : baseLabel, isMain: !!r.is_main, isProjected: isFib }); });
  const buyPriceNum = _extractBuyPriceNumber(data.buyPrice);
  if (buyPriceNum !== null) points.push({ value: buyPriceNum, side: "above", tier: 0, color: TECH_CHART_COLORS.buy, label: "شراء", isMain: true });
  if (data.stopLossPrice) points.push({ value: Number(data.stopLossPrice), side: "above", tier: 0, color: TECH_CHART_COLORS.stop_loss, label: "وقف خسارة", isMain: true });
  (data.takeProfitLevels || []).forEach((tp, i) => { const n = (data.takeProfitLevels.length > 1) ? ` ${i + 1}` : ""; const portion = tp.sell_portion_percent ? ` (${tp.sell_portion_percent}%)` : ""; points.push({ value: Number(tp.price), side: "above", tier: 0, color: TECH_CHART_COLORS.take_profit, label: `جني أرباح${n}${portion}`, isMain: true }); });
  return points.filter(p => Number.isFinite(p.value));
}
function _technicalChartSVG(validPoints) {
  const values = validPoints.map(p => p.value);
  const min = Math.min(...values); const max = Math.max(...values);
  const span = (max - min) || Math.abs(max) * 0.1 || 1;
  const rangeMin = min - span * 0.08; const rangeSpan = span * 1.16;
  const plotLeft = 55, plotRight = 625, axisY = 120;
  const xPos = (v) => plotLeft + ((v - rangeMin) / rangeSpan) * (plotRight - plotLeft);
  const parts = [`<line x1="${plotLeft - 15}" y1="${axisY}" x2="${plotRight + 15}" y2="${axisY}" stroke="var(--border-strong)" stroke-width="1.5"/>`];
  validPoints.forEach(p => {
    const x = xPos(p.value).toFixed(1);
    const valueText = escapeHtml(fmtNum(p.value));
    const label = escapeHtml(p.label);
    if (p.side === "above") {
      parts.push(`<line x1="${x}" y1="${axisY}" x2="${x}" y2="${axisY - 24}" stroke="${p.color}" stroke-width="2"/><path d="M ${x} ${axisY - 32} L ${x - 5} ${axisY - 22} L ${Number(x) + 5} ${axisY - 22} Z" fill="${p.color}"/><text x="${x}" y="${axisY - 40}" text-anchor="middle" font-size="11" font-weight="500" fill="${p.color}">${label}</text><rect x="${x - 26}" y="${axisY - 70}" width="52" height="18" rx="9" fill="${p.color}"/><text x="${x}" y="${axisY - 57}" text-anchor="middle" font-size="12" font-weight="500" fill="#ffffff">${valueText}</text>`);
    } else {
      const base = axisY + (p.tier === 0 ? 25 : 85);
      const r = p.isMain ? 9 : 6;
      const lineDash = p.isProjected ? ` stroke-dasharray="4,3"` : "";
      const circleFill = p.isProjected ? "none" : p.color;
      const circleStroke = p.isProjected ? ` stroke="${p.color}" stroke-width="2" stroke-dasharray="3,2"` : "";
      parts.push(`<line x1="${x}" y1="${axisY}" x2="${x}" y2="${base}" stroke="${p.color}" stroke-width="2"${lineDash}/><circle cx="${x}" cy="${base}" r="${r}" fill="${circleFill}"${circleStroke}/><text x="${x}" y="${base + 20}" text-anchor="middle" font-size="11" font-weight="500" fill="${p.color}">${label}</text><rect x="${x - 26}" y="${base + 28}" width="52" height="18" rx="9" fill="${p.color}"/><text x="${x}" y="${base + 41}" text-anchor="middle" font-size="12" font-weight="500" fill="#ffffff">${valueText}</text>`);
    }
  });
  return `<svg viewBox="0 0 680 290" style="width:100%; height:auto; overflow:visible;" role="img">${parts.join("")}</svg>`;
}
function _technicalLevelsTableHTML(validPoints) {
  const sorted = [...validPoints].sort((a, b) => a.value - b.value);
  const rows = sorted.map(p => `<tr><td style="color:${p.color}; font-weight:500; padding:5px 8px;">${escapeHtml(p.label)}</td><td style="color:${p.color}; font-weight:500; padding:5px 8px; text-align:left;">${escapeHtml(fmtNum(p.value))}</td></tr>`).join("");
  return `<table style="width:100%; border-collapse:collapse;"><tbody>${rows}</tbody></table>`;
}
function renderTechnicalChartSVG(data) {
  const points = _buildTechnicalPoints(data);
  if (points.length < 2) return `<div class="empty-state">لا توجد بيانات كافية لرسم الشارت الفني بعد</div>`;
  const hasProjected = points.some(p => p.isProjected);
  const legend = hasProjected ? `<div style="font-size:12px; color:var(--text-dim); margin-top:6px;">⚠️ الخطوط والدوائر المتقطعة = تقدير رياضي بفيبوناتشي، مش نقطة ارتداد فعلية موثّقة.</div>` : "";
  return `<div><div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;"><div style="flex:2 1 420px; min-width:280px;">${_technicalChartSVG(points)}</div><div style="flex:1 1 170px; min-width:150px;">${_technicalLevelsTableHTML(points)}</div></div>${legend}</div>`;
}

// ---- اللوحة الرئيسية ----
function renderDashboard(data) {
  const grid = document.getElementById("stocks-grid");
  if (!grid) return;
  if (!data.stocks.length) { grid.innerHTML = `<div class="empty-state">مفيش أسهم متابَعة حاليًا</div>`; return; }
  const todayStr = new Date().toISOString().slice(0, 10);
  const ranked = data.stocks.map((s, index) => {
    const price = s.latest_price; const rec = s.latest_recommendation; const news = s.latest_news;
    const targetDeviation = (rec && rec.target_price && price && price.close) ? (Number(rec.target_price) - Number(price.close)) / Number(price.close) * 100 : null;
    const isOutlier = Number.isFinite(targetDeviation) && Math.abs(targetDeviation) >= TARGET_PRICE_OUTLIER_THRESHOLD_PERCENT;
    const changedToday = !!(rec && rec.generated_at && rec.generated_at.slice(0, 10) === todayStr && rec.change_vs_previous);
    const priority = isOutlier ? 0 : changedToday ? 1 : 2;
    const html = `
      <div class="stock-card">
        <div class="head">
          <div>
            <div>${changedToday ? '<span title="توصية اتغيّرت النهاردة">🆕</span> ' : ""}${escapeHtml(s.name)}</div>
            <div class="ticker">${escapeHtml(s.ticker)}</div>
          </div>
          <span style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            ${targetPriceOutlierBadgeHtml(targetDeviation)}
            ${recommendationBadgeHtml(rec ? rec.recommendation_type : null)}
          </span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div>
            <div class="price">${price ? fmtNum(price.close) + " ج.م" : "لا توجد بيانات سعر"}</div>
            <div class="muted">${price ? "بتاريخ " + escapeHtml(price.date) : ""}</div>
          </div>
          ${sparklineSVG(s.recent_closes)}
        </div>
        <div class="news-title">${news ? "📰 " + escapeHtml(news.title) : "لا توجد أخبار مؤرشفة"}</div>
      </div>`;
    return { priority, index, html };
  });
  ranked.sort((a, b) => a.priority - b.priority || a.index - b.index);
  grid.innerHTML = ranked.map(r => r.html).join("");
}

function renderIndices(data) {
  const box = document.getElementById("indices-section");
  if (!box) return;
  const indexEntities = data.entities.filter(e => e.kind === "index");
  if (!indexEntities.length) { box.innerHTML = `<div class="empty-state">لا توجد مؤشرات متابَعة</div>`; return; }
  box.innerHTML = indexEntities.map(idx => {
    const rec = (idx.recommendations && idx.recommendations.length) ? idx.recommendations[idx.recommendations.length - 1] : null;
    const chartHtml = idx.technical ? renderTechnicalChartSVG({ currentPrice: idx.technical.current_price, support: idx.technical.support, resistance: idx.technical.resistance, buyPrice: null, stopLossPrice: null, takeProfitLevels: [] }) : `<div class="empty-state">تعذر تحميل التحليل الفني</div>`;
    return `<div class="card"><div class="head" style="display:flex; justify-content:space-between; align-items:center;"><strong>${escapeHtml(idx.name)}</strong>${recommendationBadgeHtml(rec ? rec.recommendation_type : null)}</div>${chartHtml}</div>`;
  }).join("");
}

function renderLatestReport(data) {
  const box = document.getElementById("latest-report");
  if (!box) return;
  const report = data.latest_report;
  if (!report) { box.innerHTML = `<div class="empty-state">لسه مفيش تقارير</div>`; return; }
  box.innerHTML = `<div class="muted">بتاريخ ${escapeHtml(report.date)}</div><div class="article-body">${report.html}</div>`;
}

// ---- التوصيات ----
function computeSuccessRate(recs) {
  const evaluated = recs.filter(r => r.outcome_status && r.outcome_status !== "pending");
  const correct = evaluated.filter(r => r.outcome_status === "validated_correct").length;
  const partial = evaluated.filter(r => r.outcome_status === "validated_partial").length;
  const denom = evaluated.filter(r => r.outcome_status !== "not_applicable").length;
  if (!denom) return null;
  return Math.round(((correct + 0.5 * partial) / denom) * 1000) / 10;
}
function recTable(recs) {
  if (!recs.length) return `<div class="empty-state">لا توجد توصيات مسجّلة في هذا النطاق</div>`;
  const rows = [...recs].reverse().map(r => `<tr><td>${escapeHtml(r.generated_at || "—")}</td><td>${recommendationBadgeHtml(r.recommendation_type)}</td><td>${escapeHtml(r.confidence_level || "—")}</td><td>${escapeHtml(r.price_at_recommendation || "—")}</td><td>${escapeHtml(r.reasoning_summary || "—")}</td><td>${escapeHtml(r.outcome_status || "pending")}</td></tr>`).join("");
  return `<table><thead><tr><th>التاريخ</th><th>التوصية</th><th>الثقة</th><th>السعر وقتها</th><th>السبب</th><th>النتيجة</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function performanceStatGridHtml(perfSummary) {
  if (!perfSummary) return "";
  return `<div class="stat-grid" style="margin-top:10px;">
    <div class="stat-box"><div class="label">السعر المستهدف</div><div class="value">${fmtNum(perfSummary.target_price)}</div></div>
    <div class="stat-box"><div class="label">الأداء منذ التوصية</div><div class="value ${pctClass(perfSummary.performance_since_recommendation_percent)}">${fmtPct(perfSummary.performance_since_recommendation_percent)}</div></div>
    <div class="stat-box"><div class="label">أداء المؤشر المرجعي (${escapeHtml(perfSummary.benchmark_index_name || "—")})</div><div class="value ${pctClass(perfSummary.benchmark_performance_percent)}">${fmtPct(perfSummary.benchmark_performance_percent)}</div></div>
    <div class="stat-box"><div class="label">المتبقي للسعر المستهدف</div><div class="value ${pctClass(perfSummary.remaining_return_to_target_percent)}">${fmtPct(perfSummary.remaining_return_to_target_percent)}</div></div>
    ${perfSummary.protective_stop_price ? `<div class="stat-box"><div class="label">وقف حماية أرباح مُفعّل</div><div class="value">${fmtNum(perfSummary.protective_stop_price)}</div></div>` : ""}
  </div>`;
}
const PATTERN_ACTION_LABELS = { "دخول_جديد": "دخول جديد", "خروج_كامل": "خروج كامل", "جني_أرباح_جزئي": "جني أرباح جزئي", "تفعيل_حماية_أرباح": "تفعيل حماية أرباح", "زيادة_مركز": "زيادة مركز", "تجنب_الدخول": "تجنب الدخول", "مراقبة_فقط": "مراقبة فقط", "آخر": "آخر" };
function activePatternsCompactHtml(activePatterns) {
  if (!activePatterns || !activePatterns.length) return "";
  return `<div style="margin-top:12px;"><div class="muted" style="margin-bottom:6px;">الأنماط المفعّلة حاليًا:</div>${activePatterns.map(p => `
    <div class="pattern-card">
      <div class="head"><span class="name">${escapeHtml(p.pattern_name || p.pattern_id)}</span><span class="badge badge-pattern">${escapeHtml(PATTERN_ACTION_LABELS[p.action_type] || p.action_type || "—")}</span></div>
      ${p.action_detail ? `<div class="muted" style="margin-top:6px;">${escapeHtml(p.action_detail)}</div>` : ""}
    </div>`).join("")}</div>`;
}
function entityCardHtml(entity, maxHistoryShown, cardIndex) {
  const recs = entity.recommendations || [];
  const latest = recs.length ? recs[recs.length - 1] : null;
  const successRate = computeSuccessRate(recs);
  const rateText = successRate === null ? `لا يوجد عدد كافٍ من التوصيات المُقيَّمة بعد (${recs.length} توصية إجمالاً)` : `نسبة النجاح: <strong>${successRate}%</strong> (${recs.length} توصية إجمالاً)`;
  const chartHtml = entity.technical ? renderTechnicalChartSVG({ currentPrice: entity.technical.current_price, support: entity.technical.support, resistance: entity.technical.resistance, buyPrice: latest ? latest.buy_price : null, stopLossPrice: latest ? latest.stop_loss_price : null, takeProfitLevels: latest ? latest.take_profit_levels : [] }) : "";
  const latestHtml = latest ? `<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:12px 0 6px;">${recommendationBadgeHtml(latest.recommendation_type)}<span class="muted">${escapeHtml(latest.generated_at || "")}</span><span class="muted">الثقة: ${escapeHtml(latest.confidence_level || "—")}</span><span class="muted">السعر وقتها: ${escapeHtml(latest.price_at_recommendation || "—")}</span></div><div>${escapeHtml(latest.reasoning_summary || "")}</div>` : `<div class="empty-state">لا توجد توصيات مسجّلة بعد</div>`;
  const performanceHtml = entity.kind === "stock" ? performanceStatGridHtml(entity.performance) : "";
  const patternsHtml = entity.kind === "stock" ? activePatternsCompactHtml(entity.active_patterns) : "";
  const limit = maxHistoryShown || 5;
  const recentSlice = recs.slice(-limit);
  const moreNote = recs.length > limit ? `<div class="muted" style="margin-top:6px;">و${recs.length - limit} توصية أقدم في الأرشيف الكامل بالنظام.</div>` : "";
  const historyId = `history-${cardIndex}`;
  const toggleId = `toggle-${cardIndex}`;
  const openLabel = `عرض آخر ${Math.min(limit, recs.length)} توصيات ▾`;
  // زرار عرض/إخفاء محلي بالكامل داخل الصفحة (مجرد إظهار/إخفاء عنصر بجافاسكريبت) — مفيهوش أي نداء
  // لأي سيرفر أو أمر، بس تفاعل عرض بحت زي أي أكورديون في أي موقع
  const historySection = recs.length ? `
    <button type="button" class="btn-toggle-history" id="${toggleId}" data-open-label="${escapeHtml(openLabel)}" onclick="toggleHistory('${historyId}', '${toggleId}')" style="margin-top:14px;">${openLabel}</button>
    <div id="${historyId}" style="display:none; margin-top:10px;">
      ${recTable(recentSlice)}
      ${moreNote}
    </div>` : "";
  return `<div class="card">
    <div class="head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h3 style="margin:0;">${escapeHtml(entity.name)}</h3><span class="muted">${rateText}</span>
    </div>
    ${chartHtml}${latestHtml}${performanceHtml}${patternsHtml}
    ${historySection}
  </div>`;
}
function toggleHistory(historyId, toggleId) {
  const box = document.getElementById(historyId);
  const btn = document.getElementById(toggleId);
  if (!box || !btn) return;
  const isHidden = box.style.display === "none";
  box.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "إخفاء التوصيات ▴" : btn.dataset.openLabel;
}
function renderRecommendations(data) {
  const container = document.getElementById("recs-container");
  if (!container) return;
  if (!data.entities.length) { container.innerHTML = `<div class="empty-state">لا يوجد أسهم أو مؤشرات أو صفقة ذهب متابَعة بعد</div>`; return; }
  container.innerHTML = data.entities.map((e, i) => entityCardHtml(e, data.max_history_shown, i)).join("");
}

// ---- تشغيل ----
async function boot() {
  const res = await fetch("data.json");
  const data = await res.json();
  const label = document.getElementById("generated-at-label");
  if (label) label.textContent = data.generated_at;
  renderDashboard(data);
  renderIndices(data);
  renderLatestReport(data);
  renderRecommendations(data);
}
boot();
