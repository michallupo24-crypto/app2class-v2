import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, List, ListOrdered, Quote, Link as LinkIcon, Heading2, Heading3 } from "lucide-react";

interface ArticleRichEditorProps {
  value: string;
  onChange: (html: string) => void;
}

const TOOLBAR_ACTIONS: { icon: typeof Bold; label: string; command: string; arg?: string }[] = [
  { icon: Bold, label: "מודגש", command: "bold" },
  { icon: Italic, label: "נטוי", command: "italic" },
  { icon: Underline, label: "קו תחתון", command: "underline" },
  { icon: Heading2, label: "כותרת גדולה", command: "formatBlock", arg: "h2" },
  { icon: Heading3, label: "כותרת קטנה", command: "formatBlock", arg: "h3" },
  { icon: List, label: "רשימה", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "רשימה ממוספרת", command: "insertOrderedList" },
  { icon: Quote, label: "ציטוט", command: "formatBlock", arg: "blockquote" },
];

const ArticleRichEditor = ({ value, onChange }: ArticleRichEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only touches the DOM when value diverges from what's already there, so
    // normal typing (which updates value via onInput to match) never resets
    // the cursor - this only fires for genuine external changes, like
    // loading a different article into the same mounted editor.
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const runCommand = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    onChange(editorRef.current?.innerHTML || "");
  };

  const insertLink = () => {
    const url = window.prompt("כתובת הקישור:");
    if (!url) return;
    runCommand("createLink", url);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 p-1.5 border-b bg-muted/30">
        {TOOLBAR_ACTIONS.map(({ icon: Icon, label, command, arg }) => (
          <Button key={label} type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title={label} onClick={() => runCommand(command, arg)}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title="קישור" onClick={insertLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        dir="rtl"
        className="min-h-[180px] max-h-[400px] overflow-y-auto p-3 text-sm focus:outline-none [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_blockquote]:border-r-2 [&_blockquote]:pr-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder="תוכן הכתבה..."
        suppressContentEditableWarning
      />
    </div>
  );
};

export default ArticleRichEditor;
