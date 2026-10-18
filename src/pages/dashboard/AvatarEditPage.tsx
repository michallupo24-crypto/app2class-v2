import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AvatarStudio, { defaultAvatarConfig, type AvatarConfig } from "@/components/avatar/AvatarStudio";
import type { UserProfile } from "@/hooks/useAuth";
import { saveAvatar } from "@/components/avatar/avatarModel";

const AvatarEditPage = () => {
  const { profile, refresh } = useOutletContext<{ profile: UserProfile; refresh: () => Promise<void> }>();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig>(profile.avatar || defaultAvatarConfig);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAvatar(supabase, profile.id, avatar);

      await refresh();
      toast({ title: "האווטאר נשמר", description: "הוא יופיע עכשיו בכל המערכת" });
    } catch (error: any) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-[28px] font-black leading-tight text-foreground">עורך אווטאר</h1>
          <p className="font-body text-sm font-semibold text-muted-foreground">כך יראו אותך בצ'אט, במפת הכיתה ובתפריט הצד</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.history.back()} variant="outline" className="gap-1.5">
            <ArrowRight className="h-4 w-4" />
            חזרה
          </Button>
          <Button onClick={handleSave} disabled={saving} className="px-6">
            {saving ? "שומר..." : "שמירה"}
          </Button>
        </div>
      </div>
      <AvatarStudio config={avatar} onChange={setAvatar} />
    </div>
  );
};

export default AvatarEditPage;
