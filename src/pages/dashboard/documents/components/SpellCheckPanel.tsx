import React, { useState } from 'react';
import {
  CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Check,
  X, Plus, BookOpen, RefreshCw, ChevronLeft, ChevronRight,
  HelpCircle, Trash2, ListChecks, Wand2, ShieldAlert
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
    <aside className="w-80 md:w-96 bg-card border-r border-border flex flex-col h-full z-20 select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-destructive/10 text-destructive rounded-lg">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">בדיקת איות ודקדוק</h3>
            <p className="text-[11px] text-muted-foreground">מילון עברי מורחב ומנוע חוקים דקדוקיים</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="סגור חלונית"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-muted/70 p-1 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'errors'
              ? 'bg-card text-destructive'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>איות</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            errors.length > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
          }`}>
            {errors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('grammar')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'grammar'
              ? 'bg-card text-accent'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>דקדוק</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            grammarIssues.length > 0 ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
          }`}>
            {grammarIssues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'dictionary'
              ? 'bg-card text-primary'
              : 'text-muted-foreground hover:text-foreground'
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
              <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-foreground text-base mb-1">אין שגיאות איות!</h4>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                כל המילים במסמך תואמות למילון העברי והלועזי המורחב.
              </p>
            </div>
          ) : (
            <div className="p-4 flex-1 flex flex-col gap-4">
              {/* Stepper header */}
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg border border-border">
                <span className="font-medium">
                  שגיאה {Math.min(currentIndex + 1, errors.length)} מתוך {errors.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrev}
                    className="p-1 hover:bg-muted rounded text-foreground disabled:opacity-30"
                    title="הקודם"
                    disabled={errors.length <= 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1 hover:bg-muted rounded text-foreground disabled:opacity-30"
                    title="הבא"
                    disabled={errors.length <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Current Error Details Card */}
              {currentError && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-destructive uppercase">
                      מילה שגויה זוהתה
                    </span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xl font-bold text-destructive spell-error">
                        {currentError.word}
                      </span>
                      <span className="text-[11px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                        {currentError.type === 'keyboard_slip' ? 'פריסת מקלדת' : 'שגיאת כתיב'}
                      </span>
                    </div>
                    {currentError.reason && (
                      <p className="text-xs text-destructive/80 mt-1 flex items-start gap-1">
                        <span className="font-semibold">סיבה:</span> {currentError.reason}
                      </p>
                    )}
                  </div>

                  {/* Suggestions List */}
                  <div className="border-t border-destructive/20 pt-3">
                    <span className="text-xs font-bold text-foreground block mb-2">
                      הצעות לתיקון במילון:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {currentError.suggestions.map((suggestion, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-card hover:bg-success/10 border border-border hover:border-success/40 rounded-lg p-2.5 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-success opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="font-bold text-foreground group-hover:text-success text-sm">
                              {suggestion}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onReplaceError(currentError, suggestion, false)}
                              className="px-2 py-1 bg-success hover:bg-success/90 text-success-foreground rounded text-xs font-semibold transition-colors"
                              title="תקן מופע זה"
                            >
                              החלף
                            </button>
                            <button
                              onClick={() => onReplaceError(currentError, suggestion, true)}
                              className="px-2 py-1 bg-muted hover:bg-muted/70 text-foreground rounded text-xs font-medium transition-colors"
                              title="החלף בכל המסמך"
                            >
                              החלף הכל
                            </button>
                          </div>
                        </div>
                      ))}
                      {currentError.suggestions.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">אין הצעות ישירות במילון המקומי</span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Ignore & Add to Dictionary */}
                  <div className="border-t border-destructive/20 pt-3 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => onIgnoreError(currentError.id)}
                      className="flex-1 py-1.5 px-2 bg-card hover:bg-muted border border-border text-foreground rounded-lg font-medium transition-colors"
                    >
                      התעלם
                    </button>
                    <button
                      onClick={() => onAddToDictionary(currentError.word)}
                      className="flex-1 py-1.5 px-2 bg-card hover:bg-primary/10 border border-primary/30 text-primary rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
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
                <span className="text-xs font-bold text-muted-foreground mb-2 block">
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
                      className={`text-right p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        index === currentIndex
                          ? 'bg-destructive/10 border-destructive/30 font-bold text-destructive'
                          : 'bg-card hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-destructive/20 text-destructive text-[10px] flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span className="line-through text-destructive">{err.word}</span>
                        <span className="text-muted-foreground">➔</span>
                        <span className="text-success font-semibold">{err.suggestions[0] || '—'}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">בדוק</span>
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
              <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-foreground text-base mb-1">הדקדוק תקין לחלוטין!</h4>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                לא נמצאו שגיאות של שם המספר, אותיות אית"ן, התאמת מין, סיומות עבר או פיסוק.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-accent bg-accent/10 px-3 py-2 rounded-lg border border-accent/20">
                <span className="font-bold">
                  נמצאו {grammarIssues.length} הערות דקדוק ולשון
                </span>
                <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
                  בדיקה תקנית
                </span>
              </div>

              {grammarIssues.map((issue, idx) => (
                <div
                  key={issue.id || idx}
                  className="bg-card border border-accent/20 rounded-lg p-3.5 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20 inline-block mb-1">
                        {getGrammarCategoryLabel(issue.category)}
                      </span>
                      <h5 className="font-bold text-foreground text-xs">{issue.ruleName}</h5>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
                      {issue.matchedText}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg border border-border leading-relaxed">
                    {issue.explanation}
                  </p>

                  <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground">תיקון מוצע:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {issue.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => onReplaceGrammar && onReplaceGrammar(issue, sug)}
                          className="px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success border border-success/30 hover:border-success/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={`תקן ל-"${sug}"`}
                        >
                          <Check className="w-3.5 h-3.5 text-success" />
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
            <h4 className="font-bold text-foreground text-sm mb-1">מילים במילון האישי</h4>
            <p className="text-xs text-muted-foreground">
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
              className="flex-1 px-3 py-1.5 border border-input rounded-lg text-xs focus:ring-2 focus:ring-primary focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!newDictWord.trim()}
              className="px-3 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>הוסף</span>
            </button>
          </form>

          {/* List of Custom Words */}
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
            {customDictionary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                אין עדיין מילים מותאמות אישית במילון המקומי.
              </div>
            ) : (
              customDictionary.map((word) => (
                <div
                  key={word}
                  className="flex items-center justify-between p-2 bg-muted border border-border rounded-lg text-xs group"
                >
                  <span className="font-medium text-foreground">{word}</span>
                  <button
                    onClick={() => onRemoveFromDictionary(word)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
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
      <div className="p-3 border-t border-border bg-muted text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
          <span>מילון עברית ודקדוק תקני</span>
        </span>
        <span className="text-success font-medium">ללא AI</span>
      </div>
    </aside>
  );
};
