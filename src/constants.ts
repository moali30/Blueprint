import type { CourseInfo, LogoState, QuestionType } from './types';

export const INIT_INFO: CourseInfo = {
  programName: '', department: '', courseTitle: '', courseCode: '',
  level: 'First', totalHours: 42, examDate: '', totalMarks: 50,
  language: 'ar', creditHours: 3, weeks: 14, coordinatorName: ''
};

export const INIT_LOGOS: LogoState = {
  leftLogo: null, centerSeal: null, rightLogo: null
};

export const SAMPLE_AR = {
  info: {
    programName: 'إدارة الأعمال', department: 'المحاسبة',
    courseTitle: 'المحاسبة الإدارية', courseCode: 'ACCT-404',
    level: 'Fourth', totalHours: 42, examDate: '2026-01-14',
    totalMarks: 50, language: 'ar' as const, creditHours: 3, weeks: 14,
    coordinatorName: 'د. سالي أبو العنين'
  },
  skills: [
    { id: 1, category: 'KU' as const, code: 'أ1', formula: 'يتعرف على المفاهيم الأساسية للمحاسبة الإدارية.' },
    { id: 2, category: 'KU' as const, code: 'أ2', formula: 'يفهم دور المحاسب الإداري في اتخاذ القرارات.' },
    { id: 3, category: 'IS' as const, code: 'ب1', formula: 'يحلل العلاقة بين التكلفة والحجم والربح.' },
    { id: 4, category: 'PS' as const, code: 'ج1', formula: 'يعد الموازنات التخطيطية للشركات.' }
  ],
  questions: Array.from({ length: 37 }, (_, i) => {
    const type = i < 35 ? 'MCQ' as const : 'Essay' as const;
    let cloKU: string[] = [], cloIS: string[] = [], cloPS: string[] = [];
    if (type === 'MCQ') {
      if (i % 3 === 0) cloKU = ['أ1'];
      else if (i % 3 === 1) cloIS = ['ب1'];
      else cloPS = ['ج1'];
    } else { cloKU = ['أ1', 'أ2']; cloIS = ['ب1']; }
    return { id: i + 1, type, cloKU, cloIS, cloPS, formula: '', marks: 1 };
  }),
  chapters: [
    { id: 1, title: 'الفصل الأول', questionsCovered: '1, 2, 3, 4, 5, 6, 7', hours: 8, marks: 10 },
    { id: 2, title: 'الفصل الثاني', questionsCovered: '8, 9, 10, 11, 12, 13, 14, 15', hours: 10, marks: 12 },
    { id: 3, title: 'الفصل الثالث', questionsCovered: '16, 17, 18, 19, 20, 21, 22', hours: 8, marks: 10 },
    { id: 4, title: 'الفصل الرابع', questionsCovered: '23, 24, 25, 26, 27, 28, 29, 30', hours: 8, marks: 10 },
    { id: 5, title: 'الفصل الخامس', questionsCovered: '31, 32, 33, 34, 35, 36, 37', hours: 8, marks: 8 },
  ]
};

export const SAMPLE_EN = {
  info: {
    programName: 'Management', department: 'Quantitative methods',
    courseTitle: 'Applied Statistics', courseCode: 'STAT. 301',
    level: 'Third', totalHours: 42, examDate: '2026-01-22',
    totalMarks: 50, language: 'en' as const, creditHours: 3, weeks: 14,
    coordinatorName: 'Dr. Sally Abo Eleneen'
  },
  skills: [
    { id: 1, category: 'KU' as const, code: 'a1', formula: 'Identify basic statistical concepts.' },
    { id: 2, category: 'KU' as const, code: 'a2', formula: 'Understand probability distributions.' },
    { id: 3, category: 'KU' as const, code: 'a3', formula: 'Explain sampling methods and distributions.' },
    { id: 4, category: 'IS' as const, code: 'b1', formula: 'Analyze data using hypothesis testing.' },
    { id: 5, category: 'IS' as const, code: 'b2', formula: 'Interpret regression and correlation results.' },
    { id: 6, category: 'IS' as const, code: 'b3', formula: 'Evaluate time series data and forecast trends.' },
    { id: 7, category: 'IS' as const, code: 'b4', formula: 'Assess non-parametric test outcomes.' },
    { id: 8, category: 'PS' as const, code: 'c1', formula: 'Apply chi-square tests to real-world problems.' },
    { id: 9, category: 'PS' as const, code: 'c2', formula: 'Construct ANOVA tables and interpret F-tests.' },
    { id: 10, category: 'PS' as const, code: 'c3', formula: 'Perform non-parametric analysis using software.' },
    { id: 11, category: 'PS' as const, code: 'c4', formula: 'Build and validate regression models.' },
    { id: 12, category: 'PS' as const, code: 'c5', formula: 'Use forecasting techniques for business decisions.' }
  ],
  questions: (() => {
    // Match exact CLO mapping from the reference images
    const mapping: { ku: string[]; is: string[]; ps: string[] }[] = [
      { ku: ['A1'], is: [], ps: [] },        // Q1
      { ku: ['A2'], is: [], ps: [] },        // Q2
      { ku: ['A2'], is: [], ps: [] },        // Q3
      { ku: [], is: [], ps: ['C4'] },        // Q4
      { ku: [], is: [], ps: ['C4'] },        // Q5
      { ku: ['A1'], is: [], ps: [] },        // Q6
      { ku: ['A2'], is: [], ps: [] },        // Q7
      { ku: [], is: [], ps: ['C1'] },        // Q8
      { ku: ['A2'], is: [], ps: [] },        // Q9
      { ku: [], is: ['B2'], ps: [] },        // Q10
      { ku: [], is: [], ps: ['C3'] },        // Q11
      { ku: [], is: [], ps: ['C2'] },        // Q12
      { ku: [], is: ['B2'], ps: [] },        // Q13
      { ku: ['A1'], is: [], ps: [] },        // Q14
      { ku: ['A2'], is: [], ps: [] },        // Q15
      { ku: ['A2'], is: [], ps: [] },        // Q16
      { ku: ['A1'], is: [], ps: [] },        // Q17
      { ku: [], is: ['B3'], ps: [] },        // Q18
      { ku: [], is: [], ps: ['C2'] },        // Q19
      { ku: [], is: [], ps: ['C5'] },        // Q20
      { ku: [], is: [], ps: ['C5'] },        // Q21
      { ku: ['A3'], is: [], ps: [] },        // Q22
      { ku: [], is: [], ps: ['C3'] },        // Q23
      { ku: ['A2'], is: [], ps: [] },        // Q24
      { ku: ['A1'], is: [], ps: [] },        // Q25
      { ku: [], is: [], ps: [] },            // Q26
      { ku: [], is: ['B2'], ps: [] },        // Q27
      { ku: [], is: ['B3'], ps: [] },        // Q28
      { ku: [], is: ['B1'], ps: [] },        // Q29
      { ku: [], is: ['B1'], ps: [] },        // Q30
      { ku: [], is: ['B1'], ps: [] },        // Q31
      { ku: [], is: [], ps: ['C4'] },        // Q32
      { ku: [], is: ['B4'], ps: [] },        // Q33
      { ku: [], is: ['B4'], ps: [] },        // Q34
      { ku: [], is: [], ps: ['C1'] },        // Q35
    ];
    const questions: { id: number; type: QuestionType; cloKU: string[]; cloIS: string[]; cloPS: string[]; formula: string; marks: number }[] = mapping.map((m, i) => ({
      id: i + 1, type: 'MCQ' as const,
      cloKU: m.ku, cloIS: m.is, cloPS: m.ps, formula: '', marks: 1
    }));
    // Essay questions
    questions.push({ id: 36, type: 'Essay' as const, cloKU: ['A1'], cloIS: ['B1'], cloPS: [], formula: '', marks: 1 });
    questions.push({ id: 37, type: 'Essay' as const, cloKU: ['A3'], cloIS: [], cloPS: ['C2', 'C5'], formula: '', marks: 1 });
    return questions;
  })(),
  chapters: [
    { id: 1, title: 'Chapter 1: Sampling', questionsCovered: '1, 2, 3, 4, 5, 6, 7, 8, 9', hours: 9, marks: 9 },
    { id: 2, title: 'Chapter 2: Estimation of the Mean and Proportion', questionsCovered: '37', hours: 6, marks: 7.5 },
    { id: 3, title: 'Chapter 3: Hypothesis Testing', questionsCovered: '10, 11, 12, 13, 14, 15, 16, 17, 18', hours: 9, marks: 9 },
    { id: 4, title: 'Chapter 4: Analysis of variance', questionsCovered: '36', hours: 3, marks: 7.5 },
    { id: 5, title: 'Chapter 5: Chi-Square Tests', questionsCovered: '19, 20, 21', hours: 3, marks: 3 },
    { id: 6, title: 'Chapter 6: Non-parametric tests', questionsCovered: '22, 23, 24, 25, 26, 27, 28', hours: 6, marks: 7 },
    { id: 7, title: 'Chapter 7: Time Series Analysis and Forecasting', questionsCovered: '29, 30, 31, 32, 33, 34, 35', hours: 6, marks: 7 },
  ]
};
