import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, Loader2, FileText, Download, User, Briefcase, MessageSquare, Upload, ArrowRight, Sparkles, Check, Monitor, Edit3, ArrowLeft, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseCVWithGemini } from '../utils/cvParser';
import { generateTailoredCV } from '../utils/cvService';
import ResumeView from './ResumeView';
import { NeuButton, NeuCard, NeuInput, NeuTextarea, NeuBadge } from './NeuComponents';
import { Icons } from './Icons';
import { DataService, AuthService } from '../services/supabase';
import { CVData } from '../types';

interface CVBuilderProps {
  ai: GoogleGenAI;
  updateCost: (usageMetadata: any, model: string) => Promise<void>;
  student?: any;
  job?: any;
  initialStep?: 'upload' | 'job' | 'generating' | 'view' | 'library';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export default function CVBuilder({ ai, updateCost, student, job, initialStep }: CVBuilderProps) {
  const [cvContent, setCvContent] = useState<any>(null); // Integrated CV Data object
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState<'upload' | 'job' | 'generating' | 'view' | 'library'>(initialStep || 'upload');
  const [savedCVs, setSavedCVs] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedStudentData, setParsedStudentData] = useState<any>(null);

  const [inputMethod, setInputMethod] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchSaved = async () => {
      const user = await AuthService.getCurrentUser();
      if (user) {
        setIsLoadingSaved(true);
        try {
          const cvs = await DataService.getUserCVs(user.id);
          setSavedCVs(cvs || []);
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingSaved(false);
        }
      }
    };
    fetchSaved();
  }, []);
  
  const [targetJob, setTargetJob] = useState({
    title: job?.title || '',
    company: job?.company || '',
    description: job?.description || ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setIsGenerating(true);
    try {
      const data = await parseCVWithGemini(file, ai, updateCost);
      setParsedStudentData(data);
      setStep('job');
    } catch (error) {
      console.error("Failed to parse CV:", error);
      alert("Format error. Please use PDF, DOCX or TXT.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    setIsGenerating(true);
    try {
      // Create a dummy file-like object or directly pass text if your parser supports it
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [`Extract professional profile from this text into a JSON object: ${pastedText}`],
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              summary: { type: "string" },
              skills: { type: "array", items: { type: "string" } },
              experience: { type: "array", items: { type: "object", properties: { role: { type: "string" }, company: { type: "string" }, description: { type: "array", items: { type: "string" } } } } }
            }
          }
        }
      });
      const data = JSON.parse(response.text || '{}');
      setParsedStudentData({ ...data, full_cv_text: pastedText });
      setStep('job');
    } catch (e) {
      console.error(e);
      alert("Parsing failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateInitialCV = async () => {
    const user = await AuthService.getCurrentUser();
    if (user) {
      const canGenerate = await DataService.canGenerateCV(user.id);
      if (!canGenerate) {
        alert("You have reached your CV generation limit for this month. Please try again next month.");
        return;
      }
    }

    setIsGenerating(true);
    setStep('generating');
    try {
      const result = await generateTailoredCV(
        ai,
        parsedStudentData || student || {},
        targetJob,
        updateCost
      );
      setCvContent(result);
      
      // Auto-save logic
      if (user) {
        await DataService.saveCV(result, user.id);
        await DataService.logCVGeneration(user.id);
      }
      
      setStep('view');
    } catch (error) {
      console.error("Failed to generate CV:", error);
      alert("Generation failed. Please try again.");
      setStep('job');
    } finally {
      setIsGenerating(false);
    }
  };

  if (step === 'library') {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 space-y-12">
        <header className="text-center space-y-4">
          <h2 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Your Library</h2>
          <p className="font-bold text-[#FF6321] uppercase tracking-widest text-xs italic">Architectures engineered for your success</p>
        </header>

        {isLoadingSaved ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <Loader2 className="w-12 h-12 text-[#FF6321] animate-spin" />
            <p className="font-black uppercase italic tracking-tighter text-xl">Loading library...</p>
          </div>
        ) : savedCVs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {savedCVs.map(cv => (
              <motion.div 
                key={cv.id}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => {
                  setCvContent(cv.data);
                  setStep('view');
                }}
                className="bg-white border-4 border-slate-900 rounded-[32px] p-8 cursor-pointer hover:shadow-[12px_12px_0px_0px_rgba(255,99,33,1)] transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full -mr-8 -mt-8 -z-10 group-hover:bg-[#FF6321]/10 transition-colors" />
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <NeuBadge variant="neutral">{new Date(cv.updatedAt).toLocaleDateString()}</NeuBadge>
                </div>
                <h4 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-tight mb-2">
                  {cv.data.jobTitle || "Untitled Architecture"}
                </h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate mb-6">
                  {cv.data.company || "General Tailoring"}
                </p>
                <div className="flex items-center gap-2 text-[#FF6321] font-black uppercase italic text-[10px] tracking-widest group-hover:translate-x-2 transition-transform">
                  Access Architecture <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[48px] space-y-6">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Briefcase className="w-10 h-10" />
             </div>
             <div className="space-y-2">
               <p className="text-xl font-black uppercase italic tracking-tighter text-slate-400">Library Empty</p>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No architectures have been engineered yet.</p>
             </div>
             <button onClick={() => setStep('upload')} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-xs tracking-widest shadow-xl hover:scale-105 transition-transform">
               Start First Engineering
             </button>
          </div>
        )}
        
        <div className="flex justify-center pt-8">
           <button onClick={() => setStep('upload')} className="flex items-center gap-3 text-slate-500 hover:text-slate-900 font-black uppercase tracking-widest text-[10px] transition-colors">
              <Icons.Plus className="w-4 h-4" /> New Engineering Session
           </button>
        </div>
      </div>
    );
  }

  if (step === 'view' && cvContent) {
    return (
      <ResumeView 
        ai={ai}
        cvData={cvContent}
        studentName={parsedStudentData?.name || student?.name || 'Candidate'}
        skills={cvContent.tailoredSkills}
        jobDescription={targetJob.description}
        onClose={() => setStep('upload')}
        onSave={async (updatedData) => {
          const user = await AuthService.getCurrentUser();
          if (user) {
            await DataService.saveCV(updatedData, user.id);
          }
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-12">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900">Start with your CV</h2>
              <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Upload a file or paste your text to let AI extract your profile</p>
            </div>

            {/* Input Method Toggle */}
            <div className="flex justify-center">
              <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border-2 border-slate-200">
                <button 
                  onClick={() => setInputMethod('upload')}
                  className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${inputMethod === 'upload' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  File Upload
                </button>
                <button 
                  onClick={() => setInputMethod('paste')}
                  className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${inputMethod === 'paste' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Raw Text
                </button>
              </div>
            </div>

            {inputMethod === 'upload' ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-4 border-dashed border-slate-200 rounded-[48px] p-20 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF6321] hover:bg-orange-50/30 transition-all group"
              >
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 border-4 border-[#FF6321] border-t-transparent rounded-full animate-spin" />
                    <p className="font-black uppercase italic tracking-tighter text-xl animate-pulse">Extracting Profile...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#FF6321] group-hover:text-white transition-all">
                      <Upload className="w-10 h-10" />
                    </div>
                    <p className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Drop your CV here or click to browse</p>
                    <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Supports PDF, DOCX, TXT</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <NeuTextarea 
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste your CV content here..."
                  className="!bg-white !rounded-[32px] border-2 border-slate-200 focus:border-[#FF6321] p-8 h-[320px] font-bold text-slate-700"
                />
                <div className="flex justify-center">
                  <button 
                    onClick={handlePasteSubmit}
                    disabled={isGenerating || !pastedText.trim()}
                    className="group relative px-12 py-5 bg-slate-900 text-white font-black uppercase italic text-xs tracking-widest rounded-2xl hover:bg-slate-800 disabled:opacity-30 transform active:scale-95 transition-all overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-4">
                      {isGenerating ? "Processing..." : "Extract Profile"} 
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-[#00FF00]" /> : <Edit3 className="w-4 h-4 text-[#00FF00]" />}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center">
              <p className="font-bold text-slate-400 mb-4 uppercase tracking-widest text-[10px]">Or continue with profile data</p>
              <button 
                onClick={() => setStep('job')}
                className="px-8 py-5 bg-slate-900 text-white font-black uppercase italic text-xs tracking-[0.2em] rounded-2xl hover:bg-slate-800 transform active:scale-95 transition-all flex items-center gap-4"
              >
                Skip to Job Details <ArrowRight className="w-4 h-4 text-[#00FF00]" />
              </button>
            </div>

            {savedCVs.length > 0 && (
              <div className="pt-12 space-y-6 border-t-2 border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-slate-200 flex-1" />
                  <h3 className="text-sm font-black uppercase italic tracking-tighter text-slate-400">Your Architectures</h3>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedCVs.map(cv => (
                    <motion.div 
                      key={cv.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setCvContent(cv.data);
                        setStep('view');
                      }}
                      className="bg-white border-2 border-slate-100 rounded-3xl p-6 cursor-pointer hover:border-[#FF6321] hover:shadow-xl transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center group-hover:bg-orange-50 group-hover:text-[#FF6321] transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                          {new Date(cv.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 leading-tight mb-1">
                        {cv.data.jobTitle || "Saved CV"}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                        {cv.data.tailoredSummary?.substring(0, 60)}...
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 'job' && (
          <motion.div 
            key="job"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
              <div className="space-y-4">
                <h2 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Target Slot</h2>
                <p className="font-bold text-[#FF6321] uppercase tracking-widest text-xs">Tell us about the role you are chasing</p>
              </div>
              {parsedStudentData && (
                <div className="flex items-center gap-3 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200">
                  <div className="w-10 h-10 bg-[#00FF00] text-slate-900 rounded-full flex items-center justify-center"><Check className="w-5 h-5" /></div>
                  <div>
                    <p className="font-black text-[10px] uppercase text-slate-400 leading-none mb-1">Profile Loaded</p>
                    <p className="font-bold text-xs text-slate-900 uppercase tracking-tighter">{parsedStudentData.name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pl-2">Job Title</label>
                  <NeuInput 
                    value={targetJob.title} 
                    onChange={e => setTargetJob({...targetJob, title: e.target.value})}
                    placeholder="e.g. Senior Frontend Architect"
                    className="!bg-white !rounded-3xl border-2 border-slate-200 focus:border-[#FF6321] p-6 text-lg font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pl-2">Company Name</label>
                  <NeuInput 
                    value={targetJob.company} 
                    onChange={e => setTargetJob({...targetJob, company: e.target.value})}
                    placeholder="e.g. Tesla, SpaceX, Google"
                    className="!bg-white !rounded-3xl border-2 border-slate-200 focus:border-[#FF6321] p-6 text-lg font-bold"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 pl-2">Job Description</label>
                <NeuTextarea 
                  value={targetJob.description} 
                  onChange={e => setTargetJob({...targetJob, description: e.target.value})}
                  placeholder="Paste the requirements and description here..."
                  className="!bg-white !rounded-[32px] border-2 border-slate-200 focus:border-[#FF6321] p-6 h-[264px] font-bold text-slate-700"
                />
              </div>
            </div>

            <div className="pt-8 flex justify-center">
              <button 
                onClick={generateInitialCV}
                disabled={isGenerating}
                className="group relative px-12 py-6 bg-slate-900 text-white font-black uppercase italic text-lg tracking-widest rounded-3xl hover:bg-slate-800 disabled:opacity-30 transform active:scale-95 transition-all overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-4">
                  {(targetJob.title || targetJob.description) ? "Engineer Tailored CV" : "Engineer Optimized CV"} 
                  <Sparkles className="w-6 h-6 text-[#00FF00] group-hover:rotate-12 transition-transform" />
                </span>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6321] opacity-20 blur-3xl -mr-16 -mt-16 group-hover:opacity-40 transition-opacity" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 'generating' && (
          <motion.div 
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 space-y-10"
          >
            <div className="relative">
              <div className="w-40 h-40 border-8 border-slate-100 rounded-full" />
              <div className="absolute top-0 left-0 w-40 h-40 border-8 border-[#FF6321] border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-[#FF6321] animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">Architecture in Progress</h3>
              <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Our AI is synthesizing your career trajectory with the role requirements</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
