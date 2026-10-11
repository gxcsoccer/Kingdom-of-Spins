import * as THREE from 'three';

// Shared manga/toon helpers: gradient maps, cached materials, canvas textures.
const cache = new Map();
const memo = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

export const INK = '#111111';
export const PAPER = '#fbf8f1';

function gradient(steps) {
  return memo('grad:' + steps.join(','), () => {
    const data = new Uint8Array(steps);
    const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  });
}
// 3-tone cel shading: shadow / mid / lit.
export const toonGradient = () => gradient([90, 175, 255]);
// Harsh banded "metal" look (manga chrome: dark band then bright).
export const metalGradient = () => gradient([60, 120, 255, 200, 255]);

export function toonMat(color, opts = {}) {
  const key = `toon:${color}:${opts.metal ? 1 : 0}:${opts.emissive || ''}:${opts.opacity ?? 1}`;
  return memo(key, () => new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: opts.metal ? metalGradient() : toonGradient(),
    ...(opts.emissive ? { emissive: new THREE.Color(opts.emissive), emissiveIntensity: opts.emissiveIntensity ?? 1 } : {}),
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
  }));
}

export function canvasTexture(key, w, h, draw, { repeat, srgb = true, mirror = false } = {}) {
  return memo('tex:' + key, () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (mirror) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; }
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(...repeat);
    }
    return tex;
  });
}

// Emblem for the lock chip: starburst + bold initial in the bey colours. Fused beys get a split
// two-colour burst. If /art/emblems/<id>.png exists it replaces the procedural art once loaded.
export function emblemTexture(bey, fusion = null, icon = null) {
  const { primary, secondary, accent } = bey.colors || {};
  const letter = ((bey.name || '?').replace(/[^A-Za-z0-9]/g, '') || '?')[0].toUpperCase();
  const key = `emblem:${bey.id}:${primary}:${secondary}:${accent}:${letter}:${fusion ? fusion.join(',') : ''}:${icon || ''}`;
  const fresh = !cache.has('tex:' + key);
  const tex = canvasTexture(key, 256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, 128, 0, Math.PI * 2); g.fill();
    g.fillStyle = secondary || '#fff'; g.beginPath(); g.arc(cx, cy, 116, 0, Math.PI * 2); g.fill();
    const burst = () => {
      g.beginPath();
      const spikes = 12;
      for (let i = 0; i <= spikes * 2; i++) {
        const r = i % 2 ? 62 : 108, a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
    };
    if (fusion) {
      // split burst: parent A colour on one diagonal half, parent B on the other
      g.save(); g.beginPath(); g.moveTo(cx - 140, cy + 140); g.lineTo(cx + 140, cy - 140); g.lineTo(cx - 140, cy - 140); g.closePath(); g.clip();
      burst(); g.fillStyle = fusion[0]; g.fill(); g.restore();
      g.save(); g.beginPath(); g.moveTo(cx - 140, cy + 140); g.lineTo(cx + 140, cy - 140); g.lineTo(cx + 140, cy + 140); g.closePath(); g.clip();
      burst(); g.fillStyle = fusion[1]; g.fill(); g.restore();
      burst(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 90, cy + 90); g.lineTo(cx + 90, cy - 90); g.stroke();
    } else {
      g.fillStyle = primary || '#888'; burst(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
    }
    if (icon && icon !== 'letter') {
      const disc = brightest([accent, secondary, '#ffffff']);
      g.fillStyle = disc; g.beginPath(); g.arc(cx, cy, 84, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
      drawIcon(g, icon, cx, cy, 1.45, INK, disc);
      return;
    }
    g.fillStyle = accent || '#fff'; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    g.font = '900 86px "Arial Black", "Helvetica Neue", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = INK; g.strokeText(letter, cx, cy + 4);
    g.fillStyle = '#fff'; g.fillText(letter, cx, cy + 4);
  }, { mirror: true });
  if (fresh && bey.id && !icon && typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth) return;
      const c = tex.image, g = c.getContext('2d'), w = c.width, h = c.height;
      g.clearRect(0, 0, w, h);
      g.fillStyle = INK; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2); g.clip();
      g.fillStyle = secondary || '#fff'; g.fillRect(0, 0, w, h);
      g.drawImage(img, 10, 10, w - 20, h - 20);
      g.restore();
      tex.needsUpdate = true;
    };
    img.src = `/art/emblems/${encodeURIComponent(bey.id)}.png`;
  }
  return tex;
}

// Ratchet side band: "3-60" repeated, ink on dark plastic.
export function ratchetTexture(label) {
  return canvasTexture('ratchet:' + label, 512, 64, (g, w, h) => {
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3e46'; g.fillRect(0, 0, w, 10);
    g.font = '900 38px "Arial Black", sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'center';
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#e8e8e8';
      g.fillText(label, (i + .5) * w / 4, h / 2 + 3);
    }
  });
}

// Arc streaks for the spin-blur disc (alpha texture, white).
export function spinBlurTexture() {
  return canvasTexture('spinblur', 512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      const r = 70 + Math.random() * 180, a0 = Math.random() * Math.PI * 2, len = .6 + Math.random() * 1.6;
      g.strokeStyle = `rgba(255,255,255,${.25 + Math.random() * .6})`;
      g.lineWidth = 2 + Math.random() * 6;
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + len); g.stroke();
    }
    for (let k = 0; k < 14; k++) {
      const r = 90 + Math.random() * 160, a0 = Math.random() * Math.PI * 2;
      g.strokeStyle = `rgba(17,17,17,${.35 + Math.random() * .4})`;
      g.lineWidth = 2 + Math.random() * 3;
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + .4 + Math.random()); g.stroke();
    }
  });
}

// Screentone dots (tileable), used on the stadium slope.
export function screentoneTexture(ink = 'rgba(17,17,17,.55)', bg = '#f4f1ea') {
  return canvasTexture(`tone:${ink}:${bg}`, 64, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = ink;
    for (const [x, y] of [[16, 16], [48, 48]]) { g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill(); }
  }, { repeat: [1, 1] });
}

// Blob shadow: halftone dots fading out radially (alpha).
export function blobShadowTexture() {
  return canvasTexture('blob', 256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.clearRect(0, 0, w, h);
    g.fillStyle = INK;
    const step = 11;
    for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
      const d = Math.hypot(x - cx, y - cy) / (w / 2);
      if (d > 1) continue;
      const r = (1 - d * d) * step * .55;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
}

// perceived (sRGB) luminance 0..1 — what a kid sees, not linear light
export const lum = hex => { const h = String(hex || '#888888').replace('#', ''); const v = h.length === 3 ? h.split('').map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return (.299 * v[0] + .587 * v[1] + .114 * v[2]) / 255; };
const brightest = list => list.find(c => c && lum(c) > .42) || '#ffffff';
// ---- vector emblem icons: bold solid silhouettes (±50 grid), readable at chip size ----
const ICONS = {
  // dragon head facing right: two horns, open jaw
  dragon: g => { // side view: long snout, wide-open fanged jaw, horns swept back, spiky neck crest
    g.moveTo(-34, -10); g.lineTo(-50, -34); g.lineTo(-24, -22); g.lineTo(-38, -46); g.lineTo(-8, -26); g.lineTo(30, -22); g.lineTo(48, -14); g.lineTo(46, -6);
    g.lineTo(18, -4); g.lineTo(44, 10); g.lineTo(40, 18); g.lineTo(6, 14); g.lineTo(-10, 28); g.lineTo(-26, 46); g.lineTo(-36, 34);
    g.lineTo(-48, 30); g.lineTo(-40, 20); g.lineTo(-52, 12); g.lineTo(-42, 4); g.lineTo(-50, -6); g.closePath(); },
  wolf: g => { g.moveTo(-34, -44); g.lineTo(-14, -18); g.lineTo(14, -18); g.lineTo(34, -44); g.lineTo(38, -4); g.lineTo(22, 14); g.lineTo(6, 42); g.lineTo(-6, 42); g.lineTo(-22, 14); g.lineTo(-38, -4); g.closePath(); },
  eagle: g => { g.moveTo(0, -24); g.lineTo(-48, -36); g.lineTo(-34, -12); g.lineTo(-46, -2); g.lineTo(-16, 4); g.lineTo(-10, 40); g.lineTo(0, 28); g.lineTo(10, 40); g.lineTo(16, 4); g.lineTo(46, -2); g.lineTo(34, -12); g.lineTo(48, -36); g.closePath(); },
  // shark side view: big dorsal fin + forked tail
  shark: g => { g.moveTo(-48, -24); g.lineTo(-34, 2); g.lineTo(-48, 26); g.lineTo(-24, 8); g.quadraticCurveTo(4, 26, 34, 12); g.lineTo(48, 4); g.quadraticCurveTo(30, -10, 10, -10); g.lineTo(-2, -40); g.lineTo(-14, -8); g.quadraticCurveTo(-22, -6, -26, -4); g.closePath(); },
  tiger: g => { g.moveTo(-40, -34); g.lineTo(-26, -44); g.lineTo(-14, -30); g.lineTo(14, -30); g.lineTo(26, -44); g.lineTo(40, -34); g.lineTo(40, 6); g.lineTo(20, 36); g.lineTo(-20, 36); g.lineTo(-40, 6); g.closePath(); },
  phoenix: g => { g.moveTo(0, -44); g.quadraticCurveTo(12, -20, 48, -26); g.quadraticCurveTo(28, -4, 36, 14); g.quadraticCurveTo(14, 8, 10, 22); g.lineTo(20, 46); g.lineTo(0, 32); g.lineTo(-20, 46); g.lineTo(-10, 22); g.quadraticCurveTo(-14, 8, -36, 14); g.quadraticCurveTo(-28, -4, -48, -26); g.quadraticCurveTo(-12, -20, 0, -44); g.closePath(); },
  lightning: g => { g.moveTo(10, -48); g.lineTo(-30, 8); g.lineTo(-4, 8); g.lineTo(-14, 48); g.lineTo(32, -12); g.lineTo(6, -12); g.closePath(); },
  flame: g => { g.moveTo(0, -48); g.quadraticCurveTo(14, -20, 32, -20); g.quadraticCurveTo(24, -4, 38, 12); g.quadraticCurveTo(36, 44, 0, 46); g.quadraticCurveTo(-36, 44, -38, 12); g.quadraticCurveTo(-24, -4, -32, -20); g.quadraticCurveTo(-14, -20, 0, -48); g.closePath(); },
  star: g => { for (let i = 0; i <= 10; i++) { const r = i % 2 ? 21 : 48, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(r * Math.cos(a), r * Math.sin(a)); } g.closePath(); },
  wave: g => { g.moveTo(-48, 34); g.quadraticCurveTo(-46, -32, 4, -36); g.quadraticCurveTo(42, -38, 42, -6); g.quadraticCurveTo(24, -20, 12, -6); g.quadraticCurveTo(2, 8, 22, 16); g.quadraticCurveTo(42, 24, 48, 34); g.closePath(); },
  // one big peak + a smaller one (snow cap drawn in DETAIL) — not a "W"
  mountain: g => { g.moveTo(-50, 36); g.lineTo(-10, -44); g.lineTo(12, -4); g.lineTo(24, -16); g.lineTo(50, 36); g.closePath(); },
};
const DETAIL = { // drawn in the light colour on top of the dark silhouette
  dragon: g => { g.moveTo(2, -16); g.lineTo(14, -14); g.lineTo(4, -10); g.closePath(); g.moveTo(22, -4); g.lineTo(26, 3); g.lineTo(30, -4); g.closePath(); g.moveTo(32, -5); g.lineTo(35, 1); g.lineTo(38, -5); g.closePath(); g.moveTo(24, 13); g.lineTo(28, 7); g.lineTo(32, 14); g.closePath(); },
  wolf: g => { g.moveTo(-18, -4); g.lineTo(-6, 2); g.lineTo(-16, 4); g.closePath(); g.moveTo(18, -4); g.lineTo(6, 2); g.lineTo(16, 4); g.closePath(); },
  tiger: g => { g.rect(-34, -14, 14, 5); g.rect(20, -14, 14, 5); g.rect(-36, 4, 14, 5); g.rect(22, 4, 14, 5); g.rect(-3, -28, 6, 14); },
  shark: g => { g.arc(30, 2, 4, 0, Math.PI * 2); },
  mountain: g => { g.moveTo(-10, -44); g.lineTo(4, -16); g.lineTo(-2, -20); g.lineTo(-8, -12); g.lineTo(-14, -20); g.lineTo(-24, -16); g.closePath(); g.rect(-50, 30, 100, 6); },
  eagle: g => { g.arc(0, -16, 4, 0, Math.PI * 2); },
};
export function drawIcon(g, kind, cx, cy, s = 1, fill = INK, light = '#fff') {
  const f = ICONS[kind]; if (!f) return;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.lineJoin = 'round';
  g.beginPath(); f(g); g.lineWidth = 12 / s; g.strokeStyle = light; g.stroke(); // light halo keeps the silhouette crisp
  g.fillStyle = fill; g.fill();
  if (DETAIL[kind]) { g.beginPath(); DETAIL[kind](g); g.fillStyle = light; g.fill(); }
  g.restore();
}

// Blade-face pattern as a colour map (primary base + accent/secondary marks), tiled in metres-UV space.
export function patternTexture(pattern, primary, accent, secondary) {
  return canvasTexture(`pat3:${pattern}:${primary}:${accent}:${secondary}`, 256, 256, (g, w, h) => {
    g.fillStyle = primary || '#888'; g.fillRect(0, 0, w, h);
    const ink = (path, col) => { g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); path(); g.fill(); g.stroke(); };
    if (pattern === 'stripes') for (let x = -h; x < w; x += 64) ink(() => { g.moveTo(x, h); g.lineTo(x + 26, h); g.lineTo(x + 26 + h, 0); g.lineTo(x + h, 0); g.closePath(); }, accent);
    else if (pattern === 'flames') for (let x = 0; x < w; x += 64) ink(() => { g.moveTo(x, h); g.quadraticCurveTo(x + 6, h * .55, x + 30, h * .25); g.quadraticCurveTo(x + 20, h * .55, x + 44, h * .45); g.quadraticCurveTo(x + 40, h * .75, x + 60, h); g.closePath(); }, accent);
    else if (pattern === 'bolts') for (const [x, y] of [[20, 4], [106, 4], [192, 4], [62, 128], [148, 128], [234, 128], [-24, 128]]) ink(() => { g.moveTo(x + 30, y); g.lineTo(x - 6, y + 60); g.lineTo(x + 18, y + 60); g.lineTo(x - 4, y + 120); g.lineTo(x + 54, y + 44); g.lineTo(x + 30, y + 44); g.lineTo(x + 50, y); g.closePath(); }, accent);
    else if (pattern === 'dots') for (let y = 20; y < h; y += 52) for (let x = (y / 52 % 2) * 26 + 20; x < w; x += 52) ink(() => g.arc(x, y, 13, 0, Math.PI * 2), secondary || accent);
  }, { repeat: [24, 24] });
}
