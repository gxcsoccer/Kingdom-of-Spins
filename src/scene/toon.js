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
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : undefined,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
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
export function emblemTexture(bey, fusion = null) {
  const { primary, secondary, accent } = bey.colors || {};
  const letter = ((bey.name || '?').replace(/[^A-Za-z0-9]/g, '') || '?')[0].toUpperCase();
  const key = `emblem:${bey.id}:${primary}:${accent}:${letter}:${fusion ? fusion.join(',') : ''}`;
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
    g.fillStyle = accent || '#fff'; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
    g.font = '900 86px "Arial Black", "Helvetica Neue", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = INK; g.strokeText(letter, cx, cy + 4);
    g.fillStyle = '#fff'; g.fillText(letter, cx, cy + 4);
  }, { mirror: true });
  if (fresh && bey.id && typeof Image !== 'undefined') {
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
