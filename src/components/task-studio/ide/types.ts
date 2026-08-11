export type TaskLanguage = 'web' | 'python';
export type TaskMode = 'consume' | 'solve';

export interface LibraryOption {
  id: string;
  name: string;
  category: 'graphics' | 'charts' | '3d' | 'styling' | 'math' | 'audio' | 'game' | 'utility';
  description: string;
  scripts: string[];
  styles?: string[];
  sampleSnippet?: string;
}

// Client-side shape used by the editor/preview components. Mapped to/from the
// interactive_tasks DB row by InteractiveTaskBuilderMode.tsx (camelCase here,
// snake_case in Postgres).
export interface InteractiveTask {
  id: string;
  assignmentId?: string | null;
  authorId: string;
  authorName?: string;
  schoolId?: string | null;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  language: TaskLanguage;
  mode: TaskMode;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  pythonCode: string;
  libraries: string[];
  gradingSchema?: {
    maxScore: number;
    passingScore: number;
    instructions?: string;
  } | null;
  isPublicTemplate: boolean;
  forkedFrom?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskProgress {
  id: string;
  studentId: string;
  studentName: string;
  state: Record<string, any> | null;
  score: number | null;
  total: number | null;
  status: 'not_started' | 'in_progress' | 'submitted';
  timeSpentSeconds: number;
  lastActiveAt: string | null;
  submittedAt: string | null;
}

export interface ConsoleLog {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: string;
  line?: number;
  col?: number;
}

export type ViewMode = 'author' | 'gallery';

export type ResponsiveDevice = 'desktop' | 'tablet' | 'mobile' | 'phone_small';

export interface AIDebugResult {
  line?: number;
  explanation: string;
  suggestion: string;
  fixedCode?: {
    html?: string;
    css?: string;
    js?: string;
    python?: string;
  };
}
