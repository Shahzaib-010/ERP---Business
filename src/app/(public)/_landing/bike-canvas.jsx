"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// A stylised motorcycle built from simple shapes, so no 3D asset files or licences are
// needed. x = forward, y = up, z = sideways. The paint colour animates when it changes.

const STYLES = {
  commuter: { wheelR: 0.6, tire: 0.08, tank: [0.5, 0.25, 0.3], seatLen: 0.95, fairing: false, sportExhaust: false, guard: true },
  street: { wheelR: 0.62, tire: 0.1, tank: [0.62, 0.3, 0.36], seatLen: 0.85, fairing: false, sportExhaust: false, guard: false },
  sport: { wheelR: 0.62, tire: 0.12, tank: [0.66, 0.32, 0.38], seatLen: 0.75, fairing: true, sportExhaust: true, guard: false },
};

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder from point a to point b. */
function Tube({ a, b, r = 0.035, material }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    return {
      length: dir.length(),
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
    };
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow>
      <cylinderGeometry args={[r, r, length, 16]} />
    </mesh>
  );
}

function Wheel({ x, R, tire, mats, front }) {
  const spokes = 14;
  return (
    <group position={[x, R, 0]}>
      <mesh material={mats.rubber} castShadow>
        <torusGeometry args={[R - tire * 0.9, tire, 20, 64]} />
      </mesh>
      <mesh material={mats.chrome}>
        <torusGeometry args={[R - tire * 2 - 0.02, 0.022, 12, 64]} />
      </mesh>
      {Array.from({ length: spokes }, (_, i) => {
        const angle = (i / spokes) * Math.PI * 2;
        const len = R - tire * 2 - 0.08;
        const z = i % 2 ? 0.04 : -0.04;
        return (
          <mesh key={i} material={mats.chrome} rotation={[0, 0, angle]} position={[Math.sin(-angle) * (len / 2 + 0.06), Math.cos(angle) * (len / 2 + 0.06), z]}>
            <cylinderGeometry args={[0.006, 0.006, len, 6]} />
          </mesh>
        );
      })}
      <mesh material={mats.metal} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.2, 20]} />
      </mesh>
      {front && (
        <mesh material={mats.disc} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.2, 0.2, 0.012, 32]} />
        </mesh>
      )}
    </group>
  );
}

function Motorcycle({ color, style }) {
  const s = STYLES[style] ?? STYLES.commuter;
  const R = s.wheelR;
  const target = useMemo(() => new THREE.Color(color), [color]);

  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 1, roughness: 0.15 }),
      metal: new THREE.MeshStandardMaterial({ color: "#3a3d42", metalness: 0.8, roughness: 0.35 }),
      frame: new THREE.MeshStandardMaterial({ color: "#1d1f23", metalness: 0.6, roughness: 0.4 }),
      seat: new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.75 }),
      disc: new THREE.MeshStandardMaterial({ color: "#9aa0a8", metalness: 0.9, roughness: 0.3 }),
      lens: new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff3c4", emissiveIntensity: 1.6 }),
      tail: new THREE.MeshStandardMaterial({ color: "#ff2a2a", emissive: "#ff1a1a", emissiveIntensity: 1.2 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#9fb6c8", transparent: true, opacity: 0.45, roughness: 0.05 }),
    }),
    // Materials are created once; the paint colour is animated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Smoothly blend the paint towards the chosen colour.
  useFrame((_, delta) => {
    mats.paint.color.lerp(target, Math.min(1, delta * 6));
  });

  const fx = 1.05; // front axle x
  const rx = -1.05; // rear axle x
  const head = [0.66, 1.42, 0];
  const headLow = [0.6, 1.12, 0];

  return (
    <group position={[0, 0, 0]}>
      <Wheel x={fx} R={R} tire={s.tire} mats={mats} front />
      <Wheel x={rx} R={R} tire={s.tire} mats={mats} />

      {/* Front forks */}
      {[-0.11, 0.11].map((z) => (
        <group key={z}>
          <Tube a={[fx, R, z]} b={[head[0] + 0.02, head[1], z]} r={0.032} material={mats.chrome} />
          <Tube a={[fx + 0.02, R + 0.05, z]} b={[fx - 0.12, R + 0.38, z]} r={0.045} material={mats.metal} />
        </group>
      ))}

      {/* Frame */}
      <Tube a={head} b={[-0.35, 1.18, 0]} r={0.04} material={mats.frame} />
      <Tube a={headLow} b={[0.18, 0.5, 0]} r={0.04} material={mats.frame} />
      <Tube a={[0.18, 0.5, 0]} b={[-0.25, 0.6, 0]} r={0.04} material={mats.frame} />
      <Tube a={[-0.25, 0.6, 0]} b={[-0.35, 1.18, 0]} r={0.04} material={mats.frame} />
      <Tube a={[-0.35, 1.18, 0]} b={[-1.08, 1.2, 0]} r={0.03} material={mats.frame} />

      {/* Swingarm and rear shocks */}
      {[-0.13, 0.13].map((z) => (
        <group key={z}>
          <Tube a={[-0.25, 0.62, z]} b={[rx, R, z]} r={0.03} material={mats.frame} />
          <Tube a={[-0.86, 0.72, z + Math.sign(z) * 0.02]} b={[-0.58, 1.17, z + Math.sign(z) * 0.02]} r={0.03} material={mats.chrome} />
        </group>
      ))}

      {/* Fuel tank */}
      <mesh material={mats.paint} position={[0.22, 1.38, 0]} rotation={[0, 0, -0.12]} scale={s.tank} castShadow>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      {/* Knee pads */}
      {[-0.31, 0.31].map((z) => (
        <mesh key={z} material={mats.seat} position={[0.05, 1.3, z * (s.tank[2] / 0.3) * 0.98]} rotation={[0, 0, -0.1]} scale={[0.14, 0.08, 0.02]}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
      ))}

      {/* Seat */}
      <RoundedBox args={[s.seatLen, 0.12, 0.3]} radius={0.05} smoothness={4} position={[-0.32 - s.seatLen / 2 + 0.3, 1.3, 0]} material={mats.seat} castShadow />

      {/* Side cover and tail */}
      <RoundedBox args={[0.46, 0.3, 0.26]} radius={0.06} smoothness={4} position={[-0.42, 1.02, 0]} material={mats.paint} castShadow />
      <RoundedBox args={[0.5, 0.12, 0.22]} radius={0.05} smoothness={4} position={[-1.0, 1.24, 0]} rotation={[0, 0, 0.12]} material={mats.paint} castShadow />
      <mesh material={mats.tail} position={[-1.27, 1.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.07, 0.04, 0.14]} />
      </mesh>

      {/* Mudguards */}
      <mesh material={s.guard ? mats.paint : mats.frame} position={[rx, R, 0]} rotation={[0, 0, Math.PI * 0.25]}>
        <torusGeometry args={[R + 0.05, 0.04, 10, 48, Math.PI * 0.55]} />
      </mesh>
      <mesh material={mats.paint} position={[fx, R, 0]} rotation={[0, 0, Math.PI * 0.3]}>
        <torusGeometry args={[R + 0.04, 0.045, 10, 48, Math.PI * 0.42]} />
      </mesh>

      {/* Engine */}
      <RoundedBox args={[0.48, 0.38, 0.32]} radius={0.05} smoothness={3} position={[0.02, 0.76, 0]} material={mats.metal} castShadow />
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} material={mats.chrome} position={[0.3 + i * 0.012, 0.95 + i * 0.05, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.22, 0.018, 0.3]} />
        </mesh>
      ))}
      <mesh material={mats.chrome} position={[0.0, 0.72, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 32]} />
      </mesh>

      {/* Exhaust */}
      <Tube a={[0.3, 0.66, 0.16]} b={[0.05, 0.42, 0.2]} r={0.035} material={mats.chrome} />
      <Tube a={[0.05, 0.42, 0.2]} b={[-0.3, 0.45, 0.22]} r={0.035} material={mats.chrome} />
      {s.sportExhaust ? (
        <Tube a={[-0.3, 0.45, 0.22]} b={[-0.95, 0.8, 0.22]} r={0.075} material={mats.metal} />
      ) : (
        <Tube a={[-0.3, 0.45, 0.22]} b={[-1.05, 0.55, 0.22]} r={0.065} material={mats.chrome} />
      )}

      {/* Headlight, handlebar, mirrors */}
      <group position={[0.82, 1.4, 0]}>
        <mesh material={s.fairing ? mats.metal : mats.chrome} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.11, 0.14, 32]} />
        </mesh>
        <mesh material={mats.lens} position={[0.071, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.01, 32]} />
        </mesh>
      </group>
      {s.fairing && (
        <group>
          <RoundedBox args={[0.32, 0.42, 0.46]} radius={0.12} smoothness={4} position={[0.78, 1.36, 0]} rotation={[0, 0, -0.35]} material={mats.paint} castShadow />
          <mesh material={mats.glass} position={[0.72, 1.62, 0]} rotation={[0, 0, -0.75]}>
            <boxGeometry args={[0.26, 0.01, 0.36]} />
          </mesh>
          <RoundedBox args={[0.7, 0.3, 0.36]} radius={0.1} smoothness={4} position={[0.35, 0.82, 0]} rotation={[0, 0, 0.15]} material={mats.paint} castShadow />
        </group>
      )}
      <Tube a={[0.6, 1.58, -0.4]} b={[0.6, 1.58, 0.4]} r={0.02} material={mats.chrome} />
      <Tube a={[head[0], head[1], 0]} b={[0.6, 1.58, 0]} r={0.03} material={mats.metal} />
      {[-0.4, 0.4].map((z) => (
        <group key={z}>
          <Tube a={[0.6, 1.58, z]} b={[0.6, 1.58, z * 1.28]} r={0.03} material={mats.rubber} />
          <Tube a={[0.6, 1.58, z * 0.8]} b={[0.56, 1.82, z * 0.95]} r={0.008} material={mats.chrome} />
          <mesh material={mats.chrome} position={[0.56, 1.85, z * 0.97]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.4]}>
            <cylinderGeometry args={[0.05, 0.05, 0.015, 24]} />
          </mesh>
        </group>
      ))}
      <mesh material={mats.metal} position={[0.62, 1.66, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 24]} />
      </mesh>
    </group>
  );
}

export default function BikeCanvas({ color, style, autoRotate, onInteract, resetKey }) {
  const controls = useRef();
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [3.05, 1.45, 3.2], fov: 32 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} />

      <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.15} floatingRange={[0, 0.04]}>
        <Motorcycle color={color} style={style} />
      </Float>

      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={6} blur={2.4} far={2} />

      {/* Studio reflections made from light panels: no image files are downloaded. */}
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer intensity={1.2} position={[-5, 1.5, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer intensity={1.2} position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer intensity={0.8} position={[0, 1, 5]} scale={[6, 2, 1]} />
      </Environment>

      <OrbitControls
        key={resetKey}
        ref={controls}
        target={[0, 0.9, 0]}
        enablePan={false}
        minDistance={2.8}
        maxDistance={7.5}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.49}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        enableDamping
        onStart={onInteract}
      />
      <AllowPageScroll key={`scroll-${resetKey}`} />
    </Canvas>
  );
}

/**
 * OrbitControls blocks all touch scrolling on the canvas. Let vertical swipes scroll the
 * page (pan-y) while horizontal drags still rotate the bike. Must render after OrbitControls.
 */
export function AllowPageScroll() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const id = requestAnimationFrame(() => (el.style.touchAction = "pan-y"));
    return () => cancelAnimationFrame(id);
  }, [gl]);
  return null;
}
