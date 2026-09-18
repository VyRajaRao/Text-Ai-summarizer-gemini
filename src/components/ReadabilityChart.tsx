import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts';
import { motion } from 'motion/react';

interface ReadabilityChartProps {
  data: {
    fleschKincaid: number;
    gunningFog: number;
    smog: number;
    gradeLevel: string;
  };
}

export default function ReadabilityChart({ data }: ReadabilityChartProps) {
  if (!data) return null;

  // Normalize data for the radar chart
  // Flesch-Kincaid: 0-100 (higher is easier, so we invert it for "complexity")
  // Gunning Fog: 0-20 (grade level)
  // SMOG: 0-20 (grade level)
  
  const chartData = [
    { subject: 'Sentence Length', A: Math.min(data.gunningFog * 5, 100), fullMark: 100 },
    { subject: 'Word Complexity', A: Math.min(data.smog * 5, 100), fullMark: 100 },
    { subject: 'Density', A: Math.min((100 - data.fleschKincaid), 100), fullMark: 100 },
    { subject: 'Academic Weight', A: Math.min(data.gunningFog * 4, 100), fullMark: 100 },
    { subject: 'Technical Depth', A: Math.min(data.smog * 4.5, 100), fullMark: 100 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-white rounded-[32px] border border-black/5 p-8 shadow-sm"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-black/40 mb-1">Complexity Matrix</h3>
          <p className="text-[24px] font-bold text-[#111111]">Visual Analysis</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-bold uppercase tracking-wider text-black/40 mb-1">Overall Score</p>
          <p className="text-[24px] font-bold text-emerald-500">{data.gradeLevel.split(' ')[0]}</p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#F0F0F0" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#999999', fontSize: 10, fontWeight: 600 }} 
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Complexity"
              dataKey="A"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 pt-8 border-t border-black/5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 mb-1">Structure</p>
          <p className="text-[14px] font-medium text-[#111111]">Highly Systematic</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-black/40 mb-1">Vocabulary</p>
          <p className="text-[14px] font-medium text-[#111111]">Technical Grade</p>
        </div>
      </div>
    </motion.div>
  );
}
