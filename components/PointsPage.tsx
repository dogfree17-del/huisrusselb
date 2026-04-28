import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { useData } from '../contexts/DataContext';
import { User } from '../types';
import { Trophy, TrendingUp, TrendingDown, Minus, Award, Star } from 'lucide-react';
import { NeuCard } from './NeuComponents';

export const PointsPage = () => {
  const { users, pointAwards } = useData();

  const leaderboardData = useMemo(() => {
    // 1. Current ranking
    const currentRanking = [...users].sort((a, b) => (b.points || 0) - (a.points || 0));

    // 2. Calculate points 7 days ago
    const userMap = new Map<string, { currentPoints: number, pointsGained: number, oldPoints: number }>();
    
    users.forEach(u => {
      userMap.set(u.uid, { currentPoints: u.points || 0, pointsGained: 0, oldPoints: u.points || 0 });
    });

    pointAwards.forEach(award => {
      const entry = userMap.get(award.targetUid || award.userId);
      if (entry) {
        entry.pointsGained += award.points || 0;
      }
    });

    users.forEach(u => {
      const entry = userMap.get(u.uid);
      if (entry) {
        entry.oldPoints = entry.currentPoints - entry.pointsGained;
      }
    });

    // 3. Old ranking
    const oldRanking = [...users].sort((a, b) => {
      const oldA = userMap.get(a.uid)?.oldPoints || 0;
      const oldB = userMap.get(b.uid)?.oldPoints || 0;
      return oldB - oldA;
    });

    const oldRankMap = new Map<string, number>();
    oldRanking.forEach((u, index) => {
      oldRankMap.set(u.uid, index + 1);
    });

    // 4. Final List
    return currentRanking.map((user, index) => {
      const stats = userMap.get(user.uid);
      const currentRank = index + 1;
      const oldRank = oldRankMap.get(user.uid) || currentRank;
      const rankDiff = oldRank - currentRank; // positive means moved up

      return {
        user,
        rank: currentRank,
        oldRank,
        rankDiff,
        pointsGained: stats?.pointsGained || 0,
        points: user.points || 0
      };
    });
  }, [users, pointAwards]);

  const topThree = leaderboardData.slice(0, 3);
  const rest = leaderboardData.slice(3);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6321] rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
            <Trophy className="w-8 h-8 text-[#FF6321]" />
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">The Hall of <span className="text-[#FF6321]">Merit</span></h1>
            <p className="text-white/50 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Collective intelligence standing</p>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-3 items-end px-2">
        {/* Rank 2 */}
        {topThree[1] && (
          <div className="flex flex-col items-center gap-3">
             <div className="relative">
               <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-slate-200">
                  <img 
                    src={topThree[1].user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${topThree[1].user.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
               </div>
               <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center font-black text-slate-600 shadow-lg italic">2</div>
             </div>
             <div className="text-center w-full">
               <p className="font-black uppercase tracking-tighter text-[10px] truncate">{topThree[1].user.displayName}</p>
               <p className="text-[#FF6321] font-black italic text-xs">{topThree[1].points.toFixed(2)} RP</p>
             </div>
          </div>
        )}

        {/* Rank 1 */}
        {topThree[0] && (
          <div className="flex flex-col items-center gap-3 pb-6">
             <div className="relative">
               <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500"
               >
                 <Star className="fill-current w-6 h-6" />
               </motion.div>
               <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-yellow-500 shadow-2xl">
                  <img 
                    src={topThree[0].user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${topThree[0].user.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
               </div>
               <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center font-black text-white shadow-lg italic text-lg border-2 border-white">1</div>
             </div>
             <div className="text-center w-full">
               <p className="font-black uppercase tracking-tighter text-xs truncate">{topThree[0].user.displayName}</p>
               <p className="text-[#FF6321] font-black italic text-sm">{topThree[0].points.toFixed(2)} RP</p>
             </div>
          </div>
        )}

        {/* Rank 3 */}
        {topThree[2] && (
          <div className="flex flex-col items-center gap-3">
             <div className="relative">
               <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-orange-200">
                  <img 
                    src={topThree[2].user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${topThree[2].user.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
               </div>
               <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center font-black text-orange-700 shadow-lg italic">3</div>
             </div>
             <div className="text-center w-full">
               <p className="font-black uppercase tracking-tighter text-[10px] truncate">{topThree[2].user.displayName}</p>
               <p className="text-[#FF6321] font-black italic text-xs">{topThree[2].points.toFixed(2)} RP</p>
             </div>
          </div>
        )}
      </div>

      {/* Leaderboard List */}
      <div className="space-y-4 px-1">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4">Global List</h3>
        <div className="space-y-2">
          {leaderboardData.map((entry, i) => (
            <motion.div
              key={entry.user.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group"
            >
              <NeuCard className="p-4 bg-white border-2 border-slate-100 flex items-center gap-4 hover:border-[#FF6321] transition-all">
                <div className="w-8 font-black italic text-slate-300 text-lg group-hover:text-slate-900">{entry.rank}</div>
                
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                   <img 
                    src={entry.user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.user.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-black uppercase tracking-tighter truncate text-sm">{entry.user.displayName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prev: #{entry.oldRank}</span>
                    {entry.rankDiff > 0 ? (
                      <span className="flex items-center text-green-500 text-[10px] font-bold uppercase tracking-widest">
                        <TrendingUp className="w-3 h-3 mr-1" /> {entry.rankDiff}
                      </span>
                    ) : entry.rankDiff < 0 ? (
                      <span className="flex items-center text-red-500 text-[10px] font-bold uppercase tracking-widest">
                        <TrendingDown className="w-3 h-3 mr-1" /> {Math.abs(entry.rankDiff)}
                      </span>
                    ) : (
                      <span className="flex items-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                        <Minus className="w-3 h-3 mr-1" />
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900 italic leading-none">{entry.points.toFixed(2)} <span className="text-[10px] uppercase tracking-widest not-italic opacity-40">RP</span></p>
                  <p className="text-[10px] font-black text-[#00FF00] uppercase tracking-widest mt-1">+{entry.pointsGained.toFixed(2)} 7D</p>
                </div>
              </NeuCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
