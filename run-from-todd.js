/* =====================================================================
   RUN FROM TODD - first-person 3D horror escape
   A giant spider named Todd is hunting you through dark alleys.
   5 stages x 10 levels - flashlight raycast engine - coin abilities
   3-slot save manager with JSON export/import
   ===================================================================== */
(function () {
  'use strict';

  var GID = 'run-from-todd';
  var TITLE = 'Run From Todd';
  var TOTAL = 50;

  /* ------------------------------------------------------------------ */
  /*  Utilities                                                          */
  /* ------------------------------------------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmtTime(s) {
    s = Math.floor(s || 0);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    if (m > 0) return m + 'm ' + (sec < 10 ? '0' : '') + sec + 's';
    return sec + 's';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

  /* ------------------------------------------------------------------ */
  /*  Stages & abilities                                                 */
  /* ------------------------------------------------------------------ */
  var STAGES = [
    { name: 'Back Alley', sub: 'It started behind the laundromat.', sky: [10, 9, 16], amb: 0.075, flick: 0.004, tint: '#7f1d1d' },
    { name: 'Sewer Drains', sub: 'The water is moving. Something is under it.', sky: [5, 10, 9], amb: 0.06, flick: 0.008, tint: '#14532d' },
    { name: 'Dead Market', sub: 'Every stall is covered in web.', sky: [12, 8, 4], amb: 0.05, flick: 0.012, tint: '#78350f' },
    { name: 'Ward 13', sub: 'The patients left. Todd stayed.', sky: [8, 10, 12], amb: 0.045, flick: 0.018, tint: '#1e3a8a' },
    { name: "Todd's Nest", sub: 'You are in his home now.', sky: [12, 3, 4], amb: 0.045, flick: 0.025, tint: '#450a0a' }
  ];
  var ABIL = [
    { k: 'stamina', n: 'Iron Lungs', d: '+30 max stamina and faster recovery', cost: [15, 35, 70, 120, 200] },
    { k: 'shoes', n: 'Running Shoes', d: '+6% movement speed', cost: [20, 45, 90, 150, 250] },
    { k: 'light', n: 'Better Flashlight', d: 'Longer, wider, steadier beam', cost: [15, 40, 80, 140] },
    { k: 'flares', n: 'Road Flares', d: '+1 flare per level (Q). Todd fears fire', cost: [25, 60, 120] },
    { k: 'dash', n: 'Adrenaline Dash', d: 'Press E for a burst of speed. Upgrades shorten cooldown', cost: [40, 90, 180] },
    { k: 'magnet', n: 'Coin Magnet', d: 'Pull coins in from farther away', cost: [20, 50, 100] },
    { k: 'compass', n: 'Exit Compass', d: 'An arrow points toward the exit', cost: [60] },
    { k: 'sense', n: 'Spider Sense', d: 'The screen edge shows where Todd is coming from', cost: [80] }
  ];
  var GRAFFITI = ['RUN', 'TODD', "HE'S HERE", 'DONT LOOK BACK', '8 EYES', 'HELP', 'NO EXIT', 'TODD SEES U', 'KEEP RUNNING', 'HE CLIMBS'];

  /* ------------------------------------------------------------------ */
  /*  Procedural textures (Uint32 ABGR)                                  */
  /* ------------------------------------------------------------------ */
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toTex(cv, emiFn) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    var u = new Uint32Array(d.data.buffer.slice(0));
    var emi = null;
    if (emiFn) {
      emi = new Uint8Array(cv.width * cv.height);
      for (var i = 0; i < emi.length; i++) { var p = i * 4; emi[i] = emiFn(d.data[p], d.data[p + 1], d.data[p + 2], d.data[p + 3]) ? 1 : 0; }
    }
    return { w: cv.width, h: cv.height, d: u, emi: emi, cv: cv };
  }
  function noiseFill(g, w, h, R, base, amt, size) {
    for (var y = 0; y < h; y += size) for (var x = 0; x < w; x += size) {
      var v = (R() - 0.5) * amt;
      g.fillStyle = 'rgba(' + (v > 0 ? '255,255,255,' + v : '0,0,0,' + (-v)) + ')';
      g.fillRect(x, y, size, size);
    }
  }
  function grime(g, w, h, R) {
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,0,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (0.1 + R() * 0.2) + ')';
      var x = R() * w; g.fillRect(x, R() * h * 0.3, 1 + R() * 2, h * (0.2 + R() * 0.6));
    }
  }
  function blood(g, w, h, R, n) {
    for (var i = 0; i < n; i++) {
      var x = R() * w, y = R() * h * 0.8, r = 3 + R() * 9;
      g.fillStyle = 'rgba(' + (90 + R() * 60 | 0) + ',0,0,' + (0.55 + R() * 0.35) + ')';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillRect(x - 1, y, 2 + R() * 2, 8 + R() * 30);
    }
  }
  function wallTex(stage, variant) {
    var S = 128, cv = mkCanvas(S, S), g = cv.getContext('2d'), R = mulberry32(stage * 97 + variant * 13 + 5), x, y, i;
    if (stage === 0) {
      g.fillStyle = '#3b2a22'; g.fillRect(0, 0, S, S);
      for (y = 0; y < S; y += 16) for (x = -(y / 16 % 2) * 16; x < S; x += 32) {
        var c = 70 + R() * 40 | 0; g.fillStyle = 'rgb(' + c + ',' + (c * 0.45 | 0) + ',' + (c * 0.35 | 0) + ')'; g.fillRect(x + 1, y + 1, 30, 14);
      }
      noiseFill(g, S, S, R, 0, 0.25, 2); grime(g, S, S, R);
    } else if (stage === 1) {
      g.fillStyle = '#1c2522'; g.fillRect(0, 0, S, S);
      for (y = 0; y < S; y += 32) for (x = -(y / 32 % 2) * 32; x < S; x += 64) { var c1 = 45 + R() * 25 | 0; g.fillStyle = 'rgb(' + (c1 * 0.8 | 0) + ',' + c1 + ',' + (c1 * 0.9 | 0) + ')'; g.fillRect(x + 2, y + 2, 60, 28); }
      noiseFill(g, S, S, R, 0, 0.3, 2);
      for (i = 0; i < 10; i++) { g.fillStyle = 'rgba(80,140,40,' + (0.4 + R() * 0.4) + ')'; x = R() * S; g.fillRect(x, 0, 2 + R() * 4, 20 + R() * 90); }
      grime(g, S, S, R);
    } else if (stage === 2) {
      g.fillStyle = '#2a1d12'; g.fillRect(0, 0, S, S);
      for (x = 0; x < S; x += 16) { var c2 = 55 + R() * 35 | 0; g.fillStyle = 'rgb(' + c2 + ',' + (c2 * 0.7 | 0) + ',' + (c2 * 0.45 | 0) + ')'; g.fillRect(x + 1, 0, 14, S); g.fillStyle = '#111'; g.fillRect(x + 7, 10 + R() * 10, 2, 2); g.fillRect(x + 7, 100 + R() * 10, 2, 2); }
      noiseFill(g, S, S, R, 0, 0.3, 2);
      if (R() < 0.7) { g.fillStyle = 'rgba(200,190,160,.55)'; g.fillRect(20 + R() * 50, 30 + R() * 20, 30, 40); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(25 + R() * 40, 40 + R() * 20, 18, 3); }
      for (i = 0; i < 6; i++) { g.strokeStyle = 'rgba(230,230,230,' + (0.15 + R() * 0.25) + ')'; g.beginPath(); g.moveTo(R() * S, 0); g.quadraticCurveTo(R() * S, R() * S, R() * S, R() * S); g.stroke(); }
      grime(g, S, S, R);
    } else if (stage === 3) {
      g.fillStyle = '#8a8f86'; g.fillRect(0, 0, S, S);
      for (y = 0; y < S; y += 16) for (x = 0; x < S; x += 16) { var c3 = 150 + R() * 40 | 0; g.fillStyle = 'rgb(' + c3 + ',' + (c3 + 5) + ',' + (c3 - 10) + ')'; g.fillRect(x + 1, y + 1, 14, 14); }
      noiseFill(g, S, S, R, 0, 0.25, 2); blood(g, S, S, R, 2 + (R() * 3 | 0)); grime(g, S, S, R);
      g.fillStyle = 'rgba(40,50,40,.5)'; g.fillRect(0, S - 30, S, 30);
    } else {
      g.fillStyle = '#1a0b0b'; g.fillRect(0, 0, S, S);
      for (i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (60 + R() * 60 | 0) + ',' + (10 + R() * 20 | 0) + ',' + (15 + R() * 20 | 0) + ',.7)'; g.beginPath(); g.ellipse(R() * S, R() * S, 6 + R() * 18, 4 + R() * 10, R() * 3, 0, 7); g.fill(); }
      noiseFill(g, S, S, R, 0, 0.3, 2);
      for (i = 0; i < 18; i++) { g.strokeStyle = 'rgba(235,235,235,' + (0.2 + R() * 0.4) + ')'; g.lineWidth = 0.6 + R(); g.beginPath(); g.moveTo(R() * S, R() * S); g.lineTo(R() * S, R() * S); g.stroke(); }
      for (i = 0; i < 3; i++) { g.fillStyle = 'rgba(220,210,180,.75)'; g.beginPath(); g.ellipse(R() * S, 60 + R() * 60, 7, 10, 0, 0, 7); g.fill(); }
      blood(g, S, S, R, 3);
    }
    if (variant > 0) {
      var txt = GRAFFITI[(stage * 3 + variant * 7) % GRAFFITI.length];
      g.save(); g.translate(S / 2, S * 0.45); g.rotate((R() - 0.5) * 0.25);
      var fs = txt.length > 8 ? 15 : txt.length > 5 ? 20 : 28;
      g.font = '900 ' + fs + 'px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(150,0,0,.92)'; g.fillText(txt, 0, 0);
      g.fillStyle = 'rgba(150,0,0,.85)';
      for (i = 0; i < 6; i++) g.fillRect(-fs * txt.length * 0.28 + R() * fs * txt.length * 0.56, fs * 0.3, 1.5, 6 + R() * 22);
      g.restore();
    }
    return toTex(cv);
  }
  function floorTex(stage) {
    var S = 64, cv = mkCanvas(S, S), g = cv.getContext('2d'), R = mulberry32(stage * 31 + 7), i;
    var base = ['#26262a', '#1c2420', '#2a2018', '#6f726c', '#2a1212'][stage];
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    noiseFill(g, S, S, R, 0, 0.35, 1);
    if (stage === 0) for (i = 0; i < 4; i++) { g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(R() * S, R() * S); g.lineTo(R() * S, R() * S); g.stroke(); }
    if (stage === 1) { g.fillStyle = 'rgba(0,0,0,.6)'; for (i = 4; i < S; i += 8) g.fillRect(i, 0, 3, S); g.fillStyle = 'rgba(60,110,60,.25)'; g.fillRect(0, 0, S, S); }
    if (stage === 2) { for (var y = 0; y < S; y += 16) for (var x = 0; x < S; x += 16) if (((x + y) / 16) % 2) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 16, 16); } }
    if (stage === 3) { g.strokeStyle = 'rgba(0,0,0,.35)'; for (i = 0; i <= S; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); } blood(g, S, S, R, 1); }
    if (stage === 4) { for (i = 0; i < 6; i++) { g.strokeStyle = 'rgba(220,220,220,.25)'; g.beginPath(); g.moveTo(R() * S, R() * S); g.lineTo(R() * S, R() * S); g.stroke(); } blood(g, S, S, R, 2); }
    return toTex(cv);
  }

  /* ---------- Todd: procedurally drawn giant spider ---------- */
  function drawTodd(g, W, H, frame, big) {
    var R = mulberry32(77 + (big ? 3 : 0));
    var cx = W / 2, by = H * 0.62, s = W / 256;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    function hairyLine(x1, y1, x2, y2, w, col) {
      g.strokeStyle = col; g.lineWidth = w * s; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      var n = Math.hypot(x2 - x1, y2 - y1) / (3 * s);
      g.strokeStyle = big ? '#7a5640' : '#3a2a20'; g.lineWidth = 1 * s;
      for (var k = 0; k < n; k++) {
        var u = k / n, px = x1 + (x2 - x1) * u, py = y1 + (y2 - y1) * u, a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2 + (R() - 0.5) * 1.2, l = (2 + R() * 4) * s * (R() < 0.5 ? -1 : 1);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke();
      }
    }
    // abdomen behind
    g.fillStyle = big ? '#3a2519' : '#140d0a'; g.beginPath(); g.ellipse(cx, by - 46 * s, 64 * s, 46 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#6b0f0f'; g.beginPath(); g.moveTo(cx, by - 84 * s); g.lineTo(cx + 14 * s, by - 62 * s); g.lineTo(cx, by - 44 * s); g.lineTo(cx - 14 * s, by - 62 * s); g.fill();
    g.beginPath(); g.moveTo(cx - 30 * s, by - 70 * s); g.lineTo(cx - 20 * s, by - 56 * s); g.lineTo(cx - 34 * s, by - 50 * s); g.fill();
    g.beginPath(); g.moveTo(cx + 30 * s, by - 70 * s); g.lineTo(cx + 20 * s, by - 56 * s); g.lineTo(cx + 34 * s, by - 50 * s); g.fill();
    // legs (4 per side)
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 3; i >= 0; i--) {
        var ph = frame * Math.PI / 2 + i * 1.3 + (side > 0 ? Math.PI : 0);
        var bx = cx + side * (22 + i * 4) * s, byy = by + (-12 + i * 7) * s;
        var kx = cx + side * (62 + i * 20 + Math.sin(ph) * 6) * s, ky = by - (78 - i * 12) * s + Math.cos(ph) * 10 * s;
        var fx = cx + side * (78 + i * 22 + Math.sin(ph + 1) * 10) * s, fy = H - 4 * s - Math.max(0, Math.sin(ph)) * 10 * s;
        var col = big ? (i > 1 ? '#2a1a12' : '#45301f') : (i > 1 ? '#0c0807' : '#1a120e');
        hairyLine(bx, byy, kx, ky, 9 - i * 0.6, col);
        hairyLine(kx, ky, fx, fy, 6.5 - i * 0.4, col);
        g.fillStyle = '#2a1d16'; g.beginPath(); g.arc(kx, ky, 4 * s, 0, 7); g.fill();
      }
    }
    // head / cephalothorax
    g.fillStyle = big ? '#4a3324' : '#1f1612'; g.beginPath(); g.ellipse(cx, by, 44 * s, 36 * s, 0, 0, 7); g.fill();
    g.strokeStyle = big ? '#7d5a44' : '#3d2c22'; g.lineWidth = 1.2 * s;
    for (var hh = 0; hh < 160; hh++) {
      var a = R() * 6.283, rr = R(), hx = cx + Math.cos(a) * 44 * s * rr, hy = by + Math.sin(a) * 36 * s * rr;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 5 * s, hy + Math.sin(a) * 5 * s); g.stroke();
    }
    // pedipalps
    hairyLine(cx - 14 * s, by + 18 * s, cx - 26 * s, by + 40 * s, 6, '#140d0a');
    hairyLine(cx + 14 * s, by + 18 * s, cx + 26 * s, by + 40 * s, 6, '#140d0a');
    // fangs
    g.fillStyle = '#e6dcc0';
    for (var f = -1; f <= 1; f += 2) {
      g.beginPath(); g.moveTo(cx + f * 12 * s, by + 18 * s); g.quadraticCurveTo(cx + f * 16 * s, by + 34 * s, cx + f * 5 * s, by + (big ? 52 : 44) * s); g.lineTo(cx + f * 6 * s, by + 22 * s); g.fill();
    }
    g.fillStyle = '#9b0000'; g.fillRect(cx - 6 * s, by + 40 * s, 2 * s, 9 * s); g.fillRect(cx + 5 * s, by + 42 * s, 2 * s, 12 * s);
    // eyes
    var eyes = [[-11, -6, 7.5], [11, -6, 7.5], [-26, -12, 5], [26, -12, 5], [-16, -21, 3.6], [-6, -26, 3.4], [6, -26, 3.4], [16, -21, 3.6]];
    eyes.forEach(function (e) {
      g.fillStyle = 'rgba(255,0,0,.35)'; g.beginPath(); g.arc(cx + e[0] * s, by + e[1] * s, e[2] * 1.8 * s, 0, 7); g.fill();
      g.fillStyle = '#ff1414'; g.beginPath(); g.arc(cx + e[0] * s, by + e[1] * s, e[2] * s, 0, 7); g.fill();
      g.fillStyle = '#ff7070'; g.beginPath(); g.arc(cx + (e[0] - e[2] * 0.3) * s, by + (e[1] - e[2] * 0.3) * s, e[2] * 0.35 * s, 0, 7); g.fill();
    });
  }
  function toddTex(frame) {
    var cv = mkCanvas(256, 176);
    drawTodd(cv.getContext('2d'), 256, 176, frame, true);
    return toTex(cv, function (r, g, b, a) { return a > 128 && r > 200 && g < 130; });
  }

  function spriteTex(kind) {
    var cv, g, R = mulberry32(kind.length * 17 + 3), i;
    switch (kind) {
      case 'coin':
        cv = mkCanvas(32, 32); g = cv.getContext('2d');
        g.fillStyle = '#b7791f'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill();
        g.fillStyle = '#f6c945'; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
        g.fillStyle = '#b7791f'; g.font = 'bold 13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 16, 17);
        return toTex(cv, function (r, gg, b, a) { return a > 128; });
      case 'exit':
        cv = mkCanvas(64, 104); g = cv.getContext('2d');
        g.fillStyle = '#1b1b1b'; g.fillRect(6, 24, 52, 80);
        g.fillStyle = '#e8ffe8'; g.fillRect(12, 30, 40, 74);
        var lg = g.createLinearGradient(12, 0, 52, 0); lg.addColorStop(0, 'rgba(160,255,170,1)'); lg.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = lg; g.fillRect(12, 30, 40, 74);
        g.fillStyle = '#2b2b2b'; g.beginPath(); g.moveTo(12, 30); g.lineTo(30, 36); g.lineTo(30, 100); g.lineTo(12, 104); g.fill();
        g.fillStyle = '#062b0b'; g.fillRect(8, 2, 48, 18);
        g.fillStyle = '#2bff5b'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', 32, 12);
        return toTex(cv, function (r, gg, b, a) { return a > 128 && gg > 190; });
      case 'lamp':
        cv = mkCanvas(32, 128); g = cv.getContext('2d');
        g.fillStyle = '#2b2f33'; g.fillRect(14, 10, 4, 118); g.fillRect(8, 122, 16, 6);
        g.fillRect(10, 6, 16, 6);
        g.fillStyle = '#fff4c2'; g.fillRect(12, 12, 12, 5);
        return toTex(cv, function (r, gg, b, a) { return a > 128 && r > 230 && gg > 220; });
      case 'dumpster':
        cv = mkCanvas(96, 56); g = cv.getContext('2d');
        g.fillStyle = '#1e3a2a'; g.fillRect(4, 10, 88, 42); g.fillStyle = '#16291f'; g.fillRect(0, 6, 96, 8);
        noiseFill(g, 96, 56, R, 0, 0.3, 2);
        g.fillStyle = 'rgba(120,60,20,.6)'; for (i = 0; i < 8; i++) g.fillRect(R() * 90, 14 + R() * 30, 4 + R() * 6, 2 + R() * 6);
        g.fillStyle = '#0b0b0b'; g.fillRect(8, 50, 10, 6); g.fillRect(78, 50, 10, 6);
        g.clearRect(0, 0, 96, 6);
        return toTex(cv);
      case 'bags':
        cv = mkCanvas(48, 36); g = cv.getContext('2d');
        g.fillStyle = '#0d0d0f'; g.beginPath(); g.ellipse(16, 24, 15, 12, 0, 0, 7); g.ellipse(33, 26, 13, 10, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.ellipse(12, 18, 5, 3, -0.5, 0, 7); g.fill();
        return toTex(cv);
      case 'web':
        cv = mkCanvas(64, 40); g = cv.getContext('2d');
        g.strokeStyle = 'rgba(235,235,235,.85)'; g.lineWidth = 1;
        for (i = 0; i < 10; i++) { var a = Math.PI + i / 9 * Math.PI; g.beginPath(); g.moveTo(32, 40); g.lineTo(32 + Math.cos(a) * 34, 40 + Math.sin(a) * 40); g.stroke(); }
        for (var r2 = 6; r2 < 40; r2 += 6) { g.beginPath(); g.ellipse(32, 40, r2 * 0.9, r2, 0, Math.PI, 0); g.stroke(); }
        return toTex(cv);
      case 'flare':
        cv = mkCanvas(16, 24); g = cv.getContext('2d');
        g.fillStyle = '#b91c1c'; g.fillRect(6, 10, 4, 14);
        g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(8, 7, 6, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(8, 7, 3, 0, 7); g.fill();
        return toTex(cv, function (r, gg, b, a) { return a > 128 && r > 230; });
      case 'egg':
        cv = mkCanvas(40, 40); g = cv.getContext('2d');
        for (i = 0; i < 5; i++) { g.fillStyle = 'rgba(' + (200 + R() * 30 | 0) + ',' + (190 + R() * 20 | 0) + ',160,.95)'; g.beginPath(); g.ellipse(8 + R() * 24, 22 + R() * 12, 6, 8, 0, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(240,240,240,.6)'; for (i = 0; i < 6; i++) { g.beginPath(); g.moveTo(R() * 40, 0); g.lineTo(R() * 40, 40); g.stroke(); }
        return toTex(cv);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Level generation (seeded)                                          */
  /* ------------------------------------------------------------------ */
  function genLevel(idx) {
    var R = mulberry32(idx * 7919 + 1337);
    var st = Math.floor(idx / 10), lv = idx % 10;
    var N = 9 + st * 4 + Math.floor(lv / 2) * 2; if (N % 2 === 0) N++;
    var M = new Uint8Array(N * N), x, y, i;
    for (i = 0; i < M.length; i++) M[i] = 1;
    // maze (recursive backtracker on odd cells)
    var stack = [[1, 1]]; M[N + 1] = 0;
    var dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [];
      for (i = 0; i < 4; i++) { var nx = c[0] + dirs[i][0], ny = c[1] + dirs[i][1]; if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && M[ny * N + nx]) opts.push(dirs[i]); }
      if (!opts.length) { stack.pop(); continue; }
      var dd = opts[Math.floor(R() * opts.length)];
      M[(c[1] + dd[1] / 2) * N + c[0] + dd[0] / 2] = 0; M[(c[1] + dd[1]) * N + c[0] + dd[0]] = 0;
      stack.push([c[0] + dd[0], c[1] + dd[1]]);
    }
    // loops so you can dodge Todd
    var loopP = 0.12 - st * 0.012;
    for (y = 1; y < N - 1; y++) for (x = 1; x < N - 1; x++) {
      if (!M[y * N + x]) continue;
      var h = !M[y * N + x - 1] && !M[y * N + x + 1], v = !M[(y - 1) * N + x] && !M[(y + 1) * N + x];
      if ((h || v) && R() < loopP) M[y * N + x] = 0;
    }
    // small courtyards
    for (i = 0; i < 1 + st; i++) {
      var rx = 2 + Math.floor(R() * (N - 6)), ry = 2 + Math.floor(R() * (N - 6));
      for (y = ry; y < ry + 3; y++) for (x = rx; x < rx + 3; x++) M[y * N + x] = 0;
    }
    // wall texture variants (graffiti)
    for (i = 0; i < M.length; i++) if (M[i]) M[i] = R() < 0.1 ? 2 + (R() < 0.5 ? 1 : 0) : 1;
    for (i = 0; i < N; i++) { if (!M[i]) M[i] = 1; if (!M[(N - 1) * N + i]) M[(N - 1) * N + i] = 1; if (!M[i * N]) M[i * N] = 1; if (!M[i * N + N - 1]) M[i * N + N - 1] = 1; }
    // BFS from start for exit
    var dist = bfs(M, N, 1, 1);
    var far = 0, ex = 1, ey = 1;
    for (i = 0; i < dist.length; i++) if (dist[i] > far && dist[i] < 1e8) { far = dist[i]; ex = i % N; ey = (i / N) | 0; }
    var L = { idx: idx, st: st, lv: lv, N: N, M: M, sx: 1.5, sy: 1.5, ex: ex + 0.5, ey: ey + 0.5, pathLen: far, coins: [], decor: [], lamps: [], webs: [] };
    // start angle facing an open direction
    L.sa = !M[N + 2] ? 0 : Math.PI / 2;
    var floors = [];
    for (y = 1; y < N - 1; y++) for (x = 1; x < N - 1; x++) if (!M[y * N + x]) floors.push([x, y]);
    function pickFloor(minD) {
      for (var t = 0; t < 60; t++) { var f = floors[Math.floor(R() * floors.length)]; var d = dist[f[1] * N + f[0]]; if (d >= minD && !(f[0] === ex && f[1] === ey)) return f; }
      return floors[Math.floor(R() * floors.length)];
    }
    var nc = 10 + lv + st * 2;
    for (i = 0; i < nc; i++) { var f = pickFloor(2); L.coins.push({ x: f[0] + 0.25 + R() * 0.5, y: f[1] + 0.25 + R() * 0.5 }); }
    // decor in dead ends
    for (i = 0; i < floors.length; i++) {
      var fx = floors[i][0], fy = floors[i][1], walls = 0, ox = 0, oy = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (M[(fy + d[1]) * N + fx + d[0]]) { walls++; ox += d[0]; oy += d[1]; } });
      if (walls === 3 && !(fx === 1 && fy === 1) && !(fx === ex && fy === ey) && R() < 0.7) L.decor.push({ x: fx + 0.5 + ox * 0.28, y: fy + 0.5 + oy * 0.28, kind: st === 4 ? 'egg' : R() < 0.5 ? 'dumpster' : 'bags' });
    }
    var nl = Math.max(2, Math.round(floors.length / (14 + st * 6)));
    for (i = 0; i < nl; i++) { var lf = pickFloor(1); L.lamps.push({ x: lf[0] + 0.5, y: lf[1] + 0.5, ph: R() * 10, broken: R() < 0.25 + st * 0.1 }); }
    if (st >= 1) { var nw = st * 3 + lv; for (i = 0; i < nw; i++) { var wf = pickFloor(3); L.webs.push({ x: wf[0] + 0.5, y: wf[1] + 0.5 }); } }
    L.toddSpeed = 1.6 + st * 0.28 + lv * 0.04 + (lv === 9 ? 0.1 : 0);
    L.grace = Math.max(1.6, 4.2 - st * 0.55 - lv * 0.06);
    L.ambush = lv % 3 === 2;
    if (L.ambush) {
      // ambush from a side passage: far from the start but away from the shortest route to the exit
      var dEx = bfs(M, N, ex, ey), onPath = new Uint8Array(N * N), cx0 = ex, cy0 = ey, guard = 0;
      while (!(cx0 === 1 && cy0 === 1) && guard++ < N * N) {
        onPath[cy0 * N + cx0] = 1; var bd = dist[cy0 * N + cx0], nx0 = cx0, ny0 = cy0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var n = (cy0 + d[1]) * N + cx0 + d[0]; if (!M[n] && dist[n] < bd) { bd = dist[n]; nx0 = cx0 + d[0]; ny0 = cy0 + d[1]; } });
        if (nx0 === cx0 && ny0 === cy0) break; cx0 = nx0; cy0 = ny0;
      }
      var cand = [];
      floors.forEach(function (f) {
        var k = f[1] * N + f[0]; if (dist[k] < far * 0.35 || onPath[k]) return;
        var near = 99; for (var yy = Math.max(1, f[1] - 4); yy <= Math.min(N - 2, f[1] + 4); yy++) for (var xx = Math.max(1, f[0] - 4); xx <= Math.min(N - 2, f[0] + 4); xx++) if (onPath[yy * N + xx]) near = Math.min(near, Math.abs(xx - f[0]) + Math.abs(yy - f[1]));
        if (near >= 3) cand.push(f);
      });
      if (cand.length) { var af = cand[Math.floor(R() * cand.length)]; L.tsx = af[0] + 0.5; L.tsy = af[1] + 0.5; } else { L.ambush = false; L.tsx = 1.5; L.tsy = 1.5; }
    } else { L.tsx = 1.5; L.tsy = 1.5; }
    L.par = Math.round(far / 2.3 * 1.25 + 4);
    return L;
  }
  function bfs(M, N, sx, sy, out) {
    var dist = out || new Float32Array(N * N);
    for (var i = 0; i < dist.length; i++) dist[i] = 1e9;
    var q = new Int32Array(N * N), h = 0, t = 0, s = sy * N + sx;
    if (M[s]) return dist;
    dist[s] = 0; q[t++] = s;
    while (h < t) {
      var c = q[h++], cd = dist[c] + 1;
      var n1 = c + 1, n2 = c - 1, n3 = c + N, n4 = c - N;
      if (!M[n1] && dist[n1] > cd) { dist[n1] = cd; q[t++] = n1; }
      if (!M[n2] && dist[n2] > cd) { dist[n2] = cd; q[t++] = n2; }
      if (!M[n3] && dist[n3] > cd) { dist[n3] = cd; q[t++] = n3; }
      if (!M[n4] && dist[n4] > cd) { dist[n4] = cd; q[t++] = n4; }
    }
    return dist;
  }

  /* ------------------------------------------------------------------ */
  /*  Icon                                                               */
  /* ------------------------------------------------------------------ */
  function createGameIcon() {
    try {
      var c = mkCanvas(512, 512), g = c.getContext('2d');
      g.fillStyle = '#050304'; g.fillRect(0, 0, 512, 512);
      // alley perspective
      g.fillStyle = '#1a0f0c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(180, 150); g.lineTo(180, 360); g.lineTo(0, 512); g.fill();
      g.beginPath(); g.moveTo(512, 0); g.lineTo(332, 150); g.lineTo(332, 360); g.lineTo(512, 512); g.fill();
      g.fillStyle = '#0d0909'; g.beginPath(); g.moveTo(0, 512); g.lineTo(180, 360); g.lineTo(332, 360); g.lineTo(512, 512); g.fill();
      var lg = g.createRadialGradient(256, 300, 10, 256, 300, 280); lg.addColorStop(0, 'rgba(255,240,200,.25)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg; g.fillRect(0, 0, 512, 512);
      var tc = mkCanvas(256, 176); drawTodd(tc.getContext('2d'), 256, 176, 1, true);
      g.drawImage(tc, 36, 120, 440, 302);
      var rg = g.createRadialGradient(256, 256, 120, 256, 256, 360); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(60,0,0,.85)');
      g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
      g.textAlign = 'center'; g.font = '900 70px Impact, "Arial Black", sans-serif';
      g.fillStyle = '#000'; g.fillText('RUN FROM', 259, 83); g.fillText('TODD', 259, 503);
      g.fillStyle = '#d10000'; g.fillText('RUN FROM', 256, 80); g.fillText('TODD', 256, 500);
      g.fillStyle = '#d10000'; for (var i = 0; i < 9; i++) g.fillRect(150 + i * 26, 82, 3, 10 + (i * 37) % 30);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ */
  /*  Saves                                                              */
  /* ------------------------------------------------------------------ */
  function newSave() {
    var ab = {}; ABIL.forEach(function (a) { ab[a.k] = 0; });
    return { v: 1, created: Date.now(), lastSeen: Date.now(), cleared: 0, coins: 0, ab: ab, best: {}, deaths: 0, escapes: 0, playtime: 0 };
  }
  function normalizeSave(o) {
    var s = newSave();
    if (!o || typeof o !== 'object') return s;
    ['created', 'lastSeen', 'cleared', 'coins', 'deaths', 'escapes', 'playtime'].forEach(function (k) { if (typeof o[k] === 'number' && isFinite(o[k])) s[k] = o[k]; });
    if (o.ab) ABIL.forEach(function (a) { s.ab[a.k] = clamp(o.ab[a.k] | 0, 0, a.cost.length); });
    if (o.best && typeof o.best === 'object') Object.keys(o.best).forEach(function (k) { var v = +o.best[k]; if (v > 0) s.best[k] = v; });
    s.cleared = clamp(Math.floor(s.cleared), 0, TOTAL); s.coins = Math.max(0, Math.floor(s.coins));
    return s;
  }

  /* ------------------------------------------------------------------ */
  /*  Game                                                               */
  /* ------------------------------------------------------------------ */
  function startGame(container) {
    var LS = {
      get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
    };
    var style = document.createElement('style');
    style.textContent = [
      '.rt-root{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#000;font-family:"Courier New",ui-monospace,monospace;color:#e5e5e5;user-select:none;-webkit-user-select:none;touch-action:none;outline:none}',
      '.rt-root canvas.rt-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}',
      '.rt-hud{position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:30}',
      '.rt-ib{width:38px;height:38px;border-radius:8px;border:1px solid rgba(255,0,0,.35);background:rgba(10,0,0,.6);color:#fca5a5;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
      '.rt-ib:hover{background:rgba(120,0,0,.7)}',
      '.rt-scr{position:absolute;inset:0;z-index:20;overflow:auto;background:radial-gradient(circle at 50% 30%,rgba(40,0,0,.85),rgba(0,0,0,.96));padding:56px 16px 24px;box-sizing:border-box;display:none;touch-action:pan-y}',
      '.rt-pn{max-width:900px;margin:0 auto}',
      '.rt-h1{font-family:Impact,"Arial Black",sans-serif;font-size:clamp(38px,8vw,78px);letter-spacing:3px;color:#c00000;text-align:center;margin:0;text-shadow:0 0 18px rgba(255,0,0,.55),3px 3px 0 #000;animation:rtshake 4s infinite}',
      '@keyframes rtshake{0%,92%,100%{transform:translate(0,0)}93%{transform:translate(-3px,1px)}95%{transform:translate(3px,-2px)}97%{transform:translate(-2px,2px)}}',
      '.rt-h2{font-family:Impact,"Arial Black",sans-serif;font-size:24px;letter-spacing:1px;color:#ef4444;margin:0 0 10px}',
      '.rt-sub{opacity:.75;text-align:center;margin:6px 0 16px;font-style:italic}',
      '.rt-card{background:rgba(15,8,8,.92);border:1px solid rgba(255,0,0,.22);border-radius:10px;padding:14px;box-sizing:border-box;box-shadow:0 0 22px rgba(120,0,0,.25) inset}',
      '.rt-grid{display:grid;gap:10px}',
      '.rt-b{border:1px solid rgba(255,60,60,.45);border-radius:8px;padding:9px 14px;font-weight:800;font-size:14px;cursor:pointer;color:#fee2e2;background:linear-gradient(180deg,#5c0000,#2a0000);font-family:inherit;letter-spacing:.5px}',
      '.rt-b:hover{background:linear-gradient(180deg,#8b0000,#3b0000);box-shadow:0 0 12px rgba(255,0,0,.45)}',
      '.rt-b[disabled]{opacity:.35;cursor:not-allowed;box-shadow:none}',
      '.rt-b.big{font-size:22px;padding:14px 26px;font-family:Impact,"Arial Black",sans-serif;letter-spacing:2px}',
      '.rt-b.s{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18)}',
      '.rt-b.g{background:linear-gradient(180deg,#14532d,#052e16);border-color:rgba(74,222,128,.5);color:#dcfce7}',
      '.rt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.rt-k{display:inline-block;background:#1a0505;border:1px solid #7f1d1d;border-bottom-width:3px;border-radius:5px;padding:1px 7px;font-weight:800;font-size:12px;margin-right:4px;color:#fecaca}',
      '.rt-pill{background:rgba(0,0,0,.5);border:1px solid rgba(255,0,0,.25);border-radius:999px;padding:5px 11px;font-weight:800;font-size:14px;white-space:nowrap}',
      '.rt-lv{aspect-ratio:1;border-radius:6px;border:1px solid rgba(255,0,0,.3);background:#140606;color:#fecaca;font-weight:800;cursor:pointer;font-family:inherit;font-size:15px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}',
      '.rt-lv small{font-size:9px;color:#86efac}.rt-lv.lk{opacity:.3;cursor:not-allowed}.rt-lv.cur{outline:2px solid #ef4444;animation:rtpulse 1.2s infinite}.rt-lv.boss{border-color:#ef4444;background:#2a0505}',
      '@keyframes rtpulse{50%{box-shadow:0 0 14px rgba(255,0,0,.8)}}',
      '.rt-modal{position:absolute;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.75);padding:16px;box-sizing:border-box}',
      '.rt-toast{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:45;background:rgba(20,0,0,.92);border:1px solid #b91c1c;border-radius:8px;padding:9px 16px;font-weight:800;pointer-events:none;transition:opacity .3s;opacity:0;max-width:90%;text-align:center;color:#fecaca}',
      '.rt-bar{height:8px;background:rgba(255,255,255,.1);border-radius:8px;overflow:hidden}.rt-bar>i{display:block;height:100%;background:linear-gradient(90deg,#7f1d1d,#ef4444)}'
    ].join('\n');
    document.head.appendChild(style);

    var root = document.createElement('div'); root.className = 'rt-root'; root.tabIndex = 0; container.appendChild(root);
    var canvas = document.createElement('canvas'); canvas.className = 'rt-cv'; root.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var hud = document.createElement('div'); hud.className = 'rt-hud';
    hud.innerHTML = '<button class="rt-ib" data-h="menu" title="Pause (Esc)">☰</button><button class="rt-ib" data-h="restart" title="Restart level (R)">↻</button><button class="rt-ib" data-h="mute" title="Mute (M)">🔊</button><button class="rt-ib" data-h="fs" title="Fullscreen (F)">⛶</button>';
    root.appendChild(hud);
    var scr = document.createElement('div'); scr.className = 'rt-scr'; root.appendChild(scr);
    var modal = document.createElement('div'); modal.className = 'rt-modal'; root.appendChild(modal);
    var toastEl = document.createElement('div'); toastEl.className = 'rt-toast'; root.appendChild(toastEl);
    var fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.style.display = 'none'; root.appendChild(fileIn);
    var btnMenu = hud.querySelector('[data-h=menu]'), btnRestart = hud.querySelector('[data-h=restart]'), btnMute = hud.querySelector('[data-h=mute]');

    /* ---------- assets ---------- */
    var WALLS = [], FLOORS = [], TODD = [], SPR = {};
    for (var s0 = 0; s0 < 5; s0++) { WALLS.push([null, wallTex(s0, 0), wallTex(s0, 1), wallTex(s0, 2)]); FLOORS.push(floorTex(s0)); }
    for (var f0 = 0; f0 < 4; f0++) TODD.push(toddTex(f0));
    ['coin', 'exit', 'lamp', 'dumpster', 'bags', 'web', 'flare', 'egg'].forEach(function (k) { SPR[k] = spriteTex(k); });
    var scareCv = mkCanvas(512, 352); drawTodd(scareCv.getContext('2d'), 512, 352, 2, true);
    var grainCv = mkCanvas(160, 160); (function () { var g = grainCv.getContext('2d'), d = g.createImageData(160, 160); for (var i = 0; i < d.data.length; i += 4) { var v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); })();

    /* ---------- persistence ---------- */
    var slots = LS.get(GID + '_slots', null);
    if (!Array.isArray(slots)) slots = [null, null, null];
    while (slots.length < 3) slots.push(null);
    slots = slots.slice(0, 3).map(function (s) { return s ? normalizeSave(s) : null; });
    var slotIdx = -1, S = null;
    var hiScore = Number(localStorage.getItem(GID + '_highscore')) || 0;
    var gPT = Number(localStorage.getItem(GID + '_playtime')) || 0;
    var muted = LS.get(GID + '_muted', false) === true;
    function persistSlots() { LS.set(GID + '_slots', slots); }
    function flushPT() { try { localStorage.setItem(GID + '_playtime', String(Math.floor(gPT))); localStorage.setItem(GID + '_highscore', String(hiScore)); } catch (e) { } }
    function saveNow() { if (S && slotIdx >= 0) { S.lastSeen = Date.now(); slots[slotIdx] = S; persistSlots(); } flushPT(); }

    /* ---------- audio ---------- */
    var AC = window.AudioContext || window.webkitAudioContext, actx = null, master = null, noiseBuf = null, amb = null;
    function ensureAudio() {
      try {
        if (!actx && AC) {
          actx = new AC(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(actx.destination);
          noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate);
          var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (actx && actx.state === 'suspended') actx.resume();
      } catch (e) { }
    }
    function out(pan) {
      if (pan == null || !actx.createStereoPanner) return master;
      var p = actx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(master); return p;
    }
    function tone(f, dur, type, vol, slide, delay, pan) {
      if (!actx || muted) return;
      try {
        var t0 = actx.currentTime + (delay || 0), o = actx.createOscillator(), gn = actx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(gn); gn.connect(out(pan)); o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { }
    }
    function noise(dur, vol, f1, f2, delay, pan, q) {
      if (!actx || muted || !noiseBuf) return;
      try {
        var t0 = actx.currentTime + (delay || 0), s = actx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
        var fl = actx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = q || 1.2;
        fl.frequency.setValueAtTime(f1, t0); fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
        var gn = actx.createGain(); gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(fl); fl.connect(gn); gn.connect(out(pan)); s.start(t0); s.stop(t0 + dur + 0.05);
      } catch (e) { }
    }
    var SFX = {
      step: function (run) { noise(0.09, run ? 0.12 : 0.07, 300, 120, 0, null, 2); },
      coin: function () { tone(988, 0.25, 'sine', 0.06); tone(1175, 0.4, 'sine', 0.04, 1, 0.08); },
      heart: function (v) { tone(55, 0.14, 'sine', 0.25 * v + 0.05, 0.6); tone(50, 0.16, 'sine', 0.2 * v + 0.04, 0.6, 0.18); },
      skitter: function (vol, pan) { noise(0.03, vol, 3500 + Math.random() * 2500, 2000, 0, pan, 4); },
      hiss: function (vol, pan) { noise(0.7, vol, 6000, 2500, 0, pan, 0.7); },
      screech: function (pan) { tone(1400, 1.0, 'sawtooth', 0.12, 0.45, 0, pan); tone(1480, 1.0, 'square', 0.06, 0.4, 0, pan); noise(1.0, 0.22, 7000, 1500, 0, pan, 0.8); },
      scream: function () {
        tone(600, 1.6, 'sawtooth', 0.35, 0.3); tone(637, 1.6, 'sawtooth', 0.3, 0.28); tone(900, 1.2, 'square', 0.2, 0.25);
        noise(1.6, 0.6, 5000, 300, 0, null, 0.5); tone(40, 1.4, 'sine', 0.5, 0.5);
      },
      web: function () { noise(0.3, 0.12, 2500, 900, 0, null, 3); },
      flare: function () { noise(1.4, 0.25, 900, 3000, 0, null, 0.6); },
      dash: function () { noise(0.3, 0.2, 400, 1800); tone(120, 0.3, 'sawtooth', 0.08, 2); },
      escape: function () { [262, 330, 392, 523].forEach(function (f, i) { tone(f, 1.6, 'triangle', 0.09, 1, i * 0.12); }); },
      click: function () { tone(300, 0.05, 'square', 0.04, 0.7); },
      clang: function (pan) { tone(180 + Math.random() * 80, 1.4, 'triangle', 0.05, 0.98, 0, pan); tone(431, 1.0, 'sine', 0.03, 1, 0, pan); },
      drip: function (pan) { tone(1800 + Math.random() * 600, 0.08, 'sine', 0.04, 0.4, 0, pan); },
      whisper: function (pan) { noise(1.8, 0.05, 1200, 3200, 0, pan, 6); noise(1.4, 0.04, 2400, 900, 0.3, pan, 6); },
      buy: function () { tone(220, 0.15, 'square', 0.06); tone(330, 0.25, 'square', 0.06, 1, 0.1); }
    };
    function startAmbient() {
      stopAmbient(); if (!actx || muted) return;
      try {
        var g = actx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.07, actx.currentTime + 2);
        var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        var o1 = actx.createOscillator(), o2 = actx.createOscillator(), o3 = actx.createOscillator();
        o1.type = 'sawtooth'; o1.frequency.value = 41; o2.type = 'sawtooth'; o2.frequency.value = 43.7; o3.type = 'sine'; o3.frequency.value = 58.27;
        var wn = actx.createBufferSource(); wn.buffer = noiseBuf; wn.loop = true;
        var wf = actx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.5;
        var wg = actx.createGain(); wg.gain.value = 0.25;
        var lfo = actx.createOscillator(), lg = actx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300; lfo.connect(lg); lg.connect(wf.frequency);
        o1.connect(lp); o2.connect(lp); o3.connect(lp); wn.connect(wf); wf.connect(wg); wg.connect(lp); lp.connect(g); g.connect(master);
        [o1, o2, o3, wn, lfo].forEach(function (o) { o.start(); });
        amb = { g: g, os: [o1, o2, o3, wn, lfo], lp: lp };
      } catch (e) { amb = null; }
    }
    function stopAmbient() {
      if (!amb) return;
      try { var a = amb; a.g.gain.setTargetAtTime(0, actx.currentTime, 0.3); a.os.forEach(function (o) { o.stop(actx.currentTime + 1.2); }); } catch (e) { }
      amb = null;
    }
    function setMute(m) {
      muted = m; LS.set(GID + '_muted', muted);
      btnMute.textContent = muted ? '🔇' : '🔊';
      if (master) master.gain.value = muted ? 0 : 0.6;
      if (muted) stopAmbient(); else if (mode === 'play') { ensureAudio(); startAmbient(); }
    }

    /* ---------- state ---------- */
    var W = 800, H = 600, dpr = 1, RW = 320, RH = 180;
    var sceneCv = mkCanvas(RW, RH), sctx = sceneCv.getContext('2d'), img = null, buf = null, zbuf = null, cone = null;
    var mode = 'menu', paused = false, curScreen = '', L = null, lvIdx = 0;
    var P = null, T = null, coins = [], flares = [], webs = [], lightmap = null, dfield = null, dfT = 0;
    var keys = {}, mouseDX = 0, locked = false, dragLook = null, touch = { joy: null, look: null, sprint: false };
    var runTime = 0, runCoins = 0, levelDeaths = 0, msg = '', msgT = 0, titleT = 0, heartT = 0, stepT = 0, ambEvT = 4, scareT = 0, fadeT = 0, escaped = false;
    var shake = 0, flashFlick = 1, threat = 0, raf = 0, last = 0, wallT = 0, ptFlush = 0, lastResult = null, importTarget = -1, levelStage = 0;

    function resize() {
      var r = root.getBoundingClientRect();
      W = Math.max(240, Math.round(r.width || container.clientWidth || 800));
      H = Math.max(240, Math.round(r.height || container.clientHeight || 600));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      RW = clamp(Math.round(W / (W > 1100 ? 3 : 2.4)), 220, 440); RH = clamp(Math.round(RW * H / W), 140, 420);
      sceneCv.width = RW; sceneCv.height = RH;
      img = sctx.createImageData(RW, RH); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(RW);
      cone = new Float32Array(RW * RH);
      computeCone();
    }
    function computeCone() {
      if (!cone) return;
      var rad = 0.5 + (S ? S.ab.light : 0) * 0.08;
      for (var y = 0; y < RH; y++) for (var x = 0; x < RW; x++) {
        var dx = (x - RW / 2) / (RW / 2), dy = (y - RH * 0.56) / (RH / 2) * (RH / RW) * 1.6;
        var r = Math.sqrt(dx * dx + dy * dy) / rad;
        cone[y * RW + x] = r >= 1.25 ? 0.05 : r <= 0.55 ? 1 : lerp(1, 0.05, (r - 0.55) / 0.7);
      }
    }
    var ro = window.ResizeObserver ? new ResizeObserver(function () { resize(); }) : null;
    if (ro) ro.observe(root);

    /* ---------- derived ---------- */
    function stats() {
      var a = S.ab;
      return {
        maxStam: 100 + 30 * a.stamina, regen: 14 + 4 * a.stamina,
        walk: 2.25 * (1 + 0.06 * a.shoes), sprint: 1.65,
        range: 5.5 + 1.6 * a.light, flick: Math.max(0.2, 1 - a.light * 0.22),
        flares: a.flares, dashCd: a.dash ? 9 - (a.dash - 1) * 2 : 0, magnet: 0.5 + 0.7 * a.magnet
      };
    }

    /* ---------- level control ---------- */
    function playLevel(i) {
      i = clamp(i | 0, 0, Math.min(TOTAL - 1, S.cleared));
      lvIdx = i; L = genLevel(i); levelDeaths = 0;
      mode = 'play'; paused = false; hideScreen(); resetRun();
      ensureAudio(); startAmbient();
      computeCone();
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); root.focus({ preventScroll: true }); } catch (e) { }
      updateHud();
    }
    function resetRun() {
      var st = stats();
      P = { x: L.sx, y: L.sy, a: L.sa, stam: st.maxStam, st: st, flares: st.flares, dashCd: 0, dashT: 0, slowT: 0, bob: 0, speed: 0, alive: true };
      T = { x: L.tsx, y: L.tsy, active: false, spawnT: L.grace, frame: 0, anim: 0, seen: false, scared: 0, immune: 0, skT: 0, hissT: 3, vx: 0, vy: 0, lunge: 0 };
      coins = L.coins.map(function (c) { return { x: c.x, y: c.y, taken: false }; });
      webs = L.webs.map(function (w) { return { x: w.x, y: w.y }; });
      flares = [];
      lightmap = new Float32Array(L.N * L.N);
      dfield = new Float32Array(L.N * L.N); dfT = 0;
      runTime = 0; runCoins = 0; msg = ''; msgT = 0; titleT = 2.6; scareT = 0; fadeT = 0; escaped = false; threat = 0; shake = 0;
      keys = {}; touch.joy = null; touch.look = null; touch.sprint = false;
    }
    function restartLevel() { if (mode === 'play' || mode === 'scare') { mode = 'play'; paused = false; hideScreen(); resetRun(); startAmbient(); } }
    function toMenu(screen) {
      mode = 'menu'; paused = false; stopAmbient(); unlockPointer();
      show(screen || 'hub');
    }
    function updateHud() {
      btnRestart.style.display = mode === 'play' ? '' : 'none';
      btnMenu.style.display = (mode === 'play' || (S && ['hub', 'slots', 'title'].indexOf(curScreen) < 0)) ? '' : 'none';
    }
    function say(t, d) { msg = t; msgT = d || 2.5; }

    /* ---------- pointer lock ---------- */
    function lockPointer() { try { if (!locked && canvas.requestPointerLock) canvas.requestPointerLock(); } catch (e) { } }
    function unlockPointer() { try { if (document.pointerLockElement === canvas) document.exitPointerLock(); } catch (e) { } }
    function onLockChange() {
      locked = document.pointerLockElement === canvas;
      if (!locked && mode === 'play' && !paused && !escaped) { paused = true; show('pause'); }
    }

    /* ---------- update ---------- */
    function solid(x, y) {
      var cx = x | 0, cy = y | 0;
      if (cx < 0 || cy < 0 || cx >= L.N || cy >= L.N) return true;
      return L.M[cy * L.N + cx] > 0;
    }
    function moveEnt(e, dx, dy, r) {
      var nx = e.x + dx;
      if (!solid(nx + (dx > 0 ? r : -r), e.y - r) && !solid(nx + (dx > 0 ? r : -r), e.y + r)) e.x = nx;
      var ny = e.y + dy;
      if (!solid(e.x - r, ny + (dy > 0 ? r : -r)) && !solid(e.x + r, ny + (dy > 0 ? r : -r))) e.y = ny;
    }
    function los(x0, y0, x1, y1) {
      var dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d * 4);
      for (var i = 1; i < n; i++) if (solid(x0 + dx * i / n, y0 + dy * i / n)) return false;
      return true;
    }
    function update(dt) {
      if (titleT > 0) titleT -= dt;
      if (msgT > 0) msgT -= dt;
      if (escaped) { fadeT += dt; if (fadeT > 1.4) finishEscape(); return; }
      runTime += dt;
      var st = P.st;
      // turning
      var turn = 0;
      if (keys.arrowleft) turn -= 2.4 * dt; if (keys.arrowright) turn += 2.4 * dt;
      P.a += turn + mouseDX * 0.0026; mouseDX = 0;
      if (touch.look) { P.a += touch.look.dx * 0.006; touch.look.dx = 0; }
      // movement
      var fwd = 0, str = 0;
      if (keys.w || keys.arrowup) fwd += 1; if (keys.s || keys.arrowdown) fwd -= 1;
      if (keys.d) str += 1; if (keys.a) str -= 1;
      if (touch.joy) { fwd += -touch.joy.vy; str += touch.joy.vx; }
      var mag = Math.hypot(fwd, str); if (mag > 1) { fwd /= mag; str /= mag; mag = 1; }
      var wantSprint = (keys.shift || touch.sprint) && mag > 0.1;
      var sprinting = wantSprint && P.stam > 1;
      if (sprinting) P.stam = Math.max(0, P.stam - 24 * dt); else P.stam = Math.min(st.maxStam, P.stam + st.regen * dt * (mag > 0.1 ? 0.6 : 1));
      var spd = st.walk * (sprinting ? st.sprint : 1);
      if (P.dashT > 0) { P.dashT -= dt; spd *= 2.6; }
      if (P.slowT > 0) { P.slowT -= dt; spd *= 0.45; }
      if (P.dashCd > 0) P.dashCd -= dt;
      var ca = Math.cos(P.a), sa = Math.sin(P.a);
      var vx = (ca * fwd - sa * str) * spd, vy = (sa * fwd + ca * str) * spd;
      moveEnt(P, vx * dt, vy * dt, 0.22);
      P.speed = Math.hypot(vx, vy);
      if (P.speed > 0.1) {
        P.bob += dt * P.speed * 3.2;
        stepT -= dt * P.speed; if (stepT <= 0) { stepT = 1.25; SFX.step(sprinting); }
      }
      // webs
      for (var i = 0; i < webs.length; i++) { var w = webs[i]; if (Math.abs(w.x - P.x) < 0.45 && Math.abs(w.y - P.y) < 0.45) { if (P.slowT <= 0) { SFX.web(); say('STUCK IN WEB...', 1); } P.slowT = 0.9; } }
      // coins
      for (i = 0; i < coins.length; i++) {
        var c = coins[i]; if (c.taken) continue;
        var dx = P.x - c.x, dy = P.y - c.y, d = Math.hypot(dx, dy);
        if (d < 0.35) { c.taken = true; runCoins += 1 + L.st; SFX.coin(); }
        else if (d < st.magnet && los(P.x, P.y, c.x, c.y)) { c.x += dx / d * 4 * dt; c.y += dy / d * 4 * dt; }
      }
      // flares
      for (i = flares.length - 1; i >= 0; i--) { flares[i].t -= dt; if (flares[i].t <= 0) flares.splice(i, 1); }
      // exit
      if (Math.hypot(P.x - L.ex, P.y - L.ey) < 0.5) { escaped = true; fadeT = 0; SFX.escape(); unlockPointer(); return; }
      updateTodd(dt);
      updateLights(dt);
      // flashlight flicker
      var fp = STAGES[L.st].flick * st.flick * (1 + threat * 3);
      if (Math.random() < fp) flashFlick = 0.08 + Math.random() * 0.5;
      flashFlick = lerp(flashFlick, 1, dt * 5);
      // heartbeat
      heartT -= dt;
      if (heartT <= 0) { heartT = lerp(1.2, 0.32, threat); if (T.active) SFX.heart(threat); }
      // ambient events
      ambEvT -= dt;
      if (ambEvT <= 0) {
        ambEvT = 5 + Math.random() * 9;
        var r = Math.random(), pan = Math.random() * 2 - 1;
        if (r < 0.35) SFX.drip(pan); else if (r < 0.65) SFX.clang(pan); else SFX.whisper(pan);
        if (r > 0.8 && T.active) say(['he is close...', 'TODD IS HUNGRY', 'do not stop', 'eight legs. eight eyes.', 'it smells you'][Math.floor(Math.random() * 5)], 2.2);
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 20);
    }
    function updateTodd(dt) {
      if (!T.active) {
        T.spawnT -= dt;
        if (T.spawnT <= 0) {
          T.active = true; T.x = L.tsx; T.y = L.tsy;
          if (!L.ambush && Math.hypot(P.x - T.x, P.y - T.y) < 2.5) { T.x = L.sx; T.y = L.sy; }
          SFX.hiss(0.35, 0); shake = 4;
          say(L.ambush ? 'SOMETHING IS AHEAD OF YOU' : 'TODD IS AWAKE. RUN.', 3);
        }
        return;
      }
      T.anim += dt;
      // distance field toward player
      dfT -= dt;
      if (dfT <= 0) { dfT = 0.2; bfs(L.M, L.N, P.x | 0, P.y | 0, dfield); }
      var spd = L.toddSpeed, tx = P.x, ty = P.y;
      var dP = Math.hypot(P.x - T.x, P.y - T.y), see = dP < 12 && los(T.x, T.y, P.x, P.y);
      // flares scare
      for (var i = 0; i < flares.length; i++) {
        var fl = flares[i];
        if (T.immune <= 0 && Math.hypot(fl.x - T.x, fl.y - T.y) < 2.4) { T.scared = 3; T.immune = 5; SFX.screech(0); say('TODD FEARS THE FIRE', 2); }
      }
      if (T.immune > 0) T.immune -= dt;
      if (T.scared > 0) {
        T.scared -= dt; spd *= 0.9;
        // flee: move to neighbour with largest distance
        var cx = T.x | 0, cy = T.y | 0, best = -1, bx = T.x, by = T.y;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var n = (cy + d[1]) * L.N + cx + d[0]; if (!L.M[n] && dfield[n] < 1e8 && dfield[n] > best) { best = dfield[n]; bx = cx + d[0] + 0.5; by = cy + d[1] + 0.5; } });
        tx = bx; ty = by;
      } else if (!(see && dP < 3)) {
        var ccx = T.x | 0, ccy = T.y | 0, bd = dfield[ccy * L.N + ccx], nx = T.x, ny = T.y;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var n = (ccy + d[1]) * L.N + ccx + d[0]; if (!L.M[n] && dfield[n] < bd) { bd = dfield[n]; nx = ccx + d[0] + 0.5; ny = ccy + d[1] + 0.5; } });
        tx = nx; ty = ny;
        // centre in corridor before turning
        var ox = T.x - (ccx + 0.5), oy = T.y - (ccy + 0.5);
        if (Math.abs(tx - T.x) > Math.abs(ty - T.y)) ty = ccy + 0.5 - oy * 0.2; else tx = ccx + 0.5 - ox * 0.2;
      }
      if (see && !T.seen) { T.seen = true; SFX.screech(relPan(T.x, T.y)); say('TODD SEES YOU', 2.2); shake = 6; }
      if (!see && dP > 10) T.seen = false;
      if (see && dP < 4) spd *= 1.12; // final lunge
      var dx = tx - T.x, dy = ty - T.y, d = Math.hypot(dx, dy);
      if (d > 0.01) { var m = Math.min(d, spd * dt); T.x += dx / d * m; T.y += dy / d * m; }
      // skittering sounds
      T.skT -= dt;
      if (T.skT <= 0) { T.skT = 0.05 + Math.random() * 0.06; var vol = clamp(0.5 / (1 + dP * 0.9), 0.003, 0.4); SFX.skitter(vol, relPan(T.x, T.y)); }
      T.hissT -= dt;
      if (T.hissT <= 0) { T.hissT = 4 + Math.random() * 5; SFX.hiss(clamp(0.5 / (1 + dP * 0.5), 0.02, 0.35), relPan(T.x, T.y)); }
      threat = clamp(1 - dP / 9, 0, 1);
      if (dP < 0.55 && P.alive) caught();
    }
    function relPan(x, y) { return Math.sin(angDiff(Math.atan2(y - P.y, x - P.x), P.a)); }
    function caught() {
      P.alive = false; mode = 'scare'; scareT = 0; levelDeaths++; S.deaths++;
      unlockPointer(); stopAmbient(); SFX.scream(); shake = 30;
      var kept = Math.floor(runCoins / 2); S.coins += kept;
      lastResult = { dead: true, kept: kept, lost: runCoins - kept };
      saveNow();
    }
    function finishEscape() {
      var bonus = runTime <= L.par ? 5 * (L.st + 1) : 0;
      var gained = runCoins + bonus;
      S.coins += gained; S.escapes++;
      var first = lvIdx >= S.cleared;
      if (first) S.cleared = Math.min(TOTAL, lvIdx + 1);
      var key = String(lvIdx), prev = S.best[key];
      if (!prev || runTime < prev) S.best[key] = Math.round(runTime * 100) / 100;
      var score = Math.round((lvIdx + 1) * 100 + Math.max(0, L.par - runTime) * 25 + runCoins * 5);
      var newHi = score > hiScore; if (newHi) hiScore = score;
      saveNow();
      lastResult = { dead: false, time: runTime, coins: runCoins, bonus: bonus, par: L.par, first: first, score: score, newHi: newHi, stageDone: lvIdx % 10 === 9, deaths: levelDeaths };
      mode = 'menu'; stopAmbient();
      show('escaped');
    }
    function updateLights(dt) {
      var N = L.N, lm = lightmap, i, k;
      for (i = 0; i < lm.length; i++) lm[i] = 0;
      function addLight(x, y, inten, rad) {
        var x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(N - 1, Math.ceil(x + rad)), y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(N - 1, Math.ceil(y + rad));
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
          var d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / rad; if (d >= 1) continue;
          if (d > 0.35 && !los(x, y, xx + 0.5, yy + 0.5)) continue;
          lm[yy * N + xx] += inten * (1 - d) * (1 - d);
        }
      }
      for (k = 0; k < L.lamps.length; k++) {
        var lp = L.lamps[k], fl = 1;
        if (lp.broken) { lp.ph += dt; fl = Math.sin(lp.ph * 13) > 0.7 || Math.random() < 0.05 ? 1 : 0.08; }
        lp.on = fl;
        addLight(lp.x, lp.y, 0.65 * fl, 3.2);
      }
      for (k = 0; k < flares.length; k++) addLight(flares[k].x, flares[k].y, 0.9 * (0.85 + Math.random() * 0.15), 3.6);
      addLight(L.ex, L.ey, 0.5, 2.5);
    }

    /* ---------- rendering (raycaster) ---------- */
    function render() {
      var w = RW, h = RH, N = L.N, M = L.M, st = L.st;
      var WT = WALLS[st], FT = FLOORS[st].d, FW = 64;
      var bobY = Math.sin(P.bob) * h * 0.012 * Math.min(1, P.speed / 2);
      var shx = shake ? (Math.random() - 0.5) * shake * 0.6 : 0, shy = shake ? (Math.random() - 0.5) * shake * 0.6 : 0;
      var hor = (h >> 1) + bobY + shy;
      var dirX = Math.cos(P.a), dirY = Math.sin(P.a), pk = 0.68, plX = -dirY * pk, plY = dirX * pk;
      var amb = STAGES[st].amb, sky = STAGES[st].sky;
      var flashI = 1.45 * flashFlick, range = P.st.range;
      var tint = threat * threat * 70;
      var x, y, p, c, l, r, g, b;
      // sky
      var hi = Math.max(0, Math.min(h, Math.ceil(hor)));
      for (y = 0; y < hi; y++) {
        var fsky = y / Math.max(1, hor);
        var sr = sky[0] * (0.4 + fsky) + tint * 0.3, sg = sky[1] * (0.4 + fsky), sb = sky[2] * (0.4 + fsky);
        var col = 0xff000000 | ((sb | 0) << 16) | ((sg | 0) << 8) | (sr > 255 ? 255 : sr | 0);
        for (x = 0, p = y * w; x < w; x++, p++) buf[p] = col;
      }
      // floor casting
      for (y = hi; y < h; y++) {
        var rowD = (0.5 * h) / Math.max(0.5, y - hor);
        var fog = Math.exp(-rowD * 0.16);
        var fall = Math.max(0, 1 - rowD / range); fall *= fall;
        var stX = rowD * (2 * plX) / w, stY = rowD * (2 * plY) / w;
        var fx = P.x + rowD * (dirX - plX), fy = P.y + rowD * (dirY - plY);
        for (x = 0, p = y * w; x < w; x++, p++) {
          var cx = fx | 0, cy = fy | 0;
          c = FT[(((fy - cy) * FW) & 63) * FW + (((fx - cx) * FW) & 63)];
          var lmv = (cx >= 0 && cy >= 0 && cx < N && cy < N) ? lightmap[cy * N + cx] : 0;
          l = (amb + lmv + cone[p] * flashI * fall) * fog;
          r = (c & 255) * l + tint * l; g = ((c >> 8) & 255) * l; b = ((c >> 16) & 255) * l;
          buf[p] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
          fx += stX; fy += stY;
        }
      }
      // walls
      for (x = 0; x < w; x++) {
        var camX = 2 * x / w - 1, rdx = dirX + plX * camX, rdy = dirY + plY * camX;
        var mx = P.x | 0, my = P.y | 0;
        var ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy), sdx, sdy, stepx, stepy, side = 0, hit = 0;
        if (rdx < 0) { stepx = -1; sdx = (P.x - mx) * ddx; } else { stepx = 1; sdx = (mx + 1 - P.x) * ddx; }
        if (rdy < 0) { stepy = -1; sdy = (P.y - my) * ddy; } else { stepy = 1; sdy = (my + 1 - P.y) * ddy; }
        var guard = 0;
        while (!hit && guard++ < 128) {
          if (sdx < sdy) { sdx += ddx; mx += stepx; side = 0; } else { sdy += ddy; my += stepy; side = 1; }
          if (mx < 0 || my < 0 || mx >= N || my >= N) { hit = 1; break; }
          if (M[my * N + mx] > 0) hit = M[my * N + mx];
        }
        var pd = side === 0 ? sdx - ddx : sdy - ddy; if (pd < 0.05) pd = 0.05;
        zbuf[x] = pd;
        var lh = h / pd, ds = -lh / 2 + hor, de = lh / 2 + hor;
        var tex = WT[Math.min(3, Math.max(1, hit))] || WT[1], TS = tex.w, td = tex.d;
        var wx = side === 0 ? P.y + pd * rdy : P.x + pd * rdx; wx -= Math.floor(wx);
        var tx = (wx * TS) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - tx - 1;
        var lcx = side === 0 ? mx - stepx : mx, lcy = side === 1 ? my - stepy : my;
        var lmw = (lcx >= 0 && lcy >= 0 && lcx < N && lcy < N) ? lightmap[lcy * N + lcx] : 0;
        var wfog = Math.exp(-pd * 0.16), wfall = Math.max(0, 1 - pd / range); wfall *= wfall;
        var sideK = side ? 0.78 : 1;
        var y0 = Math.max(0, Math.ceil(ds)), y1 = Math.min(h - 1, Math.floor(de));
        var tstep = TS / lh, tpos = (y0 - ds) * tstep;
        for (y = y0; y <= y1; y++) {
          var ty = (tpos | 0) & (TS - 1); tpos += tstep;
          c = td[ty * TS + tx]; p = y * w + x;
          l = (amb + lmw + cone[p] * flashI * wfall) * wfog * sideK;
          r = (c & 255) * l + tint * l; g = ((c >> 8) & 255) * l; b = ((c >> 16) & 255) * l;
          buf[p] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
        }
      }
      // sprites
      var list = [];
      var i;
      for (i = 0; i < coins.length; i++) if (!coins[i].taken) list.push({ x: coins[i].x, y: coins[i].y, t: SPR.coin, sh: 0.22, lift: 0.12 + Math.sin(wallT * 3 + i) * 0.03, minL: 0.45, spin: true });
      for (i = 0; i < L.decor.length; i++) { var dc = L.decor[i]; list.push({ x: dc.x, y: dc.y, t: SPR[dc.kind], sh: dc.kind === 'dumpster' ? 0.5 : dc.kind === 'egg' ? 0.35 : 0.32, lift: 0 }); }
      for (i = 0; i < L.lamps.length; i++) { var lp = L.lamps[i]; list.push({ x: lp.x + 0.3, y: lp.y + 0.3, t: SPR.lamp, sh: 1.3, lift: 0, emiOn: lp.on > 0.5 }); }
      for (i = 0; i < webs.length; i++) list.push({ x: webs[i].x, y: webs[i].y, t: SPR.web, sh: 0.4, lift: 0, minL: 0.12 });
      for (i = 0; i < flares.length; i++) list.push({ x: flares[i].x, y: flares[i].y, t: SPR.flare, sh: 0.2, lift: 0 });
      list.push({ x: L.ex, y: L.ey, t: SPR.exit, sh: 1.0, lift: 0 });
      if (T.active) {
        var fr = Math.floor(T.anim * (6 + L.toddSpeed * 2)) % 4;
        list.push({ x: T.x, y: T.y, t: TODD[fr], sh: 1.05, lift: Math.abs(Math.sin(T.anim * 9)) * 0.03, todd: true, minL: 0.3 });
      }
      for (i = 0; i < list.length; i++) { var o = list[i]; o.d = (o.x - P.x) * (o.x - P.x) + (o.y - P.y) * (o.y - P.y); }
      list.sort(function (a, b2) { return b2.d - a.d; });
      var inv = 1 / (plX * dirY - dirX * plY);
      for (i = 0; i < list.length; i++) {
        var sp = list[i], spx = sp.x - P.x, spy = sp.y - P.y;
        var trX = inv * (dirY * spx - dirX * spy), trY = inv * (-plY * spx + plX * spy);
        if (trY <= 0.12) continue;
        var scx = (w / 2) * (1 + trX / trY);
        var tw = sp.t.w, th = sp.t.h, sdat = sp.t.d, emi = sp.t.emi;
        var spH = Math.abs(h / trY) * sp.sh, spW = spH * tw / th;
        if (sp.spin) spW *= Math.max(0.15, Math.abs(Math.cos(wallT * 3 + sp.x * 5)));
        var bottom = hor + 0.5 * h / trY - sp.lift * h / trY, top = bottom - spH;
        var x0 = Math.max(0, Math.floor(scx - spW / 2)), x1 = Math.min(w - 1, Math.floor(scx + spW / 2));
        var yy0 = Math.max(0, Math.floor(top)), yy1 = Math.min(h - 1, Math.floor(bottom));
        var scx2 = Math.floor(sp.x), scy2 = Math.floor(sp.y);
        var lms = (scx2 >= 0 && scy2 >= 0 && scx2 < N && scy2 < N) ? lightmap[scy2 * N + scx2] : 0;
        var sfog = Math.exp(-trY * 0.16), sfall = Math.max(0, 1 - trY / range); sfall *= sfall;
        for (x = x0; x <= x1; x++) {
          if (trY >= zbuf[x]) continue;
          var txs = Math.floor((x - (scx - spW / 2)) / spW * tw); if (txs < 0 || txs >= tw) continue;
          for (y = yy0; y <= yy1; y++) {
            var tys = Math.floor((y - top) / spH * th); if (tys < 0 || tys >= th) continue;
            var ti = tys * tw + txs; c = sdat[ti];
            if ((c >>> 24) < 128) continue;
            p = y * w + x;
            if (emi && emi[ti] && sp.emiOn !== false) l = sp.todd ? 1.6 : 1.3;
            else { l = (amb + lms + cone[p] * flashI * sfall) * sfog; if (sp.minL && l < sp.minL * sfog) l = sp.minL * sfog; }
            r = (c & 255) * l + tint * l * 0.5; g = ((c >> 8) & 255) * l; b = ((c >> 16) & 255) * l;
            buf[p] = 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
          }
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sceneCv, shx * 2, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      drawOverlay();
    }
    function drawOverlay() {
      var t = wallT;
      // grain
      ctx.globalAlpha = 0.07 + threat * 0.06;
      var gx = -Math.random() * 160, gy = -Math.random() * 160;
      for (var yy = gy; yy < H; yy += 160) for (var xx = gx; xx < W; xx += 160) ctx.drawImage(grainCv, xx, yy);
      ctx.globalAlpha = 1;
      // vignette
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.25 - threat * 0.08), W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, threat > 0.05 ? 'rgba(' + Math.round(70 + 90 * threat * (0.6 + 0.4 * Math.sin(t * 8))) + ',0,0,' + (0.75 + threat * 0.2) + ')' : 'rgba(0,0,0,.85)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (escaped) { ctx.fillStyle = 'rgba(220,255,225,' + clamp(fadeT / 1.2, 0, 1) + ')'; ctx.fillRect(0, 0, W, H); return; }
      // HUD
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 10, Math.min(290, W - 190), 72);
      ctx.fillStyle = '#ef4444'; ctx.font = '900 17px Impact, "Arial Black", sans-serif';
      ctx.fillText('STAGE ' + (L.st + 1) + ' · LEVEL ' + (L.lv + 1) + (L.lv === 9 ? ' · FINAL' : ''), 18, 15);
      ctx.font = '700 12px "Courier New", monospace'; ctx.fillStyle = '#fecaca';
      ctx.fillText(STAGES[L.st].name + ' · ⏱ ' + runTime.toFixed(1) + 's / par ' + L.par + 's', 18, 37);
      ctx.fillText('🪙 ' + (S.coins) + ' +' + runCoins + '  🔥 ' + P.flares + (P.st.dashCd ? '  ⚡ ' + (P.dashCd > 0 ? Math.ceil(P.dashCd) + 's' : 'READY') : ''), 18, 53);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(18, 70, 200, 6);
      ctx.fillStyle = P.stam < 25 ? '#ef4444' : '#e5e5e5'; ctx.fillRect(18, 70, 200 * P.stam / P.st.maxStam, 6);
      // compass
      if (S.ab.compass) {
        var ea = angDiff(Math.atan2(L.ey - P.y, L.ex - P.x), P.a);
        ctx.save(); ctx.translate(W / 2, 34); ctx.rotate(ea);
        ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(9, 10); ctx.lineTo(0, 4); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#86efac'; ctx.font = '700 11px "Courier New"'; ctx.textAlign = 'center'; ctx.fillText('EXIT ' + Math.round(Math.hypot(L.ex - P.x, L.ey - P.y)) + 'm', W / 2, 50);
      }
      // spider sense
      if (S.ab.sense && T.active) {
        var ta = angDiff(Math.atan2(T.y - P.y, T.x - P.x), P.a), dist = Math.hypot(T.x - P.x, T.y - P.y);
        var al = clamp(1 - dist / 14, 0.1, 1);
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ta);
        ctx.strokeStyle = 'rgba(255,0,0,' + al + ')'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.42, -0.35, 0.35); ctx.stroke();
        ctx.restore();
      }
      // messages
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (titleT > 0) {
        ctx.globalAlpha = Math.min(1, titleT);
        ctx.font = '900 ' + Math.round(Math.min(54, W / 10)) + 'px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#c00000';
        ctx.fillText(STAGES[L.st].name.toUpperCase(), W / 2, H * 0.33);
        ctx.font = '700 ' + Math.round(Math.min(20, W / 28)) + 'px "Courier New"'; ctx.fillStyle = '#fecaca';
        ctx.fillText('Level ' + (L.lv + 1) + ' — ' + STAGES[L.st].sub, W / 2, H * 0.33 + 40);
        ctx.globalAlpha = 1;
      }
      if (msgT > 0 && titleT <= 0) {
        ctx.globalAlpha = Math.min(1, msgT);
        ctx.font = '900 ' + Math.round(Math.min(32, W / 18)) + 'px Impact, "Arial Black", sans-serif';
        ctx.fillStyle = '#ff2a2a'; ctx.fillText(msg, W / 2 + (Math.random() - 0.5) * 3, H * 0.72);
        ctx.globalAlpha = 1;
      }
      if (runTime < 6 && !locked && !isTouch && !paused) {
        ctx.font = '700 14px "Courier New"'; ctx.fillStyle = 'rgba(254,202,202,.8)';
        ctx.fillText('Click to look around with the mouse · WASD move · SHIFT sprint', W / 2, H - 40);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '700 11px "Courier New"'; ctx.fillStyle = 'rgba(254,202,202,.6)';
      ctx.fillText('Playtime ' + fmtTime(S.playtime) + ' · Best ' + hiScore, 12, H - 10);
      if (isTouch) drawTouchUI();
    }
    var isTouch = false;
    function touchButtons() {
      var r = Math.max(30, Math.min(W, H) * 0.075);
      return [
        { k: 'sprint', x: W - r * 1.4, y: H - r * 1.4, r: r, label: 'RUN' },
        { k: 'dash', x: W - r * 3.6, y: H - r * 1.1, r: r * 0.8, label: 'DASH' },
        { k: 'flare', x: W - r * 1.2, y: H - r * 3.7, r: r * 0.8, label: 'FLARE' }
      ];
    }
    function drawTouchUI() {
      var bs = touchButtons();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 12px "Courier New"';
      bs.forEach(function (b) {
        ctx.fillStyle = (b.k === 'sprint' && touch.sprint) ? 'rgba(180,0,0,.6)' : 'rgba(40,0,0,.45)';
        ctx.strokeStyle = 'rgba(255,80,80,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fecaca'; ctx.fillText(b.label, b.x, b.y);
      });
      if (touch.joy) {
        ctx.strokeStyle = 'rgba(255,80,80,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(touch.joy.ox, touch.joy.oy, 50, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,80,80,.5)'; ctx.beginPath(); ctx.arc(touch.joy.ox + touch.joy.vx * 50, touch.joy.oy + touch.joy.vy * 50, 20, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(254,202,202,.35)'; ctx.fillText('drag here to move', W * 0.2, H - 40);
      }
    }
    function renderScare() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      var k = Math.min(1, scareT / 0.25);
      var sc = lerp(0.5, 1.55, k) + Math.sin(scareT * 50) * 0.03;
      var iw = W * sc, ih = iw * 352 / 512;
      var jx = (Math.random() - 0.5) * 40 * (1 - Math.min(1, scareT)), jy = (Math.random() - 0.5) * 40 * (1 - Math.min(1, scareT));
      ctx.drawImage(scareCv, W / 2 - iw / 2 + jx, H * 0.55 - ih * 0.62 + jy, iw, ih);
      ctx.fillStyle = 'rgba(160,0,0,' + (0.12 + 0.12 * Math.sin(scareT * 30)) + ')'; ctx.fillRect(0, 0, W, H);
      if (scareT < 0.07) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = 0.18; for (var gy2 = -Math.random() * 160; gy2 < H; gy2 += 160) for (var gx2 = -Math.random() * 160; gx2 < W; gx2 += 160) ctx.drawImage(grainCv, gx2, gy2); ctx.globalAlpha = 1;
      if (scareT > 0.9) {
        ctx.globalAlpha = Math.min(1, (scareT - 0.9) * 2);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '900 ' + Math.round(Math.min(80, W / 7)) + 'px Impact, "Arial Black", sans-serif'; ctx.fillStyle = '#c00000';
        ctx.fillText('TODD GOT YOU', W / 2, H * 0.45);
        ctx.globalAlpha = 1;
      }
    }
    function renderMenuBg() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#030102'; ctx.fillRect(0, 0, W, H);
      var bob = Math.sin(wallT * 0.6) * 10;
      var a = 0.25 + 0.1 * Math.sin(wallT * 1.3) + (Math.random() < 0.03 ? 0.3 : 0);
      ctx.globalAlpha = a;
      var iw = Math.min(W * 0.9, 900), ih = iw * 176 / 256;
      ctx.drawImage(TODD[Math.floor(wallT * 3) % 4].cv, W / 2 - iw / 2, H * 0.5 - ih / 2 + bob, iw, ih);
      ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.08; ctx.drawImage(grainCv, -Math.random() * 100, -Math.random() * 100, W + 100, H + 100); ctx.globalAlpha = 1;
    }

    /* ---------- abilities ---------- */
    function useFlare() {
      if (mode !== 'play' || paused || !P.alive || P.flares <= 0) return;
      P.flares--; flares.push({ x: P.x + Math.cos(P.a) * 0.3, y: P.y + Math.sin(P.a) * 0.3, t: 10 }); SFX.flare(); say('FLARE LIT', 1.2);
    }
    function useDash() {
      if (mode !== 'play' || paused || !P.alive || !P.st.dashCd || P.dashCd > 0) return;
      P.dashT = 0.32; P.dashCd = P.st.dashCd; SFX.dash(); shake = 3;
    }

    /* ---------- input ---------- */
    function localXY(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    var pointers = {};
    function onPointerDown(e) {
      ensureAudio();
      try { root.focus({ preventScroll: true }); } catch (er) { }
      if (mode !== 'play' || paused) return;
      if (!amb && !muted) startAmbient();
      var p = localXY(e);
      if (e.pointerType === 'touch') {
        isTouch = true; e.preventDefault();
        var bs = touchButtons();
        for (var i = 0; i < bs.length; i++) if (Math.hypot(p[0] - bs[i].x, p[1] - bs[i].y) < bs[i].r) {
          if (bs[i].k === 'sprint') { touch.sprint = true; pointers[e.pointerId] = 'sprint'; } else if (bs[i].k === 'dash') useDash(); else useFlare();
          return;
        }
        if (p[0] < W * 0.45) { touch.joy = { id: e.pointerId, ox: p[0], oy: p[1], vx: 0, vy: 0 }; pointers[e.pointerId] = 'joy'; }
        else { touch.look = { id: e.pointerId, lx: p[0], dx: 0 }; pointers[e.pointerId] = 'look'; }
        return;
      }
      if (!locked) { lockPointer(); dragLook = { x: p[0] }; }
    }
    function onPointerMove(e) {
      if (mode !== 'play') return;
      var p = localXY(e), role = pointers[e.pointerId];
      if (role === 'joy' && touch.joy) { var dx = p[0] - touch.joy.ox, dy = p[1] - touch.joy.oy, d = Math.hypot(dx, dy), m = Math.min(1, d / 50); touch.joy.vx = d ? dx / d * m : 0; touch.joy.vy = d ? dy / d * m : 0; }
      else if (role === 'look' && touch.look) { touch.look.dx += p[0] - touch.look.lx; touch.look.lx = p[0]; }
      else if (locked) mouseDX += e.movementX || 0;
      else if (dragLook && e.buttons) { mouseDX += (p[0] - dragLook.x) * 1.4; dragLook.x = p[0]; }
    }
    function onPointerUp(e) {
      var role = pointers[e.pointerId]; delete pointers[e.pointerId];
      if (role === 'joy') touch.joy = null; else if (role === 'look') touch.look = null; else if (role === 'sprint') touch.sprint = false;
      dragLook = null;
    }
    var MOVE_KEYS = { w: 1, a: 1, s: 1, d: 1, arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1, shift: 1 };
    function onKeyDown(e) {
      var k = (e.key || '').toLowerCase();
      if (mode === 'play' && (MOVE_KEYS[k] || k === ' ')) { e.preventDefault(); keys[k] = true; ensureAudio(); if (!amb && !muted && !paused) startAmbient(); return; }
      if (e.repeat) return;
      if (modal.style.display === 'flex') { if (k === 'escape' || k === 'enter') { e.preventDefault(); var cb = k === 'enter' ? modalCb : null; hideModal(); if (cb) cb(); } return; }
      if (k === 'q') useFlare();
      else if (k === 'e') useDash();
      else if (k === 'r') { if (mode === 'play' || mode === 'scare') restartLevel(); else if (curScreen === 'caught' || curScreen === 'escaped') playLevel(lvIdx); }
      else if (k === 'escape') { if (mode === 'play') togglePause(); else if (S && ['hub', 'slots', 'title', 'escaped', 'caught'].indexOf(curScreen) < 0) show('hub'); }
      else if (k === 'm') setMute(!muted);
      else if (k === 'f') toggleFS();
      else if (k === 'enter') {
        if (curScreen === 'escaped') playLevel(Math.min(TOTAL - 1, lvIdx + 1 <= S.cleared ? lvIdx + 1 : lvIdx));
        else if (curScreen === 'caught') playLevel(lvIdx);
        else if (curScreen === 'title') show('slots');
      }
    }
    function onKeyUp(e) { var k = (e.key || '').toLowerCase(); if (MOVE_KEYS[k] || k === ' ') keys[k] = false; }
    function onBlur() { keys = {}; touch.joy = null; touch.look = null; touch.sprint = false; }
    function onBeforeUnload() { saveNow(); }
    function onFsChange() { resize(); setTimeout(resize, 150); }
    function toggleFS() {
      try {
        var fe = document.fullscreenElement || document.webkitFullscreenElement;
        if (fe) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { var rq = root.requestFullscreen || root.webkitRequestFullscreen; if (rq) rq.call(root); }
      } catch (e) { }
    }
    function togglePause() {
      if (mode !== 'play') return;
      paused = !paused;
      if (paused) { onBlur(); unlockPointer(); show('pause'); } else hideScreen();
    }
    function onCtx(e) { e.preventDefault(); }
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', onCtx);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('pointerlockchange', onLockChange);
    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h]'); if (!b) return;
      ensureAudio(); SFX.click();
      var h = b.getAttribute('data-h');
      if (h === 'fs') toggleFS(); else if (h === 'mute') setMute(!muted);
      else if (h === 'restart') restartLevel();
      else if (h === 'menu') { if (mode === 'play') togglePause(); else if (S) show('hub'); }
      b.blur();
    });

    /* ---------- toast / modal ---------- */
    var toastTimer = 0, modalCb = null;
    function toast(m) { toastEl.textContent = m; toastEl.style.opacity = '1'; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2600); }
    function showModal(html, onYes, yes) {
      modalCb = onYes || null;
      modal.innerHTML = '<div class="rt-card" style="max-width:480px;width:100%;text-align:center">' + html + '<div class="rt-row" style="justify-content:center;margin-top:14px">' +
        (onYes ? '<button class="rt-b" data-m="yes">' + (yes || 'Yes') + '</button><button class="rt-b s" data-m="no">Cancel</button>' : '<button class="rt-b s" data-m="no">OK</button>') + '</div></div>';
      modal.style.display = 'flex';
    }
    function hideModal() { modal.style.display = 'none'; modal.innerHTML = ''; modalCb = null; }
    modal.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; SFX.click(); var cb = modalCb; hideModal(); if (b.getAttribute('data-m') === 'yes' && cb) cb(); });

    /* ---------- screens ---------- */
    function hideScreen() { scr.style.display = 'none'; scr.innerHTML = ''; curScreen = ''; updateHud(); }
    function show(name) {
      curScreen = name; scr.style.display = 'block';
      var html = ''; try { html = SCREENS[name](); } catch (err) { html = '<div class="rt-card">Error: ' + esc(err.message) + '</div>'; }
      scr.innerHTML = '<div class="rt-pn">' + html + '</div>'; scr.scrollTop = 0; updateHud();
    }
    function bar() {
      return '<div class="rt-row" style="justify-content:space-between;margin-bottom:12px"><div class="rt-row"><span class="rt-pill">🪙 ' + S.coins + '</span><span class="rt-pill">☠ ' + S.deaths + '</span><span class="rt-pill">🚪 ' + S.escapes + '</span></div>' +
        '<div class="rt-row"><span class="rt-pill">⏱ ' + fmtTime(S.playtime) + '</span><button class="rt-b s" data-a="hub">⬅ Back</button></div></div>';
    }
    var SCREENS = {
      title: function () {
        return '<div class="rt-h1">RUN FROM TODD</div><div class="rt-sub">He has eight legs. He has eight eyes. He knows your name.</div>' +
          '<div class="rt-card" style="max-width:640px;margin:0 auto"><div class="rt-h2">HOW TO SURVIVE</div><div style="line-height:2;font-size:14px">' +
          '<div><span class="rt-k">W A S D</span><span class="rt-k">↑↓</span> Move · <span class="rt-k">← →</span> or <span class="rt-k">Mouse</span> Look (click to lock the mouse)</div>' +
          '<div><span class="rt-k">SHIFT</span> Sprint (uses stamina) · <span class="rt-k">E</span> Dash · <span class="rt-k">Q</span> Drop a flare</div>' +
          '<div><span class="rt-k">R</span> Restart · <span class="rt-k">Esc</span> Pause · <span class="rt-k">M</span> Mute · <span class="rt-k">F</span> Fullscreen</div>' +
          '<div>📱 Touch: drag the left side to move, drag the right side to look, and tap the RUN / DASH / FLARE buttons</div></div>' +
          '<div style="margin-top:10px;font-size:14px;line-height:1.6;opacity:.85">Find the glowing green <b style="color:#4ade80">EXIT</b> before Todd, the giant spider, catches you. Listen: his legs click faster as he gets closer, and your heartbeat will warn you. Pick up coins from the ground to unlock abilities. If Todd gets you, you keep only half of that run’s coins. Webs slow you down, and Todd is afraid of fire. There are 5 stages of 10 levels, and every stage is darker and faster.</div>' +
          '<div style="margin-top:10px;font-size:12px;opacity:.6">⚠ Contains loud jumpscares and flashing red light. Best with headphones.</div>' +
          '<div style="text-align:center;margin-top:16px"><button class="rt-b big" data-a="toslots">ENTER THE ALLEY</button></div></div>' +
          '<div class="rt-sub">Best score ' + hiScore + ' · Total playtime ' + fmtTime(gPT) + '</div>';
      },
      slots: function () {
        var h = '<div class="rt-h1" style="font-size:44px">SAVE FILES</div><div class="rt-sub">Choose who Todd is hunting tonight.</div><div class="rt-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">';
        for (var i = 0; i < 3; i++) {
          var s = slots[i];
          h += '<div class="rt-card"><div class="rt-h2">Slot ' + (i + 1) + '</div>';
          if (s) {
            var cur = Math.min(TOTAL - 1, s.cleared);
            h += '<div style="line-height:1.7;font-size:14px">Stage ' + (Math.floor(cur / 10) + 1) + ' · Level ' + (cur % 10 + 1) + (s.cleared >= TOTAL ? ' · <b style="color:#4ade80">ESCAPED ALL</b>' : '') +
              '<br>🪙 ' + s.coins + ' coins · ☠ ' + s.deaths + ' deaths<br>⏱ ' + fmtTime(s.playtime) + '</div>' +
              '<div class="rt-row" style="margin-top:10px"><button class="rt-b" data-a="slotplay" data-v="' + i + '">▶ Play</button><button class="rt-b s" data-a="slotreset" data-v="' + i + '">Reset</button><button class="rt-b s" data-a="slotdel" data-v="' + i + '">Delete</button></div>';
          } else h += '<div style="opacity:.6;margin:18px 0">Empty — New Save</div><div class="rt-row"><button class="rt-b" data-a="slotplay" data-v="' + i + '">✚ New Save</button></div>';
          h += '<div class="rt-row" style="margin-top:8px"><button class="rt-b s" data-a="slotexp" data-v="' + i + '"' + (s ? '' : ' disabled') + '>⬇ Export Save</button><button class="rt-b s" data-a="slotimp" data-v="' + i + '">⬆ Import Save</button></div></div>';
        }
        return h + '</div><div style="text-align:center;margin-top:14px"><button class="rt-b s" data-a="totitle">❔ How to Play</button></div>';
      },
      hub: function () {
        var cur = Math.min(TOTAL - 1, S.cleared), st = Math.floor(cur / 10);
        return bar() + '<div class="rt-h1" style="font-size:clamp(34px,7vw,60px)">RUN FROM TODD</div>' +
          '<div class="rt-card" style="max-width:560px;margin:14px auto;text-align:center"><div style="opacity:.75">Stage ' + (st + 1) + ' — ' + STAGES[st].name + '</div>' +
          '<div style="font-family:Impact,sans-serif;font-size:40px;color:#ef4444;margin:6px 0">LEVEL ' + (cur % 10 + 1) + '</div>' +
          '<div class="rt-bar" style="margin:6px 0 12px"><i style="width:' + (S.cleared / TOTAL * 100) + '%"></i></div>' +
          '<button class="rt-b big" data-a="play" style="width:100%">' + (S.cleared >= TOTAL ? 'RUN AGAIN' : 'RUN') + '</button>' +
          '<div style="font-size:13px;opacity:.7;margin-top:8px;font-style:italic">' + STAGES[st].sub + '</div></div>' +
          '<div class="rt-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));max-width:560px;margin:0 auto">' +
          '<button class="rt-b" data-a="levels">🗺 Level Select</button><button class="rt-b" data-a="shop">🔦 Abilities</button>' +
          '<button class="rt-b s" data-a="toslots">💾 Save &amp; Slots</button><button class="rt-b s" data-a="totitle">❔ How to Play</button></div>' +
          '<div class="rt-sub" style="margin-top:12px;font-size:13px">Best score ' + hiScore + ' · Total playtime ' + fmtTime(gPT) + '</div>';
      },
      levels: function () {
        var h = bar() + '<div class="rt-h2">LEVEL SELECT</div>';
        for (var s = 0; s < 5; s++) {
          var lockedStage = s * 10 > S.cleared;
          h += '<div class="rt-card" style="margin-bottom:10px;' + (lockedStage ? 'opacity:.45' : '') + '"><div style="font-weight:800;margin-bottom:8px;color:#fca5a5">Stage ' + (s + 1) + ' — ' + STAGES[s].name + '</div><div class="rt-grid" style="grid-template-columns:repeat(10,minmax(0,1fr));gap:5px">';
          for (var l = 0; l < 10; l++) {
            var i = s * 10 + l, lk = i > S.cleared || i >= TOTAL, bt = S.best[String(i)];
            h += '<button class="rt-lv' + (lk ? ' lk' : '') + (i === Math.min(S.cleared, TOTAL - 1) ? ' cur' : '') + (l === 9 ? ' boss' : '') + '" data-a="lvl" data-v="' + i + '"' + (lk ? ' disabled' : '') + '>' + (lk ? '🔒' : l + 1) + '<small>' + (bt ? bt.toFixed(0) + 's' : '') + '</small></button>';
          }
          h += '</div></div>';
        }
        return h;
      },
      shop: function () {
        var h = bar() + '<div class="rt-h2">ABILITIES</div><div style="font-size:13px;opacity:.75;margin-bottom:10px">Spend the coins you scavenge from the alleys. Abilities are permanent.</div><div class="rt-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        ABIL.forEach(function (a) {
          var lv = S.ab[a.k], mx = lv >= a.cost.length, c = mx ? 0 : a.cost[lv];
          h += '<div class="rt-card"><div style="display:flex;justify-content:space-between"><b style="color:#fecaca">' + a.n + '</b><span class="rt-pill">' + lv + '/' + a.cost.length + '</span></div>' +
            '<div style="font-size:12px;opacity:.75;margin:6px 0 10px">' + a.d + '</div>' +
            (mx ? '<button class="rt-b g" disabled>OWNED / MAX</button>' : '<button class="rt-b" data-a="buy" data-v="' + a.k + '"' + (S.coins >= c ? '' : ' disabled') + '>Unlock 🪙 ' + c + '</button>') + '</div>';
        });
        return h + '</div>';
      },
      pause: function () {
        return '<div class="rt-card" style="max-width:420px;margin:40px auto;text-align:center"><div class="rt-h2">PAUSED</div><div style="opacity:.7;margin-bottom:12px;font-style:italic">Todd is waiting.</div>' +
          '<div class="rt-grid"><button class="rt-b big" data-a="resume">RESUME</button><button class="rt-b" data-a="restart">↻ Restart Level</button><button class="rt-b s" data-a="shop2">🔦 Abilities</button><button class="rt-b s" data-a="tohub">Exit to Hub</button></div>' +
          '<div style="font-size:12px;opacity:.6;margin-top:10px">Playtime ' + fmtTime(S.playtime) + '</div></div>';
      },
      escaped: function () {
        var r = lastResult;
        return '<div class="rt-card" style="max-width:480px;margin:20px auto;text-align:center;border-color:rgba(74,222,128,.4)">' +
          '<div style="font-family:Impact,sans-serif;font-size:46px;color:#4ade80;letter-spacing:2px">YOU ESCAPED</div>' +
          '<div style="opacity:.7;font-style:italic;margin-bottom:8px">' + (r.stageDone ? (lvIdx === TOTAL - 1 ? 'You escaped Todd’s nest. For now.' : 'Stage ' + (Math.floor(lvIdx / 10) + 1) + ' survived. It gets worse.') : 'He is still out there.') + '</div>' +
          '<div style="line-height:1.9">⏱ ' + r.time.toFixed(2) + 's (par ' + r.par + 's)' + (r.bonus ? ' · <b style="color:#4ade80">FAST +' + r.bonus + '</b>' : '') +
          '<br>🪙 +' + (r.coins + r.bonus) + ' coins · ☠ ' + r.deaths + ' deaths<br>Score ' + r.score + (r.newHi ? ' <b style="color:#ef4444">NEW BEST</b>' : ' · Best ' + hiScore) + '</div>' +
          '<div class="rt-row" style="justify-content:center;margin-top:12px">' + (lvIdx + 1 < TOTAL ? '<button class="rt-b big" data-a="next">NEXT ▶</button>' : '') +
          '<button class="rt-b s" data-a="replay">↻ Replay</button><button class="rt-b s" data-a="shop">🔦 Abilities</button><button class="rt-b s" data-a="tohub">Hub</button></div>' +
          '<div style="font-size:12px;opacity:.5;margin-top:8px">Enter = Next · R = Replay</div></div>';
      },
      caught: function () {
        var r = lastResult;
        return '<div class="rt-card" style="max-width:460px;margin:30px auto;text-align:center">' +
          '<div class="rt-h1" style="font-size:52px">TODD GOT YOU</div>' +
          '<div style="opacity:.75;margin:8px 0">You kept 🪙 ' + r.kept + ' and dropped ' + r.lost + ' in the dark.</div>' +
          '<div class="rt-row" style="justify-content:center;margin-top:12px"><button class="rt-b big" data-a="replay">TRY AGAIN</button><button class="rt-b s" data-a="shop">🔦 Abilities</button><button class="rt-b s" data-a="tohub">Hub</button></div>' +
          '<div style="font-size:12px;opacity:.5;margin-top:8px">Enter / R = Try again</div></div>';
      }
    };

    /* ---------- actions ---------- */
    function exportSlot(i) {
      var s = i === slotIdx && S ? S : slots[i]; if (!s) return;
      if (i === slotIdx) saveNow();
      try {
        var blob = new Blob([JSON.stringify({ game: GID, version: 1, exported: new Date().toISOString(), data: s }, null, 1)], { type: 'application/json' });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = GID + '_slot' + (i + 1) + '.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500); toast('Save exported');
      } catch (e) { toast('Export failed'); }
    }
    function onFile() {
      var f = fileIn.files && fileIn.files[0]; if (!f || importTarget < 0) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var o = JSON.parse(rd.result), data = o && o.game === GID && o.data ? o.data : null;
          if (!data) throw new Error('bad');
          var apply = function () { slots[importTarget] = normalizeSave(data); if (importTarget === slotIdx) S = slots[importTarget]; persistSlots(); show('slots'); toast('Imported into Slot ' + (importTarget + 1)); };
          if (slots[importTarget]) showModal('<div class="rt-h2">Overwrite Slot ' + (importTarget + 1) + '?</div>', apply, 'Overwrite'); else apply();
        } catch (e) { showModal('<div class="rt-h2">Import failed</div><div>That is not a Run From Todd save file.</div>'); }
        fileIn.value = '';
      };
      rd.readAsText(f);
    }
    fileIn.addEventListener('change', onFile);
    scr.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      ensureAudio(); SFX.click();
      var a = b.getAttribute('data-a'), v = b.getAttribute('data-v'), i = v != null ? parseInt(v, 10) : -1;
      switch (a) {
        case 'toslots': if (S) saveNow(); show('slots'); break;
        case 'totitle': show('title'); break;
        case 'hub': show('hub'); break;
        case 'slotplay': slotIdx = i; if (!slots[i]) slots[i] = newSave(); S = normalizeSave(slots[i]); slots[i] = S; S.lastSeen = Date.now(); saveNow(); computeCone(); show('hub'); break;
        case 'slotreset': showModal('<div class="rt-h2">Reset Slot ' + (i + 1) + '?</div><div>All progress in this slot will be lost.</div>', function () { slots[i] = newSave(); if (slotIdx === i) S = slots[i]; persistSlots(); show('slots'); toast('Slot reset'); }, 'Reset'); break;
        case 'slotdel': showModal('<div class="rt-h2">Delete Slot ' + (i + 1) + '?</div><div>This cannot be undone.</div>', function () { slots[i] = null; if (slotIdx === i) { S = null; slotIdx = -1; } persistSlots(); show('slots'); toast('Slot deleted'); }, 'Delete'); break;
        case 'slotexp': exportSlot(i); break;
        case 'slotimp': importTarget = i; fileIn.click(); break;
        case 'play': playLevel(Math.min(TOTAL - 1, S.cleared)); break;
        case 'levels': show('levels'); break;
        case 'lvl': playLevel(i); break;
        case 'shop': mode = 'menu'; stopAmbient(); show('shop'); break;
        case 'shop2': mode = 'menu'; stopAmbient(); show('shop'); break;
        case 'buy': {
          var ab = ABIL.filter(function (x) { return x.k === v; })[0], lv = S.ab[v];
          if (ab && lv < ab.cost.length && S.coins >= ab.cost[lv]) { S.coins -= ab.cost[lv]; S.ab[v]++; SFX.buy(); saveNow(); computeCone(); toast(ab.n + ' upgraded'); }
          show('shop');
        } break;
        case 'resume': paused = false; hideScreen(); break;
        case 'restart': restartLevel(); break;
        case 'tohub': saveNow(); toMenu('hub'); break;
        case 'next': playLevel(Math.min(TOTAL - 1, lvIdx + 1)); break;
        case 'replay': playLevel(lvIdx); break;
      }
    });

    /* ---------- loop ---------- */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; wallT += dt;
      if (S && !document.hidden) { S.playtime += dt; gPT += dt; ptFlush += dt; if (ptFlush > 5) { ptFlush = 0; flushPT(); } }
      if (mode === 'play' && L) {
        if (!paused) update(dt);
        render();
      } else if (mode === 'scare') {
        scareT += dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 15);
        renderScare();
        if (scareT > 1.9) { mode = 'menu'; show('caught'); }
      } else renderMenuBg();
    }
    var autoSave = setInterval(function () { if (S) saveNow(); }, 20000);

    resize();
    setMute(muted);
    show('title');
    raf = requestAnimationFrame(frame);
    try { Object.defineProperty(root, '__rft', { value: { st: function () { return { P: P, T: T, L: L, S: S, mode: mode, coins: coins }; }, update: function (dt) { update(dt); }, play: function (i) { playLevel(i); }, load: function (i) { slotIdx = i; slots[i] = slots[i] || newSave(); S = normalizeSave(slots[i]); slots[i] = S; }, keys: keys, setKey: function (k, v) { keys[k] = v; } } }); } catch (e) { }

    return function cleanup() {
      try { saveNow(); } catch (e) { }
      cancelAnimationFrame(raf); clearInterval(autoSave); clearTimeout(toastTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('pointerlockchange', onLockChange);
      fileIn.removeEventListener('change', onFile);
      if (ro) ro.disconnect();
      unlockPointer();
      try { if (document.fullscreenElement === root) document.exitFullscreen(); } catch (e) { }
      stopAmbient();
      try { if (actx) actx.close(); } catch (e) { }
      if (root.parentNode) root.parentNode.removeChild(root);
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Registration                                                       */
  /* ------------------------------------------------------------------ */
  window.ARCADE_GAMES = window.ARCADE_GAMES || [];
  window.ARCADE_GAMES.push({
    id: GID,
    title: TITLE,
    description: 'First-person 3D horror: escape the dark alleys before Todd, the giant spider, catches you.',
    category: '3D',
    icon: createGameIcon(),
    bannerGradient: 'linear-gradient(135deg, #1a0000 0%, #7f1d1d 100%)',
    controls: [
      'WASD / Arrow Keys — Move & turn',
      'Mouse — Look (click to lock)',
      'Shift — Sprint · E — Dash · Q — Flare',
      'R Key — Restart level',
      'Esc — Pause · M — Mute · F — Fullscreen'
    ],
    start: function (container) { return startGame(container); }
  });
})();
