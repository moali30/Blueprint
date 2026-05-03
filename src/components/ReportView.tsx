import React from 'react';
import type { CourseInfo, Question, Chapter, SkillDef, LogoState } from '../types';
import { formatQuestionType } from '../questionType';

interface ReportViewProps {
  info: CourseInfo;
  questions: Question[];
  chapters: Chapter[];
  skills: SkillDef[];
  logos: LogoState;
}

// ─── Helpers ──────────────────────────────────────────────
const formatCLO = (codes: string[]) => {
  if (codes.length === 0) return '';
  return codes.map(c => c.toLowerCase()).join(' + ');
};

const formatExamDate = (date: string) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return date;
  }
};

const formatQuestionNos = (covered: string) => {
  return covered; // The string is now pre-formatted nicely with ranges and commas (e.g., "1-6, 8-12")
};

// ─── Inline Styles (for print fidelity) ──────────────────
const thStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '5px 8px', backgroundColor: '#dce6f0',
  textAlign: 'left', fontWeight: 'bold', fontSize: '11px', width: '20%'
};

const tdStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '5px 8px', fontSize: '11px', width: '30%'
};

const qThStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '5px 6px', backgroundColor: '#dce6f0',
  textAlign: 'center', fontWeight: 'bold', fontSize: '10.5px'
};

const qTdStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '10.5px'
};

const ceThStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '5px 4px', backgroundColor: '#dce6f0',
  textAlign: 'center', fontWeight: 'bold', fontSize: '9.5px', lineHeight: '1.35'
};

const ceTdStyle: React.CSSProperties = {
  border: '1.5px solid #000', padding: '4px 5px', textAlign: 'center', fontSize: '10.5px'
};

// ─── Component ────────────────────────────────────────────
export default function ReportView({ info, questions, chapters, skills, logos }: ReportViewProps) {
  const isAr = info.language === 'ar';
  const totalChapterHours = chapters.reduce((s, c) => s + (Number(c.hours) || 0), 0);
  const totalChapterMarks = chapters.reduce((s, c) => s + (Number(c.marks) || 0), 0);
  const totalQuestions = questions.length;

  // ─── Header Block (repeats on every printed page via table-header-group) ──
  const ReportHeader = () => (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left — HUE English */}
        <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {logos.leftLogo ? (
            <img src={logos.leftLogo} alt="HUE" style={{ height: '55px', objectFit: 'contain' }} />
          ) : (
            <div>
              <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px' }}>HUE</div>
              <div style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555' }}>Horus University in Egypt</div>
            </div>
          )}
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>Horus University</div>
            <div style={{ fontSize: '10px', color: '#333' }}>Faculty of Business Administration</div>
          </div>
        </div>

        {/* Center — QAU Seal */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {logos.centerSeal ? (
            <img src={logos.centerSeal} alt="QAU" style={{ height: '55px', objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: '55px', height: '55px', border: '2px solid #999',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '7px', textAlign: 'center', color: '#666'
            }}>QAU<br />Seal</div>
          )}
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', fontFamily: 'Cairo, sans-serif' }}>
            وحدة ضمان الجودة
          </div>
        </div>

        {/* Right — HUE Arabic */}
        <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
          {logos.rightLogo ? (
            <img src={logos.rightLogo} alt="حورس" style={{ height: '55px', objectFit: 'contain' }} />
          ) : (
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#666', fontFamily: 'Cairo, sans-serif' }}>
              شعار الجامعة
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: '13px', fontFamily: 'Cairo, sans-serif' }}>جامعـة حـورس</div>
          <div style={{ fontSize: '11px', fontFamily: 'Cairo, sans-serif' }}>كليــة إدارة الأعمــال</div>
        </div>
      </div>
      {/* Red separator line */}
      <div style={{ height: '2.5px', background: 'linear-gradient(90deg, #b91c1c, #dc2626, #b91c1c)', marginTop: '8px' }} />
    </div>
  );

  return (
    <div className="report-print-area" dir="ltr" style={{ fontFamily: 'Inter, Cairo, sans-serif', color: '#000' }}>
      {/* ───── Wrapper table = header repeats on every printed page ───── */}
      <table className="report-wrapper-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><td style={{ border: 'none', padding: '0 0 4px 0' }}>
            <ReportHeader />
          </td></tr>
        </thead>
        <tbody>
          <tr><td style={{ border: 'none', padding: 0 }}>

            {/* ════════════ PAGE 1: Title + Course Info + Questions Matrix ════════════ */}

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '10px 0 14px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: 1.9, fontFamily: 'Cairo, sans-serif', margin: 0 }}>
                مصفوفة استيفاء الورقة الامتحانية لمخرجات التعلم المستهدفة بتوصيف المقرر
              </h2>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', fontStyle: 'italic', margin: 0 }}>
                (Blueprint)
              </h2>
            </div>

            {/* Course Info Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
              <tbody>
                <tr>
                  <th style={thStyle}>{isAr ? 'البرنامج:' : 'Program:'}</th>
                  <td style={tdStyle}>{info.programName}</td>
                  <th style={thStyle}>{isAr ? 'القسم:' : 'Department:'}</th>
                  <td style={tdStyle}>{info.department}</td>
                </tr>
                <tr>
                  <th style={thStyle}>{isAr ? 'اسم المقرر:' : 'Course Title:'}</th>
                  <td style={tdStyle}>{info.courseTitle}</td>
                  <th style={thStyle}>{isAr ? 'إجمالي الساعات:' : 'Total Hours:'}</th>
                  <td style={tdStyle}>{info.totalHours}</td>
                </tr>
                <tr>
                  <th style={thStyle}>{isAr ? 'كود المقرر:' : 'Course Code:'}</th>
                  <td style={tdStyle}>{info.courseCode}</td>
                  <th style={thStyle}>{isAr ? 'تاريخ الامتحان:' : 'Date of Exam:'}</th>
                  <td style={tdStyle}>{formatExamDate(info.examDate)}</td>
                </tr>
                <tr>
                  <th style={thStyle}>{isAr ? 'المستوى:' : 'Level:'}</th>
                  <td style={tdStyle}>{info.level}</td>
                  <th style={thStyle}>{isAr ? 'إجمالي الدرجات:' : 'Total Marks:'}</th>
                  <td style={tdStyle}>{info.totalMarks}</td>
                </tr>
              </tbody>
            </table>

            {/* Questions Matrix Section */}
            <h3 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '10px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
              {isAr ? 'مصفوفة الأسئلة مع نواتج التعلم المستهدفة' : 'Question Matched with CLOs'}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...qThStyle, width: '12%' }}>{isAr ? 'رقم السؤال' : 'Question No.'}</th>
                  <th rowSpan={2} style={{ ...qThStyle, width: '18%' }}>{isAr ? 'نوع السؤال' : 'Question Type'}</th>
                  <th colSpan={3} style={qThStyle}>CLOs</th>
                </tr>
                <tr>
                  <th style={{ ...qThStyle, width: '23%' }}>K & U</th>
                  <th style={{ ...qThStyle, width: '23%' }}>IS</th>
                  <th style={{ ...qThStyle, width: '24%' }}>PS</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id}>
                    <td style={qTdStyle}>{q.id}</td>
                    <td style={qTdStyle}>{formatQuestionType(q.type, isAr ? 'ar' : 'en')}</td>
                    <td style={{ ...qTdStyle, fontWeight: q.cloKU.length > 0 ? 'bold' : 'normal' }}>
                      {formatCLO(q.cloKU)}
                    </td>
                    <td style={{ ...qTdStyle, fontWeight: q.cloIS.length > 0 ? 'bold' : 'normal' }}>
                      {formatCLO(q.cloIS)}
                    </td>
                    <td style={{ ...qTdStyle, fontWeight: q.cloPS.length > 0 ? 'bold' : 'normal' }}>
                      {formatCLO(q.cloPS)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Notes */}
            <div style={{ fontSize: '9.5px', marginBottom: '6px', lineHeight: 1.6 }}>
              <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 2px' }}>
                Notes: K&U: knowledge and understanding skills, IS: Intellectual skills questions, PS: Professional & Practical skills
              </p>
              <p style={{ fontStyle: 'italic', margin: 0 }}>
                General skills will be covered through classroom activities carried out by the student.
              </p>
            </div>

            {/* ════════════ PAGE 2: Course Matched with Exam ════════════ */}
            <div className="page-break" />

            <h3 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '12px', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
              {isAr ? 'مدى التوافق بين موضوعات المقرر والامتحان' : 'Course Matched with Exam'}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr>
                  <th style={{ ...ceThStyle, width: '4%' }}></th>
                  <th style={{ ...ceThStyle, width: '20%' }}>{isAr ? 'المحتوى' : 'contents'}</th>
                  <th style={ceThStyle}>
                    {isAr
                      ? 'عدد ساعات كل جزء من محتوى المقرر'
                      : 'No. of hours for each part of the course content'}
                  </th>
                  <th style={ceThStyle}>
                    {isAr
                      ? 'الوزن النسبي للساعات لكل جزء (%)'
                      : 'Relative weight of hours for each part of the course content (%)'}
                  </th>
                  <th style={ceThStyle}>
                    {isAr
                      ? 'مجموع درجات كل جزء من محتوى المقرر'
                      : 'Total marks for each part of the course content'}
                  </th>
                  <th style={ceThStyle}>
                    {isAr
                      ? 'الوزن النسبي للدرجات لكل جزء (%)'
                      : 'Relative weight of total marks for each part of the course content (%)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((c, idx) => (
                  <tr key={c.id}>
                    <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ ...ceTdStyle, textAlign: 'left', paddingLeft: '8px' }}>{c.title}</td>
                    <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>{c.hours}</td>
                    <td style={ceTdStyle}>
                      {info.totalHours ? ((c.hours / info.totalHours) * 100).toFixed(1) : 0}
                    </td>
                    <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>{c.marks}</td>
                    <td style={ceTdStyle}>
                      {info.totalMarks ? ((c.marks / info.totalMarks) * 100).toFixed(0) : 0}
                    </td>
                  </tr>
                ))}
                {/* TOTAL Row */}
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan={2} style={{ ...ceTdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                    TOTAL
                  </td>
                  <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>{totalChapterHours}</td>
                  <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>100</td>
                  <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>{totalChapterMarks}</td>
                  <td style={{ ...ceTdStyle, fontWeight: 'bold' }}>100</td>
                </tr>
              </tbody>
            </table>

            {/* ════════════ Coordinator Signature — same page, no page-break ════════════ */}

            {/* Red line */}
            <div style={{ height: '2.5px', background: 'linear-gradient(90deg, #b91c1c, #dc2626, #b91c1c)', marginBottom: '20px' }} />

            <div style={{ marginTop: '8px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px' }}>
                {isAr ? 'منسق المقرر:' : 'Course coordinator:'}
              </p>
              <p style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {info.coordinatorName || '...........................'}
              </p>
            </div>

          </td></tr>
        </tbody>
      </table>
    </div>
  );
}
