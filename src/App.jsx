import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, Camera, Leaf, AlertCircle, CheckCircle, 
  Server, Loader2, Trash2, Recycle, ShieldAlert, 
  Info, X, Sparkles, Globe, MessageCircle, Send, Bot 
} from 'lucide-react';

// ⚠️ IMPORTANT: Replace this with your actual Hugging Face Space URL
const BACKEND_URL = "https://vk2101-eco-vision-ai.hf.space";

const CATEGORY_COLORS = {
  cardboard: "bg-[#8B5A2B] text-white border-[#8B5A2B]",
  glass: "bg-teal-500 text-white border-teal-500",
  metal: "bg-slate-500 text-white border-slate-500",
  paper: "bg-blue-500 text-white border-blue-500",
  plastic: "bg-red-500 text-white border-red-500",
  trash: "bg-stone-800 text-white border-stone-800",
  unknown: "bg-amber-400 text-stone-900 border-amber-400"
};

const APP_TITLES = [
  { text: "தூய்மைAI", lang: "Tamil", suffix: "(Thooymai AI)" },
  { text: "स्वच्छAI", lang: "Hindi", suffix: "(Swachh AI)" },
  { text: "CleanAI", lang: "English", suffix: "(Smart Waste)" }
];

const STYLES = `
  @keyframes dissolveSwap {
    0% { opacity: 0; filter: blur(4px); }
    15% { opacity: 1; filter: blur(0px); }
    85% { opacity: 1; filter: blur(0px); }
    100% { opacity: 0; filter: blur(4px); }
  }
  .animate-title-swap { animation: dissolveSwap 3s ease-in-out both; }
  
  @keyframes textShine {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-gradient-x { background-size: 200% auto; animation: textShine 4s ease-in-out infinite; }
`;

export default function App() {
  // Core UI & Analysis State
  const [backendStatus, setBackendStatus] = useState('checking');
  const [titleIndex, setTitleIndex] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I am EcoBot. Do you have any questions about waste disposal, recycling, or this project?' }
  ]);
  
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Handle Title Animations
  useEffect(() => {
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % APP_TITLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle auto-scrolling the chat to the latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatOpen]);

  // Check Backend Status on load
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const res = await fetch(BACKEND_URL + "/");
        if (res.ok) setBackendStatus('online');
        else setBackendStatus('offline');
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    checkServerStatus();
  }, []);

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }
    setError('');
    setResult(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError('');
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    setError('');
    setResult(null);
    setLoadingMessage('Uploading image...');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('mode', 'Single Object');

      // Call the `/analyze` endpoint of your FastAPI backend
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Server returned an error');

      const data = await response.json();
      let parsedData = data;
      
      // Clean up markdown formatting if the LLM wrapped it in ```json blocks
      if (typeof data === 'string') {
        try {
          const cleaned = data.replace(/```json/g, '').replace(/```/g, '').trim();
          parsedData = JSON.parse(cleaned);
        } catch (e) {
          console.error("Failed to parse LLM JSON:", e);
          parsedData = { 
            detected_class: 'unknown', 
            description: 'Parse error.', 
            toxicity: 'Unknown.', 
            disposal: data // dump raw response if parsing fails
          };
        }
      }
      setResult(parsedData);
      
      // Bonus: Add contextual message to chatbot about the scanned item!
      if (!isChatOpen) setIsChatOpen(true);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I just analyzed your image and found **${parsedData.detected_class}**! Let me know if you need more details about its toxicity or disposal.` 
      }]);

    } catch (err) {
      console.error(err);
      setError('Failed to analyze image. Ensure your backend is running.');
    } finally {
      setIsAnalyzing(false);
      setLoadingMessage('');
    }
  };

  const sendChatMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    
    setChatMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Call the new `/chat` endpoint
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) 
        })
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();
      setChatMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setChatMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, I am having trouble connecting to the server right now.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-teal-50 text-slate-900 font-sans pb-24">
      <style>{STYLES}</style>
      
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-lg border-b border-white/50 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-inner text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              {/* Regional language title WITH translation suffix dissolving together */}
              <div key={`title-${titleIndex}`} className="flex items-baseline gap-2 animate-title-swap h-8">
                <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-500 animate-gradient-x">
                  {APP_TITLES[titleIndex].text}
                </h1>
                <span className="text-sm font-semibold text-teal-700/80">
                  {APP_TITLES[titleIndex].suffix}
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                <Globe className="h-3 w-3" /> AI Waste Segregation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium bg-white/80 shadow-sm px-3 py-1.5 rounded-full border border-slate-200/60">
            {backendStatus === 'online' ? (
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            ) : (
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
            )}
            <span className="text-slate-600 hidden sm:inline">
              {backendStatus === 'online' ? 'API Online' : 'API Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8 relative z-10">
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm flex gap-3 animate-in fade-in">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 overflow-hidden">
          
          {!imagePreview ? (
            <div 
              className={`p-8 sm:p-16 border-2 border-dashed m-4 sm:m-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50/50'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
            >
              <div className="bg-white p-5 rounded-full shadow-md mb-6">
                <UploadCloud className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Upload or Capture Waste</h2>
              <p className="text-slate-500 mb-8 max-w-md">Drag and drop a photo here, or use the buttons below to upload from your device.</p>
              
              <div className="flex gap-4">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => processFile(e.target.files[0])} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 rounded-xl font-medium shadow-sm transition-all">
                  <UploadCloud className="h-5 w-5" /> Choose File
                </button>
                
                <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={(e) => processFile(e.target.files[0])} />
                <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all">
                  <Camera className="h-5 w-5" /> Use Camera
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row">
              {/* Left Side: Image Preview */}
              <div className="md:w-5/12 bg-slate-50/50 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col items-center justify-center relative">
                <button onClick={clearImage} className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:text-red-500 transition-colors z-10">
                  <X className="h-5 w-5" />
                </button>
                <img src={imagePreview} className="max-h-[400px] w-full object-contain rounded-xl shadow-lg border border-slate-200" alt="Waste Preview" />
              </div>

              {/* Right Side: Analysis Actions & Results */}
              <div className="md:w-7/12 p-6 md:p-10 flex flex-col justify-center">
                
                {!result && !isAnalyzing && (
                  <div className="text-center py-12 animate-in fade-in">
                    <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Recycle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Ready to Analyze</h3>
                    <p className="text-slate-500 mb-8 max-w-sm mx-auto">Our AI will identify the material and provide a detailed environmental disposal report.</p>
                    <button onClick={analyzeImage} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3 mx-auto">
                      <Sparkles className="h-5 w-5" /> Extract Insights
                    </button>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="flex flex-col items-center justify-center py-16 animate-in fade-in">
                    <Loader2 className="h-14 w-14 text-emerald-600 animate-spin mb-6" />
                    <h3 className="text-xl font-bold text-slate-800">Generating Eco-Report...</h3>
                    <p className="text-slate-500 mt-2">Running through TensorFlow & Llama 3 API</p>
                  </div>
                )}

                {result && !isAnalyzing && (
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-500">
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Detected Class:</span>
                      <div className={`px-5 py-2 rounded-full text-sm font-bold uppercase shadow-sm flex items-center gap-2 ${CATEGORY_COLORS[result.detected_class?.toLowerCase()] || CATEGORY_COLORS.unknown}`}>
                        <CheckCircle className="h-4 w-4" /> {result.detected_class}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Description Panel */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3 text-blue-600 font-bold">
                          <Info className="h-5 w-5" /> 
                          <span>Material Description</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">{result.description}</p>
                      </div>
                      
                      {/* Toxicity Panel */}
                      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3 text-orange-700 font-bold">
                          <ShieldAlert className="h-5 w-5" /> 
                          <span>Toxicity & Hazards</span>
                        </div>
                        <p className="text-orange-900 text-sm leading-relaxed">{result.toxicity}</p>
                      </div>

                      {/* Disposal Panel */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3 text-emerald-700 font-bold">
                          <Trash2 className="h-5 w-5" /> 
                          <span>Safe Disposal Guide</span>
                        </div>
                        <p className="text-emerald-900 text-sm leading-relaxed">{result.disposal}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        
        {/* Chat Window */}
        {isChatOpen && (
          <div className="mb-4 w-[90vw] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px] max-h-[70vh] animate-in slide-in-from-bottom-8 origin-bottom-right">
            
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">EcoBot Assistant</h3>
                  <p className="text-[10px] text-emerald-100 font-medium">Powered by Llama 3 API</p>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)} 
                className="hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Chat Messages List */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  }`}>
                    {/* Render basic markdown bolding if present */}
                    <span 
                      className="leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} 
                    />
                  </div>
                </div>
              ))}
              
              {/* Typing Indicator */}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-1.5">
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce delay-100"></div>
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Field */}
            <form onSubmit={sendChatMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask EcoBot a question..." 
                className="flex-1 px-4 py-2.5 bg-slate-100 border border-transparent rounded-full text-sm focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                disabled={isChatLoading}
              />
              <button 
                type="submit" 
                disabled={isChatLoading || !chatInput.trim()}
                className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Floating Chat Toggle Button */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl hover:shadow-emerald-500/50 transition-all hover:-translate-y-1 active:translate-y-0 group"
          aria-label="Toggle EcoBot Chat"
        >
          {isChatOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

    </div>
  );
}