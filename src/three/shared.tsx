/**
 * Small pieces shared by the 3D views: camera controls and crisp edge outlines.
 */
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Drag to orbit. Auto-rotates until the user grabs it. */
export function Controls({
  target = [0, 0, 0],
  minDistance = 2,
  maxDistance = 20,
  autoRotate = true,
  zoom = false,
}: {
  target?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  autoRotate?: boolean;
  /** Off by default: a captured scroll wheel stops the page from scrolling. */
  zoom?: boolean;
}) {
  const { camera, gl } = useThree();
  const [tx, ty, tz] = target;

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(tx, ty, tz);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = zoom;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    const stop = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stop);
    let frame = 0;
    const tick = () => {
      controls.update();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.removeEventListener('start', stop);
      controls.dispose();
    };
  }, [camera, gl, tx, ty, tz, minDistance, maxDistance, autoRotate, zoom]);

  return null;
}

/** Hard outline of a geometry: the diagram look instead of glossy shading. */
export function Edges({
  geometry,
  color = '#c9d6e3',
  opacity = 1,
}: {
  geometry: THREE.BufferGeometry;
  color?: string;
  opacity?: number;
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 20), [geometry]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </lineSegments>
  );
}
