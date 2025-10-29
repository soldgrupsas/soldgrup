import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

export interface ProposalItem {
  item_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ProposalItemsTableProps {
  items: ProposalItem[];
  onChange: (items: ProposalItem[]) => void;
}

export const ProposalItemsTable = ({ items, onChange }: ProposalItemsTableProps) => {
  const handleAddRow = () => {
    const newItem: ProposalItem = {
      item_number: items.length + 1,
      description: "",
      quantity: 0,
      unit_price: 0,
      total_price: 0,
    };
    onChange([...items, newItem]);
  };

  const handleRemoveRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Renumber items
    const renumberedItems = newItems.map((item, i) => ({
      ...item,
      item_number: i + 1,
    }));
    onChange(renumberedItems);
  };

  const handleItemChange = (
    index: number,
    field: keyof ProposalItem,
    value: string | number
  ) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === "description") {
      item[field] = value as string;
    } else if (field === "quantity" || field === "unit_price") {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      item[field] = numValue;
      item.total_price = item.quantity * item.unit_price;
    }

    newItems[index] = item;
    onChange(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">OFERTA COMERCIAL</Label>
          <Button type="button" onClick={handleAddRow} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Fila
          </Button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-1">
                  <Label className="text-sm">Item</Label>
                  <div className="flex items-center justify-center h-10 font-semibold">
                    {item.item_number}
                  </div>
                </div>
                
                <div className="col-span-5">
                  <Label className="text-sm">Características</Label>
                  <RichTextEditor
                    value={item.description}
                    onChange={(value) =>
                      handleItemChange(index, "description", value)
                    }
                    placeholder="Descripción del item con formato"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm">Cantidad</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    placeholder="0"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm">Precio Unitario</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      handleItemChange(index, "unit_price", e.target.value)
                    }
                    placeholder="$0"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm">Precio Total</Label>
                  <div className="flex items-center h-10 px-3 text-muted-foreground font-semibold">
                    {formatCurrency(item.total_price)}
                  </div>
                </div>

                <div className="col-span-12 flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveRow(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Fila
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          <Card className="p-4 bg-muted/50">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Valor total Antes de IVA</span>
              <span className="text-2xl font-bold">{formatCurrency(calculateSubtotal())}</span>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  );
};
