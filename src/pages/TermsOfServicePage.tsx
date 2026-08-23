import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TermsOfServicePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-4 text-muted-foreground">
          <ArrowRight className="w-4 h-4" />
          חזרה
        </Button>

        <h1 className="text-3xl font-heading font-bold mb-2">תנאי שימוש</h1>
        <p className="text-sm text-muted-foreground font-body mb-6">עודכן לאחרונה: 23 באוגוסט 2026</p>

        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="py-4 text-sm font-body text-muted-foreground">
            <p>
              <strong>הערה:</strong> זהו נוסח טיוטה שנועד לתת מסגרת ראשונית לתנאי השימוש. לפני פרסום רשמי
              לציבור הרחב, יש להעביר את המסמך לבדיקת עורך/ת דין המתמחה בפרטיות ובדיני חינוך בישראל -
              במיוחד לאור העובדה שהמערכת מעבדת מידע של קטינים.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 font-body text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-heading font-bold mb-2">1. כללי</h2>
            <p>
              App2Class ("המערכת", "השירות") היא מערכת ניהול בית ספרית המיועדת לשימוש תלמידים, הורים
              וצוות חינוכי בבתי ספר בישראל. השימוש בשירות כפוף לתנאים המפורטים במסמך זה. הרשמה לשירות
              או המשך השימוש בו מהווים הסכמה לתנאים אלה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">2. הרשאת שימוש והרשמה</h2>
            <p>
              הגישה למערכת מיועדת אך ורק לתלמידים, הורים/אפוטרופסים וצוות חינוכי המשויכים לבית ספר
              שרשום במערכת. הרשמת קטין (תלמיד/ה) מתבצעת בכפוף לאישור בית הספר ו/או ההורה כנדרש
              בתהליך הרישום. משתמש/ת אחראי/ת לשמור על סודיות פרטי ההתחברות שלו/ה ולא להעבירם לאחר.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">3. שימוש הולם</h2>
            <p>
              אין להשתמש בשירות לצורך העלאת תוכן פוגעני, מטעה או בלתי חוקי, אין לנסות לעקוף מנגנוני
              הרשאה או אבטחה, ואין להשתמש בכלי ה-AI המובנים באופן שמפר את תנאי השימוש של ספקי ה-AI
              עצמם. בית הספר רשאי להגביל או להשעות גישה של משתמש/ת שמפר/ה תנאים אלה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">4. תוכן ונתונים</h2>
            <p>
              ציונים, נוכחות, הערות והודעות המוזנים למערכת על ידי צוות בית הספר משקפים מידע לצורך
              ניהול פדגוגי ואינם מהווים תיעוד רשמי רגולטורי אלא אם נאמר אחרת. לפרטים על איסוף ושימוש
              במידע אישי, ראו את <a href="/privacy" className="underline text-primary">מדיניות הפרטיות</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">5. הגבלת אחריות</h2>
            <p>
              השירות מסופק כמות שהוא ("as is"). ככל שיהיה שימוש בכלי בינה מלאכותית לצורך יצירת תכנים
              לימודיים, מענה או תובנות - יש לבחון את התוצרים ביקורתית ולא להסתמך עליהם כתחליף לשיקול
              דעת מקצועי של צוות ההוראה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-bold mb-2">6. יצירת קשר</h2>
            <p>
              לשאלות בנוגע לתנאי השימוש ניתן לפנות דרך עמוד התמיכה במערכת.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
