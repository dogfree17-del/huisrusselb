import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NeuButton } from './NeuComponents';
import { GraduationCap, Users, FolderRoot, Sparkles } from 'lucide-react';

export const AcademiaPromo = ({ onClose }: { onClose: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 400);
  };

  const containerVariants: any = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  const itemVariants: any = {
    hidden: { y: 10, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 25 }
    }
  };

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 bg-slate-900/80 backdrop-blur-xl"
        >
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative border-8 border-slate-900"
          >
            {/* Header Graphic */}
            <div className="h-40 bg-slate-900 flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-[#FF6321] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#00FF00] rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
               </div>
               <motion.div 
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10"
               >
                 <GraduationCap className="w-20 h-20 text-[#FF6321]" strokeWidth={2.5} />
               </motion.div>
            </div>
            
            <div className="p-8 md:p-10 space-y-8">
              <motion.div variants={itemVariants} className="text-center space-y-3">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                  Neural <span className="text-[#FF6321]">Academia</span>
                </h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">The Intellectual Frontier is Open</p>
              </motion.div>

              <div className="grid gap-4">
                <motion.div variants={itemVariants} className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 group hover:border-[#FF6321] transition-colors">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 text-[#FF6321] flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] group-hover:shadow-[4px_4px_0px_0px_rgba(255,99,33,1)] transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase italic tracking-tighter">Academic Allies</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connect with coursemates in the res.</p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 group hover:border-[#00FF00] transition-colors">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 text-[#00FF00] flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] group-hover:shadow-[4px_4px_0px_0px_rgba(0,255,0,1)] transition-all">
                    <FolderRoot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase italic tracking-tighter">Knowledge Stack</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deposit intel & earn 0.5 Res Points.</p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex items-center gap-5 p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 group hover:border-indigo-500 transition-colors">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] group-hover:shadow-[4px_4px_0px_0px_rgba(99,102,241,1)] transition-all">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase italic tracking-tighter">AI CV Architect</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engineer ATS-friendly CVs with Gemini.</p>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={itemVariants} className="flex flex-col gap-3">
                <NeuButton variant="primary" onClick={handleClose} className="py-5 text-sm font-black uppercase tracking-[0.2em] italic bg-slate-900 text-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(255,99,33,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                  Access Portal
                </NeuButton>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
