
import { ChatInterface } from './components/ChatInterface';

function App() {
  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-[#1a202c] tracking-tight sm:text-5xl">
            Personalized AI Learning
          </h1>
          <p className="mt-4 max-w-2xl text-xl text-gray-600 mx-auto">
            Your dedicated tutor for mastering any subject.
          </p>
        </div>
        
        <ChatInterface />
      </div>
    </main>
  );
}

export default App;
