/**
 * Local Spell & Grammar Checker Utility (No AI)
 * Provides offline dictionary checking, deep Hebrew morphology analysis,
 * English vocabulary validation, keyboard slip detection, and fuzzy Levenshtein suggestions.
 */

import { HEBREW_CORE_DICTIONARY, HEBREW_RECOGNIZED_ACRONYMS, ENGLISH_CORE_DICTIONARY } from './hebrewDictionaryData';

export interface SpellingError {
  id: string;
  word: string;
  originalText: string;
  index: number;
  suggestions: string[];
  reason: string;
  type: 'typo' | 'suffix' | 'keyboard_slip' | 'grammatical_slip' | 'unrecognized';
}

// 1. Direct typo-to-correction map for common Hebrew typos and common grammatical slips
export const HEBREW_TYPOS_MAP: Record<string, { suggestions: string[]; reason: string }> = {
  // גוף ראשון עתיד באות א' (ולא י')
  'אני יעשה': { suggestions: ['אני אעשה'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני ילך': { suggestions: ['אני אלך'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יבוא': { suggestions: ['אני אבוא'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יקח': { suggestions: ['אני אקח'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יגיד': { suggestions: ['אני אגיד'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יראה': { suggestions: ['אני אראה'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יתן': { suggestions: ['אני אתן'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני ישמח': { suggestions: ['אני אשמח'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יבדוק': { suggestions: ['אני אבדוק'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יכתוב': { suggestions: ['אני אכתוב'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני ישלח': { suggestions: ['אני אשלח'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יסגור': { suggestions: ['אני אסגור'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יפתח': { suggestions: ['אני אפתח'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני יבין': { suggestions: ['אני אבין'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני ירצה': { suggestions: ['אני ארצה'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },
  'אני ידע': { suggestions: ['אני אדע'], reason: 'גוף ראשון עתיד נפתח באות א ולא י' },

  // סיומת "ת" בעבר גוף שני (במקום "תה")
  'אמרתה': { suggestions: ['אמרת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'עשיתה': { suggestions: ['עשית'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'הלכתה': { suggestions: ['הלכת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'כתבתה': { suggestions: ['כתבת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'קראתה': { suggestions: ['קראת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'רציתה': { suggestions: ['רצית'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'חשבתה': { suggestions: ['חשבת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'ידעתה': { suggestions: ['ידעת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'הבנתה': { suggestions: ['הבנת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'נתתה': { suggestions: ['נתת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'לקחתה': { suggestions: ['לקחת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'בדקתה': { suggestions: ['בדקת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'בחרתה': { suggestions: ['בחרת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'סגרתה': { suggestions: ['סגרת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'פתחתה': { suggestions: ['פתחת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'שלחתה': { suggestions: ['שלחת'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'ראיתה': { suggestions: ['ראית'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'קניתה': { suggestions: ['קנית'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },
  'בניתה': { suggestions: ['בנית'], reason: 'גוף שני עבר נכתב בסיומת ת ולא תה' },

  // אותיות מתחלפות ואיות נפוץ שגוי
  'אקרה': { suggestions: ['אקרא', 'מקרה', 'קרה'], reason: 'אם הכוונה לפועל קריאה - נכתב בא\'' },
  'אכשיו': { suggestions: ['עכשיו'], reason: 'נכתב בע\' ולא בא\'' },
  'עכשיוו': { suggestions: ['עכשיו'], reason: 'אות ו\' כפולה מיותרת' },
  'עיברית': { suggestions: ['עברית'], reason: 'נכתב ללא י\' אחרי הע\'' },
  'ביגלל': { suggestions: ['בגלל'], reason: 'נכתב ללא י\' אחרי הב\'' },
  'ביכלל': { suggestions: ['בכלל'], reason: 'נכתב ללא י\' אחרי הב\'' },
  'בימקום': { suggestions: ['במקום'], reason: 'נכתב ללא י\' אחרי הב\'' },
  'לומרות': { suggestions: ['למרות'], reason: 'נכתב ללא ו\' אחרי הל\'' },
  'צירך': { suggestions: ['צריך'], reason: 'חילוף אותיות י-ר' },
  'היזדמנות': { suggestions: ['הזדמנות'], reason: 'נכתב ללא י\' אחרי הה\'' },
  'איקרי': { suggestions: ['עיקרי'], reason: 'נכתב בע\' ולא בא\'' },
  'איקריים': { suggestions: ['עיקריים'], reason: 'נכתב בע\' ולא בא\'' },
  'להיתראות': { suggestions: ['להתראות'], reason: 'נכתב ללא י\' אחרי הה\'' },
  'איפהשהו': { suggestions: ['איפשהו'], reason: 'נכתב איפשהו' },
  'איזהשהו': { suggestions: ['איזשהו'], reason: 'נכתב איזשהו' },
  'שגיעה': { suggestions: ['שגיאה'], reason: 'נכתב בא\' בסוף' },
  'שגיאהה': { suggestions: ['שגיאה'], reason: 'אות כפולה מיותרת' },
  'פרוייקט': { suggestions: ['פרויקט'], reason: 'בכתיב חסר ניקוד תקני י\' אחת' },
  'צהוריים': { suggestions: ['צהריים'], reason: 'נכתב ללא ו\'' },
  'מיסמך': { suggestions: ['מסמך'], reason: 'נכתב ללא י\'' },
  'מיסמכים': { suggestions: ['מסמכים'], reason: 'נכתב ללא י\'' },
  'מיקצועי': { suggestions: ['מקצועי'], reason: 'נכתב ללא י\'' },
  'חישבון': { suggestions: ['חשבון'], reason: 'נכתב ללא י\'' },
  'סילחו': { suggestions: ['סלחו'], reason: 'נכתב ללא י\'' },
  'בישביל': { suggestions: ['בשביל'], reason: 'נכתב ללא י\'' },
  'ליקרוא': { suggestions: ['לקרוא'], reason: 'שם הפועל נכתב ללא י\' (לקרוא)' },
  'ליכתוב': { suggestions: ['לכתוב'], reason: 'שם הפועל נכתב ללא י\' (לכתוב)' },
  'לישמוע': { suggestions: ['לשמוע'], reason: 'שם הפועל נכתב ללא י\' (לשמוע)' },
  'לילמוד': { suggestions: ['ללמוד'], reason: 'שם הפועל נכתב ללא י\' (ללמוד)' },
  'ליבדוק': { suggestions: ['לבדוק'], reason: 'שם הפועל נכתב ללא י\' (לבדוק)' },
  'ליבחור': { suggestions: ['לבחור'], reason: 'שם הפועל נכתב ללא י\' (לבחור)' },
  'ליסגור': { suggestions: ['לסגור'], reason: 'שם הפועל נכתב ללא י\' (לסגור)' },
  'ליפתוח': { suggestions: ['לפתוח'], reason: 'שם הפועל נכתב ללא י\' (לפתוח)' },
  'לימצוא': { suggestions: ['למצוא'], reason: 'שם הפועל נכתב ללא י\' (למצוא)' },
  'לישלוח': { suggestions: ['לשלוח'], reason: 'שם הפועל נכתב ללא י\' (לשלוח)' },
  'ליקנות': { suggestions: ['לקנות'], reason: 'שם הפועל נכתב ללא י\' (לקנות)' },
  'ליראות': { suggestions: ['לראות'], reason: 'שם הפועל נכתב ללא י\' (לראות)' },
  'ליבנות': { suggestions: ['לבנות'], reason: 'שם הפועל נכתב ללא י\' (לבנות)' },
  'מסכורת': { suggestions: ['משכורת'], reason: 'נכתב בש\' ולא בס\'' },
  'היזדמנויות': { suggestions: ['הזדמנויות'], reason: 'נכתב ללא י\'' },
  'תודב': { suggestions: ['תודה'], reason: 'הקלדה שגויה (ב במקום ה)' },
  'שלוםם': { suggestions: ['שלום'], reason: 'אות ם כפולה מיותרת' },
  'בבבקשה': { suggestions: ['בבקשה'], reason: 'אות ב משולשת' },
  'הייי': { suggestions: ['היי'], reason: 'אות י מיותרת' },
  'טובב': { suggestions: ['טוב'], reason: 'אות ב כפולה' }
};

// 2. Direct typo map for English words
export const ENGLISH_TYPOS_MAP: Record<string, { suggestions: string[]; reason: string }> = {
  'teh': { suggestions: ['the'], reason: 'Transposed letters' },
  'recieve': { suggestions: ['receive'], reason: 'i before e except after c' },
  'seperate': { suggestions: ['separate'], reason: 'Spelled with an "a"' },
  'definately': { suggestions: ['definitely'], reason: 'Spelled with an "i"' },
  'untill': { suggestions: ['until'], reason: 'Single "l"' },
  'occured': { suggestions: ['occurred'], reason: 'Double "r"' },
  'truely': { suggestions: ['truly'], reason: 'No "e" in truly' },
  'wierd': { suggestions: ['weird'], reason: 'Exception to rule (e before i)' },
  'adress': { suggestions: ['address'], reason: 'Double "d"' },
  'accomodate': { suggestions: ['accommodate'], reason: 'Double "c" and double "m"' },
  'beleive': { suggestions: ['believe'], reason: 'i before e' },
  'goverment': { suggestions: ['government'], reason: 'Missing "n"' },
  'tommorow': { suggestions: ['tomorrow'], reason: 'Single "m", double "r"' },
  'tommorrow': { suggestions: ['tomorrow'], reason: 'Single "m", double "r"' },
  'alot': { suggestions: ['a lot'], reason: 'Two words' },
  'writting': { suggestions: ['writing'], reason: 'Single "t"' },
  'refering': { suggestions: ['referring'], reason: 'Double "r"' },
  'occurance': { suggestions: ['occurrence'], reason: 'Spelled with "-ence"' },
  'calender': { suggestions: ['calendar'], reason: 'Spelled with "-ar"' },
  'embarass': { suggestions: ['embarrass'], reason: 'Double "r" and double "s"' },
  'enviroment': { suggestions: ['environment'], reason: 'Missing "n"' },
  'existance': { suggestions: ['existence'], reason: 'Spelled with "-ence"' },
  'foriegn': { suggestions: ['foreign'], reason: 'e before i' },
  'guarentee': { suggestions: ['guarantee'], reason: 'Spelled with "ua"' },
  'independant': { suggestions: ['independent'], reason: 'Spelled with "-ent"' },
  'mispell': { suggestions: ['misspell'], reason: 'Double "s"' },
  'noticable': { suggestions: ['noticeable'], reason: 'Keeps the "e"' },
  'posession': { suggestions: ['possession'], reason: 'Double "s" twice' },
  'priviledge': { suggestions: ['privilege'], reason: 'No "d"' },
  'pronounciation': { suggestions: ['pronunciation'], reason: 'Spelled "nun"' },
  'recommand': { suggestions: ['recommend'], reason: 'Spelled "rec-o-mmend"' },
  'relevent': { suggestions: ['relevant'], reason: 'Spelled with "-ant"' },
  'suprise': { suggestions: ['surprise'], reason: 'Missing "r"' },
  'tendancy': { suggestions: ['tendency'], reason: 'Spelled with "-ency"' },
  'thier': { suggestions: ['their'], reason: 'e before i' },
  'unfortunatly': { suggestions: ['unfortunately'], reason: 'Keeps the "e"' },
  'wich': { suggestions: ['which'], reason: 'Missing "h"' },
  'becuase': { suggestions: ['because'], reason: 'Transposed letters' },
  'begining': { suggestions: ['beginning'], reason: 'Double "n"' },
  'dissappoint': { suggestions: ['disappoint'], reason: 'Single "s"' },
  'experiance': { suggestions: ['experience'], reason: 'Spelled with "-ence"' },
  'freind': { suggestions: ['friend'], reason: 'i before e' },
  'neccessary': { suggestions: ['necessary'], reason: 'Single "c", double "s"' },
  'peice': { suggestions: ['piece'], reason: 'i before e' },
  'succesful': { suggestions: ['successful'], reason: 'Double "c", double "s"' }
};

// 3. Hebrew Keyboard slip map (English key -> Hebrew letter on standard Israeli keyboard)
const EN_TO_HE_KEYMAP: Record<string, string> = {
  'q': '/', 'w': '\'', 'e': 'ק', 'r': 'ר', 't': 'א', 'y': 'ט', 'u': 'ו', 'i': 'ן', 'o': 'ם', 'p': 'פ',
  'a': 'ש', 's': 'ד', 'd': 'ג', 'f': 'כ', 'g': 'ע', 'h': 'י', 'j': 'ח', 'k': 'ל', 'l': 'ך', ';': 'ף',
  'z': 'ז', 'x': 'ס', 'c': 'ב', 'v': 'ה', 'b': 'נ', 'n': 'מ', 'm': 'צ', ',': 'ת', '.': 'ץ'
};

const HE_TO_EN_KEYMAP: Record<string, string> = Object.entries(EN_TO_HE_KEYMAP).reduce(
  (acc, [en, he]) => {
    acc[he] = en;
    return acc;
  },
  {} as Record<string, string>
);

export function convertKeyboardSlipEnToHe(enWord: string): string {
  let res = '';
  for (const ch of enWord.toLowerCase()) {
    res += EN_TO_HE_KEYMAP[ch] || ch;
  }
  return res;
}

export function convertKeyboardSlipHeToEn(heWord: string): string {
  let res = '';
  for (const ch of heWord) {
    res += HE_TO_EN_KEYMAP[ch] || ch;
  }
  return res;
}

// Sets of valid words for O(1) fast lookup
const HEBREW_WORDS_SET = new Set(HEBREW_CORE_DICTIONARY);
const HEBREW_ACRONYMS_SET = new Set([
  ...HEBREW_RECOGNIZED_ACRONYMS,
  ...HEBREW_RECOGNIZED_ACRONYMS.map(a => a.replace(/["'״׳]/g, ''))
]);
const ENGLISH_WORDS_SET = new Set(ENGLISH_CORE_DICTIONARY.map((w) => w.toLowerCase()));

// Hebrew prefixes for morphological decomposition (ordered by longest first)
const HEBREW_PREFIXES = [
  'וכשה', 'שכשה', 'וכשב', 'וכשל', 'וכשמ',
  'וכש', 'שכש', 'כשה', 'לכש', 'מכש', 'כשב', 'כשמ', 'כשל', 'כשנ',
  'כש', 'שבה', 'שלה', 'שמה', 'שכה', 'שב', 'שכ', 'של', 'שמ', 'שה', 'שנ',
  'ובה', 'ולה', 'ומה', 'וכה', 'וב', 'וכ', 'ול', 'ומ', 'וש', 'וה', 'ונ',
  'מה', 'בה', 'לה', 'כה', 'שה',
  'ב', 'כ', 'ל', 'מ', 'ש', 'ה', 'ו', 'נ', 'ת', 'י', 'א'
];

// Hebrew suffixes for morphological decomposition (ordered by longest first)
const HEBREW_SUFFIXES = [
  'ותיהם', 'ותיהן', 'ותיכם', 'ותיכן', 'ותינו', 'ותיך', 'ותיו', 'ותיה', 'ותיי', 'ותי',
  'יהם', 'יהן', 'יכם', 'יכן', 'ינו', 'יך', 'יו', 'יה', 'יים', 'יות',
  'ות', 'ים', 'נו', 'כם', 'כן', 'הם', 'הן', 'תם', 'תן', 'ית', 'ון', 'ונים', 'ונות',
  'ו', 'י', 'ך', 'ה', 'ת', 'ן', 'ם'
];

// Helper: converts medial letter at end of word to final letter (e.g. מסמכ -> מסמך)
function toFinalLetterAtEnd(word: string): string {
  if (!word) return word;
  const last = word.slice(-1);
  const rest = word.slice(0, -1);
  switch (last) {
    case 'כ': return rest + 'ך';
    case 'מ': return rest + 'ם';
    case 'נ': return rest + 'ן';
    case 'פ': return rest + 'ף';
    case 'צ': return rest + 'ץ';
    default: return word;
  }
}

// Helper: converts final letter anywhere to medial letter (e.g. ך -> כ)
function toMedialLetter(char: string): string {
  switch (char) {
    case 'ך': return 'כ';
    case 'ם': return 'מ';
    case 'ן': return 'נ';
    case 'ף': return 'פ';
    case 'ץ': return 'צ';
    default: return char;
  }
}

// Check if a candidate Hebrew stem or its canonical forms match the dictionary
function isStemInDictionary(stem: string): boolean {
  if (!stem || stem.length < 2) return false;
  if (HEBREW_WORDS_SET.has(stem)) return true;

  // Check with final letter adjusted
  const finalForm = toFinalLetterAtEnd(stem);
  if (HEBREW_WORDS_SET.has(finalForm)) return true;

  // If ends with 'ת' (construct state of 'ה', e.g. עבודת -> עבודה, החלטת -> החלטה, תוכנית -> תוכנית)
  if (stem.endsWith('ת')) {
    const withHe = stem.slice(0, -1) + 'ה';
    if (HEBREW_WORDS_SET.has(withHe)) return true;
  }

  // If ends with 'י' or 'ת' of plural construct (e.g. מנהלי -> מנהל, ספרי -> ספר)
  const finalFormWithoutLast = toFinalLetterAtEnd(stem.slice(0, -1));
  if (stem.endsWith('י') && HEBREW_WORDS_SET.has(finalFormWithoutLast)) return true;

  return false;
}

// Helper: check if Hebrew word is recognized directly or via morphology
export function isHebrewWordRecognized(cleanWord: string): boolean {
  // 1. Direct dictionary match
  if (HEBREW_WORDS_SET.has(cleanWord)) return true;

  // 2. Recognized acronyms with or without quotes (כמו דו"ח, מנכ"ל, צה"ל, חו"ל, וכו')
  if (HEBREW_ACRONYMS_SET.has(cleanWord) || HEBREW_ACRONYMS_SET.has(cleanWord.replace(/["'״׳]/g, ''))) {
    return true;
  }

  // Generalized acronym format (2+ letters with gershayim / geresh)
  if (/^[א-ת]+["'״׳][א-ת]*$/.test(cleanWord)) return true;

  // 3. Single valid Hebrew letter (e.g. א', ב', ג')
  if (cleanWord.length === 1 && /^[א-ת]$/.test(cleanWord)) return true;

  // 4. Try Direct Suffix Stripping
  for (const suffix of HEBREW_SUFFIXES) {
    if (cleanWord.endsWith(suffix) && cleanWord.length > suffix.length + 1) {
      const stem = cleanWord.slice(0, -suffix.length);
      if (isStemInDictionary(stem)) return true;
    }
  }

  // 5. Try Prefix Stripping
  for (const prefix of HEBREW_PREFIXES) {
    if (cleanWord.startsWith(prefix) && cleanWord.length > prefix.length + 1) {
      const stem = cleanWord.slice(prefix.length);
      if (isStemInDictionary(stem)) return true;

      // 6. Try Prefix + Suffix Stripping together
      for (const suffix of HEBREW_SUFFIXES) {
        if (stem.endsWith(suffix) && stem.length > suffix.length + 1) {
          const root = stem.slice(0, -suffix.length);
          if (isStemInDictionary(root)) return true;
        }
      }
    }
  }

  // 7. General Hebrew word patterns (משקלים נפוצים: התפעלות, הפעלה, קיטול)
  // e.g. המלצות, התפתחויות, מערכות, נתונים, פרויקטים
  if (cleanWord.startsWith('הת') && cleanWord.endsWith('ות') && cleanWord.length >= 6) return true;
  if (cleanWord.startsWith('ה') && cleanWord.endsWith('ות') && cleanWord.length >= 5) return true;
  if (cleanWord.startsWith('מ') && cleanWord.endsWith('ים') && cleanWord.length >= 5) return true;
  if (cleanWord.startsWith('ת') && cleanWord.endsWith('ות') && cleanWord.length >= 5) return true;

  return false;
}

// Helper: check if English word is recognized
export function isEnglishWordRecognized(cleanWord: string): boolean {
  const lower = cleanWord.toLowerCase();
  if (ENGLISH_WORDS_SET.has(lower)) return true;

  // Plural / past / ing endings
  if (lower.endsWith('s') && ENGLISH_WORDS_SET.has(lower.slice(0, -1))) return true;
  if (lower.endsWith('es') && ENGLISH_WORDS_SET.has(lower.slice(0, -2))) return true;
  if (lower.endsWith('ed') && ENGLISH_WORDS_SET.has(lower.slice(0, -2))) return true;
  if (lower.endsWith('ing') && ENGLISH_WORDS_SET.has(lower.slice(0, -3))) return true;
  if (lower.endsWith('ly') && ENGLISH_WORDS_SET.has(lower.slice(0, -2))) return true;

  return false;
}

// Levenshtein Distance for fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Find closest words in Hebrew dictionary using fuzzy distance
export function findClosestHebrewWords(word: string, maxSuggestions = 3): string[] {
  const candidates: { word: string; dist: number }[] = [];

  for (const dictWord of HEBREW_CORE_DICTIONARY) {
    // Only compare words of similar length (+/- 3 chars)
    if (Math.abs(dictWord.length - word.length) <= 3) {
      const dist = levenshteinDistance(word, dictWord);
      if (dist <= 3) {
        candidates.push({ word: dictWord, dist });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, maxSuggestions).map((c) => c.word);
}

// Find closest words in English dictionary
export function findClosestEnglishWords(word: string, maxSuggestions = 3): string[] {
  const lower = word.toLowerCase();
  const candidates: { word: string; dist: number }[] = [];

  for (const dictWord of ENGLISH_CORE_DICTIONARY) {
    if (Math.abs(dictWord.length - lower.length) <= 3) {
      const dist = levenshteinDistance(lower, dictWord);
      if (dist <= 3) {
        candidates.push({ word: dictWord, dist });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, maxSuggestions).map((c) => c.word);
}

// Check a single token for spelling error / typo / unrecognized word
export function checkWordSpell(
  word: string,
  userCustomDictionary: Set<string> = new Set()
): { isError: boolean; suggestions: string[]; reason: string; type: SpellingError['type'] } | null {
  const clean = word.trim().replace(/^[.,!?:;"'()[\]{}<>]+|[.,!?:;"'()[\]{}<>]+$/g, '');
  if (!clean || clean.length < 2) return null;

  // Ignore numbers, email addresses, URLs, pure symbols
  if (/^\d+([.,]\d+)*%?$/.test(clean) || clean.includes('@') || clean.startsWith('http') || /^[0-9\-_./]+$/.test(clean)) {
    return null;
  }

  // Check if in custom user dictionary
  if (userCustomDictionary.has(clean.toLowerCase()) || userCustomDictionary.has(clean)) {
    return null;
  }

  const lower = clean.toLowerCase();

  // 1. Direct Hebrew Typo Match
  if (HEBREW_TYPOS_MAP[clean]) {
    return {
      isError: true,
      suggestions: HEBREW_TYPOS_MAP[clean].suggestions,
      reason: HEBREW_TYPOS_MAP[clean].reason,
      type: 'typo'
    };
  }

  // 2. Direct English Typo Match
  if (ENGLISH_TYPOS_MAP[lower]) {
    return {
      isError: true,
      suggestions: ENGLISH_TYPOS_MAP[lower].suggestions,
      reason: ENGLISH_TYPOS_MAP[lower].reason,
      type: 'typo'
    };
  }

  // 3. Check for repeated 3+ letters typo like "שששלום" or "goodddd"
  if (/(.)\1{2,}/.test(clean)) {
    const simplified = clean.replace(/(.)\1{2,}/g, '$1');
    return {
      isError: true,
      suggestions: [simplified],
      reason: 'חזרה מיותרת על אותיות',
      type: 'typo'
    };
  }

  // 4. Mixed Hebrew & English letters without space (e.g. "SKCBKIAEHMSBCASZCNדבמש")
  if (/[\u0590-\u05FF]/.test(clean) && /[a-zA-Z]/.test(clean)) {
    return {
      isError: true,
      suggestions: [],
      reason: 'תווים מעורבבים באנגלית ובעברית ללא רווח',
      type: 'unrecognized'
    };
  }

  // 5. Pure Hebrew Word Validation
  if (/^[\u0590-\u05FF'\"״׳]+$/.test(clean)) {
    if (!isHebrewWordRecognized(clean)) {
      const suggestions = findClosestHebrewWords(clean);
      return {
        isError: true,
        suggestions,
        reason: 'מילה אינה מוכרת במילון העברי',
        type: 'unrecognized'
      };
    }
    return null;
  }

  // 6. Pure English Word Validation & Keyboard Slip
  if (/^[a-zA-Z]+$/.test(clean)) {
    // Check if it is a Hebrew keyboard slip (e.g. "akuo" -> "שלום")
    const convertedToHe = convertKeyboardSlipEnToHe(clean);
    if (isHebrewWordRecognized(convertedToHe) || HEBREW_TYPOS_MAP[convertedToHe]) {
      const correct = HEBREW_TYPOS_MAP[convertedToHe] ? HEBREW_TYPOS_MAP[convertedToHe].suggestions[0] : convertedToHe;
      return {
        isError: true,
        suggestions: [correct],
        reason: 'הקלדה באנגלית במקום בעברית (פריסת מקלדת)',
        type: 'keyboard_slip'
      };
    }

    if (!isEnglishWordRecognized(clean)) {
      const suggestions = findClosestEnglishWords(clean);
      return {
        isError: true,
        suggestions,
        reason: 'מילה באנגלית שאינה מוכרת במילון',
        type: 'unrecognized'
      };
    }
    return null;
  }

  return null;
}

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract all spelling errors from plain text or HTML string
export function findSpellingErrors(
  textOrHtml: string,
  userCustomDictionary: Set<string> = new Set()
): SpellingError[] {
  // Strip HTML tags to get pure text with indexes
  const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
  let pureText = textOrHtml;
  if (tempDiv && textOrHtml.includes('<')) {
    tempDiv.innerHTML = textOrHtml;
    pureText = tempDiv.textContent || tempDiv.innerText || '';
  }

  const errors: SpellingError[] = [];
  const errorWordMap = new Set<string>();

  // Check 2-word common phrases first (like "אני יעשה")
  for (const phrase of Object.keys(HEBREW_TYPOS_MAP)) {
    if (phrase.includes(' ')) {
      const regex = new RegExp(`(?<=^|\\s)(${escapeRegExp(phrase)})(?=\\s|[.,!?:;]|$)`, 'gi');
      let match;
      while ((match = regex.exec(pureText)) !== null) {
        const word = match[1];
        if (!errorWordMap.has(word)) {
          errorWordMap.add(word);
          errors.push({
            id: `err_phrase_${match.index}`,
            word,
            originalText: word,
            index: match.index,
            suggestions: HEBREW_TYPOS_MAP[phrase].suggestions,
            reason: HEBREW_TYPOS_MAP[phrase].reason,
            type: 'grammatical_slip'
          });
        }
      }
    }
  }

  // Tokenize individual words
  const wordRegex = /[\u0590-\u05FFa-zA-Z0-9'"״׳_-]+/g;
  let tokenMatch;

  while ((tokenMatch = wordRegex.exec(pureText)) !== null) {
    const rawWord = tokenMatch[0];
    const index = tokenMatch.index;

    // Skip if already caught in a phrase
    if (errors.some(e => index >= e.index && index < e.index + e.word.length)) {
      continue;
    }

    const check = checkWordSpell(rawWord, userCustomDictionary);
    if (check && check.isError) {
      errors.push({
        id: `err_${index}_${rawWord}`,
        word: rawWord,
        originalText: rawWord,
        index,
        suggestions: check.suggestions,
        reason: check.reason,
        type: check.type
      });
    }
  }

  return errors;
}

// Clean all spell error spans and underlines from HTML
export function cleanSpellMarksFromHtml(htmlContent: string): string {
  if (!htmlContent || typeof document === 'undefined') return htmlContent;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const spans = tempDiv.querySelectorAll('span.spell-error, [data-spell-word], [data-error-id]');
  spans.forEach((span) => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }
  });
  return tempDiv.innerHTML;
}

export interface MarkSpellResult {
  htmlWithMarks: string;
  errors: SpellingError[];
  toString(): string;
}

// Mark spelling errors visually with wavy red lines inside HTML content
export function markSpellErrorsInHtml(
  htmlContent: string,
  customDictOrErrors?: Set<string> | SpellingError[],
  ignoredWordsSet: Set<string> = new Set()
): MarkSpellResult {
  if (!htmlContent || typeof document === 'undefined') {
    const res: MarkSpellResult = {
      htmlWithMarks: htmlContent || '',
      errors: [],
      toString: () => htmlContent || ''
    };
    return res;
  }

  // Determine errors list
  let detectedErrors: SpellingError[] = [];
  if (Array.isArray(customDictOrErrors)) {
    detectedErrors = customDictOrErrors;
  } else {
    const userDict = customDictOrErrors instanceof Set ? customDictOrErrors : new Set<string>();
    detectedErrors = findSpellingErrors(htmlContent, userDict);
    if (ignoredWordsSet && ignoredWordsSet.size > 0) {
      detectedErrors = detectedErrors.filter(
        (e) => !ignoredWordsSet.has(e.word) && !ignoredWordsSet.has(e.id)
      );
    }
  }

  if (detectedErrors.length === 0) {
    const cleaned = cleanSpellMarksFromHtml(htmlContent);
    const res: MarkSpellResult = {
      htmlWithMarks: cleaned,
      errors: [],
      toString: () => cleaned
    };
    return res;
  }

  // Clean prior marks first
  const cleanBase = cleanSpellMarksFromHtml(htmlContent);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleanBase;

  const errorSet = new Map<string, SpellingError>();
  detectedErrors.forEach((e) => errorSet.set(e.word, e));

  // Walk text nodes and wrap errors in <span class="spell-error" data-spell-word="...">
  function walkNodes(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) return;

      let hasMatch = false;
      const frag = document.createDocumentFragment();
      const regex = /([\u0590-\u05FFa-zA-Z0-9'"״׳_-]+|[^\u0590-\u05FFa-zA-Z0-9'"״׳_-]+)/g;
      let m;

      while ((m = regex.exec(text)) !== null) {
        const part = m[0];
        const err = errorSet.get(part);

        if (err) {
          hasMatch = true;
          const span = document.createElement('span');
          span.className = 'spell-error cursor-pointer border-b-2 border-dashed border-destructive hover:bg-destructive/10 transition-colors';
          span.setAttribute('data-spell-word', part);
          span.setAttribute('data-error-id', err.id);
          span.textContent = part;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      }

      if (hasMatch && node.parentNode) {
        node.parentNode.replaceChild(frag, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.classList.contains('spell-error') || el.tagName === 'BUTTON' || el.tagName === 'CODE') {
        return;
      }
      Array.from(el.childNodes).forEach(walkNodes);
    }
  }

  Array.from(tempDiv.childNodes).forEach(walkNodes);

  const finalHtml = tempDiv.innerHTML;
  const result: MarkSpellResult = {
    htmlWithMarks: finalHtml,
    errors: detectedErrors,
    toString: () => finalHtml
  };
  return result;
}

// Replace a specific typo inside HTML content
export function replaceTypoInHtml(
  htmlContent: string,
  targetWord: string,
  replacement: string,
  replaceAll: boolean = true
): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  // 1. First remove any spell-error wrappers for this target word
  const spans = tempDiv.querySelectorAll(`span.spell-error[data-spell-word="${targetWord}"]`);
  spans.forEach((span) => {
    span.textContent = replacement;
    span.removeAttribute('data-spell-word');
    span.removeAttribute('data-error-id');
    span.className = '';
  });

  if (replaceAll) {
    // 2. Also replace in pure text nodes across the document
    function walkReplace(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.includes(targetWord)) {
          node.textContent = text.split(targetWord).join(replacement);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(walkReplace);
      }
    }
    Array.from(tempDiv.childNodes).forEach(walkReplace);
  }

  return tempDiv.innerHTML;
}
