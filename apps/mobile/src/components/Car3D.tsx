import { Canvas, useFrame, useLoader } from "@react-three/fiber/native";
import { Component, Suspense, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SketchfabViewer } from "@/components/SketchfabViewer";
import type { BodyType, Model3D } from "@/lib/types";

/**
 * 3D view of the user's car.
 * - model3d.kind === "glb": real model of that make/model, repainted.
 * - model3d.kind === "procedural": generic car of the right body type.
 * Drag horizontally to turn the car; it turns slowly on its own otherwise.
 */

interface Shape {
  length: number;
  width: number;
  bodyHeight: number;
  cabinHeight: number;
  cabinLength: number;
  cabinOffset: number; // + towards the back
  wheelRadius: number;
  clearance: number;
  openBed?: boolean; // pickup
  noRoof?: boolean; // convertible
}

const SHAPES: Record<BodyType, Shape> = {
  sedan: { length: 4.6, width: 1.8, bodyHeight: 0.65, cabinHeight: 0.55, cabinLength: 2.4, cabinOffset: 0.1, wheelRadius: 0.33, clearance: 0.18 },
  hatchback: { length: 4.1, width: 1.78, bodyHeight: 0.65, cabinHeight: 0.6, cabinLength: 2.3, cabinOffset: 0.45, wheelRadius: 0.32, clearance: 0.17 },
  coupe: { length: 4.5, width: 1.82, bodyHeight: 0.6, cabinHeight: 0.45, cabinLength: 2.0, cabinOffset: 0.25, wheelRadius: 0.34, clearance: 0.14 },
  convertible: { length: 4.4, width: 1.8, bodyHeight: 0.6, cabinHeight: 0.3, cabinLength: 1.6, cabinOffset: 0.2, wheelRadius: 0.33, clearance: 0.14, noRoof: true },
  wagon: { length: 4.7, width: 1.82, bodyHeight: 0.66, cabinHeight: 0.58, cabinLength: 2.9, cabinOffset: 0.45, wheelRadius: 0.33, clearance: 0.17 },
  suv: { length: 4.6, width: 1.9, bodyHeight: 0.85, cabinHeight: 0.65, cabinLength: 2.8, cabinOffset: 0.3, wheelRadius: 0.4, clearance: 0.24 },
  pickup: { length: 5.3, width: 1.95, bodyHeight: 0.9, cabinHeight: 0.7, cabinLength: 1.9, cabinOffset: -0.5, wheelRadius: 0.42, clearance: 0.28, openBed: true },
  van: { length: 5.0, width: 2.0, bodyHeight: 1.1, cabinHeight: 0.95, cabinLength: 4.0, cabinOffset: 0.4, wheelRadius: 0.36, clearance: 0.2 },
  minivan: { length: 4.9, width: 1.92, bodyHeight: 0.85, cabinHeight: 0.8, cabinLength: 3.6, cabinOffset: 0.35, wheelRadius: 0.35, clearance: 0.18 },
  other: { length: 4.5, width: 1.8, bodyHeight: 0.7, cabinHeight: 0.55, cabinLength: 2.4, cabinOffset: 0.2, wheelRadius: 0.34, clearance: 0.18 },
};

function ProceduralCar({ bodyType, color }: { bodyType: BodyType; color: string }) {
  const s = SHAPES[bodyType] ?? SHAPES.other;
  const paint = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32 }),
    [color],
  );
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1d2733", metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.85 }),
    [],
  );
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 }), []);
  const rim = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b9bec4", metalness: 0.9, roughness: 0.25 }), []);
  const light = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff6d8", emissive: "#fff2c0", emissiveIntensity: 0.6 }), []);
  const rear = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a0f12", emissive: "#5a0000", emissiveIntensity: 0.5 }), []);

  const bodyY = s.clearance + s.wheelRadius * 0.6 + s.bodyHeight / 2;
  const cabinY = bodyY + s.bodyHeight / 2 + s.cabinHeight / 2;
  const axle = s.length / 2 - s.wheelRadius * 1.9;
  const wheelX = s.width / 2 - 0.12;
  const wheels: Array<[number, number]> = [
    [wheelX, axle], [-wheelX, axle], [wheelX, -axle], [-wheelX, -axle],
  ];

  return (
    <group position={[0, 0, 0]}>
      {/* Lower body */}
      <mesh material={paint} position={[0, bodyY, 0]}>
        <boxGeometry args={[s.width, s.bodyHeight, s.length]} />
      </mesh>

      {/* Cabin: painted pillars + glass band */}
      {!s.noRoof && (
        <group position={[0, cabinY, s.cabinOffset]}>
          <mesh material={glass}>
            <boxGeometry args={[s.width * 0.88, s.cabinHeight * 0.9, s.cabinLength]} />
          </mesh>
          <mesh material={paint} position={[0, s.cabinHeight / 2 - 0.03, 0]}>
            <boxGeometry args={[s.width * 0.86, 0.06, s.cabinLength * 0.92]} />
          </mesh>
        </group>
      )}
      {s.noRoof && (
        <mesh material={glass} position={[0, cabinY - 0.05, s.cabinOffset - s.cabinLength / 2]} rotation={[-0.35, 0, 0]}>
          <boxGeometry args={[s.width * 0.85, s.cabinHeight, 0.05]} />
        </mesh>
      )}

      {/* Pickup bed walls */}
      {s.openBed && (
        <mesh material={paint} position={[0, bodyY + s.bodyHeight / 2 + 0.12, s.cabinOffset + s.cabinLength / 2 + 0.95]}>
          <boxGeometry args={[s.width, 0.24, 1.7]} />
        </mesh>
      )}

      {/* Lights */}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh material={light} position={[side * (s.width / 2 - 0.28), bodyY + s.bodyHeight * 0.2, -s.length / 2 - 0.01]}>
            <boxGeometry args={[0.38, 0.12, 0.02]} />
          </mesh>
          <mesh material={rear} position={[side * (s.width / 2 - 0.25), bodyY + s.bodyHeight * 0.2, s.length / 2 + 0.01]}>
            <boxGeometry args={[0.32, 0.12, 0.02]} />
          </mesh>
        </group>
      ))}

      {/* Wheels */}
      {wheels.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, s.wheelRadius, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={tire}>
            <cylinderGeometry args={[s.wheelRadius, s.wheelRadius, 0.24, 28]} />
          </mesh>
          <mesh material={rim} position={[0, Math.sign(x) * 0.121, 0]}>
            <cylinderGeometry args={[s.wheelRadius * 0.6, s.wheelRadius * 0.6, 0.01, 20]} />
          </mesh>
        </group>
      ))}

      {/* Soft ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[s.length * 0.62, 48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/** Falls back to the generic car if the real model cannot be downloaded or parsed. */
class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Body paint materials are repainted with the user's color (names vary by author). */
const PAINT_MATERIAL = /paint|carpaint|body|lack|vernice|carrosserie/i;
const NOT_PAINT = /glass|window|chrome|tyre|tire|rubber|light|lamp|interior|seat|plastic|black/i;

/** Real model of the car. */
function GlbCar({ url, color }: { url: string; color: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m, i) => {
        if (PAINT_MATERIAL.test(m.name) && !NOT_PAINT.test(m.name) && m instanceof THREE.MeshStandardMaterial) {
          const repainted = m.clone();
          repainted.color.set(color);
          if (Array.isArray(mesh.material)) mesh.material[i] = repainted;
          else mesh.material = repainted;
        }
      });
    });
    // Center the model on the ground and scale it to about 4.5 m long.
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scale = 4.5 / Math.max(size.x, size.z, 0.001);
    clone.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return clone;
  }, [gltf, color]);
  return <primitive object={scene} />;
}

function Turntable({
  yaw,
  dragging,
  children,
}: {
  yaw: MutableRefObject<number>;
  dragging: MutableRefObject<boolean>;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    if (!dragging.current) yaw.current += delta * 0.25;
    group.current.rotation.y = yaw.current;
  });
  return <group ref={group}>{children}</group>;
}

/** Picks the best available view: Sketchfab model, own GLB, or generic car. */
export function Car3D({ model3d, color, height = 280 }: { model3d: Model3D | null; color: string; height?: number }) {
  const [viewerFailed, setViewerFailed] = useState(false);
  if (model3d?.kind === "sketchfab" && !viewerFailed) {
    return <SketchfabViewer uid={model3d.uid} color={color} height={height} onError={() => setViewerFailed(true)} />;
  }
  const fallback: Model3D | null =
    model3d?.kind === "sketchfab" ? { kind: "procedural", bodyType: model3d.bodyType } : model3d;
  return <Car3DCanvas model3d={fallback} color={color} height={height} />;
}

function Car3DCanvas({ model3d, color, height }: { model3d: Model3D | null; color: string; height: number }) {
  const yaw = useRef(-0.6);
  const startYaw = useRef(0);
  const dragging = useRef(false);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          dragging.current = true;
          startYaw.current = yaw.current;
        },
        onPanResponderRelease: () => {
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
        onPanResponderMove: (_, g) => {
          yaw.current = startYaw.current + g.dx * 0.01;
        },
      }),
    [],
  );

  const model: Model3D =
    model3d && model3d.kind !== "sketchfab" ? model3d : { kind: "procedural", bodyType: model3d?.bodyType ?? "sedan" };

  return (
    <View style={[styles.container, { height }]} {...pan.panHandlers}>
      <Canvas camera={{ position: [6.2, 3.0, 6.2], fov: 35 }} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={1.6} />
        <directionalLight position={[-6, 4, -4]} intensity={0.6} />
        <Suspense fallback={null}>
          <Turntable yaw={yaw} dragging={dragging}>
            {model.kind === "glb" ? (
              <ModelErrorBoundary fallback={<ProceduralCar bodyType="hatchback" color={color} />}>
                <GlbCar url={model.url} color={color} />
              </ModelErrorBoundary>
            ) : (
              <ProceduralCar bodyType={model.bodyType} color={color} />
            )}
          </Turntable>
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", borderRadius: 16, overflow: "hidden" },
});
