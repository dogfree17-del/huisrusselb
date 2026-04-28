import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NeuCard, NeuButton, NeuInput, NeuTextarea } from './NeuComponents';
import { Icons } from './Icons';
import { User } from '../types';
import { GoogleGenAI } from '@google/genai';
import { DataService, supabase } from '../services/supabase';
import { useData } from '../contexts/DataContext';
import CVBuilder from './CVBuilder';
import { Link, BookOpen, Users, FolderRoot, GraduationCap, ChevronRight } from 'lucide-react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY! });

// Dummy generic cost updater
const updateCost = async (usage: any, model: string) => {
    // Optionally track usage if needed
    console.log('API Usage:', usage, model);
};

export const Academia = ({ currentUser, onBack, onProfileClick }: { currentUser: User, onBack: () => void, onProfileClick?: (uid: string) => void }) => {
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const { users, posts } = useData();

    // 1. Academic Allies
    const courseMates = useMemo(() => {
        if (!currentUser.course) return [];
        const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const myCourse = cleanStr(currentUser.course);
        
        return users.filter(u => {
            if (u.uid === currentUser.uid || !u.course) return false;
            const theirCourse = cleanStr(u.course);
            // Fuzzy match: if one contains the other or they are very similar
            return theirCourse.includes(myCourse) || myCourse.includes(theirCourse) || theirCourse === myCourse;
        });
    }, [currentUser.course, currentUser.uid, users]);

    // 2. Knowledge Stack (Folders & Links)
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [isSubmittingLink, setIsSubmittingLink] = useState(false);
    const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);

    const studyFolders = useMemo(() => {
        return posts
            .filter(p => p.content.startsWith('[KNOWLEDGE_FOLDER]'))
            .map(p => ({
                id: p.id,
                name: p.content.replace('[KNOWLEDGE_FOLDER]', '').trim(),
                userId: p.userId,
                userName: p.userName,
                createdAt: p.createdAt
            }))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, [posts]);

    const studyLinks = useMemo(() => {
        return posts
            .filter(p => p.content.startsWith('[STUDY_LINK]'))
            .map(p => {
                const raw = p.content.replace('[STUDY_LINK]', '').trim();
                const parts = raw.split('|DELIM|');
                return {
                    id: p.id,
                    folderId: parts[0]?.trim() || 'root',
                    title: parts[1]?.trim() || 'Untitled Link',
                    url: parts[2]?.trim() || '#',
                    userName: p.userName,
                    createdAt: p.createdAt
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [posts]);

    const filteredLinks = useMemo(() => {
        return studyLinks.filter(l => l.folderId === (activeFolderId || 'root'));
    }, [studyLinks, activeFolderId]);

    const handleAddFolder = async () => {
        if (!newFolderName) return;
        setIsSubmittingFolder(true);
        try {
            const { error } = await supabase.from('post').insert({
                id: crypto.randomUUID(),
                user_id: currentUser.uid,
                userName: currentUser.displayName,
                content: `[KNOWLEDGE_FOLDER] ${newFolderName}`,
                type: 'text',
                createdAt: new Date().toISOString(),
                likes: [],
                commentsCount: 0
            });
            if (error) throw error;
            setNewFolderName('');
            setShowFolderModal(false);
        } catch (error) {
            console.error('Error adding folder:', error);
            alert('Failed to create folder.');
        } finally {
            setIsSubmittingFolder(false);
        }
    };

    const handleAddLink = async () => {
        if (!newLinkTitle || !newLinkUrl) return;
        setIsSubmittingLink(true);
        try {
            const { error } = await supabase.from('post').insert({
                id: crypto.randomUUID(),
                user_id: currentUser.uid,
                userName: currentUser.displayName,
                content: `[STUDY_LINK] ${activeFolderId || 'root'} |DELIM| ${newLinkTitle} |DELIM| ${newLinkUrl}`,
                type: 'text',
                createdAt: new Date().toISOString(),
                likes: [],
                commentsCount: 0
            });
            
            if (error) throw error;
            
            // Award points for contribution
            await DataService.awardPoints('study_contribution', 0.5);
            
            setNewLinkTitle('');
            setNewLinkUrl('');
        } catch (error) {
            console.error('Error adding link:', error);
            alert('Failed to save resource to the vault.');
        } finally {
            setIsSubmittingLink(false);
        }
    };

    // Provide tools
    const tools = [
        {
            id: 'cv_creator',
            title: 'CV Builder',
            description: 'AI-powered ATS-friendly CV tailoring.',
            icon: Icons.FileText,
            color: 'bg-[#FF6321]',
            textColor: 'text-white'
        },
        {
            id: 'saved_cvs',
            title: 'Architectures',
            description: 'Your library of engineered CVs.',
            icon: BookOpen,
            color: 'bg-slate-900',
            textColor: 'text-white'
        },
        {
            id: 'resources',
            title: 'Resource Center',
            description: 'Curated knowledge for your specific course.',
            icon: GraduationCap,
            color: 'bg-[#00FF00]',
            textColor: 'text-slate-900'
        }
    ];

    return (
        <div className="space-y-12 animate-fade-in pb-32 max-w-7xl mx-auto font-sans">
            {!activeTool ? (
                <>
                    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 md:mb-12 animate-slide-down relative px-4 md:px-0">
                        <div className="space-y-2 md:space-y-4">
                            <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-[140px] font-black text-slate-900 tracking-tighter uppercase italic leading-[0.8]">Academia</h1>
                            <p className="text-[#FF6321] font-black uppercase tracking-[0.4em] text-[10px] md:text-sm italic">The Neural Edge of Excellence</p>
                        </div>
                        <div className="flex gap-4 w-full lg:w-auto animate-zoom-in">
                            <button onClick={onBack} className="flex-1 lg:flex-none flex items-center justify-center px-6 md:px-8 py-3 md:py-5 rounded-xl md:rounded-2xl text-slate-900 hover:bg-slate-100 transition-all transform active:scale-95 font-black text-[10px] md:text-xs uppercase tracking-[0.3em] italic border-2 md:border-4 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                <Icons.ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-3" /> Back
                            </button>
                        </div>
                    </header>

                    {/* Compact Tools Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 animate-slide-up px-4 md:px-0">
                        {tools.map(tool => (
                            <NeuCard 
                                key={tool.id} 
                                className="cursor-pointer group flex flex-col justify-between overflow-hidden relative border-2 md:border-4 border-slate-900 !rounded-[20px] md:!rounded-[32px] p-3 md:p-6 hover:-translate-y-2 hover:translate-x-1 transition-all hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white"
                                onClick={() => setActiveTool(tool.id)}
                            >
                                <div className="flex justify-between items-start mb-3 md:mb-6">
                                    <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center shrink-0 ${tool.color} ${tool.textColor} border md:border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform group-hover:scale-110 transition-transform`}>
                                        <tool.icon className="w-4 h-4 md:w-6 md:h-6" />
                                    </div>
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border md:border-2 border-slate-900 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                        <Icons.ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                                    </div>
                                </div>
                                <div className="space-y-0.5 md:space-y-1">
                                    <h3 className="text-xs md:text-xl font-black uppercase text-slate-900 tracking-tighter italic leading-none">{tool.title}</h3>
                                    <p className="font-bold text-[8px] md:text-[10px] text-slate-500 uppercase tracking-widest line-clamp-1">{tool.description}</p>
                                </div>
                            </NeuCard>
                        ))}
                    </div>

                    {/* Prominent Sections with Row Focus */}
                    <div className="space-y-12 md:space-y-16 px-4 md:px-0">
                        
                        {/* 1. Academic Allies - Wide Row */}
                        <div className="space-y-6 md:space-y-8">
                            <div className="flex justify-between items-end border-b-4 md:border-b-8 border-slate-900 pb-2 md:pb-4">
                                <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2 md:gap-4">
                                    <Users className="w-6 h-6 md:w-10 md:h-10 text-[#FF6321]" />
                                    Academic Allies
                                </h3>
                                {currentUser.course && (
                                    <span className="text-[8px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1 lg:mb-2">Cohort: {currentUser.course}</span>
                                )}
                            </div>

                            <div className="bg-slate-900 rounded-[24px] md:rounded-[48px] p-6 md:p-10 shadow-[8px_8px_0px_0px_rgba(255,99,33,1)] md:shadow-[16px_16px_0px_0px_rgba(255,99,33,1)] border-2 md:border-4 border-slate-900 overflow-hidden">
                                {currentUser.course ? (
                                    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide">
                                        {courseMates.length > 0 ? (
                                             courseMates.map(mate => (
                                                 <div 
                                                     key={mate.uid} 
                                                     onClick={() => onProfileClick?.(mate.uid)}
                                                     className="flex flex-col md:flex-row items-center gap-3 md:gap-5 p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-800 border-2 border-slate-700 hover:border-[#FF6321] transition-all group cursor-pointer min-w-[140px] md:min-w-0"
                                                 >
                                                     <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-700 shrink-0 overflow-hidden border-2 border-slate-600 group-hover:border-[#FF6321] transition-all transform group-hover:rotate-3">
                                                         {mate.profileImageUrl ? (
                                                             <img src={mate.profileImageUrl} alt={mate.displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                                         ) : (
                                                             <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xl md:text-2xl">{mate.displayName.charAt(0)}</div>
                                                         )}
                                                     </div>
                                                     <div className="text-center md:text-left">
                                                         <div className="font-black text-sm md:text-lg text-white leading-tight uppercase italic tracking-tighter truncate max-w-[100px] md:max-w-none">{mate.displayName}</div>
                                                         <div className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[#FF6321] mt-1">{mate.roomNumber || 'No Room'}</div>
                                                     </div>
                                                 </div>
                                             ))
                                         ) : (
                                             <div className="col-span-full py-6 md:py-12 text-center w-full space-y-4">
                                                 <p className="text-slate-500 font-black text-xs md:text-xl uppercase italic tracking-widest opacity-50">Forge your own path. No allies detected.</p>
                                                 <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Tip: Ensure your course "{currentUser.course}" is spelled exactly like your classmates.</p>
                                             </div>
                                         )}
                                     </div>
                                 ) : (
                                     <div className="py-10 md:py-20 text-center space-y-4 md:space-y-8">
                                         <p className="text-white text-lg md:text-2xl font-black uppercase italic tracking-tighter">Your academic network is locked.</p>
                                         <NeuButton className="bg-[#FF6321] text-white px-6 md:px-10 py-4 md:py-6 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest shadow-xl transform active:scale-95 transition-all">Set Course to Unlock</NeuButton>
                                     </div>
                                 )}
                            </div>
                        </div>

                        {/* 2. Study Vault - Wide Row */}
                        <div className="space-y-6 md:space-y-8">
                            <div className="flex justify-between items-end border-b-4 md:border-b-8 border-slate-900 pb-2 md:pb-4">
                                <h3 className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-2 md:gap-4">
                                    <FolderRoot className="w-6 h-6 md:w-10 md:h-10 text-[#00FF00]" />
                                    Knowledge Stack
                                </h3>
                                <span className="text-[8px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1 lg:mb-2">Collective Intelligence</span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Minimalist Folder & List View */}
                                <div className="lg:col-span-2 space-y-4">
                                     {/* Folder Navigation */}
                                     <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                         <button 
                                             onClick={() => setActiveFolderId(null)}
                                             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${!activeFolderId ? 'bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(0,255,0,1)]' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900'}`}
                                         >
                                             ROOT
                                         </button>
                                         {studyFolders.map(folder => (
                                             <button 
                                                 key={folder.id}
                                                 onClick={() => setActiveFolderId(folder.id)}
                                                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all whitespace-nowrap ${activeFolderId === folder.id ? 'bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(0,255,0,1)]' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900'}`}
                                             >
                                                 {folder.name}
                                             </button>
                                         ))}
                                         <button 
                                             onClick={() => setShowFolderModal(true)}
                                             className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-900 hover:text-slate-900 transition-all flex items-center gap-2"
                                         >
                                             <Icons.Plus className="w-3 h-3" /> New Folder
                                         </button>
                                     </div>

                                     <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                         {filteredLinks.length > 0 ? (
                                             filteredLinks.map(link => (
                                                 <a 
                                                     key={link.id} 
                                                     href={link.url.startsWith('http') ? link.url : `https://${link.url}`} 
                                                     target="_blank" 
                                                     rel="noopener noreferrer"
                                                     className="group flex items-center gap-4 bg-white border-2 border-slate-900 rounded-2xl p-3 hover:translate-x-1 hover:translate-y-[-2px] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,255,0,1)]"
                                                 >
                                                     <div className="w-10 h-10 shrink-0 bg-slate-900 text-[#00FF00] rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,255,0,1)]">
                                                         <Link className="w-5 h-5" />
                                                     </div>
                                                     <div className="flex-1 min-w-0">
                                                         <h4 className="font-black text-sm text-slate-900 uppercase italic tracking-tighter truncate">{link.title}</h4>
                                                         <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                             <span className="text-slate-900/60 lowercase">
                                                                 {(() => {
                                                                     try {
                                                                         if (link.url && link.url !== '#') {
                                                                             return new URL(link.url.startsWith('http') ? link.url : `https://${link.url}`).hostname;
                                                                         }
                                                                         return 'resource';
                                                                     } catch {
                                                                         return 'resource';
                                                                     }
                                                                 })()}
                                                             </span>
                                                             <span>•</span>
                                                             <span>{link.userName}</span>
                                                         </div>
                                                     </div>
                                                     <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                                                 </a>
                                             ))
                                         ) : (
                                             <div className="py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                                 <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Folder is empty</p>
                                             </div>
                                         )}
                                     </div>
                                </div>

                                {/* Compact Deposit Box */}
                                <div className="lg:col-span-2 bg-slate-900 rounded-[32px] p-6 border-4 border-slate-900 shadow-[12px_12px_0px_0px_rgba(0,255,0,1)] flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <FolderRoot className="w-24 h-24 text-[#00FF00]" />
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="space-y-1">
                                            <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                                Deposit Intel {activeFolderId ? `to ${studyFolders.find(f => f.id === activeFolderId)?.name}` : 'to ROOT'}
                                            </h4>
                                            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Contribute to the vault for 0.50 RP</p>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <NeuInput 
                                                value={newLinkTitle} 
                                                onChange={e => setNewLinkTitle(e.target.value)} 
                                                placeholder="INTEL TITLE (E.G. MATH NOTES)" 
                                                className="!bg-slate-800 !border-slate-700 !text-white !rounded-xl h-12 font-black uppercase tracking-widest text-[10px]" 
                                            />
                                            <NeuInput 
                                                value={newLinkUrl} 
                                                onChange={e => setNewLinkUrl(e.target.value)} 
                                                placeholder="RESOURCE SECURE URL" 
                                                className="!bg-slate-800 !border-slate-700 !text-white !rounded-xl h-12 font-black tracking-widest text-[10px]" 
                                            />
                                            <button 
                                                onClick={handleAddLink}
                                                disabled={isSubmittingLink || !newLinkTitle || !newLinkUrl}
                                                className="w-full py-4 bg-[#00FF00] text-slate-900 font-black uppercase italic tracking-[0.2em] rounded-xl hover:bg-[#00FF00]/80 transition-all transform active:scale-95 disabled:opacity-30 disabled:grayscale text-xs"
                                            >
                                                {isSubmittingLink ? "UPLOADING..." : "EXECUTE DEPOSIT"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Folder Creation Modal */}
                    <AnimatePresence>
                        {showFolderModal && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-white rounded-[2rem] border-4 border-slate-900 p-8 w-full max-w-sm shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    <h4 className="text-2xl font-black uppercase italic tracking-tighter mb-6">Create Folder</h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Folder Name</label>
                                            <NeuInput 
                                                value={newFolderName}
                                                onChange={e => setNewFolderName(e.target.value)}
                                                placeholder="E.G. ENGINEERING_101"
                                                className="!h-14 font-black text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-4">
                                            <NeuButton onClick={() => setShowFolderModal(false)} className="flex-1">Abort</NeuButton>
                                            <NeuButton 
                                                variant="primary" 
                                                className="flex-1"
                                                onClick={handleAddFolder}
                                                disabled={isSubmittingFolder || !newFolderName}
                                            >
                                                {isSubmittingFolder ? 'CREATING...' : 'ESTABLISH'}
                                            </NeuButton>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                </>
            ) : (
                <div className="animate-fade-in relative bg-[#f8fafc] min-h-[80vh] rounded-[48px] border-4 border-slate-900 p-8 md:p-12 shadow-[24px_24px_0px_0px_rgba(0,0,0,1)]">
                    <button onClick={() => setActiveTool(null)} className="flex items-center text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-[0.3em] font-black text-xs mb-12">
                        <Icons.ArrowLeft className="w-5 h-5 mr-3" /> Terminate Session
                    </button>
                    
                    {activeTool === 'cv_creator' && (
                        <div className="w-full">
                            <CVBuilder ai={ai} updateCost={updateCost} student={currentUser} />
                        </div>
                    )}

                    {activeTool === 'saved_cvs' && (
                        <div className="w-full">
                            <CVBuilder ai={ai} updateCost={updateCost} student={currentUser} initialStep="library" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
