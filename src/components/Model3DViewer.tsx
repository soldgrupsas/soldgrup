import { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, PerspectiveCamera, Environment } from "@react-three/drei";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";

interface Model3DViewerProps {
  modelUrl: string;
  height?: string;
  enableZoom?: boolean;
  enablePan?: boolean;
  autoRotate?: boolean;
}

function Model({ url, onError }: { url: string; onError: (error: any) => void }) {
  try {
    const { scene } = useGLTF(url, true);
    return <primitive object={scene} />;
  } catch (error) {
    console.error("Error loading 3D model:", error);
    onError(error);
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
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.log('🔍 Model3DViewer - Intentando cargar modelo:', modelUrl);
    setLoadingState('loading');
  }, [modelUrl]);

  const handleError = (error: any) => {
    console.error('❌ Error al cargar modelo 3D:', error);
    console.error('🔗 URL del modelo:', modelUrl);
    setLoadingState('error');
    setErrorMessage(error?.message || 'Error desconocido al cargar el modelo');
  };

  const handleSuccess = () => {
    console.log('✅ Modelo 3D cargado exitosamente');
    setLoadingState('success');
  };

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden border border-border relative">
      {loadingState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando modelo 3D...</p>
        </div>
      )}
      
      {loadingState === 'error' ? (
        <div className="flex flex-col items-center justify-center h-full bg-muted/50 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error al cargar el modelo 3D</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No se pudo cargar el modelo 3D. Esto puede deberse a:
          </p>
          <ul className="text-xs text-muted-foreground text-left space-y-2 mb-4">
            <li>• El archivo no existe o no es accesible</li>
            <li>• Configuración CORS incorrecta en Supabase Storage</li>
            <li>• Formato de archivo incompatible (debe ser .glb o .gltf)</li>
            <li>• Archivo corrupto o demasiado grande</li>
          </ul>
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-primary hover:underline mb-2"
          >
            {showDetails ? 'Ocultar' : 'Mostrar'} detalles técnicos
          </button>
          {showDetails && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded mt-2 max-w-full overflow-x-auto">
              <p className="font-mono break-all"><strong>URL:</strong> {modelUrl}</p>
              {errorMessage && <p className="mt-2"><strong>Error:</strong> {errorMessage}</p>}
            </div>
          )}
        </div>
      ) : (
        <Canvas shadows onError={handleError}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <Suspense
            fallback={
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="gray" wireframe />
              </mesh>
            }
          >
            <Model url={modelUrl} onError={handleError} />
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
            onEnd={handleSuccess}
          />
        </Canvas>
      )}
    </div>
  );
};

export default Model3DViewer;
