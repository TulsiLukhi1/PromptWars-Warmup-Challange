import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

// ─────────────────────────────────────────────────────────────
// Types
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
// Constants
// ─────────────────────────────────────────────────────────────

const MAX_TOPIC_LENGTH  = 200;
const MAX_ANSWER_LENGTH = 1000;
const TOTAL_STEPS       = 5;          // expected session length for progress bar
const API_BASE_URL      = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const;
type Level = typeof LEVELS[number];

const LEVEL_COLORS: Record<Level, string> = {
  Beginner:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Intermediate: 'text-amber-400   bg-amber-400/10   border-amber-400/30',
  Advanced:     'text-rose-400    bg-rose-400/10    border-rose-400/30',
};

const EVAL_CONFIG = {
  correct:   { label: '✓ Correct',  cls: 'badge-correct' },
  partial:   { label: '~ Partial',  cls: 'badge-partial' },
  incorrect: { label: '✗ Incorrect', cls: 'badge-incorrect' },
  null:      { label: '',            cls: '' },
};

// ─────────────────────────────────────────────────────────────
// Helper: build readable message from AI response
// ─────────────────────────────────────────────────────────────

function buildAssistantContent(data: LearnResponse, isInitial: boolean): string {
  const parts: string[] = [];

  // On evaluation turns, lead with feedback (no label prefix — it shows as a badge separately)
  if (!isInitial && data.evaluation?.result && data.evaluation.result !== 'null') {
    if (data.evaluation.feedback) parts.push(data.evaluation.feedback);
  }

  // Core explanation — plain prose
  if (data.explanation) parts.push(data.explanation);

  // Analogy — integrated naturally, no emoji prefix
  if (data.analogy) parts.push(`Think of it this way: ${data.analogy}`);

  // Question — flows as the closing sentence, no ❓ prefix
  if (data.question) parts.push(data.question);

  return parts.join('\n\n') || 'No response received.';
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Animated three-dot typing indicator */
const TypingIndicator: React.FC = () => (
  <div className="flex justify-start animate-fade-in">
    <div className="bubble-ai rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  </div>
);

/** Single chat message bubble */
const MessageBubble: React.FC<{ msg: ChatMessage; evalResult?: Evaluation }> = ({ msg, evalResult }) => {
  const isUser = msg.role === 'user';
  const evalCfg = evalResult && evalResult.result !== 'null'
    ? EVAL_CONFIG[evalResult.result as keyof typeof EVAL_CONFIG]
    : null;

  return (
    <article
      className={`flex ${isUser ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'}`}
    >
      {/* AI avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-md">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}

      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Evaluation badge (AI messages only) */}
        {!isUser && evalCfg && evalCfg.label && (
          <span className={`badge ${evalCfg.cls}`}>{evalCfg.label}</span>
        )}

        <div className={`rounded-2xl px-4 py-3 ${isUser ? 'bubble-user rounded-br-sm text-white' : 'bubble-ai rounded-bl-sm text-slate-200'}`}>
          <p className="whitespace-pre-wrap leading-relaxed text-sm font-medium">{msg.content}</p>
        </div>

        <time className={`text-[11px] ${isUser ? 'text-slate-500 text-right' : 'text-slate-600'}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center ml-2 mt-1 flex-shrink-0">
          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </article>
  );
};

/** Learning progress bar */
const ProgressBar: React.FC<{ step: number; topic: string; level: Level }> = ({ step, topic, level }) => {
  const pct = Math.min((step / TOTAL_STEPS) * 100, 100);
  return (
    <div className="px-4 py-3 glass border-b border-white/5 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-400 font-medium truncate">
            📖 {topic}
          </span>
          <span className={`badge border text-[10px] ${LEVEL_COLORS[level]}`}>{level}</span>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
          Step {step} · {Math.round(pct)}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export const ChatInterface: React.FC = () => {
  const [topic,      setTopic     ] = useState('');
  const [level,      setLevel     ] = useState<Level>('Beginner');
  const [messages,   setMessages  ] = useState<ChatMessage[]>([]);
  const [input,      setInput     ] = useState('');
  const [isLoading,  setIsLoading ] = useState(false);
  const [topicError, setTopicError] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  // Session context — kept in state so every API call sends full context
  const [step,         setStep        ] = useState(1);
  const [learningPath, setLearningPath] = useState<string[]>([]);
  const [lastQuestion, setLastQuestion] = useState('');
  const [lastEval,     setLastEval    ] = useState<Evaluation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Handlers ──────────────────────────────────────────────

  const startLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();

    if (!trimmed) {
      setTopicError('Please enter a topic to study.');
      return;
    }
    if (trimmed.length > MAX_TOPIC_LENGTH) {
      setTopicError(`Topic must be under ${MAX_TOPIC_LENGTH} characters.`);
      return;
    }
    setTopicError('');
    setHasStarted(true);

    // Just show the topic name — clean and natural, like typing in ChatGPT
    addUserMessage(trimmed);
    await sendLearnRequest('', true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || !hasStarted) return;

    setInput('');
    addUserMessage(trimmed);
    await sendLearnRequest(trimmed, false);
  };

  // ── Helpers ───────────────────────────────────────────────

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: String(Date.now()),
      role: 'user',
      content,
      timestamp: new Date(),
    }]);
  };

  const sendLearnRequest = async (userAnswer: string, isInitial: boolean) => {
    setIsLoading(true);
    setLastEval(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/learn/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic:         topic.trim(),
          user_level:    level,
          step,
          learning_path: learningPath,
          last_question: lastQuestion,
          user_answer:   userAnswer,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Server error ${response.status}`);
      }

      const data: LearnResponse = await response.json();

      // Update session context
      if (data.learning_path?.length) setLearningPath(data.learning_path);
      setStep(data.step ?? step);
      setLastQuestion(data.question ?? '');
      if (data.evaluation) setLastEval(data.evaluation);

      const content = buildAssistantContent(data, isInitial);
      setMessages(prev => [...prev, {
        id:        String(Date.now() + 1),
        role:      'assistant',
        content,
        timestamp: new Date(),
      }]);

    } catch (error) {
      const isNetwork = error instanceof TypeError;
      const text = isNetwork
        ? '⚠️ Could not reach the server. Please check your connection.'
        : `⚠️ ${(error as Error).message || 'Something went wrong. Please try again.'}`;

      console.error('[ChatInterface]', error);
      setMessages(prev => [...prev, {
        id:        String(Date.now() + 1),
        role:      'assistant',
        content:   text,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="glass rounded-2xl border border-white/8 overflow-hidden shadow-2xl glow-purple animate-fade-in-up" style={{ minHeight: '65vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="glass-dark border-b border-white/6 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#667eea] animate-pulse-glow inline-block"></span>
              Adaptive Learning Assistant
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Context-aware tutoring powered by Google Gemini
            </p>
          </div>
          {hasStarted && (
            <button
              onClick={() => {
                setHasStarted(false);
                setMessages([]);
                setTopic('');
                setStep(1);
                setLearningPath([]);
                setLastQuestion('');
                setLastEval(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-all"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      {/* ── Topic Setup Form (shown before session starts) ─── */}
      {!hasStarted && (
        <div className="flex-1 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse-glow">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">What do you want to master?</h3>
              <p className="text-slate-500 text-sm">Choose a topic and your experience level to begin your personalized learning journey.</p>
            </div>

            <form onSubmit={startLearning} className="space-y-4" noValidate>
              {/* Topic input */}
              <div>
                <label htmlFor="topic-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Topic
                </label>
                <input
                  id="topic-input"
                  type="text"
                  value={topic}
                  onChange={(e) => { setTopic(e.target.value); if (topicError) setTopicError(''); }}
                  placeholder="e.g. Python async/await, Quantum mechanics, JavaScript closures…"
                  maxLength={MAX_TOPIC_LENGTH}
                  className={`input-dark w-full rounded-xl px-4 py-3 text-sm ${topicError ? '!border-rose-500' : ''}`}
                  aria-describedby={topicError ? 'topic-error' : undefined}
                  autoFocus
                />
                <div className="flex justify-between mt-1.5">
                  {topicError
                    ? <p id="topic-error" role="alert" className="text-rose-400 text-xs">{topicError}</p>
                    : <span />}
                  <span className="text-slate-600 text-xs">{topic.length}/{MAX_TOPIC_LENGTH}</span>
                </div>
              </div>

              {/* Level selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Experience Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`rounded-xl py-2.5 text-sm font-semibold border transition-all ${
                        level === lvl
                          ? `${LEVEL_COLORS[lvl]} scale-[1.02]`
                          : 'border-white/8 text-slate-500 hover:border-white/15 hover:text-slate-300'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 text-sm mt-2"
              >
                {isLoading ? 'Starting…' : '🚀 Start Learning'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Progress bar (during session) ─────────────────── */}
      {hasStarted && <ProgressBar step={step} topic={topic} level={level} />}

      {/* ── Messages ─────────────────────────────────────── */}
      {hasStarted && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ minHeight: '280px' }}>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              evalResult={msg.role === 'assistant' && idx === messages.length - 1 ? lastEval ?? undefined : undefined}
            />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Input bar (during session) ─────────────────── */}
      {hasStarted && (
        <footer className="glass-dark border-t border-white/6 px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1">
              <label htmlFor="chat-input" className="sr-only">Type your answer</label>
              <input
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); } }}
                placeholder={isLoading ? 'AI is thinking…' : 'Type your answer or ask a question…'}
                maxLength={MAX_ANSWER_LENGTH}
                disabled={isLoading}
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              />
              {input.length > MAX_ANSWER_LENGTH * 0.8 && (
                <p className="text-slate-600 text-xs mt-1 text-right">
                  {input.length}/{MAX_ANSWER_LENGTH}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="btn-primary px-4 py-3 rounded-xl flex-shrink-0 flex items-center gap-2 text-sm"
            >
              {isLoading
                ? <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
              }
              <span className="hidden sm:inline">{isLoading ? 'Thinking' : 'Send'}</span>
            </button>
          </form>
        </footer>
      )}
    </div>
  );
};
