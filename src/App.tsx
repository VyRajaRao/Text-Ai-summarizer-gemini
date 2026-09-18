import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, onAuthStateChanged, FirebaseUser, db, doc, getDoc, handleFirestoreError, OperationType } from './lib/firebase';
import { syncGeminiKeys } from './services/gemini';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import ResultsPage from './pages/ResultsPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import AuthLandingPage from './pages/AuthLandingPage';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
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
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        // Fallback to email check if Firestore fails
        if (user.email === 'vyraja777@gmail.com') {
          setIsAdmin(true);
        }
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    const unsubscribe = syncGeminiKeys(isAdmin);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/20" />
      </div>
    );
  }

  if (!user) {
    return <AuthLandingPage />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white">
        <Navbar user={user} />
        <main>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
