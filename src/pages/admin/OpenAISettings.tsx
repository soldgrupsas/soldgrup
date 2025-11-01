import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type KeyMetadata = {
  key_exists: boolean;
  key_suffix: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
} | null;

const OpenAISettings = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, isAdminLoading } = useAuth();
  const { toast } = useToast();
  const [metadata, setMetadata] = useState<KeyMetadata>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setMetadataError(null);

    try {
      const { data, error } = await supabase.functions.invoke<{
        data: KeyMetadata;
      }>("admin-openai-key", {
        body: { action: "get" },
      });

      if (error) {
        throw new Error(error.message || "No se pudo obtener el estado de la clave");
      }

      setMetadata(data?.data ?? null);
    } catch (error: any) {
      console.error("Error loading OpenAI key metadata:", error);
      const message =
        error?.message ??
        "No pudimos consultar el estado actual de la clave de OpenAI. Intenta de nuevo en unos segundos.";
      setMetadataError(message);
      toast({
        title: "No se pudo cargar la información",
        description: message,
        variant: "destructive",
      });
    } finally {
      setMetadataLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!loading && !isAdminLoading && !isAdmin) {
      toast({
        title: "Acceso restringido",
        description: "Esta sección está restringida a administradores de la plataforma",
        variant: "destructive",
      });
      navigate("/home");
    }
  }, [isAdmin, loading, navigate, toast]);

  useEffect(() => {
    if (!loading && !isAdminLoading && isAdmin) {
      loadMetadata();
    }
  }, [isAdmin, isAdminLoading, loadMetadata, loading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      toast({
        title: "Clave inválida",
        description: "Ingresa la clave de OpenAI que deseas registrar.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        message?: string;
        data: KeyMetadata;
      }>("admin-openai-key", {
        body: { action: "set", apiKey: trimmedKey },
      });

      if (error) {
        throw new Error(error.message || "No se pudo guardar la clave de OpenAI");
      }

      setApiKey("");
      setMetadata(data?.data ?? null);
      toast({
        title: "Clave actualizada",
        description: data?.message ?? "La clave de OpenAI se guardó correctamente.",
      });
    } catch (error: any) {
      console.error("Error saving OpenAI key:", error);
      toast({
        title: "Error al guardar",
        description:
          error?.message ?? "No se pudo guardar la clave. Verifica la información e intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = () => {
    if (metadataLoading) {
      return <p>Cargando estado actual...</p>;
    }

    if (metadataError) {
      return <p className="text-destructive">{metadataError}</p>;
    }

    if (!metadata?.key_exists) {
      return <p>No hay una clave registrada actualmente.</p>;
    }

    const updatedAt = metadata?.updated_at ? new Date(metadata.updated_at) : null;
    const formattedDate = updatedAt
      ? updatedAt.toLocaleString("es-CO", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

    const updatedBy = metadata?.updated_by_profile;

    return (
      <div className="space-y-1">
        <p className="font-medium">Hay una clave registrada.</p>
        {metadata?.key_suffix && (
          <p className="text-sm text-muted-foreground">
            Sufijo visible: <span className="font-mono">{metadata.key_suffix}</span>
          </p>
        )}
        {formattedDate && (
          <p className="text-sm text-muted-foreground">Actualizada el {formattedDate}</p>
        )}
        {updatedBy && (
          <p className="text-sm text-muted-foreground">
            Responsable: {updatedBy.full_name || updatedBy.email} ({updatedBy.email})
          </p>
        )}
      </div>
    );
  };

  if (loading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al panel de administración
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">OpenAI API Key</h1>
          <p className="text-muted-foreground">
            Administra aquí la clave única de OpenAI utilizada por toda la plataforma.
          </p>
        </div>

        <Card className="p-6">
          <CardHeader className="px-0">
            <CardTitle>Gestionar clave de OpenAI</CardTitle>
            <CardDescription>
              La clave es compartida por toda la compañía y se cifrará antes de guardarse en Supabase.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="apiKey">Nueva API Key</Label>
                <Input
                  id="apiKey"
                  value={apiKey}
                  placeholder="sk-..."
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                />
                <p className="text-sm text-muted-foreground">
                  La clave reemplaza la existente inmediatamente y queda lista para cualquier servicio interno que consuma OpenAI.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar clave
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadMetadata()}
                  disabled={metadataLoading}
                >
                  {metadataLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Actualizar estado
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="px-0 flex-col items-start space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Estado actual</h2>
              <div className="mt-2 text-sm text-muted-foreground">{renderStatus()}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Nota: la clave se almacena cifrada con una passphrase residente en Supabase Vault. Ningún usuario final puede leerla directamente, pero todos los servicios internos pueden utilizarla mediante funciones seguras.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default OpenAISettings;
