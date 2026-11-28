/* =====================================================================
   FLIPSIDE DASH - an original one-button gravity-flip auto-runner
   2,000 seeded levels - 20 worlds - 62 runners - capsules - upgrades
   quests - rebirth - 3-slot save manager with JSON export/import
   ===================================================================== */
(function () {
  'use strict';

  var MAX_LEVEL = 2000;

  /* ------------------------------------------------------------------ */
  /*  Shared utilities                                                   */
  /* ------------------------------------------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(i, s) {
    var h = Math.imul((i | 0) ^ Math.imul(s | 0, 374761393), 668265263);
    h = h ^ (h >>> 13); h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return String(n);
    var u = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    var i = -1;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + u[i];
  }
  function fmtTime(s) {
    s = Math.floor(s || 0);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    if (m > 0) return m + 'm ' + (sec < 10 ? '0' : '') + sec + 's';
    return sec + 's';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function line(g, a, b, c, d) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  function colorOf(c, t, off) {
    if (c === 'rainbow') return 'hsl(' + Math.floor((t * 140 + (off || 0)) % 360) + ',90%,62%)';
    if (c === 'glitch') { var k = (Math.floor(t * 20) + (off | 0)) % 3; return k === 0 ? '#f43f5e' : k === 1 ? '#22d3ee' : '#4ade80'; }
    if (c === 'fire') return ['#f97316', '#fde047', '#ef4444'][(Math.floor(t * 18) + (off | 0)) % 3];
    if (c === 'spark') return ['#fde047', '#ffffff', '#67e8f9'][(Math.floor(t * 18) + (off | 0)) % 3];
    if (c === 'pixel') return ['#22d3ee', '#a78bfa', '#f472b6'][(Math.floor(t * 8) + (off | 0)) % 3];
    return c;
  }

  var TIERS = [
    { n: 'Common', c: '#cbd5e1', frag: 2 },
    { n: 'Rare', c: '#38bdf8', frag: 3 },
    { n: 'Epic', c: '#c084fc', frag: 5 },
    { n: 'Legendary', c: '#fbbf24', frag: 8 },
    { n: 'Mythic', c: '#fb7185', frag: 12 },
    { n: 'Secret', c: '#22d3ee', frag: 0 }
  ];
  var TMULT = [1, 1.5, 2.2, 3, 4.5, 6];
  var STAR_COST = [0, 5, 10, 20, 40];

  function makeBiomes(rows) {
    return rows.map(function (b) {
      var h = b[1], r = parseInt(h.substr(1, 2), 16), gg = parseInt(h.substr(3, 2), 16), bb = parseInt(h.substr(5, 2), 16);
      return { name: b[0], top: b[1], bot: b[2], acc: b[3], far: b[4], near: b[5], style: b[6], hz: b[7], dark: (r * 0.3 + gg * 0.59 + bb * 0.11) < 70 };
    });
  }

  // Generic layered background used by side-scrolling games
  function drawBackdrop(ctx, B, camX, camY, W, H, t) {
    var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, B.top); gr.addColorStop(1, B.bot);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    var i;
    if (B.dark) {
      ctx.fillStyle = '#fff';
      for (i = 0; i < 90; i++) {
        var sx = ((hash2(i, 77) * W * 1.5 - camX * 0.03) % W + W) % W, sy = hash2(i, 91) * H * 0.75;
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + hash2(i, 5)) + i));
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    var unit = H / 900;
    var layers = [[B.far, 0.12, 0.66, 1.0, 11], [B.near, 0.3, 0.84, 1.25, 23]];
    for (var li = 0; li < 2; li++) {
      var col = layers[li][0], f = layers[li][1], yb = H * layers[li][2] - clamp(camY, -300, 300) * f * unit * 0.6, sc = layers[li][3] * unit, seed = layers[li][4] + B.hz;
      ctx.fillStyle = col;
      var tw = 170 * sc, off = camX * f * unit * 1.2;
      var i0 = Math.floor(off / tw) - 1, i1 = i0 + Math.ceil(W / tw) + 2, h, x;
      if (B.style === 'waves') {
        ctx.beginPath(); ctx.moveTo(0, H);
        for (x = 0; x <= W + 20; x += 20) ctx.lineTo(x, yb + Math.sin((x + off) * 0.012 + t * (li + 1) * 0.6) * 18 * sc + Math.sin((x + off) * 0.031) * 8 * sc);
        ctx.lineTo(W, H); ctx.fill();
        continue;
      }
      ctx.fillRect(0, yb, W, H - yb + 2);
      for (i = i0; i <= i1; i++) {
        h = hash2(i, seed); x = i * tw - off;
        var hh = (30 + h * 120) * sc;
        ctx.beginPath();
        switch (B.style) {
          case 'hills': ctx.ellipse(x + tw / 2, yb + 4, tw * 0.85, hh * 0.6, 0, Math.PI, 0); break;
          case 'dunes': ctx.ellipse(x + tw / 2, yb + 4, tw * 1.1, hh * 0.35, 0, Math.PI, 0); break;
          case 'city':
            ctx.rect(x + tw * 0.08, yb - hh * 1.2, tw * 0.75, hh * 1.2 + 2);
            if (hash2(i, seed + 3) > 0.5) ctx.rect(x + tw * 0.35, yb - hh * 1.2 - 30 * sc, 4 * sc, 30 * sc);
            break;
          case 'peaks': ctx.moveTo(x - tw * 0.3, yb + 2); ctx.lineTo(x + tw * 0.5, yb - hh * 1.3); ctx.lineTo(x + tw * 1.3, yb + 2); break;
          case 'crystals': ctx.moveTo(x + tw * 0.3, yb + 2); ctx.lineTo(x + tw * 0.45, yb - hh * 1.4); ctx.lineTo(x + tw * 0.6, yb + 2); ctx.moveTo(x + tw * 0.55, yb + 2); ctx.lineTo(x + tw * 0.75, yb - hh * 0.8); ctx.lineTo(x + tw * 0.9, yb + 2); break;
          case 'trees': ctx.rect(x + tw * 0.45, yb - hh * 0.5, tw * 0.08, hh * 0.5 + 2); ctx.moveTo(x + tw * 0.15, yb - hh * 0.4); ctx.lineTo(x + tw * 0.49, yb - hh * 1.3); ctx.lineTo(x + tw * 0.83, yb - hh * 0.4); break;
          case 'grid':
            ctx.rect(x + tw * 0.1, yb - hh, tw * 0.3, hh + 2); ctx.rect(x + tw * 0.5, yb - hh * 0.6, tw * 0.35, hh * 0.6 + 2); break;
          case 'clouds':
            ctx.ellipse(x + tw / 2, yb + 4, tw * 0.8, hh * 0.4, 0, Math.PI, 0);
            ctx.moveTo(x + tw * 0.9, H * 0.2 + h * 120 * sc);
            ctx.arc(x + tw * 0.6, H * 0.18 + h * 120 * sc, 26 * sc, 0, 7); ctx.arc(x + tw * 0.85, H * 0.18 + h * 120 * sc, 34 * sc, 0, 7);
            break;
          default:
            ctx.moveTo(x - tw * 0.2, yb + 2); ctx.lineTo(x + tw * 0.4, yb - hh * 0.6); ctx.lineTo(x + tw * 1.1, yb + 2);
            if (li === 0 && h > 0.8) { ctx.moveTo(x + tw * 0.5 + 30 * sc, H * 0.25); ctx.arc(x + tw * 0.5, H * 0.25, 30 * sc * h, 0, 7); }
        }
        ctx.fill();
        if ((B.style === 'city' || B.style === 'grid') && li === 1) {
          ctx.fillStyle = B.acc; ctx.globalAlpha = 0.5;
          for (var wy = 0; wy < 5; wy++) for (var wx = 0; wx < 3; wx++) if (hash2(i * 31 + wy * 3 + wx, seed) > 0.55) ctx.fillRect(x + tw * (0.18 + wx * 0.22), yb - hh + 10 * sc + wy * 18 * sc, 6 * sc, 8 * sc);
          ctx.globalAlpha = 1; ctx.fillStyle = col;
        }
      }
    }
  }

  /* ================================================================== */
  /*  FLIPSIDE DASH: one-button gravity-flip auto-runner                 */
  /* ================================================================== */
  var GID = 'flipside-dash';
  var TITLE = 'Flipside Dash';
  var GR = 3000;      // gravity
  var PH = 15;        // player half size

  var BIOMES = makeBiomes([
    ['Pixel Plains', '#38bdf8', '#bbf7d0', '#22c55e', '#86efac', '#15803d', 'hills', 196],
    ['Neon Highway', '#0f0326', '#6d28d9', '#f0abfc', '#3b0764', '#1e1b4b', 'city', 220],
    ['Bubble Bay', '#22d3ee', '#cffafe', '#0ea5e9', '#67e8f9', '#0891b2', 'waves', 262],
    ['Sunset Canyon', '#fb923c', '#fde68a', '#c2410c', '#fdba74', '#9a3412', 'dunes', 174],
    ['Glacier Run', '#bae6fd', '#f0f9ff', '#0284c7', '#e0f2fe', '#7dd3fc', 'peaks', 246],
    ['Magma Mines', '#450a0a', '#ea580c', '#fbbf24', '#7f1d1d', '#431407', 'crystals', 110],
    ['Jungle Ruins', '#14532d', '#86efac', '#facc15', '#166534', '#052e16', 'trees', 130],
    ['Cloud Circuit', '#f9a8d4', '#fef9c3', '#ec4899', '#fbcfe8', '#f472b6', 'clouds', 294],
    ['Deep Sea Lab', '#020617', '#0c4a6e', '#22d3ee', '#0f172a', '#082f49', 'grid', 98],
    ['Clockwork Tower', '#44403c', '#d6d3d1', '#f59e0b', '#78716c', '#292524', 'city', 147],
    ['Prism Caves', '#1e1b4b', '#7c3aed', '#c4b5fd', '#312e81', '#1e1b4b', 'crystals', 330],
    ['Lantern Festival', '#7f1d1d', '#fca5a5', '#fde047', '#991b1b', '#450a0a', 'city', 277],
    ['Thunder Road', '#1e293b', '#64748b', '#facc15', '#334155', '#0f172a', 'peaks', 123],
    ['Data Stream', '#000000', '#0f172a', '#4ade80', '#052e16', '#020617', 'grid', 185],
    ['Spooky Manor', '#1c1917', '#4c1d95', '#a3e635', '#292524', '#0c0a09', 'trees', 138],
    ['Solar Forge', '#7c2d12', '#fde047', '#fff7ed', '#ea580c', '#9a3412', 'dunes', 233],
    ['Bitcrush Zone', '#111827', '#be123c', '#22d3ee', '#1f2937', '#450a0a', 'grid', 311],
    ['Polar Lights', '#042f2e', '#0d9488', '#a7f3d0', '#134e4a', '#022c22', 'peaks', 349],
    ['Starlight Rail', '#1e1b4b', '#be185d', '#f0abfc', '#3730a3', '#1e1b4b', 'stars', 165],
    ['Infinity Core', '#000000', '#312e81', '#fde68a', '#1e1b4b', '#0b0b1e', 'stars', 392]
  ]);

  // id, name, tier, body, edge, shape, face, accessory, trail, aura
  var CHAR_ROWS = [
    ['cubey', 'Cubey', 0, '#22d3ee', '#0e7490', 'cube', 'smile', 'none', '#67e8f9', ''],
    ['rosy', 'Rosy', 0, '#fb7185', '#9f1239', 'cube', 'grin', 'bow', '#fda4af', ''],
    ['limey', 'Limey', 0, '#a3e635', '#3f6212', 'orb', 'smile', 'none', '#bef264', ''],
    ['sunblock', 'Sun Block', 0, '#facc15', '#a16207', 'cube', 'wink', 'none', '#fde047', ''],
    ['plum', 'Plum', 0, '#a855f7', '#581c87', 'orb', 'sleepy', 'none', '#d8b4fe', ''],
    ['mintcube', 'Mint Cube', 0, '#34d399', '#065f46', 'cube', 'smile', 'cap', '#6ee7b7', ''],
    ['tangy', 'Tangy', 0, '#fb923c', '#9a3412', 'tri', 'grin', 'none', '#fdba74', ''],
    ['slate', 'Slate', 0, '#94a3b8', '#334155', 'cube', 'cool', 'none', '#cbd5e1', ''],
    ['bubbles', 'Bubbles', 0, '#f472b6', '#9d174d', 'blob', 'smile', 'none', '#f9a8d4', ''],
    ['pebble', 'Pebble', 0, '#a8a29e', '#44403c', 'orb', 'sleepy', 'none', '#d6d3d1', ''],
    ['skybox', 'Sky Box', 0, '#38bdf8', '#075985', 'cube', 'wink', 'cap', '#7dd3fc', ''],
    ['cherry', 'Cherry', 0, '#ef4444', '#7f1d1d', 'orb', 'grin', 'leaf', '#fca5a5', ''],
    ['moss', 'Moss', 0, '#65a30d', '#1a2e05', 'hex', 'smile', 'none', '#a3e635', ''],
    ['toast', 'Toast', 0, '#d97706', '#78350f', 'cube', 'smile', 'none', '#fbbf24', ''],
    ['snowball', 'Snowball', 0, '#f1f5f9', '#94a3b8', 'orb', 'smile', 'none', '#e2e8f0', ''],
    ['inky', 'Inky', 0, '#334155', '#94a3b8', 'cube', 'angry', 'none', '#64748b', ''],
    ['robocube', 'Robo Cube', 1, '#9ca3af', '#374151', 'robot', 'visor', 'antenna', '#f87171', ''],
    ['ghosty', 'Ghosty', 1, '#e2e8f0', '#64748b', 'ghost', 'smile', 'none', '#cbd5e1', ''],
    ['kitty', 'Kitty', 1, '#fb923c', '#7c2d12', 'cat', 'smile', 'none', '#fdba74', ''],
    ['hexknight', 'Hex Knight', 1, '#64748b', '#0f172a', 'hex', 'angry', 'horns', '#94a3b8', ''],
    ['diamonddan', 'Diamond Dan', 1, '#67e8f9', '#0e7490', 'diamond', 'cool', 'none', '#a5f3fc', ''],
    ['starpup', 'Star Pup', 1, '#fde047', '#a16207', 'star', 'smile', 'none', '#fef08a', ''],
    ['ufobob', 'UFO Bob', 1, '#4ade80', '#14532d', 'ufo', 'cyclops', 'none', '#86efac', ''],
    ['spike', 'Spike', 1, '#f43f5e', '#4c0519', 'tri', 'angry', 'none', '#fb7185', ''],
    ['jelly', 'Jelly', 1, '#2dd4bf', '#115e59', 'blob', 'wink', 'none', '#5eead4', ''],
    ['pixelpete', 'Pixel Pete', 1, '#818cf8', '#312e81', 'cube', 'grin', 'cap', 'pixel', ''],
    ['discoball', 'Disco Ball', 1, '#e5e7eb', '#6b7280', 'orb', 'cool', 'none', '#f0abfc', ''],
    ['lavalamp', 'Lava Lamp', 1, '#f97316', '#7c2d12', 'blob', 'sleepy', 'none', '#fb923c', ''],
    ['frosty', 'Frosty', 1, '#bae6fd', '#0369a1', 'hex', 'sleepy', 'none', '#e0f2fe', ''],
    ['bolt', 'Bolt', 1, '#facc15', '#713f12', 'diamond', 'angry', 'none', 'spark', ''],
    ['neoncyclops', 'Neon Cyclops', 2, '#d946ef', '#4a044e', 'orb', 'cyclops', 'none', '#f0abfc', '#d946ef'],
    ['skullcube', 'Skull Cube', 2, '#f8fafc', '#334155', 'skull', 'x', 'none', '#e2e8f0', '#94a3b8'],
    ['embercat', 'Ember Cat', 2, '#ea580c', '#431407', 'cat', 'angry', 'none', 'fire', '#f97316'],
    ['crystalcore', 'Crystal Core', 2, '#a78bfa', '#4c1d95', 'diamond', 'visor', 'none', '#c4b5fd', '#a78bfa'],
    ['voltbot', 'Voltbot', 2, '#fde047', '#1e293b', 'robot', 'visor', 'antenna', 'spark', '#fde047'],
    ['phantom', 'Phantom', 2, '#a5b4fc', '#312e81', 'ghost', 'x', 'none', 'glitch', '#818cf8'],
    ['magmahex', 'Magma Hex', 2, '#b91c1c', '#fbbf24', 'hex', 'angry', 'horns', 'fire', '#f97316'],
    ['prismstar', 'Prism Star', 2, '#f0abfc', '#86198f', 'star', 'wink', 'none', 'spark', '#f0abfc'],
    ['toxicblob', 'Toxic Blob', 2, '#84cc16', '#1a2e05', 'blob', 'cyclops', 'none', '#bef264', '#a3e635'],
    ['shadowcube', 'Shadow Cube', 2, '#18181b', '#a78bfa', 'cube', 'angry', 'none', '#7c3aed', '#7c3aed'],
    ['saucerking', 'Saucer King', 2, '#94a3b8', '#22d3ee', 'ufo', 'cyclops', 'crown', '#22d3ee', ''],
    ['arcadeghost', 'Arcade Ghost', 2, '#f472b6', '#831843', 'ghost', 'smile', 'none', 'pixel', '#f472b6'],
    ['goldencube', 'Golden Cube', 3, '#fbbf24', '#78350f', 'cube', 'cool', 'crown', '#fde047', '#fbbf24'],
    ['dragoneye', 'Dragon Eye', 3, '#16a34a', '#fde047', 'diamond', 'cyclops', 'horns', 'fire', '#22c55e'],
    ['thunderstar', 'Thunder Star', 3, '#60a5fa', '#fde047', 'star', 'angry', 'none', 'spark', '#60a5fa'],
    ['frosttitan', 'Frost Titan', 3, '#e0f2fe', '#0284c7', 'hex', 'visor', 'crown', '#bae6fd', '#67e8f9'],
    ['royalkitty', 'Royal Kitty', 3, '#f9a8d4', '#831843', 'cat', 'wink', 'crown', '#fbcfe8', '#f472b6'],
    ['mechacore', 'Mecha Core', 3, '#475569', '#ef4444', 'robot', 'visor', 'antenna', '#ef4444', '#ef4444'],
    ['infernoskull', 'Inferno Skull', 3, '#1c1917', '#f97316', 'skull', 'x', 'horns', 'fire', '#f97316'],
    ['nebulaorb', 'Nebula Orb', 3, '#7c3aed', '#f0abfc', 'orb', 'sleepy', 'halo', '#c084fc', '#a855f7'],
    ['oceanspirit', 'Ocean Spirit', 3, '#22d3ee', '#164e63', 'ghost', 'smile', 'halo', '#67e8f9', '#22d3ee'],
    ['rainbowprism', 'Rainbow Prism', 4, 'rainbow', '#ffffff', 'diamond', 'grin', 'halo', 'rainbow', '#f472b6'],
    ['blackhole', 'Black Hole', 4, '#000000', '#a855f7', 'orb', 'cyclops', 'none', '#a855f7', '#a855f7'],
    ['glitchcube', 'Glitch Cube', 4, 'glitch', '#111827', 'cube', 'x', 'none', 'glitch', '#4ade80'],
    ['seraphstar', 'Seraph Star', 4, '#fef9c3', '#fbbf24', 'star', 'smile', 'halo', 'spark', '#fde68a'],
    ['chronohex', 'Chrono Hex', 4, '#14b8a6', '#042f2e', 'hex', 'cyclops', 'antenna', '#5eead4', '#14b8a6'],
    ['cosmickitty', 'Cosmic Kitty', 4, '#312e81', '#f0abfc', 'cat', 'cool', 'crown', 'rainbow', '#c026d3'],
    ['ascendant', 'Ascendant', 5, '#fde68a', '#ffffff', 'diamond', 'visor', 'halo', 'rainbow', '#fde68a'],
    ['paradoxcube', 'Paradox Cube', 5, 'glitch', '#f8fafc', 'cube', 'cyclops', 'crown', 'glitch', '#f472b6'],
    ['architect', 'The Architect', 5, '#22d3ee', '#0f172a', 'robot', 'visor', 'crown', 'spark', '#22d3ee'],
    ['omegaorb', 'Omega Orb', 5, '#000000', '#fbbf24', 'orb', 'cyclops', 'crown', 'rainbow', '#fbbf24'],
    ['founder', 'Quest Founder', 5, '#4ade80', '#14532d', 'star', 'grin', 'crown', '#86efac', '#4ade80']
  ];
  var PERK_CYCLE = ['coin', 'magnet', 'gem', 'guard'];
  var CHARS = CHAR_ROWS.map(function (r, i) {
    return { id: r[0], name: r[1], tier: r[2], c: r[3], c2: r[4], shape: r[5], face: r[6], acc: r[7], tr: r[8], aura: r[9], perk: PERK_CYCLE[i % 4] };
  });
  var CHMAP = {}; CHARS.forEach(function (c) { CHMAP[c.id] = c; });

  var UPG = [
    { k: 'air', n: 'Air Flips', d: 'Flip gravity mid-air once more per run', base: 1500, g: 7, max: 5 },
    { k: 'shield', n: 'Bubble Shields', d: 'Survive one hit (or rescue from a pit) per shield', base: 900, g: 5.5, max: 5 },
    { k: 'magnet', n: 'Coin Magnet', d: '+5 coin pickup radius per level', base: 60, g: 1.3, max: 40 },
    { k: 'coin', n: 'Coin Multiplier', d: '+10% coins per level', base: 150, g: 1.42, max: 150 },
    { k: 'idle', n: 'Idle Coin Generator', d: 'Earns coins per minute, even offline (8h cap)', base: 250, g: 1.5, max: 80 }
  ];
  var PERKS = [
    { k: 'coin', n: 'Ascended Wealth', d: '+25% coins per rank', c: function (l) { return 2 * (l + 1); }, max: 20 },
    { k: 'start', n: 'Head Start', d: 'After Rebirth, start 100 levels further per rank', c: function (l) { return 3 * (l + 1); }, max: 19 },
    { k: 'gem', n: 'Gem Sense', d: '+2% gem drop chance per rank', c: function (l) { return 2 * (l + 1); }, max: 10 },
    { k: 'mag', n: 'Starlight Magnet', d: '+12 permanent magnet radius per rank', c: function (l) { return 2 * (l + 1); }, max: 10 }
  ];
  var QTYPES = {
    flips: { n: 'Flip gravity {g} times', b: 150, rb: 250 },
    tokens: { n: 'Collect {g} star tokens', b: 6, rb: 10 },
    grabbed: { n: 'Grab {g} coins on courses', b: 60, rb: 100 },
    clears: { n: 'Clear {g} levels', b: 8, rb: 10 },
    ndclears: { n: 'Clear {g} levels without dying', b: 4, rb: 6 },
    coinsEarned: { n: 'Earn {g} coins', b: 3000, rb: 5000 },
    stars: { n: 'Earn {g} new stars', b: 8, rb: 12 },
    challenges: { n: 'Clear {g} Challenge/Boss stages', b: 2, rb: 3 }
  };
  var CAPS = [
    { k: 'std', n: 'Standard Capsule', cur: 'coins', cost: 0, odds: [70, 24, 5, 1, 0], col: '#38bdf8' },
    { k: 'sup', n: 'Super Capsule', cur: 'gems', cost: 25, odds: [30, 42, 20, 7, 1], col: '#c084fc' },
    { k: 'myt', n: 'Mythic Capsule', cur: 'gems', cost: 90, odds: [0, 25, 45, 24, 6], col: '#fb7185' }
  ];

  /* ---------- runner character renderer ---------- */
  function shapePath(g, shape, t) {
    var i, a;
    g.beginPath();
    switch (shape) {
      case 'orb': g.arc(0, 0, 15, 0, 7); break;
      case 'tri': g.moveTo(0, -17); g.lineTo(16, 14); g.lineTo(-16, 14); g.closePath(); break;
      case 'hex': for (i = 0; i < 6; i++) { a = i / 6 * 6.283 + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 16.5, Math.sin(a) * 16.5); } g.closePath(); break;
      case 'diamond': g.moveTo(0, -18); g.lineTo(16, 0); g.lineTo(0, 18); g.lineTo(-16, 0); g.closePath(); break;
      case 'star': for (i = 0; i < 10; i++) { a = i / 10 * 6.283 - Math.PI / 2; var r = i % 2 ? 8.5 : 18; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); break;
      case 'ghost': g.moveTo(-15, 15); g.lineTo(-15, -1); g.arc(0, -1, 15, Math.PI, 0); g.lineTo(15, 15);
        for (i = 0; i < 4; i++) g.quadraticCurveTo(15 - i * 7.5 - 3.75, 15 - 6 * ((i + Math.floor(t * 6)) % 2 ? 1 : -1) * 0.5, 15 - (i + 1) * 7.5, 15);
        g.closePath(); break;
      case 'cat': g.moveTo(-15, -9); g.lineTo(-13, -21); g.lineTo(-5, -14); g.lineTo(5, -14); g.lineTo(13, -21); g.lineTo(15, -9); g.lineTo(15, 13); g.quadraticCurveTo(15, 15, 13, 15); g.lineTo(-13, 15); g.quadraticCurveTo(-15, 15, -15, 13); g.closePath(); break;
      case 'blob': for (i = 0; i <= 12; i++) { a = i / 12 * 6.283; var rr = 15 + Math.sin(a * 3 + t * 5) * 1.8; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); break;
      case 'ufo': g.ellipse(0, 5, 18, 8, 0, 0, 7); g.moveTo(10, 2); g.arc(0, 2, 10, 0, Math.PI, true); break;
      case 'skull': g.arc(0, -3, 14, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(8, 15); g.lineTo(-8, 15); g.closePath(); break;
      default: // cube / robot
        g.moveTo(-15 + 5, -15); g.lineTo(15 - 5, -15); g.quadraticCurveTo(15, -15, 15, -10); g.lineTo(15, 10); g.quadraticCurveTo(15, 15, 10, 15);
        g.lineTo(-10, 15); g.quadraticCurveTo(-15, 15, -15, 10); g.lineTo(-15, -10); g.quadraticCurveTo(-15, -15, -10, -15); g.closePath();
    }
  }
  function drawFace(g, face, c2, t) {
    var blink = (Math.floor(t * 0.7) % 5 === 0 && (t * 0.7) % 1 < 0.12);
    function eyes(r) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-5.5, -3, r, 0, 7); g.arc(5.5, -3, r, 0, 7); g.fill();
      g.fillStyle = '#0f172a'; g.beginPath(); g.arc(-4.5, -3, r * 0.5, 0, 7); g.arc(6.5, -3, r * 0.5, 0, 7); g.fill();
    }
    g.lineCap = 'round'; g.strokeStyle = '#0f172a'; g.lineWidth = 2;
    switch (face) {
      case 'none': return;
      case 'grin': eyes(3.4); g.fillStyle = '#0f172a'; g.beginPath(); g.arc(0, 4, 6, 0, Math.PI); g.fill(); g.fillStyle = '#fff'; g.fillRect(-4, 4, 8, 2); break;
      case 'wink': g.fillStyle = '#fff'; g.beginPath(); g.arc(5.5, -3, 3.4, 0, 7); g.fill(); g.fillStyle = '#0f172a'; g.beginPath(); g.arc(6.5, -3, 1.7, 0, 7); g.fill(); line(g, -9, -3, -3, -3); g.beginPath(); g.arc(0, 3, 5, 0.2, Math.PI - 0.2); g.stroke(); break;
      case 'sleepy': line(g, -9, -2, -3, -2); line(g, 3, -2, 9, -2); g.beginPath(); g.arc(0, 5, 2.5, 0, 7); g.stroke(); break;
      case 'angry': eyes(3.2); line(g, -9, -9, -3, -6); line(g, 9, -9, 3, -6); line(g, -4, 6, 4, 6); break;
      case 'cool': g.fillStyle = '#0f172a'; g.fillRect(-11, -7, 22, 6); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-9, -6, 4, 1.5); g.beginPath(); g.arc(0, 4, 4.5, 0.3, Math.PI - 0.3); g.stroke(); break;
      case 'cyclops': g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -2, 7, 0, 7); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(1, -2, 3.8, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(1.5, -2, 1.8, 0, 7); g.fill(); break;
      case 'visor': g.fillStyle = '#0f172a'; g.fillRect(-12, -7, 24, 8); g.fillStyle = c2; g.fillRect(-10 + ((t * 30) % 16), -5, 4, 4); break;
      case 'x': line(g, -8, -6, -3, -1); line(g, -8, -1, -3, -6); line(g, 3, -6, 8, -1); line(g, 3, -1, 8, -6); line(g, -4, 6, 4, 6); break;
      default: if (blink) { line(g, -8, -3, -3, -3); line(g, 3, -3, 8, -3); } else eyes(3.4); g.beginPath(); g.arc(0, 3, 5, 0.2, Math.PI - 0.2); g.stroke();
    }
  }
  function drawAcc(g, acc, c2, t) {
    switch (acc) {
      case 'crown': g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(-10, -15); g.lineTo(-10, -25); g.lineTo(-5, -19); g.lineTo(0, -27); g.lineTo(5, -19); g.lineTo(10, -25); g.lineTo(10, -15); g.closePath(); g.fill(); break;
      case 'halo': g.strokeStyle = '#fde047'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, -25 + Math.sin(t * 3) * 1.5, 11, 3.5, 0, 0, 7); g.stroke(); break;
      case 'horns': g.fillStyle = c2; g.beginPath(); g.moveTo(-12, -13); g.lineTo(-15, -26); g.lineTo(-5, -15); g.fill(); g.beginPath(); g.moveTo(12, -13); g.lineTo(15, -26); g.lineTo(5, -15); g.fill(); break;
      case 'antenna': g.strokeStyle = '#94a3b8'; g.lineWidth = 2; line(g, 0, -15, 3, -25); g.fillStyle = c2; g.beginPath(); g.arc(3, -26, 3, 0, 7); g.fill(); break;
      case 'bow': g.fillStyle = '#ec4899'; g.beginPath(); g.moveTo(6, -15); g.lineTo(0, -21); g.lineTo(0, -12); g.closePath(); g.moveTo(6, -15); g.lineTo(13, -21); g.lineTo(13, -10); g.closePath(); g.fill(); break;
      case 'cap': g.fillStyle = c2; g.beginPath(); g.arc(0, -13, 11, Math.PI, 0); g.fill(); g.fillRect(0, -15, 17, 3.5); break;
      case 'leaf': g.fillStyle = '#16a34a'; g.beginPath(); g.ellipse(5, -19, 6, 2.6, -0.6, 0, 7); g.fill(); break;
    }
  }
  function drawRunner(g, ch, x, y, size, rot, t, sq, flat) {
    var s = size / 30;
    if (ch.aura && !flat) {
      var ar = 30 * s + Math.sin(t * 4) * 3 * s, gr = g.createRadialGradient(x, y, 2, x, y, ar);
      gr.addColorStop(0, ch.aura + '99'); gr.addColorStop(1, ch.aura + '00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, ar, 0, 7); g.fill();
    }
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * (1 + (sq || 0) * 0.28), s * (1 - (sq || 0) * 0.22));
    var c1 = flat ? '#334155' : colorOf(ch.c, t), c2 = flat ? '#475569' : colorOf(ch.c2, t, 90);
    shapePath(g, ch.shape, t);
    g.fillStyle = c1; g.fill();
    g.lineWidth = 3; g.strokeStyle = c2; g.lineJoin = 'round'; g.stroke();
    if (!flat) {
      if (ch.shape === 'robot') { g.fillStyle = c2; g.fillRect(-15, 8, 30, 3); }
      if (ch.shape === 'skull') { g.fillStyle = '#0f172a'; g.fillRect(-5, 9, 2, 5); g.fillRect(-1, 9, 2, 5); g.fillRect(3, 9, 2, 5); }
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-6, -9, 5, 2.5, -0.5, 0, 7); g.fill();
      drawFace(g, ch.face, c2, t);
      drawAcc(g, ch.acc, c2, t);
    }
    g.restore();
  }
  function drawCharPreview(cv, ch, locked, t) {
    var g = cv.getContext('2d'), w = cv.width;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, cv.height);
    g.save(); g.scale(w / 64, w / 64);
    if (!locked) {
      g.globalAlpha = 0.5;
      for (var i = 0; i < 5; i++) { g.fillStyle = colorOf(ch.tr, t, i * 30); g.fillRect(4 + i * 4, 34 - i * 0.5, 4, 6 - i * 0.5); }
      g.globalAlpha = 1;
    }
    drawRunner(g, ch, 34, 36, 30, 0, t || 0.3, 0, locked);
    if (locked) { g.fillStyle = '#e2e8f0'; g.font = 'bold 16px system-ui'; g.textAlign = 'center'; g.fillText('?', 34, 42); }
    g.restore();
  }

  /* ---------- deterministic level generator ---------- */
  function genLevel(n) {
    var R = mulberry32(((n * 2246822519) ^ 0x27d4eb2f) >>> 0);
    var d = (n - 1) / (MAX_LEVEL - 1), biome = Math.min(19, Math.floor((n - 1) / 100));
    var boss = n % 100 === 0, challenge = !boss && n % 10 === 0;
    var Hc = Math.round(lerp(300, 220, d) + (R() - 0.5) * 30);
    var floorY = 480, ceilY = floorY - Hc;
    var v0 = Math.round(lerp(430, 640, d) + (biome % 5) * 8);
    var flight = (-220 + Math.sqrt(220 * 220 + 2 * GR * (Hc - 2 * PH))) / GR; // matches the flip impulse
    var len = (2400 + Math.min(n, 300) * 9 + d * 4200) * (challenge ? 1.3 : 1) * (boss ? 1.8 : 1);
    var L = { n: n, d: d, biome: biome, boss: boss, challenge: challenge, Hc: Hc, floorY: floorY, ceilY: ceilY, v0: v0, flight: flight,
      surf: [[], []], spikes: [], saws: [], portals: [], speeds: [], coins: [], tokens: [], cp: null };
    var v = v0, runs = [], trans = [];
    var cur = { s: 0, a: -700, b: 520 + R() * 160 };
    runs.push(cur);
    while (cur.b < len) {
      var fd = v * flight;
      var w = (lerp(0.72, 0.24, d) + R() * 0.14) * (challenge ? 0.9 : 1) * (boss ? 0.88 : 1);
      var prevEnd = cur.b, ns, fx0, fx1, portal = false;
      if (n >= 30 && R() < 0.07 + d * 0.1) {
        portal = true;
        var xp = prevEnd - (0.11 * v + PH + 10); L.portals.push({ x: xp, used: false });
        ns = xp + fd - 30; fx0 = fx1 = xp;
      } else { fx1 = prevEnd - (PH - 4) - 0.09 * v; ns = fx1 + fd - w * v; fx0 = ns - fd; }
      var land = fx1 + fd;
      var runLen = (lerp(9, 4, d) + R() * lerp(9, 5, d)) * 40;
      var nb = Math.max(ns + runLen, land + lerp(0.55, 0.3, d) * v + 40);
      trans.push({ fx0: fx0, fx1: fx1, fd: fd, from: cur.s, portal: portal });
      var nr = { s: 1 - cur.s, a: ns - 16, b: nb };
      if (n >= 100 && R() < 0.12) {
        var mult = [0.85, 1.15, 1.3, 1.45][Math.floor(R() * 4)], sx = land + 24;
        v = Math.round(v0 * mult);
        L.speeds.push({ x: sx, v: v, used: false });
        nr.b = Math.max(nb, sx + 1.0 * v + PH + 70); // next flip window starts after the speed gate
      }
      runs.push(nr); cur = nr;
    }
    L.finishX = cur.b;
    cur.b += 1200;
    // easier levels get wider safe zones
    var ext = lerp(170, 0, Math.min(1, d * 2.5));
    runs.forEach(function (r, i) { if (i > 0) r.a -= R() * ext; r.b += R() * ext * 0.5; });
    // merge intervals per surface
    [0, 1].forEach(function (s) {
      var iv = runs.filter(function (r) { return r.s === s; }).map(function (r) { return [r.a, r.b]; }).sort(function (a, b) { return a[0] - b[0]; });
      var out = [];
      iv.forEach(function (x) { if (out.length && x[0] <= out[out.length - 1][1] + 20) out[out.length - 1][1] = Math.max(out[out.length - 1][1], x[1]); else out.push([x[0], x[1]]); });
      L.surf[s] = out.map(function (x) { return { x0: x[0], x1: x[1] }; });
      // hazards in the gaps
      for (var k = 0; k < out.length; k++) {
        var g0 = k === 0 ? -700 : out[k - 1][1], g1 = out[k][0];
        if (k === 0) continue;
        if (g1 - g0 > 50 && R() < lerp(0.3, 0.75, d)) L.spikes.push({ s: s, x0: g0, x1: g1 });
      }
      var lastEnd = out.length ? out[out.length - 1][1] : 0;
      if (lastEnd < L.finishX + 1200) { /* trailing gap is a pit */ }
    });
    function lineY(s) { return s === 0 ? floorY - PH : ceilY + PH; }
    // saws, coins per run (using landing/next-window bounds)
    for (var i = 1; i < runs.length - 1; i++) {
      var tr0 = trans[i - 1], tr1 = trans[i], r = runs[i];
      var landX = tr0.fx1 + tr0.fd, nextW = tr1 ? tr1.fx0 : L.finishX;
      var lo = landX + 50, hi = nextW - 50;
      if (n >= 20 && hi - lo > 120 && R() < 0.25 + d * 0.35) {
        var sr = 20 + R() * 10, sx2 = lerp(lo + sr, hi - sr, R()), opp = 1 - r.s;
        var amp = n >= 80 && R() < 0.45 ? Math.min(90, (hi - lo) / 2 - sr) : 0;
        if (amp < 0) amp = 0;
        L.saws.push({ x: sx2, bx: amp ? (lo + hi) / 2 : sx2, y: opp === 0 ? floorY - sr + 6 : ceilY + sr - 6, r: sr, amp: amp, spd: 1.5 + R() * 1.5 + d });
      }
      if (R() < 0.55 && hi - lo > 80) {
        for (var cx = lo; cx < hi; cx += 46) L.coins.push({ x: cx, y: lineY(r.s), taken: false, mx: 0, my: 0 });
      }
    }
    // coin arcs across some transitions + star tokens
    function flightPoint(tr, u) {
      var xc = (tr.fx0 + tr.fx1) / 2, y0 = lineY(tr.from), y1 = lineY(1 - tr.from);
      return { x: xc + tr.fd * u, y: y0 + (y1 - y0) * u * u };
    }
    trans.forEach(function (tr, k) {
      if (R() < 0.3) for (var u = 0.25; u <= 1; u += 0.25) { var p = flightPoint(tr, u); L.coins.push({ x: p.x, y: p.y, taken: false, mx: 0, my: 0 }); }
    });
    var T = trans.length;
    for (var q = 0; q < 3; q++) {
      if (T >= 3) {
        var idx = clamp(Math.floor((q + 0.25 + R() * 0.5) * T / 3), 0, T - 1);
        var pt = flightPoint(trans[idx], 0.707);
        L.tokens.push({ x: pt.x, y: pt.y, taken: false });
      } else {
        L.tokens.push({ x: 300 + q * 300, y: lineY(0) - 10, taken: false });
      }
    }
    if (boss && T > 4) {
      var mi = Math.floor(T / 2), trm = trans[mi], rm = runs[mi + 1];
      L.cp = { x: trm.fx1 + trm.fd + 60, s: rm.s, v: v0 };
      for (var z = 0; z < L.speeds.length; z++) if (L.speeds[z].x < L.cp.x) L.cp.v = L.speeds[z].v;
    }
    L.trans = trans;
    return L;
  }

  /* ---------- course renderer (shared by game + menu) ---------- */
  function drawCourse(g, L, x0, x1, t) {
    var B = BIOMES[L.biome], i, k;
    var fy = L.floorY, cy = L.ceilY;
    // spikes blocks
    for (i = 0; i < L.spikes.length; i++) {
      var sp = L.spikes[i]; if (sp.x1 < x0 || sp.x0 > x1) continue;
      var y0 = sp.s === 0 ? fy + 14 : cy - 14;
      g.fillStyle = 'rgba(0,0,0,.35)';
      if (sp.s === 0) g.fillRect(sp.x0, fy + 14, sp.x1 - sp.x0, 600); else g.fillRect(sp.x0, cy - 614, sp.x1 - sp.x0, 600);
      g.fillStyle = '#f43f5e'; g.beginPath();
      for (k = sp.x0; k < sp.x1 - 4; k += 20) {
        var w = Math.min(20, sp.x1 - k);
        if (sp.s === 0) { g.moveTo(k, y0); g.lineTo(k + w / 2, fy - 16); g.lineTo(k + w, y0); }
        else { g.moveTo(k, y0); g.lineTo(k + w / 2, cy + 16); g.lineTo(k + w, y0); }
      }
      g.fill();
    }
    // solid blocks
    for (var s = 0; s < 2; s++) {
      var arr = L.surf[s];
      for (i = 0; i < arr.length; i++) {
        var iv = arr[i]; if (iv.x1 < x0 || iv.x0 > x1) continue;
        var a = Math.max(iv.x0, x0 - 40), b = Math.min(iv.x1, x1 + 40);
        if (s === 0) {
          g.fillStyle = B.near; g.fillRect(a, fy, b - a, 600);
          g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(a, fy + 40, b - a, 560);
          g.fillStyle = B.acc; g.fillRect(a, fy, b - a, 6);
        } else {
          g.fillStyle = B.near; g.fillRect(a, cy - 600, b - a, 600);
          g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(a, cy - 600, b - a, 560);
          g.fillStyle = B.acc; g.fillRect(a, cy - 6, b - a, 6);
        }
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath();
        for (k = Math.ceil(a / 40) * 40; k < b; k += 40) { if (s === 0) { g.moveTo(k, fy + 6); g.lineTo(k, fy + 40); } else { g.moveTo(k, cy - 6); g.lineTo(k, cy - 40); } }
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)';
        if (iv.x0 > x0 - 40) { if (s === 0) g.fillRect(iv.x0, fy, 3, 40); else g.fillRect(iv.x0, cy - 40, 3, 40); }
      }
    }
    // speed portals
    for (i = 0; i < L.speeds.length; i++) {
      var spd = L.speeds[i]; if (spd.x < x0 || spd.x > x1) continue;
      var fast = spd.v > L.v0;
      g.strokeStyle = fast ? '#f97316' : '#38bdf8'; g.lineWidth = 4; g.globalAlpha = spd.used ? 0.35 : 0.9;
      for (k = 0; k < (fast ? 3 : 1); k++) { var ax = spd.x + k * 14, my = (fy + cy) / 2; g.beginPath(); g.moveTo(ax, my - 22); g.lineTo(ax + 12, my); g.lineTo(ax, my + 22); g.stroke(); }
      g.globalAlpha = 1;
    }
    // gravity portals
    for (i = 0; i < L.portals.length; i++) {
      var p = L.portals[i]; if (p.x < x0 - 40 || p.x > x1 + 40) continue;
      var mid = (fy + cy) / 2, hh = (fy - cy) / 2;
      g.globalAlpha = p.used ? 0.35 : 1;
      g.lineWidth = 8; g.strokeStyle = 'rgba(34,211,238,.35)'; g.beginPath(); g.ellipse(p.x, mid, 16, hh, 0, 0, 7); g.stroke();
      g.lineWidth = 3; g.strokeStyle = '#a5f3fc'; g.beginPath(); g.ellipse(p.x, mid, 16, hh, 0, 0, 7); g.stroke();
      g.fillStyle = '#67e8f9';
      for (k = -1; k <= 1; k += 2) { var ay = mid + k * (20 + ((t * 40) % 20)); g.beginPath(); g.moveTo(p.x - 8, ay); g.lineTo(p.x + 8, ay); g.lineTo(p.x, ay + k * 10); g.fill(); }
      g.globalAlpha = 1;
    }
    // saws
    for (i = 0; i < L.saws.length; i++) {
      var sw = L.saws[i]; if (sw.x < x0 - 60 || sw.x > x1 + 60) continue;
      g.save(); g.translate(sw.x, sw.y); g.rotate(t * 8);
      g.fillStyle = '#cbd5e1'; g.beginPath();
      for (k = 0; k < 12; k++) { var an = k / 12 * 6.283; g.lineTo(Math.cos(an) * (sw.r + 6), Math.sin(an) * (sw.r + 6)); g.lineTo(Math.cos(an + 0.26) * sw.r * 0.85, Math.sin(an + 0.26) * sw.r * 0.85); }
      g.closePath(); g.fill();
      g.fillStyle = '#475569'; g.beginPath(); g.arc(0, 0, sw.r * 0.55, 0, 7); g.fill();
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(0, 0, sw.r * 0.2, 0, 7); g.fill();
      g.restore();
    }
    // coins
    for (i = 0; i < L.coins.length; i++) {
      var c = L.coins[i]; if (c.taken) continue;
      var cxp = c.x + c.mx, cyp = c.y + c.my; if (cxp < x0 || cxp > x1) continue;
      var swc = Math.abs(Math.cos(t * 3 + i));
      g.fillStyle = '#f59e0b'; g.beginPath(); g.ellipse(cxp, cyp, 8 * swc + 1.5, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#fde047'; g.beginPath(); g.ellipse(cxp, cyp, 5 * swc + 0.8, 5, 0, 0, 7); g.fill();
    }
    // tokens
    for (i = 0; i < L.tokens.length; i++) {
      var tk = L.tokens[i]; if (tk.taken || tk.x < x0 || tk.x > x1) continue;
      var gl = g.createRadialGradient(tk.x, tk.y, 2, tk.x, tk.y, 34); gl.addColorStop(0, 'rgba(253,224,71,.7)'); gl.addColorStop(1, 'rgba(253,224,71,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(tk.x, tk.y, 34, 0, 7); g.fill();
      g.save(); g.translate(tk.x, tk.y); g.rotate(Math.sin(t * 2 + i) * 0.3);
      g.fillStyle = '#fde047'; g.strokeStyle = '#a16207'; g.lineWidth = 2.5; g.beginPath();
      for (k = 0; k < 10; k++) { var at = k / 10 * 6.283 - Math.PI / 2, rr = k % 2 ? 7 : 16; g.lineTo(Math.cos(at) * rr, Math.sin(at) * rr); }
      g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // checkpoint
    if (L.cp && L.cp.x > x0 && L.cp.x < x1) {
      var by = L.cp.s === 0 ? fy : cy, dir = L.cp.s === 0 ? -1 : 1;
      g.strokeStyle = '#e2e8f0'; g.lineWidth = 3; line(g, L.cp.x, by, L.cp.x, by + dir * 70);
      g.fillStyle = '#22c55e'; g.beginPath(); g.moveTo(L.cp.x, by + dir * 70); g.lineTo(L.cp.x + 30, by + dir * 60); g.lineTo(L.cp.x, by + dir * 50); g.fill();
    }
    // finish
    if (L.finishX > x0 - 60 && L.finishX < x1) {
      for (var yy = cy; yy < fy; yy += 20) for (var xx = 0; xx < 2; xx++) { g.fillStyle = ((Math.floor((yy - cy) / 20) + xx) & 1) ? '#111' : '#fff'; g.fillRect(L.finishX + xx * 20, yy, 20, Math.min(20, fy - yy)); }
      g.fillStyle = '#fde047'; g.font = '900 30px system-ui'; g.textAlign = 'center';
      g.fillText('FINISH', L.finishX + 20, cy - 20 + Math.sin(t * 3) * 4);
    }
  }

  /* ---------- run (one attempt at a level) ---------- */
  function newRunnerRun(api) {
    var L = api.L, D = api.D, ch = api.ch();
    L.portals.forEach(function (p) { p.used = false; });
    L.speeds.forEach(function (p) { p.used = false; });
    L.coins.forEach(function (c) { c.taken = false; c.mx = 0; c.my = 0; });
    L.tokens.forEach(function (c) { c.taken = false; });
    var P, time = 0, banner = 2.4, trail = [], tick = 0, camX = 0, runCoins = 0;
    function spawn(x, s, v, keepTokens) {
      P = {
        x: x, y: s === 0 ? L.floorY - PH : L.ceilY + PH, vy: 0, g: s === 0 ? 1 : -1, v: v, grounded: true, rot: s === 0 ? 0 : Math.PI,
        air: D.airFlips, shields: D.shields, inv: 0, started: false, alive: true, won: false, flips: 0,
        tokens: keepTokens ? P.tokens : 0, shieldUsed: keepTokens ? P.shieldUsed : false, cpHit: keepTokens, sq: 0, buf: 0, coy: 0
      };
      trail.length = 0;
    }
    spawn(0, 0, L.v0, false);
    function flip(fromKey) {
      if (!P.alive || P.won) return;
      if (!P.grounded && P.coy <= 0) {
        if (P.air <= 0) { P.buf = 0.12; return; }
        P.air--;
        api.burst(P.x, P.y, 10, '#a5f3fc', 200, 0, 0);
      }
      P.g *= -1; P.vy = P.g * 220; P.grounded = false; P.coy = 0; P.buf = 0;
      P.flips++; api.stat('flips');
      api.tone(P.g > 0 ? 520 : 760, 0.07, 'square', 0.06, P.g > 0 ? 0.7 : 1.4);
      api.burst(P.x, P.y + P.g * -PH, 6, colorOf(ch.tr, api.t()), 140, 0, 0);
    }
    function hurt(kind) {
      if (P.won || !P.alive) return;
      if (kind !== 'pit' && P.inv > 0) return;
      if (P.shields > 0 || (D.guard > 0 && Math.random() < D.guard)) {
        if (P.shields > 0) P.shields--;
        P.shieldUsed = true; P.inv = 1.0;
        api.shake(8); api.hitstop(0.05);
        api.tone(300, 0.2, 'triangle', 0.15, 2.5);
        api.burst(P.x, P.y, 24, '#67e8f9', 300, 0, 0);
        if (kind === 'pit' || kind === 'crash') { P.g *= -1; P.vy = P.g * 760; P.grounded = false; }
        return;
      }
      P.alive = false;
      api.burst(P.x, P.y, 36, function (i) { return i % 2 ? colorOf(ch.c, api.t(), i * 20) : '#ef4444'; }, 520, 1, 900);
      api.die();
    }
    function step(dt) {
      time += dt;
      for (var i = 0; i < L.saws.length; i++) { var sw = L.saws[i]; if (sw.amp) sw.x = sw.bx + Math.sin(time * sw.spd) * sw.amp; }
      if (!P.alive) return;
      if (!P.started) { P.sq = Math.max(0, P.sq - dt * 4); return; }
      if (P.inv > 0) P.inv -= dt;
      if (P.coy > 0) P.coy -= dt;
      if (P.buf > 0) P.buf -= dt;
      var prevTop = P.y - PH, prevBot = P.y + PH;
      P.x += P.v * dt;
      P.vy = clamp(P.vy + GR * P.g * dt, -1500, 1500);
      P.y += P.vy * dt;
      var wasG = P.grounded; P.grounded = false;
      var fy = L.floorY, cy = L.ceilY, k, iv;
      var arr = L.surf[0];
      for (k = 0; k < arr.length; k++) {
        iv = arr[k]; if (iv.x1 < P.x - PH || iv.x0 > P.x + PH) continue;
        if (P.y + PH > fy && P.y - PH < fy + 600) {
          if (prevBot <= fy + 4) { P.y = fy - PH; if (P.vy > 0) P.vy = 0; if (P.g > 0) P.grounded = true; }
          else if (P.inv <= 0) { hurt('crash'); if (!P.alive) return; }
        }
      }
      arr = L.surf[1];
      for (k = 0; k < arr.length; k++) {
        iv = arr[k]; if (iv.x1 < P.x - PH || iv.x0 > P.x + PH) continue;
        if (P.y - PH < cy && P.y + PH > cy - 600) {
          if (prevTop >= cy - 4) { P.y = cy + PH; if (P.vy < 0) P.vy = 0; if (P.g < 0) P.grounded = true; }
          else if (P.inv <= 0) { hurt('crash'); if (!P.alive) return; }
        }
      }
      if (wasG && !P.grounded) P.coy = 0.08;
      if (!wasG && P.grounded) {
        P.sq = 1;
        api.burst(P.x - 8, P.g > 0 ? fy : cy, 5, 'rgba(255,255,255,.8)', 120, 0, P.g * -300);
        if (P.buf > 0) { P.buf = 0; flip(); }
      }
      P.sq = Math.max(0, P.sq - dt * 6);
      if (!P.won) {
        for (k = 0; k < L.spikes.length; k++) {
          var sp = L.spikes[k]; if (sp.x1 - 6 < P.x - PH + 5 || sp.x0 + 6 > P.x + PH - 5) continue;
          if (sp.s === 0 ? P.y + PH > fy - 12 : P.y - PH < cy + 12) { hurt('spike'); if (!P.alive) return; }
        }
        for (k = 0; k < L.saws.length; k++) {
          var s2 = L.saws[k]; if (Math.abs(s2.x - P.x) > s2.r + 30) continue;
          if (Math.hypot(s2.x - P.x, s2.y - P.y) < s2.r + PH - 4) { hurt('saw'); if (!P.alive) return; }
        }
        if (P.y > fy + 260 || P.y < cy - 260) { hurt('pit'); if (!P.alive) return; }
      }
      for (k = 0; k < L.portals.length; k++) {
        var p = L.portals[k];
        if (!p.used && P.x >= p.x) {
          p.used = true; P.g *= -1; P.vy = P.g * 220; P.grounded = false; api.stat('flips');
          api.tone(420, 0.25, 'sine', 0.14, 2.2); api.burst(P.x, P.y, 18, '#67e8f9', 300, 0, 0); api.shake(4);
        }
      }
      for (k = 0; k < L.speeds.length; k++) {
        var spd = L.speeds[k];
        if (!spd.used && P.x >= spd.x) { spd.used = true; P.v = spd.v; api.tone(spd.v > L.v0 ? 880 : 330, 0.18, 'sawtooth', 0.07, spd.v > L.v0 ? 1.6 : 0.6); api.shake(3); }
      }
      var mag = D.magnet;
      for (k = 0; k < L.coins.length; k++) {
        var c = L.coins[k]; if (c.taken) continue;
        var cx = c.x + c.mx, cyy = c.y + c.my, dx = P.x - cx, dy = P.y - cyy;
        if (Math.abs(dx) > mag + 20) continue;
        var dd = Math.hypot(dx, dy);
        if (dd < 22) { c.taken = true; runCoins += Math.max(1, Math.round((1 + api.level() * 0.2) * D.coinMult)); api.stat('grabbed'); api.sfx.coin(); }
        else if (dd < mag) { c.mx += dx / dd * 900 * dt; c.my += dy / dd * 900 * dt; }
      }
      for (k = 0; k < L.tokens.length; k++) {
        var tk = L.tokens[k];
        if (!tk.taken && Math.abs(P.x - tk.x) < 32 && Math.abs(P.y - tk.y) < 32) {
          tk.taken = true; P.tokens++; api.stat('tokens'); api.sfx.star(); api.hitstop(0.04);
          api.burst(tk.x, tk.y, 26, '#fde047', 360, 1, 300);
        }
      }
      if (L.cp && !P.cpHit && P.x >= L.cp.x) { P.cpHit = true; api.tone(660, 0.2, 'triangle', 0.12, 1.5); api.burst(L.cp.x, P.y, 16, '#22c55e', 260, 0, 0); }
      if (!P.won && P.x >= L.finishX) {
        P.won = true;
        for (var cf = 0; cf < 150; cf++) {
          var an = Math.random() * 6.283, sv = 300 + Math.random() * 800;
          api.emit(P.x, P.y, Math.cos(an) * sv, Math.sin(an) * sv, 1.2 + Math.random() * 1.2, 3 + Math.random() * 4, 'hsl(' + Math.floor(Math.random() * 360) + ',90%,60%)', 1, 600);
        }
        api.win({ stars: P.tokens, medal: api.deaths() === 0 && !P.shieldUsed, time: time, flips: P.flips, runCoins: runCoins, shieldUsed: P.shieldUsed });
      }
      if (P.grounded) { var tgt = Math.round(P.rot / (Math.PI / 2)) * (Math.PI / 2); P.rot = lerp(P.rot, tgt, 0.3); }
      else P.rot += 7.5 * dt * P.g;
      if (++tick % 2 === 0) { trail.push(P.x, P.y); if (trail.length > 40) trail.splice(0, 2); }
      if (ch.tier >= 2 && Math.random() < 0.12 + ch.tier * 0.06) api.emit(P.x - 14, P.y + (Math.random() - 0.5) * 20, -80, 0, 0.45, 2 + ch.tier * 0.5, colorOf(ch.tr, api.t(), Math.random() * 200), 0, 0);
    }
    function render(g) {
      var W = api.W(), H = api.H(), dpr = api.dpr(), t = api.t(), B = BIOMES[L.biome];
      var z = Math.min(H / (L.Hc + 470), W / 640);
      camX = P.x + W * 0.2 / z;
      var cyMid = (L.floorY + L.ceilY) / 2;
      drawBackdrop(g, B, camX, 0, W, H, t);
      var sh = api.shakeXY();
      g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - camX * z + sh[0]), dpr * (H / 2 - cyMid * z + sh[1]));
      var x0 = camX - W / 2 / z - 60, x1 = camX + W / 2 / z + 60;
      drawCourse(g, L, x0, x1, t);
      if (P.alive) {
        g.lineCap = 'round';
        var ns = trail.length / 2;
        for (var i = 1; i < ns; i++) {
          var f = i / ns; g.globalAlpha = f * 0.6;
          g.strokeStyle = colorOf(ch.tr, t, i * 15); g.lineWidth = 4 + f * 16;
          line(g, trail[i * 2 - 2], trail[i * 2 - 1], trail[i * 2], trail[i * 2 + 1]);
        }
        g.globalAlpha = 1;
        if (P.inv > 0) { g.strokeStyle = 'rgba(103,232,249,' + (0.4 + 0.4 * Math.sin(t * 30)) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(P.x, P.y, 26, 0, 7); g.stroke(); }
        else if (P.shields > 0) { g.strokeStyle = 'rgba(103,232,249,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(P.x, P.y, 24, 0, 7); g.stroke(); }
        drawRunner(g, ch, P.x, P.y, 30, P.rot, t, P.sq, false);
      }
      api.drawParticles(g);
      // HUD
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, 10, 10, Math.min(300, W - 190), 64, 12); g.fill();
      g.fillStyle = '#fff'; g.font = '900 18px system-ui';
      g.fillText('LEVEL ' + api.level() + (L.boss ? ' \u00b7 BOSS' : L.challenge ? ' \u00b7 CHALLENGE' : ''), 20, 16);
      g.font = '600 12px system-ui'; g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText('W' + (L.biome + 1) + ' ' + B.name + ' \u00b7 Attempt ' + (api.deaths() + 1) + ' \u00b7 \ud83e\ude99 ' + fmt(api.S.coins + runCoins), 20, 38);
      var tks = ''; for (var q = 0; q < 3; q++) tks += L.tokens[q] && L.tokens[q].taken ? '\u2605' : '\u2606';
      g.fillText(tks + '  \u2934 ' + P.air + '  \ud83d\udee1 ' + P.shields + '  ' + Math.floor(clamp(P.x / L.finishX, 0, 1) * 100) + '%', 20, 54);
      var pw = Math.min(360, W * 0.4), px = W / 2 - pw / 2, prog = clamp(P.x / L.finishX, 0, 1);
      if (W > 520) {
        g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, px, 16, pw, 10, 5); g.fill();
        g.fillStyle = B.acc; rr(g, px, 16, Math.max(10, pw * prog), 10, 5); g.fill();
        if (L.cp) { g.fillStyle = '#22c55e'; g.fillRect(px + pw * L.cp.x / L.finishX - 1, 12, 3, 18); }
      }
      g.textBaseline = 'bottom'; g.font = '600 12px system-ui'; g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText('\u23f1 Playtime ' + fmtTime(api.playtime()) + ' \u00b7 Best ' + fmt(api.hiScore()), 12, H - 10);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (banner > 0) {
        banner -= 1 / 60;
        g.globalAlpha = Math.min(1, banner);
        g.font = '900 ' + Math.round(Math.min(46, W / 12)) + 'px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6;
        var txt = L.boss ? '\ud83d\udd25 BOSS STAGE' : L.challenge ? '\u2694 CHALLENGE STAGE' : 'LEVEL ' + api.level();
        g.strokeText(txt, W / 2, H * 0.3); g.fillText(txt, W / 2, H * 0.3);
        g.font = '700 16px system-ui'; g.strokeText(B.name, W / 2, H * 0.3 + 36); g.fillText(B.name, W / 2, H * 0.3 + 36);
        g.globalAlpha = 1;
      }
      if (!P.started && P.alive) {
        g.font = '900 ' + Math.round(Math.min(26, W / 18)) + 'px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 5;
        var hint = 'Press Space / Click / Tap to RUN';
        g.strokeText(hint, W / 2, H * 0.74); g.fillText(hint, W / 2, H * 0.74);
        g.font = '700 14px system-ui';
        var h2 = 'Then tap to FLIP gravity \u00b7 grab \u2605 tokens mid-flip';
        g.strokeText(h2, W / 2, H * 0.74 + 28); g.fillText(h2, W / 2, H * 0.74 + 28);
      }
      if (!P.alive) { g.font = '900 34px system-ui'; g.fillStyle = '#fca5a5'; g.fillText('CRASH!', W / 2, H * 0.42); }
      if (P.won) {
        g.font = '900 ' + Math.round(Math.min(64, W / 9)) + 'px system-ui'; g.fillStyle = '#fde047'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 7;
        g.strokeText('FINISH!', W / 2, H * 0.4); g.fillText('FINISH!', W / 2, H * 0.4);
      }
      g.textBaseline = 'alphabetic';
    }
    return {
      step: step, render: render, dbg: function () { return P; },
      down: function () {
        if (!P.alive || P.won) return;
        if (!P.started) { P.started = true; P.sq = 1; api.tone(440, 0.1, 'triangle', 0.1, 1.5); return; }
        flip();
      },
      up: function () { },
      respawn: function () {
        if (!L.cp || !P.cpHit) return false;
        spawn(L.cp.x, L.cp.s, L.cp.v, true);
        P.started = true;
        for (var k = 0; k < L.portals.length; k++) if (L.portals[k].x > L.cp.x) L.portals[k].used = false;
        for (k = 0; k < L.speeds.length; k++) L.speeds[k].used = L.speeds[k].x <= L.cp.x;
        return true;
      }
    };
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  /* ---------- icon ---------- */
  function createGameIcon() {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 512;
      var g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#0f0326'); gr.addColorStop(0.5, '#6d28d9'); gr.addColorStop(1, '#22d3ee');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      g.fillStyle = 'rgba(255,255,255,.08)'; for (var i = 0; i < 16; i++) g.fillRect(i * 34, 0, 2, 512);
      g.fillStyle = '#1e1b4b'; g.fillRect(0, 0, 300, 120); g.fillRect(380, 0, 132, 120); g.fillRect(0, 392, 200, 120); g.fillRect(300, 392, 212, 120);
      g.fillStyle = '#f0abfc'; g.fillRect(0, 114, 300, 8); g.fillRect(380, 114, 132, 8); g.fillRect(0, 390, 200, 8); g.fillRect(300, 390, 212, 8);
      g.fillStyle = '#f43f5e'; g.beginPath(); for (var k = 200; k < 300; k += 25) { g.moveTo(k, 512); g.lineTo(k + 12.5, 470); g.lineTo(k + 25, 512); } g.fill();
      g.lineCap = 'round';
      for (var t = 0; t < 14; t++) { g.strokeStyle = 'rgba(103,232,249,' + (t / 14 * 0.8) + ')'; g.lineWidth = 6 + t * 2.4; var u = t / 14; g.beginPath(); g.moveTo(60 + u * 180, 370 - u * u * 170); g.lineTo(60 + (u + 0.08) * 180, 370 - (u + 0.08) * (u + 0.08) * 170); g.stroke(); }
      g.save(); g.translate(270, 210); g.rotate(-0.5); g.scale(3.2, 3.2);
      drawRunner(g, CHARS[0], 0, 0, 30, 0, 0.3, 0, false);
      g.restore();
      g.fillStyle = '#fde047'; g.strokeStyle = '#a16207'; g.lineWidth = 5; g.beginPath();
      for (var q = 0; q < 10; q++) { var a = q / 10 * 6.283 - Math.PI / 2, r = q % 2 ? 18 : 40; g.lineTo(400 + Math.cos(a) * r, 230 + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
      g.textAlign = 'center'; g.font = '900 64px system-ui, Arial, sans-serif'; g.lineWidth = 10; g.strokeStyle = 'rgba(15,10,46,.9)';
      g.strokeText('FLIPSIDE', 256, 330); g.strokeText('DASH', 256, 386);
      var tg = g.createLinearGradient(0, 280, 0, 390); tg.addColorStop(0, '#67e8f9'); tg.addColorStop(1, '#f0abfc');
      g.fillStyle = tg; g.fillText('FLIPSIDE', 256, 330); g.fillText('DASH', 256, 386);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ---------- game descriptor ---------- */
  var menuCam = 0;
  var G = {
    titleGradient: 'linear-gradient(90deg,#67e8f9,#a78bfa,#f0abfc)',
    subtitle: 'Run. Flip. Survive. 2,000 gravity-bending levels across 20 worlds.',
    howTo: '<div style="line-height:2">' +
      '<div><span class="ag-k">Space</span><span class="ag-k">Click</span><span class="ag-k">Tap</span> Start running, then FLIP gravity between floor and ceiling</div></div>' +
      '<div style="margin-top:8px;font-size:14px;opacity:.85;line-height:1.55">You run automatically. Flip before your surface ends, and land on the other side before you fly off the screen. Avoid red spikes and spinning saws, and don\u2019t crash into block edges. Cyan portals flip you automatically, and arrow gates change your speed. Grab the 3 \u2605 tokens hidden mid-flip for 3 stars, and finish without dying or using a shield for the \u26a1 Flawless medal. Upgrades add mid-air flips, bubble shields and a coin magnet.</div>',
    unitName: 'Runners', unitIcon: '\ud83d\udfe6', medalName: 'Flawless', medalIcon: '\u26a1',
    starHint: '\u2605 = star tokens collected',
    statKeys: ['flips', 'tokens', 'grabbed'],
    derive: function (S) {
      var ch = CHMAP[S.sel] || CHARS[0], st = (S.chars[S.sel] || { s: 1 }).s, tm = TMULT[ch.tier], p = ch.perk;
      return {
        airFlips: S.upg.air, shields: S.upg.shield,
        magnet: 30 + S.upg.magnet * 5 + S.perks.mag * 12 + (p === 'magnet' ? 6 * tm * st : 0),
        guard: p === 'guard' ? Math.min(0.5, 0.02 * tm * st) : 0,
        coinMult: (1 + S.upg.coin * 0.1) * (1 + S.perks.coin * 0.25) * (1 + S.prestige * 0.5 + S.shardsTotal * 0.02) * (1 + (p === 'coin' ? 0.03 * tm * st : 0) + totalStars(S) * 0.005),
        gemChance: 0.04 + S.perks.gem * 0.02 + (p === 'gem' ? 0.01 * tm * st : 0)
      };
    },
    idleRate: function (S) { return S.upg.idle * (3 + S.bestLevel * 0.25) * (1 + S.prestige * 0.5); },
    perkText: function (ch, st) {
      var tm = TMULT[ch.tier];
      if (ch.perk === 'coin') return '+' + Math.round(3 * tm * st) + '% coins';
      if (ch.perk === 'magnet') return '+' + Math.round(6 * tm * st) + ' magnet';
      if (ch.perk === 'gem') return '+' + (1 * tm * st).toFixed(1) + '% gem luck';
      return Math.round(Math.min(50, 2 * tm * st)) + '% lucky save';
    },
    hubStats: function (S, D) { return 'Air flips ' + D.airFlips + ' \u00b7 Shields ' + D.shields + ' \u00b7 Magnet ' + Math.round(D.magnet); },
    upgCur: function (u, S, D) { return u.k === 'air' ? D.airFlips + ' per run' : u.k === 'shield' ? D.shields + ' per run' : Math.round(D.magnet) + ' px'; },
    newRun: newRunnerRun,
    renderMenu: function (ctx, ML, W, H, dpr, t, dt) {
      menuCam += dt * 320; if (menuCam > ML.finishX) menuCam = 0;
      var z = Math.min(H / (ML.Hc + 470), W / 640) * 0.95, cy = (ML.floorY + ML.ceilY) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(ctx, BIOMES[ML.biome], menuCam, 0, W, H, t);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - menuCam * z), dpr * (H / 2 - cy * z));
      for (var i = 0; i < ML.saws.length; i++) { var sw = ML.saws[i]; if (sw.amp) sw.x = sw.bx + Math.sin(t * sw.spd) * sw.amp; }
      drawCourse(ctx, ML, menuCam - W / 2 / z - 60, menuCam + W / 2 / z + 60, t);
    },
    rewards: function (n, L, info, D, first) {
      var coins = Math.round((14 + n * 2.1) * (1 + info.stars * 0.3) * D.coinMult * (first ? 2 : 1) * (L.boss ? 5 : L.challenge ? 2 : 1)) + info.runCoins;
      return { coins: coins, gems: 0, score: Math.round((100 + n * 5) * (1 + info.stars * 0.5) * (info.medal ? 1.5 : 1) + info.runCoins) };
    },
    resultLines: function (info) {
      return '\u2605 Tokens ' + info.stars + '/3 \u00b7 \ud83d\udd01 Flips ' + info.flips + '<br>\u23f1 ' + info.time.toFixed(2) + 's' + (info.shieldUsed ? ' \u00b7 \ud83d\udee1 shield used' : '') + ' \u00b7 \ud83e\ude99 ' + fmt(info.runCoins) + ' grabbed';
    },
    reg: {
      description: 'One-button gravity-flip runner across 2,000 levels, 20 worlds and 62 unlockable runners.',
      category: 'Platformer',
      bannerGradient: 'linear-gradient(135deg, #6d28d9 0%, #22d3ee 100%)',
      controls: ['Space / Click / Tap \u2014 Start & flip gravity', 'R Key \u2014 Restart level', 'Esc \u2014 Pause / Menu', 'M \u2014 Mute \u00b7 F \u2014 Fullscreen', 'Enter \u2014 Next level (results)']
    }
  };

  /* ================================================================== */
  /*  GAME SHELL: menus, saves, economy, audio, input, loop, cleanup      */
  /* ================================================================== */
  var CORE_STATS = ['clears', 'ndclears', 'coinsEarned', 'stars', 'challenges', 'pulls', 'deaths', 'quests', 'topClear'];
  var SECRET_HINT = ['Rebirth once', 'Rebirth 3 times', 'Reach level 1000', 'Clear level 2000', 'Claim 50 quests'];
  var SECRET_IDS = CHARS.filter(function (c) { return c.tier === 5; }).map(function (c) { return c.id; });

  function newSave() {
    var stats = {};
    CORE_STATS.concat(G.statKeys).forEach(function (k) { stats[k] = 0; });
    var rep = {};
    Object.keys(QTYPES).forEach(function (k) { rep[k] = { t: 0, base: 0 }; });
    var upg = {}; UPG.forEach(function (u) { upg[u.k] = 0; });
    var perks = {}; PERKS.forEach(function (p) { perks[p.k] = 0; });
    var chars = {}; chars[CHARS[0].id] = { s: 1, f: 0 };
    return {
      v: 1, created: Date.now(), lastSeen: Date.now(),
      maxLevel: 1, bestLevel: 1, coins: 0, gems: 10, shards: 0, shardsTotal: 0, prestige: 0, pity: 0,
      upg: upg, perks: perks, chars: chars, sel: CHARS[0].id,
      medals: {}, stats: stats, daily: { date: '', list: [] }, rep: rep, playtime: 0
    };
  }
  function normalizeSave(o) {
    var out = newSave();
    if (!o || typeof o !== 'object') return out;
    ['created', 'lastSeen', 'maxLevel', 'bestLevel', 'coins', 'gems', 'shards', 'shardsTotal', 'prestige', 'pity', 'playtime'].forEach(function (k) {
      if (typeof o[k] === 'number' && isFinite(o[k])) out[k] = o[k];
    });
    ['upg', 'perks', 'stats'].forEach(function (k) {
      if (o[k] && typeof o[k] === 'object') Object.keys(out[k]).forEach(function (kk) { if (typeof o[k][kk] === 'number' && isFinite(o[k][kk])) out[k][kk] = o[k][kk]; });
    });
    if (o.chars && typeof o.chars === 'object') {
      Object.keys(o.chars).forEach(function (id) { if (CHMAP[id] && o.chars[id]) out.chars[id] = { s: clamp(o.chars[id].s | 0, 1, 5), f: Math.max(0, o.chars[id].f | 0) }; });
    }
    if (typeof o.sel === 'string' && out.chars[o.sel]) out.sel = o.sel;
    if (o.medals && typeof o.medals === 'object') Object.keys(o.medals).forEach(function (k) { var v = o.medals[k] | 0; if (v) out.medals[k] = v & 15; });
    if (o.daily && Array.isArray(o.daily.list)) out.daily = { date: String(o.daily.date || ''), list: o.daily.list.filter(function (q) { return q && QTYPES[q.k]; }).slice(0, 3) };
    if (o.rep && typeof o.rep === 'object') Object.keys(out.rep).forEach(function (k) { if (o.rep[k]) out.rep[k] = { t: o.rep[k].t | 0, base: +o.rep[k].base || 0 }; });
    UPG.forEach(function (u) { out.upg[u.k] = clamp(out.upg[u.k] | 0, 0, u.max); });
    PERKS.forEach(function (p) { out.perks[p.k] = clamp(out.perks[p.k] | 0, 0, p.max); });
    out.maxLevel = clamp(Math.floor(out.maxLevel), 1, MAX_LEVEL);
    out.bestLevel = Math.max(out.bestLevel, out.maxLevel);
    return out;
  }
  function totalStars(S) { var t = 0; for (var k in S.chars) t += S.chars[k].s; return t; }

  function startGame(container) {
    var LS = {
      get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
    };

    /* ---------- DOM ---------- */
    var style = document.createElement('style');
    style.textContent = [
      '.ag-root{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#0b1020;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f8fafc;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;outline:none}',
      '.ag-root canvas.ag-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer}',
      '.ag-hud{position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:30}',
      '.ag-ib{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(15,23,42,.62);color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(4px)}',
      '.ag-ib:hover{background:rgba(79,70,229,.8)}',
      '.ag-scr{position:absolute;inset:0;z-index:20;overflow:auto;background:rgba(3,6,20,.74);backdrop-filter:blur(3px);padding:56px 16px 24px;box-sizing:border-box;display:none;touch-action:pan-y}',
      '.ag-pn{max-width:980px;margin:0 auto}',
      '.ag-h1{font-size:clamp(28px,6vw,54px);font-weight:900;letter-spacing:1px;margin:0 0 4px;background:' + G.titleGradient + ';-webkit-background-clip:text;background-clip:text;color:transparent;text-align:center}',
      '.ag-h2{font-size:22px;font-weight:800;margin:0 0 12px}',
      '.ag-sub{opacity:.8;text-align:center;margin-bottom:16px}',
      '.ag-card{background:linear-gradient(160deg,rgba(30,41,59,.92),rgba(15,23,42,.92));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;box-sizing:border-box}',
      '.ag-grid{display:grid;gap:10px}',
      '.ag-b{border:0;border-radius:11px;padding:9px 14px;font-weight:800;font-size:14px;cursor:pointer;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 3px 0 rgba(0,0,0,.35);font-family:inherit}',
      '.ag-b:hover{filter:brightness(1.15)}.ag-b:active{transform:translateY(2px);box-shadow:none}',
      '.ag-b[disabled]{opacity:.4;cursor:not-allowed;filter:grayscale(.6)}',
      '.ag-b.g{background:linear-gradient(135deg,#16a34a,#22c55e)}.ag-b.r{background:linear-gradient(135deg,#b91c1c,#ef4444)}.ag-b.y{background:linear-gradient(135deg,#d97706,#f59e0b)}.ag-b.s{background:rgba(255,255,255,.12)}.ag-b.c{background:linear-gradient(135deg,#0891b2,#22d3ee)}',
      '.ag-b.big{font-size:20px;padding:14px 22px;border-radius:14px}',
      '.ag-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.ag-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.ag-pill{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 11px;font-weight:800;font-size:14px;white-space:nowrap}',
      '.ag-k{display:inline-block;background:#1e293b;border:1px solid #475569;border-bottom-width:3px;border-radius:6px;padding:1px 7px;font-weight:800;font-size:12px;margin-right:4px}',
      '.ag-bar{height:9px;background:rgba(255,255,255,.12);border-radius:9px;overflow:hidden}.ag-bar>i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa)}',
      '.ag-lv{aspect-ratio:1;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(30,41,59,.9);color:#fff;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;padding:0;font-family:inherit}',
      '.ag-lv small{font-size:9px;letter-spacing:-1px;color:#fde047}.ag-lv.ch{border-color:#f59e0b}.ag-lv.bs{border-color:#fb7185;background:rgba(127,29,29,.75)}.ag-lv.lk{opacity:.35;cursor:not-allowed}.ag-lv.cur{outline:2px solid #22d3ee}',
      '.ag-tab{padding:6px 9px;font-size:12px;border-radius:8px}',
      '.ag-ch{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;border-width:2px}',
      '.ag-ch canvas{width:72px;height:72px;background:radial-gradient(circle,rgba(255,255,255,.08),transparent 70%);border-radius:12px}',
      '.ag-modal{position:absolute;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:16px;box-sizing:border-box}',
      '.ag-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:45;background:rgba(15,23,42,.94);border:1px solid #a78bfa;border-radius:12px;padding:9px 16px;font-weight:800;pointer-events:none;transition:opacity .3s;opacity:0;max-width:90%;text-align:center}',
      '.ag-pull{display:inline-flex;flex-direction:column;align-items:center;margin:4px;padding:8px;border-radius:12px;border:2px solid;min-width:84px;background:rgba(0,0,0,.35);animation:agpop .45s ease both}',
      '@keyframes agpop{0%{transform:scale(.3) rotate(-12deg);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}',
      '.ag-scr::-webkit-scrollbar{width:8px}.ag-scr::-webkit-scrollbar-thumb{background:#475569;border-radius:8px}',
      '@media (max-width:560px){.ag-scr{padding:52px 10px 20px}.ag-b{padding:8px 11px;font-size:13px}}'
    ].join('\n');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'ag-root';
    root.tabIndex = 0;
    container.appendChild(root);
    var canvas = document.createElement('canvas');
    canvas.className = 'ag-cv';
    root.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var hud = document.createElement('div'); hud.className = 'ag-hud';
    hud.innerHTML = '<button class="ag-ib" data-h="menu" title="Pause / Menu (Esc)">\u2630</button>' +
      '<button class="ag-ib" data-h="restart" title="Restart level (R)">\u21bb</button>' +
      '<button class="ag-ib" data-h="mute" title="Mute (M)">\ud83d\udd0a</button>' +
      '<button class="ag-ib" data-h="fs" title="Fullscreen (F)">\u26f6</button>';
    root.appendChild(hud);
    var scr = document.createElement('div'); scr.className = 'ag-scr'; root.appendChild(scr);
    var modal = document.createElement('div'); modal.className = 'ag-modal'; root.appendChild(modal);
    var toastEl = document.createElement('div'); toastEl.className = 'ag-toast'; root.appendChild(toastEl);
    var fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.style.display = 'none'; root.appendChild(fileIn);
    var btnMenu = hud.querySelector('[data-h=menu]'), btnRestart = hud.querySelector('[data-h=restart]'), btnMute = hud.querySelector('[data-h=mute]');

    /* ---------- persistent globals ---------- */
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
    function saveNow() {
      if (S && slotIdx >= 0) { S.lastSeen = Date.now(); slots[slotIdx] = S; persistSlots(); }
      flushPT();
    }

    /* ---------- audio ---------- */
    var AC = window.AudioContext || window.webkitAudioContext, actx = null, master = null, noiseBuf = null, amb = null;
    function ensureAudio() {
      try {
        if (!actx && AC) {
          actx = new AC(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(actx.destination);
          noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
          var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (actx && actx.state === 'suspended') actx.resume();
      } catch (e) { }
    }
    function tone(f, dur, type, vol, slide, delay) {
      if (!actx || muted) return;
      try {
        var t0 = actx.currentTime + (delay || 0);
        var o = actx.createOscillator(), gn = actx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
        gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(gn); gn.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function noise(dur, vol, f1, f2, delay) {
      if (!actx || muted || !noiseBuf) return;
      try {
        var t0 = actx.currentTime + (delay || 0);
        var s = actx.createBufferSource(); s.buffer = noiseBuf;
        var fl = actx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
        fl.frequency.setValueAtTime(f1, t0); fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
        var gn = actx.createGain(); gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(fl); fl.connect(gn); gn.connect(master); s.start(t0); s.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    var SFX = {
      coin: function () { tone(1400, 0.06, 'square', 0.05); tone(2100, 0.08, 'square', 0.05, 1, 0.05); },
      die: function () { tone(330, 0.45, 'sawtooth', 0.18, 0.2); noise(0.35, 0.25, 900, 120); },
      win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.16, 1, i * 0.09); }); tone(1568, 0.6, 'sine', 0.1, 1, 0.5); },
      click: function () { tone(600, 0.04, 'square', 0.05); },
      buy: function () { tone(523, 0.08, 'square', 0.07); tone(784, 0.12, 'square', 0.07, 1, 0.07); },
      pull: function (tier) { for (var i = 0; i <= tier + 1; i++) tone(400 + i * 180, 0.14, 'triangle', 0.12, 1, i * 0.08); },
      err: function () { tone(160, 0.15, 'square', 0.08); },
      star: function () { [880, 1175, 1568].forEach(function (f, i) { tone(f, 0.14, 'triangle', 0.14, 1, i * 0.06); }); }
    };
    function startAmbient(b) {
      stopAmbient();
      if (!actx || muted) return;
      try {
        var hz = BIOMES[b].hz / 2;
        var g = actx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.03, actx.currentTime + 1.5);
        var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        var o1 = actx.createOscillator(), o2 = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain();
        o1.type = 'sawtooth'; o1.frequency.value = hz; o2.type = 'triangle'; o2.frequency.value = hz * 1.5;
        lfo.frequency.value = 0.15; lg.gain.value = 300; lfo.connect(lg); lg.connect(lp.frequency);
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
        o1.start(); o2.start(); lfo.start();
        amb = { g: g, os: [o1, o2, lfo] };
      } catch (e) { amb = null; }
    }
    function stopAmbient() {
      if (!amb) return;
      try { var a = amb; a.g.gain.cancelScheduledValues(actx.currentTime); a.g.gain.setTargetAtTime(0, actx.currentTime, 0.2); a.os.forEach(function (o) { o.stop(actx.currentTime + 0.8); }); } catch (e) { }
      amb = null;
    }
    function setMute(m) {
      muted = m; LS.set(GID + '_muted', muted);
      btnMute.textContent = muted ? '\ud83d\udd07' : '\ud83d\udd0a';
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopAmbient(); else if (mode === 'play' && L) { ensureAudio(); startAmbient(L.biome); }
    }

    /* ---------- state ---------- */
    var W = 800, H = 600, dpr = 1;
    var mode = 'menu', paused = false;
    var L = null, ML = null, curLevel = 1, run = null, D = null;
    var shake = 0, shx = 0, shy = 0, hitstop = 0, slowT = 0;
    var levelDeaths = 0, deadT = 0, winT = 0, won = false, lastResult = null;
    var acc = 0, last = 0, raf = 0, ptFlush = 0, idleAcc = 0, wallT = 0;
    var curScreen = '', levelWorld = 0, importTarget = -1;
    var DT = 1 / 120;

    /* ---------- particles (pooled) ---------- */
    var POOL = 900, parts = [], pCursor = 0;
    for (var pi = 0; pi < POOL; pi++) parts.push({ a: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, col: '#fff', kind: 0, rot: 0, vr: 0, g: 0 });
    function emit(x, y, vx, vy, life, size, col, kind, grav) {
      var p = parts[pCursor]; pCursor = (pCursor + 1) % POOL;
      p.a = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col; p.kind = kind || 0; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12; p.g = grav == null ? 600 : grav;
    }
    function burst(x, y, n, col, spd, kind, grav) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.7);
        emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.5, 2 + Math.random() * 3, typeof col === 'function' ? col(i) : col, kind, grav);
      }
    }
    function updateParticles(dt) {
      for (var i = 0; i < POOL; i++) {
        var p = parts[i]; if (!p.a) continue;
        p.life -= dt; if (p.life <= 0) { p.a = false; continue; }
        p.vy += p.g * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    }
    function drawParticles(g) {
      for (var i = 0; i < POOL; i++) {
        var pp = parts[i]; if (!pp.a) continue;
        g.globalAlpha = Math.min(1, pp.life / pp.max * 1.5);
        g.fillStyle = pp.col;
        if (pp.kind === 1) { g.save(); g.translate(pp.x, pp.y); g.rotate(pp.rot); g.fillRect(-pp.size, -pp.size * 0.5, pp.size * 2, pp.size); g.restore(); }
        else g.fillRect(pp.x - pp.size / 2, pp.y - pp.size / 2, pp.size, pp.size);
      }
      g.globalAlpha = 1;
    }
    function clearParticles() { for (var i = 0; i < POOL; i++) parts[i].a = false; }

    /* ---------- economy helpers ---------- */
    function derive() { D = G.derive(S); }
    function idleRate() { return S ? G.idleRate(S) : 0; }
    function upgCost(u) { return Math.floor(u.base * Math.pow(u.g, S.upg[u.k])); }
    function capCost(c, count) {
      var one = c.cur === 'coins' ? 300 + S.bestLevel * 25 : c.cost;
      return count === 10 ? (c.cur === 'coins' ? one * 10 : one * 9) : one;
    }

    /* ---------- quests ---------- */
    function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function ensureDaily() {
      var k = todayKey();
      if (S.daily.date === k && S.daily.list.length === 3) return;
      var seed = 0; for (var i = 0; i < k.length; i++) seed = (seed * 31 + k.charCodeAt(i)) | 0;
      var R = mulberry32(seed + slotIdx * 977), keys = Object.keys(QTYPES), list = [];
      while (list.length < 3) {
        var q = keys[Math.floor(R() * keys.length)];
        if (list.some(function (x) { return x.k === q; })) continue;
        var goal = QTYPES[q].b;
        if (q === 'coinsEarned') goal = Math.round(goal * (1 + S.bestLevel / 30));
        list.push({ k: q, g: goal, s: S.stats[q] || 0, c: false });
      }
      S.daily = { date: k, list: list };
    }
    function repGoal(k) { var r = S.rep[k]; var g = Math.round(QTYPES[k].rb * Math.pow(1.6, r.t)); if (k === 'coinsEarned') g = Math.round(g * (1 + S.bestLevel / 40)); return g; }
    function questReady() {
      if (!S) return 0;
      ensureDaily();
      var n = 0;
      S.daily.list.forEach(function (q) { if (!q.c && S.stats[q.k] - q.s >= q.g) n++; });
      Object.keys(QTYPES).forEach(function (k) { if (S.stats[k] - S.rep[k].base >= repGoal(k)) n++; });
      return n;
    }

    /* ---------- secrets ---------- */
    function checkSecrets() {
      var cond = [S.prestige >= 1, S.prestige >= 3, S.bestLevel >= 1000, S.stats.topClear >= MAX_LEVEL, S.stats.quests >= 50];
      SECRET_IDS.forEach(function (id, i) {
        if (cond[i] && !S.chars[id]) { S.chars[id] = { s: 1, f: 0 }; toast('\ud83d\udd13 Secret unlocked: ' + CHMAP[id].name + '!'); }
      });
    }

    /* ---------- toast & modal ---------- */
    var toastTimer = 0;
    function toast(msg) {
      toastEl.textContent = msg; toastEl.style.opacity = '1';
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2600);
    }
    var modalCb = null;
    function showModal(html, onYes, yesLabel, noLabel) {
      modalCb = onYes || null;
      modal.innerHTML = '<div class="ag-card" style="max-width:560px;width:100%;text-align:center;max-height:90%;overflow:auto">' + html +
        '<div class="ag-row" style="justify-content:center;margin-top:14px">' +
        (onYes ? '<button class="ag-b r" data-m="yes">' + (yesLabel || 'Yes') + '</button><button class="ag-b s" data-m="no">' + (noLabel || 'Cancel') + '</button>'
          : '<button class="ag-b g" data-m="no">' + (noLabel || 'OK') + '</button>') +
        '</div></div>';
      modal.style.display = 'flex';
    }
    function hideModal() { modal.style.display = 'none'; modal.innerHTML = ''; modalCb = null; }
    modal.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      SFX.click();
      var cb = modalCb; hideModal();
      if (b.getAttribute('data-m') === 'yes' && cb) cb();
    });

    /* ---------- resize / fullscreen ---------- */
    function resize() {
      var r = root.getBoundingClientRect();
      W = Math.max(240, Math.round(r.width || container.clientWidth || 800));
      H = Math.max(240, Math.round(r.height || container.clientHeight || 600));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    function toggleFS() {
      try {
        var fe = document.fullscreenElement || document.webkitFullscreenElement;
        if (fe) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
        else { var rq = root.requestFullscreen || root.webkitRequestFullscreen; if (rq) rq.call(root); }
      } catch (e) { }
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(root); }

    /* ---------- run API given to the game ---------- */
    var api = {
      get L() { return L; }, get S() { return S; }, get D() { return D; },
      W: function () { return W; }, H: function () { return H; }, dpr: function () { return dpr; },
      t: function () { return wallT; }, shakeXY: function () { return [shx, shy]; },
      sfx: SFX, tone: tone, noise: noise, emit: emit, burst: burst, drawParticles: drawParticles,
      shake: function (a) { shake = Math.max(shake, a); }, hitstop: function (t) { hitstop = Math.max(hitstop, t); }, slow: function (t) { slowT = Math.max(slowT, t); },
      stat: function (k, n) { if (S.stats[k] != null) S.stats[k] += (n == null ? 1 : n); },
      ch: function () { return CHMAP[S.sel] || CHARS[0]; },
      deaths: function () { return levelDeaths; },
      level: function () { return curLevel; },
      hiScore: function () { return hiScore; },
      playtime: function () { return S ? S.playtime : 0; },
      win: function (info) {
        if (won) return; won = true;
        winT = info.delay || 1.6; slowT = Math.max(slowT, info.slow == null ? 1 : info.slow);
        SFX.win(); shake = Math.max(shake, 8);
        finishLevel(info);
      },
      die: function () {
        if (won || deadT > 0) return;
        deadT = 0.85; levelDeaths++; S.stats.deaths++;
        SFX.die(); shake = Math.max(shake, 14); hitstop = Math.max(hitstop, 0.08);
      }
    };

    /* ---------- level control ---------- */
    function newRun() { won = false; deadT = 0; winT = 0; slowT = 0; hitstop = 0; acc = 0; run = G.newRun(api); }
    function playLevel(n) {
      n = clamp(n | 0, 1, Math.min(MAX_LEVEL, S.maxLevel));
      curLevel = n; L = genLevel(n); derive();
      mode = 'play'; paused = false; levelDeaths = 0;
      clearParticles();
      hideScreen(); newRun();
      ensureAudio(); startAmbient(L.biome);
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); root.focus({ preventScroll: true }); } catch (e) { }
      updateHud();
    }
    function restartLevel() { if (mode !== 'play') return; paused = false; clearParticles(); newRun(); hideScreen(); }
    function toMenu(screen) {
      mode = 'menu'; paused = false; stopAmbient(); run = null;
      ML = genLevel(S ? Math.min(S.maxLevel, MAX_LEVEL) : 1);
      show(screen || 'hub');
    }
    function updateHud() {
      var playing = mode === 'play';
      btnRestart.style.display = playing ? '' : 'none';
      btnMenu.style.display = (playing || (S && curScreen !== 'hub' && curScreen !== 'slots' && curScreen !== 'title')) ? '' : 'none';
    }

    /* ---------- rewards ---------- */
    function finishLevel(info) {
      var n = curLevel;
      var stars = clamp(info.stars | 0, 0, 3), medal = !!info.medal;
      var old = S.medals[n] | 0, oldStars = old & 3;
      S.medals[n] = Math.max(oldStars, stars) | ((old & 4) || (medal ? 4 : 0)) | 8;
      var gained = Math.max(0, stars - oldStars);
      S.stats.stars += gained;
      var first = n >= S.maxLevel && !(old & 8);
      if (n >= S.maxLevel && n < MAX_LEVEL) S.maxLevel = n + 1;
      S.bestLevel = Math.max(S.bestLevel, S.maxLevel);
      S.stats.topClear = Math.max(S.stats.topClear, n);
      var rw = G.rewards(n, L, info, D, first);
      var gems = rw.gems;
      if (L.boss) gems += first ? 25 : 4;
      else if (L.challenge) gems += first ? 3 + L.biome : 1;
      else if (Math.random() < D.gemChance) gems += 1;
      if (medal && !(old & 4)) gems += 1;
      S.coins += rw.coins; S.gems += gems;
      S.stats.clears++; S.stats.coinsEarned += rw.coins;
      if (levelDeaths === 0) S.stats.ndclears++;
      if (L.boss || L.challenge) S.stats.challenges++;
      var newHi = rw.score > hiScore; if (newHi) hiScore = rw.score;
      checkSecrets();
      saveNow();
      lastResult = { n: n, stars: stars, medal: medal, coins: rw.coins, gems: gems, score: rw.score, newHi: newHi, first: first, deaths: levelDeaths, boss: L.boss, challenge: L.challenge, info: info };
    }

    /* ---------- input ---------- */
    function localXY(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function playable() { return mode === 'play' && !paused && run && modal.style.display !== 'flex'; }
    function onPointerDown(e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      ensureAudio();
      try { root.focus({ preventScroll: true }); } catch (er) { }
      if (playable()) {
        if (!amb && !muted) startAmbient(L.biome);
        var p = localXY(e); run.down('pointer', p[0], p[1], e.pointerType);
      }
    }
    function onPointerMove(e) { if (playable() && run.move) { var p = localXY(e); run.move(p[0], p[1], e.pointerType); } }
    function onPointerUp() { if (run) run.up('pointer'); }
    var GAME_KEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, a: 1, d: 1, w: 1, s: 1, A: 1, D: 1, W: 1, S: 1 };
    function onKeyDown(e) {
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') {
        if (mode === 'play' || document.activeElement === root || root.contains(document.activeElement)) e.preventDefault();
        if (!e.repeat) { ensureAudio(); if (playable()) { if (!amb && !muted) startAmbient(L.biome); run.down('key'); } }
        return;
      }
      if (GAME_KEYS[k] && playable() && run.key) { if (k.indexOf('Arrow') === 0) e.preventDefault(); run.key(k.toLowerCase(), true); return; }
      if (e.repeat) return;
      if (modal.style.display === 'flex') { if (k === 'Escape' || k === 'Enter') { e.preventDefault(); var cb = k === 'Enter' ? modalCb : null; hideModal(); if (cb) cb(); } return; }
      if (k === 'r' || k === 'R') {
        if (mode === 'play') restartLevel();
        else if (curScreen === 'results' && lastResult) playLevel(lastResult.n);
      } else if (k === 'Escape') {
        if (mode === 'play') togglePause();
        else if (S && curScreen !== 'hub' && curScreen !== 'slots' && curScreen !== 'title') show('hub');
      } else if (k === 'm' || k === 'M') setMute(!muted);
      else if (k === 'f' || k === 'F') toggleFS();
      else if (k === 'Enter') {
        if (curScreen === 'results' && lastResult) { e.preventDefault(); playLevel(lastResult.n < S.maxLevel ? lastResult.n + 1 : lastResult.n); }
        else if (curScreen === 'title') show('slots');
      }
    }
    function onKeyUp(e) {
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') { if (mode === 'play') e.preventDefault(); if (run) run.up('key'); return; }
      if (GAME_KEYS[k] && run && run.key) run.key(k.toLowerCase(), false);
    }
    function onBlur() { if (run) { run.up('key'); run.up('pointer'); if (run.key) ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].forEach(function (k) { run.key(k, false); }); } }
    function onBeforeUnload() { saveNow(); }
    function onFsChange() { resize(); setTimeout(resize, 120); }
    function togglePause() {
      if (mode !== 'play') return;
      paused = !paused;
      if (paused) { onBlur(); show('pause'); } else hideScreen();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
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
    function onCtx(e) { e.preventDefault(); }
    canvas.addEventListener('contextmenu', onCtx);

    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h]'); if (!b) return;
      ensureAudio(); SFX.click();
      var h = b.getAttribute('data-h');
      if (h === 'fs') toggleFS();
      else if (h === 'mute') setMute(!muted);
      else if (h === 'restart') restartLevel();
      else if (h === 'menu') { if (mode === 'play') togglePause(); else if (S) show('hub'); }
      b.blur();
    });

    /* ---------- screens ---------- */
    function hideScreen() { scr.style.display = 'none'; scr.innerHTML = ''; curScreen = ''; updateHud(); }
    function topBar() {
      return '<div class="ag-top"><div class="ag-row">' +
        '<span class="ag-pill">\ud83e\ude99 ' + fmt(S.coins) + '</span><span class="ag-pill">\ud83d\udc8e ' + fmt(S.gems) + '</span><span class="ag-pill">\u2726 ' + fmt(S.shards) + '</span>' +
        '</div><div class="ag-row"><span class="ag-pill">\u23f1 ' + fmtTime(S.playtime) + '</span><button class="ag-b s" data-a="hub">\u2b05 Hub</button></div></div>';
    }
    function show(name) {
      curScreen = name; scr.style.display = 'block';
      var html = '';
      try { html = SCREENS[name](); } catch (err) { html = '<div class="ag-card">Error: ' + esc(err.message) + '</div>'; }
      scr.innerHTML = '<div class="ag-pn">' + html + '</div>';
      scr.scrollTop = 0;
      if (name === 'chars') paintCharCanvases();
      if (name === 'hub') paintHubChar();
      updateHud();
    }
    function paintCharCanvases() {
      var cvs = scr.querySelectorAll('canvas[data-ch]');
      for (var i = 0; i < cvs.length; i++) {
        var id = cvs[i].getAttribute('data-ch');
        cvs[i].width = 128; cvs[i].height = 128;
        drawCharPreview(cvs[i], CHMAP[id], !S.chars[id], 0.4 + i * 0.3);
      }
    }
    function paintHubChar() {
      var cv = scr.querySelector('canvas[data-hub]');
      if (cv) { if (cv.width !== 160) { cv.width = 160; cv.height = 160; } drawCharPreview(cv, CHMAP[S.sel], false, wallT); }
    }
    function medalStr(m) { var s = m & 3; return '\u2605\u2605\u2605'.slice(0, s) + '\u2606\u2606\u2606'.slice(0, 3 - s) + (m & 4 ? G.medalIcon : ''); }
    function stagesLine(ml) { return ml % 100 === 0 ? '\ud83d\udd25 BOSS STAGE' : ml % 10 === 0 ? '\u2694 CHALLENGE STAGE' : 'Next challenge: level ' + (Math.ceil(ml / 10) * 10); }

    var SCREENS = {
      title: function () {
        return '<div class="ag-h1">' + esc(TITLE.toUpperCase()) + '</div><div class="ag-sub">' + G.subtitle + '</div>' +
          '<div class="ag-card" style="max-width:640px;margin:0 auto"><div class="ag-h2">\ud83c\udfae How to Play</div>' + G.howTo +
          '<div style="line-height:2;margin-top:6px"><div><span class="ag-k">R</span> Restart level &nbsp; <span class="ag-k">Esc</span> Pause &nbsp; <span class="ag-k">M</span> Mute &nbsp; <span class="ag-k">F</span> Fullscreen &nbsp; <span class="ag-k">Enter</span> Next level</div></div>' +
          '<div style="margin-top:10px;font-size:14px;opacity:.85;line-height:1.55">Clear levels for coins, buy upgrades, open capsules with gems, finish quests, and Rebirth after level 100 for Ascension Shards. Every 10th level is a Challenge, and every 100th is a Boss stage.</div>' +
          '<div style="text-align:center;margin-top:16px"><button class="ag-b big g" data-a="toslots">\u25b6 START</button></div></div>' +
          '<div class="ag-sub" style="margin-top:12px">\ud83c\udfc6 Best score: ' + fmt(hiScore) + ' \u00b7 \u23f1 Total playtime: ' + fmtTime(gPT) + '</div>';
      },
      slots: function () {
        var h = '<div class="ag-h1" style="font-size:34px">Save Slots</div><div class="ag-sub">Pick a slot. Progress auto-saves on every clear, purchase and exit.</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        for (var i = 0; i < 3; i++) {
          var s = slots[i];
          h += '<div class="ag-card"><div class="ag-h2">Slot ' + (i + 1) + '</div>';
          if (s) {
            h += '<div style="line-height:1.7;font-size:14px">\ud83d\uddfa Level <b>' + s.maxLevel + '</b> / ' + MAX_LEVEL + ' \u00b7 ' + BIOMES[Math.min(19, Math.floor((s.maxLevel - 1) / 100))].name +
              '<br>\ud83e\ude99 ' + fmt(s.coins) + ' \u00b7 \ud83d\udc8e ' + fmt(s.gems) + ' \u00b7 \u2726 ' + fmt(s.shards) +
              '<br>' + G.unitIcon + ' ' + Object.keys(s.chars).length + '/' + CHARS.length + ' ' + G.unitName.toLowerCase() + ' \u00b7 Rebirths: ' + s.prestige +
              '<br>\u23f1 ' + fmtTime(s.playtime) + '</div>' +
              '<div class="ag-row" style="margin-top:10px"><button class="ag-b g" data-a="slotplay" data-v="' + i + '">\u25b6 Play</button>' +
              '<button class="ag-b y" data-a="slotreset" data-v="' + i + '">Reset</button><button class="ag-b r" data-a="slotdel" data-v="' + i + '">Delete</button></div>';
          } else {
            h += '<div style="opacity:.7;margin:18px 0">Empty \u2014 New Save</div><div class="ag-row"><button class="ag-b g" data-a="slotplay" data-v="' + i + '">\u271a New Save</button></div>';
          }
          h += '<div class="ag-row" style="margin-top:8px"><button class="ag-b c" data-a="slotexp" data-v="' + i + '"' + (s ? '' : ' disabled') + '>\u2b07 Export Save</button><button class="ag-b s" data-a="slotimp" data-v="' + i + '">\u2b06 Import Save</button></div></div>';
        }
        return h + '</div><div style="text-align:center;margin-top:14px"><button class="ag-b s" data-a="totitle">\u2754 How to Play</button></div>' +
          '<div class="ag-sub" style="margin-top:10px">\ud83c\udfc6 Best score: ' + fmt(hiScore) + ' \u00b7 \u23f1 Total playtime: ' + fmtTime(gPT) + '</div>';
      },
      hub: function () {
        var ml = Math.min(S.maxLevel, MAX_LEVEL), b = BIOMES[Math.floor((ml - 1) / 100)], ch = CHMAP[S.sel], st = S.chars[S.sel].s;
        var qr = questReady();
        return '<div class="ag-top"><div class="ag-row"><span class="ag-pill">\ud83e\ude99 ' + fmt(S.coins) + '</span><span class="ag-pill">\ud83d\udc8e ' + fmt(S.gems) + '</span><span class="ag-pill">\u2726 ' + fmt(S.shards) + '</span></div>' +
          '<div class="ag-row"><span class="ag-pill">Slot ' + (slotIdx + 1) + '</span><span class="ag-pill">\u23f1 ' + fmtTime(S.playtime) + '</span></div></div>' +
          '<div class="ag-h1" style="font-size:clamp(26px,5vw,44px)">' + esc(TITLE.toUpperCase()) + '</div>' +
          '<div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:10px">' +
          '<div class="ag-card" style="text-align:center"><div style="opacity:.8">World ' + (Math.floor((ml - 1) / 100) + 1) + ' \u00b7 ' + b.name + '</div>' +
          '<div style="font-size:40px;font-weight:900;margin:4px 0">Level ' + ml + '</div>' +
          '<div class="ag-bar" style="margin:6px 0 12px"><i style="width:' + (ml / MAX_LEVEL * 100).toFixed(2) + '%"></i></div>' +
          '<button class="ag-b big g" data-a="play" style="width:100%">\u25b6 PLAY LEVEL ' + ml + '</button>' +
          '<div style="font-size:13px;opacity:.8;margin-top:8px">' + stagesLine(ml) + '</div></div>' +
          '<div class="ag-card" style="display:flex;gap:12px;align-items:center"><canvas data-hub style="width:96px;height:96px;flex:none"></canvas><div>' +
          '<div style="font-weight:900;font-size:18px;color:' + TIERS[ch.tier].c + '">' + esc(ch.name) + '</div><div style="font-size:13px;opacity:.85">' + TIERS[ch.tier].n + ' \u00b7 ' + '\u2605'.repeat(st) + '</div>' +
          '<div style="font-size:13px;opacity:.85">Perk: ' + G.perkText(ch, st) + '</div>' +
          '<div style="font-size:12px;opacity:.7;margin-top:4px">' + G.hubStats(S, D) + '<br>Coins \u00d7' + D.coinMult.toFixed(2) + ' \u00b7 Idle: ' + fmt(idleRate()) + '/min \u00b7 Best ' + fmt(hiScore) + '</div></div></div></div>' +
          '<div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:12px">' +
          '<button class="ag-b c" data-a="levels">\ud83d\uddfa Level Select</button>' +
          '<button class="ag-b" data-a="chars">' + G.unitIcon + ' ' + G.unitName + '</button>' +
          '<button class="ag-b y" data-a="caps">\ud83c\udf81 Capsules</button>' +
          '<button class="ag-b g" data-a="upg">\u2b06 Upgrades</button>' +
          '<button class="ag-b" data-a="quests">\ud83d\udcdc Quests' + (qr ? ' (' + qr + ')' : '') + '</button>' +
          '<button class="ag-b r" data-a="prestige">\u2726 Rebirth</button>' +
          '<button class="ag-b s" data-a="toslots">\ud83d\udcbe Save &amp; Slots</button>' +
          '<button class="ag-b s" data-a="totitle">\u2754 How to Play</button></div>' +
          '<div class="ag-sub" style="margin-top:12px;font-size:13px">Rebirths: ' + S.prestige + ' \u00b7 Highest level ever: ' + S.bestLevel + ' \u00b7 Total stars: ' + S.stats.stars + ' \u00b7 Total playtime: ' + fmtTime(gPT) + '</div>';
      },
      levels: function () {
        var h = topBar() + '<div class="ag-h2">\ud83d\uddfa Level Select \u2014 World ' + (levelWorld + 1) + ': ' + BIOMES[levelWorld].name + '</div><div class="ag-row" style="margin-bottom:12px">';
        for (var w = 0; w < 20; w++) {
          var lk = w * 100 + 1 > S.maxLevel;
          h += '<button class="ag-b ag-tab ' + (w === levelWorld ? 'c' : 's') + '" data-a="world" data-v="' + w + '"' + (lk ? ' disabled' : '') + ' title="' + BIOMES[w].name + '">' + (lk ? '\ud83d\udd12' : '') + (w + 1) + '</button>';
        }
        h += '</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px">';
        for (var n = levelWorld * 100 + 1; n <= levelWorld * 100 + 100; n++) {
          var locked = n > S.maxLevel, m = S.medals[n] | 0;
          var cls = 'ag-lv' + (n % 100 === 0 ? ' bs' : n % 10 === 0 ? ' ch' : '') + (locked ? ' lk' : '') + (n === S.maxLevel ? ' cur' : '');
          h += '<button class="' + cls + '" data-a="lvl" data-v="' + n + '"' + (locked ? ' disabled' : '') + '>' + (locked ? '\ud83d\udd12' : n) + '<small>' + (locked ? '' : (m ? medalStr(m) : (n % 100 === 0 ? 'BOSS' : n % 10 === 0 ? 'CHAL' : ''))) + '</small></button>';
        }
        return h + '</div><div class="ag-sub" style="margin-top:10px;font-size:13px">Orange = Challenge (gems) \u00b7 Red = Boss \u00b7 ' + G.medalIcon + ' = ' + G.medalName + ' medal \u00b7 ' + G.starHint + '</div>';
      },
      chars: function () {
        var owned = Object.keys(S.chars).length;
        var h = topBar() + '<div class="ag-h2">' + G.unitIcon + ' ' + G.unitName + ' (' + owned + '/' + CHARS.length + ')</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">The equipped one grants its perk. Every star you own adds +0.5% coins (collection bonus: +' + (totalStars(S) * 0.5).toFixed(1) + '%). Duplicates give fragments to level up to 5\u2605.</div>' +
          '<div class="ag-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">';
        CHARS.forEach(function (c) {
          var o = S.chars[c.id], tc = TIERS[c.tier].c;
          h += '<div class="ag-card ag-ch" style="border-color:' + (S.sel === c.id ? '#22d3ee' : tc + '66') + '"><canvas data-ch="' + c.id + '"></canvas>' +
            '<div style="font-weight:900;font-size:14px;color:' + tc + '">' + (o || c.tier < 5 ? esc(c.name) : '???') + '</div><div style="font-size:11px;opacity:.8">' + TIERS[c.tier].n + (c.sub ? ' \u00b7 ' + c.sub : '') + '</div>';
          if (o) {
            var need = o.s < 5 ? STAR_COST[o.s] : 0;
            h += '<div style="font-size:13px;color:#fde047">' + '\u2605'.repeat(o.s) + '<span style="opacity:.3">' + '\u2605'.repeat(5 - o.s) + '</span></div>' +
              '<div style="font-size:11px;opacity:.85">' + G.perkText(c, o.s) + '</div>' +
              (o.s < 5 ? '<div style="font-size:11px;opacity:.7">Fragments ' + o.f + '/' + need + '</div>' : '<div style="font-size:11px;color:#4ade80">MAX</div>') +
              '<div class="ag-row" style="justify-content:center">' + (S.sel === c.id ? '<button class="ag-b c" disabled>Equipped</button>' : '<button class="ag-b c" data-a="equip" data-v="' + c.id + '">Equip</button>') +
              (o.s < 5 ? '<button class="ag-b y" data-a="star" data-v="' + c.id + '"' + (o.f >= need ? '' : ' disabled') + '>\u2605+</button>' : '') + '</div>';
          } else {
            h += '<div style="font-size:11px;opacity:.7">' + (c.tier === 5 ? '\ud83d\udd12 ' + SECRET_HINT[SECRET_IDS.indexOf(c.id)] : '\ud83d\udd12 Find in capsules') + '</div>';
          }
          h += '</div>';
        });
        return h + '</div>';
      },
      caps: function () {
        var h = topBar() + '<div class="ag-h2">\ud83c\udf81 Loot Capsules</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">Duplicates become fragments. Mythic pity: a guaranteed Mythic after 60 Super/Mythic pulls without one (' + S.pity + '/60).</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">';
        CAPS.forEach(function (c, i) {
          var c1 = capCost(c, 1), c10 = capCost(c, 10), have = c.cur === 'coins' ? S.coins : S.gems, sym = c.cur === 'coins' ? '\ud83e\ude99' : '\ud83d\udc8e';
          h += '<div class="ag-card" style="text-align:center;border-color:' + c.col + '"><div style="font-size:54px;filter:drop-shadow(0 0 12px ' + c.col + ')">' + ['\ud83d\udd35', '\ud83d\udfe3', '\ud83d\udd34'][i] + '</div>' +
            '<div style="font-weight:900;font-size:18px;color:' + c.col + '">' + c.n + '</div><div style="font-size:12px;opacity:.85;margin:6px 0;line-height:1.5">' +
            c.odds.map(function (o, t) { return o ? '<span style="color:' + TIERS[t].c + '">' + TIERS[t].n + ' ' + o + '%</span>' : ''; }).filter(Boolean).join(' \u00b7 ') + '</div>' +
            '<div class="ag-row" style="justify-content:center"><button class="ag-b g" data-a="pull" data-v="' + i + ':1"' + (have >= c1 ? '' : ' disabled') + '>Open \u00d71<br>' + sym + ' ' + fmt(c1) + '</button>' +
            '<button class="ag-b y" data-a="pull" data-v="' + i + ':10"' + (have >= c10 ? '' : ' disabled') + '>Open \u00d710<br>' + sym + ' ' + fmt(c10) + '</button></div></div>';
        });
        return h + '</div>';
      },
      upg: function () {
        var h = topBar() + '<div class="ag-h2">\u2b06 Upgrades</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">Costs rise with every level. Upgrades reset on Rebirth; shard perks do not.</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        UPG.forEach(function (u) {
          var lv = S.upg[u.k], mx = lv >= u.max, cost = mx ? 0 : upgCost(u);
          var cur = u.k === 'idle' ? fmt(idleRate()) + '/min' : u.k === 'coin' ? '\u00d7' + (1 + lv * 0.1).toFixed(1) : G.upgCur(u, S, D);
          h += '<div class="ag-card"><div style="display:flex;justify-content:space-between"><b>' + u.n + '</b><span class="ag-pill">Lv ' + lv + '/' + u.max + '</span></div>' +
            '<div style="font-size:12px;opacity:.8;margin:6px 0">' + u.d + '</div><div style="font-size:13px;margin-bottom:6px">Current: <b>' + cur + '</b></div>' +
            '<div class="ag-bar" style="margin-bottom:8px"><i style="width:' + (lv / u.max * 100) + '%"></i></div>' +
            '<div class="ag-row">' + (mx ? '<button class="ag-b" disabled>MAXED</button>' : '<button class="ag-b g" data-a="buy" data-v="' + u.k + '"' + (S.coins >= cost ? '' : ' disabled') + '>Buy \ud83e\ude99 ' + fmt(cost) + '</button><button class="ag-b s" data-a="buymax" data-v="' + u.k + '"' + (S.coins >= cost ? '' : ' disabled') + '>Max</button>') + '</div></div>';
        });
        return h + '</div>';
      },
      quests: function () {
        ensureDaily();
        var h = topBar() + '<div class="ag-h2">\ud83d\udcdc Daily Quests <span style="font-size:13px;opacity:.7">(reset each day)</span></div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        var dc = Math.round(400 * (1 + S.bestLevel / 15));
        S.daily.list.forEach(function (q, i) {
          var pr = Math.max(0, Math.min(q.g, S.stats[q.k] - q.s)), done = pr >= q.g;
          h += '<div class="ag-card"><b>' + QTYPES[q.k].n.replace('{g}', fmt(q.g)) + '</b><div class="ag-bar" style="margin:8px 0"><i style="width:' + (pr / q.g * 100) + '%"></i></div>' +
            '<div class="ag-row" style="justify-content:space-between"><span style="font-size:13px">' + fmt(pr) + '/' + fmt(q.g) + ' \u00b7 \ud83e\ude99' + fmt(dc) + ' \ud83d\udc8e4</span>' +
            (q.c ? '<button class="ag-b" disabled>Claimed</button>' : '<button class="ag-b g" data-a="claimd" data-v="' + i + '"' + (done ? '' : ' disabled') + '>Claim</button>') + '</div></div>';
        });
        h += '</div><div class="ag-h2" style="margin-top:16px">\ud83d\udd01 Repeatable Grind Quests</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        Object.keys(QTYPES).forEach(function (k) {
          var r = S.rep[k], g = repGoal(k), pr = Math.max(0, Math.min(g, S.stats[k] - r.base)), done = pr >= g;
          var rc = Math.round(250 * (1 + S.bestLevel / 20) * (1 + r.t * 0.5)), rg = 2 + r.t;
          h += '<div class="ag-card"><div style="display:flex;justify-content:space-between"><b>' + QTYPES[k].n.replace('{g}', fmt(g)) + '</b><span class="ag-pill">Tier ' + (r.t + 1) + '</span></div><div class="ag-bar" style="margin:8px 0"><i style="width:' + (pr / g * 100) + '%"></i></div>' +
            '<div class="ag-row" style="justify-content:space-between"><span style="font-size:13px">' + fmt(pr) + '/' + fmt(g) + ' \u00b7 \ud83e\ude99' + fmt(rc) + ' \ud83d\udc8e' + rg + '</span><button class="ag-b g" data-a="claimr" data-v="' + k + '"' + (done ? '' : ' disabled') + '>Claim</button></div></div>';
        });
        return h + '</div><div class="ag-sub" style="margin-top:10px;font-size:13px">Quests claimed: ' + S.stats.quests + '</div>';
      },
      prestige: function () {
        var can = S.maxLevel > 100, gain = can ? Math.floor(5 * Math.pow((S.maxLevel - 1) / 100, 1.6)) : 0;
        var h = topBar() + '<div class="ag-h2">\u2726 Rebirth / Ascension</div><div class="ag-card" style="margin-bottom:12px">' +
          '<div style="line-height:1.6;font-size:14px">Rebirth resets your <b>level progress, coins and coin upgrades</b>. You keep ' + G.unitName.toLowerCase() + ', gems, medals, quests and shard perks.<br>' +
          'Each Rebirth adds a permanent <b>+50% coin multiplier</b>, and every shard you have ever earned adds +2% more.<br>Current global bonus: <b>\u00d7' + (1 + S.prestige * 0.5 + S.shardsTotal * 0.02).toFixed(2) + '</b> \u00b7 Rebirths: ' + S.prestige + '</div>' +
          '<div style="margin-top:10px;font-size:16px">' + (can ? 'Rebirth now for <b style="color:#22d3ee">\u2726 ' + gain + ' Ascension Shards</b>' : 'Clear level 100 to unlock Rebirth (current: level ' + S.maxLevel + ')') + '</div>' +
          '<div style="margin-top:10px"><button class="ag-b r big" data-a="doprestige"' + (can ? '' : ' disabled') + '>\u2726 REBIRTH</button></div></div>' +
          '<div class="ag-h2">Shard Perks</div><div class="ag-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">';
        PERKS.forEach(function (p) {
          var lv = S.perks[p.k], mx = lv >= p.max, c = p.c(lv);
          h += '<div class="ag-card"><div style="display:flex;justify-content:space-between"><b>' + p.n + '</b><span class="ag-pill">' + lv + '/' + p.max + '</span></div><div style="font-size:12px;opacity:.8;margin:6px 0">' + p.d + '</div>' +
            (mx ? '<button class="ag-b" disabled>MAXED</button>' : '<button class="ag-b c" data-a="perk" data-v="' + p.k + '"' + (S.shards >= c ? '' : ' disabled') + '>Buy \u2726 ' + c + '</button>') + '</div>';
        });
        return h + '</div>';
      },
      pause: function () {
        return '<div class="ag-card" style="max-width:420px;margin:40px auto;text-align:center"><div class="ag-h2">\u23f8 Paused</div><div style="opacity:.8;margin-bottom:12px">Level ' + curLevel + ' \u00b7 ' + BIOMES[L.biome].name + '</div>' +
          '<div class="ag-grid"><button class="ag-b g big" data-a="resume">\u25b6 Resume</button><button class="ag-b y" data-a="restart">\u21bb Restart Level</button><button class="ag-b s" data-a="levels2">\ud83d\uddfa Level Select</button><button class="ag-b s" data-a="tohub">\ud83c\udfe0 Exit to Hub</button></div>' +
          '<div style="font-size:13px;opacity:.7;margin-top:10px">\u23f1 Playtime ' + fmtTime(S.playtime) + '</div></div>';
      },
      results: function () {
        var r = lastResult; if (!r) return '';
        var next = r.n < S.maxLevel;
        return '<div class="ag-card" style="max-width:480px;margin:20px auto;text-align:center">' +
          '<div style="font-size:14px;opacity:.8">' + (r.boss ? '\ud83d\udd25 BOSS STAGE' : r.challenge ? '\u2694 CHALLENGE STAGE' : 'LEVEL COMPLETE') + '</div>' +
          '<div class="ag-h1" style="font-size:40px">Level ' + r.n + '</div>' +
          '<div style="font-size:44px;color:#fde047;letter-spacing:4px;animation:agpop .5s both">' + '\u2605'.repeat(r.stars) + '<span style="opacity:.25">' + '\u2605'.repeat(3 - r.stars) + '</span></div>' +
          (r.medal ? '<div style="color:#22d3ee;font-weight:900">' + G.medalIcon + ' ' + G.medalName.toUpperCase() + ' MEDAL ' + G.medalIcon + '</div>' : '') +
          '<div style="line-height:1.8;margin:10px 0;font-size:15px">' + G.resultLines(r.info) + '<br>\ud83d\udc80 Deaths ' + r.deaths + '<br>' +
          '<b style="color:#fde047">+\ud83e\ude99 ' + fmt(r.coins) + '</b>' + (r.gems ? ' \u00b7 <b style="color:#67e8f9">+\ud83d\udc8e ' + r.gems + '</b>' : '') + (r.first ? ' <span style="color:#4ade80">(first clear \u00d72)</span>' : '') +
          '<br>Score ' + fmt(r.score) + (r.newHi ? ' <b style="color:#fb7185">NEW BEST!</b>' : ' \u00b7 Best ' + fmt(hiScore)) + '</div>' +
          '<div class="ag-row" style="justify-content:center">' + (next ? '<button class="ag-b g big" data-a="next">Next \u25b6</button>' : '') +
          '<button class="ag-b y" data-a="replay">\u21bb Replay</button><button class="ag-b s" data-a="tohub">\ud83c\udfe0 Hub</button></div>' +
          '<div style="font-size:12px;opacity:.6;margin-top:8px">Enter = Next \u00b7 R = Replay</div></div>';
      }
    };

    /* ---------- actions ---------- */
    function loadSlot(i) {
      slotIdx = i;
      if (!slots[i]) slots[i] = newSave();
      S = normalizeSave(slots[i]); slots[i] = S;
      derive(); ensureDaily(); checkSecrets();
      var mins = Math.min(480, Math.max(0, (Date.now() - S.lastSeen) / 60000));
      var earned = Math.floor(idleRate() * mins);
      S.lastSeen = Date.now();
      saveNow();
      toMenu('hub');
      if (earned > 0 && mins > 1) { S.coins += earned; saveNow(); show('hub'); showModal('<div class="ag-h2">\ud83d\udca4 Offline Earnings</div><div>Your Idle Generator earned <b style="color:#fde047">\ud83e\ude99 ' + fmt(earned) + '</b> while you were away (' + fmtTime(mins * 60) + ').</div>'); }
    }
    function doPull(ci, count) {
      var c = CAPS[ci], cost = capCost(c, count);
      var have = c.cur === 'coins' ? S.coins : S.gems;
      if (have < cost) { SFX.err(); return; }
      if (c.cur === 'coins') S.coins -= cost; else S.gems -= cost;
      var results = [], best = 0;
      for (var k = 0; k < count; k++) {
        var tier = 0, r = Math.random() * 100, a = 0;
        for (var t = 0; t < 5; t++) { a += c.odds[t]; if (r < a) { tier = t; break; } }
        if (c.odds[4] > 0) { if (tier === 4) S.pity = 0; else { S.pity++; if (S.pity >= 60) { tier = 4; S.pity = 0; } } }
        var pool = CHARS.filter(function (x) { return x.tier === tier; });
        var ch = pool[Math.floor(Math.random() * pool.length)];
        var isNew = !S.chars[ch.id];
        if (isNew) S.chars[ch.id] = { s: 1, f: 0 }; else S.chars[ch.id].f += TIERS[tier].frag;
        S.stats.pulls++;
        results.push({ ch: ch, isNew: isNew });
        if (tier > best) best = tier;
      }
      SFX.pull(best);
      derive(); saveNow();
      var html = '<div class="ag-h2">' + c.n + ' \u00d7' + count + '</div><div>';
      results.forEach(function (r, i) {
        html += '<div class="ag-pull" style="border-color:' + TIERS[r.ch.tier].c + ';animation-delay:' + (i * 0.07) + 's"><canvas data-pc="' + r.ch.id + '" width="96" height="96" style="width:60px;height:60px"></canvas>' +
          '<div style="font-size:11px;font-weight:900;color:' + TIERS[r.ch.tier].c + '">' + esc(r.ch.name) + '</div><div style="font-size:10px">' + (r.isNew ? '<b style="color:#4ade80">NEW!</b>' : '+' + TIERS[r.ch.tier].frag + ' frags') + '</div></div>';
      });
      html += '</div>';
      show('caps');
      showModal(html, null, null, 'Awesome!');
      var cvs = modal.querySelectorAll('canvas[data-pc]');
      for (var q = 0; q < cvs.length; q++) drawCharPreview(cvs[q], CHMAP[cvs[q].getAttribute('data-pc')], false, q * 0.5);
      if (best >= 3) toast(best >= 4 ? '\ud83c\udf08 MYTHIC PULL!' : '\u2728 Legendary pull!');
    }
    function exportSlot(i) {
      var s = slots[i]; if (!s) return;
      if (i === slotIdx && S) { saveNow(); s = S; }
      try {
        var blob = new Blob([JSON.stringify({ game: GID, version: 1, exported: new Date().toISOString(), data: s }, null, 1)], { type: 'application/json' });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = GID + '_slot' + (i + 1) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        toast('Save exported \u2b07');
      } catch (e) { toast('Export failed'); }
    }
    function onFile() {
      var f = fileIn.files && fileIn.files[0]; if (!f || importTarget < 0) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var o = JSON.parse(rd.result);
          var data = o && o.game === GID && o.data ? o.data : (o && typeof o.maxLevel === 'number' && !o.game ? o : null);
          if (!data) throw new Error('bad');
          var apply = function () {
            slots[importTarget] = normalizeSave(data);
            if (importTarget === slotIdx) { S = slots[importTarget]; derive(); }
            persistSlots(); show('slots'); toast('Save imported into Slot ' + (importTarget + 1) + ' \u2b06');
          };
          if (slots[importTarget]) showModal('<div class="ag-h2">Overwrite Slot ' + (importTarget + 1) + '?</div><div>The current save in this slot will be replaced.</div>', apply, 'Overwrite');
          else apply();
        } catch (e) { showModal('<div class="ag-h2">Import failed</div><div>That file is not a valid ' + esc(TITLE) + ' save.</div>'); }
        fileIn.value = '';
      };
      rd.readAsText(f);
    }
    fileIn.addEventListener('change', onFile);

    scr.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      ensureAudio(); SFX.click();
      var a = b.getAttribute('data-a'), v = b.getAttribute('data-v');
      var i = v != null ? parseInt(v, 10) : -1;
      switch (a) {
        case 'toslots': if (S) saveNow(); show('slots'); break;
        case 'totitle': show('title'); break;
        case 'hub': show('hub'); break;
        case 'slotplay': loadSlot(i); break;
        case 'slotreset':
          showModal('<div class="ag-h2">Reset Slot ' + (i + 1) + '?</div><div>This wipes all progress in this slot and starts a fresh save.</div>', function () {
            slots[i] = newSave(); if (slotIdx === i) { S = slots[i]; derive(); } persistSlots(); show('slots'); toast('Slot ' + (i + 1) + ' reset');
          }, 'Reset'); break;
        case 'slotdel':
          showModal('<div class="ag-h2">Delete Slot ' + (i + 1) + '?</div><div>This permanently deletes this save.</div>', function () {
            slots[i] = null; if (slotIdx === i) { S = null; slotIdx = -1; } persistSlots(); show('slots'); toast('Slot ' + (i + 1) + ' deleted');
          }, 'Delete'); break;
        case 'slotexp': exportSlot(i); break;
        case 'slotimp': importTarget = i; fileIn.click(); break;
        case 'play': playLevel(S.maxLevel); break;
        case 'levels': levelWorld = Math.min(19, Math.floor((Math.min(S.maxLevel, MAX_LEVEL) - 1) / 100)); show('levels'); break;
        case 'levels2': mode = 'menu'; run = null; stopAmbient(); ML = L; levelWorld = Math.floor((curLevel - 1) / 100); show('levels'); break;
        case 'world': levelWorld = i; show('levels'); break;
        case 'lvl': playLevel(i); break;
        case 'chars': show('chars'); break;
        case 'equip': if (S.chars[v]) { S.sel = v; derive(); saveNow(); show('chars'); } break;
        case 'star': {
          var o = S.chars[v]; if (o && o.s < 5 && o.f >= STAR_COST[o.s]) { o.f -= STAR_COST[o.s]; o.s++; SFX.buy(); derive(); saveNow(); toast(CHMAP[v].name + ' is now ' + o.s + '\u2605!'); show('chars'); }
        } break;
        case 'caps': show('caps'); break;
        case 'pull': { var pv = v.split(':'); doPull(+pv[0], +pv[1]); } break;
        case 'upg': show('upg'); break;
        case 'buy': case 'buymax': {
          var u = UPG.filter(function (x) { return x.k === v; })[0], bought = 0;
          while (u && S.upg[u.k] < u.max && S.coins >= upgCost(u)) { S.coins -= upgCost(u); S.upg[u.k]++; bought++; if (a === 'buy') break; }
          if (bought) { SFX.buy(); derive(); saveNow(); } else SFX.err();
          show('upg');
        } break;
        case 'quests': show('quests'); break;
        case 'claimd': {
          var q = S.daily.list[i];
          if (q && !q.c && S.stats[q.k] - q.s >= q.g) { q.c = true; var dc = Math.round(400 * (1 + S.bestLevel / 15)); S.coins += dc; S.gems += 4; S.stats.quests++; SFX.buy(); checkSecrets(); saveNow(); toast('+\ud83e\ude99' + fmt(dc) + ' +\ud83d\udc8e4'); }
          show('quests');
        } break;
        case 'claimr': {
          var r = S.rep[v], g = repGoal(v);
          if (r && S.stats[v] - r.base >= g) {
            var rc = Math.round(250 * (1 + S.bestLevel / 20) * (1 + r.t * 0.5)), rg = 2 + r.t;
            S.coins += rc; S.gems += rg; r.t++; r.base = S.stats[v]; S.stats.quests++; SFX.buy(); checkSecrets(); saveNow(); toast('+\ud83e\ude99' + fmt(rc) + ' +\ud83d\udc8e' + rg);
          }
          show('quests');
        } break;
        case 'prestige': show('prestige'); break;
        case 'doprestige': {
          if (S.maxLevel <= 100) break;
          var gain = Math.floor(5 * Math.pow((S.maxLevel - 1) / 100, 1.6));
          showModal('<div class="ag-h2">\u2726 Rebirth?</div><div>Reset levels, coins and upgrades for <b>\u2726 ' + gain + '</b> Ascension Shards and a permanent multiplier boost.</div>', function () {
            S.shards += gain; S.shardsTotal += gain; S.prestige++;
            S.coins = 0; UPG.forEach(function (u) { S.upg[u.k] = 0; });
            S.maxLevel = clamp(1 + S.perks.start * 100, 1, Math.min(MAX_LEVEL, S.bestLevel));
            checkSecrets(); derive(); saveNow(); SFX.win();
            toast('\u2726 Reborn! Rebirth #' + S.prestige); show('prestige');
          }, 'Rebirth');
        } break;
        case 'perk': {
          var p = PERKS.filter(function (x) { return x.k === v; })[0];
          if (p && S.perks[p.k] < p.max && S.shards >= p.c(S.perks[p.k])) { S.shards -= p.c(S.perks[p.k]); S.perks[p.k]++; SFX.buy(); derive(); saveNow(); }
          show('prestige');
        } break;
        case 'resume': paused = false; hideScreen(); break;
        case 'restart': restartLevel(); break;
        case 'tohub': saveNow(); toMenu('hub'); break;
        case 'next': playLevel(lastResult.n + 1); break;
        case 'replay': playLevel(lastResult.n); break;
      }
    });

    /* ---------- main loop ---------- */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      var dtr = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      wallT += dtr;
      if (S && !document.hidden) {
        S.playtime += dtr; gPT += dtr; ptFlush += dtr;
        var ir = idleRate();
        if (ir > 0) { idleAcc += dtr * ir / 60; if (idleAcc >= 1) { var add = Math.floor(idleAcc); S.coins += add; idleAcc -= add; } }
        if (ptFlush > 5) { ptFlush = 0; flushPT(); }
      }
      if (mode === 'play' && run) {
        if (!paused) {
          if (hitstop > 0) hitstop -= dtr;
          else {
            var sc = slowT > 0 ? 0.25 : 1;
            if (slowT > 0) slowT -= dtr;
            acc += dtr * sc;
            var steps = 0;
            while (acc >= DT && steps < 10 && run) { run.step(DT); acc -= DT; steps++; }
            if (steps >= 10) acc = 0;
          }
          if (deadT > 0) { deadT -= dtr; if (deadT <= 0 && run) { if (!(run.respawn && run.respawn())) { clearParticles(); newRun(); } } }
          if (winT > 0) { winT -= dtr; if (winT <= 0) { mode = 'menu'; stopAmbient(); ML = L; run = null; show('results'); } }
        }
        updateParticles(dtr * (slowT > 0 ? 0.4 : 1));
      } else updateParticles(dtr);
      if (shake > 0) { shx = (Math.random() - 0.5) * shake; shy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dtr * 60); } else { shx = shy = 0; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (mode === 'play' && run) run.render(ctx);
      else G.renderMenu(ctx, ML, W, H, dpr, wallT, dtr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (curScreen === 'hub' && Math.floor(wallT * 10) % 3 === 0) paintHubChar();
    }

    var autoSave = setInterval(function () { if (S) saveNow(); }, 20000);

    /* ---------- boot ---------- */
    resize();
    setMute(muted);
    ML = genLevel(1);
    show('title');
    raf = requestAnimationFrame(frame);
    try { Object.defineProperty(root, '__ag', { value: { st: function () { return { run: run, L: L, D: D, S: S, mode: mode, last: lastResult }; }, play: playLevel, load: loadSlot, stepN: function (n) { for (var i = 0; i < n && run && mode === 'play'; i++) run.step(DT); } } }); } catch (e) { }

    /* ---------- cleanup ---------- */
    return function cleanup() {
      try { saveNow(); } catch (e) { }
      cancelAnimationFrame(raf);
      clearInterval(autoSave);
      clearTimeout(toastTimer);
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
      fileIn.removeEventListener('change', onFile);
      if (ro) ro.disconnect();
      try { if (document.fullscreenElement === root) document.exitFullscreen(); } catch (e) { }
      stopAmbient();
      try { if (actx) actx.close(); } catch (e) { }
      run = null;
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
    description: G.reg.description,
    category: G.reg.category,
    icon: createGameIcon(),
    bannerGradient: G.reg.bannerGradient,
    controls: G.reg.controls,
    start: function (container) { return startGame(container); }
  });
})();
