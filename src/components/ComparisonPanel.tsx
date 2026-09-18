import React, { useEffect, useState } from 'react';
import { summarizeText } from '../services/gemini';
import { EmbeddingService } from '../services/embeddingService';
import { Columns, Loader2, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface SummaryData {
  text: string;
  similarity: number;
}

interface ComparisonPanelProps {
  content: string;
}

export default function ComparisonPanel({ content }: ComparisonPanelProps) {
  const [summaries, setSummaries] = useState<{ short: SummaryData; medium: SummaryData; long: SummaryData } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSummariesAndSimilarity = async () => {
      try {
        // 1. Generate summaries
        const [shortText, mediumText, longText] = await Promise.all([
          summarizeText(content, 'short'),
          summarizeText(content, 'medium'),
          summarizeText(content, 'long')
        ]);

        // 2. Generate embeddings for original and summaries
        const [originalVec, ...summaryVecs] = await EmbeddingService.getBatchEmbeddings([
          content,
          shortText,
          mediumText,
          longText
        ]);

        // 3. Calculate similarities
        setSummaries({
          short: { text: shortText, similarity: EmbeddingService.cosineSimilarity(originalVec, summaryVecs[0]) },
          medium: { text: mediumText, similarity: EmbeddingService.cosineSimilarity(originalVec, summaryVecs[1]) },
          long: { text: longText, similarity: EmbeddingService.cosineSimilarity(originalVec, summaryVecs[2]) }
        });
      } catch (error) {
        console.error('Error fetching summaries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummariesAndSimilarity();
  }, [content]);

  const calculateReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  return (
    <div className="glass-morphism rounded-[32px] p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
          <Columns className="w-5 h-5 text-indigo-400" />
        </div>
        <h2 className="text-[24px] font-display font-bold text-white">Summary Comparison</h2>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-white/40">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
          <p className="text-[14px] font-medium">Generating multi-level summaries...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[
            { title: 'Short Summary', data: summaries?.short, color: 'emerald' },
            { title: 'Medium Summary', data: summaries?.medium, color: 'blue' },
            { title: 'Long Summary', data: summaries?.long, color: 'purple' }
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col bg-white/[0.02] border border-white/5 rounded-[32px] p-8 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-bottom border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-8 rounded-full bg-${s.color}-500/50`} />
                  <h3 className="text-[22px] font-display font-bold text-white">{s.title}</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-white/30 uppercase tracking-[0.15em]">
                    <Clock className="w-4 h-4" />
                    {calculateReadingTime(s.data?.text || '')} min read
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-400 uppercase tracking-[0.15em]">
                    <Zap className="w-4 h-4" />
                    {Math.round((s.data?.similarity || 0) * 100)}% Match
                  </div>
                </div>
              </div>
              <div className="prose prose-invert max-w-none">
                <p className="text-[17px] leading-[1.8] text-white/70 whitespace-pre-wrap font-medium">
                  {s.data?.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
