import { ClassroomConfig } from '@/types/smartseat';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_SEAT_COLS, MAX_SEAT_ROWS, MIN_SEAT_DIM, clampDim } from '@/lib/seatingLimits';

interface Props {
    config: ClassroomConfig;
    onChange: (c: ClassroomConfig) => void;
}

export function GridSettings({ config, onChange }: Props) {
    // The browser's min/max only guard the spinner arrows; typed values are clamped here.
    const setDim = (key: 'rows' | 'cols', raw: string) => {
        if (raw === '') return; // mid-edit; keep the current value
        const max = key === 'rows' ? MAX_SEAT_ROWS : MAX_SEAT_COLS;
        const value = Number(raw);
        if (value > max) {
            toast.warning(`אפשר להגדיר עד ${max} ${key === 'rows' ? 'שורות' : 'עמודות'} במפת ההושבה`, { id: 'seat-grid-limit' });
        }
        onChange({ ...config, [key]: clampDim(value, max) });
    };

    return (
        <div className="mx-5 flex flex-wrap items-center gap-4 rounded-[18px] bg-card px-3.5 py-2.5 shadow-[0_6px_16px_-12px_rgba(40,30,15,0.4)]">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">שם כיתה:</Label>
                <Input
                    className="w-32 h-7 text-xs"
                    value={config.className}
                    onChange={e => onChange({ ...config, className: e.target.value })}
                />
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">שורות:</Label>
                <Input
                    type="number" min={MIN_SEAT_DIM} max={MAX_SEAT_ROWS}
                    className="w-16 h-7 text-xs"
                    value={config.rows}
                    onChange={e => setDim('rows', e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">עמודות:</Label>
                <Input
                    type="number" min={MIN_SEAT_DIM} max={MAX_SEAT_COLS}
                    className="w-16 h-7 text-xs"
                    value={config.cols}
                    onChange={e => setDim('cols', e.target.value)}
                />
            </div>
            <span className="text-[11px] text-muted-foreground">עד {MAX_SEAT_ROWS} שורות ו־{MAX_SEAT_COLS} עמודות</span>
        </div>
    );
}
