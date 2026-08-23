import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RegistrationLayout from "@/components/registration/RegistrationLayout";
import EmailInput from "@/components/registration/EmailInput";
import AvatarStudio, { defaultAvatarConfig, type AvatarConfig } from "@/components/avatar/AvatarStudio";
import TrackSelector, { type TrackSelection, EMPTY_TRACK_SELECTION } from "@/components/registration/TrackSelector";
import { GRADES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidIsraeliId } from "@/lib/israeliId";

const StudentRegistration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [grade, setGrade] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Step 2 - tracks
  const [tracks, setTracks] = useState<TrackSelection>(EMPTY_TRACK_SELECTION);

  // Step 3
  const [avatar, setAvatar] = useState<AvatarConfig>(defaultAvatarConfig);

  // Schools list
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("schools").select("id, name").then(({ data }) => {
      if (data) setSchools(data);
    });
  }, []);

  const isHighSchool = ["י", "יא", "יב"].includes(grade);
  const totalSteps = isHighSchool ? 4 : 3;
  const step1Valid = fullName && password.length >= 6 && schoolId && email && isValidIsraeliId(idNumber) && grade && classNumber && dateOfBirth;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Find class_id
      const { data: classData } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("grade", grade as any)
        .eq("class_number", parseInt(classNumber))
        .single();

      if (!classData) {
        toast({ title: "שגיאה", description: "הכיתה לא נמצאה", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      const userId = authData.user.id;

      // Update profile (including date_of_birth)
      const { error: profileError } = await supabase.from("profiles").update({
        full_name: fullName,
        phone: null,
        id_number: idNumber,
        school_id: schoolId,
        class_id: classData.id,
        date_of_birth: dateOfBirth || null,
      } as any).eq("id", userId);
      if (profileError) throw profileError;

      // Add student role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "student" as any,
      });
      if (roleError) throw roleError;

      // Save avatar
      const { error: avatarError } = await supabase.from("avatars").insert({
        user_id: userId,
        face_shape: avatar.body_type || "basic",
        skin_color: avatar.skin || "#FDDBB4",
        eye_shape: "round",
        eye_color: avatar.eye_color || "brown",
        hair_style: avatar.hair_style || "boy",
        hair_color: avatar.hair_color || "#2C1A0E",
        facial_hair: avatar.facialHair || "none",
        outfit: avatar.outfit || "casual",
        outfit_color: avatar.outfitColor || "#3B82F6",
        accessory: avatar.accessory || "none",
        expression: avatar.expression || "happy",
        background: avatar.background || "#E0F2FE",
      });
      if (avatarError) throw avatarError;

      // Save tracks
      const trackRows: any[] = [
        ...tracks.megamot.map(m => ({
          user_id: userId, school_id: schoolId, track_type: "megama",
          cluster_name: m.clusterName, track_name: m.subject, approved: false,
        })),
        ...tracks.hakbatzot.map(h => ({
          user_id: userId, school_id: schoolId, track_type: "hakbatza",
          base_subject: h.baseSubject, track_name: h.subject, approved: false,
        })),
      ];
      if (trackRows.length > 0) {
        const { error: tracksError } = await supabase.from("student_tracks").insert(trackRows);
        if (tracksError) throw tracksError;
      }

      // Create approval request
      const tracksSummary = tracks.megamot.length > 0
        ? ` | מגמות: ${tracks.megamot.map(m => m.subject).join(", ")}`
        : "";
      const hakbatzotSummary = tracks.hakbatzot.length > 0
        ? ` | הקבצות: ${tracks.hakbatzot.map(h => h.subject).join(", ")}`
        : "";
      const { error: approvalError } = await supabase.from("approvals").insert({
        user_id: userId,
        required_role: "educator" as any,
        notes: `תלמיד/ה חדש/ה: ${fullName}${tracksSummary}${hakbatzotSummary}`,
      });
      if (approvalError) throw approvalError;

      // Sign out since not approved yet
      await supabase.auth.signOut();

      setStep(totalSteps + 1);
    } catch (error: any) {
      toast({
        title: "שגיאה ברישום",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === totalSteps + 1) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-muted to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <CheckCircle2 className="w-24 h-24 text-success mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl font-heading font-bold mb-3">הרישום הושלם! 🎉</h2>
          <p className="text-muted-foreground text-lg mb-2">החשבון שלך נוצר בהצלחה</p>
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
            <p className="text-sm font-heading font-medium text-warning">
              ⏳ ממתין לאישור מחנך/ת
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              החשבון שלך ייפתח לאחר אישור המחנך/ת שלך
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/")}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-heading font-bold shadow-lg"
          >
            חזרה לדף הראשי
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <RegistrationLayout
      title="רישום תלמיד/ה"
      step={step}
      totalSteps={totalSteps}
      onNext={step === totalSteps ? handleSubmit : () => setStep(step + 1)}
      onBack={() => setStep(step - 1)}
      nextDisabled={step === 1 ? !step1Valid : false}
      nextLabel={step === totalSteps ? "סיום רישום" : "המשך"}
      loading={loading}
    >
      {step === 1 && (
        <div className="space-y-5">
          <h3 className="text-xl font-heading font-bold mb-4">פרטים אישיים</h3>

          <div className="space-y-2">
            <Label className="font-heading">שם מלא (שם התלמיד/ה)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="שם פרטי ומשפחה" required />
          </div>

          <div className="space-y-2">
            <Label className="font-heading">תאריך לידה</Label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min="2005-01-01"
              required
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-heading">סיסמה</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים" dir="ltr" required />
            {password && password.length < 6 && (
              <p className="text-xs text-destructive">הסיסמה חייבת להכיל לפחות 6 תווים</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-heading">בית ספר</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger><SelectValue placeholder="בחר בית ספר" /></SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-heading">דואר אלקטרוני</Label>
            <EmailInput value={email} onChange={setEmail} />
          </div>

          <div className="space-y-2">
            <Label className="font-heading">תעודת זהות</Label>
            <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9 ספרות" dir="ltr" required />
            {idNumber.length === 9 && !isValidIsraeliId(idNumber) && (
              <p className="text-xs text-destructive font-body">מספר ת"ז לא תקין</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading">שכבה</Label>
              <Select value={grade} onValueChange={(v) => { setGrade(v); setClassNumber(""); }}>
                <SelectTrigger><SelectValue placeholder="בחר שכבה" /></SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}'</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-heading">כיתה</Label>
              <Select value={classNumber} onValueChange={setClassNumber} disabled={!grade}>
                <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{grade}'-{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {step === 2 && isHighSchool && (
        <div>
          <h3 className="text-xl font-heading font-bold mb-4">הקבצות ומגמות 📋</h3>
          <p className="text-sm text-muted-foreground mb-6">סמן/י את המגמות וההקבצות שלך</p>
          <TrackSelector grade={grade} schoolId={schoolId} value={tracks} onChange={setTracks} />
        </div>
      )}

      {step === (isHighSchool ? 3 : 2) && (
        <div>
          <h3 className="text-xl font-heading font-bold mb-4">עיצוב הדמות שלך 🎨</h3>
          <p className="text-sm text-muted-foreground mb-6">בחר/י את המראה שלך - תוכל/י לשנות בכל עת!</p>
          <AvatarStudio config={avatar} onChange={setAvatar} variant="student" />
        </div>
      )}
    </RegistrationLayout>
  );
};

export default StudentRegistration;
