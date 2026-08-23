import React, { useState } from 'react';
import { 
  CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Check, 
  X, Plus, BookOpen, RefreshCw, Sparkles, ChevronLeft, ChevronRight,
  HelpCircle, Trash2, ListChecks, Wand2, ShieldAlert, Sparkle
} from 'lucide-react';
import { SpellingError } from '../utils/spellCheck';
import { GrammarIssue } from '../utils/grammarCheck';

interface SpellCheckPanelProps {
  errors: SpellingError[];
  grammarIssues?: GrammarIssue[];
  onSelectError: (error: SpellingError) => void;
  onReplaceError: (error: SpellingError, correction: string, replaceAll?: boolean) => void;
  onReplaceGrammar?: (issue: GrammarIssue, correction: string) => void;
  onIgnoreError: (errorId: string) => void;
  onAddToDictionary: (word: string) => void;
  customDictionary: string[];
  onRemoveFromDictionary: (word: string) => void;
  onClose: () => void;
  selectedErrorId?: string | null;
}

export const SpellCheckPanel: React.FC<SpellCheckPanelProps> = ({
  errors,
  grammarIssues = [],
  onSelectError,
  onReplaceError,
  onReplaceGrammar,
  onIgnoreError,
  onAddToDictionary,
  customDictionary,
  onRemoveFromDictionary,
  onClose,
  selectedErrorId
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'errors' | 'grammar' | 'dictionary'>('errors');
  const [newDictWord, setNewDictWord] = useState('');

  const currentError = errors[currentIndex] || errors[0] || null;

  const handleNext = () => {
    if (errors.length === 0) return;
    const nextIdx = (currentIndex + 1) % errors.length;
    setCurrentIndex(nextIdx);
    onSelectError(errors[nextIdx]);
  };

  const handlePrev = () => {
    if (errors.length === 0) return;
    const prevIdx = (currentIndex - 1 + errors.length) % errors.length;
    setCurrentIndex(prevIdx);
    onSelectError(errors[prevIdx]);
  };

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDictWord.trim()) return;
    onAddToDictionary(newDictWord.trim());
    setNewDictWord('');
  };

  const getGrammarCategoryLabel = (category: GrammarIssue['category']) => {
    switch (category) {
      case 'number_gender': return 'התאמת שם המספר';
      case 'future_prefix': return 'אותיות אית"ן (עתיד)';
      case 'past_suffix': return 'סיומת עבר (נוכח)';
      case 'noun_adjective': return 'התאמת מין ומספר';
      case 'definite_article': return 'יידוע ה\' הידיעה';
      case 'homophone_preposition': return 'מילת יחס והגייה';
      case 'duplicate_word': return 'מילה כפולה';
      case 'style_connector': return 'מילת קישור תקנית';
      case 'punctuation_spacing': return 'כללי פיסוק';
      default: return 'כלל דקדוקי';
    }
  };

  const totalIssuesCount = errors.length + grammarIssues.length;

  return (
    <aside className="w-80 md:w-96 bg-white border-r border-slate-200 shadow-xl flex flex-col h-full z-20 select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">בדיקת איות ודקדוק</h3>
            <p className="text-[11px] text-slate-500">מילון עברי מורחב ומנוע חוקים דקדוקיים</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
          title="סגור חלונית"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'errors'
              ? 'bg-white text-rose-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>איות</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            errors.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {errors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('grammar')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'grammar'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>דקדוק</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            grammarIssues.length > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {grammarIssues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'dictionary'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>מילון ({customDictionary.length})</span>
        </button>
      </div>

      {/* Tab 1: Spelling Errors */}
      {activeTab === 'errors' && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {errors.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">אין שגיאות איות!</h4>
              <p className="text-xs text-slate-500 max-w-[220px]">
                כל המילים במסמך תואמות למילון העברי והלועזי המורחב.
              </p>
            </div>
          ) : (
            <div className="p-4 flex-1 flex flex-col gap-4">
              {/* Stepper header */}
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                <span className="font-medium">
                  שגיאה {Math.min(currentIndex + 1, errors.length)} מתוך {errors.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrev}
                    className="p-1 hover:bg-slate-200 rounded text-slate-700 disabled:opacity-30"
                    title="הקודם"
                    disabled={errors.length <= 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1 hover:bg-slate-200 rounded text-slate-700 disabled:opacity-30"
                    title="הבא"
                    disabled={errors.length <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Current Error Details Card */}
              {currentError && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-rose-600 uppercase">
                      מילה שגויה זוהתה
                    </span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xl font-bold text-rose-950 spell-error">
                        {currentError.word}
                      </span>
                      <span className="text-[11px] bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-full font-medium">
                        {currentError.type === 'keyboard_slip' ? 'פריסת מקלדת' : 'שגיאת כתיב'}
                      </span>
                    </div>
                    {currentError.reason && (
                      <p className="text-xs text-rose-800/80 mt-1 flex items-start gap-1">
                        <span className="font-semibold">סיבה:</span> {currentError.reason}
                      </p>
                    )}
                  </div>

                  {/* Suggestions List */}
                  <div className="border-t border-rose-200/80 pt-3">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      הצעות לתיקון במילון:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {currentError.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg p-2.5 transition-all group"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="font-bold text-slate-900 group-hover:text-emerald-950 text-sm">
                              {suggestion}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onReplaceError(currentError, suggestion, false)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                              title="תקן מופע זה"
                            >
                              החלף
                            </button>
                            <button
                              onClick={() => onReplaceError(currentError, suggestion, true)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                              title="החלף בכל המסמך"
                            >
                              החלף הכל
                            </button>
                          </div>
                        </div>
                      ))}
                      {currentError.suggestions.length === 0 && (
                        <span className="text-xs text-slate-400 italic">אין הצעות ישירות במילון המקומי</span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Ignore & Add to Dictionary */}
                  <div className="border-t border-rose-200/80 pt-3 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => onIgnoreError(currentError.id)}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                      התעלם
                    </button>
                    <button
                      onClick={() => onAddToDictionary(currentError.word)}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
                      title="הוסף מילה זו למילון המקומי כדי שלא תסומן שוב"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>הוסף למילון</span>
                    </button>
                  </div>
                </div>
              )}

              {/* All Errors List */}
              <div className="mt-2">
                <span className="text-xs font-bold text-slate-600 mb-2 block">
                  כל השגיאות שנמצאו במסמך:
                </span>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {errors.map((err, index) => (
                    <button
                      key={err.id}
                      onClick={() => {
                        setCurrentIndex(index);
                        onSelectError(err);
                      }}
                      className={`text-right p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        index === currentIndex
                          ? 'bg-rose-100 border-rose-300 font-bold text-rose-950'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 text-[10px] flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span className="line-through text-rose-700">{err.word}</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-emerald-700 font-semibold">{err.suggestions[0] || '—'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">בדוק</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Hebrew Grammar Check */}
      {activeTab === 'grammar' && (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {grammarIssues.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">הדקדוק תקין לחלוטין!</h4>
              <p className="text-xs text-slate-500 max-w-[240px]">
                לא נמצאו שגיאות של שם המספר, אותיות אית"ן, התאמת מין, סיומות עבר או פיסוק.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-indigo-900 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200">
                <span className="font-bold">
                  נמצאו {grammarIssues.length} הערות דקדוק ולשון
                </span>
                <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                  בדיקה תקנית
                </span>
              </div>

              {grammarIssues.map((issue, idx) => (
                <div 
                  key={issue.id || idx}
                  className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-xs flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 inline-block mb-1">
                        {getGrammarCategoryLabel(issue.category)}
                      </span>
                      <h5 className="font-bold text-slate-900 text-xs">{issue.ruleName}</h5>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                      {issue.matchedText}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                    💡 {issue.explanation}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500">תיקון מוצע:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {issue.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => onReplaceGrammar && onReplaceGrammar(issue, sug)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          title={`תקן ל-"${sug}"`}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>החלף ל-{sug}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Custom User Dictionary */}
      {activeTab === 'dictionary' && (
        <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">מילים במילון האישי</h4>
            <p className="text-xs text-slate-500">
              מילים אלו נחשבות לתקינות במסמך ולא יסומנו כשגיאות איות.
            </p>
          </div>

          {/* Add Word Form */}
          <form onSubmit={handleAddCustomWord} className="flex gap-2">
            <input
              type="text"
              placeholder="הוסף מילה חדשה..."
              value={newDictWord}
              onChange={(e) => setNewDictWord(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!newDictWord.trim()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>הוסף</span>
            </button>
          </form>

          {/* List of Custom Words */}
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
            {customDictionary.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                אין עדיין מילים מותאמות אישית במילון המקומי.
              </div>
            ) : (
              customDictionary.map((word) => (
                <div
                  key={word}
                  className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs group"
                >
                  <span className="font-medium text-slate-800">{word}</span>
                  <button
                    onClick={() => onRemoveFromDictionary(word)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                    title="הסר מהמילון"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>מילון עברית ודקדוק תקני</span>
        </span>
        <span className="text-emerald-600 font-medium">ללא AI</span>
      </div>
    </aside>
  );
};
