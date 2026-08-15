import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFontScale, type FontScale } from "@/hooks/useFontScale";

const OPTIONS: { value: FontScale; label: string }[] = [
  { value: 100, label: "רגיל" },
  { value: 112, label: "גדול" },
  { value: 125, label: "גדול יותר" },
  { value: 137, label: "גדול מאוד" },
];

export const FontSizeToggle = () => {
  const { scale, setScale } = useFontScale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Type className="h-4 w-4" />
          <span className="sr-only">גודל טקסט</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setScale(opt.value)} className="gap-2 font-heading text-sm">
            <span style={{ fontSize: `${0.75 + (opt.value - 100) / 300}rem` }}>א</span>
            {opt.label}
            {scale === opt.value && <span className="mr-auto text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
