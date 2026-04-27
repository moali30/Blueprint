import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer, Trash2, Plus, AlertTriangle, RefreshCw, Upload as UploadIcon,
  FileText, BookOpen, FileSpreadsheet, X, Check, Loader2,
  Save, Image, Target, HelpCircle,
  BarChart3, Sparkles, Download
} from 'lucide-react';
import { Mistral } from "@mistralai/mistralai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import type { CourseInfo, Question, Chapter, SkillDef, LogoState } from './types';
import { INIT_INFO, INIT_LOGOS, SAMPLE_AR, SAMPLE_EN } from './constants';
import ReportView from './components/ReportView';

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function App() {

  // ──── Core State ─────────────────────────────────────────
  const [info, setInfo] = useState<CourseInfo>(INIT_INFO);
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [logos, setLogos] = useState<LogoState>(INIT_LOGOS);
  const [numQuestions, setNumQuestions] = useState(37);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // ──── AI State ───────────────────────────────────────────
  const [aiModal, setAiModal] = useState<'blueprint' | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [conflictMode, setConflictMode] = useState(false);
  const [conflictMessages, setConflictMessages] = useState<string[]>([]);

  // ──── Smart Audit State ──────────────────────────────────
  const [smartAuditModal, setSmartAuditModal] = useState(false);
  const [smartAuditLoading, setSmartAuditLoading] = useState(false);
  const [smartAuditError, setSmartAuditError] = useState<string | null>(null);
  const [smartAuditQuestions, setSmartAuditQuestions] = useState<(Question & { predictedChapterId?: number })[]>([]);

  // ──── Skills Tab ─────────────────────────────────────────
  const [skillsTab, setSkillsTab] = useState<'KU' | 'IS' | 'PS'>('KU');

  // ──── Collapse State ─────────────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ──── Computed ───────────────────────────────────────────
  const isAr = info.language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const fontClass = isAr ? 'font-cairo' : 'font-inter';

  const totalChapterHours = chapters.reduce((s, c) => s + (Number(c.hours) || 0), 0);
  const totalChapterMarks = chapters.reduce((s, c) => s + (Number(c.marks) || 0), 0);
  const hoursMatch = totalChapterHours === info.totalHours;
  const marksMatch = totalChapterMarks === info.totalMarks;

  const stats = useMemo(() => {
    const mcq = questions.filter(q => q.type === 'MCQ').length;
    const essay = questions.filter(q => q.type === 'Essay').length;
    let ku = 0, is_ = 0, ps = 0;
    questions.forEach(q => { ku += q.cloKU.length; is_ += q.cloIS.length; ps += q.cloPS.length; });
    const maxClo = Math.max(ku, is_, ps);
    const mostCovered = maxClo === 0 ? 'None' : maxClo === ku ? 'K&U' : maxClo === is_ ? 'IS' : 'PS';
    return { mcq, essay, mostCovered };
  }, [questions]);

  const validationReport = useMemo(() => {
    const mcqs = questions.filter(q => q.type === 'MCQ');
    const essays = questions.filter(q => q.type === 'Essay');
    const totalMcqMarks = mcqs.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    const totalEssayMarks = essays.reduce((s, q) => s + (Number(q.marks) || 0), 0);
    const invalidMcqSkills = mcqs.filter(q => (q.cloKU.length + q.cloIS.length + q.cloPS.length) !== 1);
    const allUsedSkills = new Set([...questions.flatMap(q => [...q.cloKU, ...q.cloIS, ...q.cloPS])]);
    const uncoveredSkills = skills.filter(s => !allUsedSkills.has(s.code));
    const errors: string[] = [];
    if (totalMcqMarks !== 35) errors.push(isAr ? `مجموع درجات الاختياري ${totalMcqMarks} (المطلوب 35)` : `MCQ marks sum is ${totalMcqMarks} (Target: 35)`);
    if (totalEssayMarks !== 15) errors.push(isAr ? `مجموع درجات المقالي ${totalEssayMarks} (المطلوب 15)` : `Essay marks sum is ${totalEssayMarks} (Target: 15)`);
    if (invalidMcqSkills.length > 0) {
      const qIds = invalidMcqSkills.map(q => q.id).join('، ');
      errors.push(isAr ? `يوجد ${invalidMcqSkills.length} أسئلة اختيارية لا تحتوي على مهارة واحدة بالضبط (الأسئلة: ${qIds})` : `${invalidMcqSkills.length} MCQ questions don't have exactly 1 skill (Questions: ${qIds})`);
    }
    if (uncoveredSkills.length > 0) {
      const sCodes = uncoveredSkills.map(s => s.code).join('، ');
      errors.push(isAr ? `يوجد ${uncoveredSkills.length} مهارات غير مغطاة في الأسئلة (المهارات: ${sCodes})` : `${uncoveredSkills.length} skills are not covered by any question (Skills: ${sCodes})`);
    }
    return { totalMcqMarks, totalEssayMarks, invalidMcqSkills, uncoveredSkills, errors, isValid: errors.length === 0 };
  }, [questions, skills, isAr]);

  // ──── Persistence ────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('blueprintData');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.info) setInfo({ ...INIT_INFO, ...p.info, coordinatorName: p.info.coordinatorName || '' });
        if (p.skills) setSkills(p.skills);
        if (p.questions) setQuestions(p.questions);
        if (p.chapters) setChapters(p.chapters);
        if (p.logos) setLogos(p.logos);
        setNumQuestions(p.questions?.length || 37);
      }
    } catch (e) { /* ignore */ }
  }, []);

  const saveData = useCallback(() => {
    localStorage.setItem('blueprintData', JSON.stringify({ info, skills, questions, chapters, logos }));
    setSavedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  }, [info, skills, questions, chapters, logos]);

  useEffect(() => { saveData(); }, [saveData]);

  // ──── Core Functions ─────────────────────────────────────
  const updateInfo = (k: keyof CourseInfo, v: any) => setInfo(prev => ({ ...prev, [k]: v }));
  const updateQ = (idx: number, k: keyof Question, v: any) => { const n = [...questions]; (n[idx] as any)[k] = v; setQuestions(n); };
  const updateC = (idx: number, k: keyof Chapter, v: any) => { const n = [...chapters]; (n[idx] as any)[k] = v; setChapters(n); };

  const loadSample = (lang: 'ar' | 'en') => {
    const s = lang === 'ar' ? SAMPLE_AR : SAMPLE_EN;
    setInfo(s.info as CourseInfo); setSkills(s.skills as SkillDef[]); setQuestions(s.questions as any); setChapters(s.chapters); setNumQuestions(s.questions.length);
  };

  const resetData = () => {
    if (window.confirm(isAr ? 'هل أنت متأكد من حذف جميع البيانات؟' : 'Are you sure you want to reset all data?')) {
      setInfo(INIT_INFO); setSkills([]); setQuestions([]); setChapters([]); setLogos(INIT_LOGOS);
      setNumQuestions(37); localStorage.removeItem('blueprintData');
    }
  };

  const generateQuestions = () => setQuestions(Array.from({ length: numQuestions }, (_, i) => ({
    id: i + 1, type: 'MCQ' as const, cloKU: [], cloIS: [], cloPS: [], formula: '', marks: 1
  })));

  const addChapter = () => setChapters([...chapters, { id: Date.now(), title: '', questionsCovered: '', hours: 0, marks: 0 }]);
  const removeChapter = (id: number) => setChapters(chapters.filter(c => c.id !== id));

  const addSkill = (category: 'KU' | 'IS' | 'PS') => {
    const catSkills = skills.filter(s => s.category === category);
    const prefix = { KU: { en: 'a', ar: 'أ' }, IS: { en: 'b', ar: 'ب' }, PS: { en: 'c', ar: 'ج' } }[category][info.language];
    setSkills([...skills, { id: Date.now(), category, code: `${prefix}${catSkills.length + 1}`, formula: '' }]);
  };
  const updateSkill = (id: number, formula: string) => setSkills(skills.map(s => s.id === id ? { ...s, formula } : s));
  const removeSkill = (id: number) => setSkills(skills.filter(s => s.id !== id));

  const getSkillCode = (category: 'KU' | 'IS' | 'PS', index: number, lang: 'ar' | 'en', skill?: SkillDef) => {
    if (skill?.code) return skill.code;
    const prefix = { KU: { en: 'a', ar: 'أ' }, IS: { en: 'b', ar: 'ب' }, PS: { en: 'c', ar: 'ج' } }[category][lang];
    return `${prefix}${index + 1}`;
  };

  const handleTypeChange = (idx: number, newType: 'MCQ' | 'Essay') => {
    const q = questions[idx]; const n = [...questions];
    if (newType === 'MCQ') {
      let kept = false;
      const cloKU = q.cloKU.length > 0 && !kept ? (kept = true, [q.cloKU[0]]) : [];
      const cloIS = q.cloIS.length > 0 && !kept ? (kept = true, [q.cloIS[0]]) : [];
      const cloPS = q.cloPS.length > 0 && !kept ? (kept = true, [q.cloPS[0]]) : [];
      n[idx] = { ...q, type: newType, cloKU, cloIS, cloPS };
    } else { n[idx] = { ...q, type: newType }; }
    setQuestions(n);
  };

  // ──── Logo Upload ────────────────────────────────────────
  const handleLogoUpload = (slot: 'leftLogo' | 'centerSeal' | 'rightLogo', file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setLogos(prev => ({ ...prev, [slot]: reader.result })); };
    reader.readAsDataURL(file);
  };

  // ──── AI Functions — Blueprint only with Mistral OCR ────
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader(); r.readAsDataURL(file);
    r.onload = () => { if (typeof r.result === 'string') resolve(r.result.split(',')[1]); };
    r.onerror = reject;
  });

  const closeModal = () => { setAiModal(null); setConflictMode(false); setConflictMessages([]); setAiError(null); };

  const handleBlueprintUpload = async (file: File) => {
    setAiModal('blueprint'); setAiLoading(true); setAiResult(null); setConflictMode(false); setAiError(null);
    try {
      const base64 = await fileToBase64(file); const mimeType = file.type;
      const mistralApiKey = (import.meta as any).env.VITE_MISTRAL_API_KEY || "EIzqjOk3aGZK5bAaRZ6oTpmYmNzoWgSc";
      const client = new Mistral({ apiKey: mistralApiKey });

      const prompt = `Extract all the blueprint data from this document.\n\nCRITICAL: Extract CLO codes EXACTLY as they appear in the document.\n- English docs use: a1, a2, b1, b2, c1, c2, etc.\n- Arabic docs use: أ1, أ2, ب1, ب2, ج1, ج2, etc.\n\nCategory mapping:\n- "a" or "أ" → "KU"\n- "b" or "ب" → "IS"\n- "c" or "ج" → "PS"\n\nONLY extract CLOs with codes starting with a/أ, b/ب, or c/ج. SKIP d/د codes.\n\nFor the questions matrix, extract the EXACT CLO codes assigned to each question.\n\nAlso extract: course info, chapters with hours/marks/question coverage.`;
      const schemaDescription = `Respond STRICTLY with a JSON object matching this structure:\n{\n  "detectedLanguage": "'ar' for Arabic, 'en' for English",\n  "info": {\n    "programName": "",\n    "department": "",\n    "courseTitle": "",\n    "courseCode": "",\n    "level": "",\n    "totalHours": 0,\n    "totalMarks": 0\n  },\n  "skills": [\n    {\n      "code": "The EXACT CLO code from the document",\n      "category": "'KU', 'IS', or 'PS'",\n      "formula": ""\n    }\n  ],\n  "questions": [\n    {\n      "type": "'MCQ' or 'Essay'",\n      "formula": "",\n      "cloKU": [],\n      "cloIS": [],\n      "cloPS": []\n    }\n  ],\n  "chapters": [\n    {\n      "title": "",\n      "questionsCovered": "",\n      "hours": 0,\n      "marks": 0\n    }\n  ]\n}`;

      let retries = 2; let parsedResult: any = {};
      while (retries >= 0) {
        try {
          const dataUrl = `data:${mimeType};base64,${base64}`;
          let markdownText = "";
          try {
            const ocrResp = await client.ocr.process({ model: "mistral-ocr-latest", document: { type: "document_url", documentUrl: dataUrl } });
            if (ocrResp.pages) markdownText = ocrResp.pages.map(p => p.markdown || "").join("\n\n");
          } catch (ocrErr: any) {
            throw new Error("فشل في قراءة محتوى المستند (OCR). " + (ocrErr.message || ""));
          }
          // Use Mistral chat for structured extraction (no Gemini)
          const chatResp = await client.chat.complete({
            model: "mistral-large-latest",
            responseFormat: { type: "json_object" },
            messages: [
              { role: "system", content: "You are a highly precise data extraction assistant.\n\n" + schemaDescription },
              { role: "user", content: `${prompt}\n\n--- Document Content ---\n${markdownText}` }
            ]
          });
          const text = typeof chatResp.choices?.[0]?.message?.content === 'string' ? chatResp.choices[0].message.content : '';
          parsedResult = JSON.parse(text || "{}");
          
          // Force lowercase skills & CLOs, and format question ranges 1,2,3,4 -> 1-4
          if (parsedResult.skills) {
             parsedResult.skills.forEach((s: any) => { if (s.code) s.code = String(s.code).toLowerCase(); });
          }
          if (parsedResult.questions) {
             parsedResult.questions.forEach((q: any) => {
                if (q.cloKU) q.cloKU = q.cloKU.map((c: any) => String(c).toLowerCase());
                if (q.cloIS) q.cloIS = q.cloIS.map((c: any) => String(c).toLowerCase());
                if (q.cloPS) q.cloPS = q.cloPS.map((c: any) => String(c).toLowerCase());
             });
          }
          if (parsedResult.chapters) {
             parsedResult.chapters.forEach((c: any) => {
                if (c.questionsCovered) {
                  const nums = String(c.questionsCovered).match(/\d+/g);
                  if (nums && nums.length > 0) {
                    const unique = [...new Set(nums.map(n => parseInt(n, 10)))].sort((a, b) => a - b);
                    let res = [];
                    let start = unique[0]; let prev = unique[0];
                    for (let i = 1; i <= unique.length; i++) {
                      if (i < unique.length && unique[i] === prev + 1) { prev = unique[i]; }
                      else {
                        if (start === prev) res.push(`${start}`);
                        else if (prev === start + 1) res.push(`${start}, ${prev}`);
                        else res.push(`${start}-${prev}`);
                        if (i < unique.length) { start = unique[i]; prev = unique[i]; }
                      }
                    }
                    c.questionsCovered = res.join(', ');
                  }
                }
             });
          }
          
          break;
        } catch (error: any) {
          if (error?.status === 429 && retries > 0) { await new Promise(r => setTimeout(r, 10000)); retries--; }
          else throw error;
        }
      }
      setAiResult(parsedResult);
    } catch (error: any) {
      setAiError(error.message || "حدث خطأ أثناء تحليل الملف.");
    } finally { setAiLoading(false); }
  };

  // ──── Apply Blueprint Results ────────────────────────────
  const applyBlueprint = () => {
    if (!aiResult) return;
    if (aiResult.info) {
      const infoUpdate = { ...info };
      Object.assign(infoUpdate, aiResult.info);
      if (aiResult.detectedLanguage === 'ar' || aiResult.detectedLanguage === 'en') infoUpdate.language = aiResult.detectedLanguage;
      setInfo(infoUpdate);
    }
    if (aiResult.skills) {
      let ns = [...skills];
      aiResult.skills.forEach((s: any, i: number) => {
        if (!s?.code) return; const sc = String(s.code).trim();
        const idx = ns.findIndex(ex => String(ex.code).trim().toLowerCase() === sc.toLowerCase());
        if (idx >= 0) { ns[idx] = { ...ns[idx], category: ['KU', 'IS', 'PS'].includes(s.category) ? s.category : ns[idx].category, code: sc }; }
        else { ns.push({ id: Date.now() + i, category: ['KU', 'IS', 'PS'].includes(s.category) ? s.category : 'KU', code: sc, formula: s.formula || '' }); }
      });
      setSkills(ns);
    }
    if (aiResult.questions) {
      let nq = [...questions]; const maxLen = Math.max(questions.length, aiResult.questions.length); const warnings: string[] = [];
      nq = Array.from({ length: maxLen }).map((_, i) => {
        const existing = questions[i]; const q = aiResult.questions[i];
        if (!q) return existing;
        const cnt = (Array.isArray(q.cloKU) ? q.cloKU.length : 0) + (Array.isArray(q.cloIS) ? q.cloIS.length : 0) + (Array.isArray(q.cloPS) ? q.cloPS.length : 0);
        if (q.type === 'MCQ' && cnt > 1) warnings.push(`السؤال رقم ${i + 1} يحتوي على أكثر من مهارة.`);
        if (!existing) return { id: i + 1, type: (q.type === 'Essay' ? 'Essay' : 'MCQ') as 'MCQ' | 'Essay', formula: '', cloKU: Array.isArray(q.cloKU) ? q.cloKU : [], cloIS: Array.isArray(q.cloIS) ? q.cloIS : [], cloPS: Array.isArray(q.cloPS) ? q.cloPS : [], marks: 1 };
        return { ...existing, type: q.type || existing.type, formula: existing.formula || '', marks: existing.marks || 1, cloKU: q.cloKU?.length > 0 ? q.cloKU : existing.cloKU, cloIS: q.cloIS?.length > 0 ? q.cloIS : existing.cloIS, cloPS: q.cloPS?.length > 0 ? q.cloPS : existing.cloPS };
      });
      if (warnings.length > 0) { setConflictMessages(p => [...p, ...warnings]); setConflictMode(true); }
      setQuestions(nq); setNumQuestions(nq.length);
    }
    if (aiResult.chapters) {
      let nc = [...chapters]; const maxLen = Math.max(chapters.length, aiResult.chapters.length);
      nc = Array.from({ length: maxLen }).map((_, i) => {
        const existing = chapters[i]; const c = aiResult.chapters[i];
        if (!c) return existing;
        if (!existing) return { id: Date.now() + i, title: c.title || '', questionsCovered: c.questionsCovered || '', hours: c.hours || 0, marks: c.marks || 0 };
        return { ...existing, title: c.title || existing.title, questionsCovered: c.questionsCovered || existing.questionsCovered, hours: c.hours || existing.hours, marks: c.marks || existing.marks };
      });
      setChapters(nc);
    }
    closeModal();
  };

  const handleApplyClick = () => {
    let nc: string[] = [];
    if (aiResult?.skills?.length && skills.length > 0 && aiResult.skills.length !== skills.length)
      nc.push(`تنبيه المهارات: عدد المهارات المستخرج (${aiResult.skills.length}) يختلف عن الموجود (${skills.length}).`);
    if (nc.length > 0 && !conflictMode) { setConflictMessages(nc); setConflictMode(true); return; }
    applyBlueprint();
  };

  // ── Smart Audit ──────────────────────────────────────────
  const openSmartAudit = async () => {
    if (questions.length === 0 || chapters.length === 0 || skills.length === 0) {
      alert(isAr ? 'تأكد من إدخال الأسئلة والمهارات والفصول أولاً.' : 'Please add questions, skills, and chapters first.'); return;
    }
    setSmartAuditModal(true); setSmartAuditLoading(true); setSmartAuditError(null);
    try {
      const genAI = new GoogleGenerativeAI((import.meta as any).env.VITE_GEMMA_API_KEY || "AIzaSyBk28b61Ggmb7SvWK2n4ZoXIvC11Yk5fFg");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are a Smart Blueprint Assistant for a University course.\nTask: Map each exam question to the most relevant Chapter and the most relevant Skills (CLOs).\n\nChapters:\n${JSON.stringify(chapters.map(c => ({ id: c.id, title: c.title })))}\n\nSkills/CLOs:\n${JSON.stringify(skills.map(s => ({ code: s.code, category: s.category, formula: s.formula })))}\n\nQuestions:\n${JSON.stringify(questions.map(q => ({ id: q.id, type: q.type, formula: q.formula })))}\n\nLogic:\n1. Every question MUST be mapped to exactly ONE chapterId.\n2. Every question MUST be mapped to AT LEAST ONE Skill code.\n3. Organize the skill codes into cloKU, cloIS, and cloPS correctly.\n\nResponse MUST be a clean JSON array of objects:\n[{ "id": 1, "chapterId": 12345, "cloKU": ["a1"], "cloIS": [], "cloPS": [] }]`;
      const chatResp = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });
      const mappings = JSON.parse(chatResp.response.text() || "[]");
      setSmartAuditQuestions(questions.map(q => {
        const m = mappings.find((x: any) => x.id === q.id); let nq: Question & { predictedChapterId?: number } = { ...q };
        if (m) { nq.cloKU = m.cloKU || []; nq.cloIS = m.cloIS || []; nq.cloPS = m.cloPS || []; nq.predictedChapterId = m.chapterId; }
        return nq;
      }));
    } catch (err: any) { setSmartAuditError(err.message || 'An error occurred.'); } finally { setSmartAuditLoading(false); }
  };

  const applySmartBlueprint = () => {
    setQuestions(smartAuditQuestions.map(sq => { const q = { ...sq } as any; delete q.predictedChapterId; return q; }));
    setChapters(chapters.map(c => {
      const assigned = smartAuditQuestions.filter(sq => sq.predictedChapterId === c.id);
      
      // Auto-format the assigned questions to ranges (e.g. 1-4)
      const nums = assigned.map(sq => sq.id).sort((a, b) => a - b);
      let formattedQuestions = '';
      if (nums.length > 0) {
        let res = [];
        let start = nums[0]; let prev = nums[0];
        for (let i = 1; i <= nums.length; i++) {
          if (i < nums.length && nums[i] === prev + 1) { prev = nums[i]; }
          else {
            if (start === prev) res.push(`${start}`);
            else if (prev === start + 1) res.push(`${start}, ${prev}`);
            else res.push(`${start}-${prev}`);
            if (i < nums.length) { start = nums[i]; prev = nums[i]; }
          }
        }
        formattedQuestions = res.join(', ');
      }

      return { ...c, questionsCovered: formattedQuestions, marks: assigned.reduce((s, sq) => s + (Number(sq.marks) || 0), 0) };
    }));
    setSmartAuditModal(false);
  };

  // ──── Skill Select Render ────────────────────────────────
  const renderSkillSelect = (qIdx: number, category: 'KU' | 'IS' | 'PS') => {
    const q = questions[qIdx];
    const available = skills.filter(s => s.category === category).map((s, idx) => getSkillCode(category, idx, info.language, s));
    const selected = category === 'KU' ? q.cloKU : category === 'IS' ? q.cloIS : q.cloPS;
    if (q.type === 'MCQ') {
      return (
        <select className="w-full p-1 bg-transparent outline-none text-center text-xs" value={selected[0] || ''} onChange={e => {
          const val = e.target.value; const n = [...questions];
          if (val) n[qIdx] = { ...q, cloKU: category === 'KU' ? [val] : [], cloIS: category === 'IS' ? [val] : [], cloPS: category === 'PS' ? [val] : [] };
          else n[qIdx] = { ...q, [`clo${category}`]: [] };
          setQuestions(n);
        }}>
          <option value=""></option>
          {available.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    }
    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {available.map(code => (
          <label key={code} className="flex items-center gap-0.5 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200 border border-gray-200">
            <input type="checkbox" className="w-3 h-3" checked={selected.includes(code)} onChange={e => {
              const ns = e.target.checked ? [...selected, code] : selected.filter(c => c !== code);
              updateQ(qIdx, `clo${category}` as keyof Question, ns);
            }} />
            {code}
          </label>
        ))}
        {available.length === 0 && <span className="text-gray-400 text-[10px]">-</span>}
      </div>
    );
  };

  // ──── AI Preview Render ──────────────────────────────────
  const renderAiPreview = () => {
    if (!aiResult) return null;
    return (
      <div className="space-y-5 text-sm" dir={dir}>
        {aiResult.info && Object.keys(aiResult.info).length > 0 && (
          <div><h4 className="font-bold text-navy mb-2 border-b pb-1 text-base">{isAr ? 'بيانات المقرر' : 'Course Info'}</h4><div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border text-xs">{Object.entries(aiResult.info).map(([k, v]) => <div key={k}><span className="font-semibold text-gray-600">{k}:</span> <span dir="auto">{String(v)}</span></div>)}</div></div>
        )}
        {aiResult.skills?.length > 0 && (
          <div><h4 className="font-bold text-navy mb-2 border-b pb-1 text-base">{isAr ? 'المهارات' : 'Skills'} ({aiResult.skills.length})</h4><div className="overflow-x-auto"><table className="w-full border-collapse border border-gray-200 text-xs"><thead><tr className="bg-gray-100"><th className="border p-2">Code</th><th className="border p-2">Cat.</th><th className="border p-2">Formula</th></tr></thead><tbody>{aiResult.skills.map((s: any, i: number) => <tr key={i}><td className="border p-2 text-center font-bold" dir="auto">{s.code}</td><td className="border p-2 text-center">{s.category}</td><td className="border p-2" dir="auto">{s.formula}</td></tr>)}</tbody></table></div></div>
        )}
        {aiResult.chapters?.length > 0 && (
          <div><h4 className="font-bold text-navy mb-2 border-b pb-1 text-base">{isAr ? 'الفصول' : 'Chapters'} ({aiResult.chapters.length})</h4><div className="overflow-x-auto"><table className="w-full border-collapse border border-gray-200 text-xs"><thead><tr className="bg-gray-100"><th className="border p-2">Title</th><th className="border p-2 w-16">Hours</th><th className="border p-2 w-16">Marks</th><th className="border p-2 w-28">Questions</th></tr></thead><tbody>{aiResult.chapters.map((c: any, i: number) => <tr key={i}><td className="border p-2" dir="auto">{c.title}</td><td className="border p-2 text-center">{c.hours ?? '-'}</td><td className="border p-2 text-center">{c.marks ?? '-'}</td><td className="border p-2 text-center" dir="auto">{c.questionsCovered || '-'}</td></tr>)}</tbody></table></div></div>
        )}
        {aiResult.questions?.length > 0 && (
          <div><h4 className="font-bold text-navy mb-2 border-b pb-1 text-base">{isAr ? 'الأسئلة' : 'Questions'} ({aiResult.questions.length})</h4><div className="max-h-72 overflow-y-auto border rounded-lg"><table className="w-full border-collapse text-xs"><thead className="sticky top-0 bg-gray-100"><tr><th className="border p-2 w-10">#</th><th className="border p-2 w-16">Type</th><th className="border p-2">Formula</th><th className="border p-2 w-16">KU</th><th className="border p-2 w-16">IS</th><th className="border p-2 w-16">PS</th></tr></thead><tbody>{aiResult.questions.map((q: any, i: number) => <tr key={i}><td className="border p-2 text-center">{i + 1}</td><td className="border p-2 text-center">{q.type}</td><td className="border p-2" dir="auto">{q.formula || <span className="text-gray-400 italic">N/A</span>}</td><td className="border p-2 text-center font-bold" dir="auto">{q.cloKU?.join(', ') || '-'}</td><td className="border p-2 text-center font-bold" dir="auto">{q.cloIS?.join(', ') || '-'}</td><td className="border p-2 text-center font-bold" dir="auto">{q.cloPS?.join(', ') || '-'}</td></tr>)}</tbody></table></div></div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  //  SECTION HEADER COMPONENT
  // ════════════════════════════════════════════════════════════
  const SectionHeader = ({ id, icon, title, badge }: { id: string; icon: React.ReactNode; title: string; badge?: React.ReactNode }) => (
    <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => toggleSection(id)}>
      <h2 className="text-lg font-bold text-navy flex items-center gap-2">{icon} {title}</h2>
      <div className="flex items-center gap-3">
        {badge}
        <span className={`text-gray-400 transition-transform duration-200 text-sm ${collapsedSections[id] ? '' : 'rotate-180'}`}>▼</span>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  //  MAIN RENDER — ALL SECTIONS VISIBLE AT ONCE
  // ════════════════════════════════════════════════════════════

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 text-navy ${fontClass}`} dir={dir}>
      {/* ──── Header ──────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-navy via-navy-light to-navy text-white shadow-lg print-hidden">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gold/20 p-2 rounded-lg"><FileText size={22} className="text-gold" /></div>
            <div>
              <h1 className="text-base font-bold text-gold leading-tight">Blueprint Generator</h1>
              <p className="text-[10px] text-blue-200">Horus University - Faculty of Business Administration</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {savedAt && <span className="text-[10px] text-blue-300 flex items-center gap-1 save-flash"><Save size={12} /> {savedAt}</span>}
            <button onClick={() => updateInfo('language', isAr ? 'en' : 'ar')} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-bold transition">{isAr ? 'EN' : 'عربي'}</button>
            <button onClick={resetData} className="text-red-300 hover:text-red-100 p-1.5 rounded-lg hover:bg-white/10 transition"><RefreshCw size={16} /></button>
          </div>
        </div>
      </header>

      {/* ──── All Sections ─────────────────────────────────── */}
      <main className="max-w-7xl mx-auto p-4 md:px-8 md:py-6 print-hidden space-y-5">

        {/* ═══ Section: AI Import (Blueprint Only) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <SectionHeader
            id="import"
            icon={<div className="bg-gradient-to-br from-navy to-blue-900 text-gold p-2 rounded-xl"><UploadIcon size={20} /></div>}
            title={isAr ? 'الاستيراد الذكي (AI OCR) — Blueprint فقط' : 'Smart Import (AI OCR) — Blueprint Only'}
          />
          {!collapsedSections['import'] && (
            <div className="mt-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="card-hover cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center hover:border-gold hover:bg-yellow-50/30 transition-all group">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full mb-3 group-hover:bg-gold/20 group-hover:text-navy transition-colors"><FileSpreadsheet size={28} /></div>
                  <span className="font-bold text-sm">{isAr ? 'رفع مصفوفة (Blueprint)' : 'Upload Blueprint'}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center">{isAr ? 'استخراج كافة البيانات عبر Mistral AI OCR' : 'Extract all data via Mistral AI OCR'}</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleBlueprintUpload(e.target.files[0]); e.target.value = ''; }} />
                </label>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-5 flex flex-col justify-center">
                  <h3 className="font-bold text-sm text-gray-600 mb-3">{isAr ? 'بداية سريعة' : 'Quick Start'}</h3>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => loadSample('ar')} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold hover:border-gold hover:shadow-sm transition-all">🇸🇦 {isAr ? 'عينة عربية' : 'Arabic Sample'}</button>
                    <button onClick={() => loadSample('en')} className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold hover:border-gold hover:shadow-sm transition-all">🇬🇧 {isAr ? 'عينة إنجليزية' : 'English Sample'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Section: Course Info ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <SectionHeader
            id="courseInfo"
            icon={<BookOpen size={20} className="text-gold" />}
            title={isAr ? 'بيانات المقرر' : 'Course Information'}
          />
          {!collapsedSections['courseInfo'] && (
            <div className="mt-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'اللغة' : 'Language'}</label><select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none bg-white" value={info.language} onChange={e => updateInfo('language', e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'اسم البرنامج' : 'Program Name'}</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.programName} onChange={e => updateInfo('programName', e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'القسم العلمي' : 'Department'}</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.department} onChange={e => updateInfo('department', e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'اسم المقرر' : 'Course Title'}</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.courseTitle} onChange={e => updateInfo('courseTitle', e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'كود المقرر' : 'Course Code'}</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.courseCode} onChange={e => updateInfo('courseCode', e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'المستوى' : 'Level'}</label><select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none bg-white" value={info.level} onChange={e => updateInfo('level', e.target.value)}><option value="First">{isAr ? 'الأول' : 'First'}</option><option value="Second">{isAr ? 'الثاني' : 'Second'}</option><option value="Third">{isAr ? 'الثالث' : 'Third'}</option><option value="Fourth">{isAr ? 'الرابع' : 'Fourth'}</option></select></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'الساعات المعتمدة' : 'Credit Hours'}</label><input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.creditHours} onChange={e => { updateInfo('creditHours', Number(e.target.value)); updateInfo('totalHours', Number(e.target.value) * (info.weeks || 14)); }} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'أسابيع التدريس' : 'Study Weeks'}</label><input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.weeks ?? 14} onChange={e => { updateInfo('weeks', Number(e.target.value)); updateInfo('totalHours', (info.creditHours || 3) * Number(e.target.value)); }} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'إجمالي الساعات (محسوب)' : 'Total Hours (calc.)'}</label><input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none bg-gray-50" value={info.totalHours} onChange={e => updateInfo('totalHours', Number(e.target.value))} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'إجمالي الدرجات' : 'Total Marks'}</label><input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.totalMarks} onChange={e => updateInfo('totalMarks', Number(e.target.value))} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'تاريخ الامتحان' : 'Exam Date'}</label><input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" value={info.examDate} onChange={e => updateInfo('examDate', e.target.value)} /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1.5">{isAr ? 'منسق المقرر' : 'Course Coordinator'}</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold outline-none" placeholder={isAr ? 'د. اسم المنسق' : 'Dr. Name'} value={info.coordinatorName} onChange={e => updateInfo('coordinatorName', e.target.value)} /></div>
              </div>

              {/* Logo Upload */}
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-bold text-navy mb-4 flex items-center gap-2"><Image size={18} className="text-gold" /> {isAr ? 'شعارات التقرير' : 'Report Logos'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {(['leftLogo', 'centerSeal', 'rightLogo'] as const).map((slot, i) => {
                    const labels = isAr
                      ? ['شعار الجامعة (إنجليزي)', 'ختم ضمان الجودة', 'شعار الجامعة (عربي)']
                      : ['HUE Logo (English)', 'QAU Seal', 'HUE Logo (Arabic)'];
                    return (
                      <label key={slot} className={`logo-zone ${logos[slot] ? 'filled' : ''} flex flex-col items-center justify-center min-h-[120px] cursor-pointer`}>
                        {logos[slot] ? (
                          <>
                            <img src={logos[slot]!} alt="" className="h-14 object-contain mb-2" />
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Check size={12} /> {isAr ? 'تم الرفع' : 'Uploaded'}</span>
                            <button onClick={(e) => { e.preventDefault(); setLogos(p => ({ ...p, [slot]: null })); }} className="mt-1 text-[10px] text-red-500 hover:text-red-700">
                              {isAr ? 'إزالة' : 'Remove'}
                            </button>
                          </>
                        ) : (
                          <>
                            <UploadIcon size={24} className="text-gray-400 mb-2" />
                            <span className="text-xs font-semibold text-gray-600">{labels[i]}</span>
                            <span className="text-[10px] text-gray-400 mt-1">PNG / JPG</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleLogoUpload(slot, e.target.files[0]); }} />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Section: Skills ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <SectionHeader
            id="skills"
            icon={<Target size={20} className="text-gold" />}
            title={isAr ? 'تعريف المهارات ونواتج التعلم' : 'Skills & CLOs Definition'}
            badge={skills.length > 0 ? <span className="text-xs font-bold bg-navy text-white px-2.5 py-1 rounded-full">{skills.length}</span> : undefined}
          />
          {!collapsedSections['skills'] && (
            <div className="mt-5">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-200 mb-6">
                {(['KU', 'IS', 'PS'] as const).map(cat => {
                  const count = skills.filter(s => s.category === cat).length;
                  const active = skillsTab === cat;
                  const catConfig: Record<string, { labelAr: string; labelEn: string }> = {
                    KU: { labelAr: 'المعرفة والفهم', labelEn: 'Knowledge & Understanding (K&U)' },
                    IS: { labelAr: 'المهارات الذهنية', labelEn: 'Intellectual Skills (IS)' },
                    PS: { labelAr: 'المهارات المهنية والعملية', labelEn: 'Professional Skills (PS)' },
                  };
                  return (
                    <button key={cat} onClick={() => setSkillsTab(cat)} className={`relative px-5 py-2.5 text-sm font-bold rounded-t-lg transition-all ${active ? 'bg-white text-navy border border-gray-200 border-b-white -mb-px tab-active' : 'text-gray-500 hover:text-navy hover:bg-gray-50'}`}>
                      {isAr ? catConfig[cat].labelAr : catConfig[cat].labelEn}
                      {count > 0 && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-navy text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Skills list */}
              <div className="space-y-3">
                {skills.filter(s => s.category === skillsTab).map((s, idx) => {
                  const clsMap: Record<string, string> = { KU: 'skill-ku', IS: 'skill-is', PS: 'skill-ps' };
                  return (
                    <div key={s.id} className={`${clsMap[skillsTab]} bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col md:flex-row gap-3 items-start`}>
                      <div className="font-bold text-navy text-sm bg-white px-3 py-1.5 rounded border border-gray-200 whitespace-nowrap">
                        {getSkillCode(skillsTab, idx, info.language, s)}
                      </div>
                      <textarea className="flex-1 w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold resize-y min-h-[50px] text-sm" value={s.formula} onChange={e => updateSkill(s.id, e.target.value)} placeholder={isAr ? 'أدخل صيغة المهارة...' : 'Enter skill formula...'} />
                      <button onClick={() => removeSkill(s.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  );
                })}
                {skills.filter(s => s.category === skillsTab).length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <Target size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">{isAr ? 'لا توجد مهارات مضافة' : 'No skills added yet'}</p>
                  </div>
                )}
              </div>
              <button onClick={() => addSkill(skillsTab)} className="mt-4 flex items-center gap-2 text-sm text-navy hover:text-gold font-bold transition-colors"><Plus size={18} /> {isAr ? 'إضافة مهارة' : 'Add Skill'}</button>
            </div>
          )}
        </div>

        {/* ═══ Section: Questions ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <SectionHeader
            id="questions"
            icon={<HelpCircle size={20} className="text-gold" />}
            title={isAr ? 'مصفوفة الأسئلة' : 'Questions Matrix'}
            badge={questions.length > 0 ? (
              <div className="flex gap-2 text-xs font-bold">
                <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">MCQ: {stats.mcq}</span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full">Essay: {stats.essay}</span>
              </div>
            ) : undefined}
          />
          {!collapsedSections['questions'] && (
            <div className="mt-5 space-y-5">
              {/* Controls */}
              <div className="flex flex-wrap gap-4 items-end bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{isAr ? 'عدد الأسئلة' : 'Total Questions'}</label>
                  <input type="number" className="w-28 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 outline-none text-center font-bold" value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))} />
                </div>
                <button onClick={generateQuestions} className="bg-navy text-white px-5 py-2 rounded-lg font-bold hover:bg-opacity-90 transition text-sm shadow-sm">{isAr ? 'إنشاء الجدول' : 'Generate'}</button>
              </div>

              {/* Table */}
              {questions.length > 0 && (
                <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-xl">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-navy text-white shadow-sm z-10">
                      <tr>
                        <th className="p-2.5 border-r border-blue-900/50 w-12 text-center">#</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-24 text-center">{isAr ? 'النوع' : 'Type'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 min-w-[200px]">{isAr ? 'صيغة السؤال (اختياري)' : 'Question Formula'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-24 text-center">K&U</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-24 text-center">IS</th>
                        <th className="p-2.5 w-24 text-center">PS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.map((q, idx) => {
                        const skillCount = q.cloKU.length + q.cloIS.length + q.cloPS.length;
                        const rowCls = q.type === 'MCQ' && skillCount !== 1 ? 'q-row-error' : skillCount > 0 ? 'q-row-complete' : 'q-row-partial';
                        return (
                          <tr key={q.id} className={`${rowCls} hover:bg-gray-50/80 transition-colors`}>
                            <td className="p-2 text-center font-bold text-gray-500 border-r border-gray-100">{q.id}</td>
                            <td className="p-2 border-r border-gray-100">
                              <select className="w-full p-1 bg-transparent outline-none text-xs font-semibold text-center" value={q.type} onChange={e => handleTypeChange(idx, e.target.value as 'MCQ' | 'Essay')}>
                                <option value="MCQ">MCQ</option><option value="Essay">Essay</option>
                              </select>
                            </td>
                            <td className="p-2 border-r border-gray-100"><textarea className="w-full p-1 bg-transparent outline-none resize-y min-h-[32px] text-xs" value={q.formula || ''} onChange={e => updateQ(idx, 'formula', e.target.value)} placeholder={isAr ? 'صيغة...' : 'Formula...'} /></td>
                            <td className="p-1.5 border-r border-gray-100">{renderSkillSelect(idx, 'KU')}</td>
                            <td className="p-1.5 border-r border-gray-100">{renderSkillSelect(idx, 'IS')}</td>
                            <td className="p-1.5">{renderSkillSelect(idx, 'PS')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {questions.length === 0 && (
                <div className="text-center py-14 text-gray-400">
                  <HelpCircle size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-semibold">{isAr ? 'حدد عدد الأسئلة ثم اضغط "إنشاء الجدول"' : 'Set question count and click "Generate"'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ Section: Chapters ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          <SectionHeader
            id="chapters"
            icon={<BarChart3 size={20} className="text-gold" />}
            title={isAr ? 'توزيع المحتوى' : 'Content Distribution'}
            badge={chapters.length > 0 ? <span className="text-xs font-bold bg-navy text-white px-2.5 py-1 rounded-full">{chapters.length}</span> : undefined}
          />
          {!collapsedSections['chapters'] && (
            <div className="mt-5 space-y-5">
              {/* Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600">{isAr ? 'الساعات' : 'Hours'}</span>
                    <span className={hoursMatch ? 'text-emerald-600' : 'text-red-500'}>{totalChapterHours} / {info.totalHours}</span>
                  </div>
                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${hoursMatch ? 'bg-emerald-500' : totalChapterHours > info.totalHours ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min((totalChapterHours / (info.totalHours || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-gray-600">{isAr ? 'الدرجات' : 'Marks'}</span>
                    <span className={marksMatch ? 'text-emerald-600' : 'text-red-500'}>{totalChapterMarks} / {info.totalMarks}</span>
                  </div>
                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${marksMatch ? 'bg-emerald-500' : totalChapterMarks > info.totalMarks ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min((totalChapterMarks / (info.totalMarks || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-navy text-white">
                    <tr>
                      <th className="p-2.5 border-r border-blue-900/50 w-10">#</th>
                      <th className="p-2.5 border-r border-blue-900/50">{isAr ? 'عنوان الفصل' : 'Chapter Title'}</th>
                      <th className="p-2.5 border-r border-blue-900/50 w-40">{isAr ? 'الأسئلة' : 'Questions'}</th>
                      <th className="p-2.5 border-r border-blue-900/50 w-20">{isAr ? 'ساعات' : 'Hours'}</th>
                      <th className="p-2.5 border-r border-blue-900/50 w-20">{isAr ? 'درجات' : 'Marks'}</th>
                      <th className="p-2.5 border-r border-blue-900/50 w-20">% H</th>
                      <th className="p-2.5 border-r border-blue-900/50 w-20">% M</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {chapters.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-2 text-center font-bold text-gray-500 border-r border-gray-100">{idx + 1}</td>
                        <td className="p-2 border-r border-gray-100"><input type="text" className="w-full p-1 bg-transparent outline-none text-sm" value={c.title} onChange={e => updateC(idx, 'title', e.target.value)} /></td>
                        <td className="p-2 border-r border-gray-100"><input type="text" className="w-full p-1 bg-transparent outline-none text-sm text-center" value={c.questionsCovered} onChange={e => updateC(idx, 'questionsCovered', e.target.value)} /></td>
                        <td className="p-2 border-r border-gray-100"><input type="number" className="w-full p-1 bg-transparent outline-none text-center text-sm" value={c.hours} onChange={e => updateC(idx, 'hours', Number(e.target.value))} /></td>
                        <td className="p-2 border-r border-gray-100"><input type="number" className="w-full p-1 bg-transparent outline-none text-center text-sm" value={c.marks} onChange={e => updateC(idx, 'marks', Number(e.target.value))} /></td>
                        <td className="p-2 text-center text-xs text-gray-500 border-r border-gray-100">{info.totalHours ? ((c.hours / info.totalHours) * 100).toFixed(1) : 0}%</td>
                        <td className="p-2 text-center text-xs text-gray-500 border-r border-gray-100">{info.totalMarks ? ((c.marks / info.totalMarks) * 100).toFixed(1) : 0}%</td>
                        <td className="p-2 text-center"><button onClick={() => removeChapter(c.id)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                    {chapters.length === 0 && (
                      <tr><td colSpan={8} className="p-10 text-center text-gray-400 font-semibold">{isAr ? 'لا توجد فصول' : 'No chapters yet'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={addChapter} className="flex items-center gap-2 text-sm text-navy hover:text-gold font-bold transition-colors"><Plus size={18} /> {isAr ? 'إضافة فصل' : 'Add Chapter'}</button>
            </div>
          )}
        </div>

        {/* ═══ Section: Smart Assistant + Validation + Preview ═══ */}
        <div className="space-y-5">
          {/* Smart Assistant Banner */}
          <div className="bg-gradient-to-r from-navy to-blue-900 rounded-2xl shadow-lg p-6 flex flex-col md:flex-row items-center justify-between text-white gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><Sparkles size={20} className="text-gold" /> {isAr ? 'المساعد الذكي' : 'Smart Assistant'}</h3>
              <p className="text-blue-200 text-sm">{isAr ? 'ربط الأسئلة بالفصول والمهارات تلقائياً عبر Gemini AI' : 'Auto-map questions to chapters & skills via Gemini AI'}</p>
            </div>
            <button onClick={openSmartAudit} className="bg-gold text-navy font-bold px-6 py-2.5 rounded-xl shadow hover:bg-opacity-90 transition flex items-center gap-2">
              <RefreshCw size={18} /> {isAr ? 'توليد ومراجعة' : 'Generate & Audit'}
            </button>
          </div>

          {/* Validation */}
          <div className={`rounded-2xl border p-5 flex items-center gap-4 ${validationReport.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className={`p-2.5 rounded-full ${validationReport.isValid ? 'bg-emerald-100' : 'bg-red-100'}`}>
              {validationReport.isValid ? <Check size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">{isAr ? 'حالة القواعد الأكاديمية' : 'Academic Rules Status'}</h4>
              {validationReport.isValid ? (
                <p className="text-xs">{isAr ? 'مستوفٍ لكافة القواعد ✓' : 'All rules met ✓'}</p>
              ) : (
                <ul className="list-disc list-inside text-xs mt-1">{validationReport.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => window.print()} className="bg-gold text-navy font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-opacity-90 transition flex items-center gap-2 text-base">
              <Printer size={22} /> {isAr ? 'تصدير PDF / طباعة' : 'Export PDF / Print'}
            </button>
          </div>

          {/* Report Preview */}
          <ReportView info={info} questions={questions} chapters={chapters} skills={skills} logos={logos} />
        </div>

      </main>

      {/* ──── Print-only Report ────────────────────────────── */}
      <div className="hidden print:block">
        <ReportView info={info} questions={questions} chapters={chapters} skills={skills} logos={logos} />
      </div>

      {/* ════════════════ MODALS ════════════════════════════ */}

      {/* AI Blueprint Import Modal */}
      {aiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" dir={dir}>
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-navy to-blue-900 text-white shrink-0 rounded-t-2xl">
              <h3 className="font-bold text-base">{isAr ? 'استخراج المصفوفة (Blueprint)' : 'Extract Blueprint'}</h3>
              <button onClick={closeModal} className="hover:text-red-300 transition"><X size={22} /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-16"><Loader2 size={48} className="animate-spin text-gold mb-4" /><p className="font-bold text-navy">{isAr ? 'جاري التحليل عبر Mistral AI OCR...' : 'Analyzing via Mistral AI OCR...'}</p></div>
              ) : aiError ? (
                <div className="flex flex-col items-center justify-center py-16"><AlertTriangle size={48} className="text-red-500 mb-4" /><p className="font-bold text-red-600 mb-2">{isAr ? 'خطأ' : 'Error'}</p><p className="text-gray-600 text-sm max-w-md text-center">{aiError}</p></div>
              ) : aiResult ? (
                <div>
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200 mb-4 text-xs font-bold"><Check size={16} className="inline mr-1" /> {isAr ? 'تم الاستخراج! راجع قبل التطبيق.' : 'Extracted! Review before applying.'}</div>
                  {renderAiPreview()}
                </div>
              ) : null}
            </div>
            <div className="p-4 border-t bg-gray-50 flex flex-col gap-3 shrink-0">
              {conflictMode && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-xs">
                  <h4 className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={14} /> {isAr ? 'تنبيه تعارض' : 'Conflict Warning'}</h4>
                  <ul className="list-disc list-inside space-y-1">{conflictMessages.map((m, i) => <li key={i} className="font-bold">{m}</li>)}</ul>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={handleApplyClick} disabled={aiLoading || !aiResult} className="px-5 py-2 bg-navy text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2 font-bold text-sm">
                  <Check size={16} /> {conflictMode ? (isAr ? 'تأكيد' : 'Confirm') : (isAr ? 'تطبيق' : 'Apply')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Audit Modal */}
      {smartAuditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print-hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[92vh] flex flex-col overflow-hidden" dir={dir}>
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-navy to-blue-900 text-white shrink-0 rounded-t-2xl">
              <h3 className="font-bold text-base flex items-center gap-2"><Sparkles size={18} /> {isAr ? 'مراجعة التقرير الذكي' : 'Smart Blueprint Audit'}</h3>
              <button onClick={() => setSmartAuditModal(false)} className="hover:text-red-300 transition"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col p-2 bg-gray-50">
              {smartAuditLoading ? (
                <div className="flex flex-col items-center justify-center py-20 h-full"><Loader2 size={56} className="animate-spin text-navy mb-6" /><h2 className="text-xl font-bold text-navy mb-2">{isAr ? 'جاري التحليل...' : 'Analyzing...'}</h2><p className="text-gray-500 text-sm">{isAr ? 'Gemini يربط الأسئلة بالفصول والمهارات...' : 'Gemini is mapping questions...'}</p></div>
              ) : smartAuditError ? (
                <div className="flex flex-col items-center justify-center py-20 h-full"><AlertTriangle size={56} className="text-red-500 mb-6" /><h2 className="text-xl font-bold text-red-600 mb-2">{isAr ? 'خطأ' : 'Error'}</h2><p className="text-gray-600 text-sm mb-6 max-w-md text-center">{smartAuditError}</p><button onClick={() => setSmartAuditModal(false)} className="px-6 py-2.5 bg-navy text-white rounded-lg font-bold">{isAr ? 'إغلاق' : 'Close'}</button></div>
              ) : (
                <div className="flex-1 overflow-auto bg-white rounded-lg shadow border">
                  <table className="w-full border-collapse text-sm" dir={dir}>
                    <thead className="bg-navy text-white sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 border-r border-blue-900/50 w-10 text-center">#</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-20 text-center">{isAr ? 'النوع' : 'Type'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 min-w-[200px]">{isAr ? 'الصيغة' : 'Question'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-20 text-center">{isAr ? 'الدرجة' : 'Marks'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-40">{isAr ? 'الفصل' : 'Chapter'}</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-24 bg-blue-900/50">KU</th>
                        <th className="p-2.5 border-r border-blue-900/50 w-24 bg-blue-900/50">IS</th>
                        <th className="p-2.5 w-24 bg-blue-900/50">PS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {smartAuditQuestions.map((sq, idx) => {
                        const cnt = (sq.cloKU?.length || 0) + (sq.cloIS?.length || 0) + (sq.cloPS?.length || 0);
                        const invalid = sq.type === 'MCQ' && cnt !== 1;
                        return (
                          <tr key={sq.id} className={invalid ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50'}>
                            <td className="p-2 border-r text-center font-bold bg-gray-50">{sq.id}</td>
                            <td className="p-2 border-r text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sq.type === 'MCQ' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{sq.type}</span>{invalid && <div className="text-[8px] text-red-600 font-bold mt-0.5">{isAr ? 'خطأ' : 'ERR'}</div>}</td>
                            <td className="p-2 border-r"><div className="max-h-[50px] overflow-y-auto text-xs text-gray-700 font-semibold">{sq.formula || '-'}</div></td>
                            <td className="p-2 border-r text-center"><input type="number" min="0" step="0.5" className="w-14 border rounded p-1 text-center text-xs font-bold text-navy outline-none focus:border-navy" value={sq.marks ?? 1} onChange={e => { const n = [...smartAuditQuestions]; n[idx].marks = Number(e.target.value); setSmartAuditQuestions(n); }} /></td>
                            <td className="p-2 border-r"><select className="w-full border bg-white rounded p-1 text-[10px] font-bold text-navy outline-none" value={sq.predictedChapterId || ''} onChange={e => { const n = [...smartAuditQuestions]; n[idx].predictedChapterId = Number(e.target.value); setSmartAuditQuestions(n); }}><option value="">{isAr ? 'غير محدد' : 'Not Set'}</option>{chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></td>
                            <td className="p-1 border-r bg-gray-50/50"><select multiple className="w-full text-[10px] outline-none border bg-white p-1 rounded min-h-[50px]" value={sq.cloKU || []} onChange={e => { const n = [...smartAuditQuestions]; n[idx].cloKU = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value); setSmartAuditQuestions(n); }}>{skills.filter(s => s.category === 'KU').map(s => <option key={s.id} value={s.code}>{s.code}</option>)}</select></td>
                            <td className="p-1 border-r bg-gray-50/50"><select multiple className="w-full text-[10px] outline-none border bg-white p-1 rounded min-h-[50px]" value={sq.cloIS || []} onChange={e => { const n = [...smartAuditQuestions]; n[idx].cloIS = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value); setSmartAuditQuestions(n); }}>{skills.filter(s => s.category === 'IS').map(s => <option key={s.id} value={s.code}>{s.code}</option>)}</select></td>
                            <td className="p-1 bg-gray-50/50"><select multiple className="w-full text-[10px] outline-none border bg-white p-1 rounded min-h-[50px]" value={sq.cloPS || []} onChange={e => { const n = [...smartAuditQuestions]; n[idx].cloPS = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value); setSmartAuditQuestions(n); }}>{skills.filter(s => s.category === 'PS').map(s => <option key={s.id} value={s.code}>{s.code}</option>)}</select></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!smartAuditLoading && !smartAuditError && (
              <div className="p-4 bg-white border-t flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex gap-4 text-xs font-bold">
                  <span className={smartAuditQuestions.filter(sq => sq.type === 'MCQ').reduce((s, q) => s + (Number(q.marks) || 0), 0) === 35 ? 'text-emerald-600' : 'text-red-500'}>MCQ: {smartAuditQuestions.filter(sq => sq.type === 'MCQ').reduce((s, q) => s + (Number(q.marks) || 0), 0)} / 35</span>
                  <span className={smartAuditQuestions.filter(sq => sq.type === 'Essay').reduce((s, q) => s + (Number(q.marks) || 0), 0) === 15 ? 'text-emerald-600' : 'text-red-500'}>Essay: {smartAuditQuestions.filter(sq => sq.type === 'Essay').reduce((s, q) => s + (Number(q.marks) || 0), 0)} / 15</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSmartAuditModal(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 border rounded-lg font-bold text-sm text-gray-700">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button onClick={applySmartBlueprint} className="px-6 py-2 bg-navy text-white rounded-lg font-bold hover:bg-opacity-90 flex items-center gap-2 shadow text-sm"><Check size={18} /> {isAr ? 'اعتماد' : 'Apply'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
