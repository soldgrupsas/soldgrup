import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Upload, X, Box } from "lucide-react";
import Model3DViewer from "./Model3DViewer";

interface Model3DUploaderProps {
  onFileSelect: (file: File) => void;
  preview?: File | string;
  onRemove: () => void;
}

const Model3DUploader = ({ onFileSelect, preview, onRemove }: Model3DUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [".glb", ".gltf"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert("Por favor, selecciona un archivo GLB o GLTF válido.");
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      alert("El archivo es demasiado grande. El tamaño máximo es 50MB.");
      return;
    }

    onFileSelect(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getPreviewUrl = () => {
    if (!preview) return null;
    if (typeof preview === "string") return preview;
    return URL.createObjectURL(preview);
  };

  const previewUrl = getPreviewUrl();

  return (
    <div className="space-y-4">
      {!preview ? (
        <Card className="p-8 border-dashed border-2 hover:border-primary/50 transition-colors">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Box className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Subir Modelo 3D</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Formatos: GLB, GLTF • Tamaño máximo: 50MB
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Seleccionar archivo
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {preview instanceof File ? preview.name : "Modelo 3D"}
                  </p>
                  {preview instanceof File && (
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(preview.size)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
          
          {previewUrl && (
            <div>
              <Label className="mb-2 block">Vista Previa del Modelo 3D</Label>
              <Model3DViewer
                modelUrl={previewUrl}
                height="400px"
                enableZoom={true}
                enablePan={true}
                autoRotate={true}
              />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                🔄 El modelo rota automáticamente • Click + arrastrar para control manual • Scroll para zoom
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Model3DUploader;
