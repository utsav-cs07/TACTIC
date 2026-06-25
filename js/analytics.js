/* ═══════════════════════════════════════════
   ANALYTICS.JS — Charts & Stats
═══════════════════════════════════════════ */
'use strict';

const Analytics = (() => {

  function drawProgressRing(canvas, pct, color = '#00d4ff', size = 100) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = (size / 2) - 8;
    const cx = size / 2, cy = size / 2;
    const arc = 2 * Math.PI;

    canvas.width = canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, arc);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Fill
    const end = (arc * pct / 100) - Math.PI / 2;
    const start = -Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + (arc * pct / 100));
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f0f0ff';
    ctx.font = `bold ${size * 0.18}px Outfit`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pct + '%', cx, cy);
  }

  function drawBarChart(canvas, data, options = {}) {
    if (!canvas) return;
    const {
      barColor = '#00d4ff',
      barColor2 = '#a855f7',
      height = 200,
      labelKey = 'label',
      val1Key = 'done',
      val2Key = 'due',
    } = options;

    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 600;
    const H = height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    const padL = 28, padR = 16, padT = 16, padB = 36;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = data.length;
    const maxVal = Math.max(...data.map(d => Math.max(d[val1Key] || 0, d[val2Key] || 0)), 1);
    const barW = (chartW / n) * 0.35;
    const gap  = (chartW / n) * 0.1;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '9px Outfit';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 4), padL - 4, y + 3);
    }

    data.forEach((d, i) => {
      const x = padL + (chartW / n) * i + gap;
      const v1 = d[val1Key] || 0;
      const v2 = d[val2Key] || 0;
      const bH1 = (v1 / maxVal) * chartH;
      const bH2 = (v2 / maxVal) * chartH;

      // Bar 2 (background/due)
      if (val2Key && v2 > 0) {
        const grad2 = ctx.createLinearGradient(0, padT + chartH - bH2, 0, padT + chartH);
        grad2.addColorStop(0, barColor2 + '88');
        grad2.addColorStop(1, barColor2 + '11');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.roundRect(x, padT + chartH - bH2, barW, bH2, [4, 4, 0, 0]);
        ctx.fill();
      }

      // Bar 1 (foreground/done)
      const grad = ctx.createLinearGradient(0, padT + chartH - bH1, 0, padT + chartH);
      grad.addColorStop(0, barColor + 'ee');
      grad.addColorStop(1, barColor + '44');
      ctx.fillStyle = grad;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(x + (val2Key ? barW * 0.1 : 0), padT + chartH - bH1, barW * 0.8, bH1, [4, 4, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(d[labelKey], x + barW / 2, H - padB + 14);
    });
  }

  function drawDonutChart(canvas, data, size = 140) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.height = size * devicePixelRatio;
    canvas.style.width = canvas.style.height = size + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, r = size / 2 - 10;
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let startAngle = -Math.PI / 2;

    data.forEach(d => {
      const slice = (d.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      startAngle += slice;
    });

    // Center hole
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#0d0d2b';
    ctx.fill();
  }

  function drawLineChart(canvas, data, options = {}) {
    if (!canvas) return;
    const { color = '#00d4ff', height = 120 } = options;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 400;
    const H = height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    const pad = 16;
    const chartW = W - pad * 2;
    const chartH = H - pad * 2;
    const maxV = Math.max(...data.map(d => d.value), 1);
    const pts = data.map((d, i) => ({
      x: pad + (i / (data.length - 1)) * chartW,
      y: pad + chartH - (d.value / maxV) * chartH,
    }));

    // Area fill
    const grad = ctx.createLinearGradient(0, pad, 0, pad + chartH);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad + chartH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, pad + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
  }

  return { drawProgressRing, drawBarChart, drawDonutChart, drawLineChart };
})();
