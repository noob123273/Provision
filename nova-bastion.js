/* =====================================================================
   NOVA BASTION - an original vertical space shooter
   2,000 seeded sectors - 20 galaxies - 62 ships - capsules - upgrades
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
  /*  NOVA BASTION: vertical auto-fire space shooter                     */
  /* ================================================================== */
  var GID = 'nova-bastion';
  var TITLE = 'Nova Bastion';
  var FW = 600, FH = 900; // playfield in world units

  var BIOMES = makeBiomes([
    ['Orion Gate', '#020617', '#1e3a8a', '#60a5fa', '#1d4ed8', '#93c5fd', 'nebula', 196],
    ['Crimson Nebula', '#1a0505', '#7f1d1d', '#f87171', '#b91c1c', '#fecaca', 'nebula', 165],
    ['Ion Storm', '#020617', '#164e63', '#22d3ee', '#0e7490', '#a5f3fc', 'storm', 247],
    ['Amber Drift', '#1c1003', '#78350f', '#fbbf24', '#b45309', '#fde68a', 'rocks', 174],
    ['Verdant Rift', '#022c22', '#14532d', '#4ade80', '#15803d', '#bbf7d0', 'nebula', 220],
    ['Violet Expanse', '#0f0326', '#4c1d95', '#c084fc', '#6d28d9', '#e9d5ff', 'nebula', 277],
    ['Solar Corona', '#1c0a00', '#9a3412', '#fb923c', '#ea580c', '#fed7aa', 'storm', 130],
    ['Frozen Halo', '#020617', '#0c4a6e', '#bae6fd', '#0369a1', '#e0f2fe', 'rocks', 294],
    ['Toxic Cloud', '#0a1405', '#3f6212', '#a3e635', '#4d7c0f', '#d9f99d', 'nebula', 110],
    ['Rose Quasar', '#1a0510', '#831843', '#f472b6', '#be185d', '#fbcfe8', 'storm', 311],
    ['Abyss Lanes', '#000000', '#0f172a', '#38bdf8', '#1e293b', '#94a3b8', 'rocks', 98],
    ['Gold Cluster', '#140f00', '#713f12', '#fde047', '#a16207', '#fef9c3', 'nebula', 349],
    ['Plasma Sea', '#05051a', '#312e81', '#818cf8', '#4338ca', '#c7d2fe', 'storm', 185],
    ['Ember Fields', '#120202', '#450a0a', '#ef4444', '#991b1b', '#fca5a5', 'rocks', 123],
    ['Aurora Belt', '#011614', '#115e59', '#2dd4bf', '#0f766e', '#99f6e4', 'nebula', 233],
    ['Void Reach', '#000000', '#1e1b4b', '#a78bfa', '#312e81', '#ddd6fe', 'storm', 138],
    ['Crystal Ring', '#020617', '#155e75', '#67e8f9', '#0891b2', '#cffafe', 'rocks', 330],
    ['Inferno Star', '#1a0500', '#7c2d12', '#fdba74', '#c2410c', '#ffedd5', 'storm', 147],
    ['Prism Galaxy', '#0a0014', '#581c87', '#f0abfc', '#a21caf', '#fae8ff', 'nebula', 262],
    ['Final Bastion', '#000000', '#1c1917', '#fde68a', '#44403c', '#fef3c7', 'storm', 392]
  ]);

  // id, name, tier, hull, accent, shape, weapon, engine/trail, aura
  var CHAR_ROWS = [
    ['scout', 'Scout', 0, '#cbd5e1', '#38bdf8', 'dart', 'single', '#38bdf8', ''],
    ['redwing', 'Redwing', 0, '#ef4444', '#fecaca', 'delta', 'single', '#f87171', ''],
    ['sparrow', 'Sparrow', 0, '#a3e635', '#365314', 'bird', 'single', '#bef264', ''],
    ['comet', 'Comet', 0, '#facc15', '#713f12', 'arrow', 'single', '#fde047', ''],
    ['minnow', 'Minnow', 0, '#22d3ee', '#164e63', 'dart', 'twin', '#67e8f9', ''],
    ['bramble', 'Bramble', 0, '#16a34a', '#052e16', 'claw', 'single', '#4ade80', ''],
    ['ember', 'Ember', 0, '#fb923c', '#7c2d12', 'delta', 'single', '#fdba74', ''],
    ['slate', 'Slate Hawk', 0, '#64748b', '#e2e8f0', 'bird', 'twin', '#94a3b8', ''],
    ['petal', 'Petal', 0, '#f472b6', '#831843', 'crescent', 'single', '#f9a8d4', ''],
    ['tug', 'Tugboat', 0, '#a16207', '#fde68a', 'saucer', 'single', '#fbbf24', ''],
    ['dot', 'Dot', 0, '#e2e8f0', '#6366f1', 'orb', 'single', '#a5b4fc', ''],
    ['marlin', 'Marlin', 0, '#0ea5e9', '#082f49', 'arrow', 'twin', '#7dd3fc', ''],
    ['beetle', 'Beetle', 0, '#65a30d', '#fde047', 'claw', 'twin', '#a3e635', ''],
    ['cinder', 'Cinder', 0, '#78716c', '#f97316', 'delta', 'single', '#fb923c', ''],
    ['glimmer', 'Glimmer', 0, '#c084fc', '#3b0764', 'dart', 'single', '#d8b4fe', ''],
    ['pip', 'Pip', 0, '#fde68a', '#b45309', 'orb', 'twin', '#fef3c7', ''],
    ['vanguard', 'Vanguard', 1, '#94a3b8', '#ef4444', 'delta', 'spread', '#f87171', ''],
    ['falcon', 'Falcon', 1, '#e2e8f0', '#0ea5e9', 'bird', 'twin', '#38bdf8', ''],
    ['wasp', 'Wasp', 1, '#facc15', '#111827', 'claw', 'spread', '#fde047', ''],
    ['manta', 'Manta', 1, '#0f766e', '#5eead4', 'crescent', 'wave', '#2dd4bf', ''],
    ['saucer', 'Little Saucer', 1, '#a5b4fc', '#4338ca', 'saucer', 'homing', '#c7d2fe', ''],
    ['javelin', 'Javelin', 1, '#f8fafc', '#dc2626', 'arrow', 'laser', '#fca5a5', ''],
    ['raptor', 'Raptor', 1, '#57534e', '#facc15', 'bird', 'spread', '#fbbf24', ''],
    ['nimbus', 'Nimbus', 1, '#bae6fd', '#0284c7', 'orb', 'wave', '#e0f2fe', ''],
    ['corsair', 'Corsair', 1, '#7f1d1d', '#fbbf24', 'claw', 'twin', '#f59e0b', ''],
    ['lancer', 'Lancer', 1, '#4f46e5', '#e0e7ff', 'dart', 'laser', '#818cf8', ''],
    ['hornet', 'Hornet', 1, '#ea580c', '#1c1917', 'delta', 'homing', '#fb923c', ''],
    ['kite', 'Kite', 1, '#ec4899', '#fdf2f8', 'crescent', 'spread', '#f9a8d4', ''],
    ['tortoise', 'Tortoise', 1, '#15803d', '#bbf7d0', 'saucer', 'twin', '#4ade80', ''],
    ['zephyr', 'Zephyr', 1, '#99f6e4', '#0f766e', 'arrow', 'wave', '#5eead4', ''],
    ['nightfang', 'Nightfang', 2, '#18181b', '#a78bfa', 'claw', 'laser', '#a78bfa', '#7c3aed'],
    ['solaris', 'Solaris', 2, '#fbbf24', '#7c2d12', 'delta', 'spread', 'fire', '#f59e0b'],
    ['frostbite', 'Frostbite', 2, '#e0f2fe', '#0369a1', 'crescent', 'wave', '#bae6fd', '#67e8f9'],
    ['viper', 'Viper', 2, '#22c55e', '#052e16', 'arrow', 'homing', '#4ade80', '#22c55e'],
    ['tempest', 'Tempest', 2, '#60a5fa', '#1e3a8a', 'bird', 'spread', 'spark', '#60a5fa'],
    ['eclipse', 'Eclipse', 2, '#0f172a', '#fde047', 'orb', 'laser', '#fde047', '#facc15'],
    ['pulsar', 'Pulsar', 2, '#e879f9', '#701a75', 'saucer', 'wave', '#f0abfc', '#d946ef'],
    ['ironclad', 'Ironclad', 2, '#71717a', '#f97316', 'delta', 'twin', 'fire', '#f97316'],
    ['seeker', 'Seeker', 2, '#14b8a6', '#f0fdfa', 'dart', 'homing', '#5eead4', '#14b8a6'],
    ['harpy', 'Harpy', 2, '#be123c', '#fecdd3', 'bird', 'spread', '#fb7185', '#e11d48'],
    ['quasar', 'Quasar', 2, '#c4b5fd', '#4c1d95', 'crescent', 'laser', 'spark', '#a78bfa'],
    ['bulwark', 'Bulwark', 2, '#475569', '#22d3ee', 'saucer', 'spread', '#22d3ee', '#0ea5e9'],
    ['goldwing', 'Goldwing', 3, '#fbbf24', '#fffbeb', 'bird', 'spread', '#fde047', '#fbbf24'],
    ['stormbreaker', 'Stormbreaker', 3, '#3b82f6', '#fde047', 'claw', 'laser', 'spark', '#60a5fa'],
    ['dragonfly', 'Dragonfly', 3, '#10b981', '#ecfdf5', 'dart', 'wave', '#6ee7b7', '#10b981'],
    ['sunlance', 'Sunlance', 3, '#fff7ed', '#ea580c', 'arrow', 'laser', 'fire', '#fb923c'],
    ['glacier', 'Glacier Queen', 3, '#cffafe', '#0e7490', 'crescent', 'homing', '#a5f3fc', '#67e8f9'],
    ['warlord', 'Warlord', 3, '#7f1d1d', '#fbbf24', 'delta', 'spread', 'fire', '#ef4444'],
    ['specter', 'Specter', 3, '#c7d2fe', '#312e81', 'orb', 'homing', '#a5b4fc', '#818cf8'],
    ['leviathan', 'Leviathan', 3, '#0f766e', '#fde047', 'saucer', 'wave', '#2dd4bf', '#14b8a6'],
    ['valkyrie', 'Valkyrie', 3, '#f8fafc', '#f472b6', 'bird', 'twin', '#f9a8d4', '#ec4899'],
    ['phoenix', 'Rainbow Phoenix', 4, 'rainbow', '#ffffff', 'bird', 'spread', 'rainbow', '#f472b6'],
    ['singularity', 'Singularity', 4, '#000000', '#a855f7', 'orb', 'laser', '#a855f7', '#a855f7'],
    ['glitchship', 'Glitch Runner', 4, 'glitch', '#111827', 'dart', 'wave', 'glitch', '#4ade80'],
    ['seraph', 'Seraph', 4, '#fef9c3', '#fbbf24', 'crescent', 'homing', 'spark', '#fde68a'],
    ['chronos', 'Chronos', 4, '#14b8a6', '#042f2e', 'claw', 'spread', '#5eead4', '#14b8a6'],
    ['nebulon', 'Nebulon', 4, '#c026d3', '#f0abfc', 'saucer', 'wave', 'rainbow', '#c026d3'],
    ['ascendant', 'Ascendant', 5, '#fde68a', '#ffffff', 'arrow', 'laser', 'rainbow', '#fde68a'],
    ['paradox', 'Paradox', 5, 'glitch', '#f8fafc', 'claw', 'homing', 'glitch', '#f472b6'],
    ['architect', 'The Architect', 5, '#22d3ee', '#0f172a', 'delta', 'spread', 'spark', '#22d3ee'],
    ['omega', 'Omega', 5, '#000000', '#fbbf24', 'orb', 'wave', 'rainbow', '#fbbf24'],
    ['founder', 'Founder', 5, '#4ade80', '#14532d', 'bird', 'homing', '#86efac', '#4ade80']
  ];
  var PERK_CYCLE = ['coin', 'dmg', 'hull', 'gem'];
  var WNAME = { single: 'Blaster', twin: 'Twin', spread: 'Spread', laser: 'Pierce Laser', homing: 'Homing', wave: 'Wave' };
  var CHARS = CHAR_ROWS.map(function (r, i) {
    return { id: r[0], name: r[1], tier: r[2], c: r[3], c2: r[4], shape: r[5], weapon: r[6], tr: r[7], aura: r[8], perk: PERK_CYCLE[i % 4], sub: WNAME[r[6]] };
  });
  var CHMAP = {}; CHARS.forEach(function (c) { CHMAP[c.id] = c; });

  var UPG = [
    { k: 'dmg', n: 'Blaster Damage', d: '+10% damage per level', base: 90, g: 1.3, max: 120 },
    { k: 'rate', n: 'Fire Rate', d: '+3% shots per second per level', base: 120, g: 1.35, max: 40 },
    { k: 'hull', n: 'Hull Plating', d: '+12 max hull per level', base: 100, g: 1.33, max: 50 },
    { k: 'coin', n: 'Coin Multiplier', d: '+10% coins per level', base: 150, g: 1.42, max: 150 },
    { k: 'idle', n: 'Idle Coin Generator', d: 'Earns coins per minute, even offline (8h cap)', base: 250, g: 1.5, max: 80 }
  ];
  var PERKS = [
    { k: 'coin', n: 'Ascended Wealth', d: '+25% coins per rank', c: function (l) { return 2 * (l + 1); }, max: 20 },
    { k: 'start', n: 'Head Start', d: 'After Rebirth, start 100 sectors further per rank', c: function (l) { return 3 * (l + 1); }, max: 19 },
    { k: 'gem', n: 'Gem Sense', d: '+2% gem drop chance per rank', c: function (l) { return 2 * (l + 1); }, max: 10 },
    { k: 'pdmg', n: 'Astral Cannons', d: '+15% permanent damage per rank', c: function (l) { return 2 * (l + 1); }, max: 20 }
  ];
  var QTYPES = {
    kills: { n: 'Destroy {g} enemies', b: 200, rb: 300 },
    bosses: { n: 'Defeat {g} bosses', b: 1, rb: 2 },
    bombs: { n: 'Detonate {g} Nova Bombs', b: 5, rb: 8 },
    clears: { n: 'Clear {g} sectors', b: 6, rb: 10 },
    ndclears: { n: 'Clear {g} sectors without dying', b: 4, rb: 6 },
    coinsEarned: { n: 'Earn {g} coins', b: 3000, rb: 5000 },
    stars: { n: 'Earn {g} new stars', b: 8, rb: 12 },
    challenges: { n: 'Clear {g} Challenge/Boss sectors', b: 2, rb: 3 }
  };
  var CAPS = [
    { k: 'std', n: 'Standard Capsule', cur: 'coins', cost: 0, odds: [70, 24, 5, 1, 0], col: '#38bdf8' },
    { k: 'sup', n: 'Super Capsule', cur: 'gems', cost: 25, odds: [30, 42, 20, 7, 1], col: '#c084fc' },
    { k: 'myt', n: 'Mythic Capsule', cur: 'gems', cost: 90, odds: [0, 25, 45, 24, 6], col: '#fb7185' }
  ];

  /* ---------- ship renderer ---------- */
  function shipPath(g, shape) {
    g.beginPath();
    switch (shape) {
      case 'delta': g.moveTo(0, -22); g.lineTo(20, 16); g.lineTo(6, 10); g.lineTo(0, 16); g.lineTo(-6, 10); g.lineTo(-20, 16); break;
      case 'bird': g.moveTo(0, -20); g.lineTo(6, -6); g.lineTo(24, 2); g.lineTo(22, 10); g.lineTo(6, 8); g.lineTo(0, 18); g.lineTo(-6, 8); g.lineTo(-22, 10); g.lineTo(-24, 2); g.lineTo(-6, -6); break;
      case 'arrow': g.moveTo(0, -26); g.lineTo(8, -4); g.lineTo(16, 18); g.lineTo(4, 12); g.lineTo(0, 18); g.lineTo(-4, 12); g.lineTo(-16, 18); g.lineTo(-8, -4); break;
      case 'claw': g.moveTo(-6, -8); g.lineTo(-14, -22); g.lineTo(-20, 4); g.lineTo(-10, 18); g.lineTo(0, 12); g.lineTo(10, 18); g.lineTo(20, 4); g.lineTo(14, -22); g.lineTo(6, -8); g.lineTo(0, -14); break;
      case 'saucer': g.ellipse(0, 4, 24, 10, 0, 0, 7); g.moveTo(11, 0); g.arc(0, 0, 11, 0, Math.PI, true); break;
      case 'orb': g.arc(0, 0, 14, 0, 7); g.moveTo(24, 6); g.ellipse(0, 6, 24, 6, 0, 0, 7); break;
      case 'crescent': g.moveTo(0, -18); g.quadraticCurveTo(26, -4, 22, 18); g.quadraticCurveTo(12, 4, 0, 6); g.quadraticCurveTo(-12, 4, -22, 18); g.quadraticCurveTo(-26, -4, 0, -18); break;
      default: g.moveTo(0, -24); g.lineTo(10, 6); g.lineTo(18, 18); g.lineTo(0, 12); g.lineTo(-18, 18); g.lineTo(-10, 6);
    }
    g.closePath();
  }
  function drawShip(g, ch, x, y, sc, t, bank, flat) {
    if (ch.aura && !flat) {
      var ar = 34 * sc, gr = g.createRadialGradient(x, y, 2, x, y, ar);
      gr.addColorStop(0, ch.aura + '77'); gr.addColorStop(1, ch.aura + '00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, ar, 0, 7); g.fill();
    }
    g.save(); g.translate(x, y); g.scale(sc * (1 - Math.abs(bank || 0) * 0.25), sc);
    if (!flat) {
      // engine flame
      var fl = 8 + Math.sin(t * 40) * 3;
      g.fillStyle = colorOf(ch.tr, t, 0); g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(-5, 14); g.lineTo(0, 14 + fl * 1.8); g.lineTo(5, 14); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-2.5, 14); g.lineTo(0, 14 + fl); g.lineTo(2.5, 14); g.fill();
      g.globalAlpha = 1;
    }
    shipPath(g, ch.shape);
    g.fillStyle = flat ? '#334155' : colorOf(ch.c, t); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = flat ? '#475569' : colorOf(ch.c2, t, 90); g.lineJoin = 'round'; g.stroke();
    if (!flat) {
      g.fillStyle = colorOf(ch.c2, t, 90); g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(0, -4, 4, 7, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-1, -7, 1.5, 3, 0, 0, 7); g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }
  function drawCharPreview(cv, ch, locked, t) {
    var g = cv.getContext('2d'), w = cv.width;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, cv.height);
    g.save(); g.scale(w / 64, w / 64);
    drawShip(g, ch, 32, 30, 1.15, t || 0.3, 0, locked);
    if (locked) { g.fillStyle = '#e2e8f0'; g.font = 'bold 16px system-ui'; g.textAlign = 'center'; g.fillText('?', 32, 36); }
    g.restore();
  }

  /* ---------- enemy archetypes ---------- */
  var ETYPES = {
    drone: { hp: 20, r: 17, min: 1, w: 5, val: 10 },
    zig: { hp: 16, r: 15, min: 3, w: 3, val: 12 },
    gunner: { hp: 40, r: 19, min: 6, w: 3, val: 20 },
    tank: { hp: 140, r: 28, min: 12, w: 1.5, val: 45 },
    diver: { hp: 24, r: 15, min: 20, w: 2.5, val: 16 },
    spinner: { hp: 70, r: 22, min: 40, w: 1.6, val: 35 },
    splitter: { hp: 50, r: 21, min: 70, w: 1.6, val: 30 },
    sniper: { hp: 35, r: 17, min: 120, w: 1.4, val: 30 }
  };
  var ECOL = { drone: '#94a3b8', zig: '#f472b6', gunner: '#f97316', tank: '#64748b', diver: '#ef4444', spinner: '#a78bfa', splitter: '#22c55e', sniper: '#facc15' };

  /* ---------- deterministic sector generator ---------- */
  function genLevel(n) {
    var R = mulberry32(((n * 3266489917) ^ 0x85ebca6b) >>> 0);
    var d = (n - 1) / (MAX_LEVEL - 1), biome = Math.min(19, Math.floor((n - 1) / 100));
    var boss = n % 100 === 0, challenge = !boss && n % 10 === 0;
    var L = { n: n, d: d, biome: biome, boss: boss, challenge: challenge, waves: [], hpM: 1 + (n - 1) * 0.02, elite: challenge };
    var types = Object.keys(ETYPES).filter(function (k) { return n >= ETYPES[k].min; });
    function pick() {
      var tot = 0; types.forEach(function (k) { tot += ETYPES[k].w; });
      var r = R() * tot; for (var i = 0; i < types.length; i++) { r -= ETYPES[types[i]].w; if (r < 0) return types[i]; }
      return types[0];
    }
    var nw = 3 + Math.floor(d * 4 + R() * 1.5) + (challenge ? 2 : 0) + (boss ? 1 : 0);
    for (var w = 0; w < nw; w++) {
      var wave = [], t1 = pick(), t2 = d > 0.15 && R() < 0.5 ? pick() : t1;
      var cnt = Math.round(4 + R() * 3 + d * 7 + (challenge ? 2 : 0));
      if (t1 === 'tank' || t1 === 'spinner') cnt = Math.max(2, Math.round(cnt * 0.4));
      var form = ['line', 'column', 'v', 'random', 'sides'][Math.floor(R() * 5)];
      for (var i = 0; i < cnt; i++) {
        var ty = i % 2 ? t2 : t1, x, dl;
        var u = cnt > 1 ? i / (cnt - 1) : 0.5;
        switch (form) {
          case 'line': x = 70 + u * (FW - 140); dl = 0; break;
          case 'column': x = (R() < 0.5 ? 0.3 : 0.7) * FW + (i % 2) * 40; dl = i * 0.45; break;
          case 'v': x = 70 + u * (FW - 140); dl = Math.abs(u - 0.5) * 1.6; break;
          case 'sides': x = i % 2 ? 60 + R() * 60 : FW - 60 - R() * 60; dl = Math.floor(i / 2) * 0.5; break;
          default: x = 50 + R() * (FW - 100); dl = i * 0.35 + R() * 0.3;
        }
        wave.push({ type: ty, x: x, delay: dl, seed: R() });
      }
      L.waves.push(wave);
    }
    if (boss) L.waves.push([{ type: 'boss', x: FW / 2, delay: 0.5, seed: R() }]);
    else if (challenge) L.waves.push([{ type: 'tank', x: FW * 0.3, delay: 0, seed: R(), elite: true }, { type: 'tank', x: FW * 0.7, delay: 0, seed: R(), elite: true }, { type: types[types.length - 1], x: FW / 2, delay: 0.6, seed: R(), elite: true }]);
    L.total = 0; L.waves.forEach(function (wv) { L.total += wv.length; });
    L.bulletSpeed = 230 + d * 230;
    L.fireMul = 1 - d * 0.45;
    L.bulletDmg = 9 + d * 16;
    return L;
  }

  /* ---------- background ---------- */
  var nebCache = {};
  function drawSpace(g, B, W, H, t, scroll) {
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, B.top); gr.addColorStop(1, B.bot);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // nebula blobs
    for (var i = 0; i < 5; i++) {
      var nx = hash2(i, B.hz) * W, ny = ((hash2(i, B.hz + 7) * H * 1.6 + scroll * 0.05) % (H * 1.6)) - H * 0.3, nr = (0.25 + hash2(i, 3) * 0.35) * Math.max(W, H);
      var ng = g.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, (i % 2 ? B.far : B.acc) + '40'); ng.addColorStop(1, (i % 2 ? B.far : B.acc) + '00');
      g.fillStyle = ng; g.fillRect(0, 0, W, H);
    }
    // star layers
    for (var l = 0; l < 3; l++) {
      var sp = [0.15, 0.4, 0.9][l], sz = [1, 1.6, 2.4][l];
      g.fillStyle = l === 2 ? B.near : '#ffffff';
      g.globalAlpha = [0.5, 0.7, 0.9][l];
      for (var s = 0; s < 40; s++) {
        var sx = hash2(s, l * 100 + 1) * W, sy = ((hash2(s, l * 100 + 2) * H + scroll * sp) % H);
        g.fillRect(sx, sy, sz, sz * (B.style === 'storm' && l === 2 ? 6 : 1));
      }
    }
    g.globalAlpha = 1;
    if (B.style === 'rocks') {
      g.fillStyle = B.far;
      for (var r = 0; r < 6; r++) {
        var rx = hash2(r, 51) * W, ry = ((hash2(r, 52) * H * 1.5 + scroll * 0.6) % (H * 1.5)) - H * 0.25, rs = 10 + hash2(r, 53) * 30;
        g.beginPath(); for (var q = 0; q < 7; q++) { var a = q / 7 * 6.283 + t * 0.2 * (r % 2 ? 1 : -1); g.lineTo(rx + Math.cos(a) * rs * (0.7 + hash2(q, r) * 0.4), ry + Math.sin(a) * rs * (0.7 + hash2(q, r) * 0.4)); } g.fill();
      }
    }
  }
  function drawEnemy(g, e, t, B) {
    var col = e.elite ? '#fbbf24' : (e.type === 'boss' ? B.acc : ECOL[e.type]);
    g.save(); g.translate(e.x, e.y);
    if (e.flash > 0) { g.globalAlpha = 1; }
    var r = e.r, i;
    g.fillStyle = e.flash > 0 ? '#ffffff' : col; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2;
    g.beginPath();
    switch (e.type) {
      case 'drone': g.moveTo(0, r); g.lineTo(r, -r * 0.4); g.lineTo(r * 0.4, -r); g.lineTo(-r * 0.4, -r); g.lineTo(-r, -r * 0.4); break;
      case 'zig': g.moveTo(0, r); g.lineTo(r, 0); g.lineTo(0, -r); g.lineTo(-r, 0); break;
      case 'gunner': g.rect(-r, -r * 0.7, r * 2, r * 1.4); break;
      case 'tank': for (i = 0; i < 8; i++) { var a = i / 8 * 6.283 + Math.PI / 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
      case 'diver': g.moveTo(0, r * 1.3); g.lineTo(r * 0.8, -r); g.lineTo(0, -r * 0.4); g.lineTo(-r * 0.8, -r); break;
      case 'spinner': for (i = 0; i < 12; i++) { var a2 = i / 12 * 6.283 + e.t * 3, rr2 = i % 2 ? r * 0.6 : r; g.lineTo(Math.cos(a2) * rr2, Math.sin(a2) * rr2); } break;
      case 'splitter': g.arc(-r * 0.35, 0, r * 0.65, 0, 7); g.moveTo(r, 0); g.arc(r * 0.35, 0, r * 0.65, 0, 7); break;
      case 'sniper': g.moveTo(0, r * 1.5); g.lineTo(r * 0.5, -r); g.lineTo(-r * 0.5, -r); break;
      case 'boss':
        g.moveTo(0, r * 0.9); g.lineTo(r, r * 0.2); g.lineTo(r * 1.3, -r * 0.5); g.lineTo(r * 0.5, -r * 0.4); g.lineTo(r * 0.3, -r); g.lineTo(-r * 0.3, -r); g.lineTo(-r * 0.5, -r * 0.4); g.lineTo(-r * 1.3, -r * 0.5); g.lineTo(-r, r * 0.2); break;
    }
    g.closePath(); g.fill(); g.stroke();
    if (e.flash <= 0) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, r * 0.38, 0, 7); g.fill();
      g.fillStyle = e.type === 'boss' ? '#fff' : '#fecaca'; g.beginPath(); g.arc(0, r * 0.08, r * 0.18 + Math.sin(t * 8) * 1.2, 0, 7); g.fill();
    }
    g.restore();
    if (e.type === 'sniper' && e.aim > 0) { g.strokeStyle = 'rgba(250,204,21,' + (0.25 + 0.5 * (1 - e.aim)) + ')'; g.lineWidth = 1.5; line(g, e.x, e.y, e.x + e.ax * 900, e.y + e.ay * 900); }
    if (e.max > 60 && e.type !== 'boss' && e.hp < e.max) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 4); g.fillStyle = '#4ade80'; g.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * e.hp / e.max, 4); }
  }

  /* ---------- run ---------- */
  function newShooterRun(api) {
    var L = api.L, D = api.D, ch = api.ch();
    var P = { x: FW / 2, y: FH - 120, hull: D.hull, max: D.hull, fireT: 0, inv: 0, bombs: D.bombs, power: 0, bubble: false, alive: true, won: false, bank: 0, vx: 0 };
    var enemies = [], pb = [], eb = [], drops = [];
    var waveIdx = -1, waveT = 0, spawnQ = [], kills = 0, escaped = 0, time = 0, banner = 2.4, runCoins = 0, combo = 0, comboT = 0, maxCombo = 0, started = false, winWait = 0;
    var keys = {}, drag = null, bombFlash = 0;
    var view = { s: 1, ox: 0, oy: 0 };
    var boss = null;
    function hpScale() { return L.hpM * (L.boss ? 1 : 1); }
    function nextWave() {
      waveIdx++;
      if (waveIdx >= L.waves.length) return false;
      spawnQ = L.waves[waveIdx].map(function (s) { return { s: s, t: s.delay }; });
      waveT = 0;
      return true;
    }
    function spawn(s) {
      var T = s.type, e;
      if (T === 'boss') {
        var bhp = 900 * hpScale() * (1 + L.biome * 0.15);
        e = { type: 'boss', x: FW / 2, y: -120, r: 62, hp: bhp, max: bhp, t: 0, fire: 1.5, mode: 0, modeT: 0, val: 600, vx: 0, vy: 120 };
        boss = e;
      } else {
        var et = ETYPES[T], hp = et.hp * hpScale() * (s.elite ? 2.2 : 1);
        e = { type: T, x: s.x, y: -40, r: et.r * (s.elite ? 1.3 : 1), hp: hp, max: hp, t: 0, vx: 0, vy: 0, fire: 0.8 + s.seed * 1.5, seed: s.seed, val: et.val * (s.elite ? 3 : 1), elite: !!s.elite, stopY: 140 + s.seed * 220, aim: 0, ax: 0, ay: 1, state: 0 };
        if (T === 'zig') e.vx = (s.seed < 0.5 ? -1 : 1) * (160 + L.d * 120);
      }
      e.flash = 0;
      enemies.push(e);
    }
    function shootE(x, y, ang, spd, size, col) {
      eb.push({ x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: size || 6, col: col || '#fb7185' });
    }
    function aimAt(e) { return Math.atan2(P.y - e.y, P.x - e.x); }
    function firePlayer() {
      var dmg = D.dmg, w = ch.weapon, col = colorOf(ch.tr, api.t(), 0);
      function b(dx, ang, opts) {
        opts = opts || {};
        pb.push({ x: P.x + dx, y: P.y - 22, vx: Math.sin(ang) * (opts.spd || 900), vy: -Math.cos(ang) * (opts.spd || 900), dmg: dmg * (opts.m || 1), r: opts.r || 4, pierce: opts.pierce || 0, home: !!opts.home, wave: opts.wave || 0, t: 0, col: col, hit: null });
      }
      switch (w) {
        case 'twin': b(-9, 0, { m: 0.6 }); b(9, 0, { m: 0.6 }); break;
        case 'spread': b(0, 0, { m: 0.5 }); b(-6, -0.17, { m: 0.42 }); b(6, 0.17, { m: 0.42 }); break;
        case 'laser': b(0, 0, { m: 0.75, spd: 1400, pierce: 3, r: 3 }); break;
        case 'homing': b(-10, -0.3, { m: 0.55, spd: 620, home: true }); b(10, 0.3, { m: 0.55, spd: 620, home: true }); break;
        case 'wave': b(0, 0, { m: 1.05, spd: 760, wave: 1, r: 6 }); break;
        default: b(0, 0, { m: 1 });
      }
      if (P.power > 0) { b(-16, -0.3, { m: 0.35 }); b(16, 0.3, { m: 0.35 }); }
      if (Math.random() < 0.5) api.tone(980 + Math.random() * 80, 0.03, 'square', 0.02, 0.6);
    }
    function damageEnemy(e, dmg) {
      e.hp -= dmg; e.flash = 0.06;
      if (e.hp <= 0 && !e.dead) killEnemy(e);
    }
    function killEnemy(e) {
      e.dead = true; kills++; api.stat('kills');
      combo++; comboT = 1.6; if (combo > maxCombo) maxCombo = combo;
      var col = e.elite ? '#fbbf24' : (e.type === 'boss' ? BIOMES[L.biome].acc : ECOL[e.type]);
      api.burst(e.x, e.y, e.type === 'boss' ? 90 : 16, col, e.type === 'boss' ? 600 : 260, 0, 0);
      api.noise(e.type === 'boss' ? 0.8 : 0.18, e.type === 'boss' ? 0.4 : 0.14, 1200, 120);
      api.shake(e.type === 'boss' ? 22 : e.type === 'tank' ? 6 : 2.5);
      if (e.type === 'boss') { api.stat('bosses'); api.hitstop(0.15); boss = null; for (var c = 0; c < 20; c++) drops.push({ x: e.x + (Math.random() - 0.5) * 120, y: e.y + (Math.random() - 0.5) * 80, k: 'c', v: Math.round((3 + api.level() * 0.3) * D.coinMult), vy: 60 + Math.random() * 60 }); }
      if (e.type === 'splitter') for (var s = -1; s <= 1; s += 2) { var hp = ETYPES.drone.hp * L.hpM * 0.5; enemies.push({ type: 'drone', x: e.x + s * 18, y: e.y, r: 12, hp: hp, max: hp, t: 0, vx: s * 90, vy: 0, fire: 9, seed: Math.random(), val: 5, flash: 0, stopY: 0, aim: 0, ax: 0, ay: 1, state: 0 }); }
      if (Math.random() < 0.5) drops.push({ x: e.x, y: e.y, k: 'c', v: Math.max(1, Math.round((1 + api.level() * 0.15) * (e.val / 10) * D.coinMult)), vy: 70 });
      var pr = Math.random();
      if (pr < 0.025) drops.push({ x: e.x, y: e.y, k: 'p', vy: 80 });
      else if (pr < 0.045) drops.push({ x: e.x, y: e.y, k: 's', vy: 80 });
      else if (pr < 0.065) drops.push({ x: e.x, y: e.y, k: 'h', vy: 80 });
    }
    function hurtPlayer(dmg) {
      if (P.inv > 0 || !P.alive || P.won) return;
      if (P.bubble) { P.bubble = false; P.inv = 0.6; api.tone(500, 0.2, 'triangle', 0.14, 2); api.burst(P.x, P.y, 20, '#67e8f9', 260, 0, 0); return; }
      P.hull -= dmg; P.inv = 0.7; api.shake(9); api.hitstop(0.04);
      api.tone(140, 0.2, 'sawtooth', 0.14, 0.5);
      api.burst(P.x, P.y, 14, '#fca5a5', 260, 0, 0);
      if (P.hull <= 0) {
        P.hull = 0; P.alive = false;
        api.burst(P.x, P.y, 60, function (i) { return i % 2 ? colorOf(ch.c, api.t(), i * 20) : '#f97316'; }, 520, 1, 0);
        api.die();
      }
    }
    function bomb() {
      if (!P.alive || P.won || P.bombs <= 0 || !started) return;
      P.bombs--; bombFlash = 1; api.stat('bombs');
      eb.length = 0;
      for (var i = 0; i < enemies.length; i++) damageEnemy(enemies[i], D.dmg * (enemies[i].type === 'boss' ? 25 : 60));
      api.shake(18); api.hitstop(0.06);
      api.tone(80, 0.8, 'sawtooth', 0.25, 0.3); api.noise(0.8, 0.4, 3000, 100);
      for (var k = 0; k < 60; k++) { var a = k / 60 * 6.283; api.emit(P.x, P.y, Math.cos(a) * 900, Math.sin(a) * 900, 0.5, 5, '#fde68a', 0, 0); }
    }
    function step(dt) {
      time += dt;
      if (!P.alive) { updateBullets(dt); return; }
      // movement
      var tx = P.x, ty = P.y, kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0), ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
      var ox = P.x;
      if (kx || ky) { if (!started) started = true; P.x += kx * 520 * dt; P.y += ky * 460 * dt; }
      else if (drag) {
        tx = drag.x; ty = drag.y;
        var dx = tx - P.x, dy = ty - P.y, dd = Math.hypot(dx, dy), mv = 1400 * dt;
        if (dd > mv) { P.x += dx / dd * mv; P.y += dy / dd * mv; } else { P.x = tx; P.y = ty; }
      }
      P.x = clamp(P.x, 20, FW - 20); P.y = clamp(P.y, FH * 0.35, FH - 30);
      P.vx = (P.x - ox) / dt; P.bank = lerp(P.bank, clamp(P.vx / 900, -1, 1), 0.2);
      if (!started) return;
      if (P.inv > 0) P.inv -= dt;
      if (P.power > 0) P.power -= dt;
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      // fire
      if (!P.won) { P.fireT -= dt; if (P.fireT <= 0) { P.fireT += 1 / D.rate; firePlayer(); } }
      // waves
      if (spawnQ.length === 0 && enemies.length === 0 && !P.won) {
        if (waveIdx + 1 >= L.waves.length) {
          winWait += dt;
          if (winWait > 0.8) {
            P.won = true;
            var hullPct = P.hull / P.max;
            var stars = hullPct >= 0.9 ? 3 : hullPct >= 0.5 ? 2 : 1;
            for (var cf = 0; cf < 140; cf++) { var an = Math.random() * 6.283, sv = 200 + Math.random() * 700; api.emit(P.x, P.y, Math.cos(an) * sv, Math.sin(an) * sv, 1.2 + Math.random() * 1.2, 3 + Math.random() * 4, 'hsl(' + Math.floor(Math.random() * 360) + ',90%,60%)', 1, 300); }
            api.win({ stars: stars, medal: kills >= L.total * 0.95, time: time, kills: kills, total: L.total, hull: Math.round(hullPct * 100), runCoins: runCoins, combo: maxCombo });
          }
        } else if (!nextWave()) { /* done */ } else banner = Math.max(banner, 0);
      }
      waveT += dt;
      for (var q = spawnQ.length - 1; q >= 0; q--) { if (waveT >= spawnQ[q].t) { spawn(spawnQ[q].s); spawnQ.splice(q, 1); } }
      // enemies
      var bs = L.bulletSpeed;
      for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        e.t += dt; if (e.flash > 0) e.flash -= dt;
        switch (e.type) {
          case 'drone': e.vy = 105 + L.d * 60; e.x += (Math.sin(e.t * 2 + e.seed * 6) * 60 + e.vx) * dt; e.vx *= 0.98; break;
          case 'zig': e.vy = 140 + L.d * 60; if (e.x < 30 || e.x > FW - 30) e.vx = -e.vx; e.x += e.vx * dt; break;
          case 'gunner': case 'spinner': case 'sniper':
            if (e.y < e.stopY) e.vy = 160; else { e.vy = 0; e.x += Math.sin(e.t * 0.8 + e.seed * 5) * 50 * dt; if (e.t > 14) e.vy = 140; }
            break;
          case 'tank': e.vy = 50 + L.d * 30; break;
          case 'diver':
            if (e.state === 0) { e.vy = 140; if (e.y > 90 + e.seed * 80) { e.state = 1; e.wait = 0.55; e.vy = 0; } }
            else if (e.state === 1) { e.wait -= dt; e.vy = 0; if (e.wait <= 0) { var ang = aimAt(e); e.vx = Math.cos(ang) * (480 + L.d * 220); e.vy = Math.sin(ang) * (480 + L.d * 220); e.state = 2; api.tone(700, 0.15, 'sawtooth', 0.05, 0.4); } }
            e.x += e.vx * dt;
            break;
          case 'boss':
            if (e.y < 160) e.vy = 120; else { e.vy = 0; e.x = FW / 2 + Math.sin(e.t * 0.6) * (FW / 2 - 110); }
            break;
        }
        e.y += e.vy * dt;
        // firing
        if (e.y > 0 && !P.won && e.type !== 'drone' && e.type !== 'zig' && e.type !== 'diver') {
          e.fire -= dt;
          if (e.type === 'sniper' && e.fire < 0.6 && e.fire > 0) { if (e.aim <= 0) { var a0 = aimAt(e); e.ax = Math.cos(a0); e.ay = Math.sin(a0); } e.aim = e.fire / 0.6; }
          if (e.fire <= 0) {
            var A = aimAt(e);
            switch (e.type) {
              case 'gunner': shootE(e.x, e.y, A, bs, 6); e.fire = (1.7 + e.seed) * L.fireMul; break;
              case 'tank': for (var k = -1; k <= 1; k++) shootE(e.x, e.y + 10, Math.PI / 2 + k * 0.25, bs * 0.85, 7); e.fire = 2.4 * L.fireMul; break;
              case 'spinner': for (var k2 = 0; k2 < 8; k2++) shootE(e.x, e.y, k2 / 8 * 6.283 + e.t, bs * 0.7, 6, '#c4b5fd'); e.fire = 2.1 * L.fireMul; break;
              case 'sniper': shootE(e.x, e.y, Math.atan2(e.ay, e.ax), bs * 1.9, 5, '#fde047'); e.fire = 2.4 * L.fireMul; e.aim = 0; api.tone(1200, 0.08, 'square', 0.04, 0.5); break;
              case 'boss': bossFire(e); break;
            }
            if (e.elite && e.type !== 'boss') e.fire *= 0.7;
          }
        }
        if (e.type === 'boss') { e.modeT += dt; if (e.modeT > 5) { e.modeT = 0; e.mode = (e.mode + 1) % 4; } }
        // collide with player
        if (P.alive && !P.won && Math.hypot(e.x - P.x, e.y - P.y) < e.r + 12) { hurtPlayer(25 + L.d * 20); if (e.type !== 'boss') damageEnemy(e, e.max * 0.6 + 50); }
        if (e.dead) { enemies.splice(i, 1); continue; }
        if (e.y > FH + 60 || e.x < -80 || e.x > FW + 80) { escaped++; enemies.splice(i, 1); }
      }
      updateBullets(dt);
      // drops
      for (var j = drops.length - 1; j >= 0; j--) {
        var dp = drops[j];
        var ddx = P.x - dp.x, ddy = P.y - dp.y, dd2 = Math.hypot(ddx, ddy);
        if (dd2 < 120) { dp.x += ddx / dd2 * 600 * dt; dp.y += ddy / dd2 * 600 * dt; } else dp.y += dp.vy * dt;
        if (dd2 < 24) {
          if (dp.k === 'c') { runCoins += dp.v; api.sfx.coin(); }
          else if (dp.k === 'p') { P.power = 8; api.sfx.star(); }
          else if (dp.k === 's') { P.bubble = true; api.sfx.star(); }
          else if (dp.k === 'h') { P.hull = Math.min(P.max, P.hull + P.max * 0.25); api.sfx.star(); }
          drops.splice(j, 1); continue;
        }
        if (dp.y > FH + 30) drops.splice(j, 1);
      }
      if (bombFlash > 0) bombFlash -= dt * 2;
      if (ch.tier >= 2 && Math.random() < 0.2 + ch.tier * 0.06) api.emit(P.x + (Math.random() - 0.5) * 10, P.y + 22, (Math.random() - 0.5) * 40, 160, 0.4, 2 + ch.tier * 0.4, colorOf(ch.tr, api.t(), Math.random() * 200), 0, 0);
    }
    function bossFire(e) {
      var bs = L.bulletSpeed, phase2 = e.hp < e.max * 0.5, i;
      var col = BIOMES[L.biome].acc;
      switch (e.mode) {
        case 0: for (i = -4; i <= 4; i++) shootE(e.x, e.y + 40, Math.PI / 2 + i * 0.16, bs * 0.8, 7, col); e.fire = (phase2 ? 0.9 : 1.3) * L.fireMul; break;
        case 1: var A = aimAt(e); for (i = -1; i <= 1; i++) shootE(e.x, e.y + 30, A + i * 0.08, bs * 1.1, 6, '#fde047'); e.fire = (phase2 ? 0.35 : 0.5) * L.fireMul; break;
        case 2: for (i = 0; i < 2; i++) shootE(e.x, e.y, e.t * 2.2 + i * Math.PI, bs * 0.65, 6, '#c4b5fd'); e.fire = 0.09 / (phase2 ? 1.4 : 1); break;
        case 3:
          if (enemies.length < 10) for (i = -1; i <= 1; i += 2) { var hp = ETYPES.diver.hp * L.hpM; enemies.push({ type: 'diver', x: e.x + i * 80, y: e.y + 20, r: 15, hp: hp, max: hp, t: 0, vx: 0, vy: 0, fire: 9, seed: Math.random(), val: 8, flash: 0, stopY: 0, aim: 0, ax: 0, ay: 1, state: 0 }); }
          e.fire = 1.6; break;
      }
    }
    function updateBullets(dt) {
      var i, j, b, e;
      for (i = pb.length - 1; i >= 0; i--) {
        b = pb[i]; b.t += dt;
        if (b.home) {
          var best = null, bd = 1e9;
          for (j = 0; j < enemies.length; j++) { e = enemies[j]; var dd = Math.hypot(e.x - b.x, e.y - b.y); if (dd < bd && e.y > -20) { bd = dd; best = e; } }
          if (best) { var sp = Math.hypot(b.vx, b.vy), ang = Math.atan2(b.vy, b.vx), ta = Math.atan2(best.y - b.y, best.x - b.x), da = ((ta - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI; ang += clamp(da, -6 * dt, 6 * dt); b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; }
        }
        b.x += b.vx * dt + (b.wave ? Math.cos(b.t * 18) * 260 * dt : 0); b.y += b.vy * dt;
        if (b.y < -30 || b.y > FH + 30 || b.x < -30 || b.x > FW + 30) { pb.splice(i, 1); continue; }
        for (j = 0; j < enemies.length; j++) {
          e = enemies[j]; if (e.dead || b.hit === e) continue;
          if (Math.abs(e.x - b.x) < e.r + b.r && Math.abs(e.y - b.y) < e.r + b.r && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            damageEnemy(e, b.dmg);
            api.emit(b.x, b.y, (Math.random() - 0.5) * 120, 60, 0.2, 3, b.col, 0, 0);
            if (b.pierce > 0) { b.pierce--; b.hit = e; } else { pb.splice(i, 1); }
            break;
          }
        }
      }
      for (i = eb.length - 1; i >= 0; i--) {
        b = eb[i]; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < -40 || b.y > FH + 40 || b.x < -40 || b.x > FW + 40) { eb.splice(i, 1); continue; }
        if (P.alive && !P.won && Math.abs(b.x - P.x) < b.r + 7 && Math.abs(b.y - P.y) < b.r + 7 && Math.hypot(b.x - P.x, b.y - P.y) < b.r + 6) { eb.splice(i, 1); hurtPlayer(L.bulletDmg); }
      }
    }
    function toWorld(x, y) { return [(x - view.ox) / view.s, (y - view.oy) / view.s]; }
    function render(g) {
      var W = api.W(), H = api.H(), dpr = api.dpr(), t = api.t(), B = BIOMES[L.biome];
      var s = Math.min(W / FW, H / FH);
      view.s = s; view.ox = (W - FW * s) / 2; view.oy = (H - FH * s) / 2;
      drawSpace(g, B, W, H, t, t * 120);
      var sh = api.shakeXY();
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (view.ox + sh[0]), dpr * (view.oy + sh[1]));
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.strokeRect(0, 0, FW, FH);
      // drops
      for (var i = 0; i < drops.length; i++) {
        var dp = drops[i];
        if (dp.k === 'c') { var sw = Math.abs(Math.cos(t * 4 + i)); g.fillStyle = '#f59e0b'; g.beginPath(); g.ellipse(dp.x, dp.y, 7 * sw + 1.5, 7, 0, 0, 7); g.fill(); g.fillStyle = '#fde047'; g.beginPath(); g.ellipse(dp.x, dp.y, 4 * sw + 0.8, 4, 0, 0, 7); g.fill(); }
        else {
          var pc = dp.k === 'p' ? '#f472b6' : dp.k === 's' ? '#22d3ee' : '#4ade80';
          g.fillStyle = pc; g.beginPath(); g.arc(dp.x, dp.y, 12, 0, 7); g.fill();
          g.fillStyle = '#fff'; g.font = '900 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(dp.k.toUpperCase(), dp.x, dp.y + 1);
        }
      }
      for (i = 0; i < enemies.length; i++) drawEnemy(g, enemies[i], t, B);
      // player bullets
      for (i = 0; i < pb.length; i++) {
        var b = pb[i];
        g.fillStyle = b.col; g.globalAlpha = 0.45; g.fillRect(b.x - b.r, b.y - b.r * 2.5, b.r * 2, b.r * 5); g.globalAlpha = 1;
        g.fillStyle = '#fff'; g.fillRect(b.x - b.r * 0.45, b.y - b.r * 2, b.r * 0.9, b.r * 4);
      }
      // enemy bullets
      for (i = 0; i < eb.length; i++) {
        var e = eb[i];
        g.fillStyle = e.col; g.beginPath(); g.arc(e.x, e.y, e.r + 2, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(e.x, e.y, e.r * 0.5, 0, 7); g.fill();
      }
      if (P.alive) {
        if (!(P.inv > 0 && Math.floor(t * 20) % 2)) drawShip(g, ch, P.x, P.y, 1.1, t, P.bank, false);
        if (P.bubble) { g.strokeStyle = 'rgba(103,232,249,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(P.x, P.y, 30, 0, 7); g.stroke(); }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(P.x, P.y, 3, 0, 7); g.fill();
      }
      api.drawParticles(g);
      if (bombFlash > 0) { g.fillStyle = 'rgba(253,230,138,' + (bombFlash * 0.5) + ')'; g.fillRect(0, 0, FW, FH); }
      // in-field HUD: bomb button + boss bar
      g.globalAlpha = P.bombs > 0 ? 0.9 : 0.35;
      g.fillStyle = 'rgba(15,23,42,.7)'; g.beginPath(); g.arc(FW - 50, FH - 50, 34, 0, 7); g.fill();
      g.strokeStyle = '#fde68a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fde68a'; g.font = '900 15px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('\ud83d\udca3' + P.bombs, FW - 50, FH - 50);
      g.globalAlpha = 1;
      if (boss) {
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(60, 60, FW - 120, 14);
        g.fillStyle = B.acc; g.fillRect(60, 60, (FW - 120) * Math.max(0, boss.hp / boss.max), 14);
        g.fillStyle = '#fff'; g.font = '900 12px system-ui'; g.fillText('BOSS', FW / 2, 67);
      }
      // screen HUD
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = 'rgba(0,0,0,.45)'; rr(g, 10, 10, Math.min(290, W - 190), 82, 12); g.fill();
      g.fillStyle = '#fff'; g.font = '900 17px system-ui';
      g.fillText('SECTOR ' + api.level() + (L.boss ? ' \u00b7 BOSS' : L.challenge ? ' \u00b7 CHALLENGE' : ''), 20, 16);
      g.font = '600 12px system-ui'; g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText(B.name + ' \u00b7 Wave ' + Math.max(1, Math.min(L.waves.length, waveIdx + 1)) + '/' + L.waves.length, 20, 38);
      g.fillText('\ud83d\udca5 ' + kills + '/' + L.total + ' \u00b7 \ud83e\ude99 ' + fmt(api.S.coins + runCoins) + (P.power > 0 ? ' \u00b7 \u26a1POWER' : ''), 20, 54);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(20, 72, Math.min(250, W - 210), 9);
      var hp = P.hull / P.max; g.fillStyle = hp > 0.5 ? '#4ade80' : hp > 0.25 ? '#facc15' : '#ef4444'; g.fillRect(20, 72, Math.min(250, W - 210) * hp, 9);
      if (combo >= 3) { g.textAlign = 'center'; g.font = '900 ' + (22 + Math.min(18, combo)) + 'px system-ui'; g.fillStyle = 'hsl(' + ((combo * 25) % 360) + ',95%,65%)'; g.globalAlpha = Math.min(1, comboT); g.fillText('\u00d7' + combo + ' CHAIN', W / 2, 16); g.globalAlpha = 1; }
      g.textAlign = 'left'; g.textBaseline = 'bottom'; g.font = '600 12px system-ui'; g.fillStyle = 'rgba(255,255,255,.75)';
      g.fillText('\u23f1 Playtime ' + fmtTime(api.playtime()) + ' \u00b7 Best ' + fmt(api.hiScore()), 12, H - 10);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (banner > 0) {
        banner -= 1 / 60;
        g.globalAlpha = Math.min(1, banner);
        g.font = '900 ' + Math.round(Math.min(44, W / 12)) + 'px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6;
        var txt = L.boss ? '\ud83d\udd25 BOSS SECTOR' : L.challenge ? '\u2694 CHALLENGE SECTOR' : 'SECTOR ' + api.level();
        g.strokeText(txt, W / 2, H * 0.3); g.fillText(txt, W / 2, H * 0.3);
        g.font = '700 16px system-ui'; g.strokeText(B.name, W / 2, H * 0.3 + 34); g.fillText(B.name, W / 2, H * 0.3 + 34);
        g.globalAlpha = 1;
      }
      if (!started && P.alive) {
        g.font = '900 ' + Math.round(Math.min(24, W / 20)) + 'px system-ui'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 5;
        var h1 = 'Drag / Arrows / WASD to fly \u2014 move to launch!';
        g.strokeText(h1, W / 2, H * 0.6); g.fillText(h1, W / 2, H * 0.6);
        g.font = '700 14px system-ui'; var h2 = 'Auto-fire is on \u00b7 Space or \ud83d\udca3 button = Nova Bomb';
        g.strokeText(h2, W / 2, H * 0.6 + 28); g.fillText(h2, W / 2, H * 0.6 + 28);
      }
      if (!P.alive) { g.font = '900 34px system-ui'; g.fillStyle = '#fca5a5'; g.fillText('SHIP DESTROYED', W / 2, H * 0.42); }
      if (P.won) { g.font = '900 ' + Math.round(Math.min(60, W / 10)) + 'px system-ui'; g.fillStyle = '#fde047'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 7; g.strokeText('SECTOR CLEAR!', W / 2, H * 0.4); g.fillText('SECTOR CLEAR!', W / 2, H * 0.4); }
      g.textBaseline = 'alphabetic';
    }
    nextWave();
    return {
      step: step, render: render, dbg: function () { return { P: P, enemies: enemies, eb: eb, waveIdx: waveIdx }; },
      down: function (src, x, y, ptype) {
        if (src === 'key') { if (!started) started = true; bomb(); return; }
        var w = toWorld(x, y);
        if (Math.hypot(w[0] - (FW - 50), w[1] - (FH - 50)) < 40) { if (!started) started = true; bomb(); return; }
        started = true;
        drag = { x: w[0], y: w[1] - (ptype === 'touch' ? 70 : 0), touch: ptype === 'touch' };
      },
      move: function (x, y, ptype) {
        var w = toWorld(x, y);
        if (drag) { drag.x = w[0]; drag.y = w[1] - (drag.touch ? 70 : 0); }
        else if (ptype === 'mouse' && started) { drag = { x: w[0], y: w[1], touch: false, hover: true }; }
      },
      up: function (src) { if (src === 'pointer' && drag && drag.touch) drag = null; },
      key: function (k, down) { keys[k] = down; if (down) drag = null; }
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
      drawSpace(g, BIOMES[5], 512, 512, 1, 200);
      var ng = g.createRadialGradient(256, 200, 10, 256, 200, 260); ng.addColorStop(0, 'rgba(244,114,182,.45)'); ng.addColorStop(1, 'rgba(244,114,182,0)');
      g.fillStyle = ng; g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 5; i++) { g.fillStyle = '#fde68a'; g.fillRect(250 + (i - 2) * 26 - 3, 300 - i * 0 - 60 - i * 40, 6, 26); }
      var fakeE = { type: 'boss', x: 256, y: 92, r: 60, flash: 0, t: 0, hp: 1, max: 1 };
      drawEnemy(g, fakeE, 1, BIOMES[1]);
      g.fillStyle = '#fb7185'; for (var k = -3; k <= 3; k++) { g.beginPath(); g.arc(256 + k * 40, 180 + Math.abs(k) * 10, 8, 0, 7); g.fill(); }
      g.save(); g.translate(256, 330); g.scale(3.4, 3.4); drawShip(g, CHARS[16], 0, 0, 1, 0.3, 0, false); g.restore();
      g.textAlign = 'center'; g.font = '900 66px system-ui, Arial, sans-serif'; g.lineWidth = 10; g.strokeStyle = 'rgba(10,5,30,.9)';
      g.strokeText('NOVA', 256, 440); g.strokeText('BASTION', 256, 498);
      var tg = g.createLinearGradient(0, 390, 0, 500); tg.addColorStop(0, '#fde68a'); tg.addColorStop(1, '#f97316');
      g.fillStyle = tg; g.fillText('NOVA', 256, 440); g.fillText('BASTION', 256, 498);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ---------- game descriptor ---------- */
  var G = {
    titleGradient: 'linear-gradient(90deg,#fde68a,#fb923c,#f472b6)',
    subtitle: 'Hold the line across 2,000 sectors and 20 galaxies.',
    howTo: '<div style="line-height:2">' +
      '<div><span class="ag-k">Drag</span><span class="ag-k">Mouse</span><span class="ag-k">Touch</span><span class="ag-k">\u2190\u2191\u2192\u2193</span><span class="ag-k">WASD</span> Fly your ship (it fires automatically)</div>' +
      '<div><span class="ag-k">Space</span> or the \ud83d\udca3 button: Nova Bomb (clears bullets and blasts every enemy)</div></div>' +
      '<div style="margin-top:8px;font-size:14px;opacity:.85;line-height:1.55">Destroy every wave in the sector. Only your ship\u2019s glowing core can be hit, so weave through the bullets. Pick up <b style="color:#f472b6">P</b> for extra guns, <b style="color:#22d3ee">S</b> for a shield bubble and <b style="color:#4ade80">H</b> to repair. Stars depend on how much hull you have left (\u226550% \u2605\u2605, \u226590% \u2605\u2605\u2605), and destroying at least 95% of enemies earns the \ud83c\udfaf Ace medal. Every ship has its own weapon: Twin, Spread, Pierce Laser, Homing or Wave.</div>',
    unitName: 'Ships', unitIcon: '\ud83d\ude80', medalName: 'Ace', medalIcon: '\ud83c\udfaf',
    starHint: '\u2605 = hull remaining',
    statKeys: ['kills', 'bosses', 'bombs'],
    derive: function (S) {
      var ch = CHMAP[S.sel] || CHARS[0], st = (S.chars[S.sel] || { s: 1 }).s, tm = TMULT[ch.tier], p = ch.perk;
      return {
        dmg: 10 * (1 + S.upg.dmg * 0.1) * (1 + S.perks.pdmg * 0.15) * (1 + (p === 'dmg' ? 0.04 * tm * st : 0)) * (1 + ch.tier * 0.06),
        rate: 6 * (1 + S.upg.rate * 0.03),
        hull: Math.round((100 + S.upg.hull * 12) * (1 + (p === 'hull' ? 0.04 * tm * st : 0))),
        bombs: 1 + (ch.tier >= 3 ? 1 : 0),
        coinMult: (1 + S.upg.coin * 0.1) * (1 + S.perks.coin * 0.25) * (1 + S.prestige * 0.5 + S.shardsTotal * 0.02) * (1 + (p === 'coin' ? 0.03 * tm * st : 0) + totalStars(S) * 0.005),
        gemChance: 0.04 + S.perks.gem * 0.02 + (p === 'gem' ? 0.01 * tm * st : 0)
      };
    },
    idleRate: function (S) { return S.upg.idle * (3 + S.bestLevel * 0.25) * (1 + S.prestige * 0.5); },
    perkText: function (ch, st) {
      var tm = TMULT[ch.tier];
      if (ch.perk === 'coin') return '+' + Math.round(3 * tm * st) + '% coins';
      if (ch.perk === 'dmg') return '+' + Math.round(4 * tm * st) + '% damage';
      if (ch.perk === 'hull') return '+' + Math.round(4 * tm * st) + '% hull';
      return '+' + (1 * tm * st).toFixed(1) + '% gem luck';
    },
    hubStats: function (S, D) { return 'DMG ' + fmt(D.dmg * 10) + ' \u00b7 Rate ' + D.rate.toFixed(1) + '/s \u00b7 Hull ' + D.hull + ' \u00b7 Bombs ' + D.bombs; },
    upgCur: function (u, S, D) { return u.k === 'dmg' ? fmt(D.dmg * 10) + ' power' : u.k === 'rate' ? D.rate.toFixed(2) + ' shots/s' : D.hull + ' HP'; },
    newRun: newShooterRun,
    renderMenu: function (ctx, ML, W, H, dpr, t, dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var B = BIOMES[ML.biome];
      drawSpace(ctx, B, W, H, t, t * 90);
      var s = Math.min(W / FW, H / FH);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W - FW * s) / 2, dpr * (H - FH * s) / 2);
      var types = ['drone', 'zig', 'gunner', 'tank', 'diver', 'spinner'];
      for (var i = 0; i < 9; i++) {
        var ty = types[i % types.length], yy = ((t * 60 + i * 130) % (FH + 200)) - 100;
        drawEnemy(ctx, { type: ty, x: 60 + hash2(i, 4) * (FW - 120) + Math.sin(t + i) * 30, y: yy, r: ETYPES[ty].r, flash: 0, t: t, hp: 1, max: 1, aim: 0 }, t, B);
      }
    },
    rewards: function (n, L, info, D, first) {
      var coins = Math.round((14 + n * 2.1) * (1 + info.stars * 0.3) * (1 + Math.min(40, info.combo) * 0.01) * D.coinMult * (first ? 2 : 1) * (L.boss ? 5 : L.challenge ? 2 : 1)) + info.runCoins;
      return { coins: coins, gems: 0, score: Math.round((100 + n * 5) * (1 + info.stars * 0.5) * (info.medal ? 1.5 : 1) + info.kills * 10 + info.runCoins) };
    },
    resultLines: function (info) {
      return '\ud83d\udca5 ' + info.kills + '/' + info.total + ' destroyed \u00b7 \ud83d\udee1 Hull ' + info.hull + '%<br>\u23f1 ' + info.time.toFixed(1) + 's \u00b7 \ud83d\udd17 Best chain \u00d7' + info.combo + ' \u00b7 \ud83e\ude99 ' + fmt(info.runCoins) + ' collected';
    },
    reg: {
      description: 'Auto-firing vertical space shooter across 2,000 sectors, 20 galaxies and 62 unlockable ships.',
      category: 'Shooter',
      bannerGradient: 'linear-gradient(135deg, #f97316 0%, #be185d 100%)',
      controls: ['Drag / Mouse / Touch \u2014 Fly ship', 'Arrow Keys / WASD \u2014 Fly ship', 'Spacebar \u2014 Nova Bomb', 'R Key \u2014 Restart sector', 'Esc \u2014 Pause \u00b7 M \u2014 Mute \u00b7 F \u2014 Fullscreen']
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
