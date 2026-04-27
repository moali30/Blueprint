import React from 'react';
import { Upload, BookOpen, Target, HelpCircle, BarChart3, FileText, Check } from 'lucide-react';

interface StepperNavProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  isAr: boolean;
}

const STEPS = [
  { labelAr: 'الاستيراد', labelEn: 'Import', Icon: Upload },
  { labelAr: 'المقرر', labelEn: 'Course', Icon: BookOpen },
  { labelAr: 'المهارات', labelEn: 'Skills', Icon: Target },
  { labelAr: 'الأسئلة', labelEn: 'Questions', Icon: HelpCircle },
  { labelAr: 'التوزيع', labelEn: 'Distribution', Icon: BarChart3 },
  { labelAr: 'التقرير', labelEn: 'Report', Icon: FileText },
];

export default function StepperNav({ currentStep, onStepClick, isAr }: StepperNavProps) {
  return (
    <div className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-sm print-hidden sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isPending = idx > currentStep;
            const { Icon } = step;

            return (
              <React.Fragment key={idx}>
                <button
                  onClick={() => onStepClick(idx)}
                  className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
                  title={isAr ? step.labelAr : step.labelEn}
                >
                  <div
                    className={`
                      w-11 h-11 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isCurrent
                        ? 'bg-gradient-to-br from-gold to-yellow-600 text-navy shadow-lg shadow-gold/30 scale-110 step-active-pulse'
                        : ''}
                      ${isCompleted
                        ? 'bg-emerald-500 text-white shadow-md group-hover:scale-105'
                        : ''}
                      ${isPending
                        ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 group-hover:border-gray-400 group-hover:text-gray-500'
                        : ''}
                    `}
                  >
                    {isCompleted ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                  </div>
                  <span
                    className={`text-[11px] font-bold whitespace-nowrap hidden md:block transition-colors
                      ${isCurrent ? 'text-navy' : ''}
                      ${isCompleted ? 'text-emerald-600' : ''}
                      ${isPending ? 'text-gray-400' : ''}
                    `}
                  >
                    {isAr ? step.labelAr : step.labelEn}
                  </span>
                </button>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 md:mx-3 rounded-full transition-all duration-500
                      ${idx < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}
                    `}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
