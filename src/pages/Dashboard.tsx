import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Eye, Edit, Trash2, Users, LogOut, Share2, Copy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

interface Proposal {
  id: string;
  offer_id: string;
  client: string;
  click_count: number;
  created_at: string;
  public_url_slug: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin, signOut, loading: authLoading } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProposals();
    }
  }, [user]);

  const fetchProposals = async () => {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, offer_id, client, click_count, created_at, public_url_slug")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteProposal = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta propuesta?")) return;

    try {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Propuesta eliminada",
        description: "La propuesta ha sido eliminada exitosamente",
      });
      
      fetchProposals();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const copyPublicUrl = (slug: string) => {
    const url = `${window.location.origin}/view/${slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "URL copiada",
      description: "La URL pública ha sido copiada al portapapeles",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="outline"
              size="icon"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-4xl font-bold">Propuestas Comerciales</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button onClick={() => navigate("/users")} variant="outline" size="lg">
                <Users className="mr-2" />
                Gestionar Usuarios
              </Button>
            )}
            <Button onClick={() => navigate("/create")} size="lg">
              <Plus className="mr-2" />
              Nueva Propuesta
            </Button>
            <Button onClick={handleSignOut} variant="outline" size="lg">
              <LogOut className="mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {proposals.map((proposal) => (
            <Card key={proposal.id} className="p-6 hover:shadow-elegant transition-all">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{proposal.offer_id}</h3>
                    <p className="text-muted-foreground mb-2">Cliente: {proposal.client}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Clics: <span className="font-medium">{proposal.click_count}</span></span>
                      <span>Creado: {new Date(proposal.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {proposal.public_url_slug && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/view/${proposal.public_url_slug}`)}
                        title="Ver propuesta pública"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/edit/${proposal.id}`)}
                      title="Editar propuesta"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteProposal(proposal.id)}
                      title="Eliminar propuesta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {proposal.public_url_slug && (
                  <div className="flex gap-2 items-center bg-muted/50 p-3 rounded-lg">
                    <Share2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      value={`${window.location.origin}/view/${proposal.public_url_slug}`}
                      readOnly
                      className="bg-background"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyPublicUrl(proposal.public_url_slug!)}
                      title="Copiar URL"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {proposals.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-xl text-muted-foreground mb-4">
                No hay propuestas creadas todavía
              </p>
              <Button onClick={() => navigate("/create")}>
                <Plus className="mr-2" />
                Crear primera propuesta
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
