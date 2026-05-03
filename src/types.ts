export type Language = 'ar' | 'en';

export interface CourseInfo {
  programName: string;
  department: string;
  courseTitle: string;
  courseCode: string;
  level: string;
  totalHours: number;
  examDate: string;
  totalMarks: number;
  language: Language;
  creditHours?: number;
  weeks?: number;
  coordinatorName: string;
}

export type QuestionType = 'MCQ' | 'TF' | 'Essay';

export interface Question {
  id: number;
  type: QuestionType;
  cloKU: string[];
  cloIS: string[];
  cloPS: string[];
  formula: string;
  marks: number;
}

export interface Chapter {
  id: number;
  title: string;
  questionsCovered: string;
  hours: number;
  marks: number;
}

export interface SkillDef {
  id: number;
  category: 'KU' | 'IS' | 'PS';
  code: string;
  formula: string;
}

export interface LogoState {
  leftLogo: string | null;
  centerSeal: string | null;
  rightLogo: string | null;
}
