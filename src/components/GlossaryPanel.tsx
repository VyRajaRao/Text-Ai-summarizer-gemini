import React, { useEffect, useState } from 'react';
import { generateGlossary } from '../services/gemini';
import { Book, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface GlossaryPanelProps {
  content: string;
}

export default function GlossaryPanel({ content }: GlossaryPanelProps) {
  const [glossary, setGlossary] = useState<{ term: string; definition: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGlossary = async () => {
      try {
        const generated = await generateGlossary(content);
        setGlossary(generated);
      } catch (error) {
        console.error('Error generating glossary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGlossary();
  }, [content]);

  return (
    <div className="glass-morphism rounded-[32px] p-10 shadow-sm">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
          <Book className="w-5 h-5 text-amber-400" />
        </div>
        <h2 className="text-[24px] font-display font-bold text-white">Technical Glossary</h2>
      </div>

      <div>
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
            <p className="text-[14px] font-medium">Building glossary...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {glossary.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
              >
                <h4 className="text-[18px] font-bold text-amber-400 mb-2">{item.term}</h4>
                <p className="text-[14px] leading-relaxed text-white/60">
                  {item.definition}
                </p>
              </motion.div>
            ))}
            {glossary.length === 0 && (
              <p className="text-center text-white/40 col-span-2 py-8">No technical terms detected.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
