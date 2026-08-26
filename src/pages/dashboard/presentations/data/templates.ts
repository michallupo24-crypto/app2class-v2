import type { PresentationTemplate, Slide, SlideObject } from '../types';

// Static seed data - ids below are just placeholders so the literals below
// stay readable; instantiateTemplate() regenerates real ids per use so that
// two presentations created from the same template never share object ids.
const textObj = (partial: Partial<SlideObject> & { id: string; text: string }): SlideObject => ({
  type: 'text',
  x: 60,
  y: 60,
  width: 840,
  height: 100,
  zIndex: 0,
  fontSize: 24,
  bold: false,
  color: '#1A1D23',
  align: 'right',
  ...partial,
} as SlideObject);

const shapeObj = (partial: Partial<SlideObject> & { id: string }): SlideObject => ({
  type: 'shape',
  x: 60,
  y: 60,
  width: 200,
  height: 120,
  zIndex: 0,
  shape: 'rectangle',
  fill: '#2D5FF6',
  ...partial,
} as SlideObject);

const introLessonSlides: Slide[] = [
  {
    id: 't1-s1',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't1-s1-o1', text: 'שם הנושא', x: 60, y: 200, width: 840, height: 80, fontSize: 44, bold: true, align: 'center' }),
      textObj({ id: 't1-s1-o2', text: 'מטרות למידה: בסוף השיעור התלמידים יוכלו ל...', x: 60, y: 300, width: 840, height: 80, fontSize: 20, align: 'center' }),
    ],
  },
  {
    id: 't1-s2',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't1-s2-o1', text: 'תוכן ראשי', x: 60, y: 40, width: 840, height: 60, fontSize: 30, bold: true }),
      textObj({ id: 't1-s2-o2', text: 'כתבו כאן עד 40 מילים על הנושא...', x: 60, y: 120, width: 500, height: 300, fontSize: 20 }),
      shapeObj({ id: 't1-s2-o3', x: 600, y: 120, width: 300, height: 300, fill: '#E5EEFF' }),
    ],
  },
  {
    id: 't1-s3',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't1-s3-o1', text: 'מה למדנו היום?', x: 60, y: 60, width: 840, height: 60, fontSize: 30, bold: true, align: 'center' }),
      textObj({ id: 't1-s3-o2', text: '1.\n2.\n3.', x: 260, y: 180, width: 440, height: 240, fontSize: 22, align: 'right' }),
    ],
  },
];

const quizReviewSlides: Slide[] = [
  {
    id: 't2-s1',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't2-s1-o1', text: 'חזרה לקראת מבחן', x: 60, y: 220, width: 840, height: 80, fontSize: 40, bold: true, align: 'center' }),
    ],
  },
  {
    id: 't2-s2',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't2-s2-o1', text: 'שאלה 1', x: 60, y: 40, width: 840, height: 60, fontSize: 28, bold: true }),
      textObj({ id: 't2-s2-o2', text: 'כתבו כאן את השאלה...', x: 60, y: 140, width: 840, height: 200, fontSize: 22 }),
    ],
  },
];

const blankSlides: Slide[] = [
  {
    id: 't3-s1',
    background: '#FFFFFF',
    objects: [
      textObj({ id: 't3-s1-o1', text: 'כותרת', x: 60, y: 60, width: 840, height: 80, fontSize: 36, bold: true }),
    ],
  },
];

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  { id: 'intro-lesson', nameHe: 'שיעור מבוא - מבנה 3 שלבים', descriptionHe: 'כותרת ומטרות, תוכן, סיכום', slides: introLessonSlides },
  { id: 'quiz-review', nameHe: 'חזרה לפני מבחן', descriptionHe: 'כותרת ושקפי שאלה-תשובה', slides: quizReviewSlides },
  { id: 'blank', nameHe: 'מצגת ריקה', descriptionHe: 'שקף כותרת בודד, להתחלה מאפס', slides: blankSlides },
];

function regenId(prefix: string) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Deep-clones a template's slides with fresh ids, so multiple presentations
// created from the same template never share slide/object ids.
export function instantiateTemplate(template: PresentationTemplate): Slide[] {
  return template.slides.map((slide) => ({
    ...slide,
    id: regenId('slide'),
    objects: slide.objects.map((obj) => ({ ...obj, id: regenId('obj') })),
  }));
}
