import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { EMAIL_SUFFIXES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
}

const EmailInput = ({ value, onChange }: EmailInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([...EMAIL_SUFFIXES]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (supabase as any)
      .from("allowed_email_domains")
      .select("domain")
      .eq("is_active", true)
      .then(({ data }: { data: { domain: string }[] | null }) => {
        if (data && data.length > 0) setAllowedDomains(data.map((d) => d.domain));
      });
  }, []);

  const localPart = value.split("@")[0] || "";
  const hasAt = value.includes("@");
  const typedDomain = hasAt ? value.split("@")[1] : "";

  const filteredSuffixes = allowedDomains.filter((s) =>
    !typedDomain || s.startsWith(typedDomain)
  );

  const isFormatValid = value.length === 0 || EMAIL_REGEX.test(value);
  const domainAllowed = !hasAt || !typedDomain || allowedDomains.some((d) => d.toLowerCase() === typedDomain.toLowerCase());

  const handleSelect = (suffix: string) => {
    onChange(`${localPart}@${suffix}`);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(e.target.value.includes("@"));
        }}
        onFocus={() => setShowSuggestions(value.includes("@"))}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="name@email.com"
        dir="ltr"
        required
      />
      {showSuggestions && filteredSuffixes.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {filteredSuffixes.map((suffix) => (
            <button
              key={suffix}
              type="button"
              onClick={() => handleSelect(suffix)}
              className="w-full px-3 py-2 text-sm text-right hover:bg-muted transition-colors"
              dir="ltr"
            >
              {localPart}@{suffix}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && !isFormatValid && (
        <p className="text-xs text-destructive mt-1">כתובת מייל לא תקינה</p>
      )}
      {isFormatValid && hasAt && typedDomain && !domainAllowed && (
        <p className="text-xs text-destructive mt-1">סיומת המייל אינה מורשית להרשמה</p>
      )}
    </div>
  );
};

export default EmailInput;
