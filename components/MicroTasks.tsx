import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../contexts/DataContext';
import { DataService } from '../services/supabase';
import { NeuCard, NeuButton, NeuInput, NeuTextarea, NeuBadge } from './NeuComponents';
import { Icons } from './Icons';
import { UserRole } from '../types';
import { GoogleGenAI } from "@google/genai";

export const Tasks = ({ role, user, onSuccess }: { role: UserRole, user: any, onSuccess: (msg: string) => void }) => {
  const { microTasks } = useData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [motivation, setMotivation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my_tasks' | 'admin_review'>('available');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const handleAddTask = async () => {
    if (!title || !description) return alert("Please fill in all required fields.");
    setIsSubmitting(true);
    setAiAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = `Analyze this academic/community task for a university residence app. 
      Is it appropriate and helpful for a student environment? 
      Also, allocate points based on difficulty and time required.
      Options for points: 0.1 (quick/easy), 0.35 (medium), 0.5 (significant), 1.0 (major effort).
      
      Respond ONLY with a JSON object: {"approved": boolean, "reason": string, "points": number}. 
      
      Task Title: ${title}
      Task Description: ${description}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const text = response.text || '{"approved": false, "reason": "AI failed to respond", "points": 0.1}';
      const analysis = JSON.parse(text);
      
      const status = analysis.approved ? 'open' : 'pending_review';
      const finalPoints = analysis.points || 0.1;
      
      await DataService.addMicroTask({ 
          title, 
          description, 
          points: finalPoints as any, 
          motivation: finalPoints >= 1 ? "Neural Protocol High Priority" : undefined,
          status,
          createdBy: user.uid,
          createdByName: user.displayName
      });
      
      setTitle('');
      setDescription('');
      setMotivation('');
      setShowAddTask(false);
      onSuccess(analysis.approved ? `Study mission added! Genesis Protocol allocated ${finalPoints.toFixed(2)} RP.` : `Mission quarantined for review. Reason: ${analysis.reason}`);
    } catch (e: any) {
      console.error("Task submission error:", e);
      alert("Error adding task: " + (e.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
      setAiAnalyzing(false);
    }
  };

  const handleClaimTask = async (taskId: string) => {
    await DataService.claimMicroTask(taskId, user.uid, user.displayName);
    setActiveTab('my_tasks');
    onSuccess("Mission claimed. Redirected to Intelligence Stack.");
  };

  const handleCompleteTask = async (taskId: string, points: number, claimedBy: string) => {
    // Only creator can check off
    const task = microTasks.find(t => t.id === taskId);
    if (task?.createdBy !== user.uid) {
      alert("Only the mission originator can verify achievement.");
      return;
    }
    await DataService.completeMicroTask(taskId, points, claimedBy);
    onSuccess("Mission successful. Merit points synchronized.");
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("Terminate mission parameters?")) {
      await DataService.deleteMicroTask(taskId);
      onSuccess("Mission purged.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900 p-6 rounded-[2rem] border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(255,99,33,1)]">
        <div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">ALL <span className="text-[#FF6321]">Tasks</span></h2>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mt-1 italic">Genesis Node Intelligence Tasks</p>
        </div>
        
        <div className="flex bg-white/5 p-1.5 rounded-[1.5rem] w-full md:w-auto border border-white/10 backdrop-blur-md">
          <button 
            onClick={() => setActiveTab('available')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'available' ? 'bg-white text-slate-900' : 'text-white/50 hover:text-white'}`}
          >
            <Icons.Inbox className="w-3.5 h-3.5" />
            Open
          </button>
          <button 
            onClick={() => setActiveTab('my_tasks')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'my_tasks' ? 'bg-white text-slate-900' : 'text-white/50 hover:text-white'}`}
          >
            <Icons.Users className="w-3.5 h-3.5" />
            Active
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'available' && !showAddTask && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-center py-4"
          >
            <NeuButton 
              onClick={() => setShowAddTask(true)} 
              variant="primary"
              className="px-10 py-5 h-auto rounded-[2rem] gap-3 group bg-slate-900 border-slate-900 text-white shadow-[8px_8px_0px_0px_rgba(255,99,33,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              <Icons.Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-black uppercase italic tracking-tighter">Create New Task</span>
            </NeuButton>
          </motion.div>
        )}
      </AnimatePresence>

      {showAddTask && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <NeuCard className="p-8 space-y-6 border-4 border-slate-900 relative overflow-hidden bg-white shadow-2xl rounded-[2.5rem]">
            <div className="absolute top-0 right-0 p-6">
              <button 
                onClick={() => setShowAddTask(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <Icons.X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-1 text-center">
              <h3 className="font-black text-2xl uppercase italic text-slate-900 leading-none tracking-tighter">Draft Mission <span className="text-[#FF6321]">Parameters</span></h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-2">Verified by Gemini Neural Protocol</p>
            </div>

            <div className="space-y-4">
              <NeuInput 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Mission Subject (e.g., Mathematics II Tutoring)" 
                className="!bg-slate-50 border-2 border-slate-100 !px-6 !py-5 focus:!border-[#FF6321] rounded-2xl"
              />
              <NeuTextarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Specify objectives and required intelligence..." 
                className="!bg-slate-50 border-2 border-slate-100 !px-6 !py-5 min-h-[120px] focus:!border-[#FF6321] rounded-2xl"
              />
            </div>

            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 flex items-start gap-4">
              <Icons.Bot className="w-6 h-6 text-[#FF6321] shrink-0" />
              <p className="text-[10px] font-bold text-white/70 leading-relaxed uppercase tracking-[0.1em]">
                Neural Agent will evaluate complexity and assign merit (0.10 - 1.00 RP) following submission.
              </p>
            </div>

            <NeuButton 
              variant="primary" 
              className="w-full h-16 bg-slate-900 border-slate-900 text-white shadow-[8px_8px_0px_0px_rgba(0,255,0,0.3)] gap-3 italic font-black uppercase rounded-2xl" 
              onClick={handleAddTask} 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Icons.Loader2 className="w-5 h-5 animate-spin text-[#00FF00]" />
                  <span className="animate-pulse">Evaluating Parameters...</span>
                </>
              ) : (
                <>
                  <Icons.CheckCircle className="w-5 h-5 text-[#00FF00]" />
                  <span>Finalize & Broadcast</span>
                </>
              )}
            </NeuButton>
          </NeuCard>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence mode="popLayout">
          {(activeTab === 'available' 
            ? microTasks.filter(t => t.status === 'open')
            : activeTab === 'my_tasks'
            ? microTasks.filter(t => t.claimedBy === user.uid || t.createdBy === user.uid)
            : microTasks.filter(t => t.status === 'pending_review')
          ).map(task => (
            <motion.div
              layout
              key={task.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <NeuCard className="p-6 space-y-5 group hover:border-[#FF6321]/30 transition-all duration-300 bg-white shadow-sm hover:shadow-xl border-2 border-slate-100 rounded-[2rem]">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-black text-lg uppercase italic text-slate-900 group-hover:text-[#FF6321] transition-colors tracking-tighter leading-none">{task.title}</h4>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Node // {new Date(task.createdAt || Date.now()).toLocaleDateString()}</span>
                       <div className="w-1 h-1 rounded-full bg-slate-200" />
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">SEC // {task.id.substring(0, 8)}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-slate-900/20 border border-slate-700">
                     <Icons.Star className="w-3.5 h-3.5 text-[#FF6321] fill-[#FF6321]" />
                     <span className="text-sm font-black tracking-tighter italic">{task.points.toFixed(2)} RP</span>
                  </div>
                </div>

                <p className="text-sm text-slate-500 font-bold leading-relaxed uppercase tracking-tight opacity-70">
                  {task.description}
                </p>

                <div className="pt-4 border-t-2 border-slate-50 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    {task.status === 'claimed' && (
                       <NeuBadge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black italic uppercase tracking-widest">IN PROGRESS</NeuBadge>
                    )}
                    {task.status === 'pending_review' && (
                       <NeuBadge className="bg-slate-100 text-slate-600 border-none text-[9px] font-black italic uppercase tracking-widest">QUARANTINED</NeuBadge>
                    )}
                    {task.status === 'open' && (
                       <NeuBadge className="bg-[#00FF00]/10 text-emerald-700 border-none text-[9px] font-black italic uppercase tracking-widest">ACTIVE</NeuBadge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {task.status === 'open' && activeTab === 'available' && (
                      <NeuButton variant="primary" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase italic gap-2 bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_rgba(255,99,33,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none" onClick={() => handleClaimTask(task.id)}>
                        <Icons.Hand className="w-3.5 h-3.5" />
                        Engage
                      </NeuButton>
                    )}
                    
                    {task.status === 'claimed' && task.createdBy === user.uid && (
                      <NeuButton variant="primary" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase italic gap-2 bg-emerald-500 border-emerald-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]" onClick={() => handleCompleteTask(task.id, task.points, task.claimedBy!)}>
                        <Icons.Check className="w-3.5 h-3.5" />
                        Verify
                      </NeuButton>
                    )}

                    {task.status === 'claimed' && task.claimedBy === user.uid && (
                      <a 
                        href={`https://wa.me/${task.createdByPhone}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="h-10 px-4 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        <Icons.MessageSquare className="w-4 h-4" />
                      </a>
                    )}
                    
                    {(task.createdBy === user.uid || role === 'super_admin') && (
                      <NeuButton variant="ghost" className="h-10 w-10 p-0 rounded-xl text-slate-300 hover:text-rose-500" onClick={() => handleDeleteTask(task.id)}>
                        <Icons.Trash2 className="w-4 h-4" />
                      </NeuButton>
                    )}
                    
                    {role === 'super_admin' && task.status === 'pending_review' && (
                       <NeuButton variant="primary" className="h-10 px-6 rounded-xl text-xs font-black uppercase italic" onClick={() => DataService.updateMicroTaskStatus(task.id, 'open')}>
                         Release Mission
                       </NeuButton>
                    )}
                  </div>
                </div>
                
                {task.status === 'claimed' && (
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic pt-2">
                     Held by {task.claimedByName || 'Unknown Agent'}
                   </p>
                )}
              </NeuCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
