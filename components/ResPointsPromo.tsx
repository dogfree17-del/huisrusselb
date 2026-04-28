import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NeuButton } from './NeuComponents';

const IconStar = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconGift = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const IconTrendingUp = ({ className = "" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export const ResPointsPromo = ({ onClose }: { onClose: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slight delay before showing the modal
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 400); // Wait for exit animation
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      }
    },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0, scale: 0.95 },
    visible: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 md:p-20 bg-slate-900/60 backdrop-blur-md"
        >
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-sm bg-white rounded-[3rem] shadow-2xl overflow-hidden relative"
          >
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-neu-accent/20 to-transparent -z-10" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-neu-accent/10 rounded-full blur-3xl -z-10" />
            
            <div className="p-6 md:p-8">
              <motion.div variants={itemVariants} className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neu-accent/10 text-neu-accent mb-4">
                  <IconStar className="w-7 h-7" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-3">
                  Introducing <span className="text-neu-accent">Res Points</span>
                </h2>
                <p className="text-slate-500 text-base max-w-xs mx-auto">
                  Get rewarded for your participation and contribution to the house community.
                </p>
              </motion.div>

              <div className="space-y-3 mb-8">
                <motion.div variants={itemVariants} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <IconStar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Earn Points</h3>
                    <p className="text-xs text-slate-500">Attend events and participate in polls.</p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <IconTrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Level Up</h3>
                    <p className="text-xs text-slate-500">Climb the house spirit leaderboard.</p>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                    <IconGift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Get Rewards</h3>
                    <p className="text-xs text-slate-500">Unlock special perks and exclusive merch.</p>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={itemVariants} className="flex flex-col gap-3 justify-center">
                <NeuButton variant="primary" onClick={handleClose} className="px-8 py-3 text-base w-full">
                  Start Earning
                </NeuButton>
                <NeuButton variant="ghost" onClick={handleClose} className="px-8 py-3 text-base w-full">
                  Maybe Later
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
