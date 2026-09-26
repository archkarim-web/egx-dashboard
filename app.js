// عرض-فقط بالكامل: بيقرأ data.json (ملف ثابت جنب الصفحة) ويعرضه — بدون أي fetch لأي API حي،
// وبدون أي زرار أو فورم بيبعت حاجة لأي سيرفر. نفس دوال العرض المستخدمة في الواجهة الأصلية.

const TARGET_PRICE_OUTLIER_THRESHOLD_PERCENT = 30;
const RECOMMENDATION_LABELS = { buy: "شراء", hold: "احتفاظ", watch: "مراقبة", sell: "بيع", take_partial_profit: "جني أرباح جزئي", full_exit: "خروج كامل", re_entry: "دخول جديد" };
const RECOMMENDATION_BADGE_CLASS = { buy: "badge-buy", hold: "badge-hold", watch: "badge-watch", sell: "badge-sell", take_partial_profit: "badge-watch", full_exit: "badge-sell", re_entry: "badge-buy" };
const LOGIC_TYPE_LABELS = { "فني": "فني", "مالي_أساسي": "مالي أساسي", "تعلم_ذاتي": "تعلم ذاتي", "مجمع": "مجمع" };

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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
// --- سطر نسب التغير تحت السعر (تطوير 27، 24 سبتمبر 2026) — يومي (عن الإغلاق السابق) وأسبوعي (عن
// إغلاق آخر خميس)، بخط صغير وألوان أخضر/أحمر — لكل من كروت الأسهم والمؤشرات ---
function priceChangesLineHtml(changes) {
  if (!changes) return "";
  const day = changes.vs_previous_close_percent;
  const week = changes.vs_last_thursday_close_percent;
  const parts = [];
  if (day !== null && day !== undefined) parts.push(`<span class="${pctClass(day)}" title="التغير عن إغلاق الجلسة السابقة">يومي ${fmtPct(day)}</span>`);
  if (week !== null && week !== undefined) parts.push(`<span class="${pctClass(week)}" title="التغير عن إغلاق آخر يوم خميس">أسبوعي ${fmtPct(week)}</span>`);
  if (!parts.length) return "";
  return `<div class="muted" style="font-size:11px; display:flex; gap:10px; margin-top:2px;">${parts.join("")}</div>`;
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
            ${priceChangesLineHtml(s.price_changes)}
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
    const latest = idx.latest_price;
    const priceRowHtml = `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin:10px 0;">
      <div>
        <div class="price">${latest ? fmtNum(latest.close) : "لا توجد بيانات سعر"}</div>
        <div class="muted">${latest ? "بتاريخ " + escapeHtml(latest.date) : ""}</div>
        ${priceChangesLineHtml(idx.price_changes)}
      </div>
      ${sparklineSVG(idx.recent_closes)}
    </div>`;
    return `<div class="card"><div class="head" style="display:flex; justify-content:space-between; align-items:center;"><strong>${escapeHtml(idx.name)}</strong>${recommendationBadgeHtml(rec ? rec.recommendation_type : null)}</div>${priceRowHtml}${chartHtml}</div>`;
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
// تطوير 28-3: نسبة النجاح بعد المقيّم v2 — التأكيدات المتكررة (is_confirmation) مش بتتحسب، و"انتهى الأفق"
// (expired) بيتحسب في المقام (مش بيتشال). نفس معادلة recommendation_evaluation.performance_stats في بايثون.
function recSuccessStats(recs) {
  const heads = (recs || []).filter(r => !r.is_confirmation);
  const count = s => heads.filter(r => r.outcome_status === s).length;
  const correct = count("validated_correct"), incorrect = count("validated_incorrect");
  const partial = count("validated_partial"), expired = count("expired");
  const denom = correct + incorrect + partial + expired;
  return {
    independent: heads.length, confirmations: (recs || []).length - heads.length, denom,
    rate: denom ? Math.round(((correct + 0.5 * partial) / denom) * 1000) / 10 : null,
  };
}
function computeSuccessRate(recs) { return recSuccessStats(recs).rate; }
const OUTCOME_STATUS_LABELS = {
  pending: "معلّقة ⏳", validated_correct: "صح ✅", validated_incorrect: "غلط ❌", validated_partial: "جزئي ⚠️",
  expired: "انتهى الأفق ⌛", not_applicable: "مش بتتقيّم",
};
function outcomeCellHtml(r) {
  if (r.is_confirmation) return `<span class="muted" title="${escapeHtml(r.outcome_notes || "")}">↻ تأكيد</span>`;
  const label = OUTCOME_STATUS_LABELS[r.outcome_status || "pending"] || r.outcome_status;
  return `<span title="${escapeHtml(r.outcome_notes || "")}">${escapeHtml(label)}</span>`;
}
function successCaption(recs) {
  const st = recSuccessStats(recs);
  let t = st.confirmations ? ` — ${st.independent} مستقلة و${st.confirmations} تأكيد` : "";
  if (st.rate !== null) t += ` — نسبة نجاح ${st.rate}% من ${st.denom} محسومة`;
  else t += " — لسه مفيش توصيات محسومة";
  return t;
}
function recTable(recs) {
  if (!recs.length) return `<div class="empty-state">لا توجد توصيات مسجّلة في هذا النطاق</div>`;
  const rows = [...recs].reverse().map(r => `<tr><td>${escapeHtml(r.generated_at || "—")}</td><td>${recommendationBadgeHtml(r.recommendation_type)}</td><td>${escapeHtml(r.confidence_level || "—")}</td><td>${escapeHtml(r.price_at_recommendation || "—")}</td><td>${escapeHtml(r.reasoning_summary || "—")}</td><td>${outcomeCellHtml(r)}</td></tr>`).join("");
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
  const rateText = successRate === null ? `لا يوجد عدد كافٍ من التوصيات المحسومة بعد (${recs.length} توصية إجمالاً${successCaption(recs).split(" — لسه")[0]})` : `نسبة النجاح: <strong>${successRate}%</strong> (${recs.length} توصية إجمالاً${successCaption(recs).split(" — نسبة")[0]} — من ${recSuccessStats(recs).denom} محسومة)`;
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

function patternRoleBadgeHtml(role) {
  if (role === "قائد") return `<span class="badge badge-role-leading">🚀 قائد — دخول مبكر</span>`;
  if (role === "تابع") return `<span class="badge badge-role-lagging">↩️ تابع — رد فعل</span>`;
  return "";
}
function triggerIndicatorsHtml(indicators) {
  if (!indicators || !indicators.length) return `<div class="muted">لا توجد مؤشرات تفعيل مسجّلة</div>`;
  return `<ul>${indicators.map(t => `<li>${escapeHtml(t.indicator || "")} <span class="muted">(${escapeHtml(t.data_source || "")})</span></li>`).join("")}</ul>`;
}
function patternCardHtml(p) {
  const rateText = p.success_rate_percent !== null && p.success_rate_percent !== undefined
    ? `${p.success_rate_percent}% (${p.validated_count || 0} حالة مُقيَّمة)`
    : "— (لا حالات مُقيَّمة بعد)";
  return `<div class="card">
    <div class="head" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
      <div>
        <strong>${escapeHtml(p.pattern_name || p.pattern_id)}</strong>
        <span class="muted">(${escapeHtml(p.pattern_id)})</span>
        <div class="muted">${escapeHtml(p.status_label || "—")} — ${escapeHtml(LOGIC_TYPE_LABELS[p.logic_type] || p.logic_type || "")}${p.action_type ? " — الإجراء: " + escapeHtml(PATTERN_ACTION_LABELS[p.action_type] || p.action_type) : ""}</div>
        <div style="margin-top:4px;">${patternRoleBadgeHtml(p.pattern_role)}</div>
      </div>
      <div class="muted">
        نسبة النجاح: <strong>${rateText}</strong>
        <br/>آخر تفعيل: ${p.last_activation ? escapeHtml(p.last_activation) : "لا يوجد بعد"}
      </div>
    </div>
    <p>${escapeHtml(p.description || "")}</p>
    ${triggerIndicatorsHtml(p.trigger_indicators)}
  </div>`;
}
function renderPatterns(data) {
  const container = document.getElementById("patterns-container");
  if (!container) return;
  const list = data.patterns || [];
  if (!list.length) { container.innerHTML = `<div class="empty-state">لا يوجد أي نمط في الأرشيف بعد</div>`; return; }
  container.innerHTML = list.map(patternCardHtml).join("");
}

// ---- المحفظة الافتراضية (تطوير 21) -- عرض فقط، بدون أي زرار أو فورم أو حقل إدخال، بلا أي fetch
// لأي endpoint حي (كل شيء جاي من data.json الثابت زي باقي الصفحة) ----
const ORDER_SIDE_LABELS = { buy: "شراء", sell: "بيع" };
const ACTION_TYPE_LABELS = { buy_order: "أمر شراء", sell_order: "أمر بيع", stop_order: "أمر وقف", cancel_order: "إلغاء أمر", buy_filled: "✅ تنفيذ شراء", sell_filled: "✅ تنفيذ بيع", stop_filled: "🛑 تنفيذ وقف", dividend: "💰 توزيعة", liquidation: "تصفية" };
const PORTFOLIO_ARCHIVE_SHOWN = 15; // بدون زرار "عرض المزيد" -- أحدث 15 إجراء بس، والباقي كنص فقط

function portfolioOverviewStatsHtml(ov) {
  return `<div class="stat-grid">
    <div class="stat-box"><div class="label">رأس المال الأولي</div><div class="value">${fmtNum(ov.initial_capital)} ج.م</div></div>
    <div class="stat-box"><div class="label">القيمة الإجمالية للمحفظة</div><div class="value">${fmtNum(ov.total_portfolio_value)} ج.م</div></div>
    <div class="stat-box"><div class="label">الربح/الخسارة الكلية</div><div class="value ${pctClass(ov.total_pnl_percent)}">${fmtPct(ov.total_pnl_percent)}</div></div>
    <div class="stat-box"><div class="label">السيولة المتاحة</div><div class="value">${fmtNum(ov.cash_available)} ج.م</div></div>
    <div class="stat-box"><div class="label">السيولة المحجوزة بأوامر معلقة</div><div class="value">${fmtNum(ov.cash_reserved_by_pending_orders)} ج.م</div></div>
    <div class="stat-box"><div class="label">إجمالي أوامر الشراء المعلقة</div><div class="value">${fmtNum(ov.pending_buy_orders_total)} ج.م</div></div>
    <div class="stat-box"><div class="label">قيمة الأسهم المملوكة</div><div class="value">${fmtNum(ov.total_market_value)} ج.م</div></div>
    <div class="stat-box"><div class="label">الجولة الحالية</div><div class="value">#${fmtNum(ov.round_number)}</div></div>
  </div>
  <div class="muted" style="margin-top:8px;">بداية الجولة الحالية: ${escapeHtml(ov.round_started_at || "—")}</div>`;
}
function portfolioStocksTableHtml(stocks) {
  if (!stocks || !stocks.length) return `<div class="empty-state">لا توجد مراكز مفتوحة حاليًا</div>`;
  const rows = stocks.map(s => `<tr>
    <td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.ticker)}</td><td>${fmtNum(s.quantity)}</td>
    <td>${fmtNum(s.avg_cost)}</td><td>${fmtNum(s.current_price)}</td><td>${fmtNum(s.market_value)} ج.م</td>
    <td class="${pctClass(s.unrealized_pnl_percent)}">${fmtPct(s.unrealized_pnl_percent)}</td>
    <td>${fmtPct(s.weight_percent)}${s.over_concentration_cap ? ' <span class="badge badge-outlier" title="تجاوز سقف التركيز 30%">⚠️</span>' : ""}</td>
  </tr>`).join("");
  return `<table><thead><tr><th>السهم</th><th>الرمز</th><th>الكمية</th><th>متوسط الشراء</th><th>السعر الحالي</th><th>القيمة السوقية</th><th>ربح/خسارة غير محقق</th><th>الوزن بالمحفظة</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function portfolioOrdersTableHtml(orders) {
  if (!orders || !orders.length) return `<div class="empty-state">لا توجد أوامر معلقة حاليًا</div>`;
  const rows = orders.map(o => `<tr>
    <td>${escapeHtml(o.name)}</td><td>${escapeHtml(o.ticker)}</td>
    <td>${escapeHtml(o.order_kind === "stop" ? "وقف" : (ORDER_SIDE_LABELS[o.side] || o.side))}</td><td>${escapeHtml(o.order_type || "—")}</td>
    <td>${fmtNum(o.target_price)}</td><td>${fmtNum(o.quantity)}</td>
  </tr>`).join("");
  return `<table><thead><tr><th>السهم</th><th>الرمز</th><th>الاتجاه</th><th>نوع الأمر</th><th>السعر المستهدف</th><th>الكمية</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function portfolioActionsGroupHtml(title, entries) {
  if (!entries || !entries.length) return "";
  const rows = entries.map(e => `<tr><td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.ticker)}</td><td>${fmtNum(e.quantity)}</td><td>${fmtNum(e.price)}</td><td>${escapeHtml(e.order_type || "—")}</td></tr>`).join("");
  return `<div style="margin-top:10px;"><div class="muted" style="margin-bottom:4px;">${escapeHtml(title)}</div><table><thead><tr><th>التاريخ</th><th>السهم</th><th>الرمز</th><th>الكمية</th><th>السعر</th><th>ملاحظة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function portfolioTodayActionsHtml(today, summaryText, summaryDate) {
  const groups = [
    portfolioActionsGroupHtml("أوامر الشراء", today.buy_orders),
    portfolioActionsGroupHtml("أوامر البيع", today.sell_orders),
    portfolioActionsGroupHtml("إلغاء أوامر", today.cancel_orders),
    portfolioActionsGroupHtml("أوامر وقف", today.stop_orders),
    portfolioActionsGroupHtml("اتنفذ في آخر جلسة", today.fills),
  ].join("");
  const summaryHtml = summaryText ? `<div class="muted" style="margin-top:10px;">ملخص أداء ${escapeHtml(summaryDate || "")}:</div><p>${escapeHtml(summaryText)}</p>` : "";
  if (!groups && !summaryHtml) return `<div class="empty-state">لا توجد إجراءات مسجّلة اليوم</div>`;
  return groups + summaryHtml;
}
function portfolioArchiveTableHtml(archive) {
  if (!archive || !archive.length) return `<div class="empty-state">لا يوجد أرشيف إجراءات بعد</div>`;
  const shown = archive.slice(0, PORTFOLIO_ARCHIVE_SHOWN);
  const rows = shown.map(e => `<tr><td>${escapeHtml(e.date)}</td><td>${escapeHtml(ACTION_TYPE_LABELS[e.type] || e.type)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.ticker)}</td><td>${fmtNum(e.quantity)}</td><td>${fmtNum(e.price)}</td></tr>`).join("");
  const moreNote = archive.length > PORTFOLIO_ARCHIVE_SHOWN ? `<div class="muted" style="margin-top:6px;">و${archive.length - PORTFOLIO_ARCHIVE_SHOWN} إجراء أقدم في الأرشيف الكامل بالنظام.</div>` : "";
  return `<table><thead><tr><th>التاريخ</th><th>النوع</th><th>السهم</th><th>الرمز</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>${rows}</tbody></table>${moreNote}`;
}
function portfolioClosedLotsTableHtml(lots) {
  if (!lots || !lots.length) return `<div class="empty-state">لا توجد صفقات مقفولة بعد</div>`;
  const sorted = [...lots].sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || ""));
  const rows = sorted.map(l => `<tr>
    <td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.entry_strategy || "—")}</td>
    <td>${fmtNum(l.entry_price)}</td><td>${fmtNum(l.exit_price)}</td><td>${fmtNum(l.quantity)}</td>
    <td class="${pctClass(l.realized_pnl)}">${fmtNum(l.realized_pnl)} ج.م</td>
    <td class="${pctClass(l.realized_pnl_percent)}">${fmtPct(l.realized_pnl_percent)}</td>
    <td>${escapeHtml(l.closed_at || "—")}</td>
  </tr>`).join("");
  return `<table><thead><tr><th>السهم</th><th>الاستراتيجية</th><th>سعر الدخول</th><th>سعر الخروج</th><th>الكمية</th><th>الربح/الخسارة</th><th>النسبة</th><th>تاريخ الإغلاق</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function portfolioArchivedRoundsTableHtml(rounds) {
  if (!rounds || !rounds.length) return "";
  const rows = rounds.map(r => `<tr><td>#${fmtNum(r.round_number)}</td><td>${escapeHtml(r.round_started_at || "—")}</td><td>${escapeHtml(r.round_ended_at || "—")}</td><td>${fmtNum(r.initial_capital)} ج.م</td><td>${fmtNum(r.final_cash)} ج.م</td><td>${fmtNum(r.closed_lots_count)}</td></tr>`).join("");
  return `<div class="card">
    <h3 style="margin-top:0;">جولات سابقة (قبل آخر تصفية)</h3>
    <table><thead><tr><th>الجولة</th><th>البداية</th><th>النهاية</th><th>رأس المال الأولي</th><th>السيولة النهائية</th><th>عدد الصفقات المقفولة</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}
function renderPortfolio(data) {
  const container = document.getElementById("portfolio-container");
  if (!container) return;
  const vp = data.virtual_portfolio;
  if (!vp || !vp.initialized) {
    container.innerHTML = `<div class="empty-state">المحفظة الافتراضية لسه مش مفعّلة.</div>`;
    return;
  }
  const ov = vp.overview;
  const at = vp.actions_table;
  container.innerHTML = `
    <div class="card">${portfolioOverviewStatsHtml(ov)}</div>
    <div class="card"><h3 style="margin-top:0;">المراكز المفتوحة</h3>${portfolioStocksTableHtml(ov.stocks)}</div>
    <div class="card"><h3 style="margin-top:0;">الأوامر المعلقة</h3>${portfolioOrdersTableHtml(ov.pending_orders)}</div>
    <div class="card"><h3 style="margin-top:0;">إجراءات اليوم</h3>${portfolioTodayActionsHtml(at.today, at.daily_summary_text, at.daily_summary_date)}</div>
    <div class="card"><h3 style="margin-top:0;">أرشيف الإجراءات</h3>${portfolioArchiveTableHtml(at.archive)}</div>
    <div class="card"><h3 style="margin-top:0;">الصفقات المقفولة</h3>${portfolioClosedLotsTableHtml(vp.closed_lots)}</div>
    ${portfolioArchivedRoundsTableHtml(vp.archived_rounds)}
  `;
}

// ---- تشغيل ----
async function boot() {
  const res = await fetch("data.json?t=" + Date.now()); // منع أي كاش للبيانات — لازم كل زيارة تجيب أحدث نسخة
  const data = await res.json();
  const label = document.getElementById("generated-at-label");
  if (label) label.textContent = data.generated_at;
  renderDashboard(data);
  renderIndices(data);
  renderLatestReport(data);
  renderRecommendations(data);
  renderPatterns(data);
  renderPortfolio(data);
}
boot();
