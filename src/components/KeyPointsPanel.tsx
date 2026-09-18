import React, { useEffect, useState } from 'react';
import { extractKeyPoints } from '../services/gemini';
import { ListChecks, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface KeyPointsPanelProps {
  content: string;
}

export default function KeyPointsPanel({ content }: KeyPointsPanelProps) {
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchKeyPoints = async () => {
      try {
        const points = await extractKeyPoints(content);
        setKeyPoints(points);
      } catch (error) {
        console.error('Error fetching key points:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeyPoints();
  }, [content]);

  return (
    <div className="glass-morphism rounded-[32px] p-10 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <ListChecks className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-[24px] font-display font-bold text-white">Key Insights</h2>
        </div>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />}
      </div>

      <div>
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40">
            <p className="text-[14px] font-medium animate-pulse">Extracting top insights...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keyPoints.map((point, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[12px] font-bold text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                  {index + 1}
                </div>
                <p className="text-[16px] leading-relaxed text-white/80 group-hover:text-white transition-colors">
                  {point}
                </p>
              </motion.div>
            ))}
            {keyPoints.length === 0 && (
              <p className="text-center text-white/40 py-8">No key insights detected.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
