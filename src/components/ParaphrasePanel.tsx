import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, Loader2, ArrowRight } from 'lucide-react';
import { paraphraseText } from '../services/gemini';
import { db, auth, collection, addDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';

interface ParaphrasePanelProps {
  content: string;
  docId: string;
  onParaphraseGenerated?: (text: string) => void;
}

export default function ParaphrasePanel({ content, docId, onParaphraseGenerated }: ParaphrasePanelProps) {
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [paraphrase, setParaphrase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setRated(null);
    try {
      const result = await paraphraseText(content, level);
      setParaphrase(result);
      if (onParaphraseGenerated) onParaphraseGenerated(result);
      
      // Save to Firestore
      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'paraphrases'), {
            docId,
            userId: auth.currentUser.uid,
            level,
            text: result,
            createdAt: serverTimestamp()
          });
        } catch (dbError) {
          console.error('Firestore save error:', dbError);
          handleFirestoreError(dbError, OperationType.CREATE, 'paraphrases');
        }
      }
    } catch (error) {
      console.error('Paraphrasing error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (paraphrase) {
      navigator.clipboard.writeText(paraphrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRate = async (rating: 'up' | 'down') => {
    if (!paraphrase || rated || !auth.currentUser) return;
    setRated(rating);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        targetType: 'paraphrase',
        targetId: docId,
        rating,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Feedback error:', error);
      handleFirestoreError(error, OperationType.CREATE, 'feedback');
    }
  };

  return (
    <div className="glass-morphism rounded-[32px] p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[24px] font-display font-bold text-white">Paraphrasing</h2>
        <div className="flex bg-white/5 border border-white/10 rounded-full p-1">
          {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 md:px-6 py-2 rounded-full text-[11px] md:text-[13px] font-bold uppercase tracking-wider transition-all ${
                level === l ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        {!paraphrase && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-[24px] bg-white/[0.02]">
            <p className="text-white/40 mb-6 font-medium">Select level and generate paraphrase</p>
            <button
              onClick={handleGenerate}
              className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all"
            >
              Generate Paraphrase
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-8">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-6">Original Context</h4>
                <p className="text-[16px] leading-relaxed text-white/60 line-clamp-[12]">{content}</p>
              </div>
              <div className="relative bg-white/[0.05] border border-white/10 rounded-[24px] p-8 min-h-[100px]">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/60 mb-6">Paraphrased Result</h4>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <p className="text-[18px] leading-relaxed text-white whitespace-pre-wrap">{paraphrase}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleRate('up')}
                  className={`p-3 rounded-full transition-all ${rated === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40 hover:text-white'}`}
                >
                  <ThumbsUp className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleRate('down')}
                  className={`p-3 rounded-full transition-all ${rated === 'down' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40 hover:text-white'}`}
                >
                  <ThumbsDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-6">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="text-[13px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-all"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
