# דרישות: סביבת פיתוח (IDE) למשימות אינטראקטיביות — App2Class

מסמך דרישות למי שבונה את הפיצ'ר בנפרד. מבוסס על סעיף "סביבת הפיתוח למשימות אינטראקטיביות (Task IDE & Sandbox)" באיפיון המקורי, בהשוואה למה שכבר קיים בקוד היום. **תעדוף**: כל מה שמסומן 🔴 הוא הליבה שבלעדיה הפיצ'ר לא שווה כלום. 🟡 זה שיפור משמעותי. 🟢 זה תוספת נחמדה שאפשר לדחות לגרסה הבאה.

---

## 0. מה כבר קיים בקוד (חשוב לדעת לפני שמתחילים)

כדי לא לבנות דבר שכבר קיים, ולא לשבור את מה שכבר עובד:

- **`src/components/task-studio/BlankHtmlMode.tsx`** — המימוש הנוכחי, חלש מאוד: `<Textarea>` פשוט (בלי הדגשת תחביר, בלי autocomplete), בלוב HTML/JS אחד בלבד (אין הפרדה ל-JS/CSS/HTML נפרדים, אין Python), "אופטימיזציה אוטומטית" ע"י קריאה ל-edge function `ai-tutor` שמבקשת מ-Gemini לשפר את הקוד — זה **לא** debugger אמיתי, זה רק שכתוב.
- **חוזה הציונים כבר עובד וצריך להישמר**: הקוד שהמורה כותב אמור לקרוא ל-`window.parent.postMessage({type:'score', score:X, total:Y}, '*')`. הצד של התלמיד (`src/pages/dashboard/StudentPracticePage.tsx` שורות 99–126) מאזין ל-`message` event, כותב את הציון ל-`submissions.grade` (כאחוז) וקובע `status='submitted'`. **כל מימוש חדש חייב לשמור על החוזה הזה** (או להחליף אותו בתיאום מלא עם שינוי הצד הקורא), אחרת כל המשימות הקיימות מהסוג הזה יפסיקו לעבוד.
- **איחסון המשימה**: כרגע קוד ה-HTML נשמר כ-JSON מוצפן-כמחרוזת בתוך `assignments.description` (`JSON.stringify({type:"blank-html", code})`) — פריצה זמנית, לא סכמה אמיתית. **לא לבנות עוד פיצ'רים על גבי ההאק הזה** — צריך טבלה ייעודית (ראה סעיף 4).
- **הרצה בצד תלמיד**: `<iframe srcDoc={htmlCode} sandbox="allow-scripts allow-same-origin">`. שילוב `allow-scripts` + `allow-same-origin` יחד על `srcDoc` הוא **בעיית אבטחה ידועה** (מאפשר לקוד של המורה לצאת מה-sandbox ולגשת ל-DOM/storage של האפליקציה הראשית) — לתקן, לא להעתיק הלאה.
- **`src/pages/dashboard/TaskStudioPage.tsx`** — ה"מרכז" שמארח את כל מצבי יצירת המשימות (`STUDIO_MODES` array + `renderActiveMode()` switch). כל מצב מקבל `{ profile, assignmentId, onBack }`. אם בונים רכיב חדש, הוא צריך להתחבר לפה באותו pattern (ראה איך `BagrutCoverageBar` חובר ב-commit קודם כדוגמה נקייה).
- **אין היום**: שום ספריית עורך קוד (Monaco/CodeMirror), שום Python runtime, שום ספריית p5.js/Chart.js/Three.js, שום bucket ייעודי לאחסון סטטי (יש רק `lesson-files` — bucket ציבורי כללי לקבצים).
- **טבלת `assignments.type`** היא enum קבוע: `homework | exam | quiz | project | exercise` — אין ערך `interactive`/`code`. לשקול אם צריך להוסיף ערך, או להסתפק בטבלה נפרדת (ראה סעיף 4).

---

## 1. עורך הקוד (צד מורה) 🔴

- עורך קוד אמיתי בתוך הדפדפן — **Monaco Editor** (אותו מנוע כמו VS Code) מומלץ; CodeMirror 6 חלופה קלה יותר אם גודל ה-bundle קריטי.
- הדגשת תחביר (syntax highlighting) + autocomplete/IntelliSense בסיסי.
- **טאבים/פאנלים נפרדים** ל-HTML / CSS / JavaScript (לא בלוב אחד כמו היום), עם אפשרות מעבר גם ל-**Python**.
- מספרי שורות, קיפול קוד (code folding), חיפוש-והחלפה.
- שמירה אוטומטית (autosave) לטיוטה — משימה שהמורה כותב לא אמורה להימחק ברענון דף.
- Undo/Redo תקין בתוך העורך (לא רק Ctrl+Z של הדפדפן).

## 2. שפות וספריות 🟡

- JS/CSS/HTML — הליבה, חובה.
- **Python** בצד לקוח — `Pyodide` (Python-in-WASM) הוא הפתרון המעשי היחיד להרצת Python בדפדפן בלי שרת ייעודי; לקחת בחשבון שהוא כבד (~10MB+ download), לטעון lazy רק כשנבחר Python.
- **הזרקת ספריות** (checkbox/dropdown, לא ידני): `p5.js` (גרפיקה/סימולציות), `Chart.js` (ויזואליזציית נתונים), `Three.js` (תלת-מימד). להזריק כ-`<script src="cdn...">` בתוך ה-`srcDoc` המורכב, לא לטעון ב-bundle הראשי.
- לשקול מגבלת CSP/CDN — אם האפליקציה חוסמת סקריפטים חיצוניים ב-CSP הראשי, ה-iframe המבודד (ראה סעיף 6) צריך CSP משלו, מקל יותר.

## 3. תצוגה מקדימה (Live Preview) 🔴

- מסך מחולק: עורך קוד בצד אחד, iframe עם תוצאה חיה בצד שני.
- **הרצה בזמן אמת** — debounce (500ms-1s) על שינוי קוד, לא על כל הקשה.
- **טוגל רספונסיביות**: כפתורי "טלפון" / "אייפד" / "מחשב" שמשנים את רוחב ה-iframe preview כדי שהמורה יראה איך זה ייראה על מכשירי התלמידים.
- Console output בסיסי בתוך ה-preview (console.log מהקוד של המורה מוצג למורה, לא רק ל-devtools).

## 4. מודל נתונים חדש 🔴

צריך טבלה ייעודית (Supabase migration) במקום ה-JSON-in-description hack:

```sql
create table public.interactive_tasks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  school_id uuid references public.schools(id),
  title text not null,
  language text not null check (language in ('web', 'python')), -- 'web' = html/css/js bundle
  html_code text,
  css_code text,
  js_code text,
  python_code text,
  libraries text[] default '{}', -- e.g. ['p5js', 'chartjs']
  grading_schema jsonb, -- optional: what finalGrade means, max score etc.
  is_public_template boolean not null default false, -- לגלריית קהילה (סעיף 8)
  forked_from uuid references public.interactive_tasks(id),
  published_url text, -- לאחר "פרסום" (סעיף 7)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS: המורה היוצר יכול לנהל את שלו; שאר המורים יכולים לקרוא רק שורות עם `is_public_template = true` (לגלריה); תלמידים לא ניגשים לטבלה הזו ישירות — הם מקבלים רק את הקוד המורכב (compiled) דרך ה-assignment, לא את המקור הגולמי (אלא אם רוצים "הצג קוד מקור" כפיצ'ר לימודי מפורש).

## 5. AI Coding Assistant 🟡

שני פיצ'רים נפרדים, לא לבלבל:

- **Prompt-to-Code**: המורה כותב תיאור חופשי ("עיגול שזז לפי פונקציה ריבועית שהתלמיד מקליד") ומקבל קוד מוכן. **כבר יש infrastructure מתאים** — `supabase/functions/ai-tutor` ו/או `supabase/functions/task-studio-ai` — אפשר להוסיף שם action ייעודי (`generate_interactive_code`) במקום לבנות edge function חדשה מאפס.
- **AI Debugger אמיתי**: זה **לא** קיים היום (מה ש-`BlankHtmlMode` עושה זה שכתוב גורף, לא איתור תקלה). דרישה: המורה לוחץ "בדוק שגיאה", ה-AI מקבל את הקוד + הודעת השגיאה מה-console של ה-preview (סעיף 3), ומחזיר: מספר שורה + הסבר קצר + הצעת תיקון — לא סתם קוד חדש שלם. אפשר לממש כ-prompt נפרד שמקבל stack trace אמיתי, לא ניחוש.

## 6. הרצה בטוחה (Sandbox) 🔴 — הכי קריטי מבחינת אבטחה

- **לא** `allow-scripts allow-same-origin` ביחד על אותו iframe (ראה סעיף 0). אם צריך `allow-same-origin` (לדוגמה בשביל `localStorage` בתוך המשימה עצמה), ה-iframe חייב לרוץ ב**origin נפרד לגמרי** (subdomain כמו `sandbox.app2class...` או דומיין חיצוני ייעודי), לא כ-`srcDoc` על אותו origin כמו שאר האפליקציה.
- קוד שהתלמיד/המורה כותב **אף פעם** לא רץ ב-context הראשי של האפליקציה (לא ב-`eval` בדף הראשי, לא ב-Worker משותף).
- להגביל CSP בתוך ה-sandbox: לחסום גישה ל-`window.top`, לחסום ניסיון navigation החוצה (`sandbox="allow-scripts"` בלבד, בלי `allow-top-navigation`).
- Timeout על ריצה (למקרה של לולאה אינסופית שתלמיד/מורה כתבו בטעות) — Web Worker עם `terminate()` אחרי X שניות, או לפחות watchdog ב-iframe.
- לוודא שקוד שרץ ב-sandbox לא יכול לגשת ל-`supabase` client, ל-JWT/session token, או לכל state של האפליקציה הראשית — התקשורת היחידה מותרת היא `postMessage` עם חוזה מוגדר וקשיח (whitelist של type-ים מותרים: `score`, `state-save`, `console-log` — לא "כל דבר").

## 7. פרסום ואחסון סטטי (Static Hosting) 🟡

- לפי האיפיון: "מרגע שהמורה לוחץ על 'פרסם', הקוד הופך לדף אינטרנט סטטי המאוחסן בשרת" — כלומר לא להגיש כל פעם מחדש מה-DB, אלא **לבנות (build) פעם אחת ולהעלות ל-Supabase Storage**.
- ליצור bucket ייעודי (`interactive-tasks`, public read בלבד, write רק דרך edge function מאומתת — **לא** ישירות מהקליינט, כדי שלא כל אחד יוכל להעלות דף שרירותי).
- בעת פרסום: לארוז HTML+CSS+JS+ספריות לקובץ HTML יחיד (self-contained) ולהעלות ל-storage; `interactive_tasks.published_url` מצביע לשם; ה-`iframe` בצד תלמיד טוען מה-URL הסטטי (מהיר יותר, ולא חושף שוב את קוד המקור המלא לכל בקשה).

## 8. גלריית קהילת מורים + Fork 🟢

- מסך "גלריה" בתוך ה-Task Studio: רשימת `interactive_tasks` עם `is_public_template = true`, עם preview thumbnail, שם מורה, מקצוע.
- כפתור "Fork" — יוצר שורה חדשה ב-`interactive_tasks` עם `forked_from` מצביע למקור, `author_id` = המורה החדש, ואז הוא יכול לערוך חופשי (למשל להחליף טקסט היסטוריה לאזרחות) בלי לגעת במקור.
- לא חובה ל-v1 — אפשר לדחות.

## 9. ניהול State וציון 🔴

- **לשמר את חוזה ה-`postMessage` הקיים** (`{type:'score', score, total}`) בדיוק כמו שהוא — `StudentPracticePage.tsx` כבר כותב אותו ל-`submissions.grade`.
- **תוספת חדשה נדרשת**: משימה ארוכה שצריכה "לזכור" איפה התלמיד עצר (ה-state, לא רק הציון הסופי). להוסיף type נוסף לחוזה: `{type:'state-save', state: <json>}` שנשמר בטבלה חדשה (`interactive_task_progress: student_id, assignment_id, state jsonb, updated_at`), ובטעינה חוזרת — לשלוח את ה-state הזה בחזרה ל-iframe דרך `postMessage` מהצד השני (`{type:'state-load', state}`) כדי שהקוד של המורה ידע לשחזר.

## 10. Analytics — Time-on-Task 🟢

- להזריק סקריפט קטן (analytics hook) לתוך כל דף מפורסם, שסופר זמן פעיל (לא רק "פתוח בטאב") ושולח `postMessage({type:'time-tick', seconds: N})` כל ~30 שניות. הצד המארח צובר את זה לטבלת `interactive_task_progress` (או טבלה נפרדת). זה עובד גם אם המורה עצמו לא כתב קוד למדידה (ה-hook מוזרק אוטומטית בזמן ה-build/פרסום, לא תלוי במורה).

## 11. פיצ'ר נפרד: IDE לתכנות אמיתי (לתלמידי מדעי המחשב) 🟢

באיפיון זה מוזכר בנפרד, בקצרה, תחת "Advanced AI Task Builder" — **לא** להתבלבל עם הבילדר האינטראקטיבי למעלה:

- מורה מדעי מחשב יוצר משימת תכנות; **התלמיד** (לא המורה) כותב קוד אמיתי (Python/Java) ישירות באפליקציה כפתרון למטלה.
- דרישות מינימליות: עורך קוד (אותו Monaco/CodeMirror), הרצה (Python via Pyodide כמו לעיל; Java דורש runtime בצד שרת — Judge0 API או דומה, הרבה יותר כבד — אולי להסתפק ב-v1 ב-Python בלבד ולציין Java כ"בעתיד"), המורה מקבל גם את הפלט (output) וגם את קוד המקור לבדיקה.
- זה בעצם אותה תשתית עריכה/הרצה מסעיפים 1–6, רק שהצרכן הוא תלמיד שממלא תשובה, לא מורה שבונה משימה. שווה לתכנן מהתחלה כך שאותו רכיב עורך-קוד עובד בשני ההקשרים (`mode="author"` מול `mode="solve"`), לא לבנות שני עורכים נפרדים.

---

## סיכום סדר עדיפויות מוצע

1. **v1 (MVP שווה שימוש)**: סעיפים 1 (עורך אמיתי) + 3 (preview) + 4 (טבלה אמיתית) + 6 (sandbox בטוח) + 9 (שימור חוזה הציונים). בלי זה, אין שיפור אמיתי על המצב הקיים.
2. **v2**: סעיף 2 (Python/ספריות) + 5 (AI debugger אמיתי) + 7 (hosting סטטי) + 11 (IDE לתלמיד).
3. **v3 / נחמד-להיות**: 8 (גלריה+fork), 10 (analytics).

## נקודות שדורשות החלטה לפני שמתחילים לבנות

- Monaco או CodeMirror? (Monaco = חוויית VS Code, bundle כבד יותר; CodeMirror 6 = קל יותר, פחות "מוכר").
- Pyodide ל-Python — לקבל שזה ~10MB+ טעינה חד-פעמית, לא בעיה לתכנות "כבד" אבל שקלול מול UX.
- דומיין/subdomain נפרד ל-sandbox iframe — יש כזה זמין, או צריך להקצות?
- האם לפרסם דרך edge function (מומלץ, בטוח יותר) או Storage-upload ישיר עם RLS מחמיר על ה-bucket.
