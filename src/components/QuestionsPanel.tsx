import React, { useEffect, useState } from 'react';
import { generateQuestions } from '../services/gemini';
import { HelpCircle, Loader2, BookOpen, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';

interface QuestionsPanelProps {
  content: string;
}

export default function QuestionsPanel({ content }: QuestionsPanelProps) {
  const [questions, setQuestions] = useState<{ question: string; type: 'comprehension' | 'conceptual' }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const generated = await generateQuestions(content);
        setQuestions(generated);
      } catch (error) {
        console.error('Error generating questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [content]);

  return (
    <div className="glass-morphism rounded-[32px] p-10 shadow-sm">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
          <HelpCircle className="w-5 h-5 text-purple-400" />
        </div>
        <h2 className="text-[24px] font-display font-bold text-white">Study Questions</h2>
      </div>

      <div>
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-white/40">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-500" />
            <p className="text-[14px] font-medium">Generating study materials...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {questions.map((q, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  {q.type === 'comprehension' ? <BookOpen className="w-12 h-12" /> : <Lightbulb className="w-12 h-12" />}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                    q.type === 'comprehension' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {q.type}
                  </span>
                </div>
                <p className="text-[16px] font-medium text-white/80 group-hover:text-white leading-relaxed relative z-10">
                  {q.question}
                </p>
              </motion.div>
            ))}
            {questions.length === 0 && (
              <p className="text-center text-white/40 col-span-2 py-8">No questions generated.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
