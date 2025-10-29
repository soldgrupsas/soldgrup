import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export type SpecTableData = string[][];

interface TechnicalSpecsTableProps {
  data: SpecTableData;
  onChange: (data: SpecTableData) => void;
}

export const TechnicalSpecsTable = ({ data, onChange }: TechnicalSpecsTableProps) => {
  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = data.map((row, rIdx) =>
      rIdx === rowIndex
        ? row.map((cell, cIdx) => (cIdx === colIndex ? value : cell))
        : row
    );
    onChange(newData);
  };

  const handleAddRow = () => {
    const columnCount = data[0]?.length || 2;
    const newRow = Array(columnCount).fill("");
    onChange([...data, newRow]);
  };

  const handleRemoveRow = (rowIndex: number) => {
    if (data.length <= 1) return; // Keep at least one row
    onChange(data.filter((_, idx) => idx !== rowIndex));
  };

  // Initialize with 2 columns and 2 rows if empty
  if (data.length === 0) {
    const initialData = [
      ["", ""],
      ["", ""],
    ];
    onChange(initialData);
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Label className="text-lg font-semibold">Especificaciones Técnicas</Label>
        <Button type="button" onClick={handleAddRow} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Agregar Fila
        </Button>
      </div>

      <div className="space-y-3">
        {data.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 items-center">
            <div className="flex-1 grid grid-cols-2 gap-2">
              {row.map((cell, colIndex) => (
                <Input
                  key={colIndex}
                  value={cell}
                  onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                  placeholder={colIndex === 0 ? "Especificación" : "Valor"}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveRow(rowIndex)}
              disabled={data.length <= 1}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-4">
        Agregue las especificaciones técnicas del proyecto en formato de tabla.
      </p>
    </Card>
  );
};
