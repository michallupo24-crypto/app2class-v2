import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-4 text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Button>

        <h1 className="text-3xl font-heading font-bold mb-2">מדיניות פרטיות</h1>
        <p className="text-sm text-muted-foreground font-body mb-6">עודכן לאחרונה: 23 באוגוסט 2026</p>

        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm font-body text-muted-foreground">
            <p>
              <strong>הערה:</strong> זהו נוסח טיוטה שנועד לתת מסגרת ראשונית למדיניות הפרטיות. לפני
              פרסום רשמי לציבור הרחב, יש להעביר את המסמך לבדיקת עורך/ת דין המתמחה בדיני פרטיות
              בישראל (חוק הגנת הפרטיות, ותקנותיו) - במיוחד לאור העובדה שהמערכת מעבדת מידע רגיש של
              קטינים, לרבות ציונים, נוכחות, ולעיתים מספרי תעודת זהות.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 font-body text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-heading font-bold mb-2">1. איזה מידע נאסף</h2>
            <p>
              המערכת אוספת מידע הנדרש לצורך ניהול פדגוגי ותפעולי של בית הספר: פרטי זיהוי (שם, תאריך
              לידה, ולעיתים מספר תעודת זהות - המוצפן במסד הנתונים), פרטי קשר (אימייל), שיוך לבית ספר
              וכיתה, ציונים ונוכחות, תוצרי משימות והגשות, והודעות בין משתמשים במערכת (למשל צ'אט
              כיתתי). מידע טכני בסיסי (כגון זמני התחברות) נשמר לצורכי אבטחה ותפעול.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">2. למה המידע משמש</h2>
            <p>
              המידע משמש לניהול הלמידה וההוראה בבית הספר: מעקב אחר התקדמות תלמידים, תקשורת בין
              תלמידים/הורים/צוות, ותפעול כלים לימודיים (כולל כלי AI ליצירת תרגול ותמיכה לימודית).
              מידע אישי אינו נמכר או מועבר לגורמי צד שלישי למטרות שיווק.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">3. מי יכול לגשת למידע</h2>
            <p>
              הגישה למידע מוגבלת לפי תפקיד ולפי שיוך לבית ספר: תלמיד/ה רואה בעיקר את המידע שלו/ה
              עצמו/ה; הורה רואה מידע של ילדיו/ה הרשומים; צוות הוראה וניהול רואה מידע של תלמידים
              בכיתות/שכבות שבאחריותם, בהתאם למדיניות הרשאות הגישה (RLS) המיושמת ברמת מסד הנתונים.
              משתמשים מבתי ספר אחרים אינם אמורים לראות מידע של בית ספרכם.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">4. כלי בינה מלאכותית (AI)</h2>
            <p>
              חלק מהתכונות במערכת (עוזר לימודי, יצירת שאלות תרגול, ניתוח תשובות) משתמשות בשירותי AI
              חיצוניים. תוכן שנשלח לצורך תכונות אלה (למשל שאלה של תלמיד, או הקשר לימודי רלוונטי כמו
              ממוצע ציונים) מועבר לספק ה-AI לצורך יצירת המענה בלבד, ואינו נשמר על ידו לאימון מודלים
              מעבר למדיניות הפרטיות של אותו ספק.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">5. אבטחת מידע</h2>
            <p>
              המערכת נשענת על מנגנוני אבטחה ברמת מסד הנתונים (הרשאות גישה לפי שורה - RLS), הצפנה
              של שדות רגישים במיוחד (כגון מספרי תעודת זהות), והרשאות מבוססות-תפקיד. עם זאת, אין
              מערכת חסינה לחלוטין, ואנו פועלים לשפר את האבטחה באופן שוטף.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">6. זכויות הורים ותלמידים</h2>
            <p>
              הורה/אפוטרופוס רשאי/ת לפנות בבקשה לעיין, לתקן או למחוק מידע אישי של ילדו/ה הרשום
              במערכת, בכפוף לחובות השמירה של בית הספר לפי כל דין. פניות כאמור ניתן להפנות לבית
              הספר או דרך עמוד התמיכה במערכת.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">7. שמירת מידע</h2>
            <p>
              מידע נשמר למשך תקופת הלימודים ולפרק זמן נוסף בהתאם לצרכים תפעוליים ורגולטוריים של
              בית הספר, אלא אם התקבלה בקשת מחיקה תקפה כאמור בסעיף 6.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">8. יצירת קשר</h2>
            <p>
              לשאלות או בקשות בנוגע לפרטיותכם/ן ניתן לפנות דרך עמוד התמיכה במערכת.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
