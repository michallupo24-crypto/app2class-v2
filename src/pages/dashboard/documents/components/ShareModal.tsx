import React, { useEffect, useState } from 'react';
import { Share2, Check, UserPlus, X, ShieldCheck, Loader2, Trash2, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  ownerName: string;
}

interface ShareRow {
  id: string;
  shared_with_user_id: string;
  permission: 'editor' | 'commenter' | 'viewer';
  profile?: { full_name: string; email: string } | null;
}

const PERMISSION_LABELS: Record<string, string> = {
  editor: 'עורך',
  commenter: 'מגיב',
  viewer: 'צופה',
};

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, documentId, documentTitle, ownerName }) => {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [permission, setPermission] = useState<'editor' | 'commenter' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShares = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('document_shares')
      .select('id, shared_with_user_id, permission, profile:profiles!document_shares_shared_with_user_id_fkey(full_name, email)')
      .eq('document_id', documentId);
    if (!error && data) setShares(data as ShareRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && documentId) loadShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const handleAddInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = emailInput.trim();
    if (!email || !email.includes('@')) return;
    setInviting(true);
    try {
      const { data: found, error: rpcError } = await (supabase as any).rpc('find_user_by_email_in_school', {
        p_email: email,
      });
      if (rpcError) throw rpcError;
      const user = found?.[0];
      if (!user) {
        setError('לא נמצא משתמש עם האימייל הזה באותו בית ספר');
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error: insertError } = await (supabase as any)
        .from('document_shares')
        .upsert(
          { document_id: documentId, shared_with_user_id: user.id, permission, created_by: auth.user?.id },
          { onConflict: 'document_id,shared_with_user_id' }
        );
      if (insertError) throw insertError;
      setEmailInput('');
      await loadShares();
    } catch (err: any) {
      setError(err.message || 'שגיאה בהוספת שיתוף');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    await (supabase as any).from('document_shares').delete().eq('id', shareId);
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  const handleChangePermission = async (shareId: string, newPermission: string) => {
    setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, permission: newPermission as any } : s)));
    await (supabase as any).from('document_shares').update({ permission: newPermission }).eq('id', shareId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card rounded-lg w-full max-w-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <Share2 className="w-5 h-5 text-primary" />
            <span>שיתוף המסמך: "{documentTitle}"</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-foreground">
          <form onSubmit={handleAddInvite} className="space-y-2">
            <label className="block font-bold text-foreground">הוסף איש/אשת צוות או תלמיד/ה מבית הספר שלך:</label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="הכנס כתובת אימייל..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1 p-2.5 border border-input rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary"
                dir="ltr"
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as any)}
                className="p-2.5 border border-input rounded-xl bg-muted font-semibold text-foreground"
              >
                <option value="editor">עורך</option>
                <option value="commenter">מגיב</option>
                <option value="viewer">צופה</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl flex items-center gap-1 transition-colors disabled:opacity-60"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>הוסף</span>
              </button>
            </div>
            {error && <p className="text-destructive text-[11px]">{error}</p>}
          </form>

          <div>
            <span className="font-bold text-foreground block mb-2">בעלי גישה במסמך:</span>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg border border-border">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-warning" />
                  {ownerName} (בעלים)
                </span>
                <ShieldCheck className="w-4 h-4 text-success" />
              </div>

              {loading && <p className="text-muted-foreground text-center py-2">טוען...</p>}

              {!loading &&
                shares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-muted rounded-lg border border-border">
                    <span className="font-medium text-foreground">
                      {s.profile?.full_name || 'משתמש'}{' '}
                      <span className="text-muted-foreground font-normal">({s.profile?.email})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={s.permission}
                        onChange={(e) => handleChangePermission(s.id, e.target.value)}
                        className="text-[11px] p-1 border border-input rounded-lg bg-card"
                      >
                        <option value="editor">עורך</option>
                        <option value="commenter">מגיב</option>
                        <option value="viewer">צופה</option>
                      </select>
                      <button
                        onClick={() => handleRemoveShare(s.id)}
                        className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground transition-colors"
                        title="הסר גישה"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

              {!loading && shares.length === 0 && (
                <p className="text-muted-foreground text-center py-2">המסמך עדיין לא שותף עם אף אחד</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
