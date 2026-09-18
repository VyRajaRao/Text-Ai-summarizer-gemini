import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, signOut, FirebaseUser, db, doc, getDoc, handleFirestoreError, OperationType } from '../lib/firebase';
import { LogOut, FileText, User, Zap, Shield } from 'lucide-react';
import { GeminiManager } from '../services/gemini';

interface NavbarProps {
  user: FirebaseUser | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [keyCount, setKeyCount] = useState(GeminiManager.getKeyCount());

  useEffect(() => {
    // Listen for key changes to update the count in real-time
    const unsubscribe = GeminiManager.onKeysChange((count) => {
      setKeyCount(count);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const checkAdmin = async () => {
      if (user.email === 'vyraja777@gmail.com') {
        setIsAdmin(true);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error checking admin status in Navbar:', error);
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    };
    checkAdmin();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-16 glass-morphism rounded-full flex items-center justify-between px-8 z-50 shadow-2xl">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
            <FileText className="text-black w-5 h-5" />
          </div>
          <span className="font-display font-bold text-[20px] tracking-tight">Clarity</span>
        </Link>

        {keyCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full" title={`${keyCount} API Keys Active`}>
            <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{keyCount} Keys</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-8">
        <Link to="/" className="text-[15px] font-medium text-white/60 hover:text-white transition-colors">Home</Link>
        {user && (
          <Link to="/dashboard" className="text-[15px] font-medium text-white/60 hover:text-white transition-colors">History</Link>
        )}
        {isAdmin && (
          <Link to="/admin" className="text-[15px] font-medium text-white/60 hover:text-white transition-colors flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Admin
          </Link>
        )}
        
        {user && (
          <div className="flex items-center gap-4 pl-6 border-l border-white/10">
            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <User className="w-4 h-4 text-white/40" />
                </div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-white/5 rounded-full transition-colors group"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-white/40 group-hover:text-white" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
