import React, { useEffect, useState } from 'react';
import { detectTopics } from '../services/gemini';
import { Hash, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface TopicsPanelProps {
  content: string;
}

export default function TopicsPanel({ content }: TopicsPanelProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const detected = await detectTopics(content);
        setTopics(detected);
      } catch (error) {
        console.error('Error detecting topics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, [content]);

  return (
    <div className="glass-morphism rounded-[32px] p-10 shadow-sm">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
          <Hash className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-[24px] font-display font-bold text-white">Main Themes</h2>
      </div>

      <div>
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-white/40">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-[14px] font-medium">Detecting topics...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {topics.map((topic, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[14px] font-bold text-white/60 hover:text-white hover:border-white/30 transition-all cursor-default"
              >
                # {topic}
              </motion.span>
            ))}
            {topics.length === 0 && (
              <p className="text-center text-white/40 w-full py-4">No topics detected.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
