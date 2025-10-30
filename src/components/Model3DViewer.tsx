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
  const [retryCount, setRetryCount] = useState(0);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoadRef = useRef(true);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('🔍 Model3DViewer - Intentando cargar modelo:', modelUrl);
    setLoadingState('loading');
    setErrorMessage('');
    setLoadingProgress(0);
    setScene(null);
    setRetryCount(0);

    // Validar URL antes de intentar cargar
    if (!modelUrl || modelUrl.trim() === '') {
      console.error('❌ URL del modelo está vacía');
      setLoadingState('error');
      setErrorMessage('La URL del modelo 3D está vacía. Por favor, proporciona una URL válida.');
      return;
    }

    // Validar extensión solo para URLs remotas (blob URLs ya fueron validados en uploader)
    if (!modelUrl.startsWith('blob:')) {
      const fileExtension = modelUrl.split('.').pop()?.toLowerCase();
      if (!fileExtension || !['glb', 'gltf'].includes(fileExtension)) {
        console.error('❌ Extensión de archivo no válida:', fileExtension);
        setLoadingState('error');
        setErrorMessage(`Formato de archivo no soportado (.${fileExtension}). Solo se permiten archivos .glb o .gltf`);
        return;
      }
      console.log('✅ URL validada correctamente:', { extension: fileExtension, url: modelUrl });
    }

    const loader = new GLTFLoader();
    loaderRef.current = loader;

    // Configurar crossOrigin para permitir carga desde diferentes dominios
    (loader as any).setCrossOrigin?.('anonymous');

    // Configurar resourcePath para archivos .gltf que referencian otros recursos
    const basePath = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
    if (modelUrl.toLowerCase().endsWith('.gltf')) {
      (loader as any).setResourcePath?.(basePath);
    }

    // Timeout de 60 segundos para archivos grandes
    timeoutRef.current = setTimeout(() => {
      console.error('⏱️ Timeout: El modelo tardó más de 60 segundos en cargar');
      setLoadingState('error');
      setErrorMessage('⏱️ Tiempo de carga agotado (60s). El archivo puede ser muy grande (20MB+) o la conexión muy lenta. Intenta descargar el archivo.');
    }, 60000);

    // Callbacks para GLTFLoader
    const onLoad = (gltf: any) => {
      console.log('✅ Modelo 3D cargado exitosamente');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      // Calcular bounding box y centrar modelo
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // Validar que el bounding box sea válido
      if (size.x === 0 || size.y === 0 || size.z === 0) {
        console.warn('⚠️ Bounding box inválido, usando valores por defecto');
        setScene(gltf.scene);
        setLoadingState('success');
        setLoadingProgress(100);
        return;
      }
      
      // Calcular escala para que quepa en la vista (más conservador)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 3 / maxDim : 1; // Cambiar de 4 a 3 para dar más padding
      
      // Aplicar transformaciones
      gltf.scene.scale.setScalar(scale);
      gltf.scene.position.x = -center.x * scale;
      gltf.scene.position.y = -center.y * scale;
      gltf.scene.position.z = -center.z * scale;
      
      console.log('📐 Modelo centrado y escalado:', {
        originalSize: size,
        scale: scale,
        center: center,
        newPosition: gltf.scene.position
      });
      
      // Usar doble requestAnimationFrame para asegurar que las transformaciones se aplicaron
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setScene(gltf.scene);
          setLoadingState('success');
          setLoadingProgress(100);
          isFirstLoadRef.current = false;
        });
      });
    };

    const onProgress = (progress: any) => {
      if (progress.lengthComputable) {
        const percentComplete = (progress.loaded / progress.total) * 100;
        setLoadingProgress(Math.round(percentComplete));
        console.log(`📊 Progreso de carga: ${Math.round(percentComplete)}%`);
      }
    };

    const onError = (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      const isPublicUrl = modelUrl.startsWith('http');
      
      // Diagnóstico detallado
      const diagnosticInfo = {
        url: modelUrl,
        isPublicUrl,
        timestamp: new Date().toISOString(),
        errorType: errorMsg,
        retryAttempt: retryCount
      };
      
      console.error('❌ Error al cargar modelo 3D:', error);
      console.error('🔍 Diagnóstico completo:', diagnosticInfo);
      
      // Detectar errores específicos que NO deben reintentar
      let shouldRetry = true;
      let userFriendlyMessage = errorMsg;
      
      if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
        userFriendlyMessage = '❌ Archivo no encontrado (404). El modelo 3D no existe en el servidor.';
        shouldRetry = false;
      } else if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
        userFriendlyMessage = '🚫 Acceso denegado (403). No tienes permisos para ver este archivo.';
        shouldRetry = false;
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch')) {
        userFriendlyMessage = '🌐 Error de red: No se pudo descargar el archivo. Archivo grande (20MB+) o conexión lenta.';
      } else if (errorMsg.includes('NetworkError') || errorMsg.includes('Network')) {
        userFriendlyMessage = '📡 Error de conexión: La descarga fue bloqueada o interrumpida.';
      } else if (errorMsg.includes('parse') || errorMsg.includes('invalid')) {
        userFriendlyMessage = '⚠️ Archivo corrupto: El modelo 3D no se pudo interpretar.';
        shouldRetry = false;
      }
      
      // Lógica de retry mejorada
      if (shouldRetry && retryCount < 2) {
        const nextRetry = retryCount + 1;
        const waitTime = 3000 * nextRetry; // 3s, 6s
        console.log(`🔄 Reintento ${nextRetry}/2 en ${waitTime}ms...`);
        
        setTimeout(() => {
          setRetryCount(nextRetry);
          // NO resetear progress para mantener feedback visual
        }, waitTime);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setLoadingState('error');
        setErrorMessage(userFriendlyMessage);
      }
    };

    // Si es URL remota, hacer fetch manual primero
    if (modelUrl.startsWith('http')) {
      console.log('🌐 Descargando modelo remoto con fetch()...');
      
      fetch(modelUrl, { mode: 'cors' })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const contentLength = response.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          
          if (total > 0) {
            const sizeMB = (total / (1024 * 1024)).toFixed(2);
            console.log(`📦 Tamaño del archivo: ${sizeMB}MB`);
          }
          
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No se pudo leer el archivo');
          
          let receivedLength = 0;
          const chunks: Uint8Array[] = [];
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (total > 0) {
              const progress = (receivedLength / total) * 100;
              setLoadingProgress(Math.round(progress));
              console.log(`📥 Descargado: ${Math.round(progress)}%`);
            }
          }
          
          // Convertir chunks a Blob
          const blob = new Blob(chunks as BlobPart[], { type: 'model/gltf-binary' });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          
          console.log('✅ Archivo descargado, convirtiendo a blob:', blobUrl);
          
          // Ahora cargar con GLTFLoader usando la blob URL
          loader.load(blobUrl, onLoad, onProgress, onError);
        })
        .catch((error) => {
          console.error('❌ Error en fetch():', error);
          onError(error);
        });
    } else {
      // URL local (blob: o file:), cargar directamente
      loader.load(modelUrl, onLoad, onProgress, onError);
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      loaderRef.current = null;
      
      // Limpiar blob URL si existe
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      
      // Liberar memoria del scene anterior
      if (scene) {
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            // Liberar geometría
            if (object.geometry) {
              object.geometry.dispose();
            }
            
            // Liberar materiales (puede ser array o individual)
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material) => {
                  if (material.map) material.map.dispose();
                  if (material.lightMap) material.lightMap.dispose();
                  if (material.bumpMap) material.bumpMap.dispose();
                  if (material.normalMap) material.normalMap.dispose();
                  if (material.specularMap) material.specularMap.dispose();
                  if (material.envMap) material.envMap.dispose();
                  material.dispose();
                });
              } else {
                if (object.material.map) object.material.map.dispose();
                if (object.material.lightMap) object.material.lightMap.dispose();
                if (object.material.bumpMap) object.material.bumpMap.dispose();
                if (object.material.normalMap) object.material.normalMap.dispose();
                if (object.material.specularMap) object.material.specularMap.dispose();
                if (object.material.envMap) object.material.envMap.dispose();
                object.material.dispose();
              }
            }
          }
        });
      }
    };
  }, [modelUrl, retryCount]);

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
