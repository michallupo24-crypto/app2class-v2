import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, Check, Search } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertImage: (imageUrl: string, caption?: string, widthPercent?: number, alignment?: 'center' | 'right' | 'left') => void;
}

const PRESET_CATEGORIES = [
  { id: 'all', name: 'הכל' },
  { id: 'business', name: 'עסקים וניהול' },
  { id: 'tech', name: 'טכנולוגיה וקוד' },
  { id: 'nature', name: 'טבע ונוף' },
  { id: 'graphs', name: 'גרפים ודיאגרמות' }
];

const PRESET_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
    title: 'צוות בעבודה משרדית',
    category: 'business'
  },
  {
    url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80',
    title: 'פגישת עבודה אסטרטגית',
    category: 'business'
  },
  {
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    title: 'ניתוח נתונים וגרפים',
    category: 'graphs'
  },
  {
    url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80',
    title: 'תכנון פרויקט וטכנולוגיה',
    category: 'tech'
  },
  {
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    title: 'מגדלי משרדים מודרניים',
    category: 'business'
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    title: 'נוף ים וטבע מרגיע',
    category: 'nature'
  }
];

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  onInsertImage
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [widthPercent, setWidthPercent] = useState<number>(80);
  const [alignment, setAlignment] = useState<'center' | 'right' | 'left'>('center');
  const [presetCategory, setPresetCategory] = useState<string>('all');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSelectedUrl(e.target.result as string);
        if (!caption) setCaption(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleConfirmInsert = () => {
    const finalUrl = selectedUrl || customUrlInput;
    if (!finalUrl) return;
    onInsertImage(finalUrl, caption, widthPercent, alignment);
    onClose();
    // Reset modal state
    setSelectedUrl('');
    setCaption('');
    setCustomUrlInput('');
  };

  const filteredPresets = presetCategory === 'all'
    ? PRESET_IMAGES
    : PRESET_IMAGES.filter((p) => p.category === presetCategory);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 dir-rtl font-sans animate-in fade-in duration-150">
      <div className="bg-card w-full max-w-2xl rounded-lg border border-border overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">הוספת תמונה למסמך</h2>
              <p className="text-xs text-muted-foreground">העלה קובץ מהמחשב, בחר מאוסף התמונות או הדבק קישור</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted px-6 pt-2">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>העלאה מהמחשב</span>
          </button>

          <button
            onClick={() => setActiveTab('preset')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'preset'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>גלריית תמונות</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'url'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>קישור אינטרנט (URL)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors flex flex-col items-center justify-center cursor-pointer ${
                  dragActive
                    ? 'border-primary bg-primary/10'
                    : selectedUrl
                    ? 'border-success bg-success/10'
                    : 'border-border hover:border-primary/40 bg-muted/50'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedUrl ? (
                  <div className="space-y-3">
                    <img
                      src={selectedUrl}
                      alt="תצוגה מקדימה"
                      className="max-h-48 max-w-full rounded-lg mx-auto object-cover border border-border"
                    />
                    <div className="flex items-center justify-center gap-2 text-success font-bold text-xs">
                      <Check className="w-4 h-4" />
                      <span>התמונה נבחרה בהצלחה! ניתן לשנות כעת הגדרות גודל ומיקום</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-foreground text-sm">לחץ לבחירת תמונה או גרוב לכאן קובץ</p>
                    <p className="text-xs text-muted-foreground mt-1">תומך בקבצי JPG, PNG, WEBP, GIF</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRESET GALLERY */}
          {activeTab === 'preset' && (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPresetCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                      presetCategory === cat.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredPresets.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedUrl(preset.url);
                      setCaption(preset.title);
                    }}
                    className={`group relative rounded-xl overflow-hidden border-2 cursor-pointer transition-colors ${
                      selectedUrl === preset.url
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-border'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.title}
                      className="w-full h-28 object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 flex items-end p-2">
                      <span className="text-[11px] text-white font-semibold truncate">{preset.title}</span>
                    </div>
                    {selectedUrl === preset.url && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: URL INPUT */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  כתובת התמונה באינטרנט (URL)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={customUrlInput}
                    onChange={(e) => {
                      setCustomUrlInput(e.target.value);
                      setSelectedUrl(e.target.value);
                    }}
                    className="w-full pl-3 pr-9 py-2 border border-input rounded-lg text-xs focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                  <LinkIcon className="w-4 h-4 text-muted-foreground absolute right-3 top-2.5" />
                </div>
              </div>

              {customUrlInput && (
                <div className="p-3 bg-muted border border-border rounded-xl text-center">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">תצוגה מקדימה:</p>
                  <img
                    src={customUrlInput}
                    alt="תצוגה מקדימה"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                    className="max-h-40 max-w-full rounded-lg mx-auto object-cover border border-border"
                  />
                </div>
              )}
            </div>
          )}

          {/* IMAGE OPTIONS (Caption, Size, Alignment) */}
          {(selectedUrl || customUrlInput) && (
            <div className="bg-muted/60 p-4 rounded-xl border border-border space-y-4">
              <h3 className="text-xs font-extrabold text-foreground border-b border-border pb-1.5">
                הגדרות תצוגה במסמך
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Caption Input */}
                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    תיאור תמונה (Caption):
                  </label>
                  <input
                    type="text"
                    placeholder="לדוגמה: תמונת צוות הפרויקט..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full px-3 py-1.5 bg-card border border-input rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Alignment */}
                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    יישור במסמך:
                  </label>
                  <div className="flex bg-card rounded-lg border border-input p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setAlignment('right')}
                      className={`flex-1 py-1 rounded font-bold transition-colors ${
                        alignment === 'right' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      ימין
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlignment('center')}
                      className={`flex-1 py-1 rounded font-bold transition-colors ${
                        alignment === 'center' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      מרכז
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlignment('left')}
                      className={`flex-1 py-1 rounded font-bold transition-colors ${
                        alignment === 'left' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      שמאל
                    </button>
                  </div>
                </div>
              </div>

              {/* Size Slider */}
              <div>
                <div className="flex justify-between items-center text-[11px] font-bold text-foreground mb-1">
                  <span>גודל התמונה במסמך:</span>
                  <span className="font-mono text-primary">{widthPercent}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={widthPercent}
                  onChange={(e) => setWidthPercent(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-muted border-t border-border px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            ביטול
          </button>

          <button
            onClick={handleConfirmInsert}
            disabled={!selectedUrl && !customUrlInput}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-6 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>הכנס תמונה למסמך</span>
          </button>
        </div>

      </div>
    </div>
  );
};
