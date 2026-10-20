import { Button } from '@/components/ui/button';
import { Play, Square, RotateCcw } from 'lucide-react';

interface Props {
    isSpeaking: boolean;
    onAutoScan: () => void;
    onStop: () => void;
    onResetAttendance: () => void;
    studentCount: number;
    presentCount: number;
    absentCount: number;
}

export function LessonControls({ isSpeaking, onAutoScan, onStop, onResetAttendance, studentCount, presentCount, absentCount }: Props) {
    const unmarked = Math.max(0, studentCount - presentCount - absentCount);
    // Count stickers, as in the Classroom Map design.
    const counts: [number, string, string, string][] = [
        [presentCount, 'נוכחים', '#E3F6EC', '#11734A'],
        [absentCount, 'חסרים', '#FFE1D6', '#A8320F'],
        [unmarked, 'לא סומנו', '#EEF0F3', '#4A5468'],
    ];
    return (
        <div className="mx-5 flex flex-wrap items-center gap-3 rounded-[18px] bg-card px-3.5 py-2.5 shadow-[0_6px_16px_-12px_rgba(40,30,15,0.4)]">
            <div className="flex gap-2">
                {!isSpeaking ? (
                    <Button size="sm" onClick={onAutoScan} className="gap-2">
                        <Play className="h-4 w-4" />
                        הקראה רציפה
                    </Button>
                ) : (
                    <Button size="sm" variant="destructive" onClick={onStop} className="gap-2">
                        <Square className="h-4 w-4" />
                        עצירה
                    </Button>
                )}
                <Button size="sm" variant="outline" onClick={onResetAttendance} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    איפוס נוכחות
                </Button>
            </div>

            <div className="mr-auto flex flex-wrap gap-2">
                {counts.map(([n, label, bg, ink]) => (
                    <div key={label} className={`flex items-baseline gap-1.5 rounded-xl border-[2.5px] border-white px-[11px] py-[7px] shadow-[0_3px_8px_-5px_rgba(40,30,15,0.35)] dark:border-card`} style={{ background: bg, color: ink }}>
                        <span className="font-heading text-[17px] font-black leading-none">{n}</span>
                        <span className="font-body text-xs font-extrabold leading-none">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
