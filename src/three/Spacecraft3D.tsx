/**
 * The spacecraft as a 3D assembly. Each selected part flies in and snaps onto the
 * 3U bus in build order; swapping a card re-attaches just that part. Geometry is
 * illustrative (10 cm units), drawn with outlines over flat shading so it reads
 * as a diagram, not a render.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Design, DesignSlot } from '../sim/types';
import { Controls, Edges } from './shared';
import { easeOutBack } from './util';

const AMBER = '#ffb648';
const LINE = '#cfd9e4';
const FLY_SEC = 0.7;
const STAGGER_SEC = 0.32;

const RunContext = createContext({ start: 0 });
/** Seconds since this part finished flying in; negative while it is still on its way. */
const SettleContext = createContext<{ current: number }>({ current: -1 });

function Assemble({ order, from, children }: { order: number; from: [number, number, number]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const run = useContext(RunContext);
  // Parts mounted with the run stagger in; a later swap attaches immediately.
  const [delay] = useState(() => (performance.now() - run.start < 400 ? order * STAGGER_SEC : 0));
  const startedAt = useRef<number | null>(null);
  const settle = useRef(-1);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    startedAt.current ??= state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startedAt.current - delay;
    const p = Math.min(1, Math.max(0, elapsed / FLY_SEC));
    const e = easeOutBack(p);
    g.visible = elapsed > 0;
    g.position.set(from[0] * (1 - e), from[1] * (1 - e), from[2] * (1 - e));
    g.scale.setScalar(0.55 + 0.45 * e);
    settle.current = elapsed - FLY_SEC;
  });

  return (
    <SettleContext.Provider value={settle}>
      <group ref={group} visible={false}>
        {children}
      </group>
    </SettleContext.Provider>
  );
}

type Vec3 = [number, number, number];

interface SolidProps {
  position?: Vec3;
  rotation?: Vec3;
  color: string;
  hot?: boolean;
  opacity?: number;
  metalness?: number;
}

function Solid({ geometry, position, rotation, color, hot, opacity = 1, metalness = 0.15 }: SolidProps & { geometry: THREE.BufferGeometry }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          metalness={metalness}
          roughness={0.6}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 1}
        />
      </mesh>
      <Edges geometry={geometry} color={hot ? AMBER : LINE} opacity={hot ? 1 : 0.7} />
    </group>
  );
}

function Box({ size, ...rest }: SolidProps & { size: Vec3 }) {
  const [x, y, z] = size;
  const geometry = useMemo(() => new THREE.BoxGeometry(x, y, z), [x, y, z]);
  return <Solid geometry={geometry} {...rest} />;
}

function Cylinder({ radius, height, ...rest }: SolidProps & { radius: number; height: number }) {
  const geometry = useMemo(() => new THREE.CylinderGeometry(radius, radius, height, 28), [radius, height]);
  return <Solid geometry={geometry} {...rest} />;
}

/** Solar panel with its cell grid drawn on the face. */
function Panel({ width, height, hot, ...rest }: Omit<SolidProps, 'color'> & { width: number; height: number }) {
  const cells = useMemo(() => {
    const points: number[] = [];
    const z = 0.012;
    for (let x = -width / 2 + width / 3; x < width / 2 - 1e-6; x += width / 3) points.push(x, -height / 2, z, x, height / 2, z);
    for (let y = -height / 2 + 0.25; y < height / 2 - 1e-6; y += 0.25) points.push(-width / 2, y, z, width / 2, y, z);
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  }, [width, height]);
  useEffect(() => () => cells.dispose(), [cells]);
  return (
    <group position={rest.position} rotation={rest.rotation}>
      <Box size={[width, height, 0.02]} color="#1d3a66" metalness={0.35} hot={hot} />
      <lineSegments geometry={cells}>
        <lineBasicMaterial color="#5f86b8" transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={cells} rotation={[0, Math.PI, 0]}>
        <lineBasicMaterial color="#5f86b8" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

/** Deployable wing: folds flat against the bus, then swings open after it lands. */
function Wing({ side, hot }: { side: 1 | -1; hot: boolean }) {
  const hinge = useRef<THREE.Group>(null);
  const settle = useContext(SettleContext);
  useFrame(() => {
    if (!hinge.current) return;
    const p = Math.min(1, Math.max(0, settle.current / 0.8));
    hinge.current.rotation.y = side * (1 - easeOutBack(p)) * (Math.PI / 2);
  });
  return (
    <group ref={hinge} position={[side * 0.51, 0, 0]} rotation={[0, side * (Math.PI / 2), 0]}>
      <Panel width={0.95} height={3} position={[side * 0.53, 0, 0]} hot={hot} />
      <Panel width={0.95} height={3} position={[side * 1.52, 0, 0]} hot={hot} />
    </group>
  );
}

function Dish({ hot }: { hot: boolean }) {
  const geometry = useMemo(() => {
    const points = Array.from({ length: 12 }, (_, i) => {
      const r = (i / 11) * 0.85;
      return new THREE.Vector2(r, r * r * 0.45);
    });
    return new THREE.LatheGeometry(points, 36);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[0, 2.15, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#d9dee4" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Edges geometry={geometry} color={hot ? AMBER : LINE} opacity={0.35} />
      <Cylinder radius={0.03} height={0.45} position={[0, 0.22, 0]} color="#9aa5b1" hot={hot} />
    </group>
  );
}

function Parts({ design, focus }: { design: Design; focus: DesignSlot | null }) {
  const { ids } = design;
  // Parts mounted in this first render stagger in; later swaps attach at once.
  const [run] = useState(() => ({ start: performance.now() }));
  const hot = (slot: DesignSlot) => focus === slot;
  const batteryHeight = ids.battery === 'batt-40' ? 0.8 : ids.battery === 'batt-28' ? 0.55 : 0.35;

  return (
    <RunContext.Provider value={run}>
      <Assemble key={ids.bus} order={0} from={[0, -5, 0]}>
        <Box size={[1, 3.4, 1]} color="#8fa3b8" opacity={0.16} hot={hot('bus')} />
        {ids.bus === 'bus-3u-hd'
          ? ([-1, 1] as const).flatMap((sx) =>
              ([-1, 1] as const).map((sz) => (
                <Box key={`${sx}${sz}`} size={[0.08, 3.5, 0.08]} position={[sx * 0.48, 0, sz * 0.48]} color="#c3ccd5" metalness={0.5} hot={hot('bus')} />
              )),
            )
          : null}
        {[-0.57, 0.57].map((y) => (
          <Box key={y} size={[1.01, 0.03, 1.01]} position={[0, y, 0]} color="#8fa3b8" opacity={0.25} hot={hot('bus')} />
        ))}
      </Assemble>

      <Assemble key={ids.battery} order={1} from={[0, 0, 5]}>
        <Box size={[0.7, batteryHeight, 0.7]} position={[0, -1.1 + batteryHeight / 2, 0]} color="#6f9a7b" hot={hot('battery')} />
      </Assemble>

      <Assemble key={ids.adcs} order={2} from={[-5, 0, 0]}>
        {ids.adcs === 'adcs-mag' ? (
          <>
            <Box size={[0.8, 0.05, 0.05]} position={[0, 0.25, 0]} color="#b87333" hot={hot('adcs')} />
            <Box size={[0.05, 0.05, 0.8]} position={[0, 0.25, 0]} color="#b87333" hot={hot('adcs')} />
            <Box size={[0.05, 0.6, 0.05]} position={[0, 0.25, 0]} color="#b87333" hot={hot('adcs')} />
          </>
        ) : (
          <>
            <Cylinder radius={0.17} height={0.08} position={[0, 0.25, 0]} color="#aeb8c2" metalness={0.6} hot={hot('adcs')} />
            <Cylinder radius={0.17} height={0.08} position={[0.25, 0.25, 0]} rotation={[0, 0, Math.PI / 2]} color="#aeb8c2" metalness={0.6} hot={hot('adcs')} />
            <Cylinder radius={0.17} height={0.08} position={[0, 0.25, 0.25]} rotation={[Math.PI / 2, 0, 0]} color="#aeb8c2" metalness={0.6} hot={hot('adcs')} />
          </>
        )}
        {ids.adcs === 'adcs-rw-star' ? (
          <Cylinder radius={0.12} height={0.32} position={[0.62, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} color="#2a3038" hot={hot('adcs')} />
        ) : null}
      </Assemble>

      <Assemble key={ids.radio} order={3} from={[5, 0, 0]}>
        {Array.from({ length: ids.radio === 'radio-xband' ? 3 : ids.radio === 'radio-sband' ? 2 : 1 }, (_, i) => (
          <Box key={i} size={[0.78, 0.05, 0.78]} position={[0, 0.85 + i * 0.16, 0]} color="#2f6b4f" hot={hot('radio')} />
        ))}
        {ids.radio === 'radio-xband' ? (
          <Box size={[0.5, 0.12, 0.5]} position={[0, 1.38, 0]} color="#c3ccd5" metalness={0.6} hot={hot('radio')} />
        ) : null}
      </Assemble>

      <Assemble key={ids.power} order={4} from={[0, 0, -5]}>
        {ids.power === 'power-3u-hi' ? (
          <>
            <Wing side={1} hot={hot('power')} />
            <Wing side={-1} hot={hot('power')} />
          </>
        ) : (
          <>
            <Panel width={0.86} height={3} position={[0, 0, 0.52]} hot={hot('power')} />
            <Panel width={0.86} height={3} position={[0, 0, -0.52]} rotation={[0, Math.PI, 0]} hot={hot('power')} />
          </>
        )}
      </Assemble>

      <Assemble key={ids.antenna} order={5} from={[0, 5, 0]}>
        {ids.antenna === 'ant-hga' ? <Dish hot={hot('antenna')} /> : null}
        {ids.antenna === 'ant-patch' ? (
          <Box size={[0.7, 0.04, 0.7]} position={[0, 1.73, 0]} color="#c79a3b" metalness={0.5} hot={hot('antenna')} />
        ) : null}
        {ids.antenna === 'ant-dipole'
          ? [0, Math.PI / 2].map((angle) => (
              <Box key={angle} size={[2.6, 0.02, 0.05]} position={[0, 1.72, 0]} rotation={[0, angle, 0]} color="#d9dee4" hot={hot('antenna')} />
            ))
          : null}
      </Assemble>

      <Assemble key={ids.instrument} order={6} from={[0, -5, 3]}>
        {ids.instrument === 'sensor-therm' ? (
          <>
            <Box size={[0.65, 0.14, 0.45]} position={[0, -1.77, 0]} color="#3a4350" hot={hot('instrument')} />
            {[-0.18, 0, 0.18].map((x) => (
              <Cylinder key={x} radius={0.06} height={0.05} position={[x, -1.86, 0]} color="#0b0f14" hot={hot('instrument')} />
            ))}
          </>
        ) : (
          <>
            <Cylinder
              radius={ids.instrument === 'cam-hr' ? 0.36 : 0.28}
              height={ids.instrument === 'cam-hr' ? 0.8 : 0.4}
              position={[0, ids.instrument === 'cam-hr' ? -2.1 : -1.9, 0]}
              color="#3a4350"
              metalness={0.4}
              hot={hot('instrument')}
            />
            <Cylinder
              radius={ids.instrument === 'cam-hr' ? 0.26 : 0.2}
              height={0.03}
              position={[0, ids.instrument === 'cam-hr' ? -2.51 : -2.11, 0]}
              color="#0b0f14"
              hot={hot('instrument')}
            />
          </>
        )}
      </Assemble>

      {design.beacon ? (
        <Assemble key="beacon" order={7} from={[3, 4, 0]}>
          <Cylinder radius={0.015} height={1.1} position={[0.42, 2.25, 0.42]} color="#d9dee4" />
        </Assemble>
      ) : null}
    </RunContext.Provider>
  );
}

export default function Spacecraft3D({ design, focus, runKey }: { design: Design; focus: DesignSlot | null; runKey: number }) {
  return (
    <Canvas camera={{ position: [4.6, 2.4, 5.6], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={['#0a0e14']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.7} />
      <directionalLight position={[-4, -3, -3]} intensity={0.45} />
      <gridHelper args={[14, 28, '#2f3d4e', '#18212c']} position={[0, -2.75, 0]} />
      {/* A new key remounts every part, so the whole build replays. */}
      <Parts key={runKey} design={design} focus={focus} />
      <Controls minDistance={4.5} maxDistance={14} />
    </Canvas>
  );
}
