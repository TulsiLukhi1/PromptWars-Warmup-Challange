import React, { useState } from 'react';
import type { ChatMessage } from '../types';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// Validation constants
// --------------------------------------------------------------------------

const MAX_TOPIC_LENGTH = 200;
const MAX_ANSWER_LENGTH = 1000;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export const ChatInterface: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [topicError, setTopicError] = useState('');

  // Learning state
  const [step, setStep] = useState(1);
  const [learningPath] = useState<Record<string, unknown>[]>([]);
  const [lastQuestion, setLastQuestion] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  const startLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTopic = topic.trim();

    // Validate topic
    if (!trimmedTopic) {
      setTopicError('Please enter a topic.');
      return;
    }
    if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
      setTopicError(`Topic must be under ${MAX_TOPIC_LENGTH} characters.`);
      return;
    }
    setTopicError('');

    setHasStarted(true);
    setMessages([{
      id: String(Date.now()),
      role: 'user',
      content: `I want to learn ${trimmedTopic} at a ${level} level.`,
      timestamp: new Date(),
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
      const response = await fetch(`${API_BASE_URL}/api/learn/`, {
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
      const isNetworkError = error instanceof TypeError;
      const errorText = isNetworkError
        ? 'Could not reach the server. Please check your connection and try again.'
        : 'Something went wrong. Please try again in a moment.';

      console.error('[ChatInterface] sendLearnRequest failed:', error);
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: errorText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-col h-[700px] w-full max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <header className="bg-[#1a202c] px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-white">Adaptive Learning Assistant</h2>
        {!hasStarted && (
          <form onSubmit={startLearning} className="mt-4 flex gap-3 flex-wrap" noValidate>
            <div className="flex-1 min-w-[200px]">
              <input
                id="topic-input"
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (topicError) setTopicError('');
                }}
                placeholder="What do you want to learn? (e.g., Python)"
                maxLength={MAX_TOPIC_LENGTH}
                aria-describedby={topicError ? 'topic-error' : undefined}
                className={`w-full rounded-lg border px-4 py-2 text-gray-900 bg-white ${
                  topicError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {topicError && (
                <p id="topic-error" role="alert" className="text-red-400 text-xs mt-1">
                  {topicError}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-1 text-right">
                {topic.length}/{MAX_TOPIC_LENGTH}
              </p>
            </div>
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
              disabled={isLoading}
              className="bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex-1">
            <label htmlFor="chat-input" className="sr-only">Type your answer</label>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
              placeholder="Type your answer here..."
              maxLength={MAX_ANSWER_LENGTH}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2b6cb0] focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
              disabled={isLoading || !hasStarted}
            />
            {hasStarted && (
              <p className="text-gray-400 text-xs mt-1 text-right">
                {input.length}/{MAX_ANSWER_LENGTH}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !hasStarted}
            className="bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2b6cb0] self-start"
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </footer>
    </section>
  );
};
