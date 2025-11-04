import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, User } from "lucide-react";
import Model3DViewer from "@/components/Model3DViewer";
import soldgrupLogo from "@/assets/soldgrup-logo.webp";

interface ProposalData {
  id: string;
  offer_id: string;
  presentation_date: string;
  client: string;
  contact_person: string | null;
  reference: string | null;
  soldgrup_contact: string | null;
  observations: string | null;
  offer_details: string | null;
  model_3d_url: string | null;
  technical_specs_table: string[][] | null;
  public_url_slug: string | null;
}

interface EquipmentDetail {
  id: string;
  equipment_name: string;
  equipment_specs: {
    description: string;
    images: { image_url: string; image_order: number }[];
    tables: { title: string; table_data: any; table_order: number }[];
  };
}

const PublicProposal = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [equipment, setEquipment] = useState<EquipmentDetail[]>([]);
  const [proposalItems, setProposalItems] = useState<any[]>([]);
  const [proposalImages, setProposalImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelKey, setModelKey] = useState(0);

  const notifyProposalView = async (data: ProposalData) => {
    try {
      await supabase.functions.invoke('notify-proposal-view', {
        body: {
          offer_id: data.offer_id,
          presentation_date: data.presentation_date,
          client: data.client,
          contact_person: data.contact_person,
          reference: data.reference,
          soldgrup_contact: data.soldgrup_contact,
        },
      });
    } catch (error) {
      console.error("Error notifying proposal view:", error);
    }
  };

  useEffect(() => {
    if (slug) {
      fetchProposal();
    }
  }, [slug]);

  const trackClick = async (proposalId: string) => {
    try {
      await supabase.from("proposal_clicks").insert({
        proposal_id: proposalId,
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
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate("/404");
        return;
      }

      setProposal({
        ...data,
        technical_specs_table: Array.isArray(data.technical_specs_table) 
          ? data.technical_specs_table as string[][] 
          : null
      });

      // Track click after proposal is loaded
      trackClick(data.id);
      notifyProposalView({
        ...data,
        technical_specs_table: Array.isArray(data.technical_specs_table)
          ? data.technical_specs_table as string[][]
          : null,
      });

      // Fetch equipment details
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("equipment_details")
        .select("*")
        .eq("proposal_id", data.id);

      if (equipmentError) throw equipmentError;
      setEquipment((equipmentData as any) || []);

      // Fetch proposal items
      const { data: itemsData, error: itemsError } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", data.id)
        .order("item_number");

      if (itemsError) throw itemsError;
      setProposalItems(itemsData || []);

      // Fetch proposal images
      const { data: imagesData, error: imagesError } = await supabase
        .from("proposal_images")
        .select("*")
        .eq("proposal_id", data.id)
        .order("image_order");

      if (imagesError) throw imagesError;
      setProposalImages(imagesData || []);

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
        {/* Company Logo */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <img 
            src={soldgrupLogo} 
            alt="Soldgrup - La fuerza de su industria" 
            className="h-28 w-auto"
          />
        </div>

        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <Badge className="mb-4 text-lg px-6 py-2">
            Propuesta Comercial - {proposal.offer_id}
          </Badge>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {proposal.client}
          </h1>
          {proposal.presentation_date && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Fecha: {new Date(proposal.presentation_date).toLocaleDateString("es-ES", {
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
              <p className="text-lg font-semibold">{proposal.client}</p>
            </div>
            {proposal.contact_person && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Contacto
                </p>
                <p className="text-lg font-semibold">{proposal.contact_person}</p>
              </div>
            )}
            {proposal.reference && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Referencia</p>
                <div className="text-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: proposal.reference }} />
              </div>
            )}
          </div>
        </Card>

        {/* Soldgrup Contact */}
        {proposal.soldgrup_contact && (
          <Card className="p-8 mb-8 animate-scale-in shadow-elegant hover:shadow-glow transition-all">
            <h3 className="text-xl font-bold mb-4">Contacto Soldgrup</h3>
            <div 
              className="text-muted-foreground prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: proposal.soldgrup_contact }}
            />
          </Card>
        )}

        {/* Proposal Items - Oferta Comercial */}
        {proposalItems.length > 0 && (
          <Card className="p-8 mb-8 animate-scale-in shadow-elegant hover:shadow-glow transition-all">
            <h2 className="text-2xl font-bold mb-6">OFERTA COMERCIAL</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="border border-border p-3 text-left font-semibold">Item</th>
                    <th className="border border-border p-3 text-left font-semibold">Características</th>
                    <th className="border border-border p-3 text-left font-semibold">Cantidad</th>
                    <th className="border border-border p-3 text-left font-semibold">Precio Unitario</th>
                    <th className="border border-border p-3 text-left font-semibold">Precio Total</th>
                  </tr>
                </thead>
                <tbody>
                  {proposalItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-border p-3">{item.item_number}</td>
                      <td className="border border-border p-3">
                        <div dangerouslySetInnerHTML={{ __html: item.description }} />
                      </td>
                      <td className="border border-border p-3">{item.quantity} {item.unit}</td>
                      <td className="border border-border p-3">
                        ${Number(item.unit_price).toLocaleString("es-CO")}
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        ${Number(item.total_price).toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5">
                    <td colSpan={4} className="border border-border p-3 text-right font-bold">
                      Valor total Antes de IVA:
                    </td>
                    <td className="border border-border p-3 font-bold text-primary text-lg">
                      $
                      {proposalItems
                        .reduce((sum, item) => sum + Number(item.total_price), 0)
                        .toLocaleString("es-CO")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Observations */}
        {proposal.observations && (
          <Card className="p-8 mb-8 animate-scale-in shadow-elegant hover:shadow-glow transition-all">
            <h3 className="text-xl font-bold mb-4">Observaciones</h3>
            <div 
              className="text-muted-foreground prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: proposal.observations }}
            />
          </Card>
        )}

        {/* Proposal Images Section */}
        {proposalImages.length > 0 && (
          <Card className="p-8 mb-8 animate-scale-in shadow-elegant hover:shadow-glow transition-all">
            <h2 className="text-2xl font-bold mb-6">Imágenes del Proyecto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proposalImages.map((image, index) => (
                <div key={image.id} className="group relative">
                  <img
                    src={image.image_url}
                    alt={image.image_caption || `Imagen ${index + 1}`}
                    className="w-full h-64 object-cover rounded-lg shadow-md hover:shadow-xl transition-shadow"
                  />
                  {image.image_caption && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      {image.image_caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="space-y-6 animate-fade-in">
          {/* 3D Model Viewer */}
          {proposal.model_3d_url && (
            <Card className="p-8 shadow-elegant">
              <h2 className="text-2xl font-bold mb-4">Visualización 3D del Proyecto</h2>
              <p className="text-muted-foreground mb-4">
                Interactúa con el modelo: Click + arrastrar para rotar, scroll para hacer zoom
              </p>
              <Model3DViewer
                key={modelKey}
                modelUrl={proposal.model_3d_url}
                height="600px"
                enableZoom={true}
                enablePan={true}
                autoRotate={false}
              />
            </Card>
          )}

          {/* Technical Specifications Table */}
          {proposal.technical_specs_table && proposal.technical_specs_table.length > 0 && (
            <Card className="p-8 shadow-elegant">
              <h2 className="text-2xl font-bold mb-6">Especificaciones Técnicas</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {proposal.technical_specs_table.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-muted/30" : ""}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={`border border-border p-4 ${
                              cellIndex === 0 ? "font-semibold bg-primary/5" : ""
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Equipment Section */}
          {equipment.length > 0 && (
            <div className="mt-8 space-y-6">
              <h2 className="text-3xl font-bold mb-6">Equipos</h2>
              {equipment.map((eq) => (
                <Card key={eq.id} className="p-8 shadow-elegant">
                  <h3 className="text-2xl font-bold mb-4">{eq.equipment_name}</h3>
                  
                  {eq.equipment_specs.description && (
                    <p className="text-muted-foreground mb-6 whitespace-pre-wrap">
                      {eq.equipment_specs.description}
                    </p>
                  )}

                  {eq.equipment_specs.images && eq.equipment_specs.images.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold mb-4">Imágenes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eq.equipment_specs.images.map((img, imgIndex) => (
                          <img
                            key={imgIndex}
                            src={img.image_url}
                            alt={`${eq.equipment_name} - ${imgIndex + 1}`}
                            className="w-full h-64 object-cover rounded-lg shadow-md"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {eq.equipment_specs.tables && eq.equipment_specs.tables.length > 0 && (
                    <div className="space-y-6">
                      <h4 className="text-lg font-semibold">Especificaciones Técnicas</h4>
                      {eq.equipment_specs.tables.map((table, tableIndex) => (
                        <div key={tableIndex} className="border rounded-lg p-6 bg-muted/30">
                          <h5 className="font-semibold text-lg mb-4">{table.title}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <tbody>
                                {table.table_data.map((row: any[], rowIndex: number) => (
                                  <tr key={rowIndex}>
                                    {row.map((cell: any, cellIndex: number) => (
                                      <td
                                        key={cellIndex}
                                        className="border border-border p-3 bg-background"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Offer Details */}
          {proposal.offer_details && (
            <Card className="p-8 shadow-elegant">
              <h3 className="text-xl font-bold mb-4">Detalles de la Oferta</h3>
              <div 
                className="text-muted-foreground prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: proposal.offer_details }}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProposal;
