import React, { useState } from 'react';
import type { ChatMessage } from '../types';

interface LearnResponse {
  step: number;
  explanation: string;
  analogy: string;
  question: string;
  evaluation: {
    result: string;
    feedback: string;
  };
  next_action: string;
}

export const ChatInterface: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Learning state
  const [step, setStep] = useState(1);
  const [learningPath] = useState<Record<string, unknown>[]>([]);
  const [lastQuestion, setLastQuestion] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  const startLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setHasStarted(true);
    const messageId = String(Date.now());
    const messageTimestamp = new Date();
    setMessages([{
      id: messageId,
      role: 'user',
      content: `I want to learn ${topic} at a ${level} level.`,
      timestamp: messageTimestamp
    }]);
    await sendLearnRequest('', true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !hasStarted) return;

    const messageId = String(Date.now());
    const messageTimestamp = new Date();
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: input.trim(),
      timestamp: messageTimestamp
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    await sendLearnRequest(userMessage.content, false);
  };

  const sendLearnRequest = async (userAnswer: string, isInitial: boolean) => {
    setIsLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/learn/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          user_level: level,
          step,
          learning_path: learningPath,
          last_question: lastQuestion,
          user_answer: userAnswer
        })
      });

      const data: LearnResponse = await response.json();
      
      let assistantContent = '';
      if (!isInitial && data.evaluation?.result && data.evaluation.result !== 'null') {
          assistantContent += `**Feedback (${data.evaluation.result}):** ${data.evaluation.feedback}\n\n`;
      }
      if (data.explanation) assistantContent += `${data.explanation}\n\n`;
      if (data.analogy) assistantContent += `*Analogy:* ${data.analogy}\n\n`;
      if (data.question) assistantContent += `**Question:** ${data.question}`;

      const assistantMessageId = String(Date.now() + 1);
      const assistantMessageTimestamp = new Date();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: assistantContent.trim() || 'No response',
        timestamp: assistantMessageTimestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStep(data.step);
      setLastQuestion(data.question);

    } catch (error) {
      console.error('Failed to fetch response:', error);
      const errorMessageId = String(Date.now() + 1);
      const errorMessageTimestamp = new Date();
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        role: 'assistant',
        content: 'Sorry, there was an error connecting to the backend.',
        timestamp: errorMessageTimestamp
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col h-[700px] w-full max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <header className="bg-[#1a202c] px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-white">Adaptive Learning Assistant</h2>
        {!hasStarted && (
          <form onSubmit={startLearning} className="mt-4 flex gap-3 flex-wrap">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What do you want to learn? (e.g., Python)"
              className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-4 py-2 text-gray-900 bg-white"
              required
            />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 bg-white"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
            <button
              type="submit"
              className="bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-6 py-2 rounded-lg font-bold transition-colors"
            >
              Start Learning
            </button>
          </form>
        )}
        {hasStarted && (
          <p className="text-sm text-gray-300 mt-2">
            Learning: <span className="font-semibold text-white">{topic}</span> ({level}) - Step {step}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.map(msg => (
          <article 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-[#2b6cb0] text-white' 
                  : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
              <time className={`text-xs block mt-2 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                {msg.timestamp.toLocaleTimeString()}
              </time>
            </div>
          </article>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-500 border border-gray-200 rounded-lg px-4 py-3 shadow-sm font-medium">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <footer className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <label htmlFor="chat-input" className="sr-only">Type your answer</label>
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer here..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2b6cb0] focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            disabled={isLoading || !hasStarted}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !hasStarted}
            className="bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2b6cb0]"
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </footer>
    </section>
  );
};
