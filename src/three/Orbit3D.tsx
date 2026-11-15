/**
 * The mission in orbit. Earth carries NASA GIBS Blue Marble imagery and turns with
 * real sidereal time; the Sun direction lights the real terminator; the spacecraft
 * and its path come from SGP4 on the reference element set. Distances are to
 * scale; the spacecraft itself is not.
 */
import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { gstime, propagate } from 'satellite.js';
import bundledEarth from '../assets/earth-bluemarble.jpg';
import { STATIONS } from '../sim/catalogue';
import { createSatrec, dateAt, orbitalPeriodMinutes, sunUnitEci } from '../sim/orbit';
import type { GpElements } from '../sim/types';
import { Controls } from './shared';

const EARTH_KM = 6378.137;
/** NASA GIBS WMS, whole globe in plate carrée: the layout three.js spheres expect. */
export const GIBS_EARTH_URL =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0' +
  '&LAYERS=BlueMarble_ShadedRelief_Bathymetry&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg';

export type EarthSource = 'loading' | 'live' | 'bundled';

/** ECI/ECEF (z = north) to three.js (y = up). Matches SphereGeometry's UV layout. */
function toScene(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x / EARTH_KM, z / EARTH_KM, -y / EARTH_KM);
}

function stationLocal(latDeg: number, lonDeg: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)).multiplyScalar(1.004);
}

function lineOf(points: THREE.Vector3[], color: string, opacity: number): THREE.Line {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}

function useDisposable<T extends THREE.Line | THREE.LineSegments>(object: T): T {
  useEffect(
    () => () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    },
    [object],
  );
  return object;
}

/** Graticule every 30°, the reference grid a diagram needs. */
function Graticule() {
  const lines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const r = 1.003;
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon < 360; lon += 5) {
        points.push(stationLocal(lat, lon).setLength(r), stationLocal(lat, lon + 5).setLength(r));
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      for (let lat = -90; lat < 90; lat += 5) {
        points.push(stationLocal(lat, lon).setLength(r), stationLocal(lat + 5, lon).setLength(r));
      }
    }
    return new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.14 }),
    );
  }, []);
  return <primitive object={useDisposable(lines)} />;
}

function Earth({ onSource }: { onSource: (source: EarthSource) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    const accept = (source: EarthSource) => (tex: THREE.Texture) => {
      if (cancelled) return tex.dispose();
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      setTexture(tex);
      onSource(source);
    };
    onSource('loading');
    // Live NASA imagery first; the bundled copy of the same layer keeps it working offline.
    loader.load(GIBS_EARTH_URL, accept('live'), undefined, () => loader.load(bundledEarth, accept('bundled')));
    return () => {
      cancelled = true;
    };
  }, [onSource]);

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <mesh>
      <sphereGeometry args={[1, 96, 64]} />
      <meshStandardMaterial key={texture ? 'tex' : 'flat'} map={texture} color={texture ? '#ffffff' : '#1d3550'} roughness={0.9} />
    </mesh>
  );
}

function Satellite({ position, inSunlight }: { position: THREE.Vector3; inSunlight: boolean }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.025, 0.025, 0.06]} />
        <meshBasicMaterial color={inSunlight ? '#ffb648' : '#8a6a3a'} />
      </mesh>
      <mesh position={[0.045, 0, 0]}>
        <boxGeometry args={[0.06, 0.002, 0.05]} />
        <meshBasicMaterial color="#7fa3d1" />
      </mesh>
      <mesh position={[-0.045, 0, 0]}>
        <boxGeometry args={[0.06, 0.002, 0.05]} />
        <meshBasicMaterial color="#7fa3d1" />
      </mesh>
    </group>
  );
}

export default function Orbit3D({
  reference,
  tSec,
  inSunlight,
  contactStation,
  onEarthSource,
}: {
  reference: GpElements;
  tSec: number;
  inSunlight: boolean;
  contactStation: string | null;
  onEarthSource: (source: EarthSource) => void;
}) {
  const satrec = useMemo(() => createSatrec(reference), [reference]);
  const date = dateAt(reference.epochUtc, tSec);
  const gmst = gstime(date);

  const pv = propagate(satrec, date);
  const satellite = pv && Number.isFinite(pv.position.x) ? toScene(pv.position.x, pv.position.y, pv.position.z) : null;

  // Path: the last 25 minutes travelled and one full orbit ahead. Rebuilt every 2 mission-minutes.
  const bucket = Math.floor(tSec / 120) * 120;
  const { trail, ahead } = useMemo(() => {
    const periodSec = orbitalPeriodMinutes(reference) * 60;
    const sample = (from: number, to: number) => {
      const points: THREE.Vector3[] = [];
      for (let t = from; t <= to; t += 30) {
        const p = propagate(satrec, dateAt(reference.epochUtc, t));
        if (p && Number.isFinite(p.position.x)) points.push(toScene(p.position.x, p.position.y, p.position.z));
      }
      return points;
    };
    return {
      trail: lineOf(sample(Math.max(0, bucket - 1500), bucket + 120), '#ffb648', 0.9),
      ahead: lineOf(sample(bucket, bucket + periodSec), '#cfe3ff', 0.32),
    };
  }, [satrec, reference, bucket]);
  useDisposable(trail);
  useDisposable(ahead);

  const sun = sunUnitEci(date);
  const sunDir = toScene(sun.x * EARTH_KM * 12, sun.y * EARTH_KM * 12, sun.z * EARTH_KM * 12);

  const station = STATIONS.find((entry) => entry.name === contactStation) ?? null;
  const beam = useMemo(() => {
    if (!station || !satellite) return null;
    const ground = stationLocal(station.latDeg, station.lonDeg).applyAxisAngle(new THREE.Vector3(0, 1, 0), gmst);
    return lineOf([ground, satellite], '#4ad991', 0.9);
  }, [station, satellite?.x, satellite?.y, satellite?.z, gmst]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (beam) {
      beam.geometry.dispose();
      (beam.material as THREE.Material).dispose();
    }
  }, [beam]);

  return (
    <Canvas camera={{ position: [0.6, 1.4, 3.4], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={['#05080d']} />
      <ambientLight intensity={0.12} />
      <directionalLight position={sunDir} intensity={2.4} />
      <group rotation={[0, gmst, 0]}>
        <Earth onSource={onEarthSource} />
        <Graticule />
        {STATIONS.map((entry) => (
          <mesh key={entry.id} position={stationLocal(entry.latDeg, entry.lonDeg)}>
            <sphereGeometry args={[0.014, 12, 8]} />
            <meshBasicMaterial color={entry.name === contactStation ? '#4ad991' : '#e6edf5'} />
          </mesh>
        ))}
      </group>
      <primitive object={ahead} />
      <primitive object={trail} />
      {beam ? <primitive object={beam} /> : null}
      {satellite ? <Satellite position={satellite} inSunlight={inSunlight} /> : null}
      <Controls minDistance={1.6} maxDistance={8} autoRotate={false} zoom />
    </Canvas>
  );
}
