import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from "@react-three/drei";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Model3DViewerProps {
  modelUrl: string;
  height?: string;
  enableZoom?: boolean;
  enablePan?: boolean;
  autoRotate?: boolean;
}

function Model({ url }: { url: string }) {
  try {
    const { scene } = useGLTF(url, true);
    return <primitive object={scene} />;
  } catch (error) {
    console.error("Error loading 3D model:", error);
    return null;
  }
}

const Model3DViewer = ({
  modelUrl,
  height = "500px",
  enableZoom = true,
  enablePan = true,
  autoRotate = false,
}: Model3DViewerProps) => {
  const [error, setError] = useState(false);

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden border border-border">
      {error ? (
        <div className="flex flex-col items-center justify-center h-full bg-muted/50 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error al cargar el modelo 3D</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No se pudo cargar el modelo 3D. Por favor, verifica que el archivo existe y es accesible.
          </p>
          <p className="text-xs text-muted-foreground">
            Nota: Asegúrate de que el bucket de Supabase tiene configuración CORS correcta.
          </p>
        </div>
      ) : (
        <Canvas shadows onError={() => setError(true)}>
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
      )}
    </div>
  );
};

export default Model3DViewer;
