import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check, Loader2, Zap, Sparkles, AlertCircle, FileText, Lightbulb, CheckSquare, Settings } from 'lucide-react';
import { summarizeText } from '../services/gemini';
import { RAGSummarizerService, RAGSummaryOutput } from '../services/ragSummarizer';
import { db, auth, collection, addDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';

interface SummaryPanelProps {
  content: string;
  docId: string;
  onSummaryGenerated?: (summary: string) => void;
}

export default function SummaryPanel({ content, docId, onSummaryGenerated }: SummaryPanelProps) {
  const [mode, setMode] = useState<'standard' | 'rag'>('standard');
  const [summary, setSummary] = useState<string | null>(null);
  const [ragSummary, setRagSummary] = useState<RAGSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  const length = 'short';

  const calculateStats = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    const readingTime = Math.ceil(words / 200);
    return { words, readingTime };
  };

  const originalStats = calculateStats(content);
  
  const getSummaryStats = () => {
    if (mode === 'rag' && ragSummary) {
      const fullText = [
        ragSummary.executiveSummary,
        ...ragSummary.keyInsights,
        ...ragSummary.importantFacts,
        ...ragSummary.technicalConcepts
      ].join(' ');
      return calculateStats(fullText);
    }
    return summary ? calculateStats(summary) : null;
  };

  const summaryStats = getSummaryStats();
  const compressionRatio = summaryStats ? Math.round((1 - summaryStats.words / originalStats.words) * 100) : null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setRated(null);
    try {
      if (mode === 'rag') {
        const result = await RAGSummarizerService.generateRAGSummary(content, docId);
        setRagSummary(result);
        if (onSummaryGenerated) onSummaryGenerated(result.executiveSummary);
        
        // Save to Firestore
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, 'summaries'), {
              docId,
              userId: auth.currentUser.uid,
              mode: 'rag',
              text: JSON.stringify(result),
              createdAt: serverTimestamp()
            });
          } catch (dbError) {
            console.error('Firestore save error:', dbError);
            handleFirestoreError(dbError, OperationType.CREATE, 'summaries');
          }
        }
      } else {
        const result = await summarizeText(content, length);
        setSummary(result);
        if (onSummaryGenerated) onSummaryGenerated(result);
        
        // Save to Firestore
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, 'summaries'), {
              docId,
              userId: auth.currentUser.uid,
              length,
              mode: 'standard',
              text: result,
              createdAt: serverTimestamp()
            });
          } catch (dbError) {
            console.error('Firestore save error:', dbError);
            handleFirestoreError(dbError, OperationType.CREATE, 'summaries');
          }
        }
      }
    } catch (error: any) {
      console.error('Summarization error:', error);
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429')) {
        setError("API Quota exceeded. Please wait a moment or try again tomorrow.");
      } else {
        setError("Failed to generate summary. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    let copyText = '';
    if (mode === 'rag' && ragSummary) {
      copyText = `EXECUTIVE SUMMARY:\n${ragSummary.executiveSummary}\n\nKEY INSIGHTS:\n${ragSummary.keyInsights.join('\n')}\n\nIMPORTANT FACTS:\n${ragSummary.importantFacts.join('\n')}\n\nTECHNICAL CONCEPTS:\n${ragSummary.technicalConcepts.join('\n')}`;
    } else if (summary) {
      copyText = summary;
    }

    if (copyText) {
      navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRate = async (rating: 'up' | 'down') => {
    const hasData = mode === 'rag' ? !!ragSummary : !!summary;
    if (!hasData || rated || !auth.currentUser) return;
    setRated(rating);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser.uid,
        targetType: mode === 'rag' ? 'rag_summary' : 'summary',
        targetId: docId,
        rating,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Feedback error:', error);
      handleFirestoreError(error, OperationType.CREATE, 'feedback');
    }
  };

  const isCurrentModeEmpty = mode === 'rag' ? !ragSummary : !summary;

  return (
    <div className="glass-morphism rounded-[32px] p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-[24px] font-display font-bold text-white leading-tight">Document Summary</h2>
            <p className="text-[12px] text-white/40 font-medium">Distill document core elements to structured knowledge</p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 self-start md:self-auto">
          <button
            onClick={() => {
              if (isLoading) return;
              setMode('standard');
            }}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all ${
              mode === 'standard' ? 'bg-white text-black' : 'text-white/40 hover:text-white'
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => {
              if (isLoading) return;
              setMode('rag');
            }}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              mode === 'rag' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-emerald-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Structured RAG
          </button>
        </div>
      </div>

      <div>
        {isCurrentModeEmpty && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-[24px] bg-white/[0.02]">
            <div className="flex items-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/20 mb-1">Original</p>
                <p className="text-[20px] font-display font-bold text-white">{originalStats.words} words</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/20 mb-1">Read Time</p>
                <p className="text-[20px] font-display font-bold text-white">{originalStats.readingTime} min</p>
              </div>
            </div>
            
            {mode === 'rag' ? (
              <div className="text-center max-w-[450px] mb-6 px-4">
                <p className="text-emerald-400 font-bold uppercase text-[11px] tracking-widest mb-1">Advanced Knowledge Engine</p>
                <p className="text-white/40 text-[14px] leading-relaxed">
                  Performs paragraph-based vector similarity, hierarchical chunk parsing, and output formatting.
                  Grounded to eliminate hallucinations.
                </p>
              </div>
            ) : (
              <p className="text-white/40 mb-6 font-medium">Generate a quick standard short summary paragraph.</p>
            )}

            <button
              onClick={handleGenerate}
              className={`px-8 py-3 rounded-full font-bold hover:scale-105 transition-all ${
                mode === 'rag' ? 'bg-emerald-500 text-black' : 'bg-white text-black'
              }`}
            >
              {mode === 'rag' ? 'Generate RAG Summary' : 'Generate Summary'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Words</p>
                <p className="text-[18px] font-display font-bold text-white">{summaryStats?.words}</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Reduction</p>
                <p className="text-[18px] font-display font-bold text-emerald-400">-{compressionRatio}%</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Read Time</p>
                <p className="text-[18px] font-display font-bold text-white">{summaryStats?.readingTime} min</p>
              </div>
            </div>

            {/* Response Section */}
            <div className="relative bg-white/[0.03] border border-white/5 rounded-[24px] p-6 md:p-8 min-h-[100px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                  <p className="text-[12px] font-bold uppercase tracking-widest">
                    {mode === 'rag' ? 'Executing LangChain-Style RAG Pipeline...' : 'Generating Summary...'}
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center text-center p-8">
                  <p className="text-red-400 font-medium mb-4">{error}</p>
                  <button
                    onClick={handleGenerate}
                    className="text-[13px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : mode === 'rag' && ragSummary ? (
                // Structured RAG Display
                <div className="space-y-6">
                  {/* Executive Summary */}
                  <div className="space-y-2 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <FileText className="w-5 h-5" />
                      <h4 className="text-[14px] font-bold uppercase tracking-wider">Executive Summary</h4>
                    </div>
                    <p className="text-[17px] leading-relaxed text-white/80 font-medium">
                      {ragSummary.executiveSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Key Insights */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <Lightbulb className="w-4 h-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest">Key Insights</h4>
                      </div>
                      <ul className="space-y-2">
                        {ragSummary.keyInsights.map((insight, idx) => (
                          <li key={idx} className="text-[13px] text-white/60 leading-relaxed list-disc list-inside">
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Important Facts */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-orange-400">
                        <CheckSquare className="w-4 h-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest">Important Facts</h4>
                      </div>
                      <ul className="space-y-2">
                        {ragSummary.importantFacts.map((fact, idx) => (
                          <li key={idx} className="text-[13px] text-white/60 leading-relaxed list-disc list-inside">
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Technical Concepts */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-pink-400">
                        <Settings className="w-4 h-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest">Technical Concepts</h4>
                      </div>
                      <ul className="space-y-2">
                        {ragSummary.technicalConcepts.map((concept, idx) => (
                          <li key={idx} className="text-[13px] text-white/60 leading-relaxed list-disc list-inside">
                            {concept}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                // Standard Summary Paragraph
                <p className="text-[18px] leading-relaxed text-white/80 whitespace-pre-wrap">{summary}</p>
              )}
            </div>

            {/* Actions Bar */}
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
