import { useRef, useSyncExternalStore, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera } from '@react-three/drei';
import BeyModel, { SHOWCASE_REVS } from './BeyModel.jsx';
import './scene.css';

// Shared-canvas registry: if <ShowcaseCanvas/> is mounted once (e.g. in App), every <BeyShowcase>
// renders into it through drei <View> (one WebGL context for any number of cards). Otherwise each
// showcase falls back to its own small <Canvas>.
let shared = 0; const subs = new Set();
const setShared = v => { shared = v; subs.forEach(f => f()); };
const useShared = () => useSyncExternalStore(f => (subs.add(f), () => subs.delete(f)), () => shared > 0);

export function ShowcaseCanvas() {
  useEffect(() => { setShared(shared + 1); return () => setShared(shared - 1); }, []);
  return (
    <Canvas
      flat
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5 }}
    >
      <View.Port />
    </Canvas>
  );
}

function ShowcaseContent({ bey, spinning, rpm, rpmRef, tilt, zoom, revs }) {
  const g = useRef();
  const aspect = useThree(st => st.size.width / Math.max(1, st.size.height));
  const dist = 1.32 / zoom * Math.max(1, .95 / aspect); // tall panels: back off so the bey isn't cropped
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.rotation.y = Math.sin(t * .6) * .25;
    g.current.position.y = Math.sin(t * 1.4) * .012;
  });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, .3 * dist / (1.32 / zoom), dist]} fov={30} onUpdate={c => c.lookAt(0, -.03, 0)} />
      <ambientLight intensity={.85} />
      <directionalLight position={[1.5, 3, 2]} intensity={1.7} />
      <directionalLight position={[-2, .5, -1]} intensity={.6} color="#bcd4ff" />
      <group ref={g}>
        <group rotation-x={-Math.PI / 2 + tilt} scale={10}>
          <BeyModel bey={bey} spinning={spinning} rpm={rpm} rpmRef={rpmRef} outlineWidth={2.4} maxRevs={revs} blurStrength={.35} />
        </group>
      </group>
    </>
  );
}

/**
 * <BeyShowcase bey spinning? rpm? rpmRef? tilt? zoom? background? standalone? revs? className? style? />  (revs = visual rev/s cap, default SHOWCASE_REVS)
 * Rotating bey for menus/cards. tilt: radians toward camera (default .45). rpm: show spin blur.
 */
export default function BeyShowcase({ bey, spinning = true, rpm, rpmRef, tilt = .32, zoom = 1.35, background = true, standalone = false, revs = SHOWCASE_REVS, className = '', style }) {
  const useView = useShared() && !standalone; // standalone: own canvas (e.g. inside modals above the shared canvas)
  if (!bey) return null;
  const content = <ShowcaseContent bey={bey} spinning={spinning} rpm={rpm} rpmRef={rpmRef} tilt={tilt} zoom={zoom} revs={revs} />;
  return (
    <div className={`ks-showcase ${className}`} style={style}>
      {background && <div className="ks-showcase-bg" />}
      {useView ? (
        <View style={{ position: 'absolute', inset: 0 }}>{content}</View>
      ) : (
        <Canvas flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>{content}</Canvas>
      )}
    </div>
  );
}
