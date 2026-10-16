import { AppMode } from '@/types/smartseat';
import { PillSwitch } from '@/components/home/HomeKit';

interface TopBarProps {
    mode: AppMode;
    setMode: (m: AppMode) => void;
    className: string;
}

export function TopBar({ mode, setMode, className }: TopBarProps) {
    return (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
                <h1 className="font-heading text-2xl font-black text-foreground">מפת כיתה</h1>
                {className && (
                    <span className="rounded-full border-[2.5px] border-white bg-card px-3 py-2 font-body text-[13px] font-extrabold text-foreground shadow-[0_3px_8px_-5px_rgba(40,30,15,0.35)] dark:border-card">
                        {className}
                    </span>
                )}
            </div>
            <PillSwitch<AppMode>
                options={[{ value: 'edit', label: 'סידור' }, { value: 'lesson', label: 'שיעור' }]}
                value={mode}
                onChange={setMode}
            />
        </header>
    );
}
