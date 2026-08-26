import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, ArrowRight, Pencil } from 'lucide-react';
import type { UserProfile } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PresentationModel, PresentationTemplate, Slide, SlideObject, TextObject, ShapeObject, ImageObject } from './presentations/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './presentations/types';
import { instantiateTemplate } from './presentations/data/templates';
import { PresentationDashboard } from './presentations/components/PresentationDashboard';
import { SlideSorter } from './presentations/components/SlideSorter';
import { SlideCanvas } from './presentations/components/SlideCanvas';
import { AddObjectMenu } from './presentations/components/AddObjectMenu';
import { SlideWordCountBadge } from './presentations/components/SlideWordCountBadge';

type PresentationRow = {
  id: string;
  owner_id: string;
  title: string;
  slides: unknown;
  created_at: string;
  updated_at: string;
};

const rowToPresentation = (row: PresentationRow): PresentationModel => ({
  id: row.id,
  title: row.title,
  slides: (row.slides as Slide[]) || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const presentationToRow = (p: PresentationModel, ownerId: string) => ({
  id: p.id,
  owner_id: ownerId,
  title: p.title,
  slides: p.slides,
});

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const blankSlide = (): Slide => ({ id: newId(), background: '#FFFFFF', objects: [] });

const PresentationsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();

  const [presentations, setPresentations] = useState<PresentationModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('presentations')
      .select('*')
      .eq('owner_id', profile.id)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Failed to load presentations:', error);
        setPresentations(((data as unknown as PresentationRow[]) || []).map(rowToPresentation));
        setLoading(false);
      });
  }, [profile?.id]);

  const active = presentations.find((p) => p.id === currentId) || null;
  const activeSlide = active?.slides.find((s) => s.id === activeSlideId) || active?.slides[0] || null;

  // Debounced autosave, same pattern as DocumentsPage.tsx: pushes the active
  // presentation to Supabase ~1s after the last local edit.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active || !profile?.id) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from('presentations')
        .update(presentationToRow(active, profile.id) as any)
        .eq('id', active.id);
      if (error) console.error('Failed to save presentation:', error);
    }, 1000);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, profile?.id]);

  const updateActive = (updates: Partial<PresentationModel>) => {
    if (!currentId) return;
    setPresentations((prev) => prev.map((p) => (p.id === currentId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)));
  };

  // Single choke point for every slide mutation (object edits, drags,
  // resizes, add/remove) - keeps autosave to one path.
  const updateSlide = (slideId: string, updater: (slide: Slide) => Slide) => {
    if (!active) return;
    updateActive({ slides: active.slides.map((s) => (s.id === slideId ? updater(s) : s)) });
  };

  const handleUpdateObject = (objectId: string, updates: Partial<SlideObject>) => {
    if (!activeSlide) return;
    updateSlide(activeSlide.id, (slide) => ({
      ...slide,
      objects: slide.objects.map((o) => (o.id === objectId ? ({ ...o, ...updates } as SlideObject) : o)),
    }));
  };

  const handleDeleteObject = (objectId: string) => {
    if (!activeSlide) return;
    updateSlide(activeSlide.id, (slide) => ({ ...slide, objects: slide.objects.filter((o) => o.id !== objectId) }));
  };

  const nextZIndex = (slide: Slide) => slide.objects.reduce((max, o) => Math.max(max, o.zIndex), 0) + 1;

  const handleAddText = () => {
    if (!activeSlide) return;
    const obj: TextObject = {
      id: newId(), type: 'text', x: 260, y: 220, width: 440, height: 100, zIndex: nextZIndex(activeSlide),
      text: 'טקסט חדש', fontSize: 24, bold: false, color: '#1A1D23', align: 'right',
    };
    updateSlide(activeSlide.id, (slide) => ({ ...slide, objects: [...slide.objects, obj] }));
  };

  const handleAddShape = () => {
    if (!activeSlide) return;
    const obj: ShapeObject = {
      id: newId(), type: 'shape', x: 330, y: 190, width: 300, height: 160, zIndex: nextZIndex(activeSlide),
      shape: 'rectangle', fill: '#2D5FF6',
    };
    updateSlide(activeSlide.id, (slide) => ({ ...slide, objects: [...slide.objects, obj] }));
  };

  const handleAddImageFile = async (file: File) => {
    if (!activeSlide || !profile?.id || !active) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `presentations/${profile.id}/${active.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('lesson-files').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('lesson-files').getPublicUrl(path);
      const obj: ImageObject = {
        id: newId(), type: 'image', x: 280, y: 170, width: 400, height: 300, zIndex: nextZIndex(activeSlide),
        url: urlData.publicUrl,
      };
      updateSlide(activeSlide.id, (slide) => ({ ...slide, objects: [...slide.objects, obj] }));
    } catch (err: any) {
      toast({ title: 'שגיאה בהעלאת התמונה', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddSlide = () => {
    if (!active) return;
    const slide = blankSlide();
    updateActive({ slides: [...active.slides, slide] });
    setActiveSlideId(slide.id);
  };

  const handleDeleteSlide = (id: string) => {
    if (!active || active.slides.length <= 1) return;
    const remaining = active.slides.filter((s) => s.id !== id);
    updateActive({ slides: remaining });
    if (activeSlideId === id) setActiveSlideId(remaining[0]?.id ?? null);
  };

  const handleMoveSlide = (id: string, direction: 'up' | 'down') => {
    if (!active) return;
    const idx = active.slides.findIndex((s) => s.id === id);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= active.slides.length) return;
    const next = [...active.slides];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    updateActive({ slides: next });
  };

  const handleCreateFromTemplate = async (template: PresentationTemplate) => {
    if (!profile?.id) return;
    const now = new Date().toISOString();
    const presentation: PresentationModel = {
      id: newId(),
      title: template.id === 'blank' ? 'מצגת ללא שם' : template.nameHe,
      slides: instantiateTemplate(template),
      createdAt: now,
      updatedAt: now,
    };
    setPresentations((prev) => [presentation, ...prev]);
    setCurrentId(presentation.id);
    setActiveSlideId(presentation.slides[0]?.id ?? null);

    const { error } = await supabase.from('presentations').insert(presentationToRow(presentation, profile.id) as any);
    if (error) {
      console.error('Failed to create presentation:', error);
      toast({ title: 'שגיאה ביצירת מצגת', description: error.message, variant: 'destructive' });
      setPresentations((prev) => prev.filter((p) => p.id !== presentation.id));
      setCurrentId(null);
    }
  };

  const handleDeletePresentation = async (id: string) => {
    if (!confirm('האם למחוק מצגת זו?')) return;
    setPresentations((prev) => prev.filter((p) => p.id !== id));
    if (currentId === id) setCurrentId(null);
    const { error } = await supabase.from('presentations').delete().eq('id', id);
    if (error) console.error('Failed to delete presentation:', error);
  };

  const handleDuplicatePresentation = async (p: PresentationModel) => {
    if (!profile?.id) return;
    const dup: PresentationModel = { ...p, id: newId(), title: `${p.title} (עותק)`, updatedAt: new Date().toISOString() };
    setPresentations((prev) => [dup, ...prev]);
    const { error } = await supabase.from('presentations').insert(presentationToRow(dup, profile.id) as any);
    if (error) {
      console.error('Failed to duplicate presentation:', error);
      setPresentations((prev) => prev.filter((x) => x.id !== dup.id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="h-full -m-4 md:-m-6">
        <PresentationDashboard
          presentations={presentations}
          onSelectPresentation={(p) => { setCurrentId(p.id); setActiveSlideId(p.slides[0]?.id ?? null); }}
          onCreateFromTemplate={handleCreateFromTemplate}
          onDeletePresentation={handleDeletePresentation}
          onDuplicatePresentation={handleDuplicatePresentation}
        />
      </div>
    );
  }

  return (
    <div className="h-full -m-4 md:-m-6 flex flex-col bg-[#F3F4F6] overflow-hidden dir-rtl">
      <header className="h-14 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setCurrentId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0" title="חזרה למצגות">
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={active.title}
              onChange={(e) => updateActive({ title: e.target.value })}
              className="font-bold text-sm bg-transparent outline-none min-w-0 truncate focus:bg-muted rounded px-1"
            />
          </div>
        </div>
        {activeSlide && <SlideWordCountBadge slide={activeSlide} />}
      </header>

      <div className="shrink-0 bg-card border-b border-border px-4 py-2">
        <AddObjectMenu
          onAddText={handleAddText}
          onAddShape={handleAddShape}
          onAddImageFile={handleAddImageFile}
          uploadingImage={uploadingImage}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {activeSlide ? (
            <SlideCanvas slide={activeSlide} onUpdateObject={handleUpdateObject} onDeleteObject={handleDeleteObject} />
          ) : (
            <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }} className="bg-white border border-border" />
          )}
        </div>

        <SlideSorter
          slides={active.slides}
          activeSlideId={activeSlide?.id ?? null}
          onSelectSlide={setActiveSlideId}
          onAddSlide={handleAddSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
        />
      </div>
    </div>
  );
};

export default PresentationsPage;
