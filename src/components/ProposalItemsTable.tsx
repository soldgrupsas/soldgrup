import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

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

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-semibold w-16">Item</th>
                <th className="p-2 text-left font-semibold">Características</th>
                <th className="p-2 text-left font-semibold w-24">Cantidad</th>
                <th className="p-2 text-left font-semibold w-32">Precio Unitario</th>
                <th className="p-2 text-left font-semibold w-32">Precio Total</th>
                <th className="p-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="p-2">
                    <div className="flex items-center justify-center h-10">
                      {item.item_number}
                    </div>
                  </td>
                  <td className="p-2">
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(index, "description", e.target.value)
                      }
                      placeholder="Descripción del item"
                    />
                  </td>
                  <td className="p-2">
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
                  </td>
                  <td className="p-2">
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
                  </td>
                  <td className="p-2">
                    <div className="flex items-center h-10 px-3 text-muted-foreground">
                      {formatCurrency(item.total_price)}
                    </div>
                  </td>
                  <td className="p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50">
                <td colSpan={4} className="p-3 text-right font-semibold">
                  Valor total Antes de IVA
                </td>
                <td className="p-3 font-bold">
                  {formatCurrency(calculateSubtotal())}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};
