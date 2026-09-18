import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, collection, addDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { analyzeReadability } from '../services/gemini';
import ReadabilityChart from '../components/ReadabilityChart';
import SummaryPanel from '../components/SummaryPanel';
import ParaphrasePanel from '../components/ParaphrasePanel';
import KeyPointsPanel from '../components/KeyPointsPanel';
import TopicsPanel from '../components/TopicsPanel';
import QuestionsPanel from '../components/QuestionsPanel';
import GlossaryPanel from '../components/GlossaryPanel';
import ChatPanel from '../components/ChatPanel';
import ComparisonPanel from '../components/ComparisonPanel';
import ExportButton from '../components/ExportButton';
import { Loader2, ArrowLeft, FileText, BarChart3, Cpu, LayoutGrid, MessageSquare, BookOpen, HelpCircle } from 'lucide-react';

export default function ResultsPage() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [docData, setDocData] = useState<{ content: string; title: string; id?: string } | null>(null);
  const [readability, setReadability] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [paraphrase, setParaphrase] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'chat' | 'comparison'>('analysis');
  const [analysisView, setAnalysisView] = useState<'all' | 'insights' | 'tools' | 'metrics'>('all');

  useEffect(() => {
    const temp = sessionStorage.getItem('temp_doc');
    if (!temp) {
      navigate('/');
      return;
    }
    
    const parsed = JSON.parse(temp);
    setDocData(parsed);

    const init = async () => {
      try {
        const scores = await analyzeReadability(parsed.content);
        if (!scores) throw new Error("Failed to analyze readability");
        setReadability(scores);

        // Save document to Firestore if user is logged in
        if (user) {
          try {
            const docRef = await addDoc(collection(db, 'documents'), {
              userId: user.uid,
              title: parsed.title,
              content: parsed.content,
              readability: scores,
              createdAt: serverTimestamp()
            });
            setDocData(prev => prev ? { ...prev, id: docRef.id } : null);
          } catch (dbError) {
            console.error('Firestore save error:', dbError);
            handleFirestoreError(dbError, OperationType.CREATE, 'documents');
          }
        }
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(err.message || "An unexpected error occurred during analysis.");
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-dark">
        <Loader2 className="w-16 h-16 animate-spin text-emerald-500 mb-8" />
        <div className="text-center">
          <p className="text-[24px] font-display font-bold text-white mb-2">Analyzing Intelligence</p>
          <p className="text-[16px] text-white/40 font-medium">Gemini 3.1 Pro is processing your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-dark p-8">
        <div className="max-w-[500px] w-full glass-morphism rounded-[32px] p-12 text-center border border-white/10">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
            <Loader2 className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-[32px] font-display font-bold text-white mb-4">Analysis Failed</h1>
          <p className="text-[16px] text-white/40 mb-12 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-full bg-white text-black font-bold hover:scale-[1.02] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!docData || !readability) return null;

  const showSection = (section: string) => {
    if (analysisView === 'all') return true;
    if (analysisView === 'insights') return ['summary', 'keypoints', 'topics'].includes(section);
    if (analysisView === 'tools') return ['paraphrase', 'glossary', 'questions'].includes(section);
    if (analysisView === 'metrics') return ['metrics', 'model'].includes(section);
    return false;
  };

  return (
    <div className="min-h-screen bg-bg-dark flex flex-col">
      {/* Sticky Header Section */}
      <header className="sticky top-0 z-40 bg-bg-dark/80 backdrop-blur-xl flex-shrink-0 pt-24 md:pt-32 pb-8 px-8 border-b border-white/5">
        <div className="max-w-full mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/')}
              className="w-12 h-12 glass-morphism rounded-full flex-shrink-0 flex items-center justify-center shadow-lg hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-white/40 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Analysis Engine</span>
              </div>
              <h1 className="text-[24px] md:text-[32px] font-display font-bold text-white tracking-tight leading-tight truncate max-w-[300px] md:max-w-[600px]">{docData.title}</h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex bg-white/5 border border-white/10 rounded-full p-1">
              {(['analysis', 'chat', 'comparison'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 md:px-6 py-2 rounded-full text-[11px] md:text-[13px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ExportButton 
              title={docData.title} 
              content={docData.content} 
              summary={summary} 
              paraphrase={paraphrase} 
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-full mx-auto">
          {activeTab === 'analysis' && (
            <div className="space-y-8">
              {/* Sub-navigation for Analysis */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                {(['all', 'insights', 'tools', 'metrics'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setAnalysisView(view)}
                    className={`px-6 py-2.5 rounded-2xl text-[12px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      analysisView === view ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/40 hover:text-white border border-white/5'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-8">
                {/* 1. Metrics Card */}
                {showSection('metrics') && (
                  <div className="glass-morphism rounded-[32px] p-8">
                    <div className="flex items-center gap-2 text-white/40 mb-8">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Core Metrics</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="space-y-8">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-wider text-white/30 mb-2">Grade Level</p>
                          <p className="text-[48px] font-display font-bold text-white leading-none">{readability.gradeLevel}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-2">Flesch-Kincaid</p>
                            <p className="text-[24px] font-display font-bold text-white">{readability.fleschKincaid}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-2">Gunning Fog</p>
                            <p className="text-[24px] font-display font-bold text-white">{readability.gunningFog}</p>
                          </div>
                        </div>
                      </div>
                      <div className="lg:col-span-2">
                        <ReadabilityChart data={readability} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Key Points Card */}
                {showSection('insights') && (
                  <KeyPointsPanel content={docData.content} />
                )}

                {/* 3. Glossary Card */}
                {showSection('tools') && (
                  <GlossaryPanel content={docData.content} />
                )}

                {/* 4. Questions Card */}
                {showSection('tools') && (
                  <QuestionsPanel content={docData.content} />
                )}

                {/* 5. Topics Card */}
                {showSection('insights') && (
                  <TopicsPanel content={docData.content} />
                )}

                {/* 6. Summary Card */}
                {showSection('summary') && (
                  <SummaryPanel 
                    content={docData.content} 
                    docId={docData.id || 'temp'} 
                    onSummaryGenerated={setSummary}
                  />
                )}

                {/* 7. Paraphrase Card */}
                {showSection('tools') && (
                  <ParaphrasePanel 
                    content={docData.content} 
                    docId={docData.id || 'temp'} 
                    onParaphraseGenerated={setParaphrase}
                  />
                )}

                {/* Model Info Card */}
                {showSection('model') && (
                  <div className="glass-morphism rounded-[32px] p-8">
                    <div className="flex items-center gap-2 text-white/40 mb-8">
                      <Cpu className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Model Intelligence</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <p className="text-[15px] font-bold text-white">Gemini 3.1 Pro</p>
                        </div>
                        <p className="text-[14px] text-white/40 leading-relaxed">
                          Optimized for complex reasoning and long-context understanding. This model handles the deep semantic analysis required for high-precision summarization.
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <p className="text-[15px] font-bold text-white">Gemini 3 Flash</p>
                        </div>
                        <p className="text-[14px] text-white/40 leading-relaxed">
                          Designed for low-latency efficiency. This model powers the real-time readability metrics and initial document processing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1200px] mx-auto">
              <ChatPanel content={docData.content} />
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ComparisonPanel content={docData.content} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
