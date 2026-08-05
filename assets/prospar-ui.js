/* ============================================================
   Prospar Consulting — Shared UI Library (v0.1 prototype)
   Input bindings, stat cards, SVG charts (area / stacked bar /
   donut), tables, CSV, URL state, share & print.
   Depends on: finance-engine.js (window.ProFin) + theme CSS vars.
   ============================================================ */
(function (root) {
  "use strict";
  var F = root.ProFin;
  var doc = document;

  function $(id) { return doc.getElementById(id); }
  function cssVar(name) {
    return getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
  }

  var COLORS = {}; // filled lazily on first use so CSS is loaded
  function color(key) {
    if (!COLORS.ready) {
      COLORS.invested = cssVar("--pc-invested");
      COLORS.gains = cssVar("--pc-gains");
      COLORS.cat3 = cssVar("--pc-cat3");
      COLORS.cat4 = cssVar("--pc-cat4");
      COLORS.cat5 = cssVar("--pc-cat5");
      COLORS.other = cssVar("--pc-other");
      COLORS.target = cssVar("--pc-target");
      COLORS.goldInk = cssVar("--pc-gold-ink");
      COLORS.line = cssVar("--pc-line");
      COLORS.muted = cssVar("--pc-muted");
      COLORS.ink2 = cssVar("--pc-ink-2");
      COLORS.bad = cssVar("--pc-bad");
      COLORS.good = cssVar("--pc-good");
      COLORS.investedTint = cssVar("--pc-invested-tint");
      COLORS.gainsTint = cssVar("--pc-gains-tint");
      COLORS.ready = true;
    }
    return key ? COLORS[key] : COLORS;
  }

  /* ------------------- inputs ------------------- */

  function paintSlider(sl) {
    var min = +sl.min, max = +sl.max, v = +sl.value;
    sl.style.setProperty("--fill", ((v - min) / (max - min) * 100) + "%");
  }

  /* number box + slider pair; onChange(value) fires on any commit */
  function bindPair(numId, slId, onChange) {
    var num = $(numId), sl = $(slId);
    function clamp(v) { return Math.min(+sl.max, Math.max(+sl.min, v)); }
    sl.addEventListener("input", function () {
      var v = +sl.value;
      if (doc.activeElement !== num) num.value = v;
      else num.value = v;
      paintSlider(sl); onChange(v);
    });
    num.addEventListener("input", function () {
      var v = parseFloat(num.value);
      if (isFinite(v)) { v = clamp(v); sl.value = v; paintSlider(sl); onChange(v); }
    });
    num.addEventListener("blur", function () {
      var v = parseFloat(num.value);
      v = isFinite(v) ? clamp(v) : +sl.value;
      num.value = v; sl.value = v; paintSlider(sl); onChange(v);
    });
    paintSlider(sl);
    return {
      set: function (v) { num.value = v; sl.value = v; paintSlider(sl); },
      get: function () { return +sl.value; }
    };
  }

  function bindToggle(id, onChange) {
    var el = $(id);
    el.addEventListener("change", function () { onChange(el.checked); });
    return { set: function (v) { el.checked = !!v; }, get: function () { return el.checked; } };
  }

  /* chips group: buttons with data-val inside container */
  function bindChips(containerId, onPick) {
    var box = $(containerId);
    var chips = box.querySelectorAll(".pc-chip[data-val]");
    function sync(v) {
      Array.prototype.forEach.call(chips, function (c) {
        c.setAttribute("aria-pressed", String(parseFloat(c.dataset.val) === v || c.dataset.val === String(v)));
      });
    }
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener("click", function () {
        var v = isNaN(parseFloat(c.dataset.val)) ? c.dataset.val : parseFloat(c.dataset.val);
        sync(v); onPick(v);
      });
    });
    return { sync: sync };
  }

  /* ------------------- outputs ------------------- */

  function statCard(o) {
    return '<div class="pc-stat' + (o.hero ? " pc-stat--hero" : "") + '">' +
      '<div class="pc-stat__label">' +
      (o.dot ? '<span class="pc-stat__dot" style="background:' + o.dot + '"></span>' : "") +
      o.label + "</div>" +
      '<div class="pc-stat__value">' + o.value + "</div>" +
      (o.sub ? '<div class="pc-stat__sub">' + o.sub + "</div>" : "") + "</div>";
  }
  function renderStats(elId, cards) {
    $(elId).innerHTML = cards.map(statCard).join("");
  }
  function callout(elId, html) {
    var el = $(elId);
    if (html) { el.hidden = false; el.innerHTML = html; }
    else el.hidden = true;
  }
  function legend(elId, items) {
    $(elId).innerHTML = items.map(function (it) {
      if (it.dash) {
        return '<span><i style="background:transparent;border-top:3px dashed ' + it.color +
          ';border-radius:0;height:0;margin-top:5px"></i>' + it.label + "</span>";
      }
      return '<span><i style="background:' + it.color + '"></i>' + it.label + "</span>";
    }).join("");
  }
  function assumptions(elId, list) {
    $(elId).innerHTML = list.map(function (c) {
      return '<span class="pc-chip pc-chip--static">' + c + "</span>";
    }).join("");
  }

  /* ------------------- axis helpers ------------------- */

  function compactAxis(v) {
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    function trim1(n) { var t = n.toFixed(1); return t.replace(/\.0$/, ""); }
    if (a >= 1e7) return s + "₹" + trim1(a / 1e7) + " Cr";
    if (a >= 1e5) return s + "₹" + trim1(a / 1e5) + " L";
    if (a >= 1e3) return s + "₹" + trim1(a / 1e3) + "k";
    return s + "₹" + Math.round(a);
  }

  function niceScale(maxV, ticks) {
    ticks = ticks || 4;
    if (maxV <= 0) maxV = 1;
    var raw = maxV / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag, step;
    if (norm <= 1) step = 1; else if (norm <= 2) step = 2;
    else if (norm <= 2.5) step = 2.5; else if (norm <= 5) step = 5; else step = 10;
    step *= mag;
    return { top: Math.ceil(maxV / step) * step, step: step };
  }

  /* ------------------- area / line chart -------------------
     mountAreaChart(wrapEl, cfg)
       cfg.rows        [{x, <fields>}] sorted by x
       cfg.x           {min, max, format(v)}
       cfg.series      [{field, color, width, dash, fillTo:'zero'|field|null,
                         tint, gapUnder:true}]  (drawn in order)
       cfg.refY        [{value, color, dash, label, labelColor}]
       cfg.refX        [{value, color, label}]
       cfg.marker      {x, y, label, color}
       cfg.yMaxExtra   include value in y-scale
       cfg.tooltip     (row) => {title, rows:[{sw, label, value}]}
  ------------------------------------------------------------- */
  function mountAreaChart(wrap, cfg) {
    if (typeof wrap === "string") wrap = $(wrap);
    var W = 820, H = cfg.height || 330, ML = 62, MR = 14, MT = 16, MB = 32;
    var C = color();

    wrap.classList.add("pc-chart-wrap");
    wrap.innerHTML = '<svg role="img" aria-label="' + (cfg.ariaLabel || "chart") +
      '"></svg><div class="pc-tip"></div>';
    var svgEl = wrap.querySelector("svg"), tip = wrap.querySelector(".pc-tip");

    var rows = cfg.rows;
    var xmin = cfg.x.min !== undefined ? cfg.x.min : 0;
    var xmax = cfg.x.max;
    var maxV = cfg.yMaxExtra || 0;
    rows.forEach(function (r) {
      cfg.series.forEach(function (s) { maxV = Math.max(maxV, r[s.field] || 0); });
    });
    (cfg.refY || []).forEach(function (r) { maxV = Math.max(maxV, r.value); });
    var sc = niceScale(maxV), top = sc.top, step = sc.step;

    var x = function (v) { return ML + (W - ML - MR) * ((v - xmin) / (xmax - xmin || 1)); };
    var y = function (v) { return MT + (H - MT - MB) * (1 - v / top); };

    var svg = "";
    for (var v = 0; v <= top + step * 0.01; v += step) {
      var yy = y(v);
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + yy + '" y2="' + yy +
        '" stroke="' + C.line + '" stroke-width="1"/>' +
        '<text x="' + (ML - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11.5" fill="' +
        C.muted + '">' + compactAxis(v) + "</text>";
    }
    var span = xmax - xmin;
    var xstep = Math.max(1, Math.ceil(span / 8));
    for (var xv = xmin; xv <= xmax; xv += xstep) {
      svg += '<text x="' + x(xv) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" fill="' +
        C.muted + '">' + (cfg.x.format ? cfg.x.format(xv) : xv) + "</text>";
    }

    function linePath(field) {
      var d = "";
      rows.forEach(function (r, i) {
        d += (i ? "L" : "M") + x(r.x).toFixed(1) + " " + y(r[field] || 0).toFixed(1) + " ";
      });
      return d;
    }

    // fills first
    cfg.series.forEach(function (s) {
      if (!s.fillTo) return;
      var d = linePath(s.field);
      if (s.fillTo === "zero") {
        d += "L" + x(rows[rows.length - 1].x).toFixed(1) + " " + y(0) +
          " L" + x(rows[0].x).toFixed(1) + " " + y(0) + " Z";
      } else {
        for (var i = rows.length - 1; i >= 0; i--)
          d += "L" + x(rows[i].x).toFixed(1) + " " + y(rows[i][s.fillTo] || 0).toFixed(1) + " ";
        d += "Z";
      }
      svg += '<path d="' + d + '" fill="' + (s.tint || "rgba(0,0,0,.08)") + '"/>';
    });
    // strokes (with optional 2px surface gap under a boundary)
    cfg.series.forEach(function (s) {
      var d = linePath(s.field);
      if (s.gapUnder) svg += '<path d="' + d + '" fill="none" stroke="#ffffff" stroke-width="4"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + s.color +
        '" stroke-width="' + (s.width || 2) + '"' +
        (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + "/>";
    });

    (cfg.refY || []).forEach(function (r) {
      var yy = y(r.value);
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + yy + '" y2="' + yy +
        '" stroke="' + r.color + '" stroke-width="2" stroke-dasharray="' + (r.dash || "7 5") + '"/>';
      if (r.label)
        svg += '<text x="' + (W - MR - 4) + '" y="' + (yy - 7) +
          '" text-anchor="end" font-size="12" font-weight="600" fill="' +
          (r.labelColor || r.color) + '">' + r.label + "</text>";
    });
    (cfg.refX || []).forEach(function (r) {
      var xx = x(r.value);
      svg += '<line y1="' + MT + '" y2="' + (H - MB) + '" x1="' + xx + '" x2="' + xx +
        '" stroke="' + (r.color || C.muted) + '" stroke-width="1.5" stroke-dasharray="5 4"/>';
      if (r.label)
        svg += '<text x="' + (xx + 5) + '" y="' + (MT + 12) +
          '" font-size="11.5" font-weight="600" fill="' + (r.color || C.muted) + '">' + r.label + "</text>";
    });
    if (cfg.marker) {
      svg += '<circle cx="' + x(cfg.marker.x) + '" cy="' + y(cfg.marker.y) +
        '" r="5.5" fill="' + (cfg.marker.color || C.bad) + '" stroke="#fff" stroke-width="2"/>';
      if (cfg.marker.label)
        svg += '<text x="' + Math.min(x(cfg.marker.x) + 9, W - MR - 60) + '" y="' + (y(cfg.marker.y) - 9) +
          '" font-size="12" font-weight="700" fill="' + (cfg.marker.color || C.bad) + '">' +
          cfg.marker.label + "</text>";
    }

    // end labels
    (cfg.endLabels || []).forEach(function (l, idx) {
      var last = rows[rows.length - 1];
      var yy = y(last[l.field] || 0) + (l.dy || -8);
      yy = Math.max(MT + 11, Math.min(H - MB - 4, yy));
      svg += '<text x="' + (W - MR - 4) + '" y="' + yy +
        '" text-anchor="end" font-size="12" font-weight="700" fill="' + C.ink2 + '">' +
        l.text(last) + "</text>";
    });

    // hover plumbing
    svg += '<line class="xline" x1="0" x2="0" y1="' + MT + '" y2="' + (H - MB) +
      '" stroke="' + C.muted + '" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>';
    cfg.series.forEach(function (s, i) {
      svg += '<circle class="xdot" data-i="' + i + '" r="4.5" fill="' + s.color +
        '" stroke="#fff" stroke-width="2" opacity="0"/>';
    });
    svg += '<rect class="hoverzone" x="' + ML + '" y="' + MT + '" width="' + (W - ML - MR) +
      '" height="' + (H - MT - MB) + '" fill="transparent"/>';

    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    svgEl.innerHTML = svg;

    var hover = svgEl.querySelector(".hoverzone"),
        xline = svgEl.querySelector(".xline"),
        dots = svgEl.querySelectorAll(".xdot");

    function nearestRow(clientX) {
      var r = svgEl.getBoundingClientRect();
      var sx = (clientX - r.left) / r.width * W;
      var frac = (sx - ML) / (W - ML - MR);
      var target = xmin + frac * (xmax - xmin);
      var best = rows[0], bd = Infinity;
      rows.forEach(function (row) {
        var d = Math.abs(row.x - target);
        if (d < bd) { bd = d; best = row; }
      });
      return best;
    }
    function show(clientX) {
      var row = nearestRow(clientX);
      var px = x(row.x);
      xline.setAttribute("x1", px); xline.setAttribute("x2", px); xline.setAttribute("opacity", "1");
      Array.prototype.forEach.call(dots, function (d, i) {
        var s = cfg.series[i];
        d.setAttribute("cx", px); d.setAttribute("cy", y(row[s.field] || 0));
        d.setAttribute("opacity", "1");
      });
      var t = cfg.tooltip(row);
      var html = '<div class="t-year">' + t.title + "</div>";
      t.rows.forEach(function (tr) {
        html += '<div class="t-row"><span>' +
          (tr.sw ? '<i style="background:' + tr.sw + '"></i>' : '<span style="padding-left:13px"></span>') +
          tr.label + "</span><span>" + tr.value + "</span></div>";
      });
      tip.innerHTML = html;
      var wr = wrap.getBoundingClientRect();
      var left = (px / W) * wr.width;
      tip.style.opacity = "1";
      var tw = tip.offsetWidth;
      tip.style.left = Math.min(wr.width - tw - 4, Math.max(4, left + (left > wr.width / 2 ? -tw - 14 : 14))) + "px";
      tip.style.top = "18px";
    }
    function hide() {
      tip.style.opacity = "0";
      xline.setAttribute("opacity", "0");
      Array.prototype.forEach.call(dots, function (d) { d.setAttribute("opacity", "0"); });
    }
    hover.addEventListener("mousemove", function (e) { show(e.clientX); });
    hover.addEventListener("mouseleave", hide);
    hover.addEventListener("touchstart", function (e) { show(e.touches[0].clientX); }, { passive: true });
    hover.addEventListener("touchmove", function (e) { show(e.touches[0].clientX); }, { passive: true });
    hover.addEventListener("touchend", hide);
  }

  /* ------------------- stacked bar chart -------------------
     mountBarChart(wrapEl, cfg)
       cfg.rows     [{x, segments:[{label,color,value}], line?}]
       cfg.lineColor / cfg.lineWidth  optional overlay line (same ₹ axis)
       cfg.x.format(v), cfg.tooltip(row)
  ------------------------------------------------------------- */
  function mountBarChart(wrap, cfg) {
    if (typeof wrap === "string") wrap = $(wrap);
    var W = 820, H = cfg.height || 330, ML = 62, MR = 14, MT = 16, MB = 32;
    var C = color();
    wrap.classList.add("pc-chart-wrap");
    wrap.innerHTML = '<svg role="img" aria-label="' + (cfg.ariaLabel || "chart") +
      '"></svg><div class="pc-tip"></div>';
    var svgEl = wrap.querySelector("svg"), tip = wrap.querySelector(".pc-tip");

    var rows = cfg.rows, n = rows.length;
    var maxV = 0;
    rows.forEach(function (r) {
      var s = 0; r.segments.forEach(function (seg) { s += seg.value; });
      maxV = Math.max(maxV, s, r.line || 0);
    });
    var sc = niceScale(maxV), top = sc.top, step = sc.step;
    var plotW = W - ML - MR;
    var slot = plotW / n;
    var bw = Math.min(34, Math.max(6, slot * 0.62));
    var y = function (v) { return MT + (H - MT - MB) * (1 - v / top); };
    var xc = function (i) { return ML + slot * i + slot / 2; };

    var svg = "";
    for (var v = 0; v <= top + step * 0.01; v += step) {
      var yy = y(v);
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + yy + '" y2="' + yy +
        '" stroke="' + C.line + '" stroke-width="1"/>' +
        '<text x="' + (ML - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11.5" fill="' +
        C.muted + '">' + compactAxis(v) + "</text>";
    }
    var lblEvery = Math.max(1, Math.ceil(n / 10));
    rows.forEach(function (r, i) {
      if (i % lblEvery === 0 || i === n - 1)
        svg += '<text x="' + xc(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11.5" fill="' +
          C.muted + '">' + (cfg.x && cfg.x.format ? cfg.x.format(r.x) : r.x) + "</text>";
    });

    rows.forEach(function (r, i) {
      var acc = 0;
      r.segments.forEach(function (seg, si) {
        var y0 = y(acc), y1 = y(acc + seg.value);
        var hpx = Math.max(0, y0 - y1 - (si < r.segments.length - 1 ? 2 : 0)); // 2px gap
        var isTop = si === r.segments.length - 1;
        svg += '<rect x="' + (xc(i) - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + hpx.toFixed(1) +
          '" fill="' + seg.color + '"' +
          (isTop ? ' rx="4"' : "") + "/>";
        acc += seg.value;
      });
    });

    if (rows.some(function (r) { return r.line !== undefined; })) {
      var d = "";
      rows.forEach(function (r, i) {
        d += (i ? "L" : "M") + xc(i).toFixed(1) + " " + y(r.line || 0).toFixed(1) + " ";
      });
      svg += '<path d="' + d + '" fill="none" stroke="' + (cfg.lineColor || C.ink2) +
        '" stroke-width="' + (cfg.lineWidth || 2) + '"/>';
    }

    svg += '<rect class="hoverzone" x="' + ML + '" y="' + MT + '" width="' + plotW +
      '" height="' + (H - MT - MB) + '" fill="transparent"/>';
    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    svgEl.innerHTML = svg;

    var hover = svgEl.querySelector(".hoverzone");
    function show(clientX) {
      var r = svgEl.getBoundingClientRect();
      var sx = (clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.floor((sx - ML) / slot)));
      var row = rows[i];
      var t = cfg.tooltip(row);
      var html = '<div class="t-year">' + t.title + "</div>";
      t.rows.forEach(function (tr) {
        html += '<div class="t-row"><span>' +
          (tr.sw ? '<i style="background:' + tr.sw + '"></i>' : '<span style="padding-left:13px"></span>') +
          tr.label + "</span><span>" + tr.value + "</span></div>";
      });
      tip.innerHTML = html;
      var wr = wrap.getBoundingClientRect();
      var left = (xc(i) / W) * wr.width;
      tip.style.opacity = "1";
      var tw = tip.offsetWidth;
      tip.style.left = Math.min(wr.width - tw - 4, Math.max(4, left + (left > wr.width / 2 ? -tw - 14 : 14))) + "px";
      tip.style.top = "14px";
    }
    hover.addEventListener("mousemove", function (e) { show(e.clientX); });
    hover.addEventListener("mouseleave", function () { tip.style.opacity = "0"; });
    hover.addEventListener("touchstart", function (e) { show(e.touches[0].clientX); }, { passive: true });
    hover.addEventListener("touchmove", function (e) { show(e.touches[0].clientX); }, { passive: true });
    hover.addEventListener("touchend", function () { tip.style.opacity = "0"; });
  }

  /* ------------------- donut -------------------
     mountDonut(wrapEl, {slices:[{label,value,color}],
                         centerLabel, centerValue})
     Renders donut + value legend side by side.
  ------------------------------------------------ */
  function mountDonut(wrap, cfg) {
    if (typeof wrap === "string") wrap = $(wrap);
    var size = 240, cx = size / 2, cy = size / 2, R = 108, r0 = 72;
    var total = 0;
    cfg.slices.forEach(function (s) { total += Math.max(0, s.value); });

    var svg = "";
    if (total <= 0) {
      svg = '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r0) / 2) +
        '" fill="none" stroke="' + color("line") + '" stroke-width="' + (R - r0) + '"/>';
    } else {
      var a0 = -Math.PI / 2;
      cfg.slices.forEach(function (s) {
        if (s.value <= 0) return;
        var frac = s.value / total;
        var a1 = a0 + frac * Math.PI * 2;
        // 2px gap: shrink each arc by a small angle
        var gap = Math.min(0.03, (a1 - a0) * 0.08);
        var b0 = a0 + gap / 2, b1 = a1 - gap / 2;
        var large = (b1 - b0) > Math.PI ? 1 : 0;
        function pt(rr, a) { return (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2); }
        if (frac >= 0.999) {
          svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r0) / 2) +
            '" fill="none" stroke="' + s.color + '" stroke-width="' + (R - r0) + '"/>';
        } else {
          svg += '<path d="M' + pt(R, b0) + " A" + R + " " + R + " 0 " + large + " 1 " + pt(R, b1) +
            " L" + pt(r0, b1) + " A" + r0 + " " + r0 + " 0 " + large + " 0 " + pt(r0, b0) + ' Z" fill="' +
            s.color + '"/>';
        }
        a0 = a1;
      });
    }
    svg += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-size="12.5" fill="' +
      color("muted") + '">' + (cfg.centerLabel || "") + "</text>" +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="19" font-weight="800" fill="' +
      cssVar("--pc-ink") + '">' + (cfg.centerValue || "") + "</text>";

    var lg = cfg.slices.map(function (s) {
      var pct = total > 0 ? Math.round(s.value / total * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13.5px">' +
        '<i style="width:11px;height:11px;border-radius:3px;background:' + s.color + ';flex:0 0 auto"></i>' +
        '<span style="color:var(--pc-ink-2);flex:1">' + s.label + "</span>" +
        '<strong style="font-variant-numeric:tabular-nums">' + F.formatINRCompact(s.value) + "</strong>" +
        '<span style="color:var(--pc-muted);width:38px;text-align:right">' + pct + "%</span></div>";
    }).join("");

    wrap.innerHTML =
      '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">' +
      '<svg viewBox="0 0 ' + size + " " + size + '" style="width:210px;max-width:45vw;flex:0 0 auto" role="img" aria-label="' +
      (cfg.ariaLabel || "composition") + '">' + svg + "</svg>" +
      '<div style="flex:1;min-width:230px">' + lg + "</div></div>";
  }

  /* ------------------- table & CSV ------------------- */

  function buildTable(tableId, headers, rows) {
    var h = "<thead><tr>" + headers.map(function (x) { return "<th>" + x + "</th>"; }).join("") +
      "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    });
    $(tableId).innerHTML = h + "</tbody>";
  }

  /* Brand header prepended to every CSV download — the data file itself
     carries provenance and the disclaimer, wherever it travels. */
  function csvBrand() {
    return [
      '"Prospar Consulting LLP — consultprospar.com"',
      '"' + doc.title.replace(/"/g, "'") + ' — generated ' +
        new Date().toLocaleDateString("en-IN") + '"',
      '"For education only — not investment advice. Figures use stated ' +
        'assumptions; investments are subject to market risks."',
      ""
    ];
  }

  function csvButton(btnId, opts) {
    $(btnId).addEventListener("click", function () {
      var lines = csvBrand().concat([opts.headers().join(",")]);
      opts.rows().forEach(function (r) { lines.push(r.join(",")); });
      var blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
      var a = doc.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = opts.filename;
      doc.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    });
  }

  /* ------------------- share / print / url ------------------- */

  function shareButton(btnId) {
    var btn = $(btnId);
    btn.addEventListener("click", function () {
      var url = location.href;
      function done(ok) {
        var orig = "Copy shareable link";
        btn.textContent = ok ? "Link copied ✓" : "Copy failed — use address bar";
        setTimeout(function () { btn.textContent = orig; }, 2200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }

  function printButton(btnId, detailsId) {
    $(btnId).addEventListener("click", function () { window.print(); });
    window.addEventListener("beforeprint", function () {
      if (detailsId && $(detailsId)) $(detailsId).open = true;
    });
  }

  /* schema: {stateKey: {p:'urlParam', lo, hi, dflt, bool:true?, str:true?}} */
  function urlState(schema) {
    var timer = null;
    return {
      read: function (state) {
        var p = new URLSearchParams(location.search);
        Object.keys(schema).forEach(function (k) {
          var s = schema[k], raw = p.get(s.p);
          if (raw === null) { state[k] = s.dflt; return; }
          if (s.bool) state[k] = raw === "1";
          else if (s.str) state[k] = raw;
          else {
            var v = parseFloat(raw);
            state[k] = isFinite(v) ? Math.min(s.hi, Math.max(s.lo, v)) : s.dflt;
          }
        });
        return state;
      },
      write: function (state) {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var p = new URLSearchParams();
          Object.keys(schema).forEach(function (k) {
            var s = schema[k], v = state[k];
            if (v === undefined || v === null) return;
            if (s.bool) { if (v) p.set(s.p, "1"); }
            else p.set(s.p, v);
          });
          history.replaceState(null, "", location.pathname + "?" + p.toString());
        }, 250);
      }
    };
  }

  root.PCUI = {
    $: $,
    color: color,
    cssVar: cssVar,
    paintSlider: paintSlider,
    bindPair: bindPair,
    bindToggle: bindToggle,
    bindChips: bindChips,
    statCard: statCard,
    renderStats: renderStats,
    callout: callout,
    legend: legend,
    assumptions: assumptions,
    compactAxis: compactAxis,
    niceScale: niceScale,
    mountAreaChart: mountAreaChart,
    mountBarChart: mountBarChart,
    mountDonut: mountDonut,
    buildTable: buildTable,
    csvBrand: csvBrand,
    csvButton: csvButton,
    shareButton: shareButton,
    printButton: printButton,
    urlState: urlState
  };
})(typeof self !== "undefined" ? self : this);
