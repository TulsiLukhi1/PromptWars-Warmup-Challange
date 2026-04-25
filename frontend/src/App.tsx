import { ChatInterface } from './components/ChatInterface';

function App() {
  return (
    <div className="bg-mesh min-h-screen flex flex-col">
      {/* ── Top Nav ───────────────────────────────────────── */}
      <header className="glass-dark border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo icon */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight text-lg">LearnAI</span>
            <span className="badge bg-[#667eea]/20 text-[#a5b4fc] border border-[#667eea]/30 text-[10px]">
              Powered by Gemini
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-medium">Live</span>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center animate-fade-in">
        <h1 className="text-4xl sm:text-5xl font-extrabold gradient-text leading-tight mb-3">
          Your Personal AI Tutor
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          Master any subject through an adaptive, step-by-step conversation powered by Google Gemini.
        </p>
      </section>

      {/* ── Main chat ─────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pb-10">
        <ChatInterface />
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="text-center py-5 text-slate-600 text-xs border-t border-white/5">
        Built with React · Django · Google Gemini AI &nbsp;|&nbsp; PromptWars Warm-Up Challenge
      </footer>
    </div>
  );
}

export default App;
