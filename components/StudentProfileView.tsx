import React from 'react';
import { motion } from 'motion/react';
import { useData } from '../contexts/DataContext';
import { NeuCard, NeuBadge } from './NeuComponents';
import { Icons } from './Icons';

interface StudentProfileViewProps {
  uid: string;
  onClose: () => void;
}

export const StudentProfileView = ({ uid, onClose }: StudentProfileViewProps) => {
  const { users } = useData();
  const student = users.find(u => u.uid === uid);

  if (!student) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <NeuCard className="p-8 space-y-6 relative border-4 border-slate-900 shadow-[12px_12px_0px_0px_rgba(255,99,33,1)] overflow-hidden bg-white">
          <div className="absolute top-0 right-0 p-4">
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
               <Icons.X className="w-6 h-6 text-slate-400" />
             </button>
          </div>

          <div className="flex flex-col items-center text-center space-y-4">
             <div className="relative">
                <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-slate-900 shadow-xl">
                   <img 
                    src={student.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-[#FF6321] text-white p-2 rounded-xl shadow-lg border-2 border-white">
                  <Icons.GraduationCap className="w-5 h-5" />
                </div>
             </div>

             <div>
               <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">{student.displayName}</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{student.course || student.courseName || 'Neural Explorer'}</p>
             </div>

             <div className="flex flex-wrap justify-center gap-2">
                <NeuBadge className="bg-slate-100 text-slate-600 border-none px-3 py-1 font-black italic uppercase tracking-widest">RANK: {(student.points || 0).toFixed(2)} RP</NeuBadge>
                {student.roomNumber && student.roomNumber !== 'Unassigned' && (
                  <NeuBadge className="bg-emerald-100 text-emerald-700 border-none px-3 py-1 font-black italic uppercase tracking-widest">RM {student.roomNumber}</NeuBadge>
                )}
             </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
             <div className="flex items-center gap-3">
               <Icons.Mail className="w-4 h-4 text-slate-400" />
               <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{student.email}</span>
             </div>
             {student.phoneNumber && (
               <div className="flex items-center gap-3">
                 <Icons.Phone className="w-4 h-4 text-slate-400" />
                 <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{student.phoneNumber}</span>
               </div>
             )}
          </div>

          <div className="pt-2">
            <a 
              href={`https://wa.me/${student.phoneNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-16 bg-[#25D366] text-white rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-lg shadow-emerald-500/20 font-black uppercase tracking-widest italic"
            >
              <Icons.MessageSquare className="w-6 h-6" />
              Intelligence Exchange
            </a>
          </div>
        </NeuCard>
      </motion.div>
    </motion.div>
  );
};
