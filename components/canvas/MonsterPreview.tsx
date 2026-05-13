"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { MonsterMesh } from "./MonsterMesh";
import { getMonsterDef } from "@/lib/monsters/definitions";
import type { MonsterId } from "@/lib/battle/types";

/**
 * 1 体だけのねこをカメラ正面に置いてゆっくり回す。
 * モーダルで使う単体プレビュー用。
 */
export function MonsterPreview({ defId }: { defId: MonsterId }) {
  const def = getMonsterDef(defId);
  return (
    <Canvas shadows className="!h-full !w-full">
      <PerspectiveCamera makeDefault fov={38} position={[0, 1.8, 4.8]} />
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.2}
        target={[0, 1.0, 0]}
        minDistance={3}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2}
      />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[3, 5, 3]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} color="#9bb6ff" />
      {/* 床（影を受ける用、控えめ） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#191e2c" roughness={1} />
      </mesh>
      <MonsterMesh def={def} position={[0, 0, 0]} facing="front" />
    </Canvas>
  );
}
