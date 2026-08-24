import React, { useState } from 'react';
import { MessageSquare, Check, X, Send, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Comment, Suggestion } from '../types';

interface CommentsAndSuggestionsPanelProps {
  comments: Comment[];
  suggestions: Suggestion[];
  onAddComment: (text: string) => void;
  onResolveComment: (id: string) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClose: () => void;
}

export const CommentsAndSuggestionsPanel: React.FC<CommentsAndSuggestionsPanelProps> = ({
  comments,
  suggestions,
  onAddComment,
  onResolveComment,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClose
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'suggestions'>('comments');

  const handleSubmitNewComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCommentText.trim()) {
      onAddComment(newCommentText.trim());
      setNewCommentText('');
    }
  };

  return (
    <aside className="w-64 bg-card border-r border-border p-4 shrink-0 flex flex-col gap-3 select-none shadow-sm z-20">
      {/* Header and Tab Selection */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
          פעילות אחרונה והערות
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="סגור חלונית"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-muted p-0.5 rounded text-[11px]">
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-1 rounded font-bold transition-colors ${
            activeTab === 'comments'
              ? 'bg-card text-primary shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          הערות ({comments.filter((c) => !c.resolved).length})
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 py-1 rounded font-bold transition-colors ${
            activeTab === 'suggestions'
              ? 'bg-card text-success shadow-2xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          הצעות ({suggestions.filter((s) => s.status === 'pending').length})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {activeTab === 'comments' && (
          <div className="space-y-3">
            {/* New Comment Input */}
            <form onSubmit={handleSubmitNewComment} className="bg-muted p-2.5 rounded border border-border">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="הוסף הערה חדשה..."
                className="w-full text-[11px] p-2 bg-card border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary resize-none h-14"
              />
              <div className="flex justify-end mt-1.5">
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold px-3 py-1 rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>שלוח</span>
                </button>
              </div>
            </form>

            {/* List of Comments */}
            {comments.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-muted-foreground">
                <MessageSquare className="w-6 h-6 mx-auto mb-1 opacity-40 text-muted-foreground" />
                <p>אין הערות פתוחות</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-3 rounded border shadow-2xs transition-colors ${
                    comment.resolved
                      ? 'bg-muted border-border opacity-60'
                      : 'bg-primary/10 border-primary/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <img
                      src={comment.avatar}
                      alt={comment.author}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="font-bold text-[11px] text-foreground">{comment.author}</span>
                    <span className="text-[9px] text-muted-foreground mr-auto">{comment.createdAt}</span>
                  </div>

                  {comment.selectedText && (
                    <div className="bg-warning/10 border-r-2 border-warning px-1.5 py-0.5 my-1 text-[10px] text-warning font-mono rounded-xs truncate">
                      "{comment.selectedText}"
                    </div>
                  )}

                  <p className="text-[11px] text-foreground leading-snug">{comment.text}</p>

                  {!comment.resolved && (
                    <div className="mt-2 pt-1.5 border-t border-primary/20 flex gap-3">
                      <button
                        onClick={() => onResolveComment(comment.id)}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        פתור
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-3">
            {suggestions.filter((s) => s.status === 'pending').length === 0 ? (
              <div className="text-center py-6 text-[11px] text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 opacity-40 text-success" />
                <p>אין הצעות ממתינות</p>
              </div>
            ) : (
              suggestions
                .filter((s) => s.status === 'pending')
                .map((s) => (
                  <div key={s.id} className="bg-success/10 p-3 rounded border border-success/20 shadow-2xs space-y-2">
                    <div className="flex items-center gap-2">
                      <img src={s.avatar} alt={s.author} className="w-5 h-5 rounded-full" />
                      <span className="font-bold text-[11px] text-foreground">{s.author}</span>
                      <span className="text-[9px] text-muted-foreground mr-auto">{s.timestamp}</span>
                    </div>

                    <div className="bg-card p-2 rounded text-[11px] space-y-1 border border-success/20">
                      {s.originalText && (
                        <div className="text-destructive line-through text-[10px]">- {s.originalText}</div>
                      )}
                      <div className="text-success font-medium">+ {s.suggestedText}</div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => onRejectSuggestion(s.id)}
                        className="text-[10px] font-bold text-destructive hover:underline cursor-pointer"
                      >
                        דחה
                      </button>
                      <button
                        onClick={() => onAcceptSuggestion(s.id)}
                        className="text-[10px] font-bold text-success hover:underline cursor-pointer"
                      >
                        קבל
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
