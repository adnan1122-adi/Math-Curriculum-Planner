
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, BookOpen, FileSpreadsheet, CheckCircle, 
  ChevronRight, ChevronLeft, Download, Plus, Trash2, 
  Loader2, FileText, Layout, Layers, Info, Upload, Save, FolderOpen, Palette, AlertTriangle,
  ListChecks, Table as TableIcon, Settings, Maximize, Minus, Columns
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { 
  AcademicInfo, ScheduleSetup, BlockedDate, BlockedWeek, Lesson, 
  WeekPlan, CurriculumMap, Step 
} from './types';
import { 
  calculateInstructionalStats, generateEmptyWeeks, distributeLessons, getWeekDateRanges 
} from './utils/scheduling';
import { generateCourseMeta, generateLessonDetails } from './geminiService';

const ProgressBar = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { id: 0, label: 'Academic Info', icon: BookOpen },
    { id: 1, label: 'Schedule', icon: Calendar },
    { id: 2, label: 'Blocking', icon: Layout },
    { id: 3, label: 'Lessons', icon: FileSpreadsheet },
    { id: 4, label: 'Generation', icon: Loader2 },
    { id: 5, label: 'Preview', icon: CheckCircle },
  ];

  return (
    <div className="flex items-center justify-between mb-8 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-print">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center min-w-fit mx-2">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
            currentStep >= step.id 
              ? 'bg-indigo-600 border-indigo-600 text-white' 
              : 'border-slate-300 text-slate-400'
          }`}>
            <step.icon size={16} className={currentStep === step.id ? 'animate-pulse' : ''} />
          </div>
          <span className={`ml-2 text-sm font-medium ${currentStep >= step.id ? 'text-indigo-900' : 'text-slate-400'}`}>
            {step.label}
          </span>
          {idx < steps.length - 1 && <ChevronRight className="mx-4 text-slate-300" size={16} />}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState<Step>(Step.ACADEMIC_INFO);
  const [activeTab, setActiveTab] = useState<'roadmap' | 'distribution'>('roadmap');
  const [loading, setLoading] = useState(false);
  const configInputRef = useRef<HTMLInputElement>(null);

  // Styling States - Refined defaults for professional alignment
  const [fontSize, setFontSize] = useState(9);
  const [margins, setMargins] = useState({ top: 15, right: 15, bottom: 15, left: 15 });
  const [showSettings, setShowSettings] = useState(true);

  // Column Width States (A4 Landscape total is ~1122px)
  const [roadmapWidths, setRoadmapWidths] = useState<number[]>([100, 160, 220, 140, 160, 240]);
  const [distributionWidths, setDistributionWidths] = useState<number[]>([280, 750]);

  const [academic, setAcademic] = useState<AcademicInfo>({
    gradeLevel: 'Grade 9',
    subject: 'Mathematics',
    courseName: 'Algebra I',
    term: 'Term 1',
    academicYear: '2024-2025',
    teacherName: '',
    themeColor: '#0f172a'
  });

  const [schedule, setSchedule] = useState<ScheduleSetup>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    totalWeeks: 0,
    totalDays: 0
  });

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedWeeks, setBlockedWeeks] = useState<BlockedWeek[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [curriculumMap, setCurriculumMap] = useState<CurriculumMap | null>(null);

  useEffect(() => {
    const start = parseISO(schedule.startDate);
    const end = parseISO(schedule.endDate);
    if (isValid(start) && isValid(end)) {
      const stats = calculateInstructionalStats(start, end, [], []);
      setSchedule(prev => ({ 
        ...prev, 
        totalWeeks: stats.totalWeeks, 
        totalDays: stats.totalDays 
      }));
    }
  }, [schedule.startDate, schedule.endDate]);

  const actualStats = useMemo(() => {
    const start = parseISO(schedule.startDate);
    const end = parseISO(schedule.endDate);
    if (!isValid(start) || !isValid(end)) return { totalDays: 0, totalWeeks: 0 };
    return calculateInstructionalStats(start, end, blockedDates, blockedWeeks);
  }, [schedule.startDate, schedule.endDate, blockedDates, blockedWeeks]);

  const totalPacing = useMemo(() => {
    return lessons.reduce((sum, l) => sum + (Number(l.pacing) || 0), 0);
  }, [lessons]);

  const availableWeeksWithDates = useMemo(() => {
    const start = parseISO(schedule.startDate);
    const end = parseISO(schedule.endDate);
    if (!isValid(start) || !isValid(end)) return [];
    return getWeekDateRanges(start, end);
  }, [schedule.startDate, schedule.endDate]);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const downloadPDF = () => {
    const elementId = activeTab === 'roadmap' ? 'curriculum-preview' : 'distribution-preview';
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const opt = {
      margin: 0,
      filename: `${academic.courseName.replace(/\s+/g, '_')}_${activeTab === 'roadmap' ? 'Curriculum_Plan' : 'Distribution'}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 3, 
        useCORS: true,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1122.5,
        width: 1122.5,
        x: 0,
        y: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], after: 'section' }
    };

    // @ts-ignore
    window.html2pdf().set(opt).from(element).save();
  };

  const saveConfig = () => {
    const config = { blockedDates, blockedWeeks };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Curriculum_Config_${academic.courseName || 'Untitled'}.json`;
    a.click();
  };

  const loadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        if (config.blockedDates) setBlockedDates(config.blockedDates);
        if (config.blockedWeeks) setBlockedWeeks(config.blockedWeeks);
        alert("Configuration loaded successfully!");
      } catch (err) {
        alert("Invalid configuration file.");
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = "Lesson Name,CCSS Standard,Pacing (Number of Days)\nLinear Equations,CCSS.MATH.CONTENT.HSA.REI.B.3,2\nSolving Inequalities,CCSS.MATH.CONTENT.HSA.REI.B.3,3";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'math_lesson_template.csv';
    a.click();
  };

  const exportToWord = () => {
    const elementId = activeTab === 'roadmap' ? 'curriculum-preview' : 'distribution-preview';
    const content = document.getElementById(elementId)?.innerHTML;
    if (!content) return;

    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Curriculum Export</title>
        <style>
          @page WordSection1 {
            size: 841.9pt 595.3pt;
            mso-page-orientation: landscape;
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          div.WordSection1 { page: WordSection1; }
          table { border-collapse: collapse; width: 100%; border: 1px solid black; }
          td, th { border: 1px solid black; padding: 4pt; font-family: 'Segoe UI', sans-serif; font-size: ${fontSize}pt; vertical-align: top; }
          .page-break { page-break-before: always; }
          h1, h2, h3, h4, p { font-family: 'Segoe UI', sans-serif; }
        </style>
      </head>
      <body>
        <div class="WordSection1">${content}</div>
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${academic.courseName.replace(/\s+/g, '_')}_${activeTab === 'roadmap' ? 'Curriculum_Plan' : 'Distribution'}.doc`;
    link.click();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAcademic(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(1);
      const newLessons: Lesson[] = lines.filter(l => l.trim()).map((line, i) => {
        const [name, ccss, pacing] = line.split(',');
        return {
          id: `lesson-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          name: name?.trim() || 'Untitled Lesson',
          ccss: ccss?.trim() || 'No CCSS',
          pacing: Math.max(1, parseInt(pacing?.trim() || '1'))
        };
      });
      setLessons(prev => [...prev, ...newLessons]);
    };
    reader.readAsText(file);
  };

  const updateLesson = (id: string, field: keyof Lesson, value: any) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const runAIGeneration = async () => {
    setLoading(true);
    setStep(Step.GENERATION);
    try {
      const meta = await generateCourseMeta(academic);
      const detailsResponse = await generateLessonDetails(academic, lessons);
      const detailsList = detailsResponse.results || [];
      
      const emptyWeeks = generateEmptyWeeks(
        parseISO(schedule.startDate), 
        parseISO(schedule.endDate), 
        blockedDates, 
        blockedWeeks
      );
      
      const filledWeeks = distributeLessons(emptyWeeks, lessons);

      const mappedDetails: Record<string, any> = {};
      lessons.forEach(l => {
        const detail = detailsList.find((d: any) => d.lessonId === l.id) || {
          expectations: 'Instructional expectations pending...',
          skills: 'Critical skills pending...',
          questions: 'Inquiry questions pending...',
          strategies: 'Teaching strategies pending...',
          activities: 'Student activities pending...'
        };
        mappedDetails[l.id] = {
          ...l,
          ...detail,
          assignedDays: filledWeeks.flatMap(w => w.days.filter(d => d.lessonId === l.id).map(d => d.date))
        };
      });

      setCurriculumMap({
        weeks: filledWeeks,
        lessonDetails: mappedDetails,
        courseDescription: meta.description,
        learningObjectives: meta.objectives,
        prerequisites: meta.prerequisites,
        courseCredit: meta.credits
      });
      setStep(Step.PREVIEW);
    } catch (err) {
      console.error(err);
      alert("AI generation encountered an error. Please try again.");
      setStep(Step.LESSONS);
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`,
    fontSize: `${fontSize}pt`
  };

  const roadmapColumnLabels = ["Week/Day", "Lesson (CCSS)", "Expectations", "Skills", "Questions", "Strategies"];
  const distributionColumnLabels = ["Week Ref", "Content"];

  const updateRoadmapWidth = (idx: number, val: number) => {
    const newWidths = [...roadmapWidths];
    newWidths[idx] = val;
    setRoadmapWidths(newWidths);
  };

  const updateDistributionWidth = (idx: number, val: number) => {
    const newWidths = [...distributionWidths];
    newWidths[idx] = val;
    setDistributionWidths(newWidths);
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-slate-200 py-6 px-4 no-print sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-lg shadow-indigo-200 shadow-lg">
              <Layout className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Math Curriculum Planner</h1>
              <p className="text-sm text-slate-500 font-medium">CCSS-Aligned Instructional Architect</p>
            </div>
          </div>
          {step === Step.PREVIEW && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm border ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Settings size={16} /> PDF Settings
              </button>
              <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-medium text-sm shadow-sm">
                <Download size={16} /> Download PDF
              </button>
              <button onClick={exportToWord} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-sm shadow-md shadow-indigo-200">
                <FileText size={16} /> Export Word
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-4">
        {step !== Step.PREVIEW && <ProgressBar currentStep={step} />}

        {step === Step.ACADEMIC_INFO && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-4 text-center">Academic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">School Branding</label>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border">
                    <Palette size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-600">Theme Color</span>
                    <input 
                      type="color" 
                      value={academic.themeColor} 
                      onChange={e => setAcademic({...academic, themeColor: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent" 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                  {academic.logo && <img src={academic.logo} alt="Logo" className="w-16 h-16 object-contain border rounded p-1 bg-slate-50" />}
                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-sm font-medium text-slate-700 border border-slate-300">
                    <Upload size={16} /> {academic.logo ? 'Change Logo' : 'Upload Logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {academic.logo && (
                    <button onClick={() => setAcademic(p => ({...p, logo: undefined}))} className="text-red-500 text-sm hover:underline font-medium">Remove</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teacher Name</label>
                <input type="text" placeholder="Full Name" value={academic.teacherName} onChange={e => setAcademic({...academic, teacherName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grade Level</label>
                <input type="text" value={academic.gradeLevel} onChange={e => setAcademic({...academic, gradeLevel: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Course Name</label>
                <input type="text" value={academic.courseName} onChange={e => setAcademic({...academic, courseName: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Term</label>
                <input type="text" value={academic.term} onChange={e => setAcademic({...academic, term: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Academic Year</label>
                <input type="text" value={academic.academicYear} onChange={e => setAcademic({...academic, academicYear: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <button onClick={handleNext} className="mt-10 w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2">
              Continue to Schedule <ChevronRight size={20} />
            </button>
          </div>
        )}

        {step === Step.SCHEDULE && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-4 text-center flex items-center justify-center gap-2">
              <Calendar className="text-indigo-600" /> Term Schedule
            </h2>
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-6 flex items-start gap-2">
                <Info size={18} className="shrink-0 mt-0.5 text-indigo-600" />
                <p className="text-sm text-indigo-700"><strong>Instructional Window:</strong> Sundays to Thursdays. Fridays and Saturdays are non-instructional.</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Date</label>
                  <input type="date" value={schedule.startDate} onChange={e => setSchedule({...schedule, startDate: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Date</label>
                  <input type="date" value={schedule.endDate} onChange={e => setSchedule({...schedule, endDate: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-3xl font-bold text-indigo-600">{schedule.totalWeeks}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase mt-1 tracking-wider">Potential Weeks</div>
                </div>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-3xl font-bold text-indigo-600">{schedule.totalDays}</div>
                  <div className="text-xs font-bold text-slate-500 uppercase mt-1 tracking-wider">Potential Days</div>
                </div>
              </div>
            </div>
            <div className="mt-10 flex gap-4">
              <button onClick={handleBack} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold">Back</button>
              <button onClick={handleNext} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
                Continue to Blocking <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === Step.BLOCKING && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-4xl mx-auto space-y-10">
             <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-2xl border border-slate-200 gap-4 mb-6">
                <div className="flex flex-col">
                  <h3 className="font-bold text-slate-900 text-lg">Configuration Persistence</h3>
                  <p className="text-xs text-slate-500">Save your holiday/exam schedule to re-use later.</p>
                </div>
                <div className="flex gap-3">
                   <button onClick={saveConfig} className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
                      <Save size={16} /> Save Config
                   </button>
                   <label className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-50 cursor-pointer transition-colors">
                      <FolderOpen size={16} /> Load Config
                      <input type="file" accept=".json" onChange={loadConfig} className="hidden" ref={configInputRef} />
                   </label>
                </div>
             </div>

             <div>
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="text-indigo-600" /> Block Entire Weeks
                </h2>
                <button onClick={() => setBlockedWeeks([...blockedWeeks, { weekNumber: 1, label: 'Revision Week', type: 'Revision', excludeFromCount: true }])} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-100 text-sm">
                  <Plus size={16} /> Block a Week
                </button>
              </div>
              <div className="space-y-4">
                {blockedWeeks.map((block, i) => (
                    <div key={i} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 group hover:border-indigo-200 transition-colors">
                      <div className="flex-shrink-0 w-full md:w-56">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Week Selection</label>
                        <select 
                          value={block.weekNumber}
                          onChange={e => {
                            const newBlocks = [...blockedWeeks];
                            newBlocks[i].weekNumber = parseInt(e.target.value);
                            setBlockedWeeks(newBlocks);
                          }}
                          className="w-full px-3 py-2 rounded border border-slate-300 text-sm font-bold bg-white"
                        >
                          {availableWeeksWithDates.map(w => (
                            <option key={w.weekNumber} value={w.weekNumber}>Week {w.weekNumber} ({w.range})</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 w-full">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Display Label</label>
                        <input type="text" value={block.label} onChange={e => {
                          const newBlocks = [...blockedWeeks];
                          newBlocks[i].label = e.target.value;
                          setBlockedWeeks(newBlocks);
                        }} className="w-full px-3 py-2 rounded border border-slate-300 text-sm bg-white" placeholder="e.g. Midterm Break" />
                      </div>
                      <div className="flex flex-col items-center gap-1.5 px-4">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Exclude from #?</label>
                        <input type="checkbox" checked={block.excludeFromCount} onChange={e => {
                          const newBlocks = [...blockedWeeks];
                          newBlocks[i].excludeFromCount = e.target.checked;
                          setBlockedWeeks(newBlocks);
                        }} className="w-5 h-5 text-indigo-600 border-slate-300 rounded cursor-pointer" />
                      </div>
                      <button onClick={() => setBlockedWeeks(blockedWeeks.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Layout className="text-indigo-600" /> Block Specific Days
                </h2>
                <button onClick={() => setBlockedDates([...blockedDates, { date: format(new Date(), 'yyyy-MM-dd'), label: 'Holiday', type: 'Holiday' }])} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-100 text-sm">
                  <Plus size={16} /> Block a Day
                </button>
              </div>
              <div className="space-y-4">
                {blockedDates.map((block, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 group hover:border-indigo-200 transition-colors">
                      <input type="date" value={block.date} onChange={e => {
                        const newBlocks = [...blockedDates];
                        newBlocks[i].date = e.target.value;
                        setBlockedDates(newBlocks);
                      }} className="px-3 py-2 rounded border border-slate-300 text-sm bg-white" />
                      <input type="text" value={block.label} onChange={e => {
                        const newBlocks = [...blockedDates];
                        newBlocks[i].label = e.target.value;
                        setBlockedDates(newBlocks);
                      }} className="flex-1 px-3 py-2 rounded border border-slate-300 text-sm bg-white focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Sports Day" />
                      <button onClick={() => setBlockedDates(blockedDates.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={handleBack} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold">Back</button>
              <button onClick={handleNext} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg">
                Continue to Lessons <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === Step.LESSONS && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="text-indigo-600" /> Lesson Management
              </h2>
              <div className="flex gap-3">
                <button onClick={downloadTemplate} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center gap-2 text-sm">
                  <Download size={16} /> Template
                </button>
                <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 text-sm cursor-pointer shadow-md">
                  <Plus size={16} /> Upload CSV
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className={`p-5 rounded-xl border flex flex-col items-center justify-center transition-all ${totalPacing > actualStats.totalDays ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Planned Pacing</div>
                <div className={`text-3xl font-black ${totalPacing > actualStats.totalDays ? 'text-red-600' : 'text-green-600'}`}>
                  {totalPacing} Days
                </div>
              </div>
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Available Instructional Time</div>
                <div className="text-3xl font-black text-slate-900">{actualStats.totalDays} Days</div>
                <div className="text-[10px] font-bold text-slate-400 mt-1">({actualStats.totalWeeks} Active Weeks)</div>
              </div>
              <div className="p-5 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Planning Status</div>
                {totalPacing > actualStats.totalDays ? (
                  <div className="flex items-center gap-1.5 text-red-600 font-bold text-sm">
                    <AlertTriangle size={18} /> Over Capacity
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                    <CheckCircle size={18} /> Perfectly Scheduled
                  </div>
                )}
                <div className="text-[11px] font-semibold text-slate-500 mt-1">
                  {totalPacing > actualStats.totalDays 
                    ? `Overflow: ${totalPacing - actualStats.totalDays} days` 
                    : `Remaining: ${actualStats.totalDays - totalPacing} days`
                  }
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto mb-8 pr-2">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 border-b-2 border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lesson Name</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">CCSS Standard</th>
                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-24 text-center">Pacing</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lessons.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-24 text-center text-slate-400">
                        <FileSpreadsheet className="mx-auto mb-4 opacity-10" size={80} />
                        <p className="font-medium italic">Your lesson roadmap will appear here after CSV upload.</p>
                      </td>
                    </tr>
                  ) : (
                    lessons.map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2 px-2">
                          <input 
                            type="text" 
                            className="table-input font-bold text-slate-800 focus:bg-white" 
                            value={lesson.name} 
                            onChange={(e) => updateLesson(lesson.id, 'name', e.target.value)} 
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input 
                            type="text" 
                            className="table-input text-xs font-mono text-slate-500 focus:bg-white" 
                            value={lesson.ccss} 
                            onChange={(e) => updateLesson(lesson.id, 'ccss', e.target.value)} 
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input 
                              type="number" 
                              min="1" 
                              className="w-14 text-center px-1 py-1.5 rounded-lg border border-slate-200 text-sm font-black text-indigo-600"
                              value={lesson.pacing}
                              onChange={(e) => updateLesson(lesson.id, 'pacing', parseInt(e.target.value) || 1)}
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase">Days</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button onClick={() => setLessons(lessons.filter(l => l.id !== lesson.id))} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4">
              <button onClick={handleBack} className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold">Back</button>
              <button onClick={runAIGeneration} disabled={lessons.length === 0 || loading} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : <Layout size={20} />}
                Generate Full Curriculum Map
              </button>
            </div>
          </div>
        )}

        {step === Step.GENERATION && (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl mx-auto">
            <Loader2 className="animate-spin text-indigo-600 mb-8" size={72} />
            <h2 className="text-2xl font-black text-slate-900">Synthesizing Instructional Data...</h2>
            <p className="mt-3 text-slate-400 text-center px-12 italic leading-relaxed">Gemini is aligning your math lessons with CCSS standards and generating instructional activities.</p>
          </div>
        )}

        {step === Step.PREVIEW && curriculumMap && (
          <div className="flex flex-col items-center mb-20 no-print">
            
            {/* PDF Style Settings Panel */}
            {showSettings && (
              <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-xl mb-8 overflow-hidden transition-all">
                <div className="bg-slate-50 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-widest text-xs">
                    <Settings size={14} className="text-indigo-600" /> PDF Document Customizer
                  </div>
                  <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                    <Minus size={18} />
                  </button>
                </div>
                <div className="p-8 space-y-12">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                           <Maximize size={12}/> Font Scale
                         </h4>
                         <div className="flex items-center gap-6">
                           <input 
                             type="range" min="6" max="18" step="0.5" 
                             value={fontSize} 
                             onChange={(e) => setFontSize(parseFloat(e.target.value))} 
                             className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                           />
                           <span className="font-black text-indigo-600 min-w-[50px] text-lg">{fontSize}pt</span>
                         </div>
                      </div>
                      <div>
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Margins (mm)</h4>
                         <div className="grid grid-cols-4 gap-3">
                            {['top', 'bottom', 'left', 'right'].map((m) => (
                              <div key={m}>
                                 <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-tighter">{m}</label>
                                 <input type="number" value={margins[m as keyof typeof margins]} onChange={e => setMargins({...margins, [m]: parseInt(e.target.value) || 0})} className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-bold" />
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-t pt-8">
                        <Columns size={12}/> Column Width Adjustments (px)
                      </h4>
                      <div className="flex flex-wrap gap-6">
                        {(activeTab === 'roadmap' ? roadmapWidths : distributionWidths).map((w, idx) => (
                          <div key={idx} className="flex-1 min-w-[120px]">
                            <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase truncate">
                              {activeTab === 'roadmap' ? roadmapColumnLabels[idx] : distributionColumnLabels[idx]}
                            </label>
                            <div className="flex items-center gap-2">
                               <input 
                                 type="range" min="40" max="600" step="5" 
                                 value={w} 
                                 onChange={(e) => activeTab === 'roadmap' ? updateRoadmapWidth(idx, parseInt(e.target.value)) : updateDistributionWidth(idx, parseInt(e.target.value))}
                                 className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                               />
                               <span className="text-[10px] font-black text-slate-600">{w}px</span>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
            )}

            <div className="flex bg-slate-100 p-1 rounded-xl mb-8 border border-slate-200 w-full max-w-md shadow-inner">
               <button 
                onClick={() => setActiveTab('roadmap')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === 'roadmap' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 <TableIcon size={18} /> Roadmap
               </button>
               <button 
                onClick={() => setActiveTab('distribution')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${activeTab === 'distribution' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
               >
                 <ListChecks size={18} /> Distribution
               </button>
            </div>

            <div className="p-10 bg-slate-100 rounded-lg overflow-auto max-w-full flex justify-center border-2 border-dashed border-slate-200">
              {activeTab === 'roadmap' ? (
                <div id="curriculum-preview" className="shadow-2xl bg-white">
                  <section className="page-break page-container" style={containerStyle}>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      {academic.logo && (
                        <div className="mb-8 max-w-[200px]">
                          <img src={academic.logo} alt="Logo" className="max-h-32 object-contain mx-auto" />
                        </div>
                      )}
                      <BookOpen size={60} style={{ color: academic.themeColor, marginBottom: '20px' }} />
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-2" style={{ color: academic.themeColor }}>Instructional Framework</h3>
                      <h1 className="text-5xl font-black text-slate-900 mb-6 leading-tight">{academic.courseName}</h1>
                      <div className="w-24 h-1.5 rounded-full mb-8 mx-auto" style={{ backgroundColor: academic.themeColor }} />
                      <div className="text-lg text-slate-600 font-medium space-y-2 text-center">
                        <p className="text-xl font-bold text-slate-900">Lead Instructor: {academic.teacherName || '________________'}</p>
                        <p>{academic.gradeLevel} &bull; {academic.subject}</p>
                        <p>{academic.term} &bull; {academic.academicYear}</p>
                      </div>
                    </div>
                  </section>

                  <section className="page-break page-container" style={containerStyle}>
                    <h2 className="text-3xl font-black text-slate-900 mb-8 border-b-2 pb-4 flex items-center gap-4">
                      <FileText size={28} style={{ color: academic.themeColor }} /> Course Architecture
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 flex-1">
                      <div className="md:col-span-2 space-y-8">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: academic.themeColor }}>Description</h4>
                          <p className="text-slate-700 leading-relaxed text-sm">{curriculumMap.courseDescription}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: academic.themeColor }}>Learning Objectives</h4>
                          <ul className="grid grid-cols-1 gap-2">
                            {curriculumMap.learningObjectives.split('\n').filter(o => o.trim()).map((obj, i) => (
                              <li key={i} className="flex gap-3 items-start text-slate-700 text-xs leading-snug">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: academic.themeColor }} />
                                <span>{obj.replace(/^[*-]\s*/, '')}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                        <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pacing Window</label>
                          <p className="font-black text-slate-900 text-sm">{actualStats.totalWeeks} Active Weeks</p>
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Credit Model</label>
                          <p className="font-black text-slate-900 text-sm">{curriculumMap.courseCredit}</p>
                        </div>
                        <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prerequisites</label>
                          <p className="font-black text-slate-900 text-sm">{curriculumMap.prerequisites}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="page-break page-container" style={containerStyle}>
                    <div className="mb-4 flex items-center justify-between border-b-2 pb-2" style={{ borderColor: academic.themeColor }}>
                       <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Weekly Instructional Roadmap</h2>
                    </div>
                    <div className="w-full flex-1">
                      <table className="w-full text-left border-collapse pdf-roadmap-table" style={{ fontSize: `${fontSize}pt` }}>
                        <thead className="text-white uppercase font-black tracking-widest" style={{ backgroundColor: academic.themeColor, fontSize: `${fontSize * 0.8}pt` }}>
                          <tr>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[0]}px` }}>Week / Day</th>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[1]}px` }}>Lesson (CCSS)</th>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[2]}px` }}>Expectations</th>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[3]}px` }}>Skills</th>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[4]}px` }}>Questions</th>
                            <th className="py-2 px-2" style={{ width: `${roadmapWidths[5]}px` }}>Strategies</th>
                          </tr>
                        </thead>
                        <tbody style={{ fontSize: `${fontSize * 0.85}pt` }}>
                          {curriculumMap.weeks.map((week, wIdx) => (
                            <React.Fragment key={wIdx}>
                              {week.days.map((day, dIdx) => {
                                const lesson = day.lessonId ? curriculumMap.lessonDetails[day.lessonId] : null;
                                return (
                                  <tr key={`${wIdx}-${dIdx}`} className={`align-top ${day.isBlocked ? 'bg-red-50/20' : 'bg-white'}`}>
                                    <td className="py-2 px-2 bg-slate-50/50">
                                      {dIdx === 0 && (
                                        <div className="mb-1">
                                          <div className="font-black text-slate-900" style={{ fontSize: `${fontSize * 0.9}pt` }}>{week.displayWeekLabel}</div>
                                          <div className="text-slate-500 font-bold uppercase" style={{ fontSize: `${fontSize * 0.7}pt` }}>{week.dates}</div>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <span className="font-black text-slate-800 uppercase" style={{ fontSize: `${fontSize * 0.75}pt` }}>{day.dayName.substring(0, 3)}</span>
                                        {day.isBlocked && <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-black uppercase truncate" style={{ fontSize: `${fontSize * 0.6}pt` }}>{day.blockLabel}</span>}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2">
                                      {lesson ? (
                                        <>
                                          <div className="font-black leading-tight" style={{ color: academic.themeColor }}>{lesson.name}</div>
                                          <div className="text-slate-400 font-mono mt-0.5 leading-tight" style={{ fontSize: `${fontSize * 0.7}pt` }}>{lesson.ccss}</div>
                                        </>
                                      ) : !day.isBlocked && <div className="text-slate-300 italic">Unassigned</div>}
                                    </td>
                                    <td className="py-2 px-2 text-slate-700 leading-snug">{lesson?.expectations}</td>
                                    <td className="py-2 px-2 text-slate-700 leading-snug italic">{lesson?.skills}</td>
                                    <td className="py-2 px-2 font-bold italic leading-snug" style={{ color: academic.themeColor }}>{lesson ? `"${lesson.questions}"` : ''}</td>
                                    <td className="py-2 px-2 text-slate-600 leading-snug">{lesson?.strategies}</td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              ) : (
                <div id="distribution-preview" className="shadow-2xl bg-white">
                  <section className="page-break page-container" style={containerStyle}>
                    <div className="mb-8 flex flex-col md:flex-row justify-between items-start border-b-4 pb-6 gap-6" style={{ borderColor: academic.themeColor }}>
                      <div className="space-y-4">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Curriculum Distribution</h2>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-xl">
                          <p><span className="text-slate-400 uppercase text-[8px] block font-black">Subject:</span> {academic.subject}</p>
                          <p><span className="text-slate-400 uppercase text-[8px] block font-black">Grade:</span> {academic.gradeLevel}</p>
                          <p><span className="text-slate-400 uppercase text-[8px] block font-black">Year:</span> {academic.academicYear}</p>
                          <p><span className="text-slate-400 uppercase text-[8px] block font-black">Term:</span> {academic.term}</p>
                        </div>
                      </div>
                      {academic.logo && (
                        <img src={academic.logo} alt="Logo" className="max-h-20 object-contain" />
                      )}
                    </div>

                    <div className="w-full flex-1">
                      <table className="w-full text-left border-collapse pdf-roadmap-table rounded-lg overflow-hidden border-2" style={{ borderColor: academic.themeColor, fontSize: `${fontSize}pt` }}>
                        <thead className="text-white uppercase font-black tracking-widest" style={{ backgroundColor: academic.themeColor, fontSize: `${fontSize * 0.9}pt` }}>
                          <tr>
                            <th className="py-4 px-6 border-r border-white/20" style={{ width: `${distributionWidths[0]}px` }}>Week Ref & Timeline</th>
                            <th className="py-4 px-6">Assigned Unit Content</th>
                          </tr>
                        </thead>
                        <tbody style={{ fontSize: `${fontSize * 1.05}pt` }}>
                          {curriculumMap.weeks.map((week, wIdx) => {
                             const weekLessons = Array.from(new Set(week.days.map(d => d.lessonName).filter(Boolean)));
                             const weekBlocks = Array.from(new Set(week.days.filter(d => d.isBlocked).map(d => `${d.dayName}: ${d.blockLabel}`)));
                             
                             return (
                               <tr key={wIdx} className={`align-top border-b border-slate-100 ${week.isBlocked ? 'bg-slate-50' : 'bg-white'}`}>
                                 <td className="py-6 px-6 bg-slate-50/30 border-r border-slate-100">
                                   <div className="flex items-center gap-2 mb-1">
                                      <div className="w-1.5 h-4 rounded-full" style={{ backgroundColor: week.isBlocked ? '#ef4444' : academic.themeColor }} />
                                      <div className="font-black text-slate-900">{week.displayWeekLabel}</div>
                                   </div>
                                   <div className="font-bold text-slate-500 uppercase tracking-tight pl-3" style={{ fontSize: `${fontSize * 0.75}pt` }}>{week.dates}</div>
                                   
                                   {weekBlocks.length > 0 && !week.isBlocked && (
                                     <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-100">
                                        {weekBlocks.map((b, bi) => (
                                          <div key={bi} className="text-[9px] font-bold text-red-600 leading-tight">&bull; {b}</div>
                                        ))}
                                     </div>
                                   )}
                                 </td>
                                 <td className="py-6 px-6">
                                   {week.isBlocked ? (
                                      <p className="font-black text-red-700 uppercase tracking-tight text-sm">
                                        {week.blockLabel || 'School Break'}
                                      </p>
                                   ) : weekLessons.length > 0 ? (
                                     <div className="space-y-3">
                                       {weekLessons.map((name, lIdx) => (
                                         <div key={lIdx} className="flex gap-3 items-center">
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white font-black text-[10px]" style={{ backgroundColor: academic.themeColor }}>
                                              {lIdx + 1}
                                            </div>
                                            <span className="font-black text-slate-900 leading-tight">{name}</span>
                                         </div>
                                       ))}
                                     </div>
                                   ) : (
                                     <p className="text-slate-300 italic text-sm">No units assigned</p>
                                   )}
                                 </td>
                               </tr>
                             )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-end opacity-60">
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-8">Faculty Signature</p>
                          <div className="border-b border-slate-300 w-48" />
                       </div>
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-8">Admin Verification</p>
                          <div className="border-b border-slate-300 w-48" />
                       </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {step === Step.PREVIEW && (
        <div className="fixed bottom-8 right-8 flex flex-col gap-4 no-print z-50">
          <button onClick={() => setStep(Step.LESSONS)} className="p-5 bg-white text-slate-900 rounded-full shadow-2xl border border-slate-200 hover:scale-110 transition-transform flex items-center justify-center" title="Modify Lessons">
            <Plus size={28} className="rotate-45" />
          </button>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="p-5 bg-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center" title="Go to Top">
            <ChevronRight className="-rotate-90" size={28} />
          </button>
        </div>
      )}
    </div>
  );
}
