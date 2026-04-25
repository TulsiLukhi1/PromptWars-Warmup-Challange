import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

// ─────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────

interface Evaluation {
  result: 'correct' | 'partial' | 'incorrect' | 'null';
  feedback: string;
}

interface LearnResponse {
  step: number;
  explanation: string;
  analogy: string;
  question: string;
  evaluation: Evaluation;
  next_action: 'advance' | 'retry' | 'simplify';
  learning_path?: string[];
}

// ─────────────────────────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────────────────────────

const MAX_TOPIC_LENGTH = 150;
const MAX_ANSWER_LENGTH = 1500;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STORAGE_KEY = 'learn_ai_session_v1';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
type Level = typeof LEVELS[number];

const LEVEL_THEMES: Record<Level, { text: string; bg: string; border: string }> = {
  Beginner: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  Intermediate: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  Advanced: { text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' },
};

// ─────────────────────────────────────────────────────────────
// Professional Utility Components
// ─────────────────────────────────────────────────────────────

/** Simple Markdown-lite formatter to handle bold and newlines */
const FormattedContent: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <div className="space-y-3">
      {text.split('\n\n').map((para, i) => (
        <p key={i} className="leading-relaxed">
          {para.split(/(\*\*.*?\*\*)/g).map((part, j) => 
            part.startsWith('**') && part.endsWith('**') 
              ? <strong key={j} className="text-white font-bold">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      ))}
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start animate-fade-in py-2">
    <div className="bubble-ai rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-1.5 shadow-lg border border-white/5">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Main Application Component
// ─────────────────────────────────────────────────────────────

export const ChatInterface: React.FC = () => {
  // Session State
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>('Beginner');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Logical Context
  const [step, setStep] = useState(1);
  const [learningPath, setLearningPath] = useState<string[]>([]);
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastEval, setLastEval] = useState<Evaluation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Persistence Engine (Senior Dev Best Practice)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTopic(data.topic);
        setLevel(data.level);
        // Map strings back to Date objects for timestamps
        setMessages(data.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
        setHasStarted(true);
        setStep(data.step);
        setLearningPath(data.learningPath);
        setLastQuestion(data.lastQuestion);
        setLastEval(data.lastEval);
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (hasStarted) {
      const state = { topic, level, messages, step, learningPath, lastQuestion, lastEval };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [messages, step, hasStarted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // 2. Logic Handlers
  const startLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setHasStarted(true);
    const initialInput = topic.trim();
    
    // Add user's topic choice as first message
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: initialInput,
      timestamp: new Date(),
    };
    setMessages([userMsg]);
    
    await executeAIQuery('', true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    await executeAIQuery(trimmed, false);
  };

  const executeAIQuery = async (userAnswer: string, isInitial: boolean) => {
    setIsLoading(true);
    setLastEval(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/learn/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          user_level: level,
          step,
          learning_path: learningPath,
          last_question: lastQuestion,
          user_answer: userAnswer,
        }),
      });

      if (!response.ok) throw new Error('System connectivity issue. Retrying...');

      const data: LearnResponse = await response.json();

      // Update state based on AI's logic
      setStep(data.step);
      if (data.learning_path) setLearningPath(data.learning_path);
      setLastQuestion(data.question);
      setLastEval(data.evaluation);

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.explanation,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('AI Service Error:', error);
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: "I'm having trouble connecting to my servers. Let's try that again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSession = () => {
    if (window.confirm('Clear this session and start over?')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  // 3. Render Helpers
  const currentTheme = LEVEL_THEMES[level];

  return (
    <div className="flex flex-col h-[75vh] glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
      {/* ── Header ── */}
      <header className="glass-dark border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              {hasStarted ? `Tutoring: ${topic}` : 'New Learning Session'}
            </h2>
            <p className="text-[10px] text-slate-500 font-medium">
              V2.0 · PRODUCTION · {level} Mode
            </p>
          </div>
        </div>
        
        {hasStarted && (
          <button 
            onClick={resetSession}
            className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Reset
          </button>
        )}
      </header>

      {/* ── Setup Phase ── */}
      {!hasStarted ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h1 className="text-2xl font-black text-white mb-2">Build Your Knowledge</h1>
              <p className="text-slate-400 text-sm">Target any subject. Our AI agent will craft a personalized roadmap based on your current expertise.</p>
            </div>

            <form onSubmit={startLearning} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Learning Target</label>
                <input 
                  type="text"
                  placeholder="e.g., Deep Learning, Medieval History, Baking..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC_LENGTH))}
                  className="input-dark w-full px-5 py-4 rounded-2xl text-base shadow-inner focus:scale-[1.01] transition-transform"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Complexity Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${level === l ? `${LEVEL_THEMES[l].text} ${LEVEL_THEMES[l].bg} ${LEVEL_THEMES[l].border} scale-105 shadow-lg` : 'border-white/5 text-slate-500 hover:bg-white/5'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary w-full py-4 text-sm font-black uppercase tracking-widest shadow-xl">
                Initialize Agent
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Active Session Phase ── */
        <>
          {/* Progress Bar */}
          <div className="px-6 py-3 bg-white/2 border-b border-white/5 flex items-center gap-4">
            <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out shimmer" 
                style={{ width: `${Math.min((step/5)*100, 100)}%` }} 
              />
            </div>
            <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">STEP {step} / 5</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
            {messages.map((m, i) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  
                  {/* Evaluation Badge for Assistant */}
                  {m.role === 'assistant' && i === messages.length - 1 && lastEval?.result !== 'null' && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mb-1 border ${
                      lastEval?.result === 'correct' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' : 
                      lastEval?.result === 'partial' ? 'text-amber-400 border-amber-400/30 bg-amber-400/5' : 
                      'text-rose-400 border-rose-400/30 bg-rose-400/5'
                    }`}>
                      {lastEval?.result}
                    </span>
                  )}

                  <div className={`px-5 py-4 rounded-3xl text-sm leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg' 
                      : 'glass-dark text-slate-200 border border-white/5 rounded-tl-none shadow-sm'
                  }`}>
                    <FormattedContent text={m.content} />
                  </div>
                  
                  <span className="text-[9px] text-slate-600 font-bold mt-1 px-1">
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <footer className="p-4 bg-black/20 border-t border-white/5">
            <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
              <input 
                type="text"
                placeholder={isLoading ? "Agent is processing context..." : "Share your thoughts or answer the question..."}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
                disabled={isLoading}
                className="flex-1 input-dark px-6 py-4 rounded-2xl text-sm focus:bg-white/10 transition-colors"
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-white transition-all disabled:opacity-20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
          </footer>
        </>
      )}
    </div>
  );
};
