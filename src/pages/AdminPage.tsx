import React, { useEffect, useState } from 'react';
import { auth, db, collection, query, onSnapshot, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { Shield, MessageSquare, ThumbsUp, ThumbsDown, Loader2, Users, Key, Plus, Trash2, CheckCircle2, XCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { GeminiManager } from '../services/gemini';

export default function AdminPage() {
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'feedback' | 'keys' | 'health'>('feedback');
  
  // Health Check State
  const [healthStatus, setHealthStatus] = useState<any[]>([]);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // New Key Form
  const [newKey, setNewKey] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/');
      return;
    }

    const checkAdmin = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else if (user.email === 'vyraja777@gmail.com') {
          setIsAdmin(true);
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error("Error checking admin status in AdminPage:", error);
        // Fallback to email check
        if (user.email === 'vyraja777@gmail.com') {
          setIsAdmin(true);
        } else {
          navigate('/');
        }
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    };

    checkAdmin();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const feedbackQuery = query(collection(db, 'feedback'));
    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
      setFeedback(items);
      setIsFetching(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'feedback');
    });

    const keysQuery = query(collection(db, 'geminiKeys'));
    const unsubscribeKeys = onSnapshot(keysQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
      setKeys(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'geminiKeys');
    });

    return () => {
      unsubscribeFeedback();
      unsubscribeKeys();
    };
  }, [isAdmin]);

  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    const results = [];
    
    // Test Environment Keys (we can't see values, but we can call a test function)
    // We'll add a method to GeminiManager to test all available keys
    try {
      const envKeyCount = GeminiManager.getKeyCount();
      for (let i = 0; i < envKeyCount; i++) {
        // This is a bit tricky because rotate() changes the current index
        // We'll just test the current one and rotate
        const client = GeminiManager.getClient();
        try {
          const response = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Say 'ok'",
          });
          results.push({
            name: `Environment Key #${i + 1}`,
            status: response.text ? 'active' : 'error',
            type: 'env'
          });
        } catch (e: any) {
          results.push({
            name: `Environment Key #${i + 1}`,
            status: 'error',
            message: e.message,
            type: 'env'
          });
        }
        GeminiManager.rotate();
      }
    } catch (e: any) {
      results.push({ name: 'Environment Keys', status: 'error', message: e.message, type: 'env' });
    }

    // Test Database Keys
    for (const keyItem of keys) {
      const isValid = await GeminiManager.testKey(keyItem.key);
      results.push({
        name: keyItem.label,
        status: isValid ? 'active' : 'error',
        type: 'db',
        id: keyItem.id
      });
      try {
        await updateDoc(doc(db, 'geminiKeys', keyItem.id), {
          status: isValid ? 'active' : 'error',
          lastTested: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating DB status:', error);
        handleFirestoreError(error, OperationType.UPDATE, `geminiKeys/${keyItem.id}`);
      }
    }

    setHealthStatus(results);
    setIsCheckingHealth(false);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(null);
    if (!newKey.trim()) return;

    if (GeminiManager.isDuplicate(newKey)) {
      setKeyError('This API key is already configured and active.');
      return;
    }

    setIsAddingKey(true);
    try {
      const isValid = await GeminiManager.testKey(newKey);
      if (!isValid) {
        setKeyError('This API key appears to be invalid or inactive.');
        setIsAddingKey(false);
        return;
      }

      await addDoc(collection(db, 'geminiKeys'), {
        key: newKey,
        label: newKeyLabel || `Key ${keys.length + 1}`,
        status: 'active',
        lastTested: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setNewKey('');
      setNewKeyLabel('');
    } catch (error) {
      console.error('Error adding key:', error);
      setKeyError('Failed to add key. Please try again.');
      handleFirestoreError(error, OperationType.CREATE, 'geminiKeys');
    } finally {
      setIsAddingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await deleteDoc(doc(db, 'geminiKeys', id));
    } catch (error) {
      console.error('Error deleting key:', error);
      handleFirestoreError(error, OperationType.DELETE, `geminiKeys/${id}`);
    }
  };

  const handleTestKey = async (id: string, keyValue: string) => {
    setTestingKeyId(id);
    try {
      const isValid = await GeminiManager.testKey(keyValue);
      await updateDoc(doc(db, 'geminiKeys', id), {
        status: isValid ? 'active' : 'error',
        lastTested: serverTimestamp()
      });
    } catch (error) {
      console.error('Error testing key:', error);
      handleFirestoreError(error, OperationType.UPDATE, `geminiKeys/${id}`);
    } finally {
      setTestingKeyId(null);
    }
  };

  const toggleKeyStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'geminiKeys', id), {
        status: newStatus
      });
    } catch (error) {
      console.error('Error toggling key status:', error);
      handleFirestoreError(error, OperationType.UPDATE, `geminiKeys/${id}`);
    }
  };

  if (loading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-dark">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-bg-dark pt-40 pb-20">
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center shadow-lg shadow-white/5">
              <Shield className="text-black w-8 h-8" />
            </div>
            <div>
              <h1 className="text-[40px] font-display font-bold text-white tracking-tight">Admin Console</h1>
              <p className="text-[18px] text-white/40">System insights and key management</p>
            </div>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all ${
                activeTab === 'feedback' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              Feedback
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all ${
                activeTab === 'keys' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all ${
                activeTab === 'health' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
              }`}
            >
              System Health
            </button>
          </div>
        </div>

        {activeTab === 'feedback' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            <div className="lg:col-span-1 space-y-8">
              <div className="glass-morphism rounded-[32px] p-8">
                <div className="flex items-center gap-3 text-white/30 mb-8">
                  <Users className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">System Overview</span>
                </div>
                <div className="space-y-8">
                  <div>
                    <p className="text-[14px] font-medium text-white/40 mb-2">Total Feedback</p>
                    <p className="text-[48px] font-display font-bold text-white leading-none">{feedback.length}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-2">Positive</p>
                      <p className="text-[24px] font-bold text-emerald-400">{feedback.filter(f => f.rating === 'up').length}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-2">Negative</p>
                      <p className="text-[24px] font-bold text-red-400">{feedback.filter(f => f.rating === 'down').length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[20px] font-display font-bold text-white flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  Recent Feedback
                </h3>
                <span className="text-[12px] font-bold text-white/20 uppercase tracking-widest">Live Feed</span>
              </div>
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div key={item.id} className="glass-morphism rounded-[24px] p-6 flex items-start justify-between group hover:bg-white/[0.07] transition-all">
                    <div className="flex gap-6">
                      <div className={`p-4 rounded-2xl border transition-all ${
                        item.rating === 'up' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        {item.rating === 'up' ? <ThumbsUp className="w-5 h-5" /> : <ThumbsDown className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 px-2 py-0.5 bg-white/5 rounded border border-white/10">{item.targetType}</span>
                          <span className="text-[12px] text-white/20 font-medium">{item.createdAt?.toDate().toLocaleString()}</span>
                        </div>
                        <p className="text-[17px] leading-relaxed text-white/80 group-hover:text-white transition-colors">{item.comment || 'No comment provided'}</p>
                        <div className="flex items-center gap-2 mt-4">
                          <div className="w-4 h-4 rounded-full bg-white/5 border border-white/10" />
                          <p className="text-[11px] font-mono text-white/20">UID: {item.userId}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'keys' ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Add New Key */}
            <div className="glass-morphism rounded-[32px] p-8">
              <h3 className="text-[20px] font-display font-bold text-white mb-8 flex items-center gap-3">
                <Plus className="w-5 h-5 text-emerald-400" />
                Add New Gemini API Key
              </h3>
              <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2 ml-1">Key Label</label>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="e.g. Production Key 1"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2 ml-1">API Key</label>
                  <input
                    type="password"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="AIzaSy..."
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div className="md:col-span-1 flex items-end">
                  <button
                    type="submit"
                    disabled={isAddingKey}
                    className="w-full h-[58px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {isAddingKey ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Add Key
                  </button>
                </div>
              </form>
              {keyError && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-[13px]">
                  <XCircle className="w-4 h-4" />
                  {keyError}
                </div>
              )}
            </div>

            {/* Key List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[20px] font-display font-bold text-white flex items-center gap-3">
                  <Key className="w-5 h-5 text-emerald-400" />
                  Managed API Keys
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-bold text-white/20 uppercase tracking-widest">{keys.length} Keys Configured</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {keys.map((keyItem) => (
                  <div key={keyItem.id} className="glass-morphism rounded-[24px] p-6 flex items-center justify-between group hover:bg-white/[0.07] transition-all">
                    <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-2xl border ${
                        keyItem.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        keyItem.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        'bg-white/5 border-white/10 text-white/40'
                      }`}>
                        {keyItem.status === 'active' ? <CheckCircle2 className="w-6 h-6" /> : 
                         keyItem.status === 'error' ? <XCircle className="w-6 h-6" /> : 
                         <RefreshCw className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-[18px] font-bold text-white">{keyItem.label}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                            keyItem.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            keyItem.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-white/5 border-white/10 text-white/40'
                          }`}>
                            {keyItem.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 font-mono text-[13px] text-white/30">
                            {showKey === keyItem.id ? keyItem.key : `${keyItem.key.substring(0, 8)}...${keyItem.key.substring(keyItem.key.length - 4)}`}
                            <button 
                              onClick={() => setShowKey(showKey === keyItem.id ? null : keyItem.id)}
                              className="hover:text-white transition-colors"
                            >
                              {showKey === keyItem.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className="text-[11px] text-white/10">|</span>
                          <span className="text-[11px] text-white/20">Added {keyItem.createdAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTestKey(keyItem.id, keyItem.key)}
                        disabled={testingKeyId === keyItem.id}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all disabled:opacity-50"
                        title="Test Key"
                      >
                        <RefreshCw className={`w-4 h-4 ${testingKeyId === keyItem.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => toggleKeyStatus(keyItem.id, keyItem.status)}
                        className={`p-3 border rounded-xl transition-all ${
                          keyItem.status === 'active' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                        title={keyItem.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {keyItem.status === 'active' ? <CheckCircle2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteKey(keyItem.id)}
                        className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all"
                        title="Delete Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {keys.length === 0 && (
                  <div className="glass-morphism rounded-[24px] p-12 text-center">
                    <Key className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">No API keys configured yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-morphism rounded-[32px] p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[20px] font-display font-bold text-white flex items-center gap-3">
                    <RefreshCw className={`w-5 h-5 text-emerald-400 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    System Authenticity Check
                  </h3>
                  <p className="text-white/40 text-[14px] mt-1">Verify the status and authenticity of all configured API keys</p>
                </div>
                <button
                  onClick={runHealthCheck}
                  disabled={isCheckingHealth}
                  className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isCheckingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Run Full Audit
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {healthStatus.length > 0 ? (
                  healthStatus.map((status, idx) => (
                    <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-[24px] p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          status.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {status.status === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-white font-bold">{status.name}</p>
                          <p className="text-[11px] text-white/30 uppercase tracking-widest">
                            {status.type === 'env' ? 'Environment Variable' : 'Database Key'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                          status.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {status.status === 'active' ? 'Authentic' : 'Invalid/Fake'}
                        </span>
                        {status.message && (
                          <p className="text-[10px] text-red-400/60 mt-2 max-w-[200px] truncate" title={status.message}>
                            {status.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="md:col-span-2 py-12 text-center border border-dashed border-white/10 rounded-[24px]">
                    <p className="text-white/20">Click "Run Full Audit" to check key authenticity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
