import * as THREE from 'three';

// Manga screentone material: cel-stepped base colour + screen-space halftone dots in shadow,
// optional decal map, radial "ambient occlusion" toward the stadium wall (uses local XY radius).
const vert = /* glsl */`
  varying vec3 vN; varying vec2 vUv; varying float vR; varying float vZ;
  void main(){
    vUv = uv;
    vR = length(position.xy); vZ = position.z;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const frag = /* glsl */`
  uniform vec3 uColor; uniform vec3 uShade; uniform vec3 uInk; uniform vec3 uLight;
  uniform float uCell; uniform float uDots; uniform float uAo; uniform vec2 uAoRange;
  uniform sampler2D uMap; uniform bool uHasMap; uniform float uMapAlphaOnly;
  varying vec3 vN; varying vec2 vUv; varying float vR; varying float vZ;
  void main(){
    float ndl = dot(normalize(vN), normalize(uLight)) * .5 + .5;
    float ao = smoothstep(uAoRange.x, uAoRange.y, vR) * uAo;
    float lum = clamp(ndl - ao, 0., 1.);
    // 2-step cel
    vec3 base = mix(uShade, uColor, step(.52, lum));
    if (uHasMap) {
      vec4 m = texture2D(uMap, vUv);
      base = mix(base, m.rgb * (lum > .52 ? 1.0 : .82), m.a);
    }
    // screen-space dots, rotated 45deg
    vec2 p = gl_FragCoord.xy / uCell;
    p = mat2(.7071, -.7071, .7071, .7071) * p;
    vec2 f = fract(p) - .5;
    float d = length(f);
    float rad = clamp((1. - lum) * 1.25 - .08, 0., .72) * uDots;
    float aa = fwidth(d) * .9;
    float dotv = 1. - smoothstep(rad - aa, rad + aa, d);
    vec3 col = mix(base, uInk, dotv * .78);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function halftoneMaterial({ color = '#f6f2e8', shade = '#d9d3c5', ink = '#111111', cell = 6, dots = 1, ao = .25, aoRange = [.14, .19], map = null, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uShade: { value: new THREE.Color(shade) }, uInk: { value: new THREE.Color(ink) },
      uLight: { value: new THREE.Vector3(.35, .9, .55) }, uCell: { value: cell * (typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1) },
      uDots: { value: dots }, uAo: { value: ao }, uAoRange: { value: new THREE.Vector2(...aoRange) },
      uMap: { value: map }, uHasMap: { value: !!map }, uMapAlphaOnly: { value: 0 },
    },
  });
}
