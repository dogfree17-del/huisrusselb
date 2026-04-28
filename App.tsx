import React, { useState, useEffect, useMemo, useRef, useCallback, Component } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NeuCard, NeuButton, NeuInput, NeuSelect, NeuTextarea, NeuBadge } from './components/NeuComponents';
import { ReviewSubmission, ReviewList } from './components/ReviewComponents';
import { Tasks } from './components/MicroTasks';
import { Icons } from './components/Icons';
import { ResPointsPromo } from './components/ResPointsPromo';
import { DataProvider, useData } from './contexts/DataContext';
import { DataService, AuthService } from './services/supabase';
import { User, Notice, VisitorLog, UserRole, MaintenanceRequest, Booking, Cause, Feedback, Poll, Post, Photo, FileEntry, ChatMessage, AnonymousReportEntry } from './types';
import { Academia } from './components/Academia';
import { PointsPage } from './components/PointsPage';
import { AcademiaPromo } from './components/AcademiaPromo';
import { StudentProfileView } from './components/StudentProfileView';
import { generateSmartReport } from './utils/report-generator';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import { jsPDF } from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

// --- ICONS ---
const IconWrapper = ({children, className=""}: {children?: React.ReactNode, className?: string}) => (
  <svg className={`w-6 h-6 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

// --- GLOBAL LOADER ---
const Loader = () => (
  <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
    <span className="loader"></span>
    <p className="text-neu-accent font-black uppercase tracking-[0.3em] text-[10px] italic animate-pulse">Establishing Connection...</p>
  </div>
);

// --- HELPERS ---
const isAdmin = (role: UserRole) => role === 'admin' || role === 'super_admin';
const isStaff = (role: UserRole) => isAdmin(role) || role === 'door_monitor' || role === 'maintenance_admin';

const getImgFallback = (name: string) => `https://ui-avatars.com/api/?background=0F172A&color=fff&name=${encodeURIComponent(name)}`;

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let displayMessage = "Something went wrong. Please try refreshing the page.";
      try {
        const parsed = JSON.parse((this as any).state.error.message);
        if (parsed.error && parsed.error.includes("permission-denied")) {
          displayMessage = "You don't have permission to perform this action or view this data. Please check your account status.";
        }
      } catch (e) {
        // Not a JSON error message
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <NeuCard className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Icons.ShieldAlert className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase italic text-slate-900">System Error</h2>
              <p className="text-sm font-bold text-slate-500 leading-relaxed">
                {displayMessage}
              </p>
            </div>
            <NeuButton 
              variant="primary" 
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Refresh Application
            </NeuButton>
          </NeuCard>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export const getProfileCompletion = (user: User) => {
    const fields = [
        user.displayName,
        user.roomNumber && user.roomNumber !== 'Unassigned',
        user.phoneNumber,
        user.section,
        user.course,
        user.bio,
        user.interests && user.interests.length > 0,
        user.profileImageUrl,
        user.gender
    ];
    const filled = fields.filter(f => !!f).length;
    return Math.round((filled / fields.length) * 100);
};

const RoleBadge = ({ role }: { role: string }) => {
  const variant = role === 'super_admin' ? 'danger' : role === 'admin' ? 'primary' : role === 'general' ? 'neutral' : 'warning';
  const label = role.replace('_', ' ').toUpperCase();
  return <NeuBadge variant={variant}>{label}</NeuBadge>;
};

const PageHeader = ({ title, subtitle, actions }: { title: string, subtitle: string, actions?: React.ReactNode }) => (
  <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 md:mb-12 animate-slide-down">
    <div className="space-y-3 md:space-y-4">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-[0.9]">{title}</h1>
        <p className="text-neu-accent/60 font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[9px] md:text-[10px] italic">{subtitle}</p>
    </div>
    {actions && <div className="flex gap-4 w-full lg:w-auto animate-zoom-in">{actions}</div>}
  </header>
);

const openWhatsApp = (phone: string | undefined, message: string, currentUserUid?: string) => {
  if (!phone || phone.trim() === '' || phone.toLowerCase() === 'n/a') {
    alert("No valid phone number recorded for this user.");
    return;
  }
  
  if (currentUserUid) {
      DataService.awardPoints('whatsapp_click', 0.05).catch(console.error);
  }

  let cleanPhone = phone.replace(/\D/g, '');
  
  // Handle South African local format
  // 0712345678 -> 27712345678
  if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
    cleanPhone = '27' + cleanPhone.substring(1);
  } 
  // 270712345678 -> 27712345678
  else if (cleanPhone.startsWith('270') && cleanPhone.length === 12) {
    cleanPhone = '27' + cleanPhone.substring(3);
  }
  // 712345678 -> 27712345678
  else if (cleanPhone.length === 9 && /^[678]/.test(cleanPhone)) {
    cleanPhone = '27' + cleanPhone;
  }

  if (cleanPhone.length < 9) {
    alert("The phone number provided is too short to be valid.");
    return;
  }

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  
  // Try window.open first, fallback to location.href if blocked or on mobile
  const win = window.open(url, '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    window.location.href = url;
  }
};

const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
};

const VisitorTimer = ({ entryTime, expectedSignOutTime, signOutTime, onOverdue }: { entryTime?: string, expectedSignOutTime: string, signOutTime?: string, onOverdue?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    if (!entryTime || signOutTime) return;

    const tick = () => {
      const now = new Date();
      const end = new Date(expectedSignOutTime);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        if (!isOvertime) {
            setIsOvertime(true);
            if (onOverdue) onOverdue();
        }
        setTimeLeft("00:00:00");
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [entryTime, expectedSignOutTime, signOutTime, isOvertime, onOverdue]);

  if (signOutTime) return <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Session Closed</span>;
  if (!entryTime) return <span className="text-[10px] font-black text-neu-accent uppercase tracking-widest italic">Deadline: 23:00 / 01:00</span>;

  return (
    <div className={`font-mono font-black text-sm md:text-base tabular-nums tracking-widest italic transition-colors duration-500 ${isOvertime ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
      {isOvertime ? 'TIME EXPIRED' : timeLeft}
    </div>
  );
};

// --- PROFILE COMPLETION PROMPT COMPONENT ---

const ProfileCompletionPrompt = ({ user, onUpdate, onClose }: { user: User, onUpdate: () => void, onClose: () => void }) => {
    const [formData, setFormData] = useState({
        roomNumber: user.roomNumber === 'Unassigned' ? '' : (user.roomNumber || ''),
        phoneNumber: user.phoneNumber || '',
        section: user.section || '',
        course: user.course || '',
        bio: user.bio || '',
        plansForNextYear: user.plansForNextYear || '',
        interests: user.interests?.join(', ') || '',
        gender: user.gender || ''
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const isMissing = useCallback((key: string) => {
        switch(key) {
            case 'roomNumber': return !user.roomNumber || user.roomNumber === 'Unassigned';
            case 'phoneNumber': return !user.phoneNumber;
            case 'section': return !user.section;
            case 'course': return !user.course;
            case 'bio': return !user.bio;
            case 'plansForNextYear': return !user.plansForNextYear;
            case 'interests': return !user.interests || user.interests.length === 0;
            case 'gender': return !user.gender;
            case 'profileImageUrl': return !user.profileImageUrl;
            default: return false;
        }
    }, [user]);

    const missingFields = useMemo(() => {
        return [
            'profileImageUrl', 'course', 'bio', 'plansForNextYear', 'interests', 'roomNumber', 'section', 'gender', 'phoneNumber'
        ].filter(isMissing);
    }, [isMissing]);

    const fieldsToAsk = useMemo(() => missingFields.slice(0, 2), [missingFields]);

    const fieldMessages: Record<string, { title: string, subtitle: string }> = {
        profileImageUrl: { title: "Who are you, a ghost?", subtitle: "Add a picture so we know you don't bite." },
        course: { title: "What are you studying?", subtitle: "Or are you just here for the free Wi-Fi?" },
        bio: { title: "You're a 404 Error in human form.", subtitle: "Write a bio. Prove you're not a bot." },
        plansForNextYear: { title: "What's the plan?", subtitle: "Plans for next year? Let us know!" },
        interests: { title: "Do you even have hobbies?", subtitle: "Add some interests before people think you stare at walls for fun." },
        roomNumber: { title: "Where do you sleep?", subtitle: "We promise we won't send the RA. (Maybe.)" },
        section: { title: "Which section claims you?", subtitle: "Don't be a nomad, tell us your section." },
        gender: { title: "For the demographics...", subtitle: "Help us balance the spreadsheets." },
        phoneNumber: { title: "Drop those digits.", subtitle: "How else will we add you to 50 WhatsApp groups?" }
    };

    const primaryField = fieldsToAsk[0];
    const message = primaryField ? fieldMessages[primaryField] : { title: "Complete Your Profile", subtitle: "Unlock all features" };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let finalAvatarUrl = user.profileImageUrl || '';
            if (avatarFile) {
                const url = await DataService.uploadImage(avatarFile, `avatars/${user.uid}_${Date.now()}`);
                if (url) finalAvatarUrl = url;
            }
            const interestsArr = formData.interests ? formData.interests.split(',').map(i => i.trim()).filter(i => i) : [];
            const { interests, ...restFormData } = formData;
            const updatedUser = {
                ...user,
                ...restFormData,
                ...(interestsArr.length > 0 ? { interests: interestsArr } : {}),
                profileImageUrl: finalAvatarUrl
            };
            await DataService.updateUserProfile(user.uid, {
                ...restFormData,
                ...(interestsArr.length > 0 ? { interests: interestsArr } : {}),
                profileImageUrl: finalAvatarUrl
            });
            
            if (!user.profileImageUrl && finalAvatarUrl) {
                await DataService.awardPoints('profile_picture', 0.5);
            }
            if (getProfileCompletion(user) < 100 && getProfileCompletion(updatedUser as any) === 100) {
                await DataService.awardPoints('profile_completion', 1.0);
            }

            alert("Profile updated successfully!");
            onUpdate();
        } catch (e: any) {
            console.error(e);
            alert(`Failed to save profile details: ${e.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <NeuCard className="w-full max-w-md bg-white shadow-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden animate-zoom-in border-0">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-black uppercase italic tracking-tight">{message.title}</h3>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">{message.subtitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors"><Icons.X /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
                    {fieldsToAsk.includes('profileImageUrl') && (
                        <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center text-center gap-2 group hover:border-neu-accent/40 transition-colors">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm border-2 border-white">
                                {avatarFile ? <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" /> : <Icons.Profile className="text-slate-300 w-8 h-8" />}
                            </div>
                            <label className="block text-[10px] font-black uppercase text-neu-accent tracking-widest mt-2 cursor-pointer hover:underline">
                                Upload Avatar
                                <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="hidden" />
                            </label>
                        </div>
                    )}
                    
                    {fieldsToAsk.includes('roomNumber') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Room No.</label>
                            <NeuInput value={formData.roomNumber} onChange={e => setFormData({...formData, roomNumber: e.target.value})} placeholder="e.g. 304" className="!py-3" />
                        </div>
                    )}

                    {fieldsToAsk.includes('section') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Section</label>
                            <NeuInput value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} placeholder="e.g. B" className="!py-3" />
                        </div>
                    )}

                    {fieldsToAsk.includes('course') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course</label>
                            <NeuInput value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} placeholder="e.g. BSc" className="!py-3" />
                        </div>
                    )}

                    {fieldsToAsk.includes('phoneNumber') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                            <NeuInput value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="071..." className="!py-3" />
                        </div>
                    )}

                    {fieldsToAsk.includes('gender') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                            <NeuSelect value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="!h-[46px]">
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Non-binary</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </NeuSelect>
                        </div>
                    )}

                    {fieldsToAsk.includes('interests') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Interests</label>
                            <NeuInput value={formData.interests} onChange={e => setFormData({...formData, interests: e.target.value})} placeholder="Hiking, Coding, Music..." className="!py-3" />
                        </div>
                    )}

                    {fieldsToAsk.includes('bio') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bio</label>
                            <NeuTextarea value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="Tell the res about yourself..." className="!min-h-[80px]" />
                        </div>
                    )}

                    {fieldsToAsk.includes('plansForNextYear') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Plans for next year</label>
                            <NeuTextarea value={formData.plansForNextYear} onChange={e => setFormData({...formData, plansForNextYear: e.target.value})} placeholder="What are your plans for next year?" className="!min-h-[80px]" />
                        </div>
                    )}
                </div>
                
                <div className="p-4 bg-white border-t border-slate-100 flex gap-4 shrink-0">
                    <NeuButton variant="ghost" onClick={onClose} className="flex-1 !py-3">Skip for now</NeuButton>
                    <NeuButton variant="primary" onClick={handleSave} className="flex-1 !py-3" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save & Continue'}
                    </NeuButton>
                </div>
            </NeuCard>
        </div>
    );
};

const InstallPrompt = ({ onClose, onDismissForever }: { onClose: () => void, onDismissForever: () => void }) => {
    return (
        <div className="fixed bottom-24 left-4 right-4 z-[60] animate-slide-up">
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors">
                    <Icons.X className="w-5 h-5" />
                </button>
                
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                        <Icons.Download className="w-6 h-6 text-slate-900" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-slate-900 leading-tight">Install HRB Portal</h3>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">Tap the share button, then "Add to Home Screen"</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-center gap-3 border border-slate-100 mb-4">
                    <Icons.Share className="w-5 h-5 text-slate-900" />
                    <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Tap Share → Add to Home Screen</span>
                </div>

                <button 
                    onClick={onDismissForever}
                    className="w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-2"
                >
                    Don't show this again
                </button>
            </div>
        </div>
    );
};


// --- IMMERSIVE USER PROFILE COMPONENT ---

const isStatusValid = (status?: {text: string, timestamp: string}) => {
    if (!status || !status.text) return false;
    const diff = new Date().getTime() - new Date(status.timestamp).getTime();
    return diff < 24 * 60 * 60 * 1000; // 24 hours
};

const LevelUpModal = ({ rank, onClose }: { rank: string, onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <motion.div 
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-neu-accent/10 to-transparent -z-10" />
                <div className="w-24 h-24 bg-neu-accent/20 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <Icons.Check className="w-12 h-12 text-neu-accent" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black italic text-slate-900 uppercase tracking-tighter">Level Up!</h2>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">You've reached a new rank</p>
                </div>
                <div className="py-4 px-6 bg-slate-900 text-white rounded-2xl inline-block font-black italic text-xl uppercase tracking-widest shadow-lg">
                    {rank}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Your contributions are making Huis Russel Botman a better place for everyone. Keep it up!</p>
                <NeuButton variant="primary" className="w-full" onClick={onClose}>Awesome!</NeuButton>
            </motion.div>
        </div>
    );
};


const parsePDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
    }
    return fullText;
};

const ProfessionalSummary = ({ user, onUpdate }: { user: User, onUpdate: (data: Partial<User>) => void }) => {
    const [isParsing, setIsParsing] = useState(false);
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsParsing(true);
        try {
            const text = await parsePDF(file);
            
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Extract professional information from this CV text. Return a JSON object with: professionalSummary (string), skills (array of strings), education (array of objects with institution, degree, year), experience (array of objects with company, position, duration). 
                
                CV Text:
                ${text}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            professionalSummary: { type: Type.STRING },
                            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                            education: { 
                                type: Type.ARRAY, 
                                items: { 
                                    type: Type.OBJECT,
                                    properties: {
                                        institution: { type: Type.STRING },
                                        degree: { type: Type.STRING },
                                        year: { type: Type.STRING }
                                    }
                                }
                            },
                            experience: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        company: { type: Type.STRING },
                                        position: { type: Type.STRING },
                                        duration: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const parsedData = JSON.parse(response.text);
            await onUpdate(parsedData);
            alert("CV parsed successfully! Your professional summary has been updated.");
        } catch (error) {
            console.error("Error parsing CV:", error);
            alert("Failed to parse CV. Please try again or fill in the details manually.");
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <PageHeader title="Professional" subtitle="Summary & CV" />
            
            <NeuCard className="bg-white space-y-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-black italic text-lg text-slate-800 uppercase tracking-tighter">CV Parsing</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload your CV to generate a summary</p>
                    </div>
                    <Icons.FileText className="w-8 h-8 text-slate-200" />
                </div>

                <div className="p-8 border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50 flex flex-col items-center justify-center text-center gap-4 group hover:border-neu-accent/40 transition-colors relative overflow-hidden">
                    {isParsing && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
                            <Icons.Bot className="w-12 h-12 text-neu-accent animate-bounce" />
                            <p className="text-xs font-black uppercase italic text-slate-900 animate-pulse">AI is parsing your CV...</p>
                        </div>
                    )}
                    <input type="file" id="cv-upload" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
                    <label htmlFor="cv-upload" className="cursor-pointer flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-neu-accent transition-all group-hover:scale-110">
                            <Icons.Plus className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-black italic text-slate-800 uppercase tracking-tighter">Click to upload CV</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PDF, DOCX (Max 5MB)</p>
                        </div>
                    </label>
                </div>
            </NeuCard>

            {user.professionalSummary && (
                <div className="space-y-6 animate-slide-up">
                    <NeuCard className="bg-slate-900 text-white space-y-4">
                        <h3 className="font-black italic text-lg uppercase tracking-tighter">Professional Summary</h3>
                        <p className="text-sm leading-relaxed text-slate-300 italic">"{user.professionalSummary}"</p>
                    </NeuCard>

                    <div className="grid md:grid-cols-2 gap-6">
                        <NeuCard className="bg-white space-y-4">
                            <h3 className="font-black italic text-lg text-slate-800 uppercase tracking-tighter">Skills</h3>
                            <div className="flex flex-wrap gap-2">
                                {user.skills?.map((skill, i) => (
                                    <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">{skill}</span>
                                ))}
                            </div>
                        </NeuCard>

                        <NeuCard className="bg-white space-y-4">
                            <h3 className="font-black italic text-lg text-slate-800 uppercase tracking-tighter">Education</h3>
                            <div className="space-y-3">
                                {user.education?.map((edu, i) => (
                                    <div key={i} className="border-l-2 border-neu-accent pl-3 space-y-1">
                                        <p className="text-xs font-black text-slate-900 uppercase">{edu.degree}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{edu.institution}</p>
                                        <p className="text-[9px] font-bold text-slate-400">{edu.year}</p>
                                    </div>
                                ))}
                            </div>
                        </NeuCard>
                    </div>

                    <NeuCard className="bg-white space-y-4">
                        <h3 className="font-black italic text-lg text-slate-800 uppercase tracking-tighter">Experience</h3>
                        <div className="space-y-4">
                            {user.experience?.map((exp, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                        <Icons.Briefcase className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-slate-900 uppercase">{exp.position}</p>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{exp.company}</p>
                                        <p className="text-[9px] font-bold text-slate-400">{exp.duration}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </NeuCard>
                </div>
            )}
        </div>
    );
};
const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diff = new Date().getTime() - new Date(lastSeen).getTime();
    return diff < 15 * 60 * 1000;
};

const UserProfileView = ({ user, currentUser, onBack }: { user: User, currentUser: User, onBack: () => void }) => {
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=881337&color=fff&size=512`;
    
    const noProfilePicMessages = useMemo(() => [
        "Hey! Your Huis Russel profile is looking a bit like John Cena right now... I can't see you! Time to upload a pic?",
        "Rumor has it you're a vampire because you have no reflection on the Huis Russel app. Prove them wrong with a profile pic!",
        "Your profile picture is currently a masterpiece of minimalist invisible art. Maybe add a real photo so we know who you are?",
        "Is your camera shy or are you? Drop a pic on the Huis Russel app so we can put a face to the legend!",
        "Breaking news: Local resident remains a mystery! Update your Huis Russel profile pic before we start drawing stick figures of you.",
        "I was trying to find you on the app, but your profile pic is in stealth mode. Time to uncloak!",
        "Your profile is suffering from a severe case of 'No-Face-itis'. The only cure is uploading a photo!",
        "We love a good mystery, but your missing profile pic is taking it too far. Show us your face on the app!",
        "Are you in witness protection? If not, it's safe to add a profile picture on the Huis Russel app!",
        "Your avatar is currently a ghost. Spooky, but not very helpful. Add a photo to your profile!"
    ], []);

    const randomMessage = useMemo(() => noProfilePicMessages[Math.floor(Math.random() * noProfilePicMessages.length)], [noProfilePicMessages]);

    const [iceBreakerAnswer, setIceBreakerAnswer] = useState('');
    const [isSubmittingIceBreaker, setIsSubmittingIceBreaker] = useState(false);
    const [localUser, setLocalUser] = useState<User>(user);

    const handleIceBreakerSubmit = async () => {
        if (!iceBreakerAnswer.trim()) return;
        setIsSubmittingIceBreaker(true);
        try {
            const newAnswer = {
                id: Date.now().toString(),
                userId: currentUser.uid,
                userName: currentUser.displayName,
                userPhone: currentUser.phoneNumber || '',
                userAvatar: currentUser.profileImageUrl || '',
                answer: iceBreakerAnswer.trim(),
                createdAt: new Date().toISOString()
            };
            await DataService.submitIceBreakerAnswer(localUser.uid, newAnswer);
            setLocalUser(prev => ({
                ...prev,
                iceBreakerAnswers: [...(prev.iceBreakerAnswers || []), newAnswer]
            }));
            setIceBreakerAnswer('');
        } catch (error) {
            console.error("Error submitting ice breaker answer:", error);
            alert("Failed to submit answer. Please try again.");
        } finally {
            setIsSubmittingIceBreaker(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#f8fafc] animate-fade-in overflow-y-auto selection:bg-[#FF6321]/30">
            <div className="relative min-h-screen pb-32 max-w-5xl mx-auto px-4 md:px-0">
                {/* Header Actions */}
                <div className="sticky top-0 z-[200] flex justify-between items-center py-6 backdrop-blur-sm">
                    <button onClick={onBack} className="flex items-center justify-center px-6 py-3 rounded-2xl bg-white border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-slate-900 hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all font-black text-xs uppercase tracking-widest italic shrink-0">
                        <Icons.ArrowLeft className="w-5 h-5 mr-2" /> Back
                    </button>
                    {localUser.uid === currentUser.uid && <NotificationBell user={currentUser} />}
                </div>

                {/* Main Identity Section */}
                <div className="mt-8 space-y-12">
                    <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-end">
                        <div className="relative shrink-0 animate-slide-up">
                            <div className="w-48 h-48 md:w-80 md:h-80 rounded-[3rem] border-8 border-slate-900 shadow-[16px_16px_0px_0px_rgba(255,99,33,1)] overflow-hidden bg-slate-100 transform -rotate-2">
                                <img src={localUser.profileImageUrl || avatarFallback} className="w-full h-full object-cover" alt={localUser.displayName} />
                            </div>
                            {isOnline(localUser.lastSeen) && (
                                <div className="absolute -bottom-4 -right-4 bg-[#00FF00] text-slate-900 border-4 border-slate-900 px-6 py-2 rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-bounce">
                                    Online Now
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 space-y-6 animate-slide-down">
                            <div className="space-y-2">
                                <span className="text-[#FF6321] font-black uppercase tracking-[0.4em] text-[10px] md:text-xs italic">Resident Profile / {localUser.roomNumber || 'Unknown Room'}</span>
                                <h1 className="text-5xl md:text-9xl font-black text-slate-900 tracking-tighter italic uppercase leading-[0.8] mb-4">
                                    {localUser.displayName}
                                </h1>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <span className="bg-slate-900 shadow-[4px_4px_0px_0px_rgba(255,165,0,1)] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 italic">
                                    RANK: {(localUser.points || 0).toFixed(2)} RP
                                </span>
                                <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 italic shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {localUser.course || 'Neural Explorer'}
                                </span>
                                {localUser.section && (
                                    <span className="bg-[#00FF00] text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 italic shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        Section {localUser.section}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Interactions & Bio */}
                    <div className="grid lg:grid-cols-3 gap-12 items-start">
                        <div className="lg:col-span-2 space-y-12">
                            {/* Bio Neu-Style */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b-4 border-slate-900 pb-2">
                                    <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900">Information</h3>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Biological Record</span>
                                </div>
                                <div className="bg-white border-4 border-slate-900 p-8 rounded-[2.5rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                    {localUser.bio ? (
                                        <p className="text-slate-900 text-lg md:text-2xl font-black italic tracking-tight leading-tight">
                                            "{localUser.bio}"
                                        </p>
                                    ) : (
                                        <p className="text-slate-400 text-lg italic uppercase font-black tracking-widest opacity-30">This user is operating in stealth mode.</p>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid md:grid-cols-2 gap-8">
                                {localUser.plansForNextYear && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#FF6321] italic">Phase Next Year</h4>
                                        <div className="bg-slate-900 text-white p-6 rounded-[2rem] border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(255,99,33,1)]">
                                            <p className="text-sm font-bold leading-relaxed italic">{localUser.plansForNextYear}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {localUser.interests && localUser.interests.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">Interests / Nodes</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {localUser.interests.map((interest, i) => (
                                                <span key={i} className="bg-white border-2 border-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-slate-50 transition-colors">
                                                    {interest}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Social Links Neu-Style */}
                            {(localUser.instagramUrl || localUser.linkedinUrl) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {localUser.instagramUrl && (
                                        <a href={localUser.instagramUrl} target="_blank" rel="noopener noreferrer" className="bg-pink-100 text-pink-600 border-4 border-slate-900 h-16 rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                            <Icons.Instagram className="w-5 h-5" /> Instagram
                                        </a>
                                    )}
                                    {localUser.linkedinUrl && (
                                        <a href={localUser.linkedinUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-100 text-blue-600 border-4 border-slate-900 h-16 rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                                            <Icons.LinkedIn className="w-5 h-5" /> LinkedIn
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Ice Breaker Neu-Style */}
                            {localUser.iceBreakerQuestion && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end border-b-4 border-slate-900 pb-2">
                                        <h3 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
                                            <Icons.MessageCircle className="w-6 h-6 md:w-8 md:h-8 text-[#FF6321]" />
                                            Ice Breaker
                                        </h3>
                                    </div>
                                    
                                    <div className="bg-white border-4 border-slate-900 rounded-[2.5rem] p-8 shadow-[12px_12px_0px_0px_rgba(255,99,33,1)]">
                                        <p className="text-xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight mb-8">
                                            "{localUser.iceBreakerQuestion}"
                                        </p>

                                        {localUser.uid === currentUser.uid && localUser.iceBreakerAnswers && localUser.iceBreakerAnswers.length > 0 && (
                                            <div className="space-y-4 mb-8">
                                                {[...localUser.iceBreakerAnswers].reverse().map(answer => (
                                                    <div key={answer.id} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-xl border-2 border-slate-900 overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                                <img src={answer.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(answer.userName)}&background=881337&color=fff`} className="w-full h-full object-cover" alt={answer.userName} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight block leading-none">{answer.userName}</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tracking-tighter">{new Date(answer.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            {answer.userPhone && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const message = `Hi ${answer.userName}! I'm replying to your answer to my icebreaker: "${answer.answer}"`;
                                                                        openWhatsApp(answer.userPhone!, message, currentUser.uid);
                                                                    }}
                                                                    className="bg-[#00FF00] border-2 border-slate-900 text-slate-900 p-2 rounded-xl hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                                                >
                                                                    <Icons.MessageCircle className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700 leading-relaxed italic pl-13">"{answer.answer}"</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {localUser.uid !== currentUser.uid && (
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <NeuInput 
                                                    value={iceBreakerAnswer}
                                                    onChange={e => setIceBreakerAnswer(e.target.value)}
                                                    placeholder="TYPE YOUR RESPONSE..."
                                                    className="flex-1 !rounded-2xl !h-14 font-black tracking-widest text-xs !bg-slate-50"
                                                    onKeyDown={e => e.key === 'Enter' && handleIceBreakerSubmit()}
                                                />
                                                <button 
                                                    onClick={handleIceBreakerSubmit}
                                                    disabled={!iceBreakerAnswer.trim() || isSubmittingIceBreaker}
                                                    className="bg-[#FF6321] text-white px-8 h-14 rounded-2xl font-black uppercase italic tracking-widest text-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-slate-900 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3"
                                                >
                                                    {isSubmittingIceBreaker ? "SENDING..." : "EXECUTE"}
                                                    <Icons.Send className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Actions */}
                        <div className="space-y-6">
                            {localUser.uid !== currentUser.uid && localUser.phoneNumber && (
                                <button 
                                    onClick={() => openWhatsApp(localUser.phoneNumber!, `Hi ${localUser.displayName}! I saw your profile on the Huis Russel app and wanted to say hi!`, currentUser.uid)}
                                    className="w-full bg-[#00FF00] text-slate-900 p-8 rounded-[2.5rem] border-4 border-slate-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] font-black uppercase italic tracking-tighter text-xl hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex flex-col items-center gap-4 group"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-slate-900 text-[#00FF00] flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,255,0,0.4)] group-hover:rotate-12 transition-transform">
                                        <Icons.MessageCircle className="w-8 h-8" />
                                    </div>
                                    Initiate WhatsApp
                                </button>
                            )}
                            
                            {!localUser.profileImageUrl && localUser.phoneNumber && (
                                <button 
                                    onClick={() => openWhatsApp(localUser.phoneNumber!, randomMessage, currentUser.uid)}
                                    className="w-full bg-slate-900 text-white p-6 rounded-[2rem] border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(255,99,33,1)] font-black uppercase text-xs tracking-widest hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 group"
                                >
                                    <Icons.Image className="w-5 h-5 text-[#FF6321] group-hover:animate-pulse" /> Demand Profile Pic
                                </button>
                            )}

                            {localUser.reason && (
                                <div className="p-8 rounded-[2.5rem] border-4 border-slate-900 bg-white shadow-[12px_12px_0px_0px_rgba(0,128,255,1)] relative overflow-hidden">
                                   <div className="space-y-4">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 flex items-center gap-2">
                                            <Icons.Sparkles className="w-4 h-4" /> Intel Analysis
                                        </span>
                                        <p className="text-lg font-black text-slate-900 leading-tight italic">"{localUser.reason}"</p>
                                   </div>
                                </div>
                            )}

                            {localUser.sports && localUser.sports.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 italic">Athletic Systems</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {localUser.sports.map((sport, i) => (
                                            <span key={i} className="bg-slate-100 border-2 border-slate-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                {sport}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- CHATBOT COMPONENT ---


// --- MODULE COMPONENTS ---

const PointsExplanation = ({ onBack, currentUser }: { onBack: () => void, currentUser: User }) => {
    const { users } = useData();
    const [votingFor, setVotingFor] = useState<string | null>(null);

    const handleVote = async (userId: string) => {
        if (votingFor) return;

        const today = new Date().toISOString().split('T')[0];
        const isNewDay = currentUser.lastVoteDate !== today;
        const currentGiven = isNewDay ? 0 : (currentUser.dailyPointsGiven || 0);
        const voteValue = 0.09;
        const newGiven = Number((currentGiven + voteValue).toFixed(2));

        if (newGiven > 0.28) {
            alert("You have reached your daily limit of 0.27 points to give away.");
            return;
        }

        setVotingFor(userId);
        try {
            await DataService.awardPoints('vote_cast', voteValue, userId);
            await DataService.updateUserProfile(currentUser.uid, {
                dailyPointsGiven: newGiven,
                lastVoteDate: today
            });
            alert(`Vote cast successfully! +${voteValue} points awarded. You have ${Number((0.27 - newGiven).toFixed(2))}p left to give today.`);
        } catch (e) {
            alert("Failed to cast vote.");
        } finally {
            setVotingFor(null);
        }
    };

    const earningWays = [
        { title: "Account Creation", points: "+2.00", icon: Icons.Profile, desc: "Welcome to the community." },
        { title: "Profile Completion", points: "+1.00", icon: Icons.Check, desc: "Tell us about yourself." },
        { title: "Profile Picture", points: "+0.50", icon: Icons.Image, desc: "Put a face to the name." },
        { title: "Daily Session", points: "+0.01", icon: Icons.Clock, desc: "Log in and stay active." },
        { title: "Door Monitor", points: "+0.03", icon: Icons.Visitors, desc: "Verify visitor entry or exit." },
        { title: "Maintenance", points: "+0.10", icon: Icons.Maintenance, desc: "Resolve issues or add notes." },
        { title: "Feedback & Reports", points: "+0.10", icon: Icons.Megaphone, desc: "Help us improve." },
        { title: "Shop", points: "+0.15", icon: Icons.Market, desc: "List a new item." },
        { title: "System Reports", points: "+0.10", icon: Icons.FileText, desc: "Generate admin reports." },
    ];

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => (b.points || 0) - (a.points || 0));
    }, [users]);

    const top20 = sortedUsers.slice(0, 20);
    const currentUserRank = sortedUsers.findIndex(u => u.uid === currentUser.uid) + 1;

    return (
        <div className="min-h-screen bg-[#050505] text-white fixed inset-0 z-50 overflow-y-auto selection:bg-amber-500/30">
            <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
                <button onClick={onBack} className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12">
                    <Icons.ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                    <span className="text-sm font-bold uppercase tracking-widest">Return</span>
                </button>

                <div className="space-y-6 mb-20 animate-slide-up">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest mb-4">
                        <Icons.Sparkles className="w-4 h-4" />
                        Reward System
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">
                        The Currency of <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">Contribution.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed font-light">
                        Res Points are earned by actively participating in the Huis Russel Botman community. 
                        From keeping the residence secure to helping out housemates, every action counts.
                    </p>
                </div>

                {/* Why Points Matter - Animated Overlapping Cards */}
                <div className="relative h-72 md:h-80 mb-32 w-full max-w-3xl mx-auto perspective-1000 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="absolute inset-0 flex justify-center items-center">
                        {/* Card 1: Leadership */}
                        <motion.div 
                            drag
                            dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
                            whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                            initial={{ rotate: -6, x: -48, y: 0 }}
                            whileHover={{ x: -144, rotate: -12, zIndex: 40, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="absolute w-64 md:w-80 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl z-10 cursor-grab"
                        >
                            <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/30 pointer-events-none">
                                <Icons.Users className="w-6 h-6 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2 text-white pointer-events-none">Leadership & Trust</h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed pointer-events-none">Top contributors can easily earn votes into leadership positions, as people trust those who are active in res.</p>
                        </motion.div>

                        {/* Card 2: Certificates */}
                        <motion.div 
                            drag
                            dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
                            whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                            initial={{ rotate: 0, x: 0, y: 0 }}
                            whileHover={{ y: -48, zIndex: 40, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="absolute w-64 md:w-80 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl z-20 cursor-grab"
                        >
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30 pointer-events-none">
                                <Icons.FileText className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2 text-white pointer-events-none">Official Recognition</h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed pointer-events-none">Top contributors get certificates at year-end showing their leadership prowess and dedication to the house.</p>
                        </motion.div>

                        {/* Card 3: Fame */}
                        <motion.div 
                            drag
                            dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
                            whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                            initial={{ rotate: 6, x: 48, y: 0 }}
                            whileHover={{ x: 144, rotate: 12, zIndex: 40, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="absolute w-64 md:w-80 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl z-30 cursor-grab"
                        >
                            <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center mb-4 border border-pink-500/30 pointer-events-none">
                                <Icons.Sparkles className="w-6 h-6 text-pink-500" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tight mb-2 text-white pointer-events-none">Fame & Connections</h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed pointer-events-none">Build a strong reputation, become well-known across the residence, and forge lasting connections.</p>
                        </motion.div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                                    <Icons.Trophy className="w-6 h-6 text-amber-500" />
                                    Top Contributors
                                </h2>
                                <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                    <Icons.Sparkles className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-bold text-slate-300">
                                        Daily Giving Limit: <span className="text-amber-400">{Number((0.35 - (currentUser.lastVoteDate === new Date().toISOString().split('T')[0] ? (currentUser.dailyPointsGiven || 0) : 0)).toFixed(2))}p</span> left
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden">
                                <div className="p-4 bg-white/[0.02] border-b border-white/[0.05] flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Rank: #{currentUserRank > 0 ? currentUserRank : '-'}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Points: {(currentUser.points || 0).toFixed(2)}</div>
                                </div>
                                <div className="divide-y divide-white/[0.05]">
                                    {top20.map((u, idx) => (
                                        <div key={u.uid} className={`p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors ${u.uid === currentUser.uid ? 'bg-amber-500/5' : ''}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx < 3 ? 'bg-amber-500 text-black' : 'bg-white/10 text-slate-400'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <img src={u.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=881337&color=fff`} alt={u.displayName} className="w-10 h-10 rounded-full object-cover" />
                                                    <div>
                                                        <div className="font-bold text-sm">{u.displayName} {u.uid === currentUser.uid && <span className="text-amber-500 text-xs ml-1">(You)</span>}</div>
                                                        <div className="text-xs text-slate-400">{u.course || 'Resident'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="font-mono font-bold text-amber-400">
                                                    {(u.points || 0).toFixed(2)}<span className="text-xs text-amber-500/50 ml-1">p</span>
                                                </div>
                                                {u.uid !== currentUser.uid && (
                                                    <button 
                                                        onClick={() => handleVote(u.uid)}
                                                        disabled={votingFor !== null}
                                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <Icons.ArrowUp className="w-3 h-3" /> {votingFor === u.uid ? '...' : 'Vote'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
                            <Icons.Sparkles className="w-6 h-6 text-amber-500" />
                            How to Earn
                        </h2>
                        <div className="space-y-3">
                            {earningWays.map((way, idx) => (
                                <div 
                                    key={idx} 
                                    className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-amber-500/30 transition-all duration-300"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-white/[0.05] text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300">
                                            <way.icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-bold text-white">{way.title}</h3>
                                            <p className="text-xs text-slate-400">{way.desc}</p>
                                        </div>
                                        <div className="text-sm font-black text-white font-mono tracking-tight">
                                            {way.points.toString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnimatedPoints = ({ points, onClick }: { points: number, onClick?: () => void }) => {
    const [displayPoints, setDisplayPoints] = useState(0);

    useEffect(() => {
        let start = displayPoints;
        const end = points;
        if (start === end) return;

        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (easeOutQuart)
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const current = start + (end - start) * easeProgress;
            
            setDisplayPoints(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayPoints(end);
            }
        };

        requestAnimationFrame(animate);
    }, [points]);

    return (
        <div 
            onClick={onClick}
            className={`flex flex-col items-end animate-fade-in ${onClick ? 'cursor-pointer hover:scale-105 transition-transform duration-300 group' : ''}`}
        >
            <div className="text-2xl font-black text-neu-accent tracking-tighter italic flex items-center gap-1 group-hover:text-amber-600 transition-colors">
                <Icons.Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                {displayPoints.toFixed(2)}<span className="text-sm">p</span>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Res Points</div>
        </div>
    );
};

const NoticeBoard = ({ role }: { role: UserRole }) => {
    const { notices: contextNotices } = useData();
    const [activeTab, setActiveTab] = useState<'events' | 'announcements'>('announcements');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<Partial<Notice>>({ title: '', content: '', priority: 'low', type: 'event', eventDate: '', time: '', location: '' });
    const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

    const notices = useMemo(() => {
        return contextNotices.filter(n => n.type === (activeTab === 'events' ? 'event' : 'announcement'));
    }, [contextNotices, activeTab]);

    const handleSubmit = async () => {
        if (!formData.title || !formData.content) return;
        if (formData.type === 'event' && !formData.eventDate) return;
        
        setIsSubmitting(true);
        try {
            await DataService.addNotice({
                title: formData.title,
                content: formData.content,
                date: new Date().toISOString(),
                time: formData.time,
                priority: formData.priority as 'low' | 'high',
                type: formData.type as 'event' | 'announcement',
                eventDate: formData.eventDate,
                location: formData.location
            });
            setShowAddModal(false);
            setFormData({ title: '', content: '', priority: 'low', type: 'event', eventDate: '', time: '', location: '' });
        } catch (e) {
            console.error('Failed to post notice.', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        await DataService.deleteNotice(id);
    };

    const events = notices
        .filter(n => n.type === 'event')
        .sort((a, b) => new Date(a.eventDate || a.date).getTime() - new Date(b.eventDate || b.date).getTime())
        .filter(n => {
            const eventDate = new Date(n.eventDate || n.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return eventDate.getTime() >= today.getTime();
        });

    const announcements = notices
        .filter(n => n.type !== 'event')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const activeData = activeTab === 'events' ? events : announcements;

    return (
        <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex justify-between items-end mb-6">
                <div className="space-y-1">
                    <h2 className="text-lg font-black text-slate-800 uppercase italic tracking-tighter">Notice Board</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stay updated</p>
                </div>
                {isAdmin(role) && (
                    <button onClick={() => setShowAddModal(true)} className="w-8 h-8 bg-neu-accent text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                        <Icons.Plus className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('events')} 
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'events' ? 'bg-white text-neu-accent shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Upcoming Events
                </button>
                <button 
                    onClick={() => setActiveTab('announcements')} 
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'announcements' ? 'bg-white text-neu-accent shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Announcements
                </button>
            </div>

            <div className="space-y-4">
                {activeData.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-200 rounded-3xl">
                        Nothing to show right now
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-4">
                        {activeData.map(notice => {
                            const isEvent = notice.type === 'event';
                            const dateObj = new Date(isEvent ? (notice.eventDate || notice.date) : notice.date);
                            const isHighPriority = notice.priority === 'high';
                            
                            const isExpanded = expandedNotice === notice.id;
                            
                            return (
                                <div 
                                    key={notice.id} 
                                    onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                                    className={`min-w-[260px] max-w-[280px] shrink-0 snap-start p-5 rounded-3xl border shadow-sm relative overflow-hidden group transition-all duration-300 cursor-pointer ${isExpanded ? 'max-h-[500px] !max-w-[320px] z-10' : 'max-h-[200px] hover:-translate-y-1'} ${isHighPriority ? 'bg-rose-50 border-rose-100 hover:shadow-rose-100' : 'bg-white border-slate-100 hover:shadow-md'}`}
                                >
                                    {isHighPriority && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-100 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>}
                                    
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase ${isHighPriority ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {dateObj.toLocaleDateString('en-US', { month: 'short' })}<br/>{dateObj.getDate()}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {isEvent ? <Icons.Calendar className="w-3 h-3 text-neu-accent" /> : <Icons.Megaphone className="w-3 h-3 text-amber-500" />}
                                                    {isEvent ? 'Event' : 'Announcement'}
                                                    {notice.time && <span className="ml-1 text-slate-500">• {notice.time}</span>}
                                                </div>
                                                {isEvent && notice.location && (
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <Icons.Globe className="w-3 h-3" /> {notice.location}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isAdmin(role) && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                                                <Icons.Trash className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    
                                    <h3 className={`font-black text-lg leading-tight mb-2 ${isHighPriority ? 'text-rose-900' : 'text-slate-900'}`}>{notice.title}</h3>
                                    <p className={`text-xs text-slate-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>{notice.content}</p>
                                    {!isExpanded && notice.content.length > 100 && (
                                        <div className="mt-2 text-[10px] font-bold text-neu-accent uppercase tracking-widest">Read More...</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showAddModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <NeuCard className="w-full max-w-md bg-white shadow-2xl space-y-6 animate-zoom-in max-h-[90vh] overflow-y-auto">
                        <div className="space-y-1">
                            <h3 className="font-black text-xl uppercase italic text-slate-900">Post Notice</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Broadcast to all residents</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 cursor-pointer">
                                    <input type="radio" name="type" checked={formData.type === 'event'} onChange={() => setFormData({...formData, type: 'event'})} className="accent-neu-accent" /> Event
                                </label>
                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 cursor-pointer">
                                    <input type="radio" name="type" checked={formData.type === 'announcement'} onChange={() => setFormData({...formData, type: 'announcement'})} className="accent-neu-accent" /> Announcement
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
                                <NeuInput value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Catchy title..." />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</label>
                                <NeuTextarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="What's happening?" className="!min-h-[100px]" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</label>
                                    <NeuInput type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</label>
                                    <NeuInput type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</label>
                                <NeuInput value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Hall" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</label>
                                <NeuSelect value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as 'low' | 'high'})}>
                                    <option value="low">Normal</option>
                                    <option value="high">High (Red Highlight)</option>
                                </NeuSelect>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <NeuButton onClick={() => setShowAddModal(false)} className="flex-1">Cancel</NeuButton>
                            <NeuButton variant="primary" onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                                {isSubmitting ? 'Posting...' : 'Post'}
                            </NeuButton>
                        </div>
                    </NeuCard>
                </div>,
                document.body
            )}
        </div>
    );
};

const Dashboard = ({ role, userDisplayName, onNavigate, images, currentUser, setViewingUser }: { role: UserRole, userDisplayName: string, onNavigate: (t: string) => void, images?: any, currentUser: User, setViewingUser: (u: User | null) => void }) => {
  const { users: allUsers } = useData();

  const amenities: { id: string, icon: any, label: string, color: string, badge?: string }[] = [
    { id: 'academia', icon: Icons.GraduationCap, label: 'Academia', color: 'bg-orange-100 text-[#FF6321]' },
    { id: 'points', icon: Icons.Trophy, label: 'Hall of Merit', color: 'bg-yellow-100 text-yellow-700' },
    { id: 'feedback', icon: Icons.Megaphone, label: 'Feedback', color: 'bg-purple-100 text-purple-600' },
    { id: 'anonymous_report', icon: Icons.ShieldAlert, label: 'Reports', color: 'bg-rose-100 text-rose-600' },
  ];

  if (isAdmin(role)) {
    amenities.push({ id: 'reports', icon: Icons.FileText, label: 'Reports', color: 'bg-indigo-100 text-indigo-600' });
  }
  
  if (role === 'super_admin') {
    amenities.push({ id: 'settings', icon: Icons.Settings, label: 'System', color: 'bg-cyan-100 text-cyan-600' });
  }

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=881337&color=fff&bold=true`;

  const housemates = useMemo(() => {
    return [...allUsers.filter(u => u.uid !== currentUser.uid && u.profileImageUrl)].sort(() => 0.5 - Math.random());
  }, [allUsers, currentUser.uid]);
  
  const unverifiedCount = useMemo(() => {
    return allUsers.filter(u => !u.verified).length;
  }, [allUsers]);

  const staffMembers = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');

  return (
    <div className="space-y-8 md:space-y-16 animate-fade-in pb-32 max-w-7xl mx-auto font-sans">
      <header className="flex justify-between items-center gap-4 mb-8 md:mb-12 animate-slide-down relative px-4 md:px-0 bg-white/50 backdrop-blur-md p-4 rounded-[2rem] border-2 border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div 
            onClick={() => onNavigate('profile')}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(255,99,33,1)] overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform"
          >
            <img 
              src={currentUser.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=f8fafc&color=0f172a&bold=true`} 
              alt={currentUser.displayName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none truncate">
              {userDisplayName?.toString() || 'Resident'}
            </h1>
            {currentUser.roomNumber && currentUser.roomNumber !== 'Unassigned' && (
              <p className="text-[8px] md:text-[10px] font-black text-[#FF6321] uppercase tracking-widest mt-0.5 italic">Node {currentUser.roomNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 animate-zoom-in shrink-0">
          <NotificationBell user={currentUser} />
          <div className="p-1 px-3 md:p-2 md:px-4 bg-slate-900 border-2 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(255,99,33,1)] flex items-center gap-2">
            <AnimatedPoints points={currentUser.points || 0} onClick={() => onNavigate('points')} />
          </div>
        </div>
      </header>

      <div className="flex overflow-x-auto gap-4 md:gap-6 pb-6 snap-x -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar stagger-children">
          <div 
            onClick={() => onNavigate('visitors')}
            className="min-w-[60%] md:min-w-[280px] h-[140px] md:h-[160px] rounded-3xl relative overflow-hidden shrink-0 snap-center border-4 border-slate-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer group transition-all duration-500 hover:translate-x-1 hover:translate-y-1 hover:shadow-none animate-slide-up bg-white"
          >
            <img 
               src={images?.visitors && !images.visitors.includes('test.com') ? images.visitors : "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=600"} 
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0" 
               alt="Visitors" 
               referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-4 md:p-6">
               <div className="bg-[#FF6321] text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mb-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  Access
               </div>
               <h3 className="text-xl md:text-2xl font-black text-white italic uppercase leading-none tracking-tighter">Guest Pass</h3>
            </div>
         </div>

         <div 
            onClick={() => onNavigate('maintenance')}
            className="min-w-[60%] md:min-w-[280px] h-[140px] md:h-[160px] rounded-3xl relative overflow-hidden shrink-0 snap-center border-4 border-slate-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer group transition-all duration-500 hover:translate-x-1 hover:translate-y-1 hover:shadow-none animate-slide-up bg-white"
         >
            <img 
               src={images?.maintenance && !images.maintenance.includes('test.com') ? images.maintenance : "https://images.unsplash.com/photo-1581092921461-eab62e97a782?auto=format&fit=crop&q=80&w=600"} 
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0" 
               alt="Maintenance" 
               referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-4 md:p-6">
               <div className="bg-[#00FF00] text-slate-900 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mb-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  Logistics
               </div>
               <h3 className="text-xl md:text-2xl font-black text-white italic uppercase leading-none tracking-tighter">Report Faults</h3>
            </div>
         </div>

         <div 
            onClick={() => onNavigate('bookings')}
            className="min-w-[60%] md:min-w-[280px] h-[140px] md:h-[160px] rounded-3xl relative overflow-hidden shrink-0 snap-center border-4 border-slate-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer group transition-all duration-500 hover:translate-x-1 hover:translate-y-1 hover:shadow-none animate-slide-up bg-white"
         >
            <img 
               src={images?.bookings && !images.bookings.includes('test.com') ? images.bookings : "https://images.unsplash.com/photo-1519167791981-d174ed53a83b?auto=format&fit=crop&q=80&w=600"} 
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale group-hover:grayscale-0" 
               alt="Venues" 
               referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-4 md:p-6">
               <div className="bg-cyan-400 text-slate-900 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mb-2 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  Facilities
               </div>
               <h3 className="text-xl md:text-2xl font-black text-white italic uppercase leading-none tracking-tighter">Book Venue</h3>
            </div>
         </div>
      </div>
      
      <div className="animate-slide-up space-y-6 px-4 md:px-0">
         <div className="flex justify-between items-end border-b-4 border-slate-900 pb-3">
            <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Other services</h2>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Utilities</span>
         </div>
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 stagger-children">
            {amenities.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => onNavigate(item.id)} 
                  className="flex flex-col justify-between p-3 md:p-4 bg-white border-4 border-slate-900 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer group transition-all duration-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                   <div className="flex justify-between items-start mb-3 md:mb-4">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${item.color} transition-transform group-hover:rotate-6`}>
                         <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div className="w-6 h-6 md:w-7 md:h-7 rounded-full border-2 border-slate-900 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Icons.ArrowRight className="w-3 md:w-3.5 h-3 md:h-3.5" />
                      </div>
                   </div>
                   <span className="text-[10px] md:text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">{item.label}</span>
                   {item.badge && (
                       <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                           {item.badge}
                       </span>
                   )}
                </div>
            ))}
         </div>
      </div>

      {housemates.length > 0 && (
        <>
          <div className="animate-slide-up space-y-6 px-4 md:px-0" style={{ animationDelay: '0.5s' }}>
            <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4">
              <div className="space-y-1">
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Discover Housemates</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Connect with fellow residents</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x pb-8 pt-2 stagger-children">
              {housemates.slice(0, 10).map((match) => {
                const avatar = match.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.displayName)}&background=881337&color=fff&bold=true`;
                return (
                <div 
                  key={match.uid} 
                  onClick={() => setViewingUser(match)}
                  className="w-[120px] md:w-[140px] h-[170px] md:h-[200px] rounded-3xl snap-start shrink-0 relative overflow-hidden border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group cursor-pointer animate-slide-up bg-white transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                >
                   <img src={avatar} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-50 group-hover:grayscale-0" alt={match.displayName} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
                  
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <h4 className="text-white font-black text-xs md:text-sm leading-tight uppercase italic tracking-tighter truncate">{match.displayName}</h4>
                    <p className="text-white/60 text-[7px] md:text-[8px] font-black mt-1 uppercase tracking-widest flex items-center gap-1">
                      <span className="truncate">{match.course || 'Resident'}</span>
                    </p>
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div className="px-4 md:px-0">
            <NoticeBoard role={role} />
          </div>

          {staffMembers.length > 0 && (
            <div className="animate-slide-up space-y-8 px-4 md:px-0" style={{ animationDelay: '0.6s' }}>
              <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">House Directory</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Official administration & staff</p>
                </div>
                <button onClick={() => onNavigate('academia')} className="text-[10px] font-black text-[#FF6321] uppercase tracking-widest hover:underline italic">Academic Tools</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
                {staffMembers.map((member) => {
                  const avatar = member.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName)}&background=0F172A&color=fff`;
                  return (
                  <div 
                    key={member.uid} 
                    onClick={() => setViewingUser(member)}
                    className="bg-white border-4 border-slate-900 rounded-[2rem] p-6 flex items-center gap-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-pointer animate-slide-up group"
                  >
                    <div className="relative w-16 h-16 rounded-2xl border-2 border-slate-900 overflow-hidden shrink-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:rotate-3 transition-transform">
                      <img src={avatar} alt={member.displayName} className="w-full h-full object-cover" />
                      {isOnline(member.lastSeen) && <div className="absolute bottom-1 right-1 w-3 h-3 bg-[#00FF00] rounded-full border-2 border-slate-900 z-10 animate-pulse"></div>}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-black text-lg text-slate-900 uppercase italic tracking-tighter leading-tight truncate">{member.displayName}</h4>
                        <p className="text-[10px] font-bold text-[#FF6321] uppercase tracking-[0.1em] mt-1 space-y-1 block truncate">
                        {(() => {
                            const name = member.displayName.toLowerCase();
                            if (name.includes('christen') || name.includes('christy')) return 'VICE CHAIR & FINANCE';
                            if (name.includes('asemi')) return 'EVENTS';
                            if (name.includes('wendy')) return 'STUDENT LIFE';
                            if (name.includes('liyabona')) return 'SOCIAL MEDIA';
                            if (name.includes('anganathi')) return 'HEAD DOOR MONITOR';
                            if (name.includes('colin')) return 'RES COORDINATOR';
                            if (name.includes('asana')) return 'SUSTAINABILITY';
                            if (name.includes('mandisa')) return 'MAINTENANCE';
                            if (name.includes('muktaar')) return 'VENUES & PARKING';
                            if (name.includes('nothando')) return 'aka PRIM';
                            if (name.includes('anokunda')) return 'SOFTWARE DEV';
                            return member.role.replace('_', ' ').toUpperCase();
                        })()}
                        </p>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const BottomNav = ({ activeTab, onTabChange, role }: { activeTab: string, onTabChange: (t: string) => void, role: UserRole }) => {
    const { microTasks } = useData();
    const openTasksCount = microTasks.filter(t => t.status === 'open').length;
    const navItems = [
        { id: 'dashboard', icon: Icons.Home, label: 'Home' },
        { id: 'micro_tasks', icon: Icons.Tool, label: 'Tasks', badge: openTasksCount > 0 ? openTasksCount : undefined },
        { id: 'academia', icon: Icons.BookOpen, label: 'Academia' },
        { id: 'profile', icon: Icons.Profile, label: 'Profile' }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pb-safe pt-2 px-4 z-50 animate-slide-up">
            <div className="flex justify-between items-center max-w-lg mx-auto h-16">
                {navItems.map(item => {
                    const isActive = activeTab === item.id || 
                                   (item.id === 'dashboard' && ['visitors', 'bookings', 'maintenance', 'roadmap', 'feedback', 'users', 'settings'].includes(activeTab));
                    return (
                        <button 
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`flex flex-col items-center justify-center flex-1 gap-1 transition-all duration-500 ${isActive ? 'text-neu-accent' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className="relative">
                                <item.icon className={`w-5 h-5 md:w-6 md:h-6 transition-all duration-500 ${isActive ? 'fill-neu-accent/10 stroke-[2.5px] scale-110' : ''}`} />
                                {(item as any).badge && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full">
                                        {(item as any).badge}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const Roadmap = () => {
  const features = [
    { id: 'market', title: 'Internal Shop', description: 'Peer-to-peer trading platform for residents. Buy and sell essentials securely.', status: 'Production', date: 'Q2 2024', color: 'bg-emerald-500' },
    { id: 'policy', title: 'Digital Constitution', description: 'Searchable database of house rules and administrative guidelines.', status: 'In Progress', date: 'Q2 2024', color: 'bg-indigo-500' },
    { id: 'calendar', title: 'Smart Calendar', description: 'Unified events and academic schedule synchronization.', status: 'Planned', date: 'Q3 2024', color: 'bg-emerald-500' }
  ];

  return (
    <div className="space-y-10 animate-fade-in max-w-4xl mx-auto pb-20">
       <div className="text-center space-y-4 mb-12 animate-slide-down">
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Portal Evolution</h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">The Future of Huis Russel Botman</p>
       </div>

       <div className="relative border-l-2 border-slate-200 ml-4 md:ml-10 space-y-12 pb-12 stagger-children">
          {features.map((item) => (
             <div key={item.id} className="relative pl-8 md:pl-12 animate-slide-up">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-transform hover:scale-150 duration-500 ${item.color}`}></div>
                <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between group transition-all duration-500 hover:translate-x-2">
                   <div className="space-y-2 max-w-lg">
                      <div className="flex items-center gap-3">
                         <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase italic leading-none group-hover:text-neu-accent transition-colors">{item.title}</h3>
                         <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase text-white animate-pulse ${item.color}`}>{item.status}</span>
                      </div>
                      <p className="text-slate-500 font-medium leading-relaxed">{item.description}</p>
                   </div>
                   <div className="text-right shrink-0">
                      <div className="text-2xl md:text-3xl font-black text-slate-200 uppercase italic tracking-tighter group-hover:text-slate-400 transition-colors duration-700">{item.date}</div>
                   </div>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

const AnonymousReport = ({ user, onSuccess }: { user: User, onSuccess: (msg: string) => void }) => {
    const [reportText, setReportText] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!reportText.trim()) return alert("Please enter your report details.");
        setIsSubmitting(true);
        try {
            await DataService.addAnonymousReport({
                description: reportText,
                date: new Date().toISOString(),
                status: 'new'
            }, imageFile || undefined);
            await DataService.awardPoints('feedback_report', 0.1);
            setReportText('');
            setImageFile(null);
            setImagePreview(null);
            onSuccess("Your anonymous report has been submitted securely.");
        } catch (e: any) {
            console.error(e);
            alert(`Failed to submit report: ${e.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <PageHeader title="Anonymous Report" subtitle="Safe & Confidential" />
            
            <NeuCard className="max-w-md mx-auto space-y-6 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Icons.Sparkles className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Live Feature</h3>
                        <p className="text-xs font-medium text-emerald-700 mt-0.5">Your report is submitted directly to the house administration for review.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <Icons.ShieldAlert className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest">100% Anonymous</h3>
                        <p className="text-xs font-medium text-rose-700 mt-0.5">Your identity is not recorded. Please provide as much detail as possible so we can address the issue effectively.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Report Details</label>
                    <textarea 
                        value={reportText}
                        onChange={e => setReportText(e.target.value)}
                        placeholder="Describe the issue, incident, or concern..."
                        className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-slate-700 font-medium outline-none focus:border-neu-accent focus:bg-white transition-all resize-none placeholder:text-slate-300"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Attach Image (Optional)</label>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-neu-accent hover:bg-slate-50 transition-all"
                    >
                        {imagePreview ? (
                            <div className="relative w-full">
                                <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                                <div 
                                    className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full hover:bg-rose-600"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setImageFile(null);
                                        setImagePreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                >
                                    <Icons.X className="w-4 h-4" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                    <Icons.Image className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-bold text-slate-600">Click to upload an image</p>
                                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                            </>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>
                </div>
                
                <NeuButton 
                    variant="primary" 
                    className="w-full justify-center !py-4"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !reportText.trim()}
                >
                    {isSubmitting ? 'Submitting Securely...' : 'Submit Anonymous Report'}
                </NeuButton>
            </NeuCard>
        </div>
    );
};

const FeedbackView = ({ user }: { user: User }) => {
    const { feedback: contextFeedbacks } = useData();
    const [view, setView] = useState<'submit' | 'list'>('submit');
    const [feedbackText, setFeedbackText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const feedbacks = useMemo(() => {
        if (isAdmin(user.role)) {
            return contextFeedbacks;
        }
        return [];
    }, [contextFeedbacks, user.role]);

    const handleSubmit = async () => {
        if (!feedbackText.trim()) return alert("Please enter your feedback.");
        setIsSubmitting(true);
        try {
            await DataService.submitFeedback({
                userId: user.uid,
                userName: user.displayName,
                text: feedbackText,
                date: new Date().toISOString(),
                status: 'new'
            });
            await DataService.awardPoints('feedback_report', 0.1);
            alert("Feedback submitted successfully. Thank you!");
            setFeedbackText('');
            if (isAdmin(user.role)) {
                setView('list');
            }
        } catch (e) {
            alert("Failed to submit feedback.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <PageHeader title="Feedback" subtitle="Speak to the House Committee" />
            
            {isAdmin(user.role) && (
                <div className="flex gap-3 mb-8">
                    <button onClick={() => setView('submit')} className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${view === 'submit' ? 'bg-slate-900 text-white' : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white'}`}>Submit</button>
                    <button onClick={() => setView('list')} className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${view === 'list' ? 'bg-slate-900 text-white' : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white'}`}>Review Forms</button>
                </div>
            )}

            {view === 'submit' && (
                <NeuCard className="max-w-md mx-auto space-y-6 bg-white/80 backdrop-blur-md">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Voice Matters</label>
                        <NeuTextarea 
                            placeholder="Share your thoughts, concerns, or ideas..." 
                            value={feedbackText} 
                            onChange={e => setFeedbackText(e.target.value)} 
                            className="!min-h-[150px]"
                        />
                    </div>
                    <NeuButton variant="primary" className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Sending...' : 'Submit Feedback'}
                    </NeuButton>
                </NeuCard>
            )}

            {view === 'list' && isAdmin(user.role) && (
                <div className="grid gap-4 stagger-children">
                    {feedbacks.map(f => (
                        <NeuCard key={f.id} className="border-l-4 border-l-purple-400 bg-white/80 backdrop-blur-md">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-lg font-black uppercase italic text-slate-900">{f.userName}</h4>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(f.date).toLocaleString()}</p>
                                </div>
                                <NeuBadge variant={f.status === 'new' ? 'warning' : 'success'}>{f.status}</NeuBadge>
                            </div>
                            <p className="text-sm text-slate-600">{f.text}</p>
                        </NeuCard>
                    ))}
                    {feedbacks.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest italic">No feedback received</div>}
                </div>
            )}
        </div>
    );
};

const Visitors = ({ role, user, logoUrl, onSuccess }: { role: UserRole, user: User, logoUrl?: string, onSuccess: (msg: string) => void }) => {
  const { visitors: contextVisitors, refreshVisitors } = useData();
  const [tab, setTab] = useState<'log' | 'signin' | 'monitor'>(isStaff(role) ? 'monitor' : 'log');
  const [formData, setFormData] = useState({ visitorName: '', visitorIdNumber: '' });
  const [verifyPin, setVerifyPin] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTick, setShowTick] = useState(false);

  const visitors = useMemo(() => {
    if (tab === 'monitor' && isStaff(role)) {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      return contextVisitors.filter(v => new Date(v.signInTime) >= fiveDaysAgo);
    }
    return contextVisitors.filter(v => v.hostId === user.uid);
  }, [contextVisitors, tab, role, user.uid]);

  const overdueVisitors = useMemo(() => {
    return visitors.filter(v => {
      if (v.violationResolved) return false;
      if (v.signOutTime || !v.entryTime) return false;
      return new Date() > new Date(v.expectedSignOutTime);
    });
  }, [visitors]);

  const handleSignIn = async () => {
     if (!formData.visitorName || !formData.visitorIdNumber) return alert("Incomplete data.");
     if (isSubmitting) return;
     setIsSubmitting(true);
     try {
        const now = new Date();
        const day = now.getDay(); // 0: Sunday, 1: Monday, ..., 5: Friday, 6: Saturday
        const expectedOut = new Date();
        
        // Friday (5) or Saturday (6) night
        if (day === 5 || day === 6) {
            expectedOut.setDate(expectedOut.getDate() + 1);
            expectedOut.setHours(2, 0, 0, 0);
        } else {
            expectedOut.setHours(23, 0, 0, 0);
        }

        const result = await DataService.signInVisitor({ 
            hostId: user.uid, 
            hostName: user.displayName,
            hostPhone: user.phoneNumber || '',
            hostRoomNumber: user.roomNumber || '',
            expectedSignOutTime: expectedOut.toISOString(),
            sleepoverStatus: 'none',
            nights: 0,
            visitorName: formData.visitorName,
            visitorIdNumber: formData.visitorIdNumber
        });
        if (result.success) { 
            setFormData({ visitorName: '', visitorIdNumber: '' }); 
            refreshVisitors();
            onSuccess(`Visitor ${formData.visitorName} authorized successfully. PIN: ${result.pin}`);
        } else { alert(result.message); }
     } catch (e) { alert("Error."); } finally { setIsSubmitting(false); }
  };

  const handleVerifyEntry = async () => {
    if (verifyPin.length !== 3) return alert("System requires 3-digit PIN.");
    const res = await DataService.verifyVisitorEntry(verifyPin, { uid: user.uid, name: user.displayName });
    if (res.success) { 
        setVerifyPin(''); 
        refreshVisitors();
        
        const action = res.type === 'entry' ? 'Signed In' : 'Signed Out';
        onSuccess(`Visitor ${action} successfully.`);
        
        // Play success sound
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          console.warn("Audio feedback failed", e);
        }

        // Show quick tick pop-up
        setShowTick(true);
        setTimeout(() => setShowTick(false), 2000);
        
        // We don't call onSuccess here to avoid the full-screen promotion modal
    } else {
        alert(res.message);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyData = visitors.filter(v => v.signInTime && new Date(v.signInTime) >= oneWeekAgo);
      const rows = weeklyData.map(v => {
        const isLate = v.signOutTime ? (new Date(v.signOutTime) > new Date(v.expectedSignOutTime)) : (v.entryTime && new Date() > new Date(v.expectedSignOutTime));
        return [ new Date(v.signInTime).toLocaleDateString(), v.hostName, v.visitorName, v.entryTime ? new Date(v.entryTime).toLocaleTimeString() : 'N/A', v.signOutTime ? new Date(v.signOutTime).toLocaleTimeString() : 'Active', isLate ? "LATE" : "OK" ];
      });
      await generateSmartReport({ title: "Weekly Gate Registry", subtitle: `Visitor Log Analysis: ${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`, columns: ["Date", "Host", "Visitor", "In", "Out", "Status"], rows: rows, rawDataForAI: weeklyData.map(v => ({...v, isLate: v.signOutTime ? (new Date(v.signOutTime) > new Date(v.expectedSignOutTime)) : (v.entryTime && new Date() > new Date(v.expectedSignOutTime))})), promptContext: "weekly visitor statistics", logoUrl: logoUrl });
      await DataService.awardPoints('system_report', 0.1);
    } catch (e) { alert("Failed."); } finally { setGeneratingReport(false); }
  };

  const handleResolveViolation = async (visitorId: string) => {
      await DataService.resolveViolation(visitorId);
      refreshVisitors();
  };

  const handleFlagHost = async (visitorId: string, hostId: string, hostName: string) => {
      const res = await DataService.incrementUserWarning(hostId);
      await DataService.resolveViolation(visitorId);
      refreshVisitors();
      if (res) {
          console.log(`Host flagged. Total warnings: ${res.warnings}. ${res.restricted ? 'Visitor rights have been revoked.' : ''}`);
      }
  };

  const handleSignOutVisitor = async (visitorId: string) => {
      const result = await DataService.signOutVisitor(visitorId);
      if (result.success) {
          refreshVisitors();
          onSuccess('Visitor signed out successfully.');
      } else {
          alert(result.message);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader 
        title="Guest Control" 
        subtitle="Gate Identity Management" 
        actions={isStaff(role) && (
            <NeuButton variant="glass" onClick={handleGenerateReport} disabled={generatingReport} className="!py-2 !px-4 !text-[10px]">
                {generatingReport ? 'Processing...' : 'Export Weekly Report'}
            </NeuButton>
        )} 
      />

      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar stagger-children">
        {[
            { id: 'log', label: 'My Guests' },
            { id: 'signin', label: 'New Authorization' },
            ...(isStaff(role) ? [{ id: 'monitor', label: 'Gate Monitor' }] : [])
        ].map(item => (
            <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className={`px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest whitespace-nowrap transition-all duration-500 shadow-sm animate-zoom-in
                    ${tab === item.id 
                        ? 'bg-slate-900 text-white shadow-lg scale-105 ring-4 ring-slate-900/10' 
                        : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white border border-white/60'}`}
            >
                {item.label}
            </button>
        ))}
      </div>

      {isStaff(role) && tab === 'monitor' && (
        <div className="space-y-6 animate-slide-up">
            <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-neu-accent/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-transform duration-1000 group-hover:scale-150"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1 space-y-1 text-center md:text-left">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gate Verification</h2>
                        <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Enter Visitor PIN to Sign In/Out</p>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            maxLength={3}
                            value={verifyPin}
                            onChange={e => setVerifyPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="000"
                            className="w-28 h-14 bg-white/10 border-2 border-white/20 rounded-xl text-center text-2xl font-black tracking-[0.2em] outline-none focus:border-neu-accent focus:bg-white focus:text-slate-900 transition-all placeholder:text-white/10"
                        />
                        <button 
                            onClick={handleVerifyEntry}
                            className="h-14 px-6 bg-neu-accent rounded-xl font-black uppercase italic tracking-widest hover:bg-white hover:text-neu-accent transition-all shadow-lg transform active:scale-90 text-sm"
                        >
                            Verify
                        </button>
                    </div>
                </div>
            </div>

            {overdueVisitors.length > 0 && (
                <div className="space-y-4 stagger-children">
                    <div className="flex items-center gap-3 text-rose-600 animate-slide-down">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></div>
                        <span className="font-black uppercase tracking-widest text-xs">Violations Detected ({overdueVisitors.length})</span>
                    </div>
                    {overdueVisitors.map(v => (
                         <div key={v.id} className="bg-white border-2 border-rose-100 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-all animate-slide-up">
                            <div>
                                <h3 className="text-lg font-black text-rose-900 uppercase italic leading-none">{v.visitorName}</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Host: {v.hostName} • {v.hostRoomNumber}</p>
                                <div className="mt-2 text-[10px] font-medium text-slate-500">
                                    <p><strong>Entered:</strong> {new Date(v.entryTime!).toLocaleString()}</p>
                                    <p className="text-rose-500"><strong>Deadline:</strong> {new Date(v.expectedSignOutTime).toLocaleString()}</p>
                                </div>
                            </div>
                             <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="flex items-center gap-4">
                                    <VisitorTimer entryTime={v.entryTime} expectedSignOutTime={v.expectedSignOutTime} signOutTime={v.signOutTime} />
                                    <button onClick={() => openWhatsApp(v.hostPhone, 'Visitor overdue. Please ensure your guest leaves the premises immediately.')} className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-all transform hover:scale-110 active:scale-90" title="Message Host">
                                        <Icons.Message className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex gap-2 w-full mt-2">
                                    <NeuButton variant="danger" className="!py-1.5 !px-3 !text-[9px] flex-1" onClick={() => handleFlagHost(v.id, v.hostId, v.hostName)}>
                                        <Icons.Flag className="w-3 h-3 mr-1 inline" /> Flag Host
                                    </NeuButton>
                                    <NeuButton variant="default" className="!py-1.5 !px-3 !text-[9px] flex-1" onClick={() => handleResolveViolation(v.id)}>
                                        <Icons.Check className="w-3 h-3 mr-1 inline" /> Resolve
                                    </NeuButton>
                                </div>
                             </div>
                         </div>
                    ))}
                </div>
            )}
        </div>
      )}

      <AnimatePresence>
        {showTick && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-black uppercase italic tracking-widest text-sm"
          >
            <Icons.Check className="w-6 h-6" />
            <span>Verified Successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === 'signin' && (
        <NeuCard className="max-w-md mx-auto space-y-8 animate-zoom-in border-slate-200 shadow-xl bg-white/80 backdrop-blur-md">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm animate-float">
                    <Icons.Plus className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Authorize Access</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generate a secure entry PIN</p>
                {user.visitorRestricted && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-bold animate-pulse">
                        Your visitor privileges have been revoked due to repeat violations. Please contact the House Committee.
                    </div>
                )}
             </div>

             <div className="space-y-5">
                <div className="space-y-2 animate-slide-up" style={{animationDelay: '0.1s'}}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Visitor Full Name</label>
                    <NeuInput 
                        placeholder="e.g. John Doe" 
                        value={formData.visitorName} 
                        onChange={e => setFormData({...formData, visitorName: e.target.value})} 
                        className="!bg-white !border-slate-100"
                        disabled={user.visitorRestricted}
                    />
                </div>
                <div className="space-y-2 animate-slide-up" style={{animationDelay: '0.2s'}}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ID / Student Number</label>
                    <NeuInput 
                        placeholder="e.g. 12345678" 
                        value={formData.visitorIdNumber} 
                        onChange={e => setFormData({...formData, visitorIdNumber: e.target.value})} 
                        className="!bg-white !border-slate-100"
                        disabled={user.visitorRestricted}
                    />
                </div>
                <NeuButton variant="primary" className="w-full h-16 shadow-lg mt-4 animate-slide-up" style={{animationDelay: '0.3s'}} onClick={handleSignIn} disabled={isSubmitting || user.visitorRestricted}>
                    {isSubmitting ? 'Generating PIN...' : 'Create Access PIN'}
                </NeuButton>
             </div>
        </NeuCard>
      )}

      {(tab === 'log' || tab === 'monitor') && (
        <div className="grid gap-4 stagger-children">
            {visitors.map(v => {
                const isActive = v.entryTime && !v.signOutTime;
                const isPending = !v.entryTime && !v.signOutTime;
                const isResolvedViolation = v.violationResolved;
                
                return (
                    <div key={v.id} className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-500 group animate-slide-up overflow-hidden relative">
                        {isActive && !isResolvedViolation && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 animate-pulse"></div>}
                        {isResolvedViolation && <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                            <div className="flex items-center gap-4 transition-transform group-hover:translate-x-1 duration-500">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-lg italic shadow-sm transition-all duration-500 group-hover:rotate-6
                                    ${isActive ? 'bg-emerald-100 text-emerald-600' : 
                                      isPending ? 'bg-amber-100 text-amber-600' : 
                                      'bg-slate-100 text-slate-400'}`}>
                                    {v.visitorName.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase italic leading-none group-hover:text-neu-accent transition-colors">{v.visitorName}</h3>
                                        {isPending && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-100 animate-zoom-in">PIN: {v.pin}</span>}
                                        {isActive && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100 animate-zoom-in">PIN: {v.pin}</span>}
                                        {isResolvedViolation && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">Resolved Violation</span>}
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {isStaff(role) ? `Host: ${v.hostName} • Unit ${v.hostRoomNumber}` : new Date(v.signInTime).toLocaleDateString()}
                                    </div>
                                    {v.entryVerifiedByName && (
                                        <div className="text-[9px] font-black text-neu-accent uppercase tracking-widest mt-2 flex items-center gap-1.5 opacity-60">
                                            <Icons.Check className="w-2.5 h-2.5" />
                                            Entry Authorized by {v.entryVerifiedByName}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                                <div className="text-right">
                                    <VisitorTimer entryTime={v.entryTime} expectedSignOutTime={v.expectedSignOutTime} signOutTime={v.signOutTime} />
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider mt-0.5 space-y-0.5">
                                        <div>{v.entryTime ? `In: ${new Date(v.entryTime).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}` : 'Not yet arrived'}</div>
                                        {v.signOutTime && <div>Out: {new Date(v.signOutTime).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    {isActive && isStaff(role) && (
                                        <button 
                                            onClick={() => handleSignOutVisitor(v.id)}
                                            className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-rose-100"
                                        >
                                            Sign Out
                                        </button>
                                    )}
                                    <div className={`w-3.5 h-3.5 rounded-full transition-all duration-1000 ${isActive ? 'bg-emerald-500 animate-pulse shadow-lg shadow-emerald-200' : isPending ? 'bg-amber-400' : 'bg-slate-200'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {visitors.length === 0 && (
                <div className="text-center py-20 opacity-50 animate-fade-in">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-float">
                        <Icons.Visitors className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

const TicketCard: React.FC<{ booking: Booking }> = ({ booking }) => (
  <div className="relative bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-slate-200 flex flex-col md:flex-row min-h-[160px] group transition-all duration-500 hover:shadow-xl hover:-translate-y-1 animate-slide-up">
      <div className={`w-full md:w-3 transition-all duration-700 group-hover:w-4 bg-gradient-to-b ${booking.status === 'Granted' ? 'from-emerald-400 to-emerald-600' : booking.status === 'Denied' ? 'from-rose-400 to-rose-600' : 'from-amber-400 to-amber-600'}`}></div>
      <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-2xl font-black uppercase italic text-slate-900 leading-none group-hover:text-neu-accent transition-colors">{booking.venue}</h4>
                      {booking.isExternal && <NeuBadge variant="warning">External</NeuBadge>}
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{new Date(booking.date).toDateString()}</span>
              </div>
              <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border transition-all duration-500 group-hover:scale-110 ${booking.status === 'Granted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : booking.status === 'Denied' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{booking.status}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs text-slate-600 font-medium mt-2">
              <div><span className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Time</span>{booking.startTime} - {booking.endTime}</div>
              <div><span className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Booked By</span><span className="truncate block pr-2">{booking.bookerName}</span></div>
              <div><span className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Guests</span>{booking.attendeeCount || 'N/A'}</div>
              <div className="col-span-2"><span className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Objective</span><span className="italic group-hover:text-slate-900 transition-colors line-clamp-2">"{booking.purpose}"</span></div>
          </div>
      </div>
  </div>
);

const Bookings = ({ role, user, onSuccess }: { role: UserRole, user: User, onSuccess: (msg: string) => void }) => {
  const { bookings: contextBookings } = useData();
  const [selectedVenue, setSelectedVenue] = useState<string>('Hall');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string, start: string, end: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Booking>>({ purpose: '', attendeeCount: 10, equipmentNeeds: '', donationOffer: '', externalVisitors: 0 });
  const venues = ['Hall', 'Braai Area', 'Boardroom'];

  const bookings = useMemo(() => {
    return contextBookings.filter(b => b.venue === selectedVenue);
  }, [contextBookings, selectedVenue]);

  const getSlots = (venue: string) => {
      if (venue === 'Boardroom') {
          return [
              { label: 'Morning (08:00 - 12:00)', start: '08:00', end: '12:00' }, 
              { label: 'Afternoon (12:15 - 16:15)', start: '12:15', end: '16:15' }, 
              { label: 'Early Evening (16:30 - 19:45)', start: '16:30', end: '19:45' },
              { label: 'Late Evening (20:00 - 21:00)', start: '20:00', end: '21:00' }
          ];
      }
      return [
          { label: 'Morning (08:00 - 12:00)', start: '08:00', end: '12:00' }, 
          { label: 'Afternoon (12:15 - 16:15)', start: '12:15', end: '16:15' }, 
          { label: 'Evening (16:30 - 20:30)', start: '16:30', end: '20:30' }
      ];
  };
  
  const calendarDays = useMemo(() => { 
      const days = []; 
      const today = new Date(); 
      for (let i = 0; i < 14; i++) { 
          const d = new Date(today); 
          d.setDate(today.getDate() + i); 
          days.push(d.toISOString().split('T')[0]); 
      } 
      return days; 
  }, []);

  const getSlotStatus = (date: string, start: string) => { 
      if (selectedVenue === 'Boardroom' && start === '20:00') {
          const dateObj = new Date(date);
          if (dateObj.getDay() === 1) { // Monday
              return { status: 'taken', booking: { bookedBy: 'system', purpose: 'Forum Members Meeting', status: 'Granted' } as any };
          }
      }
      const existing = bookings.find(b => b.venue === selectedVenue && b.date === date && b.startTime === start && b.status !== 'Denied'); 
      if (existing) return { status: 'taken', booking: existing }; 
      const slotDateTime = new Date(`${date}T${start}`); 
      const now = new Date(); 
      const diffHours = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60); 
      if (diffHours < 24) return { status: 'closed', booking: null }; 
      return { status: 'open', booking: null }; 
  };

  const handleSlotClick = (date: string, slot: {label: string, start: string, end: string}) => { 
      const { status } = getSlotStatus(date, slot.start); 
      if (status !== 'open') return; 
      setSelectedSlot({ date, time: slot.label, start: slot.start, end: slot.end }); 
      setFormData({ purpose: '', attendeeCount: 10, equipmentNeeds: '', donationOffer: '', externalVisitors: 0 }); 
      setShowBookingModal(true); 
  };

  const handleSubmit = async () => { 
      if(!formData.purpose) return alert("Mission required."); 
      if(!selectedSlot) return; 
      if(isSubmitting) return; 
      setIsSubmitting(true); 
      
      const currentMonth = new Date().getMonth(); 
      const myMonthlyBookings = bookings.filter(b => { 
          const d = new Date(b.date); 
          return b.bookedBy === user.uid && d.getMonth() === currentMonth && b.status !== 'Denied'; 
      }); 
      
      if (myMonthlyBookings.length >= 3) { 
          alert("Quota Reached: You are limited to 3 venue bookings per month."); 
          setIsSubmitting(false); 
          return; 
      } 
      
      try { 
          await DataService.addBooking({ 
              venue: selectedVenue, 
              date: selectedSlot.date, 
              startTime: selectedSlot.start, 
              endTime: selectedSlot.end, 
              isExternal: false, 
              purpose: formData.purpose!, 
              attendeeCount: formData.attendeeCount, 
              externalVisitors: formData.externalVisitors, 
              equipmentNeeds: formData.equipmentNeeds, 
              donationOffer: formData.donationOffer, 
              bookedBy: user.uid, 
              bookerName: user.displayName, 
              bookerEmail: user.email, 
              status: 'Reviewing', 
              contactPhone: user.phoneNumber || '' 
          }); 

          // Send Email Notification
          const settings = await DataService.getAppSettings();
          if (settings?.bookingEmail) {
              try {
                  const res = await fetch('/api/notify-booking', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          to: settings.bookingEmail,
                          venue: selectedVenue,
                          date: selectedSlot.date,
                          startTime: selectedSlot.start,
                          endTime: selectedSlot.end,
                          bookerName: user.displayName,
                          purpose: formData.purpose
                      })
                  });
                  
                  if (res && !res.ok) {
                      const errData = await res.json().catch(() => null);
                      const errMsg = errData?.error?.message || errData?.error || await res.text();
                      console.error("Failed to send booking email notification:", errMsg);
                      alert(`Booking submitted, but email failed: ${errMsg}. If using the default Resend API key, you can only send emails to the verified account email.`);
                  }
              } catch (e) {
                  console.error("Failed to send booking email notification", e);
                  alert("Booking submitted, but email failed due to a network error.");
              }
          } else {
              console.warn("No booking email configured in settings.");
              alert("Booking submitted, but no notification email was sent because the Booking Email is not configured in the Administration Settings.");
          }

          setShowBookingModal(false); 
          if (settings?.bookingEmail) {
              onSuccess(`Booking request submitted for review. Notification sent to ${settings.bookingEmail}`); 
          } else {
              onSuccess("Booking request submitted for review."); 
          }
      } catch (e) { 
          alert("Booking failed."); 
      } finally { 
          setIsSubmitting(false); 
      } 
  };
  
  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader title="Venue Logistics" subtitle="Facility Calendar & Reservation" />
      
      {isAdmin(role) && (
          <div className="mb-12 animate-slide-up">
             <div className="flex items-center gap-3 mb-6"><div className="h-px bg-slate-200 flex-1"></div><h3 className="font-black text-lg uppercase italic text-slate-800 tracking-wider">Administration Queue</h3><div className="h-px bg-slate-200 flex-1"></div></div>
             <div className="grid gap-6 stagger-children">
                {bookings.filter(b => b.status === 'Reviewing').map(b => (
                    <NeuCard key={b.id} className="p-6 border-l-[6px] border-l-amber-400 bg-amber-50/30 transition-all hover:bg-white hover:shadow-lg">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="space-y-2 text-sm w-full md:w-2/3">
                                <div className="flex items-center gap-3 mb-2">
                                   <div className="font-black text-xl uppercase italic">{b.venue}</div>
                                   {b.isExternal && <NeuBadge variant="warning">External Guest</NeuBadge>}
                                </div>
                                <div className="text-slate-500 font-bold">{b.date} • {b.startTime} - {b.endTime}</div>
                                <div className="font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200 mt-2 shadow-sm">
                                   <span className="block text-[9px] text-slate-400 uppercase tracking-widest mb-1">Requester Info</span>
                                   {b.bookerName} 
                                   {b.isExternal && <span className="font-normal text-slate-500 block mt-0.5">{b.contactPhone || 'No Phone'} • {b.bookerEmail}</span>}
                                </div>
                                <div className="italic text-slate-600 mt-3 p-3 bg-slate-50 rounded-xl">"{b.purpose}"</div>
                                {b.isExternal && b.guestIdUrl && (
                                   <a href={b.guestIdUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-neu-accent/10 text-neu-accent rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-neu-accent/20 transition-colors">
                                       <Icons.Download className="w-3.5 h-3.5" /> View Uploaded ID Document
                                   </a>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 shrink-0">
                                <NeuButton variant="primary" className="!py-2.5 !px-6" onClick={async () => { 
                                    await DataService.updateBookingStatus(b.id, 'Granted', { uid: user.uid, name: user.displayName }); 
                                    
                                    // Notify the booker
                                    if (b.bookerEmail) {
                                      try {
                                        const res = await fetch('/api/notify-status-update', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            to: b.bookerEmail,
                                            type: 'booking',
                                            status: 'Granted',
                                            title: `${b.venue} on ${b.date}`,
                                            details: `Your booking request for ${b.venue} on ${b.date} (${b.startTime} - ${b.endTime}) has been GRANTED.`
                                          })
                                        });
                                        if (res && !res.ok) {
                                            const errData = await res.json().catch(() => null);
                                            const errMsg = errData?.error?.message || errData?.error || await res.text();
                                            console.error("Failed to send booking status update email:", errMsg);
                                            alert(`Status updated, but email notification failed: ${errMsg}. If using a default Resend key, you can only send to the verified account email.`);
                                        }
                                      } catch (e) {
                                        console.error("Failed to send booking status update email", e);
                                      }
                                    }
                                    
                                    openWhatsApp(b.contactPhone, `Your booking for ${b.venue} on ${b.date} has been GRANTED.`); 
                                }}>Approve</NeuButton>
                                <NeuButton variant="danger" className="!py-2.5 !px-6" onClick={async () => { 
                                    await DataService.updateBookingStatus(b.id, 'Denied', { uid: user.uid, name: user.displayName }); 
                                    
                                    // Notify the booker
                                    if (b.bookerEmail) {
                                      try {
                                        const res = await fetch('/api/notify-status-update', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            to: b.bookerEmail,
                                            type: 'booking',
                                            status: 'Denied',
                                            title: `${b.venue} on ${b.date}`,
                                            details: `Your booking request for ${b.venue} on ${b.date} (${b.startTime} - ${b.endTime}) has been DENIED.`
                                          })
                                        });
                                        if (res && !res.ok) {
                                            const errData = await res.json().catch(() => null);
                                            const errMsg = errData?.error?.message || errData?.error || await res.text();
                                            console.error("Failed to send booking status update email:", errMsg);
                                            alert(`Status updated, but email notification failed: ${errMsg}. If using a default Resend key, you can only send to the verified account email.`);
                                        }
                                      } catch (e) {
                                        console.error("Failed to send booking status update email", e);
                                      }
                                    }
                                    
                                    openWhatsApp(b.contactPhone, `Your booking for ${b.venue} on ${b.date} has been DENIED.`); 
                                }}>Deny</NeuButton>
                            </div>
                        </div>
                    </NeuCard>
                ))}
                {bookings.filter(b => b.status === 'Reviewing').length === 0 && (
                    <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-200 rounded-[2rem]">No pending requests</div>
                )}
             </div>
          </div>
      )}
      
      <div className="flex gap-2 overflow-x-auto pb-2 stagger-children hide-scrollbar"> {venues.map(v => ( <button key={v} onClick={() => setSelectedVenue(v)} className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest whitespace-nowrap transition-all duration-500 animate-zoom-in ${selectedVenue === v ? 'bg-neu-accent text-white shadow-lg ring-4 ring-neu-accent/10' : 'bg-white/70 backdrop-blur-md text-slate-500 hover:bg-white border border-white/60'}`} > {v} </button> ))} </div>
      <div className="space-y-6 stagger-children"> {calendarDays.map(date => { const dateObj = new Date(date); return ( <div key={date} className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm transition-all duration-500 hover:shadow-md animate-slide-up group"> <div className="flex flex-col md:flex-row gap-6 items-start md:items-center"> <div className="w-32 shrink-0 group-hover:translate-x-1 transition-transform"> <div className="font-black text-2xl text-slate-900 uppercase italic leading-none group-hover:text-neu-accent transition-colors">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div> <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div> </div> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full"> {getSlots(selectedVenue).map(slot => { const { status, booking } = getSlotStatus(date, slot.start); let btnStyle = "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 cursor-pointer"; let label = "OPEN"; if (status === 'taken') { btnStyle = "bg-rose-50 text-rose-400 border-rose-100 cursor-not-allowed opacity-60"; label = "RESERVED"; } else if (status === 'closed') { btnStyle = "bg-slate-50/50 text-slate-400 border-slate-200 cursor-not-allowed"; label = "CLOSED"; } if (status === 'taken' && booking?.bookedBy === user.uid) { btnStyle = "bg-neu-accent text-white border-neu-accent shadow-brand"; label = "MY BOOKING"; } return ( <div key={slot.start} onClick={() => handleSlotClick(date, slot)} className={`px-4 py-4 rounded-2xl border flex flex-row md:flex-col items-center justify-between md:justify-center text-center transition-all duration-300 shadow-sm hover:scale-[1.03] active:scale-95 ${btnStyle}`} > <span className="text-xs font-black uppercase tracking-widest">{slot.label}</span> <span className="text-[9px] font-bold opacity-80 bg-white/20 px-2 py-0.5 rounded transition-transform group-hover:scale-110">{label}</span> </div> ); })} </div> </div> </div> ); })} </div>
      
      {showBookingModal && selectedSlot && ( <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"> <NeuCard className="w-full max-w-md bg-white shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-zoom-in"> <div className="space-y-1"> <h3 className="font-black text-xl uppercase italic text-slate-900">Confirm Reservation</h3> <div className="text-xs font-bold text-neu-accent uppercase tracking-widest animate-pulse">{selectedVenue} • {selectedSlot.date} • {selectedSlot.time}</div> </div> <div className="space-y-4"> <div className="space-y-2"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Purpose</label> <NeuTextarea className="!min-h-[80px]" value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="Describe your event..." /> </div> <div className="grid grid-cols-2 gap-4"> <div className="space-y-2"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Attendees</label> <NeuInput type="number" value={formData.attendeeCount} onChange={e => setFormData({...formData, attendeeCount: parseInt(e.target.value)})} /> </div> <div className="space-y-2"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">External Visitors</label> <NeuInput type="number" value={formData.externalVisitors} onChange={e => setFormData({...formData, externalVisitors: parseInt(e.target.value)})} /> </div> </div> <div className="space-y-2"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pantry Donation</label> <NeuInput value={formData.donationOffer} onChange={e => setFormData({...formData, donationOffer: e.target.value})} placeholder="Optional" /> </div> <div className="space-y-2"> <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipment Needed</label> <NeuInput value={formData.equipmentNeeds} onChange={e => setFormData({...formData, equipmentNeeds: e.target.value})} placeholder="Optional" /> </div> </div> <div className="flex gap-4 pt-4"> <NeuButton onClick={() => setShowBookingModal(false)} className="flex-1">Cancel</NeuButton> <NeuButton variant="primary" onClick={handleSubmit} className="flex-1" disabled={isSubmitting}> {isSubmitting ? 'Processing...' : 'Confirm Booking'} </NeuButton> </div> </NeuCard> </div> )}
      
      <div className="space-y-6 pt-12 border-t border-slate-200 animate-slide-up"> 
          <h3 className="font-black text-xl uppercase italic text-slate-800">My Reservations</h3> 
          <div className="grid gap-6 stagger-children"> 
              {bookings.filter(b => b.bookedBy === user.uid).map(b => ( 
                  <TicketCard key={b.id} booking={b} /> 
              ))} 
              {bookings.filter(b => b.bookedBy === user.uid).length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-200 rounded-[2rem]">No upcoming reservations</div>
              )}
          </div> 
      </div>

      {isAdmin(role) && (
          <div className="space-y-6 pt-12 border-t border-slate-200 animate-slide-up mt-12"> 
              <div className="flex items-center gap-3 mb-6">
                  <h3 className="font-black text-xl uppercase italic text-slate-800 tracking-wider">System Booking Log</h3>
              </div>
              <div className="grid gap-6 stagger-children"> 
                  {bookings.filter(b => b.status !== 'Reviewing').map(b => ( 
                      <TicketCard key={b.id} booking={b} /> 
                  ))} 
                  {bookings.filter(b => b.status !== 'Reviewing').length === 0 && (
                      <div className="text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-200 rounded-[2rem]">No historical records</div>
                  )}
              </div> 
          </div>
      )}
    </div>
  );
};

export const ICE_BREAKER_QUESTIONS = [
    "What's your most controversial food opinion?",
    "If you could instantly master one skill, what would it be?",
    "What's the best piece of advice you've ever received?",
    "What's your go-to karaoke song?",
    "If you had to eat one meal for the rest of your life, what would it be?",
    "What's a movie you can practically quote from start to finish?",
    "If you could travel anywhere in the world right now, where would you go?",
    "What's your favorite hidden gem in the city?",
    "What's the weirdest habit you have?",
    "If you were a superhero, what would your mildly inconvenient power be?",
    "What's your favorite way to spend a lazy Sunday?",
    "What's a book or podcast that completely changed your perspective?",
    "If you could have dinner with any historical figure, who would it be?",
    "What's the most spontaneous thing you've ever done?",
    "What's your favorite childhood memory?"
];

const Profile = ({ user, onUpdate, logoUrl }: { user: User, onUpdate: () => void, logoUrl?: string }) => {
    const initialFormState = useMemo(() => ({
        displayName: user.displayName || '', 
        roomNumber: user.roomNumber || '', 
        phoneNumber: user.phoneNumber || '', 
        section: user.section || '', 
        course: user.course || '',
        bio: user.bio || '',
        plansForNextYear: user.plansForNextYear || '',
        linkedinUrl: user.linkedinUrl || '',
        instagramUrl: user.instagramUrl || '',
        interests: user.interests?.join(', ') || '',
        gender: user.gender || '',
        iceBreakerQuestion: user.iceBreakerQuestion || '',
        isServiceProvider: user.isServiceProvider || false,
        serviceType: user.serviceType || '',
        businessDescription: user.businessDescription || ''
    }), [user]);

    const [initialData, setInitialData] = useState(initialFormState);
    const [formData, setFormData] = useState(initialFormState);
    const [isSaving, setIsSaving] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    useEffect(() => {
        setInitialData(initialFormState);
        setFormData(initialFormState);
    }, [initialFormState]);

    const completion = getProfileCompletion(user);
    const isDirty = JSON.stringify(initialData) !== JSON.stringify(formData) || avatarFile !== null;

    const handleSave = async () => { 
        setIsSaving(true);
        try {
            const interestsArr = (formData.interests || '').split(',').map(i => i.trim()).filter(i => i); 
            
            let finalAvatarUrl = user.profileImageUrl || '';
            if (avatarFile) {
                const url = await DataService.uploadImage(avatarFile, `avatars/${user.uid}_${Date.now()}`);
                if (url) finalAvatarUrl = url;
            }

            const { interests: _, ...restFormData } = formData;

            const updatedUser = {
                ...user,
                ...restFormData,
                interests: interestsArr,
                profileImageUrl: finalAvatarUrl
            };

            await DataService.updateUserProfile(user.uid, { 
                ...restFormData, 
                interests: interestsArr,
                profileImageUrl: finalAvatarUrl 
            });
            
            if (!user.profileImageUrl && finalAvatarUrl) {
                await DataService.awardPoints('profile_picture', 0.5);
            }
            if (getProfileCompletion(user) < 100 && getProfileCompletion(updatedUser as any) === 100) {
                await DataService.awardPoints('profile_completion', 1.0);
            }
            
            alert("Profile updated successfully!");
            setInitialData({...formData});
            setAvatarFile(null);
            onUpdate(); 
        } catch (e: any) {
            console.error(e);
            alert(`Failed to save profile: ${e.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const userAvatar = user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=881337&color=fff&bold=true`;

    return (
        <div className="space-y-8 md:space-y-12 animate-fade-in pb-20">
            <PageHeader title="Identity Metric" subtitle="Digital Resident Token" actions={<button onClick={() => AuthService.logout()} className="flex items-center px-6 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all transform active:scale-95 font-black text-[10px] uppercase tracking-[0.25em] italic border border-transparent hover:border-rose-100"><Icons.Logout /><span className="ml-3">Logout</span></button>} />
            
            <NeuCard className="mb-8 animate-fade-in bg-white/60 backdrop-blur-md">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h3 className="font-black italic text-lg text-slate-800 leading-none">Profile Completion</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Identity Metric Progress</p>
                    </div>
                    <span className="text-2xl font-black italic text-neu-accent">{completion}%</span>
                </div>
                <div className="w-full bg-white/50 rounded-full h-3 border border-white shadow-inner overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-400 to-neu-accent h-full rounded-full transition-all duration-1000" style={{width: `${completion}%`}}></div>
                </div>
            </NeuCard>

            <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-start stagger-children">
                <div className="w-full max-w-[540px] mx-auto group animate-slide-up">
                    <div className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden border-8 border-white p-8 text-white flex flex-col justify-between transition-all duration-700 hover:shadow-neu-accent/30 min-h-[auto] hover:-rotate-1 active:scale-95">
                        <div className="absolute inset-0 opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity duration-700">
                            <img src={userAvatar} className="w-full h-full object-cover blur-xl" />
                        </div>
                        
                        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-neu-accent/40 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px] pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
                        
                        <div className="relative z-10 flex flex-row justify-between items-start gap-4 mb-8"> 
                            <div className="flex items-center gap-4"> 
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white p-1 overflow-hidden shadow-lg shrink-0 transition-transform duration-500 group-hover:rotate-12"> 
                                    <img src={userAvatar} className="w-full h-full object-cover rounded-xl" /> 
                                </div> 
                                <div className="space-y-1"> 
                                    <div className="font-black text-base md:text-lg tracking-tight uppercase italic leading-none transition-all group-hover:text-neu-accent duration-500">Huis Russel Botman</div> 
                                    <div className="text-[9px] uppercase tracking-[0.3em] opacity-50 font-black italic">Stellenbosch Node</div> 
                                </div> 
                            </div> 
                        </div>
                        <div className="relative z-10 space-y-2 mb-8"> 
                            <div className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-[0.9] break-words transition-all duration-500 group-hover:translate-x-1">{user.displayName}</div> 
                            <div className="text-[10px] font-bold opacity-40 tracking-[0.2em] uppercase italic break-all">{user.email}</div> 
                        </div>
                        <div className="relative z-10 border-t border-white/10 pt-6 flex flex-wrap gap-x-8 gap-y-4 items-end justify-between"> 
                            <div className="flex gap-8 md:gap-12"> 
                                <div className="space-y-1"> 
                                    <div className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] italic">Unit</div> 
                                    <div className="text-3xl md:text-4xl font-black italic text-neu-accent leading-none tracking-tighter transition-all group-hover:scale-110 duration-700">{user.roomNumber || '---'}</div> 
                                </div> 
                                <div className="space-y-1"> 
                                    <div className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] italic">Section</div> 
                                    <div className="text-3xl md:text-4xl font-black italic text-white/90 leading-none tracking-tighter uppercase">{user.section || '---'}</div> 
                                </div> 
                            </div> 
                            <RoleBadge role={user.role} /> 
                        </div>
                    </div>
                </div>
                <NeuCard className="p-8 md:p-12 space-y-8 border-slate-200 shadow-xl transition-all duration-500 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.2s'}}>
                    <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em] italic">Record Protocol</h3>
                        {isDirty && (
                            <NeuButton onClick={handleSave} variant="primary" disabled={isSaving} className="!py-2 !px-4 transform hover:scale-105">
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </NeuButton>
                        )}
                    </div>
                    <div className="space-y-6 stagger-children">
                        
                        <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex items-center gap-4 group hover:border-neu-accent/40 transition-colors animate-slide-up">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                <img src={avatarFile ? URL.createObjectURL(avatarFile) : userAvatar} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Update Avatar</label>
                                <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} className="text-[10px] w-full" />
                            </div>
                        </div>

                        <div className="space-y-2 animate-slide-up">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                             <NeuInput 
                                value={formData.displayName}
                                onChange={e => setFormData({...formData, displayName: e.target.value})}
                             />
                        </div>

                        <div className="space-y-2 animate-slide-up">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Short Bio</label>
                            <NeuTextarea 
                                value={formData.bio}
                                onChange={e => setFormData({...formData, bio: e.target.value})}
                                placeholder="Tell the res a bit about yourself..."
                                className="!min-h-[80px]"
                            />
                        </div>

                        <div className="space-y-2 animate-slide-up">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Plans for next year</label>
                            <NeuTextarea 
                                value={formData.plansForNextYear}
                                onChange={e => setFormData({...formData, plansForNextYear: e.target.value})}
                                placeholder="What are your plans for next year?"
                                className="!min-h-[80px]"
                            />
                        </div>

                        <div className="space-y-2 animate-slide-up">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Plans for next year</label>
                            <NeuTextarea 
                                value={formData.plansForNextYear}
                                onChange={e => setFormData({...formData, plansForNextYear: e.target.value})}
                                placeholder="What are your plans for next year?"
                                className="!min-h-[80px]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Room No.</label>
                                <NeuInput 
                                    value={formData.roomNumber}
                                    onChange={e => setFormData({...formData, roomNumber: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Section</label>
                                <NeuInput 
                                    value={formData.section}
                                    onChange={e => setFormData({...formData, section: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Course of Study</label>
                                <NeuInput 
                                    value={formData.course}
                                    onChange={e => setFormData({...formData, course: e.target.value})}
                                    placeholder="e.g. BSc Computer Science"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mobile Contact</label>
                                <NeuInput 
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                                <NeuSelect 
                                    value={formData.gender}
                                    onChange={e => setFormData({...formData, gender: e.target.value})}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </NeuSelect>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 animate-slide-up">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Instagram URL</label>
                                <NeuInput value={formData.instagramUrl} onChange={e => setFormData({...formData, instagramUrl: e.target.value})} placeholder="https://instagram.com/..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">LinkedIn URL</label>
                                <NeuInput value={formData.linkedinUrl} onChange={e => setFormData({...formData, linkedinUrl: e.target.value})} placeholder="https://linkedin.com/in/..." />
                            </div>
                        </div>

                        <div className="space-y-2 animate-slide-up">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ice Breaker Question</label>
                            <NeuSelect 
                                value={formData.iceBreakerQuestion}
                                onChange={e => setFormData({...formData, iceBreakerQuestion: e.target.value})}
                            >
                                <option value="">Select a question to display on your profile</option>
                                {ICE_BREAKER_QUESTIONS.map((q, i) => (
                                    <option key={i} value={q}>{q}</option>
                                ))}
                            </NeuSelect>
                            <p className="text-[10px] text-slate-400 font-medium ml-1">Let others answer this when they visit your profile.</p>
                        </div>

                        <div className="space-y-2 animate-slide-up">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Interests</label>
                             <NeuInput 
                                value={formData.interests}
                                onChange={e => setFormData({...formData, interests: e.target.value})}
                                placeholder="e.g. Hiking, Coding, Music"
                             />
                        </div>
                    </div>
                </NeuCard>

                <NeuCard className="p-8 md:p-12 space-y-8 border-slate-200 shadow-xl transition-all duration-500 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.3s'}}>
                    <div className="flex justify-between items-center pb-6 border-b border-slate-100">
                        <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.4em] italic">Service Provider Settings</h3>
                    </div>
                    <div className="space-y-6 stagger-children">
                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-2xl bg-slate-50 animate-slide-up">
                            <div>
                                <h4 className="font-black text-sm text-slate-800">Become a Provider</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Join our network of local experts</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.isServiceProvider} onChange={e => setFormData({...formData, isServiceProvider: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neu-accent"></div>
                            </label>
                        </div>

                        {formData.isServiceProvider && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Service Type (Max 10 chars)</label>
                                    <NeuInput 
                                        placeholder="e.g. Plumbing, Tutor, Hair" 
                                        value={formData.serviceType} 
                                        onChange={e => setFormData({...formData, serviceType: e.target.value.slice(0, 10)})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Business Description</label>
                                    <NeuTextarea 
                                        placeholder="Tell us about your services..." 
                                        value={formData.businessDescription} 
                                        onChange={e => setFormData({...formData, businessDescription: e.target.value})} 
                                        className="!min-h-[80px]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </NeuCard>
            </div>

            <div className="pt-12 border-t border-slate-200">
                <NeuCard className="bg-white/60 backdrop-blur-md border-slate-200 shadow-sm animate-slide-up">
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                        <div className="w-24 h-24 rounded-[1.5rem] bg-neu-accent flex items-center justify-center shrink-0 shadow-lg rotate-3">
                            <span className="text-white font-black text-3xl italic">AT</span>
                        </div>
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black uppercase italic text-slate-900 tracking-tight">Project Credits</h3>
                                <p className="text-slate-500 font-medium leading-relaxed">This ecosystem was engineered by <span className="text-neu-accent font-black">Mudzielwana Anokunda</span> of <span className="font-black text-slate-700">AusinTech</span>.</p>
                                <p className="text-slate-500 font-medium leading-relaxed">The app is the vision of <span className="text-neu-accent font-black">Nothando Ndlovu</span>, Chairperson.</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <a href="https://anokunda-mudzielwana-portfolio-420496593510.us-west1.run.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest hover:border-neu-accent hover:text-neu-accent transition-all transform active:scale-95 shadow-sm">
                                    <Icons.Globe className="w-4 h-4" /> Portfolio
                                </a>
                                <a href="https://www.linkedin.com/in/anokunda-mudzielwana-342881198?utm_source=share_via&utm_content=profile&utm_medium=member_ios" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest hover:border-neu-accent hover:text-neu-accent transition-all transform active:scale-95 shadow-sm">
                                    <Icons.LinkedIn className="w-4 h-4" /> LinkedIn
                                </a>
                                <a href="https://www.instagram.com/theriseofano?igsh=eGRnYXN4OWhyNmNi&utm_source=qr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest hover:border-neu-accent hover:text-neu-accent transition-all transform active:scale-95 shadow-sm">
                                    <Icons.Instagram className="w-4 h-4" /> Instagram
                                </a>
                            </div>
                        </div>
                    </div>
                </NeuCard>
            </div>
        </div>
    );
};

// --- GUEST BOOKING COMPONENT ---

const GuestBooking = ({ onBack }: { onBack: () => void }) => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<string>('Hall');
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string, start: string, end: string} | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [idFile, setIdFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        purpose: '',
        attendeeCount: 10,
        equipmentNeeds: ''
    });

    const venues = ['Hall', 'Braai Area', 'Boardroom'];
    const getSlots = (venue: string) => {
        if (venue === 'Boardroom') {
            return [
                { label: 'Morning (08:00 - 12:00)', start: '08:00', end: '12:00' }, 
                { label: 'Afternoon (12:15 - 16:15)', start: '12:15', end: '16:15' }, 
                { label: 'Early Evening (16:30 - 19:45)', start: '16:30', end: '19:45' },
                { label: 'Late Evening (20:00 - 21:00)', start: '20:00', end: '21:00' }
            ];
        }
        return [
            { label: 'Morning (08:00 - 12:00)', start: '08:00', end: '12:00' }, 
            { label: 'Afternoon (12:15 - 16:15)', start: '12:15', end: '16:15' }, 
            { label: 'Evening (16:30 - 20:30)', start: '16:30', end: '20:30' }
        ];
    };

    useEffect(() => {
        DataService.getBookings().then(setBookings);
    }, []);

    const calendarDays = useMemo(() => { 
        const days = []; 
        const today = new Date(); 
        for (let i = 0; i < 14; i++) { 
            const d = new Date(today); 
            d.setDate(today.getDate() + i); 
            days.push(d.toISOString().split('T')[0]); 
        } 
        return days; 
    }, []);

    const getSlotStatus = (date: string, start: string) => { 
        if (selectedVenue === 'Boardroom' && start === '20:00') {
            const dateObj = new Date(date);
            if (dateObj.getDay() === 1) { // Monday
                return { status: 'taken', booking: { bookedBy: 'system', purpose: 'Forum Members Meeting', status: 'Granted' } as any };
            }
        }
        const existing = bookings.find(b => b.venue === selectedVenue && b.date === date && b.startTime === start && b.status !== 'Denied'); 
        if (existing) return { status: 'taken', booking: existing }; 
        const slotDateTime = new Date(`${date}T${start}`); 
        const now = new Date(); 
        const diffHours = (slotDateTime.getTime() - now.getTime()) / (1000 * 60 * 60); 
        if (diffHours < 24) return { status: 'closed', booking: null }; 
        return { status: 'open', booking: null }; 
    };

    const handleSlotClick = (date: string, slot: {label: string, start: string, end: string}) => { 
        const { status } = getSlotStatus(date, slot.start); 
        if (status !== 'open') return; 
        setSelectedSlot({ date, time: slot.label, start: slot.start, end: slot.end }); 
        setShowBookingModal(true); 
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.phone || !formData.purpose) {
            return alert("Please complete all required fields.");
        }
        if (!selectedSlot) return;
        
        setIsSubmitting(true);
        try {
            let idUrl = '';
            if (idFile) {
                const url = await DataService.uploadImage(idFile, `guest_ids/${Date.now()}_${idFile.name}`);
                if (url) idUrl = url;
            }

            await DataService.addBooking({
                venue: selectedVenue,
                date: selectedSlot.date,
                startTime: selectedSlot.start,
                endTime: selectedSlot.end,
                isExternal: true,
                purpose: formData.purpose,
                attendeeCount: formData.attendeeCount,
                equipmentNeeds: formData.equipmentNeeds,
                bookerName: formData.name,
                bookerEmail: formData.email,
                contactPhone: formData.phone,
                guestIdUrl: idUrl,
                status: 'Reviewing',
                bookedBy: 'EXTERNAL_GUEST'
            });

            // Send Email Notification
            const settings = await DataService.getAppSettings();
            if (settings?.bookingEmail) {
                try {
                    const res = await fetch('/api/notify-booking', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: settings.bookingEmail,
                            venue: selectedVenue,
                            date: selectedSlot.date,
                            startTime: selectedSlot.start,
                            endTime: selectedSlot.end,
                            bookerName: formData.name + ' (External Guest)',
                            purpose: formData.purpose
                        })
                    });
                    
                    if (res && !res.ok) {
                        const errData = await res.json().catch(() => null);
                        const errMsg = errData?.error?.message || errData?.error || await res.text();
                        console.error("Failed to send booking email notification:", errMsg);
                        alert(`Booking submitted, but email failed: ${errMsg}. If using the default Resend API key, you can only send emails to the verified account email.`);
                    }
                } catch (e) {
                    console.error("Failed to send booking email notification", e);
                    alert("Booking submitted, but email failed due to a network error.");
                }
            } else {
                console.warn("No booking email configured in settings.");
                alert("Booking submitted, but no notification email was sent because the Booking Email is not configured in the Administration Settings.");
            }

            setShowBookingModal(false);
            setSubmitted(true);
        } catch (error) {
            console.error(error);
            alert("Submission failed. Please try again later.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in">
                <NeuCard className="max-w-md w-full text-center space-y-8 p-12 bg-white/80 backdrop-blur-md">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl animate-float">
                        <Icons.Check className="w-10 h-10" />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Request Sent</h2>
                        <p className="text-slate-500 font-medium">Your inquiry has been logged. The House Committee will review your request and contact you via email or phone.</p>
                    </div>
                    <NeuButton variant="primary" className="w-full h-16" onClick={onBack}>Return Home</NeuButton>
                </NeuCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
                <PageHeader 
                    title="Venue Hire" 
                    subtitle="Public Reservation Portal" 
                    actions={<NeuButton onClick={onBack} variant="ghost" className="bg-white/50 backdrop-blur-md hover:bg-white">← Back to Login</NeuButton>} 
                />

                <div className="flex gap-2 overflow-x-auto pb-2 stagger-children hide-scrollbar">
                    {venues.map(v => (
                        <button 
                            key={v} 
                            onClick={() => setSelectedVenue(v)} 
                            className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest whitespace-nowrap transition-all duration-500 animate-zoom-in ${selectedVenue === v ? 'bg-neu-accent text-white shadow-lg ring-4 ring-neu-accent/10' : 'bg-white/70 backdrop-blur-md text-slate-500 hover:bg-white border border-white/60'}`}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                <div className="space-y-6 stagger-children">
                    {calendarDays.map(date => {
                        const dateObj = new Date(date);
                        return (
                            <div key={date} className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-sm transition-all duration-500 hover:shadow-md animate-slide-up group">
                                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                    <div className="w-32 shrink-0 group-hover:translate-x-1 transition-transform">
                                        <div className="font-black text-2xl text-slate-900 uppercase italic leading-none group-hover:text-neu-accent transition-colors">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                                        {getSlots(selectedVenue).map(slot => {
                                            const { status } = getSlotStatus(date, slot.start);
                                            let btnStyle = "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 cursor-pointer";
                                            let label = "OPEN";
                                            if (status === 'taken') {
                                                btnStyle = "bg-rose-50 text-rose-400 border-rose-100 cursor-not-allowed opacity-60";
                                                label = "RESERVED";
                                            } else if (status === 'closed') {
                                                btnStyle = "bg-slate-50/50 text-slate-400 border-slate-200 cursor-not-allowed";
                                                label = "CLOSED";
                                            }
                                            return (
                                                <div 
                                                    key={slot.start} 
                                                    onClick={() => handleSlotClick(date, slot)} 
                                                    className={`px-4 py-4 rounded-2xl border flex flex-row md:flex-col items-center justify-between md:justify-center text-center transition-all duration-300 shadow-sm hover:scale-[1.03] active:scale-95 ${btnStyle}`}
                                                >
                                                    <span className="text-xs font-black uppercase tracking-widest">{slot.label}</span>
                                                    <span className="text-[9px] font-bold opacity-80 bg-white/20 px-2 py-0.5 rounded transition-transform group-hover:scale-110">{label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {showBookingModal && selectedSlot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <NeuCard className="w-full max-w-md bg-white shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-zoom-in">
                        <div className="space-y-1">
                            <h3 className="font-black text-xl uppercase italic text-slate-900">Confirm Reservation</h3>
                            <div className="text-xs font-bold text-neu-accent uppercase tracking-widest animate-pulse">{selectedVenue} • {selectedSlot.date} • {selectedSlot.time}</div>
                        </div>

                        {isSubmitting ? (
                            <div className="py-12 flex flex-col items-center">
                                <Loader />
                                <p className="mt-8 text-slate-400 font-black uppercase tracking-widest text-[10px] animate-pulse">Uploading Credentials...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                                        <NeuInput value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Jane Smith" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                                        <NeuInput value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+27..." />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                                    <NeuInput type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="jane@example.com" />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Purpose</label>
                                    <NeuTextarea className="!min-h-[60px]" value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="Describe your event..." />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendees</label>
                                        <NeuInput type="number" value={formData.attendeeCount} onChange={e => setFormData({...formData, attendeeCount: parseInt(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipment Needed</label>
                                        <NeuInput value={formData.equipmentNeeds} onChange={e => setFormData({...formData, equipmentNeeds: e.target.value})} placeholder="Optional" />
                                    </div>
                                </div>

                                <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center text-center gap-2 group hover:border-neu-accent/40 transition-colors">
                                    <Icons.Download className="w-6 h-6 text-slate-300 group-hover:text-neu-accent transition-colors" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">ID Verification</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">Upload a clear photo of your ID or Driver's License</p>
                                    </div>
                                    <input type="file" accept="image/*" onChange={e => setIdFile(e.target.files?.[0] || null)} className="text-[10px] w-full max-w-xs mt-2" />
                                </div>
                                
                                <div className="flex gap-4 pt-4">
                                    <NeuButton onClick={() => setShowBookingModal(false)} className="flex-1">Cancel</NeuButton>
                                    <NeuButton variant="primary" onClick={handleSubmit} className="flex-1">
                                        Submit Inquiry
                                    </NeuButton>
                                </div>
                            </div>
                        )}
                    </NeuCard>
                </div>
            )}
        </div>
    );
};

 const Maintenance = ({ role, user, logoUrl, onSuccess }: { role: UserRole, user: User, logoUrl?: string, onSuccess: (msg: string) => void }) => {
  const { maintenanceRequests: contextRequests } = useData();
  const [tab, setTab] = useState<'log' | 'report'>('log');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'electrical' | 'plumbing' | 'furniture' | 'other'>('all');
  const [formData, setFormData] = useState({ type: 'other' as any, description: '', location: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const requests = useMemo(() => {
    let filtered = contextRequests;
    if (!(isAdmin(role) || role === 'maintenance_admin')) {
      filtered = filtered.filter(r => r.reporterId === user.uid);
    }
    
    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
    if (categoryFilter !== 'all') filtered = filtered.filter(r => r.type === categoryFilter);
    
    return filtered;
  }, [contextRequests, role, user.uid, statusFilter, categoryFilter]);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const allRequests = await DataService.getMaintenanceRequests();
      
      // Filter for last 2 months
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const filteredRequests = allRequests.filter(r => new Date(r.date) >= twoMonthsAgo);

      const rows = filteredRequests.map(r => [
        r.type.toUpperCase(),
        r.location,
        r.status.replace('_', ' ').toUpperCase(),
        new Date(r.date).toLocaleDateString(),
        r.reporterName || 'Resident'
      ]);

      await generateSmartReport({
        title: "Maintenance Infrastructure Report (2-Month Frame)",
        subtitle: `Comprehensive Fault Analysis from ${twoMonthsAgo.toLocaleDateString()} to ${new Date().toLocaleDateString()}`,
        columns: ["CATEGORY", "LOCATION", "STATUS", "DATE REPORTED", "REPORTER"],
        rows: rows,
        rawDataForAI: filteredRequests,
        promptContext: "maintenance issues, infrastructure faults, and resolution statuses from the last two months",
        preparedBy: "Colin",
        recipient: "Stellenbosch University Facilities Management",
        logoUrl: logoUrl || "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&q=80&w=200"
      });
      await DataService.awardPoints('system_report', 0.1);
      onSuccess("Maintenance report generated and downloaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to generate report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReport = async () => {
    if(!formData.description || !formData.location) return alert("Incomplete report.");
    setIsSubmitting(true);
    try {
        let imageUrl = '';
        if (imageFile) {
            imageUrl = await DataService.uploadImage(imageFile, `maintenance/${Date.now()}_${imageFile.name}`) || '';
        }

        await DataService.addMaintenanceRequest({
            ...formData,
            status: 'open',
            reportedBy: user.uid,
            reporterName: user.displayName,
            reporterPhone: user.phoneNumber,
            date: new Date().toISOString(),
            imageUrl
        });

        // Send Email Notification
        const settings = await DataService.getAppSettings();
        if (settings?.maintenanceEmail) {
            try {
                const res = await fetch('/api/notify-maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: settings.maintenanceEmail,
                        issue: formData.description,
                        location: formData.location,
                        reporterName: user.displayName,
                        imageUrl
                    })
                });
                
                if (res && !res.ok) {
                    const errData = await res.json().catch(() => null);
                    const errMsg = errData?.error?.message || errData?.error || await res.text();
                    console.error("Failed to send maintenance email notification:", errMsg);
                    alert(`Maintenance logged, but email failed: ${errMsg}. If using the default Resend API key, you can only send emails to the verified account email.`);
                }
            } catch (e) {
                console.error("Failed to send maintenance email notification", e);
                alert("Maintenance logged, but email failed due to a network error.");
            }
        } else {
            console.warn("No maintenance email configured in settings.");
            alert("Maintenance logged, but no notification email was sent because the Maintenance Email is not configured in the Administration Settings.");
        }

        setTab('log');
        if (settings?.maintenanceEmail) {
            onSuccess(`Maintenance request logged successfully. Notification sent to ${settings.maintenanceEmail}`);
        } else {
            onSuccess("Maintenance request logged successfully.");
        }
    } catch (e) {
        alert("Failed to submit report.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const statusMatch = statusFilter === 'all' || req.status === statusFilter;
    const categoryMatch = categoryFilter === 'all' || req.type === categoryFilter;
    return statusMatch && categoryMatch;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <PageHeader title="Maintenance" subtitle="Infrastructure & Faults" />
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setTab('log')} className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${tab === 'log' ? 'bg-slate-900 text-white' : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white'}`}>History</button>
        <button onClick={() => setTab('report')} className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${tab === 'report' ? 'bg-slate-900 text-white' : 'bg-white/60 backdrop-blur-md text-slate-500 hover:bg-white'}`}>Report Fault</button>
        {(isAdmin(role) || role === 'maintenance_admin') && (
          <button 
            onClick={handleGenerateReport} 
            disabled={isGeneratingReport}
            className="px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isGeneratingReport ? <Icons.Bot className="animate-spin w-4 h-4" /> : <Icons.FileText className="w-4 h-4" />}
            {isGeneratingReport ? 'Analyzing...' : 'AI Maintenance Report'}
          </button>
        )}
      </div>

      {tab === 'log' && (
        <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-2xl">
          <div className="flex-1 min-w-[150px]">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Status</label>
            <NeuSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </NeuSelect>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Category</label>
            <NeuSelect value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as any)}>
              <option value="all">All Categories</option>
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="furniture">Furniture</option>
              <option value="other">Other</option>
            </NeuSelect>
          </div>
        </div>
      )}

      {tab === 'report' ? (
        <NeuCard className="max-w-md mx-auto space-y-6 bg-white/80 backdrop-blur-md">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Issue Category</label>
            <NeuSelect value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="furniture">Furniture</option>
                <option value="other">Other</option>
            </NeuSelect>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
            <NeuInput placeholder="e.g. Room 304, Section B Bathroom" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fault Description</label>
            <NeuTextarea placeholder="Please describe the issue in detail..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Attach Photo (Optional)</label>
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center text-center gap-2 group hover:border-neu-accent/40 transition-colors">
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => setImageFile(e.target.files?.[0] || null)} 
                    className="hidden" 
                    id="maintenance-photo" 
                />
                <label htmlFor="maintenance-photo" className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-neu-accent transition-colors">
                        <Icons.Plus />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{imageFile ? imageFile.name : 'Click to upload image'}</span>
                </label>
            </div>
          </div>
          <NeuButton variant="primary" className="w-full" onClick={handleReport} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit fault report'}
          </NeuButton>
        </NeuCard>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map(req => (
            <NeuCard key={req.id} className="border-l-4 border-l-slate-200 bg-white/80 backdrop-blur-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-black uppercase italic text-slate-900">{req.type}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{req.location} • {new Date(req.date).toLocaleDateString()}</p>
                </div>
                <NeuBadge variant={req.status === 'resolved' ? 'success' : req.status === 'in_progress' ? 'warning' : 'danger'}>{req.status.replace('_', ' ')}</NeuBadge>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {req.imageUrl && (
                    <div className="w-full md:w-32 h-32 rounded-2xl overflow-hidden shrink-0 border border-slate-100 shadow-sm">
                        <img src={req.imageUrl} alt="Fault" className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{req.description}</p>
                  
                  {req.adminNotes && req.adminNotes.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Updates</h5>
                      {req.adminNotes.map((note, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-xs text-slate-700 font-medium">{note.note}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">— {note.adminName} • {new Date(note.timestamp).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(isAdmin(role) || role === 'maintenance_admin') && (
                <div className="space-y-4 border-t border-slate-100 pt-6">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add a progress note..." 
                      className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-neu-accent/20 outline-none"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          const note = e.currentTarget.value.trim();
                          e.currentTarget.value = '';
                          await DataService.addMaintenanceNote(req.id, note, { uid: user.uid, name: user.displayName });
                        }
                      }}
                    />
                  </div>
                  {req.status !== 'resolved' && (
                    <div className="flex gap-2">
                        <NeuButton variant="default" className="flex-1 !py-2 !text-[10px]" onClick={async () => { 
                            await DataService.updateMaintenanceStatus(req.id, 'in_progress'); 
                            
                            // Notify the reporter
                            try {
                                const reporter = await DataService.getUser(req.reportedBy);
                                if (reporter?.email) {
                                    const res = await fetch('/api/notify-status-update', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            to: reporter.email,
                                            type: 'maintenance',
                                            status: 'in_progress',
                                            title: req.description,
                                            details: `Your maintenance request for ${req.description} at ${req.location} has been updated to IN PROGRESS.`
                                        })
                                    });
                                    if (res && !res.ok) {
                                        const errData = await res.json().catch(() => null);
                                        const errMsg = errData?.error?.message || errData?.error || await res.text();
                                        console.error("Failed to send maintenance status update email:", errMsg);
                                        alert(`Status updated, but email notification failed: ${errMsg}. If using a default Resend key, you can only send to the verified account email.`);
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to send maintenance status update email", e);
                            }
                        }}>Set In Progress</NeuButton>
                        <NeuButton variant="primary" className="flex-1 !py-2 !text-[10px]" onClick={async () => { 
                            await DataService.updateMaintenanceStatus(req.id, 'resolved', {uid: user.uid, name: user.displayName}); 
                            
                            // Notify the reporter
                            try {
                                const reporter = await DataService.getUser(req.reportedBy);
                                if (reporter?.email) {
                                    const res = await fetch('/api/notify-status-update', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            to: reporter.email,
                                            type: 'maintenance',
                                            status: 'resolved',
                                            title: req.description,
                                            details: `Your maintenance request for ${req.description} at ${req.location} has been RESOLVED.`
                                        })
                                    });
                                    if (res && !res.ok) {
                                        const errData = await res.json().catch(() => null);
                                        const errMsg = errData?.error?.message || errData?.error || await res.text();
                                        console.error("Failed to send maintenance status update email:", errMsg);
                                        alert(`Status updated, but email notification failed: ${errMsg}. If using a default Resend key, you can only send to the verified account email.`);
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to send maintenance status update email", e);
                            }
                        }}>Mark Resolved</NeuButton>
                    </div>
                  )}
                </div>
              )}
            </NeuCard>
          ))}
          {filteredRequests.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest italic">No matching faults</div>}
        </div>
      )}
    </div>
  );
};

const EmailModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      alert("Please fill in both subject and message.");
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          subject,
          text: message
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to send email");
      }
      
      alert("Email sent successfully!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error sending email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <NeuCard className="w-full max-w-md bg-white shadow-2xl flex flex-col p-0 overflow-hidden animate-zoom-in border-0">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tight">Send Email</h3>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">To: {user.displayName} ({user.email})</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors"><Icons.X /></button>
        </div>
        
        <div className="p-6 space-y-4 bg-slate-50">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subject</label>
            <NeuInput value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email Subject" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Message</label>
            <NeuTextarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message here..." className="!min-h-[120px]" />
          </div>
        </div>
        
        <div className="p-4 bg-white border-t border-slate-100 flex gap-4 shrink-0">
          <NeuButton variant="ghost" onClick={onClose} className="flex-1 !py-3">Cancel</NeuButton>
          <NeuButton variant="primary" onClick={handleSend} className="flex-1 !py-3" disabled={isSending}>
            {isSending ? 'Sending...' : 'Send Email'}
          </NeuButton>
        </div>
      </NeuCard>
    </div>
  );
};

const UsersList = ({ currentUser }: { currentUser: User }) => {
    const { users } = useData();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [emailUser, setEmailUser] = useState<User | null>(null);
    
    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        if (!isAdmin(currentUser.role)) return;
        await DataService.updateUserRole(uid, newRole);
    };

    const filtered = users.filter(u => {
        const matchesSearch = u.displayName.toLowerCase().includes(search.toLowerCase()) || 
                             u.email.toLowerCase().includes(search.toLowerCase()) || 
                             (u.roomNumber && u.roomNumber.toLowerCase().includes(search.toLowerCase()));
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const roles: UserRole[] = ['general', 'door_monitor', 'maintenance_admin', 'admin', 'super_admin'];

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <PageHeader title="Identity Registry" subtitle="Resident Management Protocol" />
            
            <div className="flex flex-col md:flex-row gap-4 stagger-children">
                <div className="flex-1">
                    <NeuInput placeholder="Search name, email or room..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="w-full md:w-64">
                    <NeuSelect value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
                        <option value="all">All Roles</option>
                        {roles.map(r => (
                            <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>
                        ))}
                    </NeuSelect>
                </div>
            </div>

            <div className="grid gap-4 stagger-children">
                {filtered.map(u => (
                    <NeuCard key={u.uid} className="flex flex-col md:flex-row justify-between md:items-center gap-4 animate-slide-up border-l-8 border-l-slate-100 hover:border-l-neu-accent bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black italic text-xl shrink-0 overflow-hidden">
                                {u.profileImageUrl ? <img src={u.profileImageUrl} className="w-full h-full object-cover" /> : u.displayName.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-black uppercase italic text-slate-900 leading-tight">{u.displayName}</h4>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{u.email} • Unit {u.roomNumber || '---'}</div>
                                {(u.warningCount || 0) > 0 && (
                                    <span className="inline-block mt-2 bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[9px] font-bold border border-rose-200">
                                        {u.visitorRestricted ? `Visitor Rights Revoked (${u.warningCount} Warnings)` : `${u.warningCount} Visitor Policy Flag${u.warningCount > 1 ? 's' : ''}`}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4 justify-between md:justify-end">
                            {isAdmin(currentUser.role) && currentUser.uid !== u.uid ? (
                                <NeuSelect 
                                    className="!h-10 !py-1 !px-3 !text-[10px] !font-black !w-40" 
                                    value={u.role} 
                                    onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                >
                                    {roles.map(r => (
                                        <option key={r} value={r}>{r.toUpperCase()}</option>
                                    ))}
                                </NeuSelect>
                            ) : (
                                <RoleBadge role={u.role} />
                            )}
                            {isAdmin(currentUser.role) && currentUser.uid !== u.uid && (
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setEmailUser(u)}
                                        className="p-2 rounded-xl transition-all bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:scale-110 active:scale-95"
                                        title="Send Email"
                                    >
                                        <Icons.Mail className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={async () => { await DataService.updateUserRestriction(u.uid, !u.visitorRestricted); }}
                                        className={`p-2 rounded-xl transition-all ${u.visitorRestricted ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'} hover:scale-110 active:scale-95`}
                                        title={u.visitorRestricted ? "Restore Rights" : "Revoke Rights"}
                                    >
                                        <Icons.Key className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </NeuCard>
                ))}
            </div>
            {filtered.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase italic tracking-widest animate-pulse">No matches found</div>}
            
            {emailUser && (
                <EmailModal user={emailUser} onClose={() => setEmailUser(null)} />
            )}
        </div>
    );
};

const ReportsPage = ({ role, user, logoUrl, onSuccess }: { role: UserRole, user: User, logoUrl?: string, onSuccess: (msg: string) => void }) => {
  const { stats: contextStats, feedback: contextFeedbacks, anonymousReports: contextAnonymousReports } = useData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const stats = contextStats;
  const feedbacks = contextFeedbacks;
  const anonymousReports = contextAnonymousReports;

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    try {
      const newStats = await DataService.recalculateStats();
      if (newStats) {
        onSuccess("Statistics successfully synchronized with database records.");
      }
    } catch (e) {
      console.error("Failed to recalculate stats", e);
    } finally {
      setIsRecalculating(false);
    }
  };
  
  const handleGenerateFullReport = async () => {
    setIsGenerating(true);
    try {
      let chartImage = undefined;
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        chartImage = canvas.toDataURL('image/png');
      }

      const stats = await DataService.getGlobalStats();
      const totalUsers = stats.users || 0;
      const totalVisitors = stats.visitors || 0;
      const totalMaintenance = stats.maintenance || 0;
      const totalBookings = stats.bookings || 0;
      const totalFeedback = stats.feedback || 0;
      const totalPosts = stats.posts || 0;

      // Hardcoded values from user screenshot request
      const totalAppReads = 15240; 
      const totalAppWrites = 4890;

      const totalServiceRequests = totalMaintenance + totalBookings;

      const users = await DataService.getAllUsers();
      const activeUsers = users.filter(u => u.lastSeen && new Date(u.lastSeen) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
      
      const visitors = await DataService.getVisitors();
      const activeVisitors = visitors.filter(v => v.entryTime && !v.signOutTime).length;
      
      const maintenance = await DataService.getMaintenanceRequests();
      const openMaintenance = maintenance.filter(m => m.status === 'open' || m.status === 'in_progress').length;
      
      const bookings = await DataService.getBookings();
      const pendingBookings = bookings.filter(b => b.status === 'Reviewing').length;
      const totalPendingRequests = openMaintenance + pendingBookings;
      
      const rows = [
        ["System", "Total App Reads", totalAppReads.toLocaleString()],
        ["System", "Total App Writes", totalAppWrites.toLocaleString()],
        ["Users", "Total Registered", totalUsers.toString()],
        ["Users", "Active (7 days)", activeUsers.toString()],
        ["Visitors", "Total Logged", totalVisitors.toString()],
        ["Visitors", "Currently Signed In", activeVisitors.toString()],
        ["Services", "Total Service Requests", totalServiceRequests.toString()],
        ["Services", "Pending Review/Action", totalPendingRequests.toString()],
        ["Feedback", "Total Submissions", totalFeedback.toString()],
        ["Social", "Total Posts", totalPosts.toString()]
      ];
      
      const rawDataForAI = [
        { metric: "Total App Reads", value: totalAppReads },
        { metric: "Total App Writes", value: totalAppWrites },
        { metric: "Total Users", value: totalUsers },
        { metric: "Active Users (7 days)", value: activeUsers },
        { metric: "Total Visitors", value: totalVisitors },
        { metric: "Currently Signed In Visitors", value: activeVisitors },
        { metric: "Total Service Requests", value: totalServiceRequests },
        { metric: "Pending Service Requests", value: totalPendingRequests },
        { metric: "Total Feedback Submissions", value: totalFeedback },
        { metric: "Total Social Posts", value: totalPosts }
      ];

      await generateSmartReport({
        title: "Comprehensive System Usage Report",
        subtitle: `Integrated Application Metrics as of ${new Date().toLocaleDateString()}`,
        columns: ["CATEGORY", "METRIC", "VALUE"],
        rows: rows,
        rawDataForAI: rawDataForAI,
        promptContext: "overall application usage, engagement metrics, and system activity across all features",
        preparedBy: user.displayName,
        recipient: "House Committee & Administration",
        logoUrl: logoUrl,
        chartImage: chartImage
      });
      await DataService.awardPoints('system_report', 0.1);
      onSuccess("Comprehensive report generated and downloaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAdmin(role)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
        <Icons.Key className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Access Denied</h2>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Administrator privileges required.</p>
      </div>
    );
  }

  const chartData = stats ? [
    { name: 'App Reads', value: 15240 },
    { name: 'App Writes', value: 4890 },
    { name: 'Service Req', value: (stats.maintenance || 0) + (stats.bookings || 0) },
    { name: 'WA Clicks', value: stats.whatsappClicks || 0 }
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="System Reports" 
        subtitle="Integrated Analytics & Usage Data" 
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <NeuCard className="p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-black text-slate-900">15.2k</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total App Reads</div>
        </NeuCard>
        <NeuCard className="p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-black text-slate-900">4.9k</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total App Writes</div>
        </NeuCard>
        <NeuCard className="p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-black text-slate-900">{stats ? (stats.maintenance || 0) + (stats.bookings || 0) : '-'}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Service Requests</div>
        </NeuCard>
        <NeuCard className="p-6 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-black text-emerald-600">{stats ? stats.whatsappClicks || 0 : '-'}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Market WA Clicks</div>
        </NeuCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeuCard className="p-6 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight mb-6">Usage Overview</h3>
          <div className="flex-1 min-h-[300px] w-full bg-white rounded-xl p-4 border border-slate-100" ref={chartRef}>
            {stats ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="value" fill="#881337" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="loader"></span>
              </div>
            )}
          </div>
        </NeuCard>

        <NeuCard className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-2">
            <Icons.FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Comprehensive Usage Report</h3>
          <p className="text-sm font-medium text-slate-500">Generate a complete overview of all system activity, including users, visitors, maintenance, and bookings. This report will include the charts shown above.</p>
          <NeuButton 
            variant="primary" 
            onClick={handleGenerateFullReport} 
            disabled={isGenerating || !stats}
            className="w-full mt-4"
          >
            {isGenerating ? 'Compiling Data...' : 'Generate PDF Report'}
          </NeuButton>

          <NeuButton 
            variant="ghost" 
            onClick={handleRecalculateStats} 
            disabled={isRecalculating || !stats}
            className="w-full mt-2 !text-[10px] !py-2"
          >
            {isRecalculating ? 'Synchronizing...' : 'Recalculate Global Stats'}
          </NeuButton>
        </NeuCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <NeuCard className="p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Icons.Megaphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Recent Feedback</h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
            {feedbacks.length > 0 ? feedbacks.map((fb, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">{new Date(fb.date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase text-white ${fb.type === 'bug' ? 'bg-rose-500' : fb.type === 'feature' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                      {fb.type}
                    </span>
                    <button 
                      onClick={async () => {
                        if (window.confirm("Delete this feedback?")) {
                          await DataService.deleteFeedback(fb.id);
                        }
                      }}
                      className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Icons.Trash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-700">{fb.description}</p>
                <div className="mt-2 text-[10px] font-bold text-slate-400">From: {fb.userName}</div>
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400 font-medium text-sm">No feedback submitted yet.</div>
            )}
          </div>
        </NeuCard>

        <NeuCard className="p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
              <Icons.ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Anonymous Reports</h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 hide-scrollbar">
            {anonymousReports.length > 0 ? anonymousReports.map((ar: AnonymousReportEntry, idx) => (
              <div key={idx} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-rose-500">{new Date(ar.date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <select 
                      value={ar.status} 
                      onChange={async (e) => {
                        const newStatus = e.target.value as any;
                        await DataService.updateAnonymousReportStatus(ar.id, newStatus);
                      }}
                      className="text-[9px] font-bold uppercase bg-rose-200 text-rose-700 rounded px-1 py-0.5 border-none focus:ring-0 cursor-pointer"
                    >
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <button 
                      onClick={async () => {
                        if (window.confirm("Delete this report?")) {
                          await DataService.deleteAnonymousReport(ar.id);
                        }
                      }}
                      className="text-rose-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Icons.Trash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-700">{ar.description}</p>
                {ar.imageUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-rose-100">
                    <img src={ar.imageUrl} alt="Report Attachment" className="w-full h-auto max-h-48 object-cover" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400 font-medium text-sm">No anonymous reports submitted yet.</div>
            )}
          </div>
        </NeuCard>
      </div>
    </div>
  );
};

const Settings = ({ deferredPrompt, onInstall, isSuperAdmin, userId, onConfigUpdate, onNavigate, appConfig }: { deferredPrompt: any, onInstall: () => void, isSuperAdmin: boolean, userId: string, onConfigUpdate: (c: any) => void, onNavigate: (tab: string) => void, appConfig: any }) => {
    const [whitelist, setWhitelist] = useState('');
    const [singleEmail, setSingleEmail] = useState('');
    const [updating, setUpdating] = useState(false);
    const [maintenanceEmail, setMaintenanceEmail] = useState('');
    const [bookingEmail, setBookingEmail] = useState('');

    useEffect(() => {
        if (isSuperAdmin) {
            DataService.getAppSettings().then(settings => {
                if (settings) {
                    setMaintenanceEmail(settings.maintenanceEmail || settings.maintenance_email || '');
                    setBookingEmail(settings.bookingEmail || settings.booking_email || '');
                }
            });
        }
    }, [isSuperAdmin]);

    const handleUpdateWhitelist = async () => {
        if(!whitelist) return;
        setUpdating(true);
        const emails = whitelist.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
        if(await DataService.updateAllowedEmails(emails)) {
            alert("Registry whitelist updated.");
            setWhitelist('');
        }
        setUpdating(false);
    };

    const handleAddSingleEmail = async () => {
        if(!singleEmail) return;
        setUpdating(true);
        if(await DataService.addAllowedEmail(singleEmail)) {
            alert(`${singleEmail} added to whitelist.`);
            setSingleEmail('');
        }
        setUpdating(false);
    };

    const handleUpdateNotificationSettings = async () => {
        setUpdating(true);
        await DataService.updateAppSettings({ maintenanceEmail, bookingEmail });
        alert("Notification settings updated.");
        setUpdating(false);
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <PageHeader title="Portal Core" subtitle="System Parameters & Nodes" />
            
            <div className="grid md:grid-cols-2 gap-8 stagger-children">
                {isSuperAdmin && (
                    <>
                    <NeuCard className="space-y-6 animate-slide-up bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Icons.Roadmap className="w-6 h-6" /></div>
                            <h3 className="font-black uppercase italic text-slate-900">Application PWA</h3>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Install the Huis Russel Botman Portal directly to your device for a native experience.</p>
                        <NeuButton variant="primary" className="w-full" disabled={!deferredPrompt} onClick={onInstall}>
                            {deferredPrompt ? 'Install Mobile Application' : 'PWA Environment Active'}
                        </NeuButton>
                    </NeuCard>

                    <NeuCard className="space-y-6 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.05s'}}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Icons.Users className="w-6 h-6" /></div>
                            <h3 className="font-black uppercase italic text-slate-900">User Management</h3>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Manage registered users, assign roles, and moderate community access.</p>
                        <NeuButton variant="primary" className="w-full" onClick={() => onNavigate('users')}>
                            Open User Registry
                        </NeuButton>
                    </NeuCard>
                    </>
                )}

                {isSuperAdmin && (
                    <>
                    <NeuCard className="space-y-6 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.1s'}}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Icons.Users className="w-6 h-6" /></div>
                            <h3 className="font-black uppercase italic text-slate-900">Access Whitelist</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Add Single Email (Non-Destructive)</label>
                                <div className="flex gap-2">
                                    <NeuInput placeholder="resident@sun.ac.za" value={singleEmail} onChange={e => setSingleEmail(e.target.value)} />
                                    <NeuButton variant="primary" onClick={handleAddSingleEmail} disabled={updating}>{updating ? '...' : 'Add'}</NeuButton>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 w-full"></div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bulk Sync (CSV - Overwrites All)</label>
                                <NeuTextarea placeholder="26210436@sun.ac.za, resident@sun.ac.za" value={whitelist} onChange={e => setWhitelist(e.target.value)} className="!min-h-[80px]" />
                                <NeuButton variant="default" className="w-full" onClick={handleUpdateWhitelist} disabled={updating}>{updating ? 'Updating Node...' : 'Overwrite Whitelist'}</NeuButton>
                            </div>
                        </div>
                    </NeuCard>

                    <NeuCard className="space-y-6 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.15s'}}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><Icons.Image className="w-6 h-6" /></div>
                            <h3 className="font-black uppercase italic text-slate-900">Application Branding</h3>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Update App Logo</label>
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white flex flex-col items-center justify-center text-center gap-2 group hover:border-neu-accent/40 transition-colors">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setUpdating(true);
                                            try {
                                                const url = await DataService.uploadImage(file, `branding/logo_${Date.now()}`);
                                                if (url) {
                                                    await DataService.updateAppSettings({ logoUrl: url });
                                                    onConfigUpdate((prev: any) => ({ ...prev, logoUrl: url }));
                                                    alert("Logo updated successfully.");
                                                }
                                            } catch (err: any) {
                                                alert(`Failed to upload logo: ${err.message || 'Unknown error'}`);
                                            } finally {
                                                setUpdating(false);
                                            }
                                        }} 
                                        className="hidden" 
                                        id="app-logo-upload" 
                                        disabled={updating}
                                    />
                                    <label htmlFor="app-logo-upload" className={`cursor-pointer flex flex-col items-center gap-2 ${updating ? 'opacity-50' : ''}`}>
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-neu-accent transition-colors">
                                            {updating ? <Icons.Bot className="animate-spin" /> : <Icons.Plus />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{updating ? 'Uploading...' : 'Click to upload new logo'}</span>
                                    </label>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 w-full"></div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Dashboard Images</h4>
                                
                                {[
                                    { key: 'visitors', label: 'Guest Pass Image' },
                                    { key: 'maintenance', label: 'Report Faults Image' },
                                    { key: 'bookings', label: 'Book Venue Image' }
                                ].map(img => (
                                    <div key={img.key} className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{img.label}</label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 p-3 border border-slate-200 rounded-xl bg-white flex items-center justify-between">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {appConfig.dashboardImages?.[img.key] && (
                                                        <img 
                                                            src={appConfig.dashboardImages[img.key]} 
                                                            className="w-8 h-8 rounded-lg object-cover border border-slate-100 shrink-0" 
                                                            alt="Preview" 
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    )}
                                                    <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px]">
                                                        {appConfig.dashboardImages?.[img.key] ? 'Change background image' : 'Upload background image'}
                                                    </span>
                                                </div>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setUpdating(true);
                                                        try {
                                                            const url = await DataService.uploadImage(file, `branding/dashboard_${img.key}_${Date.now()}`);
                                                            if (url) {
                                                                const settings = await DataService.getAppSettings();
                                                                const dashboardImages = settings?.dashboardImages || settings?.dashboard_images || {};
                                                                dashboardImages[img.key] = url;
                                                                await DataService.updateAppSettings({ dashboardImages });
                                                                onConfigUpdate((prev: any) => ({ ...prev, dashboardImages }));
                                                                alert(`${img.label} updated.`);
                                                            }
                                                        } catch (err: any) {
                                                            alert(`Upload failed: ${err.message || 'Unknown error'}`);
                                                        } finally {
                                                            setUpdating(false);
                                                        }
                                                    }} 
                                                    className="hidden" 
                                                    id={`img-upload-${img.key}`} 
                                                    disabled={updating}
                                                />
                                                <label htmlFor={`img-upload-${img.key}`} className="cursor-pointer text-neu-accent hover:text-neu-accent/80 transition-colors">
                                                    <Icons.Image className="w-4 h-4" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </NeuCard>

                    <NeuCard className="space-y-6 animate-slide-up bg-white/80 backdrop-blur-md" style={{animationDelay: '0.18s'}}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><Icons.Mail className="w-6 h-6" /></div>
                            <h3 className="font-black uppercase italic text-slate-900">Notification Settings</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Maintenance Notifications Email</label>
                                <NeuInput placeholder="maintenance@sun.ac.za" value={maintenanceEmail} onChange={e => setMaintenanceEmail(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Booking Notifications Email</label>
                                <NeuInput placeholder="bookings@sun.ac.za" value={bookingEmail} onChange={e => setBookingEmail(e.target.value)} />
                            </div>
                            
                            <NeuButton variant="primary" className="w-full" onClick={handleUpdateNotificationSettings} disabled={updating}>{updating ? 'Saving...' : 'Save Notification Settings'}</NeuButton>
                        </div>
                    </NeuCard>
                    </>
                )}
            </div>

            <NeuCard className="border-rose-100 bg-rose-50/50 backdrop-blur-md animate-slide-up" style={{animationDelay: '0.2s'}}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-center md:text-left">
                        <h3 className="text-xl font-black uppercase italic text-rose-900">Session Termination</h3>
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-widest opacity-60">Revoke local auth token and sign out</p>
                    </div>
                    <NeuButton variant="danger" className="w-full md:w-auto" onClick={() => AuthService.logout()}>Disconnect Account</NeuButton>
                </div>
            </NeuCard>
        </div>
    );
};

const NotificationBell = ({ user }: { user: User }) => {
    const [isOpen, setIsOpen] = useState(false);
    const unreadCount = useMemo(() => 
        (user.iceBreakerAnswers || []).filter(ans => !ans.isRead).length
    , [user.iceBreakerAnswers]);

    const handleMarkAsRead = async (answerId: string) => {
        await DataService.markIceBreakerAnswerAsRead(user.uid, answerId);
    };

    const handleMarkAllAsRead = async () => {
        await DataService.markAllIceBreakerAnswersAsRead(user.uid);
    };

    const handleWhatsAppReply = (ans: any) => {
        if (!ans.userPhone) {
            alert("This user hasn't provided a phone number.");
            return;
        }
        const message = `Hi ${ans.userName}! I'm replying to your answer to my icebreaker: "${ans.answer}"`;
        window.open(`https://wa.me/${ans.userPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div className="relative z-[1000]">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:text-neu-accent transition-all transform active:scale-95 relative group"
            >
                <Icons.Bell className={`w-5 h-5 md:w-6 md:h-6 ${unreadCount > 0 ? 'animate-swing' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-rose-600 text-white text-[8px] md:text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce-subtle">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[1000]"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, x: -20, y: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: -20, y: -20 }}
                            className="absolute top-14 left-0 w-80 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[70vh] z-[1001]"
                        >
                            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-lg font-black uppercase italic tracking-tighter">Icebreaker Replies</h3>
                                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Your personal interactions</p>
                                </div>
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={handleMarkAllAsRead}
                                        className="text-[9px] font-black uppercase tracking-widest text-neu-accent hover:text-white transition-colors"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                                {user.iceBreakerQuestion ? (
                                    <div className="p-4 bg-neu-accent/5 border border-neu-accent/10 rounded-2xl mb-4">
                                        <p className="text-[9px] font-black text-neu-accent uppercase tracking-widest mb-1">Your Question</p>
                                        <p className="text-sm font-bold text-slate-800 italic leading-tight">"{user.iceBreakerQuestion}"</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl mb-4">
                                        <p className="text-xs font-bold text-amber-700">You haven't set an icebreaker question yet!</p>
                                    </div>
                                )}

                                {(!user.iceBreakerAnswers || user.iceBreakerAnswers.length === 0) ? (
                                    <div className="py-12 text-center space-y-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                            <Icons.MessageCircle className="w-6 h-6" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No replies yet</p>
                                    </div>
                                ) : (
                                    [...(user.iceBreakerAnswers || [])].reverse().map((ans) => (
                                        <div 
                                            key={ans.id} 
                                            className={`p-4 rounded-2xl border transition-all ${ans.isRead ? 'bg-white border-slate-100 opacity-70' : 'bg-white border-neu-accent/20 shadow-md ring-1 ring-neu-accent/5'}`}
                                            onClick={() => !ans.isRead && handleMarkAsRead(ans.id)}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <img 
                                                    src={ans.userAvatar || getImgFallback(ans.userName)} 
                                                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm" 
                                                    alt={ans.userName} 
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-slate-900 uppercase truncate">{ans.userName}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(ans.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                {!ans.isRead && <div className="w-2 h-2 bg-neu-accent rounded-full animate-pulse" />}
                                            </div>
                                            <p className="text-xs font-medium text-slate-700 leading-relaxed mb-3">
                                                {ans.answer}
                                            </p>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleWhatsAppReply(ans);
                                                }}
                                                className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors shadow-sm border border-slate-200"
                                            >
                                                <Icons.MessageCircle className="w-3 h-3" /> Reply on WhatsApp
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

const MainApp = ({ 
  user, 
  refreshUser, 
  activeTab, 
  setActiveTab, 
  showMissingInfoPrompt, 
  setShowMissingInfoPrompt,
  deferredPrompt,
  handleInstall,
  showInstallPrompt,
  setShowInstallPrompt,
  showResPointsPromo,
  setShowResPointsPromo,
  showPromotion,
  setShowPromotion,
  promotionMessage,
  setPromotionMessage,
  showLevelUp,
  setShowLevelUp,
  toast,
  setToast,
  showAcademiaPromo,
  setShowAcademiaPromo,
  viewingUser,
  setViewingUser
}: any) => {
  const { 
    users: allUsers, 
    appConfig,
    setAppConfig,
    loading: dataLoading 
  } = useData();

  const renderContent = () => {
      if (!user) return null;
      if (viewingUser) {
          return <UserProfileView user={viewingUser} currentUser={user} onBack={() => setViewingUser(null)} />;
      }
      switch(activeTab) {
          case 'dashboard': return <Dashboard role={user.role} userDisplayName={user.displayName} onNavigate={setActiveTab} images={appConfig.dashboardImages || appConfig.dashboard_images} currentUser={user} setViewingUser={setViewingUser} />;
          case 'academia': return <Academia currentUser={user} onBack={() => setActiveTab('dashboard')} onProfileClick={(uid) => {
              const target = allUsers.find(u => u.uid === uid);
              if (target) setViewingUser(target);
          }} />;
          case 'profile': return <Profile user={user} onUpdate={refreshUser} logoUrl={appConfig.logoUrl || appConfig.logo_url} />;
          case 'visitors': return <Visitors role={user.role} user={user} logoUrl={appConfig.logoUrl || appConfig.logo_url} onSuccess={(msg) => { 
              if (isStaff(user.role)) {
                  setToast({ message: msg, type: 'success' });
              } else {
                  setPromotionMessage(msg); 
                  setShowPromotion(true); 
              }
          }} />;
          case 'micro_tasks': return <Tasks role={user.role} user={user} onSuccess={(msg) => { 
              setPromotionMessage(msg); 
              setShowPromotion(true); 
          }} />;
          case 'bookings': return <Bookings role={user.role} user={user} onSuccess={(msg) => { setPromotionMessage(msg); setShowPromotion(true); }} />;
          case 'maintenance': return <Maintenance role={user.role} user={user} logoUrl={appConfig.logoUrl || appConfig.logo_url} onSuccess={(msg) => { setPromotionMessage(msg); setShowPromotion(true); }} />;

          case 'roadmap': return <Roadmap />;
          case 'feedback': return <FeedbackView user={user} />;
          case 'anonymous_report': return <AnonymousReport user={user} onSuccess={(msg) => { setPromotionMessage(msg); setShowPromotion(true); }} />;
          case 'users': return <UsersList currentUser={user} />;
          case 'reports': return <ReportsPage role={user.role} user={user} logoUrl={appConfig.logoUrl || appConfig.logo_url} onSuccess={(msg) => { setPromotionMessage(msg); setShowPromotion(true); }} />;
          case 'settings': 
            if (user.role !== 'super_admin') return <Dashboard role={user.role} userDisplayName={user.displayName} onNavigate={setActiveTab} images={appConfig.dashboardImages || appConfig.dashboard_images} currentUser={user} setViewingUser={setViewingUser} />;
            return <Settings deferredPrompt={deferredPrompt} onInstall={handleInstall} isSuperAdmin={user.role === 'super_admin'} userId={user.uid} onConfigUpdate={setAppConfig} onNavigate={setActiveTab} appConfig={appConfig} />;
          case 'points_info': return <PointsExplanation onBack={() => setActiveTab('dashboard')} currentUser={user} />;
          case 'pro-summary': return <ProfessionalSummary user={user} onUpdate={(data) => DataService.updateUserProfile(user.uid, data)} />;
          case 'points': return <PointsPage />;
          default: return <Dashboard role={user.role} userDisplayName={user.displayName} onNavigate={setActiveTab} images={appConfig.dashboardImages || appConfig.dashboard_images} currentUser={user} setViewingUser={setViewingUser} />;
      }
  };

  if (dataLoading) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
           <Loader />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-neu-accent selection:text-white">
      <main className="max-w-7xl mx-auto px-4 md:px-8 min-h-screen overflow-x-hidden pt-8 pb-24">
          {renderContent()}
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} role={user.role} />
      
      {showLevelUp && <LevelUpModal rank={showLevelUp} onClose={() => setShowLevelUp(null)} />}
      
      {showMissingInfoPrompt && getProfileCompletion(user) < 100 && (
          <ProfileCompletionPrompt 
              user={user} 
              onUpdate={() => { refreshUser(); setShowMissingInfoPrompt(false); }} 
              onClose={() => setShowMissingInfoPrompt(false)} 
          />
      )}

      {showInstallPrompt && (
          <InstallPrompt 
              onClose={() => setShowInstallPrompt(false)} 
              onDismissForever={() => {
                  localStorage.setItem('hrb_install_prompt_dismissed', 'true');
                  setShowInstallPrompt(false);
              }}
          />
      )}

      {showResPointsPromo && (
          <ResPointsPromo 
              onClose={() => {
                  localStorage.setItem('hrb_res_points_promo_seen', 'true');
                  setShowResPointsPromo(false);
              }} 
          />
      )}

      {showAcademiaPromo && (
          <AcademiaPromo 
              onClose={() => {
                  localStorage.setItem('hrb_academia_promo_seen', 'true');
                  setShowAcademiaPromo(false);
              }} 
          />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
            <div className="bg-slate-900/90 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md ring-1 ring-white/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                <span className="font-bold text-[10px] uppercase tracking-[0.2em]">{toast.message}</span>
            </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLevelUp, setShowLevelUp] = useState<string | null>(null);
  const [lastRank, setLastRank] = useState<string | null>(null);

  const getRank = (points: number) => {
    if (points >= 30) return 'House Legend';
    if (points >= 15) return 'Community Star';
    if (points >= 5) return 'Contributor';
    return 'Resident';
  };

  useEffect(() => {
    if (user && user.points !== undefined) {
        const currentRank = getRank(user.points);
        if (lastRank && currentRank !== lastRank) {
            setShowLevelUp(currentRank);
        }
        setLastRank(currentRank);
    }
  }, [user?.points, lastRank]);
  const [showMissingInfoPrompt, setShowMissingInfoPrompt] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'updatePassword'>('login');
  const [recoveryStep, setRecoveryStep] = useState<0 | 1 | 2>(0);
  const [recoveryQuiz, setRecoveryQuiz] = useState<{
    phoneOptions: string[];
    roomOptions: string[];
    nameOptions: string[];
  } | null>(null);
  const [recoveryAnswers, setRecoveryAnswers] = useState({
    phone: '',
    room: '',
    name: ''
  });
  const [isResetting, setIsResetting] = useState(false);
  const [showGuestBooking, setShowGuestBooking] = useState(false);
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showResPointsPromo, setShowResPointsPromo] = useState(false);
  const [showAcademiaPromo, setShowAcademiaPromo] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const sessionAwardedRef = useRef(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  useEffect(() => {
    const isDismissed = localStorage.getItem('hrb_install_prompt_dismissed');
    // Temporarily disabled install prompt
    /*
    if (activeTab === 'dashboard' && user && !isDismissed) {
        setShowInstallPrompt(true);
        const timer = setTimeout(() => {
            setShowInstallPrompt(false);
        }, 5000);
        return () => clearTimeout(timer);
    }
    */
  }, [activeTab, user]);

  useEffect(() => {
    const hasSeenPromo = localStorage.getItem('hrb_res_points_promo_seen');
    if (activeTab === 'dashboard' && user && !hasSeenPromo) {
        setShowResPointsPromo(true);
    }
  }, [activeTab, user]);

  useEffect(() => {
    const hasSeenAcademiaPromo = localStorage.getItem('hrb_academia_promo_seen');
    if (activeTab === 'academia' && user && !hasSeenAcademiaPromo) {
        setShowAcademiaPromo(true);
    }
  }, [activeTab, user]);

  useEffect(() => {
    // Explicitly catch password recovery from URL hash
    if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=')) {
      setAuthView('updatePassword');
    }

    DataService.testConnection();
    let userUnsubscribe: (() => void) | null = null;

    const unsubscribe = AuthService.onAuthStateChanged(async (currentUser, event) => {
      if (event === 'PASSWORD_RECOVERY') {
          setAuthView('updatePassword');
      }
      
      if (currentUser) {
        DataService.incrementAppVisits();
        const userProfile = await DataService.getUser(currentUser.id, currentUser.email || undefined);
        if (userProfile) {
            if (userProfile.points === undefined && !sessionAwardedRef.current) {
                sessionAwardedRef.current = true;
                
                // Award welcome bonus
                await DataService.awardPoints('welcome_bonus', 2.0);
                
                // Award other bonuses if already completed
                if (getProfileCompletion(userProfile) === 100) {
                    await DataService.awardPoints('profile_completion', 1.0);
                }
                if (userProfile.profileImageUrl) {
                    await DataService.awardPoints('profile_picture', 0.5);
                }
                if (userProfile.role === 'admin' || userProfile.role === 'super_admin') {
                    await DataService.awardPoints('admin_bonus', 2.0);
                }
                
                // Award daily session points
                await DataService.awardPoints('daily_session', 0.01);
            } else if (!sessionAwardedRef.current) {
                sessionAwardedRef.current = true;
                await DataService.awardPoints('daily_session', 0.01);
            }
            setUser(userProfile);

            // Real-time listener for user profile updates (e.g., points)
            if (userUnsubscribe) userUnsubscribe();
            userUnsubscribe = DataService.subscribeToUser(currentUser.id, (updatedUser) => {
                if (updatedUser) setUser(updatedUser);
            });
        } else {
             setUser({ 
                 uid: currentUser.id, 
                 email: currentUser.email || '', 
                 displayName: currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')?.[0] || 'Resident', 
                 role: 'general', 
                 points: 0,
                 warningCount: 0,
                 visitorRestricted: false,
                 createdAt: new Date().toISOString()
             });
        }
      } else {
        setUser(null);
        if (userUnsubscribe) {
            userUnsubscribe();
            userUnsubscribe = null;
        }
        sessionAwardedRef.current = false;
      }
      setLoading(false);
    });
    return () => {
        unsubscribe();
        if (userUnsubscribe) userUnsubscribe();
    };
  }, []);
  
  const refreshUser = async () => {
      if(user) {
          const updated = await DataService.getUser(user.uid, user.email);
          if(updated) setUser(updated);
      }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      if (authView === 'register') {
        await AuthService.signUp(email, password);
      } else {
        await AuthService.signIn(email, password);
      }
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setAuthError("Please enter your Identity Mail to recover your password.");
      return;
    }
    
    if (recoveryStep === 0) {
      setIsResetting(true);
      setAuthError('');
      try {
        const response = await fetch('/api/recovery-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 50)}...`);
        }

        if (data.success) {
          setRecoveryQuiz(data.questions);
          setRecoveryStep(1);
        } else {
          setAuthError(data.error || 'Failed to generate recovery quiz.');
        }
      } catch (error: any) {
        setAuthError(error.message || 'Failed to initiate recovery.');
      } finally {
        setIsResetting(false);
      }
    } else if (recoveryStep === 1) {
      if (!recoveryAnswers.phone || !recoveryAnswers.room || !recoveryAnswers.name) {
        setAuthError("Please answer all security questions.");
        return;
      }
      setIsResetting(true);
      setAuthError('');
      try {
        const response = await fetch('/api/verify-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone: recoveryAnswers.phone,
            room: recoveryAnswers.room,
            name: recoveryAnswers.name
          })
        });
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 50)}...`);
        }

        if (data.success) {
          setRecoveryStep(2);
        } else {
          setAuthError(data.error || 'Verification failed. Incorrect answers.');
        }
      } catch (error: any) {
        setAuthError(error.message || 'Failed to verify answers.');
      } finally {
        setIsResetting(false);
      }
    } else if (recoveryStep === 2) {
      if (!password) {
        setAuthError("Please enter a new password.");
        return;
      }
      setIsResetting(true);
      setAuthError('');
      try {
        const response = await fetch('/api/verify-recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone: recoveryAnswers.phone,
            room: recoveryAnswers.room,
            name: recoveryAnswers.name,
            newPassword: password
          })
        });
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 50)}...`);
        }

        if (data.success) {
          alert("Password reset successfully. You can now log in.");
          setAuthView('login');
          setRecoveryStep(0);
          setPassword('');
          setRecoveryAnswers({ phone: '', room: '', name: '' });
        } else {
          setAuthError(data.error || 'Verification failed. Incorrect answers.');
          setRecoveryStep(0); // Reset to start
        }
      } catch (error: any) {
        setAuthError(error.message || 'Failed to verify recovery.');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setAuthError("Please enter a new password.");
      return;
    }
    setLoading(true);
    setAuthError('');
    try {
      await AuthService.updatePassword(password);
      alert("Security credentials updated successfully. You can now login with your new password.");
      setAuthView('login');
    } catch (error: any) {
      setAuthError(error.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInstall = () => {
      if(deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choice: any) => {
              if(choice.outcome === 'accepted') setDeferredPrompt(null);
          });
      }
  };

  if (loading) {
     return (
       <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
          <Loader />
       </div>
     );
  }

  return (
    <ErrorBoundary>
      {user && authView !== 'updatePassword' ? (
        <DataProvider currentUser={user}>
          <MainApp 
            user={user}
            refreshUser={refreshUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            showMissingInfoPrompt={showMissingInfoPrompt}
            setShowMissingInfoPrompt={setShowMissingInfoPrompt}
            deferredPrompt={deferredPrompt}
            handleInstall={handleInstall}
            showInstallPrompt={showInstallPrompt}
            setShowInstallPrompt={setShowInstallPrompt}
            showResPointsPromo={showResPointsPromo}
            setShowResPointsPromo={setShowResPointsPromo}
            showPromotion={showPromotion}
            setShowPromotion={setShowPromotion}
            promotionMessage={promotionMessage}
            setPromotionMessage={setPromotionMessage}
            showLevelUp={showLevelUp}
            setShowLevelUp={setShowLevelUp}
            toast={toast}
            setToast={setToast}
            showAcademiaPromo={showAcademiaPromo}
            setShowAcademiaPromo={setShowAcademiaPromo}
            viewingUser={viewingUser}
            setViewingUser={setViewingUser}
          />
        </DataProvider>
      ) : showGuestBooking ? (
          <GuestBooking onBack={() => setShowGuestBooking(false)} />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans">
           {/* Decorative Background Elements */}
           <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neu-accent/5 rounded-full blur-[120px] animate-pulse"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '2s'}}></div>
           </div>

           <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 border border-slate-100 m-4">
              {/* Left Side: Branding & Info */}
              <div className="hidden lg:flex flex-col justify-between p-16 bg-slate-900 text-white relative overflow-hidden">
                 <div className="absolute inset-0 opacity-20">
                    <img 
                      src="https://picsum.photos/seed/campus/1200/1200?blur=2" 
                      alt="Campus" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                 </div>
                 <div className="relative z-10">
                    <div className="w-16 h-16 bg-neu-accent rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-neu-accent/20 rotate-3">
                       <span className="font-black text-2xl italic tracking-tighter text-white">HRB</span>
                    </div>
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none mb-6">
                       Digital <br /> Resident <br /> <span className="text-neu-accent">Portal</span>
                    </h2>
                    <p className="text-slate-400 font-medium text-lg max-w-xs leading-relaxed">
                       The unified ecosystem for Huis Russel Botman residents. Access services, connect with peers, and manage your stay.
                    </p>
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 text-slate-400 text-xs font-black uppercase tracking-[0.2em]">
                       <div className="w-8 h-px bg-slate-700"></div>
                       Stellenbosch University
                    </div>
                 </div>
              </div>

              {/* Right Side: Auth Forms */}
              <div className="p-8 md:p-16 flex flex-col justify-center bg-white relative">
                 <div className="max-w-sm mx-auto w-full">
                    <div className="lg:hidden flex justify-center mb-8">
                       <div className="w-12 h-12 bg-neu-accent rounded-xl flex items-center justify-center shadow-lg shadow-neu-accent/20 rotate-3">
                          <span className="font-black text-xl italic tracking-tighter text-white">HRB</span>
                       </div>
                    </div>

                    <div className="mb-10 text-center lg:text-left">
                       <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 mb-2">
                          {authView === 'login' ? 'Login' : authView === 'register' ? 'Sign Up' : authView === 'forgot' ? 'Reset Password' : 'Update Password'}
                       </h1>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {authView === 'login' ? 'Enter your details to sign in' : authView === 'register' ? 'Create your account' : authView === 'forgot' ? 'Verify identity to reset password' : 'Set your new password'}
                       </p>
                    </div>

                    {authView === 'login' && (
                      <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl animate-pulse-slow">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icons.ShieldAlert className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-amber-900 uppercase italic tracking-tight">System Update Required</h4>
                            <p className="text-[9px] font-medium text-amber-700 leading-relaxed mt-1">
                              We've upgraded our security. All residents must reset their passwords to access the new portal.
                            </p>
                            <button 
                              onClick={() => setAuthView('forgot')}
                              className="mt-2 text-[9px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-800 transition-colors underline underline-offset-4"
                            >
                              Start Reset Protocol
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {authView === 'forgot' ? (
                       <form onSubmit={handleForgotPassword} className="space-y-6 animate-slide-up">
                          {authError && (
                              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center">
                                  {authError}
                              </div>
                          )}
                          <button 
                             type="button"
                             onClick={() => {
                               setAuthView('login');
                               setRecoveryStep(0);
                               setRecoveryQuiz(null);
                             }}
                             className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors mb-4"
                          >
                             <Icons.ArrowLeft className="w-4 h-4" /> Back to Login
                          </button>

                          {recoveryStep === 0 && (
                            <div className="space-y-1">
                               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Student Email</label>
                               <NeuInput 
                                  type="email" 
                                  placeholder="name@sun.ac.za" 
                                  value={email}
                                  onChange={e => setEmail(e.target.value)}
                                  className="!bg-slate-50 !border-slate-100 !px-6 !py-5 focus:!bg-white"
                                  required
                               />
                            </div>
                          )}

                          {recoveryStep === 1 && recoveryQuiz && (
                            <div className="space-y-4">
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select your Phone Number</label>
                                  <select 
                                     value={recoveryAnswers.phone}
                                     onChange={e => setRecoveryAnswers({...recoveryAnswers, phone: e.target.value})}
                                     className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-2xl focus:bg-white outline-none"
                                     required
                                  >
                                     <option value="">-- Select Phone Number --</option>
                                     {recoveryQuiz.phoneOptions.map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                     ))}
                                  </select>
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select your Room Number</label>
                                  <select 
                                     value={recoveryAnswers.room}
                                     onChange={e => setRecoveryAnswers({...recoveryAnswers, room: e.target.value})}
                                     className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-2xl focus:bg-white outline-none"
                                     required
                                  >
                                     <option value="">-- Select Room Number --</option>
                                     {recoveryQuiz.roomOptions.map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                     ))}
                                  </select>
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select your Display Name</label>
                                  <select 
                                     value={recoveryAnswers.name}
                                     onChange={e => setRecoveryAnswers({...recoveryAnswers, name: e.target.value})}
                                     className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-2xl focus:bg-white outline-none"
                                     required
                                  >
                                     <option value="">-- Select Display Name --</option>
                                     {recoveryQuiz.nameOptions.map((opt, i) => (
                                        <option key={i} value={opt}>{opt}</option>
                                     ))}
                                  </select>
                               </div>
                            </div>
                          )}

                          {recoveryStep === 2 && (
                            <div className="space-y-1">
                               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
                               <NeuInput 
                                  type="password" 
                                  placeholder="••••••••" 
                                  value={password}
                                  onChange={e => setPassword(e.target.value)}
                                  className="!bg-slate-50 !border-slate-100 !px-6 !py-5 focus:!bg-white"
                                  required
                               />
                            </div>
                          )}

                          <NeuButton 
                             type="submit" 
                             variant="primary"
                             className="w-full h-16 shadow-lg shadow-neu-accent/20"
                             disabled={isResetting}
                          >
                             {isResetting ? 'Processing...' : recoveryStep === 0 ? 'Verify Email' : recoveryStep === 1 ? 'Verify Answers' : 'Reset Password'}
                          </NeuButton>
                       </form>
                    ) : authView === 'updatePassword' ? (
                        <form onSubmit={handleUpdatePassword} className="space-y-6 animate-slide-up">
                           {authError && (
                               <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center">
                                   {authError}
                               </div>
                           )}
                           <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
                              <NeuInput 
                                 type="password" 
                                 placeholder="••••••••" 
                                 value={password}
                                 onChange={e => setPassword(e.target.value)}
                                 className="!bg-slate-50 !border-slate-100 !px-6 !py-5 focus:!bg-white"
                                 required
                              />
                           </div>
                           <NeuButton 
                              type="submit" 
                              variant="primary"
                              className="w-full h-16 shadow-lg shadow-neu-accent/20"
                           >
                              Update Password
                           </NeuButton>
                        </form>
                    ) : (
                       <form onSubmit={handleAuth} className="space-y-6 animate-slide-up">
                          {authError && (
                              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center">
                                  {authError}
                              </div>
                          )}
                          <div className="space-y-4">
                             <div className="space-y-1">
                                <NeuInput 
                                   type="email" 
                                   placeholder="Student Email" 
                                   value={email}
                                   onChange={e => setEmail(e.target.value)}
                                   className="!bg-slate-50 !border-slate-100 !px-6 !py-5 focus:!bg-white"
                                   required
                                />
                             </div>
                             <div className="space-y-1">
                                <NeuInput 
                                   type="password" 
                                   placeholder="Password" 
                                   value={password}
                                   onChange={e => setPassword(e.target.value)}
                                   className="!bg-slate-50 !border-slate-100 !px-6 !py-5 focus:!bg-white"
                                   required
                                />
                                {authView === 'login' && (
                                   <div className="flex justify-end mt-2">
                                      <button
                                         type="button"
                                         onClick={() => setAuthView('forgot')}
                                         className="text-[10px] font-black uppercase tracking-widest text-neu-accent hover:text-rose-600 transition-colors underline underline-offset-4"
                                      >
                                         Need to Reset Password?
                                      </button>
                                   </div>
                                )}
                             </div>
                          </div>
                          
                          <NeuButton 
                             type="submit" 
                             variant="primary"
                             className="w-full h-16 shadow-lg shadow-neu-accent/20"
                          >
                             {authView === 'register' ? 'Create Account' : 'Verify Access'}
                          </NeuButton>

                          <div className="pt-6 flex flex-col gap-4 text-center">
                             <button 
                                type="button"
                                onClick={() => setAuthView(authView === 'login' ? 'register' : 'login')} 
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-neu-accent transition-all"
                             >
                                {authView === 'login' ? "Don't have an account? Create one" : "Already have an account? Login"}
                             </button>
                             <div className="w-12 h-0.5 bg-slate-100 mx-auto rounded-full"></div>
                             <button 
                                type="button"
                                onClick={() => setShowGuestBooking(true)} 
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all"
                             >
                                Guest Reservation Inquiry
                             </button>
                             {authView === 'login' && (
                               <NeuButton 
                                  type="button"
                                  onClick={() => setAuthView('forgot')}
                                  variant="ghost"
                                  className="w-full !border-2 !border-amber-200 !text-amber-700 hover:!bg-amber-50 !h-14 mt-2"
                               >
                                  First Time Login? Reset Password
                               </NeuButton>
                             )}
                          </div>
                       </form>
                    )}
                 </div>
              </div>
           </div>
           
           <div className="absolute bottom-6 text-center w-full animate-fade-in hidden md:block">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Security Protocol v5.0.0 • Stellenbosch University • Biometric Ready</p>
           </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default App;
