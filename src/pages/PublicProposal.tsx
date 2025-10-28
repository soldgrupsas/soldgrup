import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Mail, Phone, User } from "lucide-react";

interface ProposalData {
  id: string;
  client_name: string;
  client_contact: string | null;
  client_email: string | null;
  client_phone: string | null;
  project_name: string;
  project_location: string | null;
  engineer_name: string | null;
  engineer_title: string | null;
  total_amount: number | null;
  validity_days: number | null;
  proposal_date: string | null;
  terms_conditions: string | null;
  payment_terms: string | null;
  delivery_time: string | null;
  notes: string | null;
}

const PublicProposal = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchProposal();
      trackClick();
    }
  }, [slug]);

  const trackClick = async () => {
    try {
      await supabase.from("proposal_clicks").insert({
        proposal_id: proposal?.id,
        ip_address: null,
        user_agent: navigator.userAgent,
      });

      await supabase.rpc("increment_proposal_clicks", {
        proposal_slug: slug,
      });
    } catch (error) {
      console.error("Error tracking click:", error);
    }
  };

  const fetchProposal = async () => {
    try {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("public_url_slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate("/404");
        return;
      }

      setProposal(data);
    } catch (error: any) {
      console.error("Error fetching proposal:", error);
      navigate("/404");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-xl animate-fade-in">Cargando propuesta...</div>
      </div>
    );
  }

  if (!proposal) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <Badge className="mb-4 text-lg px-6 py-2">Propuesta Comercial</Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {proposal.project_name}
          </h1>
          {proposal.proposal_date && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Fecha: {new Date(proposal.proposal_date).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Client Info Card */}
        <Card className="p-8 mb-8 animate-scale-in shadow-elegant hover:shadow-glow transition-all">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Información del Cliente
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Cliente</p>
              <p className="text-lg font-semibold">{proposal.client_name}</p>
            </div>
            {proposal.client_contact && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Contacto
                </p>
                <p className="text-lg font-semibold">{proposal.client_contact}</p>
              </div>
            )}
            {proposal.client_email && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </p>
                <p className="text-lg font-semibold">{proposal.client_email}</p>
              </div>
            )}
            {proposal.client_phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Teléfono
                </p>
                <p className="text-lg font-semibold">{proposal.client_phone}</p>
              </div>
            )}
            {proposal.project_location && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Ubicación del Proyecto
                </p>
                <p className="text-lg font-semibold">{proposal.project_location}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Amount and Validity */}
        {(proposal.total_amount || proposal.validity_days) && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {proposal.total_amount && (
              <Card className="p-8 animate-slide-in-right shadow-elegant hover:shadow-glow transition-all">
                <p className="text-sm text-muted-foreground mb-2">Monto Total</p>
                <p className="text-4xl font-bold text-primary">
                  ${Number(proposal.total_amount).toLocaleString("es-ES")}
                </p>
              </Card>
            )}
            {proposal.validity_days && (
              <Card className="p-8 animate-slide-in-right shadow-elegant hover:shadow-glow transition-all">
                <p className="text-sm text-muted-foreground mb-2">Validez de la Propuesta</p>
                <p className="text-4xl font-bold text-primary">{proposal.validity_days} días</p>
              </Card>
            )}
          </div>
        )}

        {/* Terms and Conditions */}
        <div className="space-y-6 animate-fade-in">
          {proposal.payment_terms && (
            <Card className="p-8 shadow-elegant">
              <h3 className="text-xl font-bold mb-4">Términos de Pago</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{proposal.payment_terms}</p>
            </Card>
          )}

          {proposal.delivery_time && (
            <Card className="p-8 shadow-elegant">
              <h3 className="text-xl font-bold mb-4">Tiempo de Entrega</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{proposal.delivery_time}</p>
            </Card>
          )}

          {proposal.terms_conditions && (
            <Card className="p-8 shadow-elegant">
              <h3 className="text-xl font-bold mb-4">Términos y Condiciones</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {proposal.terms_conditions}
              </p>
            </Card>
          )}

          {proposal.notes && (
            <Card className="p-8 shadow-elegant">
              <h3 className="text-xl font-bold mb-4">Notas Adicionales</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{proposal.notes}</p>
            </Card>
          )}
        </div>

        {/* Engineer Info */}
        {(proposal.engineer_name || proposal.engineer_title) && (
          <Card className="p-8 mt-8 bg-primary/5 border-primary/20 animate-fade-in">
            <Separator className="mb-6" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Elaborado por</p>
              {proposal.engineer_name && (
                <p className="text-xl font-bold">{proposal.engineer_name}</p>
              )}
              {proposal.engineer_title && (
                <p className="text-muted-foreground">{proposal.engineer_title}</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PublicProposal;
