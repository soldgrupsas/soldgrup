import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from "@react-three/drei";
import { Card } from "@/components/ui/card";

interface Model3DViewerProps {
  modelUrl: string;
  height?: string;
  enableZoom?: boolean;
  enablePan?: boolean;
  autoRotate?: boolean;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

const Model3DViewer = ({
  modelUrl,
  height = "500px",
  enableZoom = true,
  enablePan = true,
  autoRotate = false,
}: Model3DViewerProps) => {
  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden border border-border">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="gray" wireframe />
            </mesh>
          }
        >
          <Model url={modelUrl} />
          <Environment preset="studio" />
        </Suspense>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <OrbitControls
          enableZoom={enableZoom}
          enablePan={enablePan}
          autoRotate={autoRotate}
          autoRotateSpeed={2}
          minDistance={1}
          maxDistance={20}
        />
      </Canvas>
    </div>
  );
};

export default Model3DViewer;
