import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle2, Clock, Award, BarChart3, Search, Eye, RefreshCw, ChevronRight, FileCode2, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TaskProgress } from './types';

interface TeacherAnalyticsDashboardProps {
  taskId: string;
  classId: string | null;
  taskTitle: string;
  onBack: () => void;
}

export const TeacherAnalyticsDashboard: React.FC<TeacherAnalyticsDashboardProps> = ({
  taskId,
  classId,
  taskTitle,
  onBack
}) => {
  const [progressList, setProgressList] = useState<TaskProgress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'in_progress' | 'not_started'>('all');
  const [selectedStudent, setSelectedStudent] = useState<TaskProgress | null>(null);

  const fetchProgressData = async () => {
    setIsLoading(true);
    try {
      if (!classId) { setProgressList([]); return; }

      const [{ data: roster }, { data: progress }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('class_id', classId).eq('is_approved', true),
        supabase.from('interactive_task_progress').select('*').eq('task_id', taskId),
      ]);

      const progressByStudent = new Map((progress || []).map((p: any) => [p.student_id, p]));

      const merged: TaskProgress[] = (roster || []).map((s: any) => {
        const p = progressByStudent.get(s.id);
        return {
          id: p?.id || s.id,
          studentId: s.id,
          studentName: s.full_name,
          state: (p?.state as Record<string, any>) || null,
          score: p?.score ?? null,
          total: p?.total ?? null,
          status: p ? (p.status as 'in_progress' | 'submitted') : 'not_started',
          timeSpentSeconds: p?.time_spent_seconds || 0,
          lastActiveAt: p?.last_active_at || null,
          submittedAt: p?.submitted_at || null,
        };
      });

      setProgressList(merged);
    } catch (e) {
      console.error('Error loading task progress:', e);
      setProgressList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, classId]);

  const totalStudents = progressList.length;
  const submittedList = progressList.filter((p) => p.status === 'submitted');
  const submittedCount = submittedList.length;
  const inProgressCount = progressList.filter((p) => p.status === 'in_progress').length;
  const notStartedCount = progressList.filter((p) => p.status === 'not_started').length;

  const averageScore = submittedCount > 0
    ? Math.round(submittedList.reduce((acc, curr) => acc + (curr.total ? Math.round(((curr.score || 0) / curr.total) * 100) : 0), 0) / submittedCount)
    : null;

  const activeStudents = progressList.filter((p) => p.timeSpentSeconds > 0);
  const avgTimeMinutes = activeStudents.length > 0
    ? Math.round((activeStudents.reduce((acc, curr) => acc + curr.timeSpentSeconds, 0) / activeStudents.length) / 60)
    : null;

  const filteredStudents = progressList.filter((student) => {
    const matchesSearch = !searchTerm || student.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatSeconds = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const rSecs = secs % 60;
    return `${mins} דק' ${rSecs < 10 ? '0' : ''}${rSecs} שנ'`;
  };

  const statusBadge = (status: TaskProgress['status']) => {
    if (status === 'submitted') return (
      <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full font-semibold text-[11px]">
        <CheckCircle2 className="w-3 h-3" /><span>הוגש</span>
      </span>
    );
    if (status === 'in_progress') return (
      <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-full font-semibold text-[11px]">
        <Clock className="w-3 h-3" /><span>בתהליך</span>
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 bg-gray-500/10 border border-gray-500/30 text-gray-400 px-2.5 py-1 rounded-full font-semibold text-[11px]">
        <span>טרם התחיל</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-[#E0E0E0] rounded-2xl border border-[#2A2A2A] p-4 gap-4 overflow-y-auto w-full">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333333] text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer border border-[#3A3A3A]">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span>חזרה לעורך</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-600/20 text-purple-400 font-semibold px-2.5 py-0.5 rounded-md border border-purple-500/30">
                דאשבורד מעקב מורה
              </span>
              <h1 className="text-base font-bold text-white">{taskTitle}</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">מעקב בזמן אמת אחר הגשות, ציונים וזמן עבודה — מהנתונים האמיתיים בכיתה</p>
          </div>
        </div>

        <button
          onClick={fetchProgressData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333333] text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer border border-[#3A3A3A]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>רענן נתונים</span>
        </button>
      </div>

      {!classId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          שמור/י את המשימה למטלה קודם כדי לראות מעקב תלמידים.
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-medium block">סה"כ תלמידים בכיתה</span>
                <span className="text-2xl font-bold text-white mt-1 block">{totalStudents}</span>
              </div>
              <div className="p-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20"><Users className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-medium block">הוגשו</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-emerald-400">{submittedCount}</span>
                  <span className="text-xs text-gray-400 font-medium">({totalStudents ? Math.round((submittedCount / totalStudents) * 100) : 0}%)</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl border border-emerald-500/20"><CheckCircle2 className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-medium block">ממוצע ציונים</span>
                <span className="text-2xl font-bold text-purple-400 mt-1 block">{averageScore === null ? '—' : `${averageScore}%`}</span>
              </div>
              <div className="p-3 bg-purple-600/10 text-purple-400 rounded-xl border border-purple-500/20"><Award className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 font-medium block">זמן עבודה ממוצע</span>
                <span className="text-2xl font-bold text-amber-400 mt-1 block">{avgTimeMinutes === null ? '—' : `${avgTimeMinutes} דק'`}</span>
              </div>
              <div className="p-3 bg-amber-600/10 text-amber-400 rounded-xl border border-amber-500/20"><Clock className="w-5 h-5" /></div>
            </div>
          </div>

          <div className="bg-[#111111] border border-[#2A2A2A] rounded-xl p-5 flex flex-col space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">רשימת תלמידים והתקדמות</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="חפש תלמיד..."
                    className="bg-[#0A0A0A] border border-[#2A2A2A] text-xs text-white rounded-lg pr-8 pl-3 py-1.5 focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
                <div className="flex items-center bg-[#0A0A0A] p-1 rounded-lg border border-[#2A2A2A] text-xs">
                  {(['all', 'submitted', 'in_progress', 'not_started'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        statusFilter === s ? 'bg-[#2A2A2A] text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {s === 'all' ? `הכל (${totalStudents})` : s === 'submitted' ? `הוגש (${submittedCount})` : s === 'in_progress' ? `בתהליך (${inProgressCount})` : `טרם התחיל (${notStartedCount})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-[#2A2A2A] bg-[#1A1A1A]">
                    <th className="py-3 px-4 font-semibold">שם התלמיד</th>
                    <th className="py-3 px-4 font-semibold">סטטוס</th>
                    <th className="py-3 px-4 font-semibold">ציון</th>
                    <th className="py-3 px-4 font-semibold">זמן עבודה</th>
                    <th className="py-3 px-4 font-semibold">עדכון אחרון</th>
                    <th className="py-3 px-4 font-semibold text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500 italic">
                      {totalStudents === 0 ? 'אין תלמידים בכיתה זו.' : 'לא נמצאו תלמידים תואמים לסינון.'}
                    </td></tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.studentId} className="hover:bg-[#1A1A1A]/60 transition">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                            {student.studentName.charAt(0)}
                          </div>
                          <span>{student.studentName}</span>
                        </td>
                        <td className="py-3.5 px-4">{statusBadge(student.status)}</td>
                        <td className="py-3.5 px-4 font-bold">
                          {student.status === 'submitted' && student.total ? (
                            <span className={
                              Math.round(((student.score || 0) / student.total) * 100) >= 80 ? 'text-emerald-400' :
                              Math.round(((student.score || 0) / student.total) * 100) >= 60 ? 'text-amber-400' : 'text-rose-400'
                            }>
                              {Math.round(((student.score || 0) / student.total) * 100)}% ({student.score}/{student.total})
                            </span>
                          ) : <span className="text-gray-500 italic">—</span>}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 font-mono">{formatSeconds(student.timeSpentSeconds)}</td>
                        <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                          {student.lastActiveAt ? new Date(student.lastActiveAt).toLocaleString('he-IL') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            disabled={student.status === 'not_started'}
                            className="px-3 py-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] disabled:opacity-30 disabled:cursor-not-allowed text-blue-400 hover:text-blue-300 rounded-lg font-semibold transition cursor-pointer border border-[#3A3A3A] inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" /><span>בדוק מענה</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col text-[#E0E0E0]">
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A] bg-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">מענה תלמיד: {selectedStudent.studentName}</h3>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-white px-2 py-1 rounded text-xs font-bold">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A]">
                <div>
                  <span className="text-gray-500 block text-[11px]">ציון סופי:</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {selectedStudent.status === 'submitted' && selectedStudent.total ? `${Math.round(((selectedStudent.score || 0) / selectedStudent.total) * 100)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">זמן עבודה:</span>
                  <span className="text-sm font-semibold text-gray-200">{formatSeconds(selectedStudent.timeSpentSeconds)}</span>
                </div>
              </div>

              {selectedStudent.state?.code ? (
                <div>
                  <span className="text-gray-400 font-semibold block mb-1">קוד שכתב/ה התלמיד/ה:</span>
                  <pre className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] text-gray-300 font-mono text-[11px] overflow-x-auto max-h-64" dir="ltr">
                    {selectedStudent.state.code}
                  </pre>
                </div>
              ) : selectedStudent.state ? (
                <div>
                  <span className="text-gray-400 font-semibold block mb-1">מצב שנשמר במשימה:</span>
                  <pre className="bg-[#0A0A0A] p-3 rounded-xl border border-[#2A2A2A] text-gray-300 font-mono text-[11px] overflow-x-auto max-h-64">
                    {JSON.stringify(selectedStudent.state, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-500 italic">אין נתוני state שמורים עבור תלמיד/ה זה.</p>
              )}
            </div>

            <div className="p-4 border-t border-[#2A2A2A] bg-[#1A1A1A] flex justify-end">
              <button onClick={() => setSelectedStudent(null)} className="bg-white text-black hover:bg-gray-200 font-semibold px-5 py-1.5 rounded-lg text-xs">סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
