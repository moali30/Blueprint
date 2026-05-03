import type { QuestionType } from './types';

/** MCQ أو صح/خطأ: مهارة واحدة فقط (مثل الاختياري). */
export function isObjectiveQuestionType(type: QuestionType): boolean {
  return type === 'MCQ' || type === 'TF';
}

export function normalizeQuestionType(value: unknown): QuestionType {
  const raw = String(value ?? '').trim();
  const lowered = raw.toLowerCase();
  const compactAscii = lowered.replace(/\s+|_/g, '');

  if (lowered === 'essay') return 'Essay';
  if (
    lowered === 'tf' ||
    compactAscii === 'true/false' ||
    compactAscii === 'truefalse' ||
    lowered === 't/f'
  )
    return 'TF';

  const ar = raw.replace(/\s+/g, '');
  if (/صح.?خط/.test(ar) || ar.includes('صح/خطأ') || ar.includes('صحخطأ')) return 'TF';

  return 'MCQ';
}

export function formatQuestionType(type: QuestionType, lang: 'ar' | 'en'): string {
  if (type === 'Essay') return lang === 'ar' ? 'مقالي' : 'Essay';
  if (type === 'TF') return lang === 'ar' ? 'صح/خطأ' : 'True/False';
  return 'MCQ';
}
