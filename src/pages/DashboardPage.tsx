import React, { useEffect, useState } from 'react';
import { auth, db, collection, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, ChevronRight, Loader2, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/');
      return;
    }

    const q = query(collection(db, 'documents'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
      setDocuments(docs);
      setIsFetching(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    });

    return () => unsubscribe();
  }, [user, loading, navigate]);

  if (loading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark pt-40 pb-20">
      <div className="max-w-[900px] mx-auto px-8">
        <div className="flex items-center justify-between mb-16">
          <div>
            <h1 className="text-[40px] font-display font-bold text-white tracking-tight">History</h1>
            <p className="text-[18px] text-white/40">Your analyzed documents and insights</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-all"
          >
            New Analysis
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="glass-morphism rounded-[40px] p-24 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-white/10">
              <FileText className="w-10 h-10 text-white/20" />
            </div>
            <h3 className="text-[24px] font-display font-bold text-white mb-3">No documents yet</h3>
            <p className="text-white/40 mb-10 max-w-[300px] mx-auto">Upload a document on the home page to start your clarity journey.</p>
            <button 
              onClick={() => navigate('/')}
              className="text-[16px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div 
                key={doc.id}
                onClick={() => {
                  sessionStorage.setItem('temp_doc', JSON.stringify({ content: doc.content, title: doc.title, id: doc.id }));
                  navigate('/results');
                }}
                className="group glass-morphism rounded-[24px] p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.07] hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[18px] font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{doc.title}</h4>
                    <div className="flex items-center gap-6 text-[13px] font-medium text-white/30 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {doc.createdAt?.toDate().toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {doc.readability?.gradeLevel}
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/10 group-hover:text-white transition-all group-hover:translate-x-1" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
