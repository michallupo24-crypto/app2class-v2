/**
 * Hebrew & Multilingual Grammar Checker Utility (No AI)
 * Provides rule-based syntactic, morphological, and stylistic validation for Hebrew texts.
 */

export interface GrammarIssue {
  id: string;
  matchedText: string;
  index: number;
  suggestions: string[];
  ruleName: string;
  explanation: string;
  category: 'number_gender' | 'future_prefix' | 'past_suffix' | 'noun_adjective' | 'definite_article' | 'homophone_preposition' | 'duplicate_word' | 'style_connector' | 'punctuation_spacing';
  severity: 'error' | 'warning' | 'suggestion';
}

interface GrammarRule {
  id: string;
  name: string;
  category: GrammarIssue['category'];
  severity: GrammarIssue['severity'];
  regex: RegExp;
  getSuggestions: (match: RegExpExecArray) => string[];
  explanation: string | ((match: RegExpExecArray) => string);
}

export const HEBREW_GRAMMAR_RULES: GrammarRule[] = [
  // 1. התאם שם המספר למין (זכר / נקבה)
  {
    id: 'num_f_shlosha_banot',
    name: 'התאם שם המספר לשם עצם בנקבה',
    category: 'number_gender',
    severity: 'error',
    regex: /\b(שלושה|ארבעה|חמישה|שישה|שבעה|שמונה|תשעה|עשרה)\s+(בנות|נשים|תמונות|שנים|שעות|דקות|מילים|אותיות|שורות|פסקאות|טבלאות|הצעות|שאלות|תשובות|דרכים|ערים|מדינות|חיות|עוגות|עבודות|פגישות|ישיבות|משימות|גרסאות)\b/g,
    getSuggestions: (match) => {
      const numMap: Record<string, string> = {
        'שלושה': 'שלוש',
        'ארבעה': 'ארבע',
        'חמישה': 'חמש',
        'שישה': 'שש',
        'שבעה': 'שבע',
        'שמונה': 'שמונה',
        'תשעה': 'תשע',
        'עשרה': 'עשר'
      };
      const correctNum = numMap[match[1]] || match[1];
      return [`${correctNum} ${match[2]}`];
    },
    explanation: (match) => `שם העצם "${match[2]}" הוא במין נקבה, ולכן יש להשתמש במספר בנקבה ("${match[1] === 'שלושה' ? 'שלוש' : match[1] === 'ארבעה' ? 'ארבע' : match[1] === 'חמישה' ? 'חמש' : match[1] === 'עשרה' ? 'עשר' : 'בנקבה'}") ולא בצורת הזכר.`
  },
  {
    id: 'num_m_shlosh_banim',
    name: 'התאם שם המספר לשם עצם בזכר',
    category: 'number_gender',
    severity: 'error',
    regex: /\b(שלוש|ארבע|חמש|שש|שבע|תשע|עשר)\s+(בנים|גברים|אנשים|ימים|חודשים|שבועות|שקלים|דולרים|עמודים|דפים|פרקים|סעיפים|ספרים|עטים|עפרונות|מחשבים|מסכים|פרויקטים|מסמכים|קבצים|מנהלים|עובדים|לקוחות|שותפים|בתים|חדרים|בניינים|עצים|פרחים|ילדים|כלבים|חתולים)\b/g,
    getSuggestions: (match) => {
      const numMap: Record<string, string> = {
        'שלוש': 'שלושה',
        'ארבע': 'ארבעה',
        'חמש': 'חמישה',
        'שש': 'שישה',
        'שבע': 'שבעה',
        'תשע': 'תשעה',
        'עשר': 'עשרה'
      };
      const correctNum = numMap[match[1]] || match[1];
      return [`${correctNum} ${match[2]}`];
    },
    explanation: (match) => `שם העצם "${match[2]}" הוא במין זכר, ולכן יש להשתמש במספר בזכר ("${match[1] === 'שלוש' ? 'שלושה' : match[1] === 'ארבע' ? 'ארבעה' : match[1] === 'חמש' ? 'חמישה' : match[1] === 'עשר' ? 'עשרה' : 'בזכר'}").`
  },
  {
    id: 'num_shnei_nashim',
    name: 'שני / שתי לנשים וגברים',
    category: 'number_gender',
    severity: 'error',
    regex: /\bשני\s+(בנות|נשים|תמונות|שנים|שעות|דקות|מילים|אותיות|שורות|פסקאות|טבלאות|הצעות|שאלות|תשובות|דרכים|ערים|מדינות|חיות|עבודות|פגישות|משימות)\b/g,
    getSuggestions: (match) => [`שתי ${match[1]}`],
    explanation: (match) => `לשמות עצם בנקבה (כמו "${match[1]}") יש לומר "שתי" ולא "שני".`
  },
  {
    id: 'num_shtei_gvarim',
    name: 'שתי / שני לגברים',
    category: 'number_gender',
    severity: 'error',
    regex: /\bשתי\s+(בנים|גברים|אנשים|ימים|חודשים|שבועות|שקלים|דולרים|עמודים|דפים|פרקים|סעיפים|ספרים|מחשבים|מסכים|פרויקטים|מסמכים|קבצים|עובדים|לקוחות|בתים|חדרים|ילדים|שקל)\b/g,
    getSuggestions: (match) => [`שני ${match[1] === 'שקל' ? 'שקלים' : match[1]}`],
    explanation: (match) => `לשמות עצם בזכר (כמו "${match[1]}") יש לומר "שני" ולא "שתי".`
  },

  // 2. אותיות אית"ן - גוף ראשון עתיד באות א' ולא י'
  {
    id: 'future_first_person',
    name: 'גוף ראשון עתיד באות א\'',
    category: 'future_prefix',
    severity: 'error',
    regex: /\bאני\s+(יעשה|ילך|יבוא|יכתוב|יקרא|יקח|יתן|יראה|ישמע|יבין|ירצה|יסגור|יפתח|יבדוק|ישלח|יקנה|יבנה|ידע|יגיד|ישמח|ידבר|יטפל|יסביר|יענה|ימצא|יקבל|ימשיך|יתחיל|יסיים|יוכל|ישב|יעמוד|יאכל|ישתה|יבחר)\b/g,
    getSuggestions: (match) => {
      const verb = match[1];
      const fixedVerb = 'א' + verb.slice(1);
      return [`אני ${fixedVerb}`];
    },
    explanation: (match) => `פועל בגוף ראשון עתיד ("אני") נפתח תמיד באות א' (אותיות אית"ן) ולא באות י'. יש לכתוב: "אני ${'א' + match[1].slice(1)}".`
  },

  // 3. סיומת עבר גוף שני נוכח (ת ולא תה)
  {
    id: 'past_second_person_suffix',
    name: 'סיומת עבר גוף שני נוכח',
    category: 'past_suffix',
    severity: 'error',
    regex: /\b(אמרתה|עשיתה|הלכתה|ראיתה|קראתה|ידעתה|בניתה|שלחתה|פתחתה|סגרתה|קניתה|הבנתה|רציתה|בדקתה|לקחתה|נתתה|חשבתה|שמעתה|בחרתה|דיברתה|שאלתה|עניתה|עזרתה|מצאתה|שמרתה|התחלתה|סיימתה|המשכתה)\b/g,
    getSuggestions: (match) => {
      const word = match[1];
      const fixed = word.endsWith('תה') ? word.slice(0, -2) + 'ת' : word;
      return [fixed];
    },
    explanation: (match) => `בגוף שני עבר (נוכח) הסיומת התקנית היא ת' ולא תה (לדוגמה: "${match[1].slice(0, -2) + 'ת'}").`
  },

  // 4. בלבול מילות יחס והגייה (אם/עם, לו/לא, על/אל)
  {
    id: 'homophone_im_ve_im',
    name: 'בלבול בין "אם" (תנאי) ל"עם" (יחד)',
    category: 'homophone_preposition',
    severity: 'warning',
    regex: /\b(ללכת|לשבת|לדבר|להיפגש|להיות|לעבוד|לשחק|לצאת|לבלות|להתייעץ|נפגש|מדבר|הולך|יושב|עובד)\s+אם\b/g,
    getSuggestions: (match) => [`${match[1]} עם`],
    explanation: 'כשמציינים שותפות או ליווי יש להשתמש במילת היחס "עם" (ולא "אם" המציינת תנאי).'
  },
  {
    id: 'homophone_im_condition',
    name: 'בלבול בין "עם" ל"אם" במשפט תנאי',
    category: 'homophone_preposition',
    severity: 'warning',
    regex: /\bעם\s+(תרצה|תרצי|תרצו|תוכל|תוכלי|תוכלו|אפשר|יש|יהיה|תהיה|יהיו|נרצה|נצטרך|תצטרך|תצטרכו)\b/g,
    getSuggestions: (match) => [`אם ${match[1]}`],
    explanation: 'במשפטי תנאי יש להשתמש במילה "אם" (ולא "עם").'
  },
  {
    id: 'homophone_lo_shelela',
    name: 'בלבול בין "לו" (לו/כינוי) ל"לא" (שלילה)',
    category: 'homophone_preposition',
    severity: 'error',
    regex: /\b(אני|אתה|את|הוא|היא|אנחנו|אתם|הם)\s+לו\s+(יודע|יודעת|יודעים|רוצה|רוצים|מבין|מבינים|הולך|בא|עושה|שומע|יכול|יכולה|יכולים)\b/g,
    getSuggestions: (match) => [`${match[1]} לא ${match[2]}`],
    explanation: 'לשלילה יש להשתמש במילה "לא" (ולא "לו" המציינת כינוי גוף).'
  },
  {
    id: 'homophone_al_el_destination',
    name: 'בלבול בין "על" ל"אל" בציון יעד',
    category: 'homophone_preposition',
    severity: 'warning',
    regex: /\b(ללכת|לנסוע|לטוס|להגיע|לחזור|לפנות|לגשת|להיכנס)\s+על\s+(הבית|המשרד|העיר|ישראל|ירושלים|החדר|הבנק|הרופא|המלון|החוף|שם)\b/g,
    getSuggestions: (match) => [`${match[1]} אל ${match[2]}`],
    explanation: (match) => `לציון כיוון ויעד משתמשים במילת היחס "אל" ולא "על" ("${match[1]} אל ${match[2]}").`
  },

  // 5. מילות קישור תקניות (בגלל ש... / למרות ש...)
  {
    id: 'connector_biglal_she',
    name: 'שימוש תקני במילת סיבה ("משום ש" במקום "בגלל ש")',
    category: 'style_connector',
    severity: 'suggestion',
    regex: /\bבגלל\s+ש/g,
    getSuggestions: () => ['משום ש', 'מפני ש', 'כיוון ש', 'הואיל ו'],
    explanation: 'לפי כללי האקדמיה ללשון העברית, לפני פסוקית סיבה מומלץ להשתמש בצירופים "משום ש", "מפני ש" או "כיוון ש" במקום "בגלל ש".'
  },
  {
    id: 'connector_lamrot_she',
    name: 'שימוש תקני במילת ויתור ("אף על פי ש" במקום "למרות ש")',
    category: 'style_connector',
    severity: 'suggestion',
    regex: /\bלמרות\s+ש/g,
    getSuggestions: () => ['אף על פי ש', 'אף ש', 'על אף ש'],
    explanation: 'בכתיבה תקנית ורשמית מומלץ להשתמש ב"אף על פי ש" או "אף ש" במקום "למרות ש".'
  },
  {
    id: 'connector_bemida_ve',
    name: 'שימוש תקני בצירוף תנאי ("אם" במקום "במידה ו")',
    category: 'style_connector',
    severity: 'suggestion',
    regex: /\bבמידה\s+ו/g,
    getSuggestions: () => ['אם', 'ככל ש', 'במידה ש'],
    explanation: 'הצירוף "במידה ו" אינו תקני. יש להשתמש ב"אם", "במידה ש" או "ככל ש".'
  },

  // 6. התאמת מין בין שם עצם לתואר
  {
    id: 'noun_adj_isha_gadol',
    name: 'אי-התאמה במין בין שם עצם לתואר',
    category: 'noun_adjective',
    severity: 'error',
    regex: /\b(אישה|ילדה|תמונה|עיר|מדינה|שמש|דרך|תוכנית|טבלה|פגישה|הודעה|משימה|עבודה)\s+(גדול|קטן|חדש|ישן|יפה|ארוך|קצר|חם|קר|טוב|רע|מהיר|איטי|חשוב|מרכזי|עיקרי)\b/g,
    getSuggestions: (match) => {
      const adjMap: Record<string, string> = {
        'גדול': 'גדולה',
        'קטן': 'קטנה',
        'חדש': 'חדשה',
        'ישן': 'ישנה',
        'יפה': 'יפה',
        'ארוך': 'ארוכה',
        'קצר': 'קצרה',
        'חם': 'חמה',
        'קר': 'קרה',
        'טוב': 'טובה',
        'רע': 'רעה',
        'מהיר': 'מהירה',
        'איטי': 'איטית',
        'חשוב': 'חשובה',
        'מרכזי': 'מרכזית',
        'עיקרי': 'עיקרית'
      };
      const feminineAdj = adjMap[match[2]] || `${match[2]}ה`;
      return [`${match[1]} ${feminineAdj}`];
    },
    explanation: (match) => `שם העצם "${match[1]}" הוא במין נקבה, ולכן גם שם התואר חייב להיות בנקבה ("${match[1]} ${match[2] === 'גדול' ? 'גדולה' : match[2] === 'חדש' ? 'חדשה' : 'בנקבה'}").`
  },
  {
    id: 'noun_adj_plural_mismatch',
    name: 'אי-התאמה במספר או במין ברבים',
    category: 'noun_adjective',
    severity: 'error',
    regex: /\b(ילדים|אנשים|גברים|ספרים|מסמכים|פרויקטים)\s+(גדולה|קטנה|חדשה|יפה|טובה|רעה|ארוכה)\b/g,
    getSuggestions: (match) => {
      const adjMap: Record<string, string> = {
        'גדולה': 'גדולים',
        'קטנה': 'קטנים',
        'חדשה': 'חדשים',
        'יפה': 'יפים',
        'טובה': 'טובים',
        'רעה': 'רעים',
        'ארוכה': 'ארוכים'
      };
      return [`${match[1]} ${adjMap[match[2]] || match[2]}`];
    },
    explanation: (match) => `שם העצם "${match[1]}" הוא בריבוי זכר, ויש להתאים לו שם תואר בריבוי זכר.`
  },

  // 7. ה' הידיעה בצירוף שם ותוארו
  {
    id: 'definite_article_missing',
    name: 'יידוע חלקי בצירוף שם ותואר',
    category: 'definite_article',
    severity: 'warning',
    regex: /\b(הספר|המסמך|הקובץ|הפרויקט|האיש|האישה|הילד|הילדה|הבית|המשרד|העיר|המדינה|היום|השנה)\s+(גדול|קטן|חדש|ישן|טוב|רע|חשוב|יפה|ארוך|קצר|מרכזי|ראשון)\b/g,
    getSuggestions: (match) => [`${match[1]} ה${match[2]}`],
    explanation: (match) => `בצירוף שם עצם ותוארו מיודעים, יש ליידע גם את שם התואר: "${match[1]} ה${match[2]}".`
  },

  // 8. מילים כפולות ברצף
  {
    id: 'duplicate_words',
    name: 'מילה כפולה ברצף',
    category: 'duplicate_word',
    severity: 'error',
    regex: /\b(את|של|על|אל|עם|אם|זה|זאת|כי|לא|כן|הוא|היא|שם|פה|רק|גם|עוד|מה|מי|או|אבל|אך)\s+\1\b/g,
    getSuggestions: (match) => [match[1]],
    explanation: (match) => `המילה "${match[1]}" מופיעה פעמיים ברצף ללא צורך.`
  },

  // 9. רווחים לפני סימני פיסוק
  {
    id: 'space_before_punctuation',
    name: 'רווח לפני סימן פיסוק',
    category: 'punctuation_spacing',
    severity: 'warning',
    regex: /(\w+)\s+([,.:;!?])/g,
    getSuggestions: (match) => [`${match[1]}${match[2]}`],
    explanation: 'על פי כללי הפיסוק, אין לשים רווח לפני סימן פיסוק (אלא רק אחריו).'
  }
];

/**
 * Run grammar analysis on a given plain text or HTML fragment.
 */
export function checkGrammar(text: string): GrammarIssue[] {
  if (!text || !text.trim()) return [];

  // Strip HTML tags for clean text analysis, but preserve positions if needed
  const cleanText = text.replace(/<[^>]*>/g, ' ');
  const issues: GrammarIssue[] = [];
  const seenIndexes = new Set<number>();

  for (const rule of HEBREW_GRAMMAR_RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rule.regex.exec(cleanText)) !== null) {
      const matchIndex = match.index;
      if (seenIndexes.has(matchIndex)) continue;

      const matchedText = match[0];
      const suggestions = rule.getSuggestions(match);
      const explanation = typeof rule.explanation === 'function' ? rule.explanation(match) : rule.explanation;

      issues.push({
        id: `grammar-${rule.id}-${matchIndex}`,
        matchedText,
        index: matchIndex,
        suggestions,
        ruleName: rule.name,
        explanation,
        category: rule.category,
        severity: rule.severity
      });

      seenIndexes.add(matchIndex);
    }
  }

  // Sort issues by appearance in text
  return issues.sort((a, b) => a.index - b.index);
}
