import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as THREE from "three";
import { AlertCircle, Loader2, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Model3DViewerProps {
  modelUrl: string;
  height?: string;
  enableZoom?: boolean;
  enablePan?: boolean;
  autoRotate?: boolean;
}

function Model({ scene }: { scene: THREE.Group | null }) {
  if (!scene) return null;
  return <primitive object={scene} />;
}

const Model3DViewer = ({
  modelUrl,
  height = "500px",
  enableZoom = true,
  enablePan = true,
  autoRotate = false,
}: Model3DViewerProps) => {
  const { toast } = useToast();
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🔍 Model3DViewer - Intentando cargar modelo:', modelUrl);
    setLoadingState('loading');
    setErrorMessage('');
    setLoadingProgress(0);
    setScene(null);

    const loader = new GLTFLoader();
    loaderRef.current = loader;

    // Configurar crossOrigin para permitir carga desde diferentes dominios
    (loader as any).setCrossOrigin?.('anonymous');

    // Configurar resourcePath para archivos .gltf que referencian otros recursos
    const basePath = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
    if (modelUrl.toLowerCase().endsWith('.gltf')) {
      (loader as any).setResourcePath?.(basePath);
    }

    // Timeout de 30 segundos para evitar carga infinita
    timeoutRef.current = setTimeout(() => {
      console.error('⏱️ Timeout: El modelo tardó más de 30 segundos en cargar');
      setLoadingState('error');
      setErrorMessage('Tiempo de carga agotado (30s). El archivo puede ser demasiado grande o no estar accesible.');
    }, 30000);

    loader.load(
      modelUrl,
      // onLoad
      (gltf) => {
        console.log('✅ Modelo 3D cargado exitosamente');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setScene(gltf.scene);
        setLoadingState('success');
        setLoadingProgress(100);
      },
      // onProgress
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          setLoadingProgress(Math.round(percentComplete));
          console.log(`📊 Progreso de carga: ${Math.round(percentComplete)}%`);
        }
      },
      // onError
      (error: unknown) => {
        console.error('❌ Error al cargar modelo 3D:', error);
        console.error('🔗 URL del modelo:', modelUrl);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoadingState('error');
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido al cargar el modelo';
        setErrorMessage(errorMsg);
      }
    );

    // Cleanup
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      loaderRef.current = null;
    };
  }, [modelUrl]);

  const handleOpenInNewTab = () => {
    window.open(modelUrl, '_blank');
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(modelUrl);
      toast({
        title: "URL copiada",
        description: "La URL del modelo se copió al portapapeles",
      });
    } catch (err) {
      console.error('Error al copiar URL:', err);
    }
  };

  return (
    <div style={{ height, width: "100%" }} className="rounded-lg overflow-hidden border border-border relative">
      {loadingState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
          <p className="text-sm text-muted-foreground mb-2">Cargando modelo 3D...</p>
          {loadingProgress > 0 && (
            <p className="text-xs text-muted-foreground">{loadingProgress}%</p>
          )}
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
            <li>• El archivo no existe o no es accesible desde este dominio</li>
            <li>• Problemas de conectividad o permisos de almacenamiento</li>
            <li>• Formato de archivo incompatible (debe ser .glb o .gltf)</li>
            <li>• Archivo corrupto o demasiado grande (límite 50MB)</li>
          </ul>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-2 text-xs bg-primary text-primary-foreground px-3 py-2 rounded hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir en nueva pestaña
            </button>
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-2 text-xs bg-secondary text-secondary-foreground px-3 py-2 rounded hover:bg-secondary/90 transition-colors"
            >
              <Copy className="h-3 w-3" />
              Copiar URL
            </button>
          </div>
          
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
              <p className="mt-2"><strong>Extensión:</strong> {modelUrl.split('.').pop()?.toUpperCase()}</p>
            </div>
          )}
        </div>
      ) : (
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <Model scene={scene} />
          <Environment preset="studio" />
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
