import React, { useState } from 'react';
import { Type, Eraser, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { EXAMPLES } from '../constants';

interface ManualTextInputProps {
  onAnalyze: (content: string, title: string) => void;
}

export default function ManualTextInput({ onAnalyze }: ManualTextInputProps) {
  const [text, setText] = useState('');

  const handleAnalyze = () => {
    if (text.trim().length < 50) {
      alert("Please enter at least 50 characters for a meaningful analysis.");
      return;
    }
    const title = text.split('\n')[0].slice(0, 40) + (text.length > 40 ? '...' : '');
    onAnalyze(text, title || "Manual Input");
  };

  const handleClear = () => {
    setText('');
  };

  const useExample = (content: string) => {
    setText(content);
  };

  return (
    <div className="mt-16 text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
          <Type className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-[24px] font-display font-bold text-white">Manual Text Input</h2>
          <p className="text-[14px] text-white/40">Type or paste text below to analyze it without uploading a file.</p>
        </div>
      </div>

      <div className="glass-morphism rounded-[32px] p-8 border border-white/5 flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/20 w-full mb-1">Quick Examples:</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => useExample(ex.content)}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[12px] font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
            >
              {ex.title}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your content here (minimum 50 characters)..."
          className="w-full h-[200px] bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-white placeholder:text-white/10 focus:outline-none focus:border-emerald-500/30 transition-all resize-none custom-scrollbar"
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <button
            onClick={handleClear}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/10 text-white/60 hover:bg-white/5 transition-all"
          >
            <Eraser className="w-4 h-4" />
            <span className="text-[14px] font-bold">Clear</span>
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!text.trim()}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[14px] font-bold">Analyze Text</span>
          </button>
        </div>
      </div>
    </div>
  );
}
