import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, List } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder }: RichTextEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (format: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText = "";
    let newPosition = start;

    switch (format) {
      case "bold":
        newText = value.substring(0, start) + `<b>${selectedText || "texto en negrita"}</b>` + value.substring(end);
        newPosition = start + 3;
        break;
      case "italic":
        newText = value.substring(0, start) + `<i>${selectedText || "texto en cursiva"}</i>` + value.substring(end);
        newPosition = start + 3;
        break;
      case "bullet":
        const bulletText = selectedText || "Nuevo item";
        newText = value.substring(0, start) + `\n• ${bulletText}` + value.substring(end);
        newPosition = start + bulletText.length + 3;
        break;
      default:
        return;
    }

    onChange(newText);
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 border border-border rounded-t-md p-1 bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("bold")}
          className="h-8 px-2"
          title="Negrita"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("italic")}
          className="h-8 px-2"
          title="Cursiva"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormat("bullet")}
          className="h-8 px-2"
          title="Viñeta"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="rounded-t-none resize-none font-mono text-sm"
      />
      <div className="text-xs text-muted-foreground">
        Selecciona texto y usa los botones para aplicar formato, o escribe HTML directamente
      </div>
    </div>
  );
};
