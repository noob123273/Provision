/* =====================================================================
   HOOKLINE RUSH \u2014 an original one-button grappling-swing arcade game
   2,000 seeded levels \u00b7 20 biomes \u00b7 62 characters \u00b7 capsules \u00b7 upgrades
   quests \u00b7 rebirth \u00b7 3-slot save manager with JSON export/import
   ===================================================================== */
(function () {
  'use strict';

  var GID = 'hookline-rush';
  var MAX_LEVEL = 2000;
  var FLOOR = 820;
  var GRAV = 1750;
  var DT = 1 / 120;
  var PR = 12; // player radius

  /* ------------------------------------------------------------------ */
  /*  Procedural 512x512 icon                                            */
  /* ------------------------------------------------------------------ */
  function createGameIcon() {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 512;
      var g = c.getContext('2d');
      var gr = g.createLinearGradient(0, 0, 512, 512);
      gr.addColorStop(0, '#0f0a2e'); gr.addColorStop(0.55, '#5b21b6'); gr.addColorStop(1, '#f472b6');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 70; i++) {
        var sx = (i * 137.5) % 512, sy = (i * 71.3 + (i % 7) * 33) % 300;
        g.fillStyle = 'rgba(255,255,255,' + (0.25 + (i % 5) * 0.12) + ')';
        g.fillRect(sx, sy, 2 + (i % 3), 2 + (i % 3));
      }
      // skyline
      g.fillStyle = '#1e1b4b';
      for (var b = 0; b < 12; b++) {
        var bh = 70 + ((b * 53) % 120);
        g.fillRect(b * 44 - 6, 512 - bh, 40, bh);
      }
      g.fillStyle = 'rgba(244,114,182,.6)';
      for (var w = 0; w < 40; w++) g.fillRect((w * 47) % 500 + 6, 512 - 20 - ((w * 29) % 120), 5, 7);
      // glow node
      var ax = 340, ay = 118;
      var rg = g.createRadialGradient(ax, ay, 4, ax, ay, 90);
      rg.addColorStop(0, 'rgba(255,240,170,1)'); rg.addColorStop(0.25, 'rgba(250,204,21,.7)'); rg.addColorStop(1, 'rgba(250,204,21,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(ax, ay, 90, 0, 7); g.fill();
      g.fillStyle = '#fde047'; g.beginPath(); g.arc(ax, ay, 22, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ax, ay, 9, 0, 7); g.fill();
      // trail arc
      g.lineCap = 'round';
      for (var t = 0; t < 18; t++) {
        var a0 = 2.2 + t * 0.045, rr = 230;
        g.strokeStyle = 'rgba(34,211,238,' + (t / 18 * 0.8) + ')';
        g.lineWidth = 4 + t * 1.3;
        g.beginPath(); g.arc(ax, ay, rr, a0, a0 + 0.06); g.stroke();
      }
      var px = ax + Math.cos(3.05) * 230, py = ay + Math.sin(3.05) * 230;
      px = 165; py = 285;
      // rope
      g.strokeStyle = '#f8fafc'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(px + 14, py - 30); g.lineTo(ax, ay); g.stroke();
      // stick figure swinging
      g.strokeStyle = '#ffffff'; g.lineWidth = 13;
      g.beginPath();
      g.moveTo(px, py - 10); g.lineTo(px - 6, py + 50);   // torso
      g.moveTo(px, py - 4); g.lineTo(px + 14, py - 30);    // arm to rope
      g.moveTo(px, py + 2); g.lineTo(px - 34, py + 16);    // back arm
      g.moveTo(px - 6, py + 50); g.lineTo(px - 40, py + 82); // leg
      g.moveTo(px - 6, py + 50); g.lineTo(px + 14, py + 92);
      g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px + 4, py - 34, 22, 0, 7); g.fill();
      g.fillStyle = '#22d3ee'; g.fillRect(px - 16, py - 40, 40, 8);
      // title
      g.textAlign = 'center';
      g.font = '900 64px system-ui, Arial, sans-serif';
      g.lineWidth = 10; g.strokeStyle = 'rgba(15,10,46,.9)';
      g.strokeText('HOOKLINE', 256, 410); g.strokeText('RUSH', 256, 472);
      var tg = g.createLinearGradient(0, 360, 0, 480);
      tg.addColorStop(0, '#fde047'); tg.addColorStop(1, '#fb7185');
      g.fillStyle = tg; g.fillText('HOOKLINE', 256, 410); g.fillText('RUSH', 256, 472);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ */
  /*  Utility                                                            */
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

  /* ------------------------------------------------------------------ */
  /*  Data                                                               */
  /* ------------------------------------------------------------------ */
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
  var PERK_NAMES = { coin: 'Coins', range: 'Range', boost: 'Swing', gem: 'Gem luck' };

  // name, sky top, sky bottom, accent(nodes), far, near, parallax style, ambient Hz
  var BIOMES = [
    ['Meadow Dawn', '#7dd3fc', '#fde68a', '#16a34a', '#86efac', '#22c55e', 'hills', 196],
    ['Neon City', '#0f0326', '#5b21b6', '#f0abfc', '#3b0764', '#1e1b4b', 'city', 220],
    ['Candy Sky', '#fbcfe8', '#fef9c3', '#ec4899', '#f9a8d4', '#f472b6', 'clouds', 262],
    ['Desert Mirage', '#fdba74', '#fef3c7', '#b45309', '#fcd34d', '#d97706', 'dunes', 174],
    ['Frost Peaks', '#bae6fd', '#f0f9ff', '#0284c7', '#e0f2fe', '#7dd3fc', 'peaks', 246],
    ['Lava Core', '#450a0a', '#ea580c', '#fbbf24', '#7f1d1d', '#431407', 'peaks', 110],
    ['Toxic Swamp', '#14532d', '#a3e635', '#bef264', '#166534', '#052e16', 'trees', 130],
    ['Coral Reef', '#0e7490', '#67e8f9', '#fb7185', '#155e75', '#164e63', 'waves', 294],
    ['Abyssal Trench', '#020617', '#0c4a6e', '#22d3ee', '#0f172a', '#082f49', 'crystals', 98],
    ['Steam Works', '#44403c', '#d6d3d1', '#f97316', '#78716c', '#292524', 'city', 147],
    ['Crystal Caverns', '#1e1b4b', '#7c3aed', '#c4b5fd', '#312e81', '#1e1b4b', 'crystals', 330],
    ['Sakura Drift', '#fce7f3', '#fbcfe8', '#db2777', '#f9a8d4', '#be185d', 'trees', 277],
    ['Storm Spire', '#1e293b', '#64748b', '#facc15', '#334155', '#0f172a', 'peaks', 123],
    ['Cyber Void', '#000000', '#0f172a', '#22d3ee', '#083344', '#020617', 'city', 185],
    ['Haunted Hollow', '#1c1917', '#4c1d95', '#a3e635', '#292524', '#0c0a09', 'trees', 138],
    ['Solar Flare', '#7c2d12', '#fde047', '#fff7ed', '#ea580c', '#9a3412', 'dunes', 233],
    ['Glitch Realm', '#111827', '#be123c', '#4ade80', '#1f2937', '#450a0a', 'crystals', 311],
    ['Aurora Ice', '#042f2e', '#0d9488', '#a7f3d0', '#134e4a', '#022c22', 'peaks', 349],
    ['Nebula Rift', '#1e1b4b', '#be185d', '#f0abfc', '#3730a3', '#1e1b4b', 'stars', 165],
    ['Cosmic Ascent', '#000000', '#312e81', '#fde68a', '#1e1b4b', '#0b0b1e', 'stars', 392]
  ].map(function (b) {
    var h = b[1], r = parseInt(h.substr(1, 2), 16), gg = parseInt(h.substr(3, 2), 16), bb = parseInt(h.substr(5, 2), 16);
    return { name: b[0], top: b[1], bot: b[2], acc: b[3], far: b[4], near: b[5], style: b[6], hz: b[7], dark: (r * 0.3 + gg * 0.59 + bb * 0.11) < 70 };
  });

  // id, name, tier, limb color, head color, head, hat, rope, trail, aura
  var CHAR_ROWS = [
    ['classic', 'Classic Stick', 0, '#f8fafc', '#f8fafc', 'round', 'none', 'line', '#e2e8f0', ''],
    ['crimson', 'Crimson Dash', 0, '#ef4444', '#fca5a5', 'round', 'band', 'line', '#f87171', ''],
    ['lime', 'Lime Sprout', 0, '#84cc16', '#d9f99d', 'round', 'leaf', 'line', '#a3e635', ''],
    ['sky', 'Sky Dasher', 0, '#38bdf8', '#bae6fd', 'round', 'cap', 'line', '#7dd3fc', ''],
    ['sunny', 'Sunny', 0, '#facc15', '#fef08a', 'round', 'none', 'dots', '#fde047', ''],
    ['grape', 'Grape Jumper', 0, '#a855f7', '#e9d5ff', 'round', 'beret', 'line', '#c084fc', ''],
    ['coal', 'Coal Miner', 0, '#475569', '#cbd5e1', 'round', 'miner', 'line', '#94a3b8', ''],
    ['mint', 'Mint Breeze', 0, '#34d399', '#a7f3d0', 'round', 'band', 'line', '#6ee7b7', ''],
    ['tangerine', 'Tangerine', 0, '#fb923c', '#fed7aa', 'round', 'none', 'dots', '#fdba74', ''],
    ['bubblegum', 'Bubblegum', 0, '#f472b6', '#fbcfe8', 'blob', 'none', 'line', '#f9a8d4', ''],
    ['office', 'Office Hero', 0, '#64748b', '#f1f5f9', 'round', 'glasses', 'line', '#cbd5e1', ''],
    ['jogger', 'Jogger', 0, '#f43f5e', '#fde68a', 'round', 'band', 'line', '#fb7185', ''],
    ['chef', 'Chef', 0, '#f8fafc', '#fde68a', 'round', 'toque', 'line', '#fef3c7', ''],
    ['farmer', 'Farmer', 0, '#a16207', '#fde68a', 'round', 'straw', 'line', '#eab308', ''],
    ['painter', 'Painter', 0, '#0ea5e9', '#fef3c7', 'round', 'beret', 'dots', '#f472b6', ''],
    ['mail', 'Mail Runner', 0, '#1d4ed8', '#fde68a', 'round', 'cap', 'line', '#60a5fa', ''],
    ['ninja', 'Cyber Ninja', 1, '#0f172a', '#1e293b', 'round', 'ninja', 'laser', '#22d3ee', ''],
    ['samurai', 'Samurai', 1, '#b91c1c', '#fef3c7', 'round', 'kasa', 'chain', '#f87171', ''],
    ['astro', 'Astronaut', 1, '#e2e8f0', '#f8fafc', 'helmet', 'antenna', 'line', '#93c5fd', ''],
    ['pirate', 'Pirate', 1, '#7c2d12', '#fde68a', 'round', 'pirate', 'chain', '#fbbf24', ''],
    ['cowboy', 'Cowboy', 1, '#a16207', '#fde68a', 'round', 'cowboy', 'line', '#d97706', ''],
    ['viking', 'Viking', 1, '#92400e', '#fcd34d', 'round', 'viking', 'chain', '#fcd34d', ''],
    ['wizard', 'Wizard', 1, '#4338ca', '#fde68a', 'round', 'wizard', 'dots', '#a5b4fc', ''],
    ['knight', 'Knight', 1, '#94a3b8', '#e2e8f0', 'square', 'knight', 'chain', '#e2e8f0', ''],
    ['skater', 'Skater', 1, '#22c55e', '#fde68a', 'round', 'cap', 'line', '#4ade80', ''],
    ['diver', 'Deep Diver', 1, '#0891b2', '#fde68a', 'helmet', 'none', 'line', '#67e8f9', ''],
    ['detective', 'Detective', 1, '#57534e', '#fde68a', 'round', 'fedora', 'line', '#a8a29e', ''],
    ['robot', 'Robo-Unit', 1, '#9ca3af', '#d1d5db', 'square', 'antenna', 'laser', '#f87171', ''],
    ['pizza', 'Pizza Slice', 1, '#f59e0b', '#fbbf24', 'slice', 'none', 'line', '#f97316', ''],
    ['clown', 'Clown', 1, '#ef4444', '#f8fafc', 'round', 'clown', 'dots', '#facc15', ''],
    ['lavademon', 'Lava Demon', 2, '#ea580c', '#7f1d1d', 'flame', 'horns', 'chain', '#f97316', '#f97316'],
    ['discoskel', 'Disco Skeleton', 2, '#f8fafc', '#f8fafc', 'skull', 'tophat', 'dots', 'disco', '#e879f9'],
    ['frost', 'Frost Golem', 2, '#7dd3fc', '#e0f2fe', 'crystal', 'spikes', 'line', '#bae6fd', '#bae6fd'],
    ['toxic', 'Toxic Mutant', 2, '#84cc16', '#bef264', 'blob', 'antenna', 'dots', '#a3e635', '#a3e635'],
    ['neonracer', 'Neon Racer', 2, '#f0abfc', '#a21caf', 'helmet', 'visor', 'laser', '#f0abfc', ''],
    ['shadow', 'Shadow Assassin', 2, '#18181b', '#3f3f46', 'round', 'ninja', 'chain', '#a78bfa', '#7c3aed'],
    ['thunder', 'Thunder Monk', 2, '#fde047', '#fef9c3', 'round', 'band', 'lightning', '#fde047', '#facc15'],
    ['crystalk', 'Crystal Knight', 2, '#a78bfa', '#ddd6fe', 'crystal', 'knight', 'laser', '#c4b5fd', ''],
    ['pumpkin', 'Pumpkin Head', 2, '#f97316', '#f97316', 'pumpkin', 'none', 'web', '#84cc16', '#f97316'],
    ['jelly', 'Jelly Blob', 2, '#2dd4bf', '#5eead4', 'blob', 'none', 'web', '#5eead4', '#2dd4bf'],
    ['cactus', 'Cactus Jack', 2, '#16a34a', '#4ade80', 'round', 'cowboy', 'line', '#86efac', ''],
    ['steampunk', 'Steam Punk', 2, '#b45309', '#fcd34d', 'round', 'tophat', 'chain', '#d6d3d1', ''],
    ['golddragon', 'Golden Dragon', 3, '#f59e0b', '#fde047', 'round', 'dragon', 'chain', '#fbbf24', '#fbbf24'],
    ['mechaspider', 'Mecha Spider', 3, '#475569', '#ef4444', 'square', 'antenna', 'web', '#f8fafc', '#ef4444'],
    ['stormtitan', 'Storm Titan', 3, '#60a5fa', '#dbeafe', 'round', 'crown', 'lightning', '#60a5fa', '#60a5fa'],
    ['sunwarden', 'Sun Warden', 3, '#fbbf24', '#fff7ed', 'round', 'halo', 'laser', '#fde047', '#fde047'],
    ['iceempress', 'Ice Empress', 3, '#a5f3fc', '#ecfeff', 'crystal', 'crown', 'web', '#cffafe', '#67e8f9'],
    ['phantom', 'Phantom King', 3, '#6d28d9', '#c4b5fd', 'skull', 'crown', 'chain', '#a78bfa', '#8b5cf6'],
    ['oni', 'Samurai Oni', 3, '#dc2626', '#fecaca', 'round', 'oni', 'chain', '#ef4444', '#ef4444'],
    ['starpilot', 'Star Pilot', 3, '#f8fafc', '#38bdf8', 'helmet', 'visor', 'laser', '#38bdf8', '#38bdf8'],
    ['leviathan', 'Coral Leviathan', 3, '#fb7185', '#fecdd3', 'blob', 'spikes', 'web', '#22d3ee', '#22d3ee'],
    ['phoenix', 'Rainbow Phoenix', 4, 'rainbow', 'rainbow', 'flame', 'crown', 'rainbow', 'rainbow', '#fb7185'],
    ['blackhole', 'Black Hole Entity', 4, '#0a0a0a', '#000000', 'void', 'none', 'laser', '#a855f7', '#a855f7'],
    ['glitchvoid', 'Glitch Void', 4, '#111827', '#111827', 'glitch', 'none', 'glitch', 'glitch', '#4ade80'],
    ['seraph', 'Celestial Seraph', 4, '#fef9c3', '#fffbeb', 'round', 'halo', 'laser', '#fef08a', '#fde68a'],
    ['chrono', 'Chrono Wraith', 4, '#14b8a6', '#99f6e4', 'skull', 'halo', 'lightning', '#5eead4', '#14b8a6'],
    ['djinn', 'Nebula Djinn', 4, '#c026d3', '#f0abfc', 'flame', 'band', 'rainbow', 'rainbow', '#c026d3'],
    ['ascended', 'Ascended One', 5, '#fde68a', '#fffbeb', 'round', 'halo', 'laser', 'rainbow', '#fde68a'],
    ['paradox', 'Paradox', 5, '#f8fafc', '#f8fafc', 'glitch', 'crown', 'glitch', 'glitch', '#f472b6'],
    ['architect', 'The Architect', 5, '#22d3ee', '#cffafe', 'square', 'visor', 'lightning', '#22d3ee', '#22d3ee'],
    ['omega', 'Omega', 5, '#fbbf24', '#000000', 'void', 'crown', 'rainbow', 'rainbow', '#fbbf24'],
    ['founder', 'Quest Founder', 5, '#4ade80', '#dcfce7', 'round', 'crown', 'chain', '#4ade80', '#4ade80']
  ];
  var PERK_CYCLE = ['coin', 'range', 'boost', 'gem'];
  var CHARS = CHAR_ROWS.map(function (r, i) {
    return { id: r[0], name: r[1], tier: r[2], c: r[3], h: r[4], head: r[5], hat: r[6], rope: r[7], tr: r[8], aura: r[9], perk: PERK_CYCLE[i % 4] };
  });
  var CHMAP = {}; CHARS.forEach(function (c) { CHMAP[c.id] = c; });
  var SECRET_HINT = {
    ascended: 'Rebirth once', paradox: 'Rebirth 3 times', architect: 'Reach level 1000',
    omega: 'Clear level 2000', founder: 'Claim 50 quests'
  };

  var UPG = [
    { k: 'range', n: 'Grapple Range', d: '+6 hook reach per level', base: 80, g: 1.32, max: 60 },
    { k: 'boost', n: 'Swing Boost Power', d: '+2% swing pump per level', base: 100, g: 1.34, max: 60 },
    { k: 'bounce', n: 'Bounce Elasticity', d: '+1.5% pad launch per level', base: 70, g: 1.3, max: 50 },
    { k: 'coin', n: 'Coin Multiplier', d: '+10% coins per level', base: 150, g: 1.42, max: 150 },
    { k: 'idle', n: 'Idle Coin Generator', d: 'Earns coins per minute, even offline (8h cap)', base: 250, g: 1.5, max: 80 }
  ];
  var PERKS = [
    { k: 'coin', n: 'Ascended Wealth', d: '+25% coins per rank', c: function (l) { return 2 * (l + 1); }, max: 20 },
    { k: 'start', n: 'Head Start', d: 'After Rebirth, start 100 levels further per rank', c: function (l) { return 3 * (l + 1); }, max: 19 },
    { k: 'gem', n: 'Gem Sense', d: '+2% gem drop chance per rank', c: function (l) { return 2 * (l + 1); }, max: 10 },
    { k: 'hook', n: 'Astral Hook', d: '+10 permanent grapple range per rank', c: function (l) { return 2 * (l + 1); }, max: 10 }
  ];
  var QTYPES = {
    swings: { n: 'Swing {g} times', b: 150, rb: 200 },
    bounces: { n: 'Hit {g} bounce pads', b: 25, rb: 40 },
    clears: { n: 'Clear {g} levels', b: 8, rb: 10 },
    rings: { n: 'Fly through {g} boost rings', b: 15, rb: 25 },
    ndclears: { n: 'Clear {g} levels without dying', b: 5, rb: 8 },
    coinsEarned: { n: 'Earn {g} coins', b: 3000, rb: 5000 },
    stars: { n: 'Earn {g} new stars', b: 10, rb: 15 },
    challenges: { n: 'Clear {g} Challenge/Boss stages', b: 2, rb: 3 }
  };
  var CAPS = [
    { k: 'std', n: 'Standard Capsule', cur: 'coins', odds: [70, 24, 5, 1, 0], col: '#38bdf8' },
    { k: 'sup', n: 'Super Capsule', cur: 'gems', odds: [30, 42, 20, 7, 1], col: '#c084fc' },
    { k: 'myt', n: 'Mythic Capsule', cur: 'gems', odds: [0, 25, 45, 24, 6], col: '#fb7185' }
  ];

  /* ------------------------------------------------------------------ */
  /*  Deterministic level generator (seed = level number)                */
  /* ------------------------------------------------------------------ */
  function genLevel(n) {
    var R = mulberry32(((n * 2654435761) ^ 0x5bd1e995) >>> 0);
    var d = (n - 1) / (MAX_LEVEL - 1);
    var biome = Math.min(19, Math.floor((n - 1) / 100));
    var boss = n % 100 === 0, challenge = !boss && n % 10 === 0;
    var len = 2100 + Math.min(n, 300) * 9 + d * 3600;
    if (challenge) len *= 1.3;
    if (boss) len *= 1.8;
    var L = { n: n, d: d, biome: biome, boss: boss, challenge: challenge, nodes: [], pads: [], rings: [], winds: [], spikes: [], coins: [], sx: 40, sy: 260 };
    var AW = { n: 4, m: n >= 5 ? 0.8 + d * 3 : 0, o: n >= 40 ? 0.6 + d * 2.2 : 0, f: n >= 15 ? 0.7 + d * 2.6 : 0 };
    var feat = {
      pad: n >= 3 ? 0.12 + d * 0.08 : 0, ring: n >= 8 ? 0.1 + d * 0.1 : 0, wind: n >= 25 ? 0.06 + d * 0.08 : 0,
      spike: n >= 12 ? 0.18 + d * 0.4 : 0, coins: 0.3
    };
    if (boss || challenge) {
      var mul = boss ? 1.7 : 1.3;
      AW.m *= mul; AW.o *= mul; AW.f *= mul;
      feat.spike = Math.min(0.85, feat.spike * mul + 0.1); feat.pad *= mul; feat.ring *= mul; feat.wind *= mul;
    }
    function pickAnchor() {
      var tot = AW.n + AW.m + AW.o + AW.f, r = R() * tot;
      if ((r -= AW.n) < 0) return 'n';
      if ((r -= AW.m) < 0) return 'm';
      if ((r -= AW.o) < 0) return 'o';
      return 'f';
    }
    function addNode(x, y, t) {
      var nd = { x: x, y: y, bx: x, by: y, t: t, amp: 0, spd: 0, ph: R() * 6.28, ax: 0, rad: 0, life: 1, timer: 1, broken: false };
      if (t === 'm') { nd.ax = R() < 0.5 ? 0 : 1; nd.amp = 45 + R() * 50 + d * 60; nd.spd = 1 + R() * 1.1 + d * 1.6; }
      if (t === 'o') { nd.rad = 55 + R() * 45; nd.spd = (R() < 0.5 ? -1 : 1) * (1 + d * 1.6); }
      if (t === 'f') { nd.life = 1.05 - d * 0.45; nd.timer = nd.life; }
      L.nodes.push(nd); return nd;
    }
    function nearNode(x, y, r) {
      for (var i = 0; i < L.nodes.length; i++) { var q = L.nodes[i]; if (Math.hypot(q.bx - x, q.by - y) < r + q.rad + q.amp) return true; }
      return false;
    }
    var x = 260, y = 150, prevX = 40, prevY = 260, grapples = 1, lastFeat = '';
    addNode(x, y, 'n');
    prevX = x; prevY = y;
    x += 240 + R() * 40;
    while (x < len) {
      var gap = Math.min(400, 225 + d * 110 + R() * (55 + d * 70) + (challenge ? 15 : 0));
      y = clamp(y + (R() - 0.5) * (150 + d * 170), 90, 400);
      var fr = R(), f = '';
      var acc = 0;
      if (fr < (acc += feat.pad) && lastFeat !== 'pad' && lastFeat !== 'wind') f = 'pad';
      else if (fr < (acc += feat.wind) && lastFeat !== 'pad' && lastFeat !== 'wind') f = 'wind';
      else if (fr < (acc += feat.ring)) f = 'ring';
      if (f === 'pad') {
        var py = 640 - R() * 50, tilt = 14 + R() * 18;
        L.pads.push({ x1: x - 75, y1: py - tilt, x2: x + 75, y2: py + tilt, anim: 0 });
        x += gap * 0.7;
        y = 110 + R() * 90;
      } else if (f === 'wind') {
        var ww = gap + 160;
        L.winds.push({ x: prevX + 60, y: 0, w: ww, h: FLOOR, fx: 260 + d * 200, fy: -(GRAV + 450 + d * 400) });
        x = prevX + 60 + ww + 40;
        y = 120 + R() * 120;
      } else if (f === 'ring') {
        var ang = -0.15 - R() * 0.5;
        L.rings.push({ x: (prevX + x) / 2, y: clamp(Math.max(prevY, y) + 60 + R() * 60, 150, 560), dx: Math.cos(ang), dy: Math.sin(ang), used: false });
      }
      var t = pickAnchor();
      addNode(x, y, t); grapples++;
      // hazards
      if (f !== 'pad' && f !== 'wind' && R() < feat.spike) {
        var sx = (prevX + x) / 2 + (R() - 0.5) * 60;
        var sy = clamp(Math.max(prevY, y) + 340 + R() * 110, 470, 740);
        if (!nearNode(sx, sy, 150)) {
          var mv = n >= 60 && R() < 0.25 + d * 0.5;
          L.spikes.push({ x: sx, y: sy, bx: sx, by: sy, r: 16 + R() * 8 + d * 6, amp: mv ? 35 + R() * 45 : 0, spd: 1 + R() * 1.5 + d, ph: R() * 6.28, ax: R() < 0.7 ? 1 : 0 });
        }
      }
      if (n >= 150 && R() < d * 0.3) {
        var hx = x + (R() - 0.5) * 80, hy = y - 280 - R() * 60;
        if (hy > -150 && !nearNode(hx, hy, 120)) L.spikes.push({ x: hx, y: hy, bx: hx, by: hy, r: 18, amp: 0, spd: 0, ph: 0, ax: 0 });
      }
      if (R() < feat.coins) {
        var cn = 3 + Math.floor(R() * 3);
        for (var k = 0; k < cn; k++) {
          var u = (k + 1) / (cn + 1);
          L.coins.push({ x: lerp(prevX, x, u), y: lerp(prevY, y, u) + 120 - Math.sin(u * Math.PI) * 90, taken: false });
        }
      }
      lastFeat = f;
      prevX = x; prevY = y;
      x += gap;
    }
    addNode(x, 170, 'n'); grapples++;
    L.finishX = x + 260;
    L.parTime = Math.round((L.finishX / (600 + 150 * d) + 1.3) * 10) / 10;
    L.parSwings = Math.max(3, Math.ceil(grapples * 0.72));
    L.pads.forEach(function (p) {
      var ex = p.x2 - p.x1, ey = p.y2 - p.y1, l = Math.hypot(ex, ey);
      p.nx = ey / l; p.ny = -ex / l; p.minx = Math.min(p.x1, p.x2); p.maxx = Math.max(p.x1, p.x2);
    });
    return L;
  }

  /* ------------------------------------------------------------------ */
  /*  Character renderer (shared by game + menus)                        */
  /* ------------------------------------------------------------------ */
  var POSE_SW = { hd: [0, -17], nk: [0, -11], hp: [0, 3], ea: [1.5, -17], ha: [1, -24], eb: [-5, -6], hb: [-9, -1], kl: [-4, 10], fl: [-6, 18], kr: [4, 10], fr: [3, 18] };
  var POSE_CU = { hd: [0, -7], nk: [0, -3], hp: [0, 4], ea: [6, -2], ha: [5, 4], eb: [-5, -1], hb: [-2, 5], kl: [7, 1], fl: [2, 8], kr: [6, 6], fr: [-1, 9] };
  var JK = ['hd', 'nk', 'hp', 'ea', 'ha', 'eb', 'hb', 'kl', 'fl', 'kr', 'fr'];

  function colorOf(c, t, off) {
    if (c === 'rainbow' || c === 'disco') return 'hsl(' + Math.floor((t * 140 + (off || 0)) % 360) + ',90%,62%)';
    if (c === 'glitch') return ((Math.floor(t * 20) + (off | 0)) % 3 === 0) ? '#f43f5e' : (Math.floor(t * 20) % 3 === 1 ? '#22d3ee' : '#4ade80');
    return c;
  }

  function computeJoints(x, y, ang, curl, spin, t, sc) {
    var J = {};
    var ca = Math.cos(ang), sa = Math.sin(ang), cc = Math.cos(spin), ss = Math.sin(spin);
    var sw = Math.sin(t * 7) * 2.5;
    for (var i = 0; i < JK.length; i++) {
      var k = JK[i], a = POSE_SW[k], b = POSE_CU[k];
      var ax = a[0], ay = a[1];
      if (k === 'hb') { ax += sw; ay -= sw * 0.4; }
      if (k === 'fl') ax += sw * 1.2;
      if (k === 'fr') ax -= sw;
      var w1x = ax * ca - ay * sa, w1y = ax * sa + ay * ca;
      var w2x = b[0] * cc - b[1] * ss, w2y = b[0] * ss + b[1] * cc;
      J[k] = [x + lerp(w1x, w2x, curl) * sc, y + lerp(w1y, w2y, curl) * sc];
    }
    return J;
  }

  function drawHead(g, ch, t) {
    var hc = colorOf(ch.h, t);
    var accent = colorOf(ch.tr, t, 120);
    var i;
    switch (ch.head) {
      case 'square':
        g.fillStyle = hc; g.fillRect(-6, -6, 12, 12);
        g.fillStyle = '#ef4444'; g.fillRect(-4.5, -2, 9, 2.6); break;
      case 'skull':
        g.fillStyle = hc; g.beginPath(); g.arc(0, -0.5, 6.3, 0, 7); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(-2.2, -1, 1.6, 0, 7); g.arc(2.4, -1, 1.6, 0, 7); g.fill();
        g.fillRect(-2, 3, 4, 1); break;
      case 'slice':
        g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -5); g.lineTo(0, 8); g.closePath(); g.fill();
        g.fillStyle = '#b45309'; g.fillRect(-7.5, -8, 15, 3.5);
        g.fillStyle = '#dc2626'; g.beginPath(); g.arc(-2, -2, 1.6, 0, 7); g.arc(2.5, 0, 1.4, 0, 7); g.arc(0, 3.5, 1.2, 0, 7); g.fill(); break;
      case 'pumpkin':
        g.fillStyle = '#f97316'; g.beginPath(); g.ellipse(0, 0, 7.5, 6.2, 0, 0, 7); g.fill();
        g.strokeStyle = '#c2410c'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, 3, 6, 0, 0, 7); g.stroke();
        g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(-4, -2); g.lineTo(-1.5, -2); g.lineTo(-2.8, -4); g.fill();
        g.beginPath(); g.moveTo(4, -2); g.lineTo(1.5, -2); g.lineTo(2.8, -4); g.fill(); g.fillRect(-3, 2, 6, 1.5);
        g.fillStyle = '#15803d'; g.fillRect(-1, -9, 2, 3); break;
      case 'helmet':
        g.fillStyle = hc; g.beginPath(); g.arc(0, 0, 7.2, 0, 7); g.fill();
        g.fillStyle = accent; g.beginPath(); g.ellipse(1.5, -0.5, 4.5, 3, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, -2.5, 2, 1.2); break;
      case 'void':
        g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 6.5, 0, 7); g.fill();
        g.strokeStyle = accent; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, 10, 3.5, t * 2, 0, 7); g.stroke();
        g.fillStyle = accent; g.beginPath(); g.arc(Math.cos(t * 4) * 9, Math.sin(t * 4) * 3, 1.2, 0, 7); g.fill(); break;
      case 'blob':
        g.fillStyle = hc; g.globalAlpha *= 0.9; g.beginPath();
        for (i = 0; i <= 10; i++) {
          var a = i / 10 * 6.283, rr = 6.3 + Math.sin(a * 3 + t * 5) * 0.9;
          if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.fill(); g.globalAlpha /= 0.9;
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-2, -2.5, 1.5, 0, 7); g.fill(); break;
      case 'flame':
        for (i = 0; i < 3; i++) {
          var fl = Math.sin(t * 12 + i * 2) * 1.5;
          g.fillStyle = i === 1 ? '#fde047' : colorOf(ch.tr === 'rainbow' ? 'rainbow' : '#f97316', t, i * 60);
          g.beginPath(); g.moveTo(-5 + i * 5 - 2.5, -3); g.lineTo(-5 + i * 5, -12 - fl - (i === 1 ? 3 : 0)); g.lineTo(-5 + i * 5 + 2.5, -3); g.fill();
        }
        g.fillStyle = hc; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
        g.fillStyle = '#fde047'; g.beginPath(); g.arc(-2, -0.5, 1.1, 0, 7); g.arc(2.2, -0.5, 1.1, 0, 7); g.fill(); break;
      case 'crystal':
        g.fillStyle = hc; g.beginPath(); g.moveTo(0, -8.5); g.lineTo(6.5, 0); g.lineTo(0, 7.5); g.lineTo(-6.5, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -8.5); g.lineTo(0, 7.5); g.moveTo(-6.5, 0); g.lineTo(6.5, 0); g.stroke(); break;
      case 'glitch':
        var j = (hash2(Math.floor(t * 15), 9) - 0.5) * 3;
        g.fillStyle = '#f43f5e'; g.fillRect(-6 + j, -6, 12, 12);
        g.fillStyle = '#22d3ee'; g.fillRect(-6 - j, -6 + j * 0.5, 12, 12);
        g.fillStyle = hc === '#111827' ? '#0b0f19' : hc; g.fillRect(-5.5, -5.5, 11, 11);
        g.fillStyle = '#4ade80'; g.fillRect(-4, -2, 3, 2); g.fillRect(1.5, -2, 3, 2); break;
      default:
        g.fillStyle = hc; g.beginPath(); g.arc(0, 0, 6.2, 0, 7); g.fill();
    }
  }

  function drawHat(g, ch, t) {
    var tc = colorOf(ch.tr, t, 60);
    switch (ch.hat) {
      case 'band': g.fillStyle = tc; g.fillRect(-6.6, -3.5, 13.2, 2.6); g.fillRect(-9.5, -3.2, 3.5, 1.4); g.fillRect(-10, -1.8, 3, 1.2); break;
      case 'leaf': g.fillStyle = '#22c55e'; g.beginPath(); g.ellipse(3, -9, 4, 1.8, -0.6, 0, 7); g.fill(); g.fillRect(-0.5, -9, 1, 3.5); break;
      case 'cap': g.fillStyle = tc; g.beginPath(); g.arc(0, -3, 6.6, Math.PI, 0); g.fill(); g.fillRect(0, -4, 10, 2); break;
      case 'beret': g.fillStyle = tc; g.beginPath(); g.ellipse(1, -5.5, 7.5, 3.2, 0.15, 0, 7); g.fill(); g.fillRect(0, -10, 1.2, 2); break;
      case 'miner':
        g.fillStyle = '#facc15'; g.beginPath(); g.arc(0, -3, 7, Math.PI, 0); g.fill(); g.fillRect(-8, -3.5, 16, 1.8);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(4, -6, 1.8, 0, 7); g.fill(); break;
      case 'glasses': g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.arc(-2.5, -0.5, 2, 0, 7); g.moveTo(4.5, -0.5); g.arc(2.5, -0.5, 2, 0, 7); g.stroke(); break;
      case 'toque': g.fillStyle = '#fff'; g.fillRect(-4.5, -11, 9, 6); g.beginPath(); g.arc(-3, -12, 3, 0, 7); g.arc(0, -13.5, 3.4, 0, 7); g.arc(3, -12, 3, 0, 7); g.fill(); break;
      case 'straw': g.fillStyle = '#eab308'; g.beginPath(); g.ellipse(0, -4.5, 11, 2.4, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -5, 5, Math.PI, 0); g.fill(); g.fillStyle = '#dc2626'; g.fillRect(-5, -6.5, 10, 1.4); break;
      case 'ninja':
        g.fillStyle = '#111827'; g.fillRect(-6.6, -4, 13.2, 3.5);
        g.strokeStyle = '#111827'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6, -2.5); g.lineTo(-12, -1 + Math.sin(t * 9) * 2); g.moveTo(-6, -2); g.lineTo(-11, 2 + Math.sin(t * 9 + 1) * 2); g.stroke();
        g.fillStyle = tc; g.fillRect(-1, -3, 6, 1.4); break;
      case 'kasa': g.fillStyle = '#d6b370'; g.beginPath(); g.moveTo(-12, -3); g.lineTo(12, -3); g.lineTo(0, -12); g.closePath(); g.fill(); g.strokeStyle = '#a16207'; g.lineWidth = 0.8; g.stroke(); break;
      case 'pirate': g.fillStyle = '#111'; g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(0, -16, 10, -4); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -8, 1.5, 0, 7); g.fill(); break;
      case 'cowboy': g.fillStyle = '#92400e'; g.beginPath(); g.ellipse(0, -4.5, 11, 2.3, 0, 0, 7); g.fill(); g.fillRect(-5, -11, 10, 6.5); g.fillStyle = '#451a03'; g.fillRect(-5, -6.5, 10, 1.4); break;
      case 'viking':
        g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(0, -2.5, 6.8, Math.PI, 0); g.fill();
        g.fillStyle = '#f5f5f4'; g.beginPath(); g.moveTo(-6, -4); g.quadraticCurveTo(-11, -7, -10, -13); g.lineTo(-5, -7); g.fill();
        g.beginPath(); g.moveTo(6, -4); g.quadraticCurveTo(11, -7, 10, -13); g.lineTo(5, -7); g.fill(); break;
      case 'wizard': g.fillStyle = '#4338ca'; g.beginPath(); g.moveTo(-8, -3.5); g.lineTo(8, -3.5); g.lineTo(3, -22); g.closePath(); g.fill(); g.fillStyle = '#fde047'; g.fillRect(-0.5, -12, 2.4, 2.4); break;
      case 'knight':
        g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(0, -0.5, 7.3, Math.PI * 0.9, Math.PI * 2.1); g.fill();
        g.fillStyle = '#1f2937'; g.fillRect(-1, -2, 7, 1.6);
        g.fillStyle = '#ef4444'; g.beginPath(); g.ellipse(-3, -10, 2.2, 5, -0.5, 0, 7); g.fill(); break;
      case 'clown':
        g.fillStyle = '#ef4444'; g.beginPath(); g.arc(6, 0.5, 2, 0, 7); g.fill();
        g.fillStyle = colorOf('rainbow', t); g.beginPath(); g.arc(-6, -4, 3.5, 0, 7); g.arc(6, -5, 3, 0, 7); g.arc(0, -7, 3.2, 0, 7); g.fill(); break;
      case 'tophat': g.fillStyle = '#111'; g.fillRect(-5, -17, 10, 11); g.fillRect(-8.5, -7, 17, 2.2); g.fillStyle = tc; g.fillRect(-5, -9.5, 10, 1.8); break;
      case 'fedora': g.fillStyle = '#44403c'; g.beginPath(); g.ellipse(0, -4.5, 10, 2.2, 0, 0, 7); g.fill(); g.fillRect(-5, -10, 10, 5.5); g.fillStyle = '#111'; g.fillRect(-5, -6.4, 10, 1.4); break;
      case 'horns': g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(-5, -4); g.lineTo(-8, -12); g.lineTo(-2, -5); g.fill(); g.beginPath(); g.moveTo(5, -4); g.lineTo(8, -12); g.lineTo(2, -5); g.fill(); break;
      case 'dragon':
        g.fillStyle = '#fde047'; g.beginPath(); g.moveTo(-4, -4); g.lineTo(-9, -13); g.lineTo(-1, -5); g.fill(); g.beginPath(); g.moveTo(4, -4); g.lineTo(9, -13); g.lineTo(1, -5); g.fill();
        g.fillStyle = '#b45309'; for (var s = 0; s < 3; s++) { g.beginPath(); g.moveTo(-8 + s * 2, 1 + s * 2); g.lineTo(-12 + s * 2, 2 + s * 2); g.lineTo(-7 + s * 2, 4 + s * 2); g.fill(); } break;
      case 'crown': g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(-6, -5); g.lineTo(-6, -11); g.lineTo(-3, -8); g.lineTo(0, -12.5); g.lineTo(3, -8); g.lineTo(6, -11); g.lineTo(6, -5); g.closePath(); g.fill(); g.fillStyle = '#ef4444'; g.fillRect(-1, -8, 2, 2); break;
      case 'halo': g.strokeStyle = '#fde047'; g.lineWidth = 1.8; g.globalAlpha *= 0.9; g.beginPath(); g.ellipse(0, -12 + Math.sin(t * 3), 6.5, 2, 0, 0, 7); g.stroke(); g.globalAlpha /= 0.9; break;
      case 'antenna': g.strokeStyle = '#9ca3af'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -6); g.lineTo(2, -14); g.stroke(); g.fillStyle = tc; g.beginPath(); g.arc(2, -14.5, 2, 0, 7); g.fill(); break;
      case 'spikes': g.fillStyle = tc; for (var q = -2; q <= 2; q++) { g.beginPath(); var aa = -Math.PI / 2 + q * 0.5; g.moveTo(Math.cos(aa - 0.2) * 6, Math.sin(aa - 0.2) * 6); g.lineTo(Math.cos(aa) * 12, Math.sin(aa) * 12); g.lineTo(Math.cos(aa + 0.2) * 6, Math.sin(aa + 0.2) * 6); g.fill(); } break;
      case 'oni':
        g.fillStyle = '#fef2f2'; g.beginPath(); g.moveTo(-4, -5); g.lineTo(-6, -13); g.lineTo(-1, -5.5); g.fill(); g.beginPath(); g.moveTo(4, -5); g.lineTo(6, -13); g.lineTo(1, -5.5); g.fill();
        g.fillStyle = '#7f1d1d'; g.fillRect(-4, 1.5, 8, 1.5); break;
      case 'visor': g.fillStyle = tc; g.fillRect(-5, -2.2, 11, 2.6); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(2 + Math.sin(t * 4) * 2, -2, 2, 1); break;
    }
  }

  // o: {ang, curl, spin, t, sc, alpha}
  function drawCharacter(g, ch, x, y, o) {
    var sc = o.sc || 1, t = o.t || 0;
    var J = computeJoints(x, y, o.ang || 0, o.curl || 0, o.spin || 0, t, sc);
    if (ch.aura) {
      var ar = 26 * sc + Math.sin(t * 4) * 2 * sc;
      var gr = g.createRadialGradient(x, y, 2, x, y, ar);
      gr.addColorStop(0, ch.aura + '88'); gr.addColorStop(1, ch.aura + '00');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, ar, 0, 7); g.fill();
    }
    var lc = colorOf(ch.c, t);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (ch.c === '#0a0a0a' || ch.c === '#111827' || ch.c === '#0f172a' || ch.c === '#18181b') {
      // dark characters get a light outline so they stay readable
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5.4 * sc; strokeLimbs(g, J);
    }
    g.strokeStyle = lc; g.lineWidth = 3.4 * sc; strokeLimbs(g, J);
    var hx = J.hd[0], hy = J.hd[1];
    var ha = Math.atan2(J.hd[1] - J.nk[1], J.hd[0] - J.nk[0]) + Math.PI / 2;
    g.save(); g.translate(hx, hy); g.rotate(ha); g.scale(sc, sc);
    drawHead(g, ch, t); drawHat(g, ch, t);
    g.restore();
    return J;
  }
  function strokeLimbs(g, J) {
    g.beginPath();
    g.moveTo(J.nk[0], J.nk[1]); g.lineTo(J.hp[0], J.hp[1]);
    g.moveTo(J.nk[0], J.nk[1]); g.lineTo(J.ea[0], J.ea[1]); g.lineTo(J.ha[0], J.ha[1]);
    g.moveTo(J.nk[0], J.nk[1]); g.lineTo(J.eb[0], J.eb[1]); g.lineTo(J.hb[0], J.hb[1]);
    g.moveTo(J.hp[0], J.hp[1]); g.lineTo(J.kl[0], J.kl[1]); g.lineTo(J.fl[0], J.fl[1]);
    g.moveTo(J.hp[0], J.hp[1]); g.lineTo(J.kr[0], J.kr[1]); g.lineTo(J.fr[0], J.fr[1]);
    g.stroke();
  }

  function drawRope(g, x1, y1, x2, y2, ch, t) {
    var col = colorOf(ch.tr === 'disco' ? 'rainbow' : ch.tr, t, 30);
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, i, f;
    g.lineCap = 'round';
    switch (ch.rope) {
      case 'laser':
        g.globalAlpha = 0.35; g.strokeStyle = col; g.lineWidth = 8; line(g, x1, y1, x2, y2);
        g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 1.8; line(g, x1, y1, x2, y2); break;
      case 'lightning':
        g.strokeStyle = col; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x1, y1);
        var segs = Math.max(4, Math.floor(len / 22)), seed = Math.floor(t * 30);
        for (i = 1; i < segs; i++) { f = i / segs; var off = (hash2(i, seed) - 0.5) * 16; g.lineTo(x1 + dx * f + nx * off, y1 + dy * f + ny * off); }
        g.lineTo(x2, y2); g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); break;
      case 'chain':
        g.strokeStyle = col; g.lineWidth = 1.8;
        var steps = Math.floor(len / 8);
        for (i = 0; i < steps; i++) {
          f = (i + 0.5) / steps; g.beginPath();
          g.ellipse(x1 + dx * f, y1 + dy * f, 4, 2.2, Math.atan2(dy, dx) + (i % 2 ? Math.PI / 2 : 0) * 0.0, 0, 7); g.stroke();
        } break;
      case 'web':
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.4; line(g, x1, y1, x2, y2);
        g.strokeStyle = col; g.lineWidth = 1;
        for (i = 1; i < len / 16; i++) { f = i * 16 / len; var px = x1 + dx * f, py = y1 + dy * f; line(g, px - nx * 4, py - ny * 4, px + nx * 4, py + ny * 4); } break;
      case 'rainbow':
        g.lineWidth = 3.4;
        for (i = 0; i < 12; i++) { g.strokeStyle = 'hsl(' + ((i * 30 + t * 200) % 360) + ',90%,60%)'; line(g, x1 + dx * i / 12, y1 + dy * i / 12, x1 + dx * (i + 1) / 12, y1 + dy * (i + 1) / 12); } break;
      case 'dots':
        g.strokeStyle = col; g.lineWidth = 3.2; g.setLineDash([1, 6]); line(g, x1, y1, x2, y2); g.setLineDash([]); break;
      case 'glitch':
        var jj = (hash2(Math.floor(t * 20), 3) - 0.5) * 6;
        g.lineWidth = 2;
        g.strokeStyle = '#f43f5e'; line(g, x1 + jj, y1, x2 + jj, y2);
        g.strokeStyle = '#22d3ee'; line(g, x1 - jj, y1 + jj * 0.5, x2 - jj, y2);
        g.strokeStyle = '#4ade80'; line(g, x1, y1, x2, y2); break;
      default:
        g.strokeStyle = col; g.lineWidth = 2.6; line(g, x1, y1, x2, y2);
    }
    // hook head
    g.fillStyle = col;
    g.beginPath(); g.arc(x2, y2, ch.tier >= 3 ? 5 : 3.5, 0, 7); g.fill();
  }
  function line(g, a, b, c, d) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }

  function drawCharPreview(cv, ch, locked, t) {
    var g = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    var s = w / 64;
    if (locked) {
      g.globalAlpha = 0.25;
      g.fillStyle = '#000';
    }
    var J = computeJoints(w * 0.45, h * 0.58, 0.35, 0, 0, t || 0.4, s * 1.25);
    if (!locked) {
      g.fillStyle = '#facc15'; g.beginPath(); g.arc(w * 0.72, h * 0.08, 4 * s, 0, 7); g.fill();
      drawRope(g, J.ha[0], J.ha[1], w * 0.72, h * 0.08, ch, t || 0.4);
      drawCharacter(g, ch, w * 0.45, h * 0.58, { ang: 0.35, curl: 0, spin: 0, t: t || 0.4, sc: s * 1.25 });
    } else {
      g.strokeStyle = '#64748b'; g.lineWidth = 3.4 * s * 1.25; g.lineCap = 'round'; strokeLimbs(g, J);
      g.fillStyle = '#64748b'; g.beginPath(); g.arc(J.hd[0], J.hd[1], 6.5 * s * 1.25, 0, 7); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#e2e8f0'; g.font = 'bold ' + Math.round(16 * s) + 'px system-ui'; g.textAlign = 'center'; g.fillText('?', w * 0.45, h * 0.62);
    }
    g.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /*  Save helpers                                                       */
  /* ------------------------------------------------------------------ */
  function newSave() {
    var stats = { swings: 0, bounces: 0, clears: 0, rings: 0, ndclears: 0, coinsEarned: 0, stars: 0, challenges: 0, pulls: 0, deaths: 0, quests: 0, topClear: 0 };
    var rep = {};
    Object.keys(QTYPES).forEach(function (k) { rep[k] = { t: 0, base: 0 }; });
    return {
      v: 1, created: Date.now(), lastSeen: Date.now(),
      maxLevel: 1, bestLevel: 1, coins: 0, gems: 10, shards: 0, shardsTotal: 0, prestige: 0, pity: 0,
      upg: { range: 0, boost: 0, bounce: 0, coin: 0, idle: 0 },
      perks: { coin: 0, start: 0, gem: 0, hook: 0 },
      chars: { classic: { s: 1, f: 0 } }, sel: 'classic',
      medals: {}, stats: stats, daily: { date: '', list: [] }, rep: rep, playtime: 0
    };
  }
  function normalizeSave(o) {
    var base = newSave();
    if (!o || typeof o !== 'object') return base;
    var out = base;
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
    if (o.medals && typeof o.medals === 'object') Object.keys(o.medals).forEach(function (k) { var v = o.medals[k] | 0; if (v) out.medals[k] = v & 7; });
    if (o.daily && Array.isArray(o.daily.list)) out.daily = { date: String(o.daily.date || ''), list: o.daily.list.filter(function (q) { return q && QTYPES[q.k]; }).slice(0, 3) };
    if (o.rep && typeof o.rep === 'object') Object.keys(out.rep).forEach(function (k) { if (o.rep[k]) out.rep[k] = { t: o.rep[k].t | 0, base: +o.rep[k].base || 0 }; });
    out.maxLevel = clamp(Math.floor(out.maxLevel), 1, MAX_LEVEL);
    out.bestLevel = Math.max(out.bestLevel, out.maxLevel);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  The game                                                           */
  /* ------------------------------------------------------------------ */
  function startGame(container) {
    var LS = {
      get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
    };

    /* ---------- DOM ---------- */
    var style = document.createElement('style');
    style.textContent = [
      '.hlr-root{position:relative;width:100%;height:100%;min-height:320px;overflow:hidden;background:#0b1020;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f8fafc;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent}',
      '.hlr-root canvas.hlr-cv{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:pointer}',
      '.hlr-hud{position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:30}',
      '.hlr-ib{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(15,23,42,.62);color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(4px)}',
      '.hlr-ib:hover{background:rgba(79,70,229,.8)}',
      '.hlr-scr{position:absolute;inset:0;z-index:20;overflow:auto;background:rgba(3,6,20,.74);backdrop-filter:blur(3px);padding:56px 16px 24px;box-sizing:border-box;display:none;touch-action:pan-y}',
      '.hlr-pn{max-width:980px;margin:0 auto}',
      '.hlr-h1{font-size:clamp(28px,6vw,54px);font-weight:900;letter-spacing:1px;margin:0 0 4px;background:linear-gradient(90deg,#fde047,#fb7185,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent;text-align:center}',
      '.hlr-h2{font-size:22px;font-weight:800;margin:0 0 12px}',
      '.hlr-sub{opacity:.8;text-align:center;margin-bottom:16px}',
      '.hlr-card{background:linear-gradient(160deg,rgba(30,41,59,.92),rgba(15,23,42,.92));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;box-sizing:border-box}',
      '.hlr-grid{display:grid;gap:10px}',
      '.hlr-b{border:0;border-radius:11px;padding:9px 14px;font-weight:800;font-size:14px;cursor:pointer;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 3px 0 rgba(0,0,0,.35);font-family:inherit}',
      '.hlr-b:hover{filter:brightness(1.15)}.hlr-b:active{transform:translateY(2px);box-shadow:none}',
      '.hlr-b[disabled]{opacity:.4;cursor:not-allowed;filter:grayscale(.6)}',
      '.hlr-b.g{background:linear-gradient(135deg,#16a34a,#22c55e)}.hlr-b.r{background:linear-gradient(135deg,#b91c1c,#ef4444)}.hlr-b.y{background:linear-gradient(135deg,#d97706,#f59e0b)}.hlr-b.s{background:rgba(255,255,255,.12)}.hlr-b.c{background:linear-gradient(135deg,#0891b2,#22d3ee)}',
      '.hlr-b.big{font-size:20px;padding:14px 22px;border-radius:14px}',
      '.hlr-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.hlr-top{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.hlr-pill{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 11px;font-weight:800;font-size:14px;white-space:nowrap}',
      '.hlr-k{display:inline-block;background:#1e293b;border:1px solid #475569;border-bottom-width:3px;border-radius:6px;padding:1px 7px;font-weight:800;font-size:12px;margin-right:4px}',
      '.hlr-bar{height:9px;background:rgba(255,255,255,.12);border-radius:9px;overflow:hidden}.hlr-bar>i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa)}',
      '.hlr-lv{aspect-ratio:1;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(30,41,59,.9);color:#fff;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;padding:0;font-family:inherit}',
      '.hlr-lv small{font-size:9px;letter-spacing:-1px;color:#fde047}.hlr-lv.ch{border-color:#f59e0b}.hlr-lv.bs{border-color:#fb7185;background:rgba(127,29,29,.75)}.hlr-lv.lk{opacity:.35;cursor:not-allowed}.hlr-lv.cur{outline:2px solid #22d3ee}',
      '.hlr-tab{padding:6px 9px;font-size:12px;border-radius:8px}',
      '.hlr-ch{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;border-width:2px}',
      '.hlr-ch canvas{width:72px;height:72px;background:radial-gradient(circle,rgba(255,255,255,.08),transparent 70%);border-radius:12px}',
      '.hlr-modal{position:absolute;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:16px;box-sizing:border-box}',
      '.hlr-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:45;background:rgba(15,23,42,.94);border:1px solid #a78bfa;border-radius:12px;padding:9px 16px;font-weight:800;pointer-events:none;transition:opacity .3s;opacity:0;max-width:90%;text-align:center}',
      '.hlr-pull{display:inline-flex;flex-direction:column;align-items:center;margin:4px;padding:8px;border-radius:12px;border:2px solid;min-width:84px;background:rgba(0,0,0,.35);animation:hlrpop .45s ease both}',
      '@keyframes hlrpop{0%{transform:scale(.3) rotate(-12deg);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}',
      '.hlr-scr::-webkit-scrollbar{width:8px}.hlr-scr::-webkit-scrollbar-thumb{background:#475569;border-radius:8px}',
      '@media (max-width:560px){.hlr-scr{padding:52px 10px 20px}.hlr-b{padding:8px 11px;font-size:13px}}'
    ].join('\n');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'hlr-root';
    root.tabIndex = 0;
    root.style.outline = 'none';
    container.appendChild(root);
    var canvas = document.createElement('canvas');
    canvas.className = 'hlr-cv';
    root.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var hud = document.createElement('div'); hud.className = 'hlr-hud';
    hud.innerHTML = '<button class="hlr-ib" data-h="menu" title="Pause / Menu (Esc)">\u2630</button>' +
      '<button class="hlr-ib" data-h="restart" title="Restart level (R)">\u21bb</button>' +
      '<button class="hlr-ib" data-h="mute" title="Mute (M)">\ud83d\udd0a</button>' +
      '<button class="hlr-ib" data-h="fs" title="Fullscreen (F)">\u26f6</button>';
    root.appendChild(hud);
    var scr = document.createElement('div'); scr.className = 'hlr-scr'; root.appendChild(scr);
    var modal = document.createElement('div'); modal.className = 'hlr-modal'; root.appendChild(modal);
    var toastEl = document.createElement('div'); toastEl.className = 'hlr-toast'; root.appendChild(toastEl);
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
      grab: function () { tone(880, 0.05, 'square', 0.08, 0.6); tone(1320, 0.04, 'sine', 0.06, 1, 0.02); },
      whoosh: function (sp) { noise(0.22, Math.min(0.35, 0.1 + sp / 6000), 400, 2400); },
      bounce: function () { tone(220, 0.25, 'sine', 0.3, 3.2); tone(440, 0.12, 'triangle', 0.1, 2); },
      ring: function () { [660, 880, 1175].forEach(function (f, i) { tone(f, 0.12, 'triangle', 0.13, 1, i * 0.05); }); },
      coin: function () { tone(1400, 0.06, 'square', 0.05); tone(2100, 0.08, 'square', 0.05, 1, 0.05); },
      brk: function () { noise(0.25, 0.3, 2000, 300); tone(300, 0.15, 'sawtooth', 0.08, 0.4); },
      die: function () { tone(330, 0.45, 'sawtooth', 0.18, 0.2); noise(0.35, 0.25, 900, 120); },
      win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.25, 'triangle', 0.16, 1, i * 0.09); }); tone(1568, 0.6, 'sine', 0.1, 1, 0.5); },
      click: function () { tone(600, 0.04, 'square', 0.05); },
      buy: function () { tone(523, 0.08, 'square', 0.07); tone(784, 0.12, 'square', 0.07, 1, 0.07); },
      pull: function (tier) { for (var i = 0; i <= tier + 1; i++) tone(400 + i * 180, 0.14, 'triangle', 0.12, 1, i * 0.08); },
      err: function () { tone(160, 0.15, 'square', 0.08); }
    };
    function startAmbient(b) {
      stopAmbient();
      if (!actx || muted) return;
      try {
        var hz = BIOMES[b].hz / 2;
        var g = actx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.035, actx.currentTime + 1.5);
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
    var mode = 'menu'; // menu | play
    var paused = false;
    var L = null, ML = null, curLevel = 1;
    var P = null;
    var D = null; // derived stats
    var cam = { x: 0, y: 300, z: 1, tz: 1 };
    var shake = 0, shx = 0, shy = 0, hitstop = 0, slowT = 0;
    var lvTime = 0, runTime = 0, swings = 0, combo = 0, comboT = 0, maxCombo = 0, runCoins = 0, levelDeaths = 0;
    var deadT = 0, winT = 0, bannerT = 0, lastResult = null;
    var trail = [], trailTick = 0;
    var acc = 0, last = 0, raf = 0, ptFlush = 0, idleAcc = 0, wallT = 0;
    var curScreen = '', levelWorld = 0, importTarget = -1;
    var targetNode = null;

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

    /* ---------- derived stats ---------- */
    function charBonus() {
      var ch = CHMAP[S.sel] || CHARS[0], st = (S.chars[S.sel] || { s: 1 }).s, tm = TMULT[ch.tier];
      return {
        coin: ch.perk === 'coin' ? 0.03 * tm * st : 0, range: ch.perk === 'range' ? 4 * tm * st : 0,
        boost: ch.perk === 'boost' ? 0.015 * tm * st : 0, gem: ch.perk === 'gem' ? 0.01 * tm * st : 0
      };
    }
    function perkText(ch, st) {
      var tm = TMULT[ch.tier];
      if (ch.perk === 'coin') return '+' + Math.round(3 * tm * st) + '% coins';
      if (ch.perk === 'range') return '+' + Math.round(4 * tm * st) + ' range';
      if (ch.perk === 'boost') return '+' + (1.5 * tm * st).toFixed(1) + '% swing';
      return '+' + (1 * tm * st).toFixed(1) + '% gem luck';
    }
    function totalStars() { var t = 0; for (var k in S.chars) t += S.chars[k].s; return t; }
    function derive() {
      var cb = charBonus();
      D = {
        range: 330 + S.upg.range * 6 + S.perks.hook * 10 + cb.range,
        boost: 320 * (1 + S.upg.boost * 0.02 + cb.boost),
        bounceE: 0.92 + S.upg.bounce * 0.015,
        padMin: 1050 + S.upg.bounce * 12,
        coinMult: (1 + S.upg.coin * 0.1) * (1 + S.perks.coin * 0.25) * (1 + S.prestige * 0.5 + S.shardsTotal * 0.02) * (1 + cb.coin + totalStars() * 0.005),
        gemChance: 0.04 + S.perks.gem * 0.02 + cb.gem
      };
    }
    function idleRate() { return S ? S.upg.idle * (3 + S.bestLevel * 0.25) * (1 + S.prestige * 0.5) : 0; }
    function upgCost(u) { return Math.floor(u.base * Math.pow(u.g, S.upg[u.k])); }
    function capCost(c, count) {
      var one = c.k === 'std' ? 300 + S.bestLevel * 25 : c.k === 'sup' ? 25 : 90;
      return count === 10 ? (c.k === 'std' ? one * 10 : one * 9) : one;
    }

    /* ---------- quests ---------- */
    function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function ensureDaily() {
      var k = todayKey();
      if (S.daily.date === k && S.daily.list.length === 3) return;
      var seed = 0; for (var i = 0; i < k.length; i++) seed = seed * 31 + k.charCodeAt(i);
      var R = mulberry32(seed + slotIdx * 977), keys = Object.keys(QTYPES), list = [];
      while (list.length < 3) {
        var q = keys[Math.floor(R() * keys.length)];
        if (list.some(function (x) { return x.k === q; })) continue;
        var goal = QTYPES[q].b;
        if (q === 'coinsEarned') goal = Math.round(goal * (1 + S.bestLevel / 30));
        list.push({ k: q, g: goal, s: S.stats[q], c: false });
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
      var cond = {
        ascended: S.prestige >= 1, paradox: S.prestige >= 3, architect: S.bestLevel >= 1000,
        omega: S.stats.topClear >= MAX_LEVEL, founder: S.stats.quests >= 50
      };
      Object.keys(cond).forEach(function (id) {
        if (cond[id] && !S.chars[id]) { S.chars[id] = { s: 1, f: 0 }; toast('\ud83d\udd13 Secret character unlocked: ' + CHMAP[id].name + '!'); }
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
      modal.innerHTML = '<div class="hlr-card" style="max-width:520px;width:100%;text-align:center">' + html +
        '<div class="hlr-row" style="justify-content:center;margin-top:14px">' +
        (onYes ? '<button class="hlr-b r" data-m="yes">' + (yesLabel || 'Yes') + '</button><button class="hlr-b s" data-m="no">' + (noLabel || 'Cancel') + '</button>'
          : '<button class="hlr-b g" data-m="no">' + (noLabel || 'OK') + '</button>') +
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
    function baseZoom() { return Math.min(H / 780, W / 520); }
    function toggleFS() {
      try {
        var fe = document.fullscreenElement || document.webkitFullscreenElement;
        if (fe) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
        else { var rq = root.requestFullscreen || root.webkitRequestFullscreen; if (rq) rq.call(root); }
      } catch (e) { }
    }
    var ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); }); ro.observe(root); }

    /* ---------- level control ---------- */
    function resetLevel() {
      L.nodes.forEach(function (n) { n.broken = false; n.timer = n.life; });
      L.rings.forEach(function (r) { r.used = false; });
      L.coins.forEach(function (c) { c.taken = false; });
      L.pads.forEach(function (p) { p.anim = 0; });
      P = { x: L.sx, y: L.sy, vx: 0, vy: 0, att: null, L: 0, started: false, alive: true, won: false, spin: 0, curl: 0, held: false, want: false, ropeT: 1, ang: 0 };
      lvTime = 0; runTime = 0; swings = 0; combo = 0; comboT = 0; maxCombo = 0; runCoins = 0; deadT = 0; winT = 0; slowT = 0; hitstop = 0;
      trail.length = 0; acc = 0;
      cam.x = P.x + 250; cam.y = 330; cam.z = baseZoom();
    }
    function playLevel(n) {
      n = clamp(n | 0, 1, Math.min(MAX_LEVEL, S.maxLevel));
      curLevel = n; L = genLevel(n); derive();
      mode = 'play'; paused = false; levelDeaths = 0;
      hideScreen(); resetLevel(); bannerT = 2.4;
      ensureAudio(); startAmbient(L.biome);
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); root.focus({ preventScroll: true }); } catch (e) { }
      updateHud();
    }
    function toMenu(screen) {
      mode = 'menu'; paused = false; stopAmbient();
      if (P) P.held = false;
      ML = genLevel(S ? Math.min(S.maxLevel, MAX_LEVEL) : 1);
      cam.y = 330;
      show(screen || 'hub');
      updateHud();
    }
    function updateHud() {
      var playing = mode === 'play';
      btnRestart.style.display = playing ? '' : 'none';
      btnMenu.style.display = (playing || (S && curScreen !== 'hub' && curScreen !== 'slots' && curScreen !== 'title')) ? '' : 'none';
    }

    /* ---------- physics ---------- */
    function nodeUpdate(t) {
      var i, n;
      for (i = 0; i < L.nodes.length; i++) {
        n = L.nodes[i];
        if (n.t === 'm') { if (n.ax === 0) n.x = n.bx + Math.sin(t * n.spd + n.ph) * n.amp; else n.y = n.by + Math.sin(t * n.spd + n.ph) * n.amp; }
        else if (n.t === 'o') { n.x = n.bx + Math.cos(t * n.spd + n.ph) * n.rad; n.y = n.by + Math.sin(t * n.spd + n.ph) * n.rad; }
      }
      for (i = 0; i < L.spikes.length; i++) {
        var s = L.spikes[i];
        if (s.amp) { if (s.ax) s.y = s.by + Math.sin(t * s.spd + s.ph) * s.amp; else s.x = s.bx + Math.sin(t * s.spd + s.ph) * s.amp; }
      }
    }
    function findTarget() {
      var best = null, bs = 1e9, R = D.range;
      for (var i = 0; i < L.nodes.length; i++) {
        var n = L.nodes[i]; if (n.broken) continue;
        var dx = n.x - P.x, dy = n.y - P.y;
        if (Math.abs(dx) > R) continue;
        var d = Math.hypot(dx, dy); if (d > R) continue;
        var s = d + (dx < -40 ? 230 : 0) + (dy > 40 ? 140 : 0);
        if (s < bs) { bs = s; best = n; }
      }
      return best;
    }
    function tryAttach() {
      var n = findTarget(); if (!n) return false;
      P.att = n; P.L = Math.max(60, Math.hypot(n.x - P.x, n.y - P.y)); P.want = false; P.ropeT = 0;
      swings++; S.stats.swings++;
      SFX.grab();
      burst(n.x, n.y, 8, BIOMES[L.biome].acc, 160, 0, 0);
      return true;
    }
    function release() {
      if (!P.att) return;
      P.att = null;
      P.vx *= 1.04; P.vy *= 1.04; P.vy -= 40;
      var sp = Math.hypot(P.vx, P.vy);
      if (sp > 950) addCombo();
      SFX.whoosh(sp);
    }
    function addCombo() { combo++; comboT = 2.6; if (combo > maxCombo) maxCombo = combo; }
    function breakNode(n) {
      n.broken = true;
      if (P.att === n) { P.att = null; }
      SFX.brk(); shake = Math.max(shake, 6);
      burst(n.x, n.y, 18, '#f87171', 320, 0, 500);
    }
    function die() {
      if (!P.alive || P.won) return;
      P.alive = false; P.att = null; deadT = 0.75; levelDeaths++;
      S.stats.deaths++;
      SFX.die(); shake = 16; hitstop = 0.08;
      burst(P.x, P.y, 34, function (i) { return i % 2 ? colorOf((CHMAP[S.sel] || CHARS[0]).c, lvTime, i * 20) : '#ef4444'; }, 520, 0, 900);
    }
    function win() {
      P.won = true; slowT = 1.1; winT = 1.6;
      SFX.win(); shake = 8;
      for (var i = 0; i < 160; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 300 + Math.random() * 900;
        emit(P.x, P.y, Math.cos(a) * s, Math.sin(a) * s, 1.2 + Math.random() * 1.4, 3 + Math.random() * 4, 'hsl(' + Math.floor(Math.random() * 360) + ',90%,60%)', 1, 700);
      }
      finishLevel();
    }
    function step(dt) {
      lvTime += dt;
      nodeUpdate(lvTime);
      L.pads.forEach(function (p) { if (p.anim > 0) p.anim = Math.max(0, p.anim - dt * 4); });
      if (!P.alive) return;
      if (!P.started) { P.y = L.sy + Math.sin(lvTime * 3) * 6; return; }
      if (!P.won) runTime += dt;
      if (P.held && P.want && !P.att) tryAttach();
      P.vy += GRAV * dt;
      var i;
      for (i = 0; i < L.winds.length; i++) {
        var w = L.winds[i];
        if (P.x > w.x && P.x < w.x + w.w && P.y > w.y && P.y < w.y + w.h) { P.vx += w.fx * dt; P.vy += w.fy * dt; if (Math.random() < 0.3) emit(P.x + (Math.random() - 0.5) * 20, P.y + 14, 0, 300, 0.3, 2, 'rgba(255,255,255,.7)', 0, -200); }
      }
      if (P.att) {
        var a = P.att;
        var dx = P.x - a.x, dy = P.y - a.y, d = Math.hypot(dx, dy) || 1;
        var tx = -dy / d, ty = dx / d, vt = P.vx * tx + P.vy * ty;
        if (Math.abs(vt) > 40) { var s = (vt > 0 ? 1 : -1) * D.boost * dt; P.vx += tx * s; P.vy += ty * s; }
        if (a.t === 'f') { a.timer -= dt; if (a.timer <= 0) breakNode(a); }
        if (P.L > 300) P.L -= 110 * dt;
        P.ropeT = Math.min(1, P.ropeT + dt * 16);
      }
      var drag = P.att ? 0.99985 : 0.99965;
      P.vx *= drag; P.vy *= drag;
      P.x += P.vx * dt; P.y += P.vy * dt;
      if (P.att) {
        var a2 = P.att;
        var ex = P.x - a2.x, ey = P.y - a2.y, dd = Math.hypot(ex, ey) || 1;
        if (dd > P.L) {
          var nx = ex / dd, ny = ey / dd, tgt = P.L + (dd - P.L) * 0.12;
          P.x = a2.x + nx * tgt; P.y = a2.y + ny * tgt;
          var vr = P.vx * nx + P.vy * ny;
          if (vr > 0) { P.vx -= nx * vr; P.vy -= ny * vr; }
        }
      }
      var sp = Math.hypot(P.vx, P.vy);
      if (sp > 3200) { P.vx *= 3200 / sp; P.vy *= 3200 / sp; sp = 3200; }
      // spin / curl
      if (!P.att) { P.spin += P.vx * dt * 0.028; P.curl = Math.min(1, P.curl + dt * 6); }
      else { P.curl = Math.max(0, P.curl - dt * 9); }
      // pads
      for (i = 0; i < L.pads.length; i++) {
        var p = L.pads[i];
        if (P.x < p.minx - 30 || P.x > p.maxx + 30) continue;
        var px = p.x2 - p.x1, py = p.y2 - p.y1;
        var u = clamp(((P.x - p.x1) * px + (P.y - p.y1) * py) / (px * px + py * py), 0, 1);
        var qx = p.x1 + px * u, qy = p.y1 + py * u, ddx = P.x - qx, ddy = P.y - qy;
        if (Math.hypot(ddx, ddy) < PR + 6) {
          var vn = P.vx * p.nx + P.vy * p.ny, side = ddx * p.nx + ddy * p.ny;
          if (vn < 0 && side > -PR) {
            var nv = Math.max(-vn * D.bounceE, D.padMin);
            P.vx += p.nx * (nv - vn); P.vy += p.ny * (nv - vn);
            P.x = qx + p.nx * (PR + 7); P.y = qy + p.ny * (PR + 7);
            P.att = null; p.anim = 1;
            S.stats.bounces++; addCombo();
            SFX.bounce(); shake = Math.max(shake, 7); hitstop = 0.045;
            burst(qx, qy, 16, '#facc15', 380, 0, 700);
          }
        }
      }
      // rings
      for (i = 0; i < L.rings.length; i++) {
        var r = L.rings[i]; if (r.used) continue;
        if (Math.abs(P.x - r.x) < 46 && Math.hypot(P.x - r.x, P.y - r.y) < 46) {
          r.used = true;
          var ns = Math.max(sp, 1300) * 1.12;
          P.vx = lerp(P.vx / (sp || 1), r.dx, 0.75) * ns; P.vy = lerp(P.vy / (sp || 1), r.dy, 0.75) * ns;
          S.stats.rings++; addCombo();
          SFX.ring(); hitstop = 0.05; shake = Math.max(shake, 5);
          burst(r.x, r.y, 24, '#fde047', 450, 0, 0);
        }
      }
      // coins
      for (i = 0; i < L.coins.length; i++) {
        var c = L.coins[i]; if (c.taken) continue;
        if (Math.abs(P.x - c.x) < 28 && Math.abs(P.y - c.y) < 28) {
          c.taken = true; runCoins += Math.max(1, Math.round((2 + curLevel * 0.25) * D.coinMult));
          SFX.coin(); burst(c.x, c.y, 6, '#fde047', 160, 0, 200);
        }
      }
      if (!P.won) {
        // spikes
        for (i = 0; i < L.spikes.length; i++) {
          var k = L.spikes[i];
          if (Math.abs(P.x - k.x) < k.r + 14 && Math.hypot(P.x - k.x, P.y - k.y) < k.r + PR - 3) { die(); return; }
        }
        if (P.y > FLOOR - PR) { die(); return; }
        if (P.x >= L.finishX) win();
      }
      // trail
      if (++trailTick % 2 === 0) { trail.push(P.x, P.y); if (trail.length > 56) trail.splice(0, 2); }
      // character flair particles
      var ch = CHMAP[S.sel];
      if (ch && ch.tier >= 2 && sp > 500 && Math.random() < 0.15 + ch.tier * 0.08) {
        emit(P.x + (Math.random() - 0.5) * 10, P.y + (Math.random() - 0.5) * 10, -P.vx * 0.08, -P.vy * 0.08, 0.5, 2 + ch.tier * 0.4, colorOf(ch.tr === 'disco' ? 'rainbow' : ch.tr, lvTime, Math.random() * 200), 0, 0);
      }
    }

    /* ---------- rewards ---------- */
    function finishLevel() {
      var n = curLevel, t = runTime;
      var starT = t <= L.parTime, starS = swings <= L.parSwings;
      var stars = 1 + (starT ? 1 : 0) + (starS ? 1 : 0);
      var speed = t <= L.parTime * 0.72;
      var old = S.medals[n] | 0, oldStars = old & 3;
      var newStars = Math.max(oldStars, stars);
      S.medals[n] = newStars | ((old & 4) || (speed ? 4 : 0));
      var gained = Math.max(0, stars - oldStars);
      S.stats.stars += gained;
      var first = n >= S.maxLevel && !(old & 3);
      if (n >= S.maxLevel) { if (n < MAX_LEVEL) S.maxLevel = n + 1; }
      S.bestLevel = Math.max(S.bestLevel, S.maxLevel);
      S.stats.topClear = Math.max(S.stats.topClear, n);
      var coins = Math.round((15 + n * 2.2) * (1 + stars * 0.25) * (1 + maxCombo * 0.04) * D.coinMult * (first ? 2 : 1) * (L.boss ? 5 : L.challenge ? 2 : 1)) + runCoins;
      var gems = 0;
      if (L.boss) gems = first ? 25 : 4;
      else if (L.challenge) gems = first ? 3 + L.biome : 1;
      else if (Math.random() < D.gemChance) gems = 1;
      if (speed && !(old & 4)) gems += 1;
      S.coins += coins; S.gems += gems;
      S.stats.clears++; S.stats.coinsEarned += coins;
      if (levelDeaths === 0) S.stats.ndclears++;
      if (L.boss || L.challenge) S.stats.challenges++;
      var score = Math.round((100 + n * 5) * (1 + stars * 0.5) * (1 + maxCombo * 0.1) * Math.max(0.5, L.parTime / Math.max(0.5, t)));
      var newHi = score > hiScore; if (newHi) hiScore = score;
      checkSecrets();
      saveNow();
      lastResult = { n: n, t: t, stars: stars, speed: speed, coins: coins, gems: gems, score: score, newHi: newHi, first: first, swings: swings, par: L.parTime, parS: L.parSwings, combo: maxCombo, deaths: levelDeaths, boss: L.boss, challenge: L.challenge };
    }

    /* ---------- input ---------- */
    function pressDown() {
      ensureAudio();
      if (mode !== 'play' || paused || !P) return;
      if (amb === null && !muted) startAmbient(L.biome);
      if (!P.alive || P.won) return;
      if (!P.started) { P.started = true; P.vx = 420; P.vy = -160; P.curl = 0.6; }
      P.held = true; P.want = true;
      if (!P.att) tryAttach();
    }
    function pressUp() {
      if (!P) return;
      P.held = false; P.want = false;
      if (mode === 'play' && P.att) release();
    }
    function onPointerDown(e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault();
      try { root.focus({ preventScroll: true }); } catch (er) { }
      pressDown();
    }
    function onPointerUp() { pressUp(); }
    function onKeyDown(e) {
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') {
        if (mode === 'play' || document.activeElement === root || root.contains(document.activeElement)) e.preventDefault();
        if (!e.repeat) pressDown();
        return;
      }
      if (e.repeat) return;
      if (modal.style.display === 'flex') { if (k === 'Escape' || k === 'Enter') { e.preventDefault(); var cb = k === 'Enter' ? modalCb : null; hideModal(); if (cb) cb(); } return; }
      if (k === 'r' || k === 'R') {
        if (mode === 'play') { resetLevel(); paused = false; hideScreen(); }
        else if (curScreen === 'results' && lastResult) playLevel(lastResult.n);
      } else if (k === 'Escape') {
        if (mode === 'play') togglePause();
        else if (S && curScreen !== 'hub' && curScreen !== 'slots' && curScreen !== 'title') show('hub');
      } else if (k === 'm' || k === 'M') setMute(!muted);
      else if (k === 'f' || k === 'F') toggleFS();
      else if (k === 'Enter') {
        if (curScreen === 'results' && lastResult) { e.preventDefault(); if (lastResult.n < S.maxLevel) playLevel(lastResult.n + 1); else playLevel(lastResult.n); }
        else if (curScreen === 'title') show('slots');
      }
    }
    function onKeyUp(e) {
      if (e.key === ' ' || e.key === 'Spacebar') { if (mode === 'play') e.preventDefault(); pressUp(); }
    }
    function onBlur() { pressUp(); }
    function onBeforeUnload() { saveNow(); }
    function onFsChange() { resize(); setTimeout(resize, 120); }
    function togglePause() {
      if (mode !== 'play') return;
      paused = !paused;
      if (paused) { pressUp(); show('pause'); } else hideScreen();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    hud.addEventListener('click', function (e) {
      var b = e.target.closest('[data-h]'); if (!b) return;
      ensureAudio(); SFX.click();
      var h = b.getAttribute('data-h');
      if (h === 'fs') toggleFS();
      else if (h === 'mute') setMute(!muted);
      else if (h === 'restart') { if (mode === 'play') { resetLevel(); paused = false; hideScreen(); } }
      else if (h === 'menu') { if (mode === 'play') togglePause(); else if (S) show('hub'); }
      b.blur();
    });

    /* ---------- screens ---------- */
    function hideScreen() { scr.style.display = 'none'; scr.innerHTML = ''; curScreen = ''; updateHud(); }
    function topBar() {
      return '<div class="hlr-top"><div class="hlr-row">' +
        '<span class="hlr-pill">\ud83e\ude99 ' + fmt(S.coins) + '</span><span class="hlr-pill">\ud83d\udc8e ' + fmt(S.gems) + '</span><span class="hlr-pill">\u2726 ' + fmt(S.shards) + '</span>' +
        '</div><div class="hlr-row"><span class="hlr-pill">\u23f1 ' + fmtTime(S.playtime) + '</span><button class="hlr-b s" data-a="hub">\u2b05 Hub</button></div></div>';
    }
    function show(name) {
      curScreen = name; scr.style.display = 'block';
      var html = '';
      try { html = SCREENS[name](); } catch (err) { html = '<div class="hlr-card">Error: ' + esc(err.message) + '</div>'; }
      scr.innerHTML = '<div class="hlr-pn">' + html + '</div>';
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
      if (cv) { cv.width = 160; cv.height = 160; drawCharPreview(cv, CHMAP[S.sel], false, wallT); }
    }
    function medalStr(m) { var s = m & 3; return '\u2605\u2605\u2605'.slice(0, s) + '\u2606\u2606\u2606'.slice(0, 3 - s) + (m & 4 ? '\u26a1' : ''); }

    var SCREENS = {
      title: function () {
        return '<div class="hlr-h1">HOOKLINE RUSH</div><div class="hlr-sub">Swing. Launch. Fly. 2,000 levels across 20 worlds.</div>' +
          '<div class="hlr-card" style="max-width:620px;margin:0 auto"><div class="hlr-h2">\ud83c\udfae How to Play</div>' +
          '<div style="line-height:2">' +
          '<div><span class="hlr-k">HOLD Space</span><span class="hlr-k">Mouse</span><span class="hlr-k">Touch</span> Grapple to the nearest anchor &amp; swing</div>' +
          '<div><span class="hlr-k">RELEASE</span> Let go to launch with your momentum</div>' +
          '<div><span class="hlr-k">R</span> Restart level &nbsp; <span class="hlr-k">Esc</span> Pause &nbsp; <span class="hlr-k">M</span> Mute &nbsp; <span class="hlr-k">F</span> Fullscreen</div>' +
          '<div><span class="hlr-k">Enter</span> Next level on the results screen</div></div>' +
          '<div style="margin-top:10px;font-size:14px;opacity:.85;line-height:1.55">Reach the checkered finish. Avoid spikes and the hazard floor. Bounce pads \ud83d\udfe8 launch you, golden rings \u2b55 boost you, red anchors crack after a moment, and wind columns lift you. Beat the par time and par swings for \u2605\u2605\u2605, and go extra fast for the \u26a1 speed medal. Spend coins on upgrades, gems on capsules, and Rebirth after level 100 for Ascension Shards.</div>' +
          '<div style="text-align:center;margin-top:16px"><button class="hlr-b big g" data-a="toslots">\u25b6 START</button></div></div>' +
          '<div class="hlr-sub" style="margin-top:12px">\ud83c\udfc6 Best score: ' + fmt(hiScore) + ' \u00b7 \u23f1 Total playtime: ' + fmtTime(gPT) + '</div>';
      },
      slots: function () {
        var h = '<div class="hlr-h1" style="font-size:34px">Save Slots</div><div class="hlr-sub">Pick a slot. Progress auto-saves on every clear, purchase, and exit.</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        for (var i = 0; i < 3; i++) {
          var s = slots[i];
          h += '<div class="hlr-card"><div class="hlr-h2">Slot ' + (i + 1) + '</div>';
          if (s) {
            var owned = Object.keys(s.chars).length;
            h += '<div style="line-height:1.7;font-size:14px">\ud83d\uddfa Level <b>' + s.maxLevel + '</b> / ' + MAX_LEVEL + ' \u00b7 ' + BIOMES[Math.min(19, Math.floor((s.maxLevel - 1) / 100))].name +
              '<br>\ud83e\ude99 ' + fmt(s.coins) + ' \u00b7 \ud83d\udc8e ' + fmt(s.gems) + ' \u00b7 \u2726 ' + fmt(s.shards) +
              '<br>\ud83e\uddcd ' + owned + '/' + CHARS.length + ' characters \u00b7 Rebirths: ' + s.prestige +
              '<br>\u23f1 ' + fmtTime(s.playtime) + '</div>' +
              '<div class="hlr-row" style="margin-top:10px"><button class="hlr-b g" data-a="slotplay" data-v="' + i + '">\u25b6 Play</button>' +
              '<button class="hlr-b y" data-a="slotreset" data-v="' + i + '">Reset</button><button class="hlr-b r" data-a="slotdel" data-v="' + i + '">Delete</button></div>';
          } else {
            h += '<div style="opacity:.7;margin:18px 0">Empty \u2014 New Save</div><div class="hlr-row"><button class="hlr-b g" data-a="slotplay" data-v="' + i + '">\u271a New Save</button></div>';
          }
          h += '<div class="hlr-row" style="margin-top:8px"><button class="hlr-b c" data-a="slotexp" data-v="' + i + '"' + (s ? '' : ' disabled') + '>\u2b07 Export Save</button><button class="hlr-b s" data-a="slotimp" data-v="' + i + '">\u2b06 Import Save</button></div></div>';
        }
        h += '</div><div style="text-align:center;margin-top:14px"><button class="hlr-b s" data-a="totitle">\u2754 How to Play</button></div>' +
          '<div class="hlr-sub" style="margin-top:10px">\ud83c\udfc6 Best score: ' + fmt(hiScore) + ' \u00b7 \u23f1 Total playtime: ' + fmtTime(gPT) + '</div>';
        return h;
      },
      hub: function () {
        var ml = Math.min(S.maxLevel, MAX_LEVEL), b = BIOMES[Math.floor((ml - 1) / 100)], ch = CHMAP[S.sel], st = S.chars[S.sel].s;
        var qr = questReady();
        return '<div class="hlr-top"><div class="hlr-row"><span class="hlr-pill">\ud83e\ude99 ' + fmt(S.coins) + '</span><span class="hlr-pill">\ud83d\udc8e ' + fmt(S.gems) + '</span><span class="hlr-pill">\u2726 ' + fmt(S.shards) + '</span></div>' +
          '<div class="hlr-row"><span class="hlr-pill">Slot ' + (slotIdx + 1) + '</span><span class="hlr-pill">\u23f1 ' + fmtTime(S.playtime) + '</span></div></div>' +
          '<div class="hlr-h1" style="font-size:clamp(26px,5vw,44px)">HOOKLINE RUSH</div>' +
          '<div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:10px">' +
          '<div class="hlr-card" style="text-align:center"><div style="opacity:.8">World ' + (Math.floor((ml - 1) / 100) + 1) + ' \u00b7 ' + b.name + '</div>' +
          '<div style="font-size:40px;font-weight:900;margin:4px 0">Level ' + ml + '</div>' +
          '<div class="hlr-bar" style="margin:6px 0 12px"><i style="width:' + (ml / MAX_LEVEL * 100).toFixed(2) + '%"></i></div>' +
          '<button class="hlr-b big g" data-a="play" style="width:100%">\u25b6 PLAY LEVEL ' + ml + '</button>' +
          '<div style="font-size:13px;opacity:.8;margin-top:8px">' + (ml % 100 === 0 ? '\ud83d\udd25 BOSS GAUNTLET' : ml % 10 === 0 ? '\u2694 CHALLENGE STAGE' : 'Next challenge: level ' + (Math.ceil(ml / 10) * 10)) + '</div></div>' +
          '<div class="hlr-card" style="display:flex;gap:12px;align-items:center"><canvas data-hub style="width:96px;height:96px;flex:none"></canvas><div>' +
          '<div style="font-weight:900;font-size:18px;color:' + TIERS[ch.tier].c + '">' + esc(ch.name) + '</div><div style="font-size:13px;opacity:.85">' + TIERS[ch.tier].n + ' \u00b7 ' + '\u2605'.repeat(st) + '</div>' +
          '<div style="font-size:13px;opacity:.85">Perk: ' + perkText(ch, st) + '</div>' +
          '<div style="font-size:12px;opacity:.7;margin-top:4px">Range ' + Math.round(D.range) + ' \u00b7 Coins \u00d7' + D.coinMult.toFixed(2) + '<br>Idle: ' + fmt(idleRate()) + '/min \u00b7 Best score ' + fmt(hiScore) + '</div></div></div></div>' +
          '<div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:12px">' +
          '<button class="hlr-b c" data-a="levels">\ud83d\uddfa Level Select</button>' +
          '<button class="hlr-b" data-a="chars">\ud83e\uddcd Characters</button>' +
          '<button class="hlr-b y" data-a="caps">\ud83c\udf81 Capsules</button>' +
          '<button class="hlr-b g" data-a="upg">\u2b06 Upgrades</button>' +
          '<button class="hlr-b" data-a="quests">\ud83d\udcdc Quests' + (qr ? ' (' + qr + ')' : '') + '</button>' +
          '<button class="hlr-b r" data-a="prestige">\u2726 Rebirth</button>' +
          '<button class="hlr-b s" data-a="toslots">\ud83d\udcbe Save &amp; Slots</button>' +
          '<button class="hlr-b s" data-a="totitle">\u2754 How to Play</button></div>' +
          '<div class="hlr-sub" style="margin-top:12px;font-size:13px">Rebirths: ' + S.prestige + ' \u00b7 Highest level ever: ' + S.bestLevel + ' \u00b7 Total stars: ' + S.stats.stars + ' \u00b7 Total playtime: ' + fmtTime(gPT) + '</div>';
      },
      levels: function () {
        var h = topBar() + '<div class="hlr-h2">\ud83d\uddfa Level Select \u2014 World ' + (levelWorld + 1) + ': ' + BIOMES[levelWorld].name + '</div><div class="hlr-row" style="margin-bottom:12px">';
        for (var w = 0; w < 20; w++) {
          var lk = w * 100 + 1 > S.maxLevel;
          h += '<button class="hlr-b hlr-tab ' + (w === levelWorld ? 'c' : 's') + '" data-a="world" data-v="' + w + '"' + (lk ? ' disabled' : '') + ' title="' + BIOMES[w].name + '">' + (lk ? '\ud83d\udd12' : '') + (w + 1) + '</button>';
        }
        h += '</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px">';
        for (var n = levelWorld * 100 + 1; n <= levelWorld * 100 + 100; n++) {
          var locked = n > S.maxLevel, m = S.medals[n] | 0;
          var cls = 'hlr-lv' + (n % 100 === 0 ? ' bs' : n % 10 === 0 ? ' ch' : '') + (locked ? ' lk' : '') + (n === S.maxLevel ? ' cur' : '');
          h += '<button class="' + cls + '" data-a="lvl" data-v="' + n + '"' + (locked ? ' disabled' : '') + '>' + (locked ? '\ud83d\udd12' : n) + '<small>' + (locked ? '' : (m ? medalStr(m) : (n % 100 === 0 ? 'BOSS' : n % 10 === 0 ? 'CHAL' : ''))) + '</small></button>';
        }
        return h + '</div><div class="hlr-sub" style="margin-top:10px;font-size:13px">Orange = Challenge stage (gems) \u00b7 Red = Boss Gauntlet \u00b7 \u26a1 = Speed medal</div>';
      },
      chars: function () {
        var owned = Object.keys(S.chars).length;
        var h = topBar() + '<div class="hlr-h2">\ud83e\uddcd Characters (' + owned + '/' + CHARS.length + ')</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">Equipped character grants its perk. Every star you own adds +0.5% coins (collection bonus: +' + (totalStars() * 0.5).toFixed(1) + '%). Duplicates give fragments to level characters up to 5\u2605.</div>' +
          '<div class="hlr-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">';
        CHARS.forEach(function (c) {
          var o = S.chars[c.id], tc = TIERS[c.tier].c;
          h += '<div class="hlr-card hlr-ch" style="border-color:' + (S.sel === c.id ? '#22d3ee' : tc + '66') + '"><canvas data-ch="' + c.id + '"></canvas>' +
            '<div style="font-weight:900;font-size:14px;color:' + tc + '">' + (o || c.tier < 5 ? esc(c.name) : '???') + '</div><div style="font-size:11px;opacity:.8">' + TIERS[c.tier].n + '</div>';
          if (o) {
            var need = o.s < 5 ? STAR_COST[o.s] : 0;
            h += '<div style="font-size:13px;color:#fde047">' + '\u2605'.repeat(o.s) + '<span style="opacity:.3">' + '\u2605'.repeat(5 - o.s) + '</span></div>' +
              '<div style="font-size:11px;opacity:.85">' + perkText(c, o.s) + '</div>' +
              (o.s < 5 ? '<div style="font-size:11px;opacity:.7">Fragments ' + o.f + '/' + need + '</div>' : '<div style="font-size:11px;color:#4ade80">MAX</div>') +
              '<div class="hlr-row" style="justify-content:center">' + (S.sel === c.id ? '<button class="hlr-b c" disabled>Equipped</button>' : '<button class="hlr-b c" data-a="equip" data-v="' + c.id + '">Equip</button>') +
              (o.s < 5 ? '<button class="hlr-b y" data-a="star" data-v="' + c.id + '"' + (o.f >= need ? '' : ' disabled') + '>\u2605+</button>' : '') + '</div>';
          } else {
            h += '<div style="font-size:11px;opacity:.7">' + (c.tier === 5 ? '\ud83d\udd12 ' + SECRET_HINT[c.id] : '\ud83d\udd12 Find in capsules') + '</div>';
          }
          h += '</div>';
        });
        return h + '</div>';
      },
      caps: function () {
        var h = topBar() + '<div class="hlr-h2">\ud83c\udf81 Loot Capsules</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">Duplicates become Character Fragments. Mythic pity: guaranteed Mythic after 60 Super/Mythic pulls without one (' + S.pity + '/60).</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">';
        CAPS.forEach(function (c, i) {
          var c1 = capCost(c, 1), c10 = capCost(c, 10), have = c.cur === 'coins' ? S.coins : S.gems, sym = c.cur === 'coins' ? '\ud83e\ude99' : '\ud83d\udc8e';
          h += '<div class="hlr-card" style="text-align:center;border-color:' + c.col + '"><div style="font-size:54px;filter:drop-shadow(0 0 12px ' + c.col + ')">' + ['\ud83d\udd35', '\ud83d\udfe3', '\ud83d\udd34'][i] + '</div>' +
            '<div style="font-weight:900;font-size:18px;color:' + c.col + '">' + c.n + '</div><div style="font-size:12px;opacity:.85;margin:6px 0;line-height:1.5">' +
            c.odds.map(function (o, t) { return o ? '<span style="color:' + TIERS[t].c + '">' + TIERS[t].n + ' ' + o + '%</span>' : ''; }).filter(Boolean).join(' \u00b7 ') + '</div>' +
            '<div class="hlr-row" style="justify-content:center"><button class="hlr-b g" data-a="pull" data-v="' + i + ':1"' + (have >= c1 ? '' : ' disabled') + '>Open \u00d71<br>' + sym + ' ' + fmt(c1) + '</button>' +
            '<button class="hlr-b y" data-a="pull" data-v="' + i + ':10"' + (have >= c10 ? '' : ' disabled') + '>Open \u00d710<br>' + sym + ' ' + fmt(c10) + '</button></div></div>';
        });
        return h + '</div>';
      },
      upg: function () {
        var h = topBar() + '<div class="hlr-h2">\u2b06 Upgrades</div><div style="font-size:13px;opacity:.8;margin-bottom:10px">Costs scale exponentially. Upgrades reset on Rebirth (shard perks do not).</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        UPG.forEach(function (u) {
          var lv = S.upg[u.k], mx = lv >= u.max, cost = mx ? 0 : upgCost(u);
          var cur = u.k === 'range' ? Math.round(D.range) + ' px' : u.k === 'boost' ? '+' + (lv * 2) + '%' : u.k === 'bounce' ? '+' + (lv * 1.5).toFixed(1) + '%' : u.k === 'coin' ? '\u00d7' + (1 + lv * 0.1).toFixed(1) : fmt(idleRate()) + '/min';
          h += '<div class="hlr-card"><div style="display:flex;justify-content:space-between"><b>' + u.n + '</b><span class="hlr-pill">Lv ' + lv + '/' + u.max + '</span></div>' +
            '<div style="font-size:12px;opacity:.8;margin:6px 0">' + u.d + '</div><div style="font-size:13px;margin-bottom:6px">Current: <b>' + cur + '</b></div>' +
            '<div class="hlr-bar" style="margin-bottom:8px"><i style="width:' + (lv / u.max * 100) + '%"></i></div>' +
            '<div class="hlr-row">' + (mx ? '<button class="hlr-b" disabled>MAXED</button>' : '<button class="hlr-b g" data-a="buy" data-v="' + u.k + '"' + (S.coins >= cost ? '' : ' disabled') + '>Buy \ud83e\ude99 ' + fmt(cost) + '</button><button class="hlr-b s" data-a="buymax" data-v="' + u.k + '"' + (S.coins >= cost ? '' : ' disabled') + '>Max</button>') + '</div></div>';
        });
        return h + '</div>';
      },
      quests: function () {
        ensureDaily();
        var h = topBar() + '<div class="hlr-h2">\ud83d\udcdc Daily Quests <span style="font-size:13px;opacity:.7">(reset each day)</span></div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        var dc = Math.round(400 * (1 + S.bestLevel / 15));
        S.daily.list.forEach(function (q, i) {
          var pr = Math.min(q.g, S.stats[q.k] - q.s), done = pr >= q.g;
          h += '<div class="hlr-card"><b>' + QTYPES[q.k].n.replace('{g}', fmt(q.g)) + '</b><div class="hlr-bar" style="margin:8px 0"><i style="width:' + (pr / q.g * 100) + '%"></i></div>' +
            '<div class="hlr-row" style="justify-content:space-between"><span style="font-size:13px">' + fmt(pr) + '/' + fmt(q.g) + ' \u00b7 \ud83e\ude99' + fmt(dc) + ' \ud83d\udc8e4</span>' +
            (q.c ? '<button class="hlr-b" disabled>Claimed</button>' : '<button class="hlr-b g" data-a="claimd" data-v="' + i + '"' + (done ? '' : ' disabled') + '>Claim</button>') + '</div></div>';
        });
        h += '</div><div class="hlr-h2" style="margin-top:16px">\ud83d\udd01 Repeatable Grind Quests</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">';
        Object.keys(QTYPES).forEach(function (k) {
          var r = S.rep[k], g = repGoal(k), pr = Math.min(g, S.stats[k] - r.base), done = pr >= g;
          var rc = Math.round(250 * (1 + S.bestLevel / 20) * (1 + r.t * 0.5)), rg = 2 + r.t;
          h += '<div class="hlr-card"><div style="display:flex;justify-content:space-between"><b>' + QTYPES[k].n.replace('{g}', fmt(g)) + '</b><span class="hlr-pill">Tier ' + (r.t + 1) + '</span></div><div class="hlr-bar" style="margin:8px 0"><i style="width:' + (pr / g * 100) + '%"></i></div>' +
            '<div class="hlr-row" style="justify-content:space-between"><span style="font-size:13px">' + fmt(pr) + '/' + fmt(g) + ' \u00b7 \ud83e\ude99' + fmt(rc) + ' \ud83d\udc8e' + rg + '</span><button class="hlr-b g" data-a="claimr" data-v="' + k + '"' + (done ? '' : ' disabled') + '>Claim</button></div></div>';
        });
        return h + '</div><div class="hlr-sub" style="margin-top:10px;font-size:13px">Quests claimed: ' + S.stats.quests + '</div>';
      },
      prestige: function () {
        var can = S.maxLevel > 100, gain = can ? Math.floor(5 * Math.pow((S.maxLevel - 1) / 100, 1.6)) : 0;
        var h = topBar() + '<div class="hlr-h2">\u2726 Rebirth / Ascension</div><div class="hlr-card" style="margin-bottom:12px">' +
          '<div style="line-height:1.6;font-size:14px">Rebirth resets your <b>level progress, coins and coin upgrades</b>. You keep characters, gems, medals, quests and shard perks.<br>' +
          'Each Rebirth grants a permanent <b>+50% coin multiplier</b>, and every shard ever earned adds +2% more.<br>Current global bonus: <b>\u00d7' + (1 + S.prestige * 0.5 + S.shardsTotal * 0.02).toFixed(2) + '</b> \u00b7 Rebirths: ' + S.prestige + '</div>' +
          '<div style="margin-top:10px;font-size:16px">' + (can ? 'Rebirth now for <b style="color:#22d3ee">\u2726 ' + gain + ' Ascension Shards</b>' : 'Clear level 100 to unlock Rebirth (current: level ' + S.maxLevel + ')') + '</div>' +
          '<div style="margin-top:10px"><button class="hlr-b r big" data-a="doprestige"' + (can ? '' : ' disabled') + '>\u2726 REBIRTH</button></div></div>' +
          '<div class="hlr-h2">Shard Perks</div><div class="hlr-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">';
        PERKS.forEach(function (p) {
          var lv = S.perks[p.k], mx = lv >= p.max, c = p.c(lv);
          h += '<div class="hlr-card"><div style="display:flex;justify-content:space-between"><b>' + p.n + '</b><span class="hlr-pill">' + lv + '/' + p.max + '</span></div><div style="font-size:12px;opacity:.8;margin:6px 0">' + p.d + '</div>' +
            (mx ? '<button class="hlr-b" disabled>MAXED</button>' : '<button class="hlr-b c" data-a="perk" data-v="' + p.k + '"' + (S.shards >= c ? '' : ' disabled') + '>Buy \u2726 ' + c + '</button>') + '</div>';
        });
        return h + '</div>';
      },
      pause: function () {
        return '<div class="hlr-card" style="max-width:420px;margin:40px auto;text-align:center"><div class="hlr-h2">\u23f8 Paused</div><div style="opacity:.8;margin-bottom:12px">Level ' + curLevel + ' \u00b7 ' + BIOMES[L.biome].name + '</div>' +
          '<div class="hlr-grid"><button class="hlr-b g big" data-a="resume">\u25b6 Resume</button><button class="hlr-b y" data-a="restart">\u21bb Restart Level</button><button class="hlr-b s" data-a="levels2">\ud83d\uddfa Level Select</button><button class="hlr-b s" data-a="tohub">\ud83c\udfe0 Exit to Hub</button></div>' +
          '<div style="font-size:13px;opacity:.7;margin-top:10px">\u23f1 Playtime ' + fmtTime(S.playtime) + '</div></div>';
      },
      results: function () {
        var r = lastResult; if (!r) return '';
        var next = r.n < S.maxLevel;
        return '<div class="hlr-card" style="max-width:480px;margin:20px auto;text-align:center">' +
          '<div style="font-size:14px;opacity:.8">' + (r.boss ? '\ud83d\udd25 BOSS GAUNTLET' : r.challenge ? '\u2694 CHALLENGE STAGE' : 'LEVEL COMPLETE') + '</div>' +
          '<div class="hlr-h1" style="font-size:40px">Level ' + r.n + '</div>' +
          '<div style="font-size:44px;color:#fde047;letter-spacing:4px;animation:hlrpop .5s both">' + '\u2605'.repeat(r.stars) + '<span style="opacity:.25">' + '\u2605'.repeat(3 - r.stars) + '</span></div>' +
          (r.speed ? '<div style="color:#22d3ee;font-weight:900">\u26a1 SPEED MEDAL \u26a1</div>' : '') +
          '<div style="line-height:1.8;margin:10px 0;font-size:15px">\u23f1 ' + r.t.toFixed(2) + 's <span style="opacity:.6">(par ' + r.par + 's)</span> \u00b7 \ud83e\ude9d ' + r.swings + ' swings <span style="opacity:.6">(par ' + r.parS + ')</span><br>' +
          '\ud83d\udd25 Max combo \u00d7' + r.combo + ' \u00b7 \ud83d\udc80 Deaths ' + r.deaths + '<br>' +
          '<b style="color:#fde047">+\ud83e\ude99 ' + fmt(r.coins) + '</b>' + (r.gems ? ' \u00b7 <b style="color:#67e8f9">+\ud83d\udc8e ' + r.gems + '</b>' : '') + (r.first ? ' <span style="color:#4ade80">(first clear \u00d72)</span>' : '') +
          '<br>Score ' + fmt(r.score) + (r.newHi ? ' <b style="color:#fb7185">NEW BEST!</b>' : ' \u00b7 Best ' + fmt(hiScore)) + '</div>' +
          '<div class="hlr-row" style="justify-content:center">' + (next ? '<button class="hlr-b g big" data-a="next">Next \u25b6</button>' : '') +
          '<button class="hlr-b y" data-a="replay">\u21bb Replay</button><button class="hlr-b s" data-a="tohub">\ud83c\udfe0 Hub</button></div>' +
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
      if (earned > 0 && mins > 1) { S.coins += earned; saveNow(); show('hub'); showModal('<div class="hlr-h2">\ud83d\udca4 Offline Earnings</div><div>Your Idle Generator earned <b style="color:#fde047">\ud83e\ude99 ' + fmt(earned) + '</b> while you were away (' + fmtTime(mins * 60) + ').</div>'); }
    }
    function doPull(ci, count) {
      var c = CAPS[ci], cost = capCost(c, count);
      var have = c.cur === 'coins' ? S.coins : S.gems;
      if (have < cost) { SFX.err(); return; }
      if (c.cur === 'coins') S.coins -= cost; else S.gems -= cost;
      var results = [], best = 0;
      for (var k = 0; k < count; k++) {
        var tier, r = Math.random() * 100, a = 0;
        tier = 0;
        for (var t = 0; t < 5; t++) { a += c.odds[t]; if (r < a) { tier = t; break; } }
        if (c.odds[4] > 0) {
          if (tier === 4) S.pity = 0; else { S.pity++; if (S.pity >= 60) { tier = 4; S.pity = 0; } }
        }
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
      var html = '<div class="hlr-h2">' + c.n + ' \u00d7' + count + '</div><div>';
      results.forEach(function (r, i) {
        html += '<div class="hlr-pull" style="border-color:' + TIERS[r.ch.tier].c + ';animation-delay:' + (i * 0.07) + 's"><canvas data-pc="' + r.ch.id + '" width="96" height="96" style="width:60px;height:60px"></canvas>' +
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
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; if (!f || importTarget < 0) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var o = JSON.parse(rd.result);
          var data = o && o.game === GID && o.data ? o.data : (o && typeof o.maxLevel === 'number' ? o : null);
          if (!data) throw new Error('bad');
          var apply = function () {
            slots[importTarget] = normalizeSave(data);
            if (importTarget === slotIdx) { S = slots[importTarget]; derive(); }
            persistSlots(); show('slots'); toast('Save imported into Slot ' + (importTarget + 1) + ' \u2b06');
          };
          if (slots[importTarget]) showModal('<div class="hlr-h2">Overwrite Slot ' + (importTarget + 1) + '?</div><div>The current save in this slot will be replaced.</div>', apply, 'Overwrite');
          else apply();
        } catch (e) { showModal('<div class="hlr-h2">Import failed</div><div>That file is not a valid Hookline Rush save.</div>'); }
        fileIn.value = '';
      };
      rd.readAsText(f);
    });

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
          showModal('<div class="hlr-h2">Reset Slot ' + (i + 1) + '?</div><div>This wipes all progress in this slot and starts a fresh save.</div>', function () {
            slots[i] = newSave(); if (slotIdx === i) { S = slots[i]; derive(); } persistSlots(); show('slots'); toast('Slot ' + (i + 1) + ' reset');
          }, 'Reset'); break;
        case 'slotdel':
          showModal('<div class="hlr-h2">Delete Slot ' + (i + 1) + '?</div><div>This permanently deletes this save.</div>', function () {
            slots[i] = null; if (slotIdx === i) { S = null; slotIdx = -1; } persistSlots(); show('slots'); toast('Slot ' + (i + 1) + ' deleted');
          }, 'Delete'); break;
        case 'slotexp': exportSlot(i); break;
        case 'slotimp': importTarget = i; fileIn.click(); break;
        case 'play': playLevel(S.maxLevel); break;
        case 'levels': levelWorld = Math.min(19, Math.floor((Math.min(S.maxLevel, MAX_LEVEL) - 1) / 100)); show('levels'); break;
        case 'levels2': mode = 'menu'; stopAmbient(); levelWorld = Math.floor((curLevel - 1) / 100); show('levels'); break;
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
          showModal('<div class="hlr-h2">\u2726 Rebirth?</div><div>Reset levels, coins and upgrades for <b>\u2726 ' + gain + '</b> Ascension Shards and a permanent multiplier boost.</div>', function () {
            S.shards += gain; S.shardsTotal += gain; S.prestige++;
            S.coins = 0; S.upg = { range: 0, boost: 0, bounce: 0, coin: 0, idle: 0 };
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
        case 'restart': paused = false; resetLevel(); hideScreen(); break;
        case 'tohub': saveNow(); toMenu('hub'); break;
        case 'next': playLevel(lastResult.n + 1); break;
        case 'replay': playLevel(lastResult.n); break;
      }
    });

    /* ---------- rendering ---------- */
    var skyCache = { key: '', grad: null };
    function drawSky(B) {
      var key = B.name + H;
      if (skyCache.key !== key) {
        var gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, B.top); gr.addColorStop(1, B.bot);
        skyCache = { key: key, grad: gr };
      }
      ctx.fillStyle = skyCache.grad; ctx.fillRect(0, 0, W, H);
      if (B.dark) {
        ctx.fillStyle = '#fff';
        for (var i = 0; i < 90; i++) {
          var sx = ((hash2(i, 77) * W * 1.5 - cam.x * 0.03) % W + W) % W, sy = hash2(i, 91) * H * 0.75;
          ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(wallT * (0.5 + hash2(i, 5)) + i));
          ctx.fillRect(sx, sy, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
      }
    }
    function drawParallax(B) {
      var unit = H / 900;
      var layers = [[B.far, 0.12, 0.7, 1.0, 11], [B.near, 0.3, 0.86, 1.25, 23]];
      for (var li = 0; li < 2; li++) {
        var col = layers[li][0], f = layers[li][1], yb = H * layers[li][2] - clamp(cam.y - 330, -300, 300) * f * unit * 0.6, sc = layers[li][3] * unit, seed = layers[li][4] + B.hz;
        ctx.fillStyle = col;
        var tw = 170 * sc, off = cam.x * f * unit * 1.2;
        var i0 = Math.floor(off / tw) - 1, i1 = i0 + Math.ceil(W / tw) + 2, i, h, x;
        if (B.style === 'waves') {
          ctx.beginPath(); ctx.moveTo(0, H);
          for (x = 0; x <= W + 20; x += 20) ctx.lineTo(x, yb + Math.sin((x + off) * 0.012 + wallT * (li + 1) * 0.6) * 18 * sc + Math.sin((x + off) * 0.031) * 8 * sc);
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
            case 'clouds':
              ctx.ellipse(x + tw / 2, yb + 4, tw * 0.8, hh * 0.4, 0, Math.PI, 0);
              ctx.moveTo(x + tw * 0.9, H * 0.2 + h * 120 * sc);
              ctx.arc(x + tw * 0.6, H * 0.18 + h * 120 * sc, 26 * sc, 0, 7); ctx.arc(x + tw * 0.85, H * 0.18 + h * 120 * sc, 34 * sc, 0, 7);
              break;
            case 'stars':
              ctx.moveTo(x - tw * 0.2, yb + 2); ctx.lineTo(x + tw * 0.4, yb - hh * 0.6); ctx.lineTo(x + tw * 1.1, yb + 2);
              if (li === 0 && h > 0.8) { ctx.moveTo(x + tw * 0.5 + 30 * sc, H * 0.25); ctx.arc(x + tw * 0.5, H * 0.25, 30 * sc * h, 0, 7); }
              break;
          }
          ctx.fill();
          if (B.style === 'city' && li === 1) {
            ctx.fillStyle = B.acc; ctx.globalAlpha = 0.55;
            for (var wy = 0; wy < 6; wy++) for (var wx = 0; wx < 3; wx++) if (hash2(i * 31 + wy * 3 + wx, seed) > 0.55) ctx.fillRect(x + tw * (0.18 + wx * 0.22), yb - hh * 1.2 + 14 * sc + wy * 22 * sc, 7 * sc, 9 * sc);
            ctx.globalAlpha = 1; ctx.fillStyle = col;
          }
        }
      }
    }
    function drawWorld(lv, withPlayer) {
      var B = BIOMES[lv.biome], z = cam.z;
      var ox = W / 2 - cam.x * z + shx, oy = H / 2 - cam.y * z + shy;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      var x0 = cam.x - W / 2 / z - 80, x1 = cam.x + W / 2 / z + 80;
      var i, t = lvTime;
      // wind
      for (i = 0; i < lv.winds.length; i++) {
        var w = lv.winds[i]; if (w.x > x1 || w.x + w.w < x0) continue;
        ctx.fillStyle = 'rgba(186,230,253,.09)'; ctx.fillRect(w.x, w.y - 400, w.w, w.h + 400);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var k = 0; k < 16; k++) {
          var lx = w.x + hash2(k, i) * w.w, ly = w.y + w.h - (((wallT * 520) + hash2(k, i + 9) * (w.h + 400)) % (w.h + 400));
          ctx.moveTo(lx, ly); ctx.lineTo(lx + 6, ly - 46);
        }
        ctx.stroke();
      }
      // finish
      if (lv.finishX > x0 && lv.finishX - 40 < x1) {
        for (var fy = -400; fy < FLOOR; fy += 20) {
          for (var fx = 0; fx < 2; fx++) { ctx.fillStyle = ((fy / 20 + fx) & 1) ? '#111' : '#fff'; ctx.fillRect(lv.finishX + fx * 20, fy, 20, 20); }
        }
        ctx.fillStyle = '#fde047'; ctx.font = '900 34px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('FINISH', lv.finishX + 20, 60 + Math.sin(wallT * 3) * 6);
      }
      // floor hazard
      ctx.fillStyle = B.near; ctx.fillRect(x0, FLOOR, x1 - x0, 1200); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x0, FLOOR, x1 - x0, 1200);
      ctx.fillStyle = B.dark ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      var sx0 = Math.floor(x0 / 28) * 28;
      for (var s = sx0; s < x1; s += 28) { ctx.moveTo(s, FLOOR + 2); ctx.lineTo(s + 14, FLOOR - 20); ctx.lineTo(s + 28, FLOOR + 2); }
      ctx.fill();
      // pads
      for (i = 0; i < lv.pads.length; i++) {
        var p = lv.pads[i]; if (p.maxx < x0 || p.minx > x1) continue;
        var comp = p.anim * 10;
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath();
        for (var zz = 0; zz <= 6; zz++) {
          var u = zz / 6, bx = lerp(p.x1, p.x2, 0.5) + (zz % 2 ? 12 : -12), by = lerp(p.y1, p.y2, 0.5) + 8 + u * (40 - comp);
          if (zz === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.lineCap = 'round'; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 11;
        line(ctx, p.x1 - p.nx * comp, p.y1 - p.ny * comp, p.x2 - p.nx * comp, p.y2 - p.ny * comp);
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3;
        line(ctx, p.x1 - p.nx * (comp - 3), p.y1 - p.ny * (comp - 3), p.x2 - p.nx * (comp - 3), p.y2 - p.ny * (comp - 3));
      }
      // rings
      for (i = 0; i < lv.rings.length; i++) {
        var r = lv.rings[i]; if (r.x < x0 || r.x > x1) continue;
        ctx.globalAlpha = r.used ? 0.25 : 1;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(r.x, r.y, 38 + Math.sin(wallT * 5) * 2, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 38, 0, 7); ctx.stroke();
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(Math.atan2(r.dy, r.dx));
        ctx.fillStyle = '#fde047';
        for (var ch2 = -1; ch2 <= 1; ch2++) { var cx2 = ch2 * 12 + ((wallT * 30) % 12); ctx.beginPath(); ctx.moveTo(cx2 - 5, -10); ctx.lineTo(cx2 + 5, 0); ctx.lineTo(cx2 - 5, 10); ctx.lineTo(cx2 - 1, 0); ctx.fill(); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // coins
      for (i = 0; i < lv.coins.length; i++) {
        var c = lv.coins[i]; if (c.taken || c.x < x0 || c.x > x1) continue;
        var cy = c.y + Math.sin(wallT * 4 + i) * 4, sw = Math.abs(Math.cos(wallT * 3 + i));
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.ellipse(c.x, cy, 9 * sw + 1.5, 9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(c.x, cy, 6 * sw + 0.8, 6, 0, 0, 7); ctx.fill();
      }
      // spikes
      for (i = 0; i < lv.spikes.length; i++) {
        var k2 = lv.spikes[i]; if (k2.x < x0 - 60 || k2.x > x1 + 60) continue;
        ctx.save(); ctx.translate(k2.x, k2.y); ctx.rotate(wallT * 1.5 + i);
        ctx.fillStyle = '#e11d48'; ctx.beginPath();
        for (var q = 0; q < 10; q++) { var a = q / 10 * 6.283; ctx.moveTo(Math.cos(a - 0.22) * k2.r * 0.8, Math.sin(a - 0.22) * k2.r * 0.8); ctx.lineTo(Math.cos(a) * (k2.r + 9), Math.sin(a) * (k2.r + 9)); ctx.lineTo(Math.cos(a + 0.22) * k2.r * 0.8, Math.sin(a + 0.22) * k2.r * 0.8); }
        ctx.fill();
        ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(0, 0, k2.r * 0.85, 0, 7); ctx.fill();
        ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(0, 0, k2.r * 0.3, 0, 7); ctx.fill();
        ctx.restore();
      }
      // nodes
      for (i = 0; i < lv.nodes.length; i++) {
        var n = lv.nodes[i]; if (n.bx < x0 - 150 || n.bx > x1 + 150) continue;
        if (n.t === 'm') {
          ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3;
          if (n.ax === 0) line(ctx, n.bx - n.amp, n.by, n.bx + n.amp, n.by); else line(ctx, n.bx, n.by - n.amp, n.bx, n.by + n.amp);
        } else if (n.t === 'o') {
          ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
          ctx.beginPath(); ctx.arc(n.bx, n.by, n.rad, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(n.bx, n.by, 3, 0, 7); ctx.fill();
        }
        if (n.broken) continue;
        var col = n.t === 'f' ? '#f87171' : B.acc;
        ctx.globalAlpha = 0.22; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x, n.y, 22 + Math.sin(wallT * 3 + i) * 2, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(n.x, n.y, 13, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(n.x, n.y, 4.5, 0, 7); ctx.fill();
        if (n.t === 'f') {
          ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(n.x - 6, n.y - 7); ctx.lineTo(n.x - 1, n.y - 1); ctx.lineTo(n.x - 4, n.y + 6); ctx.moveTo(n.x + 5, n.y - 8); ctx.lineTo(n.x + 2, n.y); ctx.stroke();
          if (n.timer < n.life) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(n.x, n.y, 17, -Math.PI / 2, -Math.PI / 2 + 6.283 * (n.timer / n.life)); ctx.stroke(); }
        }
      }
      if (withPlayer && P) drawPlayer(lv);
      // particles
      for (i = 0; i < POOL; i++) {
        var pp = parts[i]; if (!pp.a) continue;
        ctx.globalAlpha = Math.min(1, pp.life / pp.max * 1.5);
        ctx.fillStyle = pp.col;
        if (pp.kind === 1) { ctx.save(); ctx.translate(pp.x, pp.y); ctx.rotate(pp.rot); ctx.fillRect(-pp.size, -pp.size * 0.5, pp.size * 2, pp.size); ctx.restore(); }
        else ctx.fillRect(pp.x - pp.size / 2, pp.y - pp.size / 2, pp.size, pp.size);
      }
      ctx.globalAlpha = 1;
    }
    function drawPlayer(lv) {
      var ch = CHMAP[S.sel] || CHARS[0];
      // range ring + target indicator
      if (P.alive && !P.att && !P.won) {
        ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, D.range, 0, 7); ctx.stroke();
        targetNode = findTarget();
        if (targetNode) {
          ctx.save(); ctx.translate(targetNode.x, targetNode.y); ctx.rotate(wallT * 3);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.restore();
        }
      }
      if (!P.alive) return;
      // trail
      if (trail.length >= 4) {
        ctx.lineCap = 'round';
        var nseg = trail.length / 2;
        for (var i = 1; i < nseg; i++) {
          var f = i / nseg;
          ctx.globalAlpha = f * 0.55;
          ctx.strokeStyle = colorOf(ch.tr === 'disco' ? 'rainbow' : ch.tr, wallT, i * 14);
          ctx.lineWidth = 2 + f * 9;
          line(ctx, trail[i * 2 - 2], trail[i * 2 - 1], trail[i * 2], trail[i * 2 + 1]);
        }
        ctx.globalAlpha = 1;
      }
      var ang;
      if (P.att) ang = Math.atan2(P.att.x - P.x, -(P.att.y - P.y));
      else ang = clamp(P.vx / 2000, -0.6, 0.6);
      P.ang = ang;
      var J = computeJoints(P.x, P.y, ang, P.curl, P.spin, wallT, 1.6);
      if (P.att) {
        var ex = lerp(J.ha[0], P.att.x, P.ropeT), ey = lerp(J.ha[1], P.att.y, P.ropeT);
        drawRope(ctx, J.ha[0], J.ha[1], ex, ey, ch, wallT);
      }
      drawCharacter(ctx, ch, P.x, P.y, { ang: ang, curl: P.curl, spin: P.spin, t: wallT, sc: 1.6 });
      if (!P.started) {
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '800 18px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('\u25b2', P.x + 120, P.y - 70 + Math.sin(wallT * 5) * 5);
      }
    }
    function drawHUD() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var B = BIOMES[L.biome];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(10, 10, Math.min(300, W - 190), 62, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 18px system-ui';
      ctx.fillText('LEVEL ' + curLevel + (L.boss ? ' \u00b7 BOSS' : L.challenge ? ' \u00b7 CHALLENGE' : ''), 20, 16);
      ctx.font = '600 12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText('W' + (L.biome + 1) + ' ' + B.name + ' \u00b7 \ud83e\ude99 ' + fmt(S.coins + runCoins), 20, 38);
      ctx.fillText('\u23f1 ' + runTime.toFixed(2) + 's / ' + L.parTime + '  \u00b7  \ud83e\ude9d ' + swings + '/' + L.parSwings, 20, 54);
      // progress
      var pw = Math.min(360, W * 0.4), px = W / 2 - pw / 2, prog = clamp(P.x / L.finishX, 0, 1);
      if (W > 520) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; roundRect(px, 16, pw, 10, 5); ctx.fill();
        ctx.fillStyle = B.acc; roundRect(px, 16, pw * prog, 10, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + pw * prog, 21, 6, 0, 7); ctx.fill();
      }
      // combo
      if (combo >= 2) {
        ctx.textAlign = 'center'; ctx.font = '900 ' + (26 + Math.min(20, combo * 2)) + 'px system-ui';
        ctx.fillStyle = 'hsl(' + ((combo * 40) % 360) + ',95%,65%)';
        ctx.globalAlpha = Math.min(1, comboT);
        ctx.fillText('\u00d7' + combo + ' COMBO', W / 2, 40);
        ctx.globalAlpha = 1;
      }
      // playtime
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '600 12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillText('\u23f1 Playtime ' + fmtTime(S.playtime) + ' \u00b7 Best ' + fmt(hiScore), 12, H - 10);
      // banner
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (bannerT > 0) {
        ctx.globalAlpha = Math.min(1, bannerT);
        ctx.font = '900 ' + Math.round(Math.min(46, W / 12)) + 'px system-ui'; ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 6;
        var txt = L.boss ? '\ud83d\udd25 BOSS GAUNTLET' : L.challenge ? '\u2694 CHALLENGE STAGE' : 'LEVEL ' + curLevel;
        ctx.strokeText(txt, W / 2, H * 0.3); ctx.fillText(txt, W / 2, H * 0.3);
        ctx.font = '700 16px system-ui'; ctx.strokeText(B.name, W / 2, H * 0.3 + 36); ctx.fillText(B.name, W / 2, H * 0.3 + 36);
        ctx.globalAlpha = 1;
      }
      if (!P.started && P.alive) {
        ctx.font = '900 ' + Math.round(Math.min(26, W / 18)) + 'px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 5;
        var hint = 'HOLD Space / Click / Touch to grapple';
        ctx.strokeText(hint, W / 2, H * 0.72); ctx.fillText(hint, W / 2, H * 0.72);
        ctx.font = '700 14px system-ui';
        ctx.strokeText('Release to launch \u00b7 R restart \u00b7 Esc pause', W / 2, H * 0.72 + 28); ctx.fillText('Release to launch \u00b7 R restart \u00b7 Esc pause', W / 2, H * 0.72 + 28);
      }
      if (!P.alive) {
        ctx.font = '900 34px system-ui'; ctx.fillStyle = '#fca5a5'; ctx.fillText('OUCH!', W / 2, H * 0.4);
      }
      if (P.won && winT > 0) {
        ctx.font = '900 ' + Math.round(Math.min(64, W / 9)) + 'px system-ui'; ctx.fillStyle = '#fde047'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 7;
        ctx.strokeText('FINISH!', W / 2, H * 0.38); ctx.fillText('FINISH!', W / 2, H * 0.38);
      }
      ctx.textBaseline = 'alphabetic';
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    function render() {
      var lv = mode === 'play' ? L : ML;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!lv) { ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H); return; }
      var B = BIOMES[lv.biome];
      drawSky(B);
      drawParallax(B);
      drawWorld(lv, mode === 'play');
      if (mode === 'play') drawHUD();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---------- camera ---------- */
    function updateCamera(dt) {
      var bz = baseZoom();
      if (mode === 'play' && P) {
        var sp = Math.hypot(P.vx, P.vy);
        cam.tz = bz * clamp(1.1 - sp / 4200, 0.7, 1.1);
        cam.z = lerp(cam.z, cam.tz, 1 - Math.exp(-dt * 2.5));
        var tx = P.x + clamp(P.vx * 0.22, -150, 320) + 80 / cam.z * 0.5;
        var ty = P.y + clamp(P.vy * 0.1, -120, 160);
        var minY = H / 2 / cam.z - 260, maxY = FLOOR + 120 - H / 2 / cam.z;
        ty = maxY < minY ? maxY : clamp(ty, minY, maxY);
        var k = 1 - Math.exp(-dt * 5);
        cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k * 0.8);
      } else {
        cam.z = lerp(cam.z, bz * 0.95, 1 - Math.exp(-dt * 2));
        if (ML) {
          cam.x += dt * 90;
          if (cam.x > ML.finishX) cam.x = 0;
          var my = FLOOR + 120 - H / 2 / cam.z;
          cam.y = lerp(cam.y, Math.min(330, my), 0.05);
          lvTime += dt; L = L || null;
          var save = L; L = ML; nodeUpdate(lvTime); L = save;
        }
      }
      if (shake > 0) { shx = (Math.random() - 0.5) * shake; shy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 60); } else { shx = shy = 0; }
    }

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
      if (mode === 'play' && L && P) {
        if (!paused) {
          if (hitstop > 0) hitstop -= dtr;
          else {
            var sc = slowT > 0 ? 0.25 : 1;
            if (slowT > 0) slowT -= dtr;
            acc += dtr * sc;
            var steps = 0;
            while (acc >= DT && steps < 10) { step(DT); acc -= DT; steps++; }
            if (steps >= 10) acc = 0;
          }
          if (comboT > 0) { comboT -= dtr; if (comboT <= 0) combo = 0; }
          if (bannerT > 0) bannerT -= dtr;
          if (deadT > 0) { deadT -= dtr; if (deadT <= 0) resetLevel(); }
          if (winT > 0) { winT -= dtr; if (winT <= 0) { mode = 'menu'; stopAmbient(); ML = L; show('results'); } }
        }
        updateParticles(dtr * (slowT > 0 ? 0.4 : 1));
      } else updateParticles(dtr);
      updateCamera(dtr);
      render();
      if (curScreen === 'hub' && Math.floor(wallT * 10) % 3 === 0) paintHubChar();
    }

    // autosave every 20s
    var autoSave = setInterval(function () { if (S) saveNow(); }, 20000);

    /* ---------- boot ---------- */
    resize();
    setMute(muted);
    ML = genLevel(1);
    cam.x = 0; cam.y = 330; cam.z = baseZoom();
    show('title');
    raf = requestAnimationFrame(frame);
    // test/debug hook (non-enumerable, scoped to this instance)
    try { Object.defineProperty(root, '__hlr', { value: { st: function () { return { P: P, L: L, D: D, S: S, mode: mode, last: lastResult }; }, step: step, down: pressDown, up: pressUp, play: playLevel, load: loadSlot } }); } catch (e) { }

    /* ---------- cleanup ---------- */
    return function cleanup() {
      try { saveNow(); } catch (e) { }
      cancelAnimationFrame(raf);
      clearInterval(autoSave);
      clearTimeout(toastTimer);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      if (ro) ro.disconnect();
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
    id: 'hookline-rush',
    title: 'Hookline Rush',
    description: 'One-button grappling-swing arcade action across 2,000 levels, 20 worlds and 62 unlockable characters.',
    category: 'Arcade',
    icon: createGameIcon(),
    bannerGradient: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)',
    controls: [
      'Hold Space / Mouse / Touch \u2014 Grapple & swing',
      'Release \u2014 Launch with momentum',
      'R Key \u2014 Restart level',
      'Esc \u2014 Pause / Menu',
      'M \u2014 Mute \u00b7 F \u2014 Fullscreen',
      'Enter \u2014 Next level (results)'
    ],
    start: function (container) { return startGame(container); }
  });
})();
