export type DocMode = 'editing' | 'suggesting' | 'viewing';
export type ViewMode = 'paged' | 'pageless';
export type RibbonTab = 'file' | 'home' | 'insert' | 'layout' | 'review' | 'view';

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  createdAt: string;
  resolved: boolean;
  selectedText?: string;
  replies?: { id: string; author: string; avatar: string; text: string; createdAt: string }[];
}

export interface Suggestion {
  id: string;
  author: string;
  avatar: string;
  type: 'insert' | 'delete';
  originalText: string;
  suggestedText: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: string;
}

export interface VersionHistory {
  id: string;
  timestamp: string;
  title: string;
  author: string;
  contentHtml: string;
  changeSummary: string;
}

export interface DocumentModel {
  id: string;
  title: string;
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
  language: 'he' | 'en';
  dir: 'rtl' | 'ltr';
  viewMode: ViewMode;
  docMode: DocMode;
  comments: Comment[];
  suggestions: Suggestion[];
  history: VersionHistory[];
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  pageNumberPosition?: 'footer_left' | 'footer_center' | 'footer_right' | 'header_left' | 'header_right';
  pageNumberFormat?: 'standard' | 'simple' | 'page_x' | 'hebrew';
  pageBgColor: string;
  watermarkText: string;
  fontFamily: string;
  fontSize: string;
  lineSpacing: string;
  margins: { top: number; bottom: number; left: number; right: number }; // in mm or px
  zoom: number;
  tags: string[];
  isFavorite: boolean;
  folder?: string;
  wordCount?: number;
  charCount?: number;
  spellCheckEnabled?: boolean;
  customDictionary?: string[];
  ignoredWords?: string[];
}

export interface Template {
  id: string;
  name: string;
  nameHe: string;
  iconName: string;
  description: string;
  category: 'business' | 'academic' | 'personal' | 'creative' | 'blank';
  contentHtml: string;
  dir: 'rtl' | 'ltr';
  fontFamily: string;
}

export interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  color: string;
  status: 'online' | 'idle';
  currentSection?: string;
}

export interface AiPromptOption {
  id: string;
  title: string;
  prompt: string;
  icon: string;
  action: 'draft' | 'improve' | 'fix_grammar' | 'summarize' | 'change_tone' | 'translate' | 'continue' | 'custom';
}
