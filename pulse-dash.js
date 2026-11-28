/* =====================================================================
   PULSE DASH - original one-button rhythm auto-runner
   1000 seeded levels - 5 modes (Hopper, Jet, Roller, Zig, Spider)
   jump pads, orbs, gravity & speed portals, practice mode, procedural
   music, percentage progress and automatic saving
   ===================================================================== */
(function () {
  'use strict';

  var GID = 'pulse-dash', TITLE = 'Pulse Dash', NLV = 1000;
  var T = 40, PH = 15, BASEV = 420, GRAV = 3300, JUMP = 860;
  var DIFFS = [
    { n: 'Easy', c: '#22d3ee', to: 100 }, { n: 'Normal', c: '#4ade80', to: 250 }, { n: 'Hard', c: '#facc15', to: 450 },
    { n: 'Harder', c: '#fb923c', to: 650 }, { n: 'Insane', c: '#f472b6', to: 850 }, { n: 'Demon', c: '#ef4444', to: 1000 }
  ];
  var MODE_NAMES = { hop: 'HOPPER', jet: 'JET', ball: 'ROLLER', zig: 'ZIG', spider: 'SPIDER' };
  var MODE_COL = { hop: '#22d3ee', jet: '#f472b6', ball: '#fb923c', zig: '#4ade80', spider: '#a78bfa' };
  var COLORS = ['#22d3ee', '#facc15', '#4ade80', '#f472b6', '#fb923c', '#a78bfa', '#ef4444', '#ffffff', '#38bdf8', '#84cc16', '#e879f9', '#fbbf24'];
  var SHAPES = ['Core', 'Split', 'Eye', 'Ring', 'Bolt'];

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmtTime(s) { s = Math.floor(s || 0); var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + x + 's' : x + 's'; }
  function diffOf(n) { for (var i = 0; i < DIFFS.length; i++) if (n <= DIFFS[i].to) return DIFFS[i]; return DIFFS[5]; }
  function line(g, a, b, c, d) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }

  /* ------------------------------------------------------------------ */
  /*  Seeded level generator                                             */
  /* ------------------------------------------------------------------ */
  function genLevel(n) {
    var R = mulberry32((n * 2654435761 ^ 0x1b873593) >>> 0), d = (n - 1) / (NLV - 1);
    var L = { n: n, d: d, blocks: [], spikes: [], pads: [], orbs: [], portals: [], tunnels: [], ceils: [], hue: Math.floor(R() * 360), bpm: Math.round(118 + R() * 22 + d * 30), seed: n };
    var x = 0;
    function block(x0, y0, w, h, kind) { L.blocks.push({ x: x0, y: y0, w: w, h: h, k: kind || 0 }); }
    function spike(x0, y0, up) { L.spikes.push({ x: x0, y: y0, up: up !== false }); }
    function ground(x0, x1) { if (x1 > x0) block(x0, 0, x1 - x0, 600, 1); }
    var allowed = ['hop'];
    if (n >= 4) allowed.push('jet'); if (n >= 10) allowed.push('ball'); if (n >= 22) allowed.push('zig'); if (n >= 35) allowed.push('spider');
    var target = (28 + d * 55 + R() * 10) * BASEV;
    ground(-600, 10 * T); x = 10 * T;
    var first = true, prev = '';
    while (x < target) {
      var mode = first ? 'hop' : allowed[Math.floor(R() * allowed.length)];
      if (mode === prev && allowed.length > 2 && R() < 0.6) mode = allowed[Math.floor(R() * allowed.length)];
      var sp = 1;
      if (n >= 15 && R() < 0.25 + d * 0.3) sp = [0.85, 1.25, 1.5][Math.floor(R() * (d > 0.4 ? 3 : 2))];
      var secLen = (16 + R() * 16 + d * 10) * T * sp;
      L.portals.push({ x: x, mode: mode, sp: sp });
      var x0 = x + 3 * T * sp, x1 = x0 + secLen;
      if (mode === 'hop') x1 = buildHop(x, x0, x1, sp);
      else {
        var end = (mode === 'jet' ? buildJet : mode === 'zig' ? buildZig : buildFlip)(x0, x1, sp, mode);
        ground(x, end + 4 * T * sp); ceiling(x0 - 2 * T * sp, end + 2.5 * T * sp, mode === 'jet' ? 9 * T : mode === 'zig' ? 8 * T : 5 * T); x1 = end;
      }
      x = x1 + 4 * T * sp; first = false; prev = mode;
    }
    L.portals.push({ x: x, mode: 'hop', sp: 1 });
    ground(x, x + 30 * T);
    L.finishX = x + 10 * T;
    L.blocks.sort(function (a, b) { return a.x - b.x; });
    L.spikes.sort(function (a, b) { return a.x - b.x; });
    return L;

    function buildHop(px, x0, x1, sp) {
      var gx = px, cx = x0, lastPit = false;
      var maxK = d < 0.15 ? 1 : d < 0.35 ? 2 : 3;
      while (cx < x1) {
        var r = R(), slack = (1 - d) * 4;
        if (r < 0.34) { // spikes
          var k = 1 + Math.floor(R() * maxK);
          for (var i = 0; i < k; i++) spike(cx + i * T, 0, true);
          cx += (k + 5 + R() * slack) * T * sp;
        } else if (r < 0.54) { // step block
          var h = d > 0.4 && R() < 0.5 ? 2 : 1, len = 4 + Math.floor(R() * 5);
          block(cx, -h * T, len * T, h * T, 0);
          if (d > 0.25 && len >= 7 && R() < 0.6) spike(cx + Math.floor(len / 2) * T, -h * T, true);
          cx += (len + 4 + R() * slack) * T * sp;
        } else if (r < 0.68 && !lastPit) { // pit
          var gap = clamp(2 + R() * (1 + d * 2), 2, 3.5) * sp;
          ground(gx, cx); gx = cx + gap * T; cx = gx + (4 + R() * slack) * T * sp; lastPit = true; continue;
        } else if (r < 0.82 && n >= 6) { // jump pad over tall wall
          L.pads.push({ x: cx, y: 0 });
          block(cx + 3 * T * sp, -3 * T, T, 3 * T, 0);
          cx += 12 * T * sp;
        } else if (n >= 12) { // orb over long spike bed
          var bed = sp < 1 ? 5 : 6; for (var j = 0; j < bed; j++) spike(cx + j * T, 0, true);
          L.orbs.push({ x: cx + 2.2 * T * sp, y: -2.6 * T });
          cx += (12 + R() * slack) * T * sp;
        } else { spike(cx, 0, true); cx += 6 * T * sp; }
        lastPit = false;
      }
      ground(gx, cx + 4 * T * sp);
      return cx;
    }
    function ceiling(x0, x1, hc) { L.ceils.push({ x0: x0, x1: x1, hc: hc }); block(x0, -hc - 600, x1 - x0, 600, 2); }
    function buildJet(x0, x1, sp) {
      var hc = 9 * T;
      var gap = lerp(4.8, 2.7, d), cx = x0 + 4 * T * sp, pc = 1.5;
      while (cx < x1 - 2 * T) {
        var spc = (8.5 - d * 3) * T * sp, c = clamp(pc + (R() - 0.5) * 2 * Math.min(4.5, spc / T * 0.55), gap / 2 + 0.3, 9 - gap / 2 - 0.3);
        var w = (R() < 0.3 ? 2 : 1) * T, lo = c - gap / 2, hi = c + gap / 2;
        if (lo > 0.05) block(cx, -lo * T, w, lo * T, 0);
        if (hi < 8.95) block(cx, -hc, w, (9 - hi) * T, 0);
        pc = c; cx += spc;
      }
      return cx;
    }
    function buildFlip(x0, x1, sp, mode) {
      var hc = 5 * T;
      var side = 0, cx = x0 + 3 * T * sp;
      var gapT = mode === 'spider' ? 2.4 : 4.4;
      while (cx < x1) {
        var len = 2 + Math.floor(R() * (2 + d * 2));
        for (var i = 0; i < len; i++) spike(cx + i * T, side === 0 ? 0 : -hc, side === 0);
        cx += (len + gapT + R() * 3 * (1 - d)) * T * sp;
        side = R() < 0.8 ? 1 - side : side;
      }
      return cx;
    }
    function buildZig(x0, x1, sp) {
      var hc = 8 * T;
      var G = lerp(4.2, 2.3, d) * T, y = -G / 2 - 1, pts = [[x0 - 2 * T * sp, y], [x0, y]], cx = x0, dir = -1;
      var top = -hc + G / 2 + 8, bot = -G / 2 - 1;
      while (cx < x1) {
        var len = (1.5 + R() * 3.5) * T * sp;
        var ny = y + dir * len;
        if (ny < top) { len = y - top; ny = top; } else if (ny > bot) { len = bot - y; ny = bot; }
        if (len < 10) { dir = -dir; continue; }
        cx += len; y = ny; pts.push([cx, y]);
        dir = R() < 0.75 ? -dir : dir;
        if (y <= top + 1) dir = 1; if (y >= bot - 1) dir = -1;
      }
      if (y < bot) { cx += bot - y; y = bot; pts.push([cx, y]); }
      pts.push([cx + 2 * T * sp, y]);
      L.tunnels.push({ x0: pts[0][0], x1: cx + 2 * T * sp, pts: pts, G: G });
      return cx + 2 * T * sp;
    }
  }
  function tunnelAt(L, x) {
    for (var i = 0; i < L.tunnels.length; i++) {
      var tn = L.tunnels[i]; if (x < tn.x0 || x > tn.x1) continue;
      var p = tn.pts;
      for (var k = 1; k < p.length; k++) if (x <= p[k][0]) { var u = (x - p[k - 1][0]) / Math.max(1e-6, p[k][0] - p[k - 1][0]); return { c: lerp(p[k - 1][1], p[k][1], u), G: tn.G }; }
    }
    return null;
  }
  function ceilAt(L, x) { for (var i = 0; i < L.ceils.length; i++) if (x >= L.ceils[i].x0 && x <= L.ceils[i].x1) return L.ceils[i].hc; return 0; }

  /* ------------------------------------------------------------------ */
  /*  Icon drawing                                                       */
  /* ------------------------------------------------------------------ */
  function drawPlayer(g, mode, x, y, rot, c1, c2, shape, t, gdir) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.lineJoin = 'round'; g.lineWidth = 3;
    if (mode === 'hop') {
      g.fillStyle = c1; g.strokeStyle = '#000'; g.fillRect(-15, -15, 30, 30); g.strokeRect(-15, -15, 30, 30);
      g.fillStyle = c2; g.strokeStyle = '#000';
      if (shape === 0) { g.beginPath(); g.moveTo(0, -9); g.lineTo(9, 0); g.lineTo(0, 9); g.lineTo(-9, 0); g.closePath(); g.fill(); g.stroke(); }
      else if (shape === 1) { g.fillRect(-12, -2, 24, 4); g.fillRect(-2, -12, 4, 24); }
      else if (shape === 2) { g.fillRect(-10, -8, 20, 7); g.fillStyle = '#000'; g.fillRect(2, -7, 5, 5); }
      else if (shape === 3) { g.beginPath(); g.arc(0, 0, 8, 0, 7); g.lineWidth = 5; g.strokeStyle = c2; g.stroke(); }
      else { g.beginPath(); g.moveTo(-3, -12); g.lineTo(6, -2); g.lineTo(0, -1); g.lineTo(4, 12); g.lineTo(-6, 1); g.lineTo(0, 0); g.closePath(); g.fill(); }
    } else if (mode === 'jet') {
      g.fillStyle = c1; g.strokeStyle = '#000';
      g.beginPath(); g.moveTo(20, 0); g.lineTo(-14, -12); g.lineTo(-8, 0); g.lineTo(-14, 12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = c2; g.beginPath(); g.arc(2, 0, 5, 0, 7); g.fill();
      g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(-10, -4); g.lineTo(-20 - Math.random() * 8, 0); g.lineTo(-10, 4); g.fill();
    } else if (mode === 'zig') {
      g.fillStyle = c1; g.strokeStyle = '#000';
      g.beginPath(); g.moveTo(12, 0); g.lineTo(-10, -9); g.lineTo(-5, 0); g.lineTo(-10, 9); g.closePath(); g.fill(); g.stroke();
    } else if (mode === 'ball') {
      g.fillStyle = c1; g.strokeStyle = '#000'; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = c2; g.lineWidth = 4; for (var i = 0; i < 3; i++) { var a = i * 2.094; line(g, 0, 0, Math.cos(a) * 12, Math.sin(a) * 12); }
    } else {
      g.scale(1, gdir < 0 ? -1 : 1);
      g.strokeStyle = c2; g.lineWidth = 3; g.lineCap = 'round';
      for (var l = 0; l < 4; l++) {
        var lx = -9 + l * 6, ph = Math.sin(t * 22 + l * 1.7) * 4;
        g.beginPath(); g.moveTo(lx, 2); g.lineTo(lx - 6 + ph, 8); g.lineTo(lx - 8 + ph, 15); g.stroke();
      }
      g.fillStyle = c1; g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -2, 15, 10, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(7, -4, 3.5, 0, 7); g.arc(12, -2, 2.2, 0, 7); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(8, -4, 1.6, 0, 7); g.fill();
    }
    g.restore();
  }
  function createGameIcon() {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 512; var g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#1e1b4b'); gr.addColorStop(1, '#6d28d9'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; for (var i = 0; i < 512; i += 64) { line(g, i, 0, i, 512); line(g, 0, i, 512, i); }
      g.fillStyle = '#0b0820'; g.fillRect(0, 380, 512, 132); g.fillStyle = '#22d3ee'; g.fillRect(0, 376, 512, 6);
      g.fillStyle = '#0b0820'; g.strokeStyle = '#fff'; g.lineWidth = 5;
      for (var k = 0; k < 3; k++) { g.beginPath(); g.moveTo(250 + k * 56, 378); g.lineTo(278 + k * 56, 318); g.lineTo(306 + k * 56, 378); g.closePath(); g.fill(); g.stroke(); }
      g.strokeStyle = 'rgba(34,211,238,.5)'; g.lineWidth = 6; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(40, 340); g.quadraticCurveTo(210, 60, 420, 340); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(170, 190); g.scale(3.6, 3.6); drawPlayer(g, 'hop', 0, 0, 0.5, '#22d3ee', '#facc15', 0, 0, 1); g.restore();
      g.textAlign = 'center'; g.font = '900 86px system-ui, Arial, sans-serif'; g.lineWidth = 12; g.strokeStyle = '#000';
      g.strokeText('PULSE', 256, 110); g.strokeText('DASH', 256, 480);
      g.fillStyle = '#facc15'; g.fillText('PULSE', 256, 110); g.fillStyle = '#22d3ee'; g.fillText('DASH', 256, 480);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ */
  /*  Game                                                               */
  /* ------------------------------------------------------------------ */
  function startGame(container) {
    var LSget = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
    var LSset = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    var save = LSget(GID + '_save', null);
    if (!save || typeof save !== 'object') save = {};
    save.best = save.best || {}; save.prac = save.prac || {}; save.att = save.att || {};
    save.color1 = save.color1 | 0; save.color2 = save.color2 == null ? 1 : save.color2 | 0; save.shape = save.shape | 0;
    save.jumps = save.jumps | 0; save.attempts = save.attempts | 0; save.page = save.page | 0;
    var gPT = Number(localStorage.getItem(GID + '_playtime')) || 0;
    var muted = LSget(GID + '_muted', false) === true;
    function completed() { var c = 0; for (var k in save.best) if (save.best[k] >= 100) c++; return c; }
    function furthest() { var m = 0; for (var k in save.best) if (save.best[k] >= 100) m = Math.max(m, +k); return m; }
    function unlockedTo() { return Math.min(NLV, furthest() + 3); }
    function persist() {
      LSset(GID + '_save', save);
      try { localStorage.setItem(GID + '_playtime', String(Math.floor(gPT))); localStorage.setItem(GID + '_highscore', String(completed())); } catch (e) { }
    }

    var style = document.createElement('style');
    style.textContent = [
      '.pd-root{position:relative;width:100%;height:100%;min-height:300px;overflow:hidden;background:#0b0820;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;user-select:none;-webkit-user-select:none;touch-action:none;outline:none}',
      '.pd-root canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none}',
      '.pd-hud{position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:30}',
      '.pd-ib{width:38px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.35);background:rgba(0,0,0,.45);color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
      '.pd-scr{position:absolute;inset:0;z-index:20;overflow:auto;background:rgba(5,3,20,.78);backdrop-filter:blur(3px);padding:56px 16px 24px;box-sizing:border-box;display:none;touch-action:pan-y}',
      '.pd-pn{max-width:900px;margin:0 auto}',
      '.pd-h1{font-size:clamp(40px,8vw,80px);font-weight:900;text-align:center;margin:0;letter-spacing:2px;-webkit-text-stroke:3px #000;color:#facc15;text-shadow:0 6px 0 #000}',
      '.pd-h1 span{color:#22d3ee}',
      '.pd-h2{font-size:24px;font-weight:900;margin:0 0 10px;-webkit-text-stroke:1px #000}',
      '.pd-card{background:rgba(30,20,70,.88);border:3px solid #000;border-radius:14px;padding:14px;box-shadow:0 5px 0 rgba(0,0,0,.5)}',
      '.pd-b{border:3px solid #000;border-radius:12px;padding:9px 16px;font-weight:900;font-size:15px;cursor:pointer;color:#fff;background:linear-gradient(#4ade80,#16a34a);box-shadow:0 4px 0 #000;font-family:inherit;text-shadow:0 2px 0 #000}',
      '.pd-b:active{transform:translateY(3px);box-shadow:0 1px 0 #000}.pd-b[disabled]{opacity:.4;cursor:not-allowed}',
      '.pd-b.c{background:linear-gradient(#22d3ee,#0369a1)}.pd-b.y{background:linear-gradient(#facc15,#ca8a04)}.pd-b.p{background:linear-gradient(#f472b6,#be185d)}.pd-b.s{background:linear-gradient(#64748b,#334155)}',
      '.pd-b.big{font-size:26px;padding:14px 30px}',
      '.pd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center}',
      '.pd-lv{border:3px solid #000;border-radius:10px;padding:6px 4px;cursor:pointer;color:#fff;font-weight:900;font-family:inherit;box-shadow:0 3px 0 #000;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:15px;text-shadow:0 2px 0 #000}',
      '.pd-lv small{font-size:10px;font-weight:800}.pd-lv[disabled]{opacity:.35;cursor:not-allowed}',
      '.pd-bar{height:12px;border:2px solid #000;border-radius:8px;background:#111;overflow:hidden}.pd-bar>i{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#22d3ee)}',
      '.pd-k{display:inline-block;background:#1e1b4b;border:2px solid #000;border-radius:6px;padding:1px 7px;font-weight:900;font-size:12px;margin-right:3px}',
      '.pd-sw{width:36px;height:36px;border:3px solid #000;border-radius:8px;cursor:pointer;padding:0}.pd-sw.on{outline:3px solid #fff}.pd-sw[disabled]{opacity:.25;cursor:not-allowed}'
    ].join('\n');
    document.head.appendChild(style);
    var root = document.createElement('div'); root.className = 'pd-root'; root.tabIndex = 0; container.appendChild(root);
    var canvas = document.createElement('canvas'); root.appendChild(canvas); var ctx = canvas.getContext('2d');
    var hud = document.createElement('div'); hud.className = 'pd-hud';
    hud.innerHTML = '<button class="pd-ib" data-h="menu" title="Pause (Esc)">⏸</button><button class="pd-ib" data-h="restart" title="Restart (R)">↻</button><button class="pd-ib" data-h="mute" title="Mute (M)">🔊</button><button class="pd-ib" data-h="fs" title="Fullscreen (F)">⛶</button>';
    root.appendChild(hud);
    var scr = document.createElement('div'); scr.className = 'pd-scr'; root.appendChild(scr);
    var btnMute = hud.querySelector('[data-h=mute]'), btnRestart = hud.querySelector('[data-h=restart]'), btnMenu = hud.querySelector('[data-h=menu]');

    /* ---------- audio + procedural music ---------- */
    var AC = window.AudioContext || window.webkitAudioContext, actx = null, master = null, musicGain = null, noiseBuf = null;
    var seq = null;
    function ensureAudio() {
      try {
        if (!actx && AC) {
          actx = new AC(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(actx.destination);
          musicGain = actx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
          noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.4, actx.sampleRate); var dd = noiseBuf.getChannelData(0); for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
        }
        if (actx && actx.state === 'suspended') actx.resume();
      } catch (e) { }
    }
    function osc(f, t0, dur, type, vol, dest, slide) {
      var o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function nz(t0, dur, vol, freq, dest) {
      var s = actx.createBufferSource(); s.buffer = noiseBuf; var f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
      var g = actx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(dest || master); s.start(t0); s.stop(t0 + dur + 0.02);
    }
    function sfx(kind) {
      if (!actx || muted) return; var t0 = actx.currentTime;
      try {
        if (kind === 'die') { nz(t0, 0.5, 0.5, 300); osc(200, t0, 0.4, 'sawtooth', 0.2, master, 0.2); }
        else if (kind === 'portal') osc(500, t0, 0.25, 'triangle', 0.12, master, 2);
        else if (kind === 'orb') osc(880, t0, 0.12, 'square', 0.06, master, 1.5);
        else if (kind === 'pad') osc(300, t0, 0.2, 'sine', 0.2, master, 3);
        else if (kind === 'win') [523, 659, 784, 1047].forEach(function (f, i) { osc(f, t0 + i * 0.1, 0.4, 'triangle', 0.15); });
        else if (kind === 'click') osc(700, t0, 0.04, 'square', 0.05);
        else if (kind === 'cp') osc(1200, t0, 0.15, 'sine', 0.1, master, 1.3);
      } catch (e) { }
    }
    function startMusic(L) {
      stopMusic(); if (!actx || muted) return;
      var R = mulberry32(L.seed * 31 + 9), roots = [110, 116.5, 123.5, 130.8, 146.8, 98];
      var root = roots[Math.floor(R() * roots.length)], scale = [0, 3, 5, 7, 10, 12, 15, 17];
      var bass = [], lead = [], hats = [];
      for (var i = 0; i < 16; i++) { bass.push(i % 2 === 0 ? scale[Math.floor(R() * 4)] : -1); lead.push(R() < 0.45 ? scale[Math.floor(R() * scale.length)] : -1); hats.push(R() < 0.7); }
      seq = { L: L, root: root, bass: bass, lead: lead, hats: hats, step: 0, next: actx.currentTime + 0.05, spb: 60 / L.bpm / 4, beatT: 0 };
    }
    function stopMusic() { seq = null; }
    function tickMusic() {
      if (!seq || !actx || muted) return;
      while (seq.next < actx.currentTime + 0.12) {
        var s = seq.step % 16, t0 = seq.next, bar = Math.floor(seq.step / 16);
        try {
          if (s % 4 === 0) { osc(150, t0, 0.18, 'sine', 0.55, musicGain, 0.3); seq.beatT = t0; }
          if (s % 8 === 4 && bar % 2 === 1) nz(t0, 0.12, 0.25, 1500, musicGain);
          if (seq.hats[s] && s % 2 === 1) nz(t0, 0.04, 0.12, 7000, musicGain);
          if (seq.bass[s] >= 0) osc(seq.root * Math.pow(2, seq.bass[s] / 12), t0, seq.spb * 1.8, 'sawtooth', 0.09, musicGain);
          if (bar % 4 >= 1 && seq.lead[s] >= 0) osc(seq.root * 4 * Math.pow(2, seq.lead[s] / 12), t0, seq.spb * 1.5, 'square', 0.035, musicGain);
        } catch (e) { }
        seq.step++; seq.next += seq.spb;
      }
    }
    function setMute(m) { muted = m; LSset(GID + '_muted', m); btnMute.textContent = m ? '🔇' : '🔊'; if (master) master.gain.value = m ? 0 : 0.55; if (m) stopMusic(); else if (mode === 'play' && L) { ensureAudio(); startMusic(L); } }

    /* ---------- state ---------- */
    var W = 800, H = 600, dpr = 1, mode = 'menu', paused = false, curScreen = '', L = null, P = null, held = false, pressBuf = 0;
    var practice = false, checkpoints = [], attempt = 1, deadT = 0, winT = 0, newBest = false, bestFlash = 0, camY = -120, menuX = 0, menuL = null;
    var parts = [], trail = [], raf = 0, last = 0, wallT = 0, ptFlush = 0, pulse = 0;
    function resize() {
      var r = root.getBoundingClientRect(); W = Math.max(240, Math.round(r.width || container.clientWidth || 800)); H = Math.max(240, Math.round(r.height || container.clientHeight || 600));
      dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(root);

    function newPlayer(x, y) { return { x: x, y: y, vy: 0, g: 1, mode: 'hop', sp: 1, grounded: true, rot: 0, alive: true, won: false, pi: 0, orbUsed: {}, padUsed: {} }; }
    function playLevel(n) {
      n = clamp(n | 0, 1, unlockedTo()); L = genLevel(n); mode = 'play'; paused = false; hideScreen();
      attempt = (save.att[n] | 0) + 1; checkpoints = []; spawn(true);
      ensureAudio(); startMusic(L);
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); root.focus({ preventScroll: true }); } catch (e) { }
      updateHud();
    }
    function spawn(fresh) {
      var cp = !fresh && practice && checkpoints.length ? checkpoints[checkpoints.length - 1] : null;
      P = newPlayer(0, -PH);
      if (cp) { P.x = cp.x; P.y = cp.y; P.vy = 0; P.g = cp.g; P.mode = cp.mode; P.sp = cp.sp; P.pi = cp.pi; P.grounded = false; }
      deadT = 0; winT = 0; newBest = false; trail.length = 0; parts.length = 0; held = false; pressBuf = 0;
      camY = Math.min(-120, P.y);
      if (!cp && actx && L) startMusic(L);
    }
    function restart() { if (mode !== 'play') return; save.att[L.n] = (save.att[L.n] | 0) + 1; save.attempts++; attempt++; paused = false; hideScreen(); checkpoints = []; spawn(true); }
    function toMenu(s) { mode = 'menu'; paused = false; stopMusic(); persist(); show(s || 'main'); }
    function updateHud() { btnRestart.style.display = mode === 'play' ? '' : 'none'; btnMenu.style.display = mode === 'play' ? '' : 'none'; }

    /* ---------- physics ---------- */
    function pct() { return clamp(P.x / L.finishX * 100, 0, 100); }
    function die() {
      if (!P.alive || P.won) return;
      P.alive = false; deadT = 0.9; sfx('die');
      for (var i = 0; i < 40; i++) { var a = Math.random() * 6.283, s = 100 + Math.random() * 500; parts.push({ x: P.x, y: P.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, c: COLORS[save.color1] }); }
      var p = Math.floor(pct());
      save.att[L.n] = (save.att[L.n] | 0) + 1; save.attempts++;
      if (practice) { if (p > (save.prac[L.n] | 0)) save.prac[L.n] = p; }
      else if (p > (save.best[L.n] | 0)) { save.best[L.n] = p; newBest = true; bestFlash = 1.6; }
      persist();
    }
    function win() {
      P.won = true; winT = 2.2; sfx('win');
      for (var i = 0; i < 120; i++) { var a = Math.random() * 6.283, s = 200 + Math.random() * 700; parts.push({ x: P.x, y: P.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4, c: 'hsl(' + (Math.random() * 360 | 0) + ',90%,60%)' }); }
      if (practice) save.prac[L.n] = 100; else { if ((save.best[L.n] | 0) < 100) newBest = true; save.best[L.n] = 100; }
      persist();
    }
    function jumpPress() { pressBuf = 0.12; }
    function step(dt) {
      if (!P.alive || P.won) { if (P.won) { P.x += BASEV * P.sp * dt; } return; }
      var v = BASEV * P.sp, prevTop = P.y - PH, prevBot = P.y + PH, i;
      if (pressBuf > 0) pressBuf -= dt;
      // portals
      while (P.pi < L.portals.length && P.x >= L.portals[P.pi].x) {
        var po = L.portals[P.pi++];
        if (po.mode !== P.mode || po.sp !== P.sp) { P.mode = po.mode; P.sp = po.sp; sfx('portal'); burst(P.x, P.y, MODE_COL[po.mode]); }
        P.g = 1; if (P.mode !== 'hop') P.rot = 0;
        if (practice) checkpoints.push({ x: P.x + 2, y: P.y, g: P.g, mode: P.mode, sp: P.sp, pi: P.pi });
      }
      v = BASEV * P.sp;
      // mode controls
      var m = P.mode;
      if (m === 'hop') {
        if ((held || pressBuf > 0) && P.grounded) { P.vy = -JUMP * P.g; P.grounded = false; pressBuf = 0; save.jumps++; }
        P.vy += GRAV * P.g * dt;
      } else if (m === 'jet') {
        P.vy += (held ? -2900 : 2200) * dt; P.vy = clamp(P.vy, -480 * P.sp, 480 * P.sp);
      } else if (m === 'zig') {
        P.vy = (held ? -1 : 1) * v;
      } else if (m === 'ball') {
        if (pressBuf > 0 && P.grounded) { P.g *= -1; P.vy = 300 * P.g; P.grounded = false; pressBuf = 0; save.jumps++; }
        P.vy += GRAV * P.g * dt;
      } else if (m === 'spider') {
        if (pressBuf > 0 && P.grounded) {
          var hc = ceilAt(L, P.x); if (hc) { var oy = P.y; P.y = P.g > 0 ? -hc + PH : -PH; P.g *= -1; P.vy = 0; pressBuf = 0; save.jumps++; for (var q = 0; q < 8; q++) parts.push({ x: P.x, y: lerp(oy, P.y, q / 8), vx: -60, vy: 0, life: 0.3, c: MODE_COL.spider }); }
        }
        P.vy += GRAV * P.g * dt;
      }
      P.vy = clamp(P.vy, -1800, 1800);
      P.x += v * dt; P.y += P.vy * dt;
      // orbs & pads
      for (i = 0; i < L.orbs.length; i++) { var o = L.orbs[i]; if (!P.orbUsed[i] && Math.abs(P.x - o.x) < 34 && Math.abs(P.y - o.y) < 34 && (pressBuf > 0 || (held && !P.grounded)) && m === 'hop') { P.orbUsed[i] = 1; P.vy = -JUMP * P.g; pressBuf = 0; sfx('orb'); burst(o.x, o.y, '#facc15'); } }
      for (i = 0; i < L.pads.length; i++) { var pd = L.pads[i]; if (!P.padUsed[i] && Math.abs(P.x - pd.x - 20) < 26 && P.y > -40) { P.padUsed[i] = 1; P.vy = -JUMP * 1.42; P.grounded = false; sfx('pad'); burst(pd.x + 20, 0, '#f472b6'); } }
      // block collisions
      var wasG = P.grounded; P.grounded = false;
      var bl = L.blocks;
      for (i = 0; i < bl.length; i++) {
        var b = bl[i]; if (b.x > P.x + PH) break; if (b.x + b.w < P.x - PH) continue;
        if (P.y + PH <= b.y || P.y - PH >= b.y + b.h) continue;
        if (prevBot <= b.y + 6) { P.y = b.y - PH; if (P.vy >= 0) { P.vy = 0; if (P.g > 0 || m === 'jet' || m === 'zig') P.grounded = true; } }
        else if (prevTop >= b.y + b.h - 6) { P.y = b.y + b.h + PH; if (P.vy <= 0) { P.vy = 0; if (P.g < 0) P.grounded = true; } }
        else { die(); return; }
      }
      if (m === 'hop' && !wasG && P.grounded) P.rot = Math.round(P.rot / (Math.PI / 2)) * (Math.PI / 2);
      // spikes
      var sk = L.spikes;
      for (i = 0; i < sk.length; i++) {
        var s = sk[i]; if (s.x > P.x + PH) break; if (s.x + T < P.x - PH) continue;
        var hx0 = s.x + 13, hx1 = s.x + 27, hy0 = s.up ? s.y - 22 : s.y, hy1 = s.up ? s.y : s.y + 22;
        if (P.x + PH - 3 > hx0 && P.x - PH + 3 < hx1 && P.y + PH - 3 > hy0 && P.y - PH + 3 < hy1) { die(); return; }
      }
      // zig tunnels
      if (m === 'zig') { var tn = tunnelAt(L, P.x); if (tn && Math.abs(P.y - tn.c) > tn.G / 2 - 7) { die(); return; } }
      if (P.y > 320 || P.y < -900) { die(); return; }
      // rotation
      if (m === 'hop') { if (!P.grounded) P.rot += 7.2 * dt * P.g; }
      else if (m === 'ball') P.rot += v / 15 * dt * P.g;
      else if (m === 'jet') P.rot = clamp(P.vy / 900, -0.6, 0.6);
      else if (m === 'zig') P.rot = P.vy < 0 ? -0.785 : 0.785;
      else P.rot = 0;
      // practice checkpoints
      if (practice && P.grounded && (!checkpoints.length || P.x - checkpoints[checkpoints.length - 1].x > v * 2.5)) checkpoints.push({ x: P.x, y: P.y, g: P.g, mode: P.mode, sp: P.sp, pi: P.pi });
      if (P.x >= L.finishX) win();
      trail.push(P.x, P.y); if (trail.length > 60) trail.splice(0, 2);
    }
    function burst(x, y, c) { for (var i = 0; i < 14; i++) { var a = Math.random() * 6.283, s = 80 + Math.random() * 260; parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, c: c }); } }

    /* ---------- render ---------- */
    function render(lv, px, showPlayer) {
      var z = Math.min(H / 640, W / 760) * 1.05;
      var cx = px + W * 0.18 / z;
      var targetY = showPlayer && P ? Math.min(-150, P.y + 30) : -150;
      if (showPlayer && P && P.mode !== 'hop') { var hc = ceilAt(lv, P.x); if (hc) targetY = -hc / 2; }
      camY = lerp(camY, targetY, 0.08);
      var hue = lv.hue, B = 'hsl(' + hue + ',60%,', pl = pulse;
      var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, B + (22 + pl * 8) + '%)'); gr.addColorStop(1, B + (10 + pl * 4) + '%)');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      // parallax squares
      ctx.strokeStyle = 'hsla(' + hue + ',80%,70%,.12)'; ctx.lineWidth = 2;
      var off = (cx * 0.25) % 120;
      for (var gx = -off; gx < W + 120; gx += 120) for (var gy = 20; gy < H; gy += 120) ctx.strokeRect(gx, gy + Math.sin((gx + cx * 0.25) * 0.01) * 10, 80, 80);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cx * z), dpr * (H * 0.55 - camY * z));
      var x0 = cx - W / 2 / z - 50, x1 = cx + W / 2 / z + 50, i;
      var neon = 'hsl(' + ((hue + 180) % 360) + ',90%,65%)';
      // tunnels
      for (i = 0; i < lv.tunnels.length; i++) {
        var tn = lv.tunnels[i]; if (tn.x1 < x0 || tn.x0 > x1) continue;
        var p = tn.pts;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.strokeStyle = neon; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p[0][0], -1000); for (var k = 0; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1] - tn.G / 2); ctx.lineTo(p[p.length - 1][0], -1000); ctx.closePath(); ctx.fill();
        ctx.beginPath(); for (k = 0; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1] - tn.G / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p[0][0], 600); for (k = 0; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1] + tn.G / 2); ctx.lineTo(p[p.length - 1][0], 600); ctx.closePath(); ctx.fill();
        ctx.beginPath(); for (k = 0; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1] + tn.G / 2); ctx.stroke();
      }
      // blocks
      for (i = 0; i < lv.blocks.length; i++) {
        var b = lv.blocks[i]; if (b.x > x1) break; if (b.x + b.w < x0) continue;
        var bx = Math.max(b.x, x0 - 20), bw = Math.min(b.x + b.w, x1 + 20) - bx;
        ctx.fillStyle = b.k ? 'hsl(' + hue + ',55%,' + (8 + pl * 3) + '%)' : 'rgba(0,0,0,.7)';
        ctx.fillRect(bx, b.y, bw, b.h);
        ctx.strokeStyle = b.k ? neon : '#fff'; ctx.lineWidth = b.k ? 3 : 2.5;
        if (b.k === 1) line(ctx, bx, b.y, bx + bw, b.y); else if (b.k === 2) line(ctx, bx, b.y + b.h, bx + bw, b.y + b.h);
        else { ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; for (var ty = b.y + T; ty < b.y + b.h; ty += T) line(ctx, b.x, ty, b.x + b.w, ty); for (var tx = b.x + T; tx < b.x + b.w; tx += T) line(ctx, tx, b.y, tx, b.y + b.h); }
      }
      // spikes
      ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      for (i = 0; i < lv.spikes.length; i++) {
        var s = lv.spikes[i]; if (s.x > x1) break; if (s.x + T < x0) continue;
        ctx.beginPath(); if (s.up) { ctx.moveTo(s.x + 2, s.y); ctx.lineTo(s.x + 20, s.y - 36); ctx.lineTo(s.x + 38, s.y); } else { ctx.moveTo(s.x + 2, s.y); ctx.lineTo(s.x + 20, s.y + 36); ctx.lineTo(s.x + 38, s.y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // pads, orbs, portals
      for (i = 0; i < lv.pads.length; i++) { var pd = lv.pads[i]; if (pd.x < x0 || pd.x > x1) continue; ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.ellipse(pd.x + 20, -3, 18, 6 + pl * 2, 0, Math.PI, 0); ctx.fill(); }
      for (i = 0; i < lv.orbs.length; i++) {
        var o = lv.orbs[i]; if (o.x < x0 || o.x > x1) continue;
        ctx.strokeStyle = 'rgba(250,204,21,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, 22 + Math.sin(wallT * 8) * 3, 0, 7); ctx.stroke();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(o.x, o.y, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
      }
      for (i = 0; i < lv.portals.length; i++) {
        var po = lv.portals[i]; if (po.x < x0 - 40 || po.x > x1) continue;
        var c = MODE_COL[po.mode], top = -(ceilAt(lv, po.x + 80) || 220) + 10;
        ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(po.x, (top - 10) / 2, 14, Math.abs(top) / 2, 0, 0, 7); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (po.sp !== 1) { ctx.fillStyle = po.sp > 1 ? '#f97316' : '#38bdf8'; ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText(po.sp > 1 ? (po.sp > 1.3 ? '>>>' : '>>') : '<', po.x + 30, top - 12); }
        ctx.globalAlpha = 1;
      }
      // finish wall
      if (lv.finishX > x0 && lv.finishX < x1 + 100) { var fg = ctx.createLinearGradient(lv.finishX, 0, lv.finishX + 200, 0); fg.addColorStop(0, 'rgba(255,255,255,.7)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = fg; ctx.fillRect(lv.finishX, -900, 200, 900); }
      if (showPlayer && P) {
        if (practice) { ctx.fillStyle = '#4ade80'; for (i = 0; i < checkpoints.length; i++) { var cp = checkpoints[i]; if (cp.x > x0 && cp.x < x1) { ctx.beginPath(); ctx.moveTo(cp.x, cp.y - 14); ctx.lineTo(cp.x + 10, cp.y); ctx.lineTo(cp.x, cp.y + 14); ctx.lineTo(cp.x - 10, cp.y); ctx.fill(); } } }
        if (P.alive) {
          ctx.lineCap = 'round';
          if (P.mode === 'zig' || P.mode === 'jet') { ctx.strokeStyle = COLORS[save.color2]; ctx.lineWidth = P.mode === 'zig' ? 6 : 4; ctx.globalAlpha = 0.7; ctx.beginPath(); for (i = 0; i < trail.length; i += 2) ctx.lineTo(trail[i], trail[i + 1]); ctx.stroke(); ctx.globalAlpha = 1; }
          else for (i = 2; i < trail.length; i += 2) { ctx.globalAlpha = i / trail.length * 0.4; ctx.fillStyle = COLORS[save.color1]; ctx.fillRect(trail[i] - 4, trail[i + 1] - 4, 8, 8); }
          ctx.globalAlpha = 1;
          drawPlayer(ctx, P.mode, P.x, P.y, P.rot, COLORS[save.color1], COLORS[save.color2], save.shape, wallT, P.g);
        }
        for (i = 0; i < parts.length; i++) { var pp = parts[i]; ctx.globalAlpha = Math.max(0, pp.life * 1.4); ctx.fillStyle = pp.c; ctx.fillRect(pp.x - 4, pp.y - 4, 8, 8); }
        ctx.globalAlpha = 1;
        // HUD
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var bw2 = Math.min(420, W * 0.5), bx2 = W / 2 - bw2 / 2, pc = pct();
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx2, 12, bw2, 14); ctx.fillStyle = practice ? '#4ade80' : '#22d3ee'; ctx.fillRect(bx2, 12, bw2 * pc / 100, 14);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(bx2, 12, bw2, 14);
        ctx.font = '900 16px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        var pt = Math.floor(pc) + '%'; ctx.strokeText(pt, bx2 + bw2 + 8, 19); ctx.fillText(pt, bx2 + bw2 + 8, 19);
        ctx.font = '900 14px system-ui';
        var info = 'Level ' + L.n + ' · ' + diffOf(L.n).n + ' · Attempt ' + attempt + (practice ? ' · PRACTICE' : '');
        ctx.strokeText(info, 12, 44); ctx.fillText(info, 12, 44);
        var bst = 'Best ' + (save.best[L.n] | 0) + '%' + (practice ? ' · Practice ' + (save.prac[L.n] | 0) + '%' : '');
        ctx.strokeText(bst, 12, 64); ctx.fillText(bst, 12, 64);
        ctx.font = '700 11px system-ui'; ctx.textBaseline = 'bottom';
        ctx.strokeText('Playtime ' + fmtTime(gPT) + ' · ' + completed() + ' levels complete', 12, H - 8); ctx.fillText('Playtime ' + fmtTime(gPT) + ' · ' + completed() + ' levels complete', 12, H - 8);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (P.x < 300 && attempt <= 2 && P.alive) { ctx.font = '900 ' + Math.round(Math.min(26, W / 22)) + 'px system-ui'; ctx.lineWidth = 5; var hn = 'Click / Space / Tap to jump · hold to keep jumping'; ctx.strokeText(hn, W / 2, H * 0.3); ctx.fillText(hn, W / 2, H * 0.3); }
        if (P.alive && !P.won && wallT % 1 < 2) {
          var mn = MODE_NAMES[P.mode]; ctx.font = '900 12px system-ui'; ctx.fillStyle = MODE_COL[P.mode]; ctx.lineWidth = 3; ctx.strokeText(mn, W - 50, 64); ctx.fillText(mn, W - 50, 64);
        }
        if (bestFlash > 0 && !P.alive) { ctx.font = '900 ' + Math.round(Math.min(56, W / 10)) + 'px system-ui'; ctx.fillStyle = '#facc15'; ctx.lineWidth = 7; ctx.strokeText('NEW BEST! ' + (save.best[L.n] | 0) + '%', W / 2, H * 0.4); ctx.fillText('NEW BEST! ' + (save.best[L.n] | 0) + '%', W / 2, H * 0.4); }
        if (P.won) { ctx.font = '900 ' + Math.round(Math.min(70, W / 8)) + 'px system-ui'; ctx.fillStyle = '#4ade80'; ctx.lineWidth = 8; ctx.strokeText('LEVEL COMPLETE!', W / 2, H * 0.4); ctx.fillText('LEVEL COMPLETE!', W / 2, H * 0.4); }
      }
    }

    /* ---------- input ---------- */
    function down() {
      ensureAudio();
      if (mode !== 'play' || paused) return;
      if (!seq && !muted && P && P.alive) startMusic(L);
      held = true; jumpPress();
    }
    function up() { held = false; }
    function onPD(e) { if (e.button > 0) return; e.preventDefault(); try { root.focus({ preventScroll: true }); } catch (er) { } down(); }
    var JK = { ' ': 1, arrowup: 1, w: 1, spacebar: 1 };
    function onKD(e) {
      var k = (e.key || '').toLowerCase();
      if (JK[k]) { if (mode === 'play') e.preventDefault(); if (!e.repeat) down(); return; }
      if (e.repeat) return;
      if (k === 'r') { if (mode === 'play') restart(); }
      else if (k === 'escape') { if (mode === 'play') togglePause(); else if (curScreen && curScreen !== 'title' && curScreen !== 'main') show('main'); }
      else if (k === 'm') setMute(!muted);
      else if (k === 'f') toggleFS();
      else if (k === 'p' && mode === 'play') { practice = !practice; checkpoints = []; restart(); }
      else if (k === 'enter' && curScreen === 'title') show('main');
    }
    function onKU(e) { var k = (e.key || '').toLowerCase(); if (JK[k]) up(); }
    function onBlur() { held = false; }
    function onUnload() { persist(); }
    function onFs() { resize(); setTimeout(resize, 150); }
    function toggleFS() { try { var fe = document.fullscreenElement || document.webkitFullscreenElement; if (fe) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { var rq = root.requestFullscreen || root.webkitRequestFullscreen; if (rq) rq.call(root); } } catch (e) { } }
    function togglePause() { if (mode !== 'play') return; paused = !paused; if (paused) { held = false; stopMusic(); show('pause'); } else { hideScreen(); if (P && P.alive) startMusic(L); } }
    function onCtx(e) { e.preventDefault(); }
    canvas.addEventListener('pointerdown', onPD); canvas.addEventListener('contextmenu', onCtx);
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU); window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize); window.addEventListener('beforeunload', onUnload);
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h]'); if (!b) return; ensureAudio(); sfx('click');
      var h = b.getAttribute('data-h');
      if (h === 'fs') toggleFS(); else if (h === 'mute') setMute(!muted); else if (h === 'restart') restart(); else if (h === 'menu') togglePause();
      b.blur();
    });

    /* ---------- screens ---------- */
    function hideScreen() { scr.style.display = 'none'; scr.innerHTML = ''; curScreen = ''; updateHud(); }
    function show(name) { curScreen = name; scr.style.display = 'block'; scr.innerHTML = '<div class="pd-pn">' + SCREENS[name]() + '</div>'; scr.scrollTop = 0; updateHud(); if (name === 'custom') paintPreview(); }
    function paintPreview() {
      var cv = scr.querySelector('canvas[data-prev]'); if (!cv) return; cv.width = 500; cv.height = 90; var g = cv.getContext('2d');
      ['hop', 'jet', 'ball', 'zig', 'spider'].forEach(function (m, i) { g.save(); g.translate(50 + i * 100, 45); g.scale(1.6, 1.6); drawPlayer(g, m, 0, 0, 0, COLORS[save.color1], COLORS[save.color2], save.shape, 0.3, 1); g.restore(); });
    }
    var SCREENS = {
      title: function () {
        return '<div class="pd-h1">PULSE <span>DASH</span></div><div style="text-align:center;opacity:.85;margin:8px 0 16px;font-weight:700">1000 levels. One button. Zero mercy.</div>' +
          '<div class="pd-card" style="max-width:640px;margin:0 auto"><div class="pd-h2">How to Play</div><div style="line-height:2;font-size:14px">' +
          '<div><span class="pd-k">Click</span><span class="pd-k">Space</span><span class="pd-k">↑ / W</span><span class="pd-k">Tap</span> the only button. What it does depends on your mode:</div>' +
          '<div>■ <b style="color:#22d3ee">Hopper</b> jump (hold to keep jumping) · ➤ <b style="color:#f472b6">Jet</b> hold to fly up · ● <b style="color:#fb923c">Roller</b> tap to flip gravity</div>' +
          '<div>▲ <b style="color:#4ade80">Zig</b> hold to zig up, release to zag down · 🕷 <b style="color:#a78bfa">Spider</b> tap to snap to the other side instantly</div>' +
          '<div>Yellow orbs: tap in mid-air to jump again · Pink pads launch you · Speed portals: &lt; &gt;&gt; &gt;&gt;&gt;</div>' +
          '<div><span class="pd-k">R</span> Restart · <span class="pd-k">P</span> Practice mode (checkpoints) · <span class="pd-k">Esc</span> Pause · <span class="pd-k">M</span> Mute · <span class="pd-k">F</span> Fullscreen</div></div>' +
          '<div style="font-size:13px;opacity:.8;margin-top:8px">Your best % for every level is saved automatically. Beat a level (100%) to unlock more. Difficulty climbs from Easy to Demon.</div>' +
          '<div class="pd-row" style="margin-top:14px"><button class="pd-b big" data-a="main">▶ PLAY</button></div></div>';
      },
      main: function () {
        var nxt = Math.min(unlockedTo(), furthest() + 1), df = diffOf(nxt);
        return '<div class="pd-h1">PULSE <span>DASH</span></div>' +
          '<div class="pd-card" style="max-width:520px;margin:16px auto;text-align:center"><div style="font-weight:900;color:' + df.c + '">' + df.n.toUpperCase() + '</div><div style="font-size:38px;font-weight:900">Level ' + nxt + '</div>' +
          '<div class="pd-bar" style="margin:8px 0"><i style="width:' + (save.best[nxt] | 0) + '%"></i></div><div style="font-size:13px;opacity:.8">Best ' + (save.best[nxt] | 0) + '% · ' + (save.att[nxt] | 0) + ' attempts</div>' +
          '<div class="pd-row" style="margin-top:12px"><button class="pd-b big" data-a="lvl" data-v="' + nxt + '">▶ PLAY</button></div></div>' +
          '<div class="pd-row"><button class="pd-b c" data-a="levels">🗺 Levels</button><button class="pd-b p" data-a="custom">🎨 Icons</button><button class="pd-b y" data-a="title">❔ How to Play</button></div>' +
          '<div style="text-align:center;margin-top:14px;font-size:13px;opacity:.85">' + completed() + ' / ' + NLV + ' complete · ' + save.attempts + ' attempts · ' + save.jumps + ' jumps · Playtime ' + fmtTime(gPT) + ' · Auto-saved ✔</div>';
      },
      levels: function () {
        var pg = save.page, un = unlockedTo(), h = '<div class="pd-row" style="justify-content:space-between;margin-bottom:10px"><button class="pd-b s" data-a="main">⬅ Back</button><div class="pd-h2" style="margin:0">Levels ' + (pg * 50 + 1) + '–' + (pg * 50 + 50) + '</div>' +
          '<div class="pd-row"><button class="pd-b s" data-a="page" data-v="' + (pg - 1) + '"' + (pg > 0 ? '' : ' disabled') + '>◀</button><button class="pd-b s" data-a="page" data-v="' + (pg + 1) + '"' + (pg < 19 ? '' : ' disabled') + '>▶</button></div></div>' +
          '<div class="pd-row" style="margin-bottom:10px">';
        for (var i = 0; i < DIFFS.length; i++) { var startN = i ? DIFFS[i - 1].to + 1 : 1; h += '<button class="pd-b s" style="padding:5px 9px;font-size:12px;color:' + DIFFS[i].c + '" data-a="page" data-v="' + Math.floor((startN - 1) / 50) + '">' + DIFFS[i].n + '</button>'; }
        h += '</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:7px">';
        for (var n = pg * 50 + 1; n <= pg * 50 + 50; n++) {
          var b = save.best[n] | 0, df = diffOf(n), lk = n > un;
          h += '<button class="pd-lv" style="background:' + (b >= 100 ? '#166534' : 'rgba(0,0,0,.45)') + ';border-color:' + (lk ? '#000' : df.c) + '" data-a="lvl" data-v="' + n + '"' + (lk ? ' disabled' : '') + '>' + (lk ? '🔒' : n) + '<small style="color:' + df.c + '">' + df.n + '</small><small>' + (lk ? '' : b >= 100 ? '✔ 100%' : b + '%') + '</small></button>';
        }
        return h + '</div>';
      },
      custom: function () {
        var c = completed(), h = '<div class="pd-row" style="justify-content:space-between;margin-bottom:10px"><button class="pd-b s" data-a="main">⬅ Back</button><div class="pd-h2" style="margin:0">Icons</div><span></span></div>' +
          '<div class="pd-card" style="text-align:center"><canvas data-prev style="width:100%;max-width:500px;height:90px"></canvas>';
        h += '<div style="margin:8px 0 4px;font-weight:800">Main color</div><div class="pd-row">';
        COLORS.forEach(function (col, i) { var req = i * 6; h += '<button class="pd-sw' + (save.color1 === i ? ' on' : '') + '" style="background:' + col + '" data-a="c1" data-v="' + i + '"' + (c >= req ? '' : ' disabled title="Complete ' + req + ' levels"') + '></button>'; });
        h += '</div><div style="margin:8px 0 4px;font-weight:800">Second color</div><div class="pd-row">';
        COLORS.forEach(function (col, i) { var req = i * 6; h += '<button class="pd-sw' + (save.color2 === i ? ' on' : '') + '" style="background:' + col + '" data-a="c2" data-v="' + i + '"' + (c >= req ? '' : ' disabled') + '></button>'; });
        h += '</div><div style="margin:8px 0 4px;font-weight:800">Hopper design</div><div class="pd-row">';
        SHAPES.forEach(function (s, i) { var req = i * 15; h += '<button class="pd-b ' + (save.shape === i ? 'y' : 's') + '" data-a="shape" data-v="' + i + '"' + (c >= req ? '' : ' disabled') + '>' + s + (c >= req ? '' : ' 🔒' + req) + '</button>'; });
        return h + '</div><div style="font-size:12px;opacity:.7;margin-top:8px">Unlock more colors and designs by completing levels.</div></div>';
      },
      pause: function () {
        return '<div class="pd-card" style="max-width:420px;margin:30px auto;text-align:center"><div class="pd-h2">Paused</div><div style="opacity:.8;margin-bottom:10px">Level ' + L.n + ' · ' + diffOf(L.n).n + ' · Best ' + (save.best[L.n] | 0) + '%</div>' +
          '<div style="display:grid;gap:8px"><button class="pd-b big" data-a="resume">▶ Resume</button><button class="pd-b y" data-a="restart">↻ Restart</button>' +
          '<button class="pd-b ' + (practice ? 'p' : 'c') + '" data-a="practice">' + (practice ? 'Exit Practice' : 'Practice Mode') + '</button><button class="pd-b s" data-a="tomain">🏠 Menu</button></div></div>';
      },
      done: function () {
        return '<div class="pd-card" style="max-width:440px;margin:30px auto;text-align:center"><div class="pd-h1" style="font-size:44px;color:#4ade80">COMPLETE!</div>' +
          '<div style="font-size:18px;font-weight:800;margin:6px 0">Level ' + L.n + ' · ' + diffOf(L.n).n + '</div><div style="opacity:.85">' + (practice ? 'Practice run finished. Now beat it in normal mode!' : 'Beaten in ' + attempt + ' attempts') + '</div>' +
          '<div class="pd-row" style="margin-top:14px">' + (L.n < NLV ? '<button class="pd-b big" data-a="lvl" data-v="' + Math.min(unlockedTo(), L.n + 1) + '">Next ▶</button>' : '') + '<button class="pd-b y" data-a="lvl" data-v="' + L.n + '">↻ Replay</button><button class="pd-b s" data-a="tomain">Menu</button></div></div>';
      }
    };
    scr.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b || b.disabled) return; ensureAudio(); sfx('click');
      var a = b.getAttribute('data-a'), v = parseInt(b.getAttribute('data-v'), 10);
      if (a === 'main' || a === 'tomain') { if (mode === 'play') toMenu('main'); else show('main'); }
      else if (a === 'title') show('title'); else if (a === 'levels') { save.page = Math.floor((Math.min(unlockedTo(), furthest() + 1) - 1) / 50); show('levels'); }
      else if (a === 'page') { save.page = clamp(v, 0, 19); persist(); show('levels'); }
      else if (a === 'lvl') { practice = false; playLevel(v); }
      else if (a === 'custom') show('custom');
      else if (a === 'c1') { save.color1 = v; persist(); show('custom'); } else if (a === 'c2') { save.color2 = v; persist(); show('custom'); } else if (a === 'shape') { save.shape = v; persist(); show('custom'); }
      else if (a === 'resume') togglePause(); else if (a === 'restart') restart();
      else if (a === 'practice') { practice = !practice; checkpoints = []; restart(); }
    });

    /* ---------- loop ---------- */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; wallT += dt;
      if (!document.hidden) { gPT += dt; ptFlush += dt; if (ptFlush > 10) { ptFlush = 0; persist(); } }
      tickMusic();
      if (seq && actx) { var since = actx.currentTime - seq.beatT; pulse = since >= 0 && since < 0.2 ? 1 - since / 0.2 : 0; } else pulse *= 0.9;
      for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; if (p.life <= 0) parts.splice(i, 1); }
      if (bestFlash > 0) bestFlash -= dt;
      if (mode === 'play' && L && P) {
        if (!paused) {
          var n = Math.min(8, Math.ceil(dt / (1 / 240))), sdt = dt / n;
          for (var k = 0; k < n; k++) step(sdt);
          if (deadT > 0) { deadT -= dt; if (deadT <= 0) { attempt++; spawn(false); } }
          if (winT > 0) { winT -= dt; if (winT <= 0) { mode = 'menu'; stopMusic(); show('done'); } }
        }
        render(L, P.x, true);
      } else {
        if (!menuL) menuL = genLevel(1 + Math.floor(Math.random() * 40));
        menuX += dt * BASEV; if (menuX > menuL.finishX) { menuX = 0; menuL = genLevel(1 + Math.floor(Math.random() * 200)); }
        render(menuL, menuX, false);
      }
    }
    var auto = setInterval(persist, 15000);
    resize(); setMute(muted); show('title'); raf = requestAnimationFrame(frame);
    try { Object.defineProperty(root, '__pd', { value: { st: function () { return { P: P, L: L, save: save, mode: mode }; }, play: playLevel, step: function (dt) { step(dt); }, hold: function (v) { held = v; pressBuf = v ? 0.12 : 0; } } }); } catch (e) { }

    return function cleanup() {
      try { persist(); } catch (e) { }
      cancelAnimationFrame(raf); clearInterval(auto); stopMusic();
      canvas.removeEventListener('pointerdown', onPD); canvas.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', onKD); window.removeEventListener('keyup', onKU); window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize); window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      if (ro) ro.disconnect();
      try { if (document.fullscreenElement === root) document.exitFullscreen(); } catch (e) { }
      try { if (actx) actx.close(); } catch (e) { }
      if (root.parentNode) root.parentNode.removeChild(root); if (style.parentNode) style.parentNode.removeChild(style);
    };
  }

  window.ARCADE_GAMES = window.ARCADE_GAMES || [];
  window.ARCADE_GAMES.push({
    id: GID,
    title: TITLE,
    description: 'One-button rhythm runner with 1000 brutal levels, five modes and percentage progress.',
    category: 'Platformer',
    icon: createGameIcon(),
    bannerGradient: 'linear-gradient(135deg, #1e1b4b 0%, #0891b2 100%)',
    controls: ['Click / Space / ↑ / Tap — Jump, fly, flip or snap', 'Hold — Keep jumping / fly up / zig up', 'P — Practice mode', 'R Key — Restart', 'Esc — Pause · M — Mute · F — Fullscreen'],
    start: function (container) { return startGame(container); }
  });
})();
