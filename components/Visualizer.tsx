import React from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  // Create 5 bars
  const bars = [0, 1, 2, 3, 4];
  
  return (
    <div className="flex items-center justify-center space-x-1 h-12">
      {bars.map((i) => {
        // Calculate dynamic height based on volume and index to create a wave
        // Small randomization to make it look organic
        const height = isActive 
            ? Math.max(4, Math.min(48, volume * 100 * (1 + Math.random() * 0.5)))
            : 4;
            
        return (
          <div
            key={i}
            className={`w-3 rounded-full transition-all duration-75 ${isActive ? 'bg-blue-400' : 'bg-gray-600'}`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

export default Visualizer;