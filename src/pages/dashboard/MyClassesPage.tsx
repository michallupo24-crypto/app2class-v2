import { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Search, ClipboardList, Crown } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ClassInfo {
  id: string;
  grade: string;
  number: number;
  isHomeroom: boolean;
}

interface StudentEntry {
  id: string;
  fullName: string;
  avatarConfig: any | null;
}

const MyClassesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadClasses = async () => {
      setLoadingClasses(true);
      const { data } = await supabase
        .from("teacher_classes")
        .select("class_id, is_homeroom, classes(id, grade, class_number)")
        .eq("user_id", profile.id);

      const list: ClassInfo[] = (data || [])
        .map((row: any) => row.classes && ({
          id: row.classes.id,
          grade: row.classes.grade,
          number: row.classes.class_number,
          isHomeroom: !!row.is_homeroom,
        }))
        .filter(Boolean);

      setClasses(list);
      if (list.length > 0) setSelectedClassId(list[0].id);
      setLoadingClasses(false);
    };
    loadClasses();
  }, [profile.id]);

  useEffect(() => {
    if (!selectedClassId) { setStudents([]); return; }
    const loadStudents = async () => {
      setLoadingStudents(true);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("class_id", selectedClassId)
        .eq("is_approved", true)
        .order("full_name");

      if (!profiles || profiles.length === 0) { setStudents([]); setLoadingStudents(false); return; }

      const { data: avatars } = await supabase
        .from("avatars")
        .select("*")
        .in("user_id", profiles.map((p: any) => p.id));

      const avatarMap = new Map((avatars || []).map((a: any) => [a.user_id, {
        faceShape: a.face_shape, skinColor: a.skin_color, eyeShape: a.eye_shape, eyeColor: a.eye_color,
        hairStyle: a.hair_style, hairColor: a.hair_color, facialHair: a.facial_hair || "none",
        outfit: a.outfit, outfitColor: a.outfit_color, accessory: a.accessory || "none",
        expression: a.expression || "smile", background: a.background,
      }]));

      setStudents(profiles.map((p: any) => ({
        id: p.id,
        fullName: p.full_name,
        avatarConfig: avatarMap.get(p.id) || null,
      })));
      setLoadingStudents(false);
    };
    loadStudents();
  }, [selectedClassId]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(s => s.fullName.toLowerCase().includes(q));
  }, [students, search]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  if (loadingClasses) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground font-body">טוען כיתות...</div>
  );

  if (classes.length === 0) return (
    <Card>
      <CardContent className="py-16 text-center text-muted-foreground font-body">
        לא שובצת עדיין לאף כיתה.
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> הכיתות שלי
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">הכיתה הדיגיטלית — זיהוי מהיר של תלמידים לפי אווטאר</p>
        </div>
        {selectedClassId && (
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/roll-call")} className="gap-2">
            <ClipboardList className="h-4 w-4" /> הקראת שמות לכיתה זו
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {classes.map(c => (
          <Button
            key={c.id}
            variant={selectedClassId === c.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedClassId(c.id)}
            className="gap-2 rounded-xl"
          >
            {c.isHomeroom && <Crown className="h-3.5 w-3.5" />}
            כיתה {c.grade}'{c.number}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        {selectedClass && (
          <Badge variant="outline" className="text-xs font-bold">
            {students.length} תלמידים בכיתה {selectedClass.grade}'{selectedClass.number}
            {selectedClass.isHomeroom && " • כיתת חינוך"}
          </Badge>
        )}
        <div className="relative w-full max-w-xs">
          <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש תלמיד/ה..."
            className="w-full bg-muted rounded-lg pr-9 pl-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {loadingStudents ? (
        <div className="py-16 text-center text-muted-foreground font-body">טוען תלמידים...</div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
        >
          {filteredStudents.map(s => (
            <motion.div key={s.id} variants={item}>
              <Card className="flex flex-col items-center gap-2 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all border-none bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
                {s.avatarConfig ? (
                  <AvatarPreview config={s.avatarConfig} size={72} />
                ) : (
                  <div className="w-[72px] h-[72px] rounded-2xl bg-muted flex items-center justify-center text-2xl">👤</div>
                )}
                <p className="text-xs font-heading font-bold text-center leading-tight">{s.fullName}</p>
              </Card>
            </motion.div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground font-body">
              לא נמצאו תלמידים תואמים לחיפוש.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MyClassesPage;
