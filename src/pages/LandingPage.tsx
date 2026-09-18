import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Sparkles, Cpu, Cloud, Layers, Shield, Zap, Globe } from 'lucide-react';
import UploadBox from '../components/UploadBox';
import ManualTextInput from '../components/ManualTextInput';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

const LOGOS = [
  { icon: Cpu, label: 'Gemini 3.1', x: '10%', y: '20%' },
  { icon: Sparkles, label: 'NLP Core', x: '85%', y: '15%' },
  { icon: Zap, label: 'Real-time', x: '15%', y: '75%' },
  { icon: Globe, label: 'Global', x: '80%', y: '80%' },
  { icon: Cloud, label: 'Cloud Sync', x: '5%', y: '45%' },
  { icon: Layers, label: 'Multi-level', x: '90%', y: '50%' },
  { icon: Shield, label: 'Secure', x: '50%', y: '10%' },
];

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Floating logos animation
      gsap.to('.floating-logo', {
        y: -20,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: {
          each: 0.6,
          from: 'random'
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleUpload = (content: string, title: string) => {
    sessionStorage.setItem('temp_doc', JSON.stringify({ content, title }));
    navigate('/results');
  };

  return (
    <div ref={containerRef} className="relative min-h-screen bg-bg-dark pt-24 md:pt-40 pb-20 overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Floating Logos */}
      <div className="absolute inset-0 pointer-events-none">
        {LOGOS.map((logo, i) => (
          <div
            key={i}
            className="floating-logo absolute flex flex-col items-center gap-2 opacity-10"
            style={{ left: logo.x, top: logo.y }}
          >
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
              <logo.icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{logo.label}</span>
          </div>
        ))}
      </div>

      {/* Hero Section */}
      <div className="max-w-[1000px] mx-auto px-8 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-[14px] font-medium text-white/80">Workspace Active</span>
          </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-[48px] sm:text-[64px] md:text-[80px] lg:text-[90px] font-display font-bold text-white leading-[0.9] tracking-[-0.04em] mb-8"
        >
          Transform your<br />
          <span className="text-gradient">reading experience.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-[18px] md:text-[22px] text-white/40 max-w-[600px] mx-auto mb-16 leading-relaxed"
        >
          Upload any document and let our advanced AI models distill complex information into clear, actionable insights.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="max-w-[800px] mx-auto"
        >
          <UploadBox onUpload={handleUpload} />
          <ManualTextInput onAnalyze={handleUpload} />
        </motion.div>

        {/* Stats Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 pt-12 border-t border-white/5"
        >
          <div className="glass-morphism p-8 rounded-[24px] border border-white/5 hover:bg-white/[0.02] transition-all">
            <h3 className="text-[40px] md:text-[48px] font-display font-bold text-white leading-none mb-2">99.8%</h3>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Accuracy Rate</p>
          </div>
          <div className="glass-morphism p-8 rounded-[24px] border border-white/5 hover:bg-white/[0.02] transition-all">
            <h3 className="text-[40px] md:text-[48px] font-display font-bold text-white leading-none mb-2">2.4s</h3>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Avg. Processing</p>
          </div>
          <div className="glass-morphism p-8 rounded-[24px] border border-white/5 hover:bg-white/[0.02] transition-all">
            <h3 className="text-[40px] md:text-[48px] font-display font-bold text-white leading-none mb-2">142</h3>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">Languages Supported</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
