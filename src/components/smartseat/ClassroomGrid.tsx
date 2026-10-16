import React from 'react';
import { Student, ClassroomConfig, AppMode, AttendanceStatus } from '@/types/smartseat';
import { cn } from '@/lib/utils';
import { Volume2 } from 'lucide-react';
import AvatarPreview from "@/components/avatar/AvatarPreview";
import { PersonBadge } from "@/components/home/HomeKit";
import { motion } from 'framer-motion';

interface Props {
    config: ClassroomConfig;
    students: Student[];
    mode: AppMode;
    highlightedId: string | null;
    getStudentAt: (r: number, c: number) => Student | undefined;
    onCellClick: (r: number, c: number, student?: Student) => void;
    onDrop: (r: number, c: number, studentId: string) => void;
}

// Status stickers on a seat (Classroom Map design): light background + dark ink.
const statusTag: Partial<Record<AttendanceStatus, [string, string, string]>> = {
    absent: ['חסר', '#FFE1D6', '#A8320F'],
    late: ['איחור', '#FFF0C2', '#7A5200'],
    disruption: ['הפרעה', '#F4EEE6', '#6B5A44'],
    positive: ['+1', '#E3F6EC', '#11734A'],
};

/** Classroom from the front: board and teacher's desk, then desks of two seats. */
export function ClassroomGrid({ config, mode, highlightedId, getStudentAt, onCellClick, onDrop }: Props) {
    const [dragOverCell, setDragOverCell] = React.useState<string | null>(null);

    const handleDragOver = (e: React.DragEvent, r: number, c: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverCell !== `${r}-${c}`) setDragOverCell(`${r}-${c}`);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!relatedTarget || !relatedTarget.closest('.grid-cell')) {
            setDragOverCell(null);
        }
    };

    const handleDrop = (e: React.DragEvent, r: number, c: number) => {
        e.preventDefault();
        setDragOverCell(null);
        const id = e.dataTransfer.getData('studentId') || e.dataTransfer.getData('text/plain');
        if (id) onDrop(r, c, id);
    };

    // Columns pair up into desks of two (an odd last column is a single desk).
    const desks: number[][] = [];
    for (let c = 0; c < config.cols; c += 2) desks.push(c + 1 < config.cols ? [c, c + 1] : [c]);

    const seat = (r: number, c: number) => {
        const student = getStudentAt(r, c);
        const isHighlighted = student?.id === highlightedId;
        const isDragOver = dragOverCell === `${r}-${c}`;
        const absent = mode === 'lesson' && student?.attendance === 'absent';
        const unmarked = mode === 'lesson' && student?.attendance === 'none';
        const tag = student ? statusTag[student.attendance] ?? (unmarked ? ['?', '#EEF0F3', '#5B6478'] as [string, string, string] : undefined) : undefined;

        return (
            <motion.div
                key={`${r}-${c}`}
                layoutId={student?.id}
                className={cn(
                    'grid-cell relative flex h-20 w-[72px] flex-col items-center justify-center gap-1.5 rounded-[14px] transition-[transform,box-shadow]',
                    student ? 'bg-card shadow-[0_3px_8px_-5px_rgba(40,30,15,0.35)]' : 'border-2 border-dashed border-[#D6CDBD]',
                    isDragOver && 'border-[#7AA2F0] bg-[#E5EEFD]',
                    isHighlighted && '-rotate-2 shadow-[0_0_0_3px_hsl(var(--foreground)),0_14px_20px_-10px_rgba(27,35,51,0.55)]',
                    absent && 'opacity-60',
                    mode === 'edit' ? (student ? 'cursor-grab active:cursor-grabbing' : 'cursor-default') : (student ? 'cursor-pointer active:scale-95' : 'cursor-default')
                )}
                onClick={() => onCellClick(r, c, student)}
                onDragOver={mode === 'edit' && !student ? (e) => handleDragOver(e, r, c) : undefined}
                onDragLeave={handleDragLeave}
                onDrop={mode === 'edit' && !student ? (e) => handleDrop(e, r, c) : undefined}
                draggable={mode === 'edit' && !!student}
                onDragStart={(student ? ((e: React.DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData('studentId', student.id);
                    e.dataTransfer.setData('text/plain', student.id);
                    e.dataTransfer.effectAllowed = 'move';
                }) : undefined) as any}
            >
                {student ? (
                    <>
                        <div className={cn('rounded-full', unmarked && 'shadow-[0_0_0_2px_#C9CED8]', absent && 'grayscale')}>
                            {student.avatar ? <AvatarPreview config={student.avatar} size={40} /> : <PersonBadge name={student.name} />}
                        </div>
                        <span className="w-full truncate px-1 text-center font-body text-xs font-extrabold leading-none text-foreground">
                            {student.name.split(' ')[0]}
                        </span>
                        {tag && (
                            <span
                                className="absolute -left-1.5 -top-2 -rotate-6 rounded-lg border-2 border-white px-[7px] py-1 font-body text-[10.5px] font-extrabold leading-none shadow-[0_2px_5px_-2px_rgba(27,35,51,0.4)] dark:border-card"
                                style={{ background: tag[1], color: tag[2] }}
                            >
                                {tag[0]}
                            </span>
                        )}
                        {isHighlighted && (
                            <motion.div animate={{ y: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute -right-1 -top-2">
                                <Volume2 className="h-4 w-4 text-link" />
                            </motion.div>
                        )}
                    </>
                ) : (
                    <span className="text-center font-body text-[11px] font-bold leading-tight text-hint">
                        {isDragOver ? 'כאן' : mode === 'edit' ? 'פנוי' : ''}
                    </span>
                )}
            </motion.div>
        );
    };

    return (
        <div className="flex min-h-full flex-col items-center gap-5 overflow-x-auto p-6">
            {/* Board and teacher's desk */}
            <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-[min(320px,60vw)] items-center justify-center rounded-[10px] border-[5px] border-[#C9A877] bg-[#2F5E4E] font-heading text-sm font-extrabold tracking-wide text-[#E7F1EC]">
                    לוח
                </div>
                <div className="flex h-[34px] w-24 items-center justify-center rounded-[9px] bg-[#E7DCC8] font-body text-xs font-extrabold text-[#7A6648]">
                    שולחן מורה
                </div>
            </div>

            <div className="flex flex-col gap-[18px]" dir="rtl">
                {Array.from({ length: config.rows }).map((_, r) => (
                    <div key={r} className="flex gap-[22px]">
                        {desks.map((cols) => (
                            <div key={cols[0]} className="flex gap-1.5 rounded-[16px] bg-[#EDE3D2] p-[7px] shadow-[inset_0_-3px_0_#E0D3BD] dark:bg-muted">
                                {cols.map((c) => seat(r, c))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
