import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import { Sparkles, ArrowRight, Shield, Zap, Globe, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AuthLandingPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Ignore the error if the user closed the popup themselves
      if (error.code === 'auth/popup-closed-by-user') {
        setIsLoading(false);
        return;
      }
      console.error('Error signing in:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6 overflow-hidden relative">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 text-center max-w-[900px]"
      >
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-10 backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/60">Intelligence Engine v3.1</span>
        </div>

        <h1 className="text-[120px] md:text-[80px] sm:text-[60px] font-display font-bold leading-[0.82] tracking-[-0.05em] mb-10">
          Master complexity.<br />
          <span className="text-gradient">Tailor clarity.</span>
        </h1>

        <p className="text-[22px] md:text-[18px] text-white/40 max-w-[600px] mx-auto mb-14 leading-relaxed font-medium">
          The surgical precision of Gemini 3.1 Pro, distilled into a seamless interface for summarization, paraphrasing, and deep readability analysis.
        </p>

        <div className="flex flex-col items-center gap-8">
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="group relative flex items-center gap-4 bg-white text-black px-10 py-5 rounded-full font-bold text-[18px] transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/10 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Enter the Platform</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
          
          <div className="flex items-center gap-3 text-white/20">
            <Shield className="w-4 h-4" />
            <p className="text-[12px] font-bold uppercase tracking-widest">Secure OAuth Access</p>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 z-10 max-w-[1200px] w-full border-t border-white/5 pt-16"
      >
        <div className="glass-morphism p-8 rounded-[32px] border border-white/5 hover:bg-white/[0.02] transition-all flex flex-col gap-6 group">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
            <Zap className="w-6 h-6 text-emerald-400 group-hover:text-inherit" />
          </div>
          <div>
            <h3 className="text-[22px] font-display font-bold mb-3">Neural Summarization</h3>
            <p className="text-white/40 text-[15px] leading-relaxed">Distill massive documents into surgical insights with zero loss in context or nuance.</p>
          </div>
        </div>
        
        <div className="glass-morphism p-8 rounded-[32px] border border-white/5 hover:bg-white/[0.02] transition-all flex flex-col gap-6 group">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
            <Globe className="w-6 h-6 text-emerald-400 group-hover:text-inherit" />
          </div>
          <div>
            <h3 className="text-[22px] font-display font-bold mb-3">Adaptive Paraphrasing</h3>
            <p className="text-white/40 text-[15px] leading-relaxed">Instantly pivot your content's tone and complexity for any audience, from beginner to expert.</p>
          </div>
        </div>

        <div className="glass-morphism p-8 rounded-[32px] border border-white/5 hover:bg-white/[0.02] transition-all flex flex-col gap-6 group">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
            <Shield className="w-6 h-6 text-emerald-400 group-hover:text-inherit" />
          </div>
          <div>
            <h3 className="text-[22px] font-display font-bold mb-3">Privacy First</h3>
            <p className="text-white/40 text-[15px] leading-relaxed">Your data is yours. We use enterprise-grade encryption and never train on your private content.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
