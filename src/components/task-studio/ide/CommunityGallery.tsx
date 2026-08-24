import React, { useState } from 'react';
import { Search, GitFork, Play, Sparkles } from 'lucide-react';
import { InteractiveTask } from './types';

interface CommunityGalleryProps {
  tasks: InteractiveTask[];
  loading?: boolean;
  onSelectTaskToFork: (task: InteractiveTask) => void;
  onPreviewTask: (task: InteractiveTask) => void;
}

export const CommunityGallery: React.FC<CommunityGalleryProps> = ({
  tasks,
  loading,
  onSelectTaskToFork,
  onPreviewTask
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  const subjects = ['all', ...Array.from(new Set(tasks.map((t) => t.subject).filter(Boolean)))];

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || task.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="flex-1 bg-[#0A0A0A] p-6 overflow-y-auto text-[#E0E0E0] rounded-lg border border-[#2A2A2A]">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-right">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>גלריית קהילת המורים</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">משימות אינטראקטיביות מוכנות לשימוש</h1>
            <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
              בחר משימה מוכנה מתוך גלריית הקהילה, בצע Fork בלחיצת כפתור, והתאם אותה אישית לכיתה שלך!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111111] p-4 rounded-lg border border-[#2A2A2A]">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-3.5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש לפי שם משימה, תיאור או נושא..."
              className="w-full pr-10 pl-4 py-2 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  selectedSubject === sub ? 'bg-primary text-primary-foreground' : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-[#2A2A2A]'
                }`}
              >
                {sub === 'all' ? 'כל המקצועות' : sub}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">טוען גלריה...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">אין עדיין משימות ציבוריות בגלריה.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-[#111111] rounded-lg border border-[#2A2A2A] hover:border-primary/40 transition-colors flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      {task.subject}
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      {task.language === 'python' ? 'Python' : 'Web Stack'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white group-hover:text-primary transition">{task.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{task.description}</p>

                  <div className="flex flex-wrap gap-1 pt-2">
                    {task.libraries.map((lib) => (
                      <span key={lib} className="text-[10px] font-mono bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400 px-2 py-0.5 rounded">
                        #{lib}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-[#1A1A1A] border-t border-[#2A2A2A] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-500 truncate max-w-[140px]">{task.authorName}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPreviewTask(task)}
                      className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#333333] text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 border border-[#3A3A3A]"
                    >
                      <Play className="w-3.5 h-3.5 text-success" />
                      <span>תצוגה</span>
                    </button>

                    <button
                      onClick={() => onSelectTaskToFork(task)}
                      className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Fork & העתק</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
