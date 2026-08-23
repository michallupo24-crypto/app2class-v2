import { Template, DocumentModel } from '../types';

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    nameHe: 'מסמך ריק',
    iconName: 'FileText',
    description: 'התחל מסמך נקי עם כל כלי העיצוב של Docs ו-Word',
    category: 'blank',
    dir: 'rtl',
    fontFamily: 'Rubik',
    contentHtml: `<p><br/></p>`
  },
  {
    id: 'business_report',
    name: 'Executive Business Report',
    nameHe: 'דו"ח עסקי ומנהלי',
    iconName: 'Briefcase',
    description: 'מבנה מקצועי לדו"ח עסקי כולל טבלת נתונים, סיכום מנהלים והמלצות',
    category: 'business',
    dir: 'rtl',
    fontFamily: 'Rubik',
    contentHtml: `
      <h1 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">דו"ח פעילות תקופתי - רבעון 3</h1>
      <p style="color: #64748b; font-size: 0.9em; margin-bottom: 20px;">תאריך: 11 באוגוסט 2026 | מגיש: צוות ניהול מוצר | סיווג: פנימי</p>
      
      <div style="background-color: #eff6ff; border-right: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1e40af;">📌 תמצית מנהלים (Executive Summary)</h3>
        <p style="margin-bottom: 0;">במהלך הרבעון החולף הושגה צמיחה של <strong>24%</strong> במשתמשים פעילים. השילוב בין שירותי ענן מתקדמים לכלי עריכה רשתית הוכיח את עצמו כמאיץ יעילות מרכזי בארגון.</p>
      </div>

      <h2>1. מטרות ויעדים אסטרטגיים</h2>
      <p>להלן סקירת היעדים שהוגדרו בתחילת התקופה וסטטוס הצעדים שבוצעו:</p>
      
      <ul>
        <li><strong>שדרוג חווית המשתמש:</strong> הטמעת סרגל כלים היברידי המשלב את הפשטות של Docs עם העוצמה של Word.</li>
        <li><strong>סנכרון בזמן אמת:</strong> שמירה אוטומטית מקומית ובענן עם מעקב גרסאות מלא.</li>
        <li><strong>שילוב AI יוצר:</strong> סיוע בכתיבה, ניסוח מחדש ותרגום בלחיצת כפתור.</li>
      </ul>

      <h2>2. נתונים ומדדי ביצוע (KPIs)</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.95em;">
        <thead>
          <tr style="background-color: #1e3a8a; color: white;">
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">מדד ביצוע</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">יעד רבעוני</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">תוצאה בפועל</th>
            <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">זמן שהייה ממוצע במסמך</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">18 דקות</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">24 דקות</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">🟢 עבר את היעד</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; padding: 10px;">קצב אימוץ כלי ה-AI</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">40%</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">68%</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">🟢 הצלחה יתרה</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">שביעות רצון משתמשים (CSAT)</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">4.5/5</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">4.8/5</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">🟢 מצויין</td>
          </tr>
        </tbody>
      </table>

      <h2>3. סיכום והצעדים הבאים</h2>
      <p>מומלץ להמשיך להרחיב את תכונות השיתוף, הוספת תמיכה בדיאגרמות דינמיות וייצוא מתקדם בפורמט PDF מעוצב.</p>
    `
  },
  {
    id: 'meeting_summary',
    name: 'Meeting Summary & Tasks',
    nameHe: 'סיכום ישיבה ומשימות',
    iconName: 'Users',
    description: 'מבנה מסודר לתיעוד דיונים, החלטות ורשימת משימות למעקב',
    category: 'business',
    dir: 'rtl',
    fontFamily: 'Heebo',
    contentHtml: `
      <h1 style="color: #0f766e;">סיכום ישיבת תכנון פרויקט</h1>
      <p style="color: #475569;"><strong>תאריך:</strong> 11/08/2026 | <strong>משתתפים:</strong> מיכל, דניאל, אלון, שירה | <strong>יו"ר:</strong> מיכל</p>
      
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 16px 0;" />

      <h3>📋 נושאים שעלו בדיון</h3>
      <ol>
        <li>סקירת ארכיטקטורת מעבד התמלילים ההיברידי (תצוגת רשת לעומת עמודים מודפסים).</li>
        <li>שילוב הליכי ביקורת, מעקב שינויים (Track Changes) והערות צפות.</li>
        <li>ייצוא והדפסה באיכות דפוס גבוהה.</li>
      </ol>

      <h3>💡 החלטות מרכזיות</h3>
      <ul>
        <li>הוחלט לאמץ את סרגל הכלים הטאבי (Ribbon Bar) של Word כברירת מחדל, עם אפשרות למצב ממוקד מינימליסטי של Docs.</li>
        <li>סוכם לשלב מנוע AI שיודע לעבוד גם בעברית וגם באנגלית ללא צורך בהגדרות סרבל.</li>
      </ul>

      <h3>✅ רשימת משימות וביצוע</h3>
      <p>לביצוע עד הישיבה הבאה:</p>
      <ul>
        <li>[ ] <strong>דניאל:</strong> השלמת בדיקות לרוחב שוליים וסרגל מידות.</li>
        <li>[ ] <strong>אלון:</strong> הוספת תמונות וטבלאות עם עיצוב גבולות מותאם.</li>
        <li>[ ] <strong>שירה:</strong> כתיבת מדריך משתמש מקוצר בפורמט PDF.</li>
      </ul>
    `
  },
  {
    id: 'resume',
    name: 'Modern Resume / CV',
    nameHe: 'קורות חיים מודרניים',
    iconName: 'UserCheck',
    description: 'פורמט נקי, מקצועי ומרשים לקורות חיים הפותח דלתות',
    category: 'personal',
    dir: 'rtl',
    fontFamily: 'Assistant',
    contentHtml: `
      <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #0369a1; font-size: 2em;">ישראל ישראלי</h1>
        <p style="margin: 6px 0 0 0; color: #475569; font-weight: 500;">מפתח תוכנה בכיר & מוביל טכנולוגי (Full Stack)</p>
        <p style="margin: 4px 0 0 0; font-size: 0.9em; color: #64748b;">
          📧 israel@example.com | 📱 050-1234567 | 📍 תל אביב | 🔗 linkedin.com/in/israel
        </p>
      </div>

      <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">תמצית מקצועית</h3>
      <p>מפתח תוכנה בעל 7 שנות ניסיון בפיתוח מערכות ענן מקביליות, ממשקי משתמש מורכבים ועורכי תוכן מתקדמים. בעל יכולת מוכחת להובלת פרויקטים משלב הרעיון ועד לייצור בענן.</p>

      <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">ניסיון תעסוקתי</h3>
      <p style="margin-bottom: 2px;"><strong>2023 - כיום | מפתח Full Stack בכיר - חברת הייטק בע"מ</strong></p>
      <ul>
        <li>פיתוח עורך מסמכים היברידי בזמן אמת המשמש מעל 100,000 משתמשים יומיים.</li>
        <li>אופטימיזציה של מנועי רינדור טקסט וטבלאות, שיפור בביצועים ב-40%.</li>
        <li>הובלת צוות של 4 מפתחים וליווי ארכיטקטוני.</li>
      </ul>

      <p style="margin-bottom: 2px;"><strong>2020 - 2023 | מפתח Frontend - Cloud Solutions</strong></p>
      <ul>
        <li>בניית אפליקציות Web מתקדמות ב-React, TypeScript ו-Tailwind CSS.</li>
        <li>אינטגרציה עם שירותי בינה מלאכותית (Gemini API) ליצירת תוכן אוטומטי.</li>
      </ul>

      <h3 style="color: #0369a1; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">השכלה וכישורים</h3>
      <ul>
        <li><strong>B.Sc במדעי המחשב</strong> - הטכניון (בהצטיינות)</li>
        <li><strong>שפות תכנון:</strong> TypeScript, JavaScript, Python, C#, HTML5/CSS3</li>
        <li><strong>טכנולוגיות:</strong> React, Node.js, Express, Vite, Tailwind CSS, Git, Docker</li>
      </ul>
    `
  },
  {
    id: 'academic_paper',
    name: 'Academic Research Paper',
    nameHe: 'מאמר אקדמי ומחקר',
    iconName: 'BookOpen',
    description: 'מבנה תקני למאמר מחקרי, כולל תקציר, כותרות ממוספרות ומראי מקום',
    category: 'academic',
    dir: 'rtl',
    fontFamily: 'Frank Ruhl Libre',
    contentHtml: `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 1.8em; margin-bottom: 8px;">השפעת עורכי תמלילים היברידיים על פרודוקטיביות ארגונית</h1>
        <p style="font-size: 1.1em; color: #334155; margin-bottom: 4px;">מחקר משווה בין סביבות עבודה מבוססות ענן לסביבות שולחניות</p>
        <p style="font-size: 0.9em; color: #64748b;">מאת: ד"ר אברהם לוי | המחלקה למדעי המידע, אוניברסיטת תל אביב</p>
      </div>

      <div style="margin: 0 40px 24px 40px; padding: 12px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; font-style: italic;">
        <strong>תקציר (Abstract):</strong>
        מחקר זה בוחן את אופן השימוש בעורכי תמלילים מודרניים המשלבים תצוגת עמודים קלאסית (Word) עם יכולות שיתוף ועריכה רציפה בענן (Docs). התוצאות מראות כי שילוב שני המודלים מפחית את זמן הכנת המסמכים ב-32% ומעלה את שביעות הרצון של צוותי עבודה.
      </div>

      <h2>1. מבוא וסקירת ספרות</h2>
      <p>בעשור האחרון נרשם מעבר חד מעורכי תמלילים מקומיים לעורכי מסמכים בענן. בעוד שסביבות ענן מציעות נגישות גבוהה ושיתוף פעולה בזמן אמת, משתמשים רבים עדיין נזקקים לדיוק הטיפוגרפי, לשוליים מוגדרים ולשליטה המלאה בעיצוב העמוד שמציעות תוכנות מדף מסורתיות.</p>

      <h2>2. מתודולוגיית המחקר</h2>
      <p>במסגרת המחקר נבדקו 500 משתמשים בעלי פרופיל עבודה מגוון. המשתתפים התבקשו לבצע משימות עריכה, עימוד והערות בשלוש סביבות שונות:</p>
      <ul>
        <li>סביבה א': עורך ענן בלבד (תצוגת רצף)</li>
        <li>סביבה ב': עורך שולחני בלבד (תצוגת עמודים)</li>
        <li>סביבה ג': עורך היברידי משולב (DocWord)</li>
      </ul>

      <h2>3. ממצאים ומסקנות</h2>
      <p>הסביבה ההיברידית דורגה במקום הראשון בכל הפרמטרים של נוחות שימוש, מהירות עריכה וגמישות עיצובית.</p>
    `
  }
];

export const INITIAL_DOCUMENT: DocumentModel = {
  id: 'doc_demo_1',
  title: 'מסמך היברידי - Docs & Word',
  contentHtml: TEMPLATES[1].contentHtml, // Business report as default demo
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  language: 'he',
  dir: 'rtl',
  viewMode: 'paged', // Word A4 page view by default
  docMode: 'editing',
  comments: [
    {
      id: 'c1',
      author: 'מיכל לופו',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      text: 'שילוב מעולה! כדאי להוסיף גם גרף או תרשים נתונים בחלק של ה-KPIs.',
      createdAt: 'לפני 10 דקות',
      resolved: false,
      selectedText: 'צמיחה של 24% במשתמשים פעילים'
    }
  ],
  suggestions: [
    {
      id: 's1',
      author: 'דניאל (AI)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      type: 'insert',
      originalText: 'שדרוג חווית המשתמש',
      suggestedText: 'שדרוג מקיף וחדשני של חווית המשתמש',
      status: 'pending',
      timestamp: 'לפני 5 דקות'
    }
  ],
  history: [
    {
      id: 'v2',
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
      title: 'עדכון טבלת KPIs וניסוח מחדש',
      author: 'מיכל לופו',
      contentHtml: TEMPLATES[1].contentHtml,
      changeSummary: 'הוספת טבלת נתונים מעוצבת והערה'
    },
    {
      id: 'v1',
      timestamp: '09:00',
      title: 'גרסה ראשונית',
      author: 'מערכת AI',
      contentHtml: `<h1>דו"ח פעילות - טיוטה ראשונית</h1><p>טיוטת מסמך שנוצרה על ידי המערכת.</p>`,
      changeSummary: 'יצירת טיוטת בסיס'
    }
  ],
  headerText: 'DocWord Hybrid | מסמך עסקי שמור',
  footerText: 'סודי ופנימי - לשימוש עובדי החברה בלבד',
  showPageNumbers: true,
  pageBgColor: '#ffffff',
  watermarkText: '',
  fontFamily: 'Rubik',
  fontSize: '16px',
  lineSpacing: '1.5',
  margins: { top: 25, bottom: 25, left: 25, right: 25 },
  zoom: 100,
  tags: ['עסקי', 'רבעוני', 'חשוב'],
  isFavorite: true
};
