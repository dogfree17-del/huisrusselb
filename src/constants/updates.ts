export interface AppUpdate {
  id: string;
  date: string;
  title: string;
  description: string;
}

export const APP_UPDATES: AppUpdate[] = [
  {
    id: 'update-5',
    date: '2026-04-18',
    title: 'Intelligent Storage Fix',
    description: 'Resolved critical image upload errors with automated bucket fallback and MIME-type verification.'
  },
  {
    id: 'update-4',
    date: '2026-04-18',
    title: 'Adaptive Broadcast UI',
    description: 'Smaller footprint with randomized screen positioning and intelligent context-aware redirects.'
  },
  {
    id: 'update-3',
    date: '2026-04-18',
    title: 'Mission Control Refined',
    description: 'Missions UI improved with a sleek 2-tab layout and clearer task lifecycle tracking.'
  },
  {
    id: 'update-2',
    date: '2026-04-18',
    title: 'Security Protocol Upgrade',
    description: 'Simplified login flow with enhanced focus on secure password reset flows.'
  },
  {
    id: 'update-1',
    date: '2026-04-18',
    title: 'Res Points Economy',
    description: 'Launched AI-driven task analysis and point recruitment system.'
  }
];
