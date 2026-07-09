import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Send, Bot, FlipHorizontal, Camera as CameraIcon, Cpu, Recycle, ShieldAlert, FileText, ChevronDown, CheckCircle, Leaf } from 'lucide-react';

const BACKEND_URL = 'https://vk2101-eco-vision-ai.hf.space';

const customStyles = `
  @keyframes dissolveSwap {
    0% { opacity: 0; filter: blur(12px); transform: scale(0.95); }
    15% { opacity: 1; filter: blur(0px); transform: scale(1); }
    85% { opacity: 1; filter: blur(0px); transform: scale(1); }
    100% { opacity: 0; filter: blur(12px); transform: scale(1.05); }
  }
  .animate-title-swap {
    animation: dissolveSwap 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  
  @keyframes scanLine {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  .animate-scan-line {
    animation: scanLine 2s linear infinite;
  }
  
  @keyframes gradientShine {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-gradient-shine {
    background-size: 200% auto;
    animation: gradientShine 4s linear infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }
  .animate-float {
    animation: float 8s ease-in-out infinite;
  }
  .animate-float-delayed {
    animation: float 9s ease-in-out 3s infinite;
  }
  .animate-float-fast {
    animation: float 5s ease-in-out 1s infinite;
  }

  .typing-dot-delay-0 {
    animation-delay: 0ms;
  }

  .typing-dot-delay-150 {
    animation-delay: 150ms;
  }

  .typing-dot-delay-300 {
    animation-delay: 300ms;
  }

  .glass-header { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255, 255, 255, 0.5); }
  .scan-line-sleek { height: 2px; width: 100%; background: #22c55e; box-shadow: 0 0 15px #22c55e; position: absolute; }
  .chat-bubble { border-radius: 18px 18px 4px 18px; }
  .status-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
  
  /* Smooth scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

type Message = { role: 'user' | 'assistant'; content: string };
type AnalysisResult = { detected_class: string; description: string; toxicity: string; disposal: string };

const fileToDataUrl = (file: File | Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
      return;
    }
    reject(new Error('Unable to read the image file.'));
  };
  reader.onerror = () => reject(reader.error ?? new Error('Unable to read the image file.'));
  reader.readAsDataURL(file);
});

const titles = [
  "தூய்மைAI (Thooymai AI)",
  "CleanAI (Smart Waste)",
  "स्वच्छAI (Swachh AI)",
  "పరిశుభ్రతAI (Parishubhratha AI)",
  "ಸ್ವಚ್ಛತೆAI (Swachhate AI)",
  "ശുചിത്വംAI (Shuchithwam AI)",
  "स्वच्छताAI (Swachhata AI)",
  "સ્વચ્છતાAI (Swachhata AI)",
  "পরিচ্ছন্নতাAI (Porichhonnota AI)",
  "ਸਫ਼ਾਈAI (Safai AI)",
  "ସ୍ୱଚ୍ಛତାAI (Swachhata AI)",
  "পৰিষ্কাৰAI (Poriskar AI)",
  "صفائیAI (Safai AI)"
];

export default function App() {
  const [titleIndex, setTitleIndex] = useState(0);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [image, setImage] = useState<File | Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Title Rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % titles.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // API Status Ping
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  // Camera Logic
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [mode, cameraFacingMode]);

  const startCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacingMode },
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (e) {
      console.error("Camera access denied", e);
      alert("Camera access is required to use this feature.");
      setMode('upload');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (cameraFacingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            setImage(blob);
            setImagePreview(URL.createObjectURL(blob));
            stopCamera();
            setMode('upload');
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setImage(e.target.files[0]);
      setImagePreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  // API Calls
  const extractInsights = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await fileToDataUrl(image) }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setAnalysisResult(data);
      
      const assistantMsg = `I just analyzed your image and found **${data.detected_class}**! Let me know if you need more details.`;
      setChatMessages((prev) => [...prev, { role: 'assistant', content: assistantMsg }]);
      setChatOpen(true);
    } catch (e) {
      console.error("Analysis failed", e);
      alert("Failed to extract insights. Is the backend running?");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const newMessages: Message[] = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatTyping(true);
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setChatMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't connect to the server right now." }]);
    } finally {
      setIsChatTyping(false);
    }
  };

  // Chat auto-scroll
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatTyping, chatOpen]);

  // Helpers
  const formatMessage = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getColorForClassHeader = (cls: string) => {
    if (!cls) return 'bg-slate-50 border-slate-100';
    const lower = cls.toLowerCase();
    if (lower.includes('plastic')) return 'bg-rose-50 border-rose-100';
    if (lower.includes('glass')) return 'bg-teal-50 border-teal-100';
    if (lower.includes('cardboard') || lower.includes('paper')) return 'bg-amber-50 border-amber-100';
    if (lower.includes('metal') || lower.includes('can')) return 'bg-slate-100 border-slate-200';
    return 'bg-emerald-50 border-emerald-100';
  };

  const getColorForClassTextMuted = (cls: string) => {
    if (!cls) return 'text-slate-400';
    const lower = cls.toLowerCase();
    if (lower.includes('plastic')) return 'text-rose-400';
    if (lower.includes('glass')) return 'text-teal-500';
    if (lower.includes('cardboard') || lower.includes('paper')) return 'text-amber-500';
    if (lower.includes('metal') || lower.includes('can')) return 'text-slate-400';
    return 'text-emerald-500';
  };

  const getColorForClassTextSolid = (cls: string) => {
    if (!cls) return 'text-slate-600';
    const lower = cls.toLowerCase();
    if (lower.includes('plastic')) return 'text-rose-600';
    if (lower.includes('glass')) return 'text-teal-700';
    if (lower.includes('cardboard') || lower.includes('paper')) return 'text-amber-600';
    if (lower.includes('metal') || lower.includes('can')) return 'text-slate-700';
    return 'text-emerald-700';
  };

  return (
    <>
      <style>{customStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-100 flex flex-col font-sans overflow-x-hidden pb-8 relative z-0">
        
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-200/40 blur-[100px] animate-float"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-teal-200/40 blur-[100px] animate-float-delayed"></div>
          <div className="absolute top-[30%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-blue-100/40 blur-[80px] animate-float-fast"></div>
        </div>

        {/* Header */}
        <header className="glass-header h-16 flex items-center justify-between px-4 sm:px-8 z-50 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
              <Recycle className="w-5 h-5 text-white" />
            </div>
            <div key={titleIndex} className="animate-title-swap">
              <h1 
                className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 animate-gradient-shine inline-block tracking-tight"
              >
                {titles[titleIndex].split(' ')[0]} <span className="text-sm font-medium text-slate-400 ml-1">{titles[titleIndex].split(' ').slice(1).join(' ')}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/60 hover:bg-white/90 transition-colors px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm cursor-help" title="Backend Connection Status">
              <span className="relative flex h-2 w-2">
                {apiStatus === 'online' && <span className="status-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
              </span>
              <span className={`text-xs font-semibold tracking-wide ${apiStatus === 'online' ? 'text-emerald-700' : apiStatus === 'offline' ? 'text-red-700' : 'text-yellow-700'}`}>
                API: {apiStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
          <div className={`w-full max-w-6xl transition-all duration-500 ${imagePreview || mode === 'camera' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'flex justify-center'}`}>
            
            {!imagePreview && mode === 'upload' && (
              <div className="w-full max-w-2xl bg-white/70 backdrop-blur-xl p-8 sm:p-12 rounded-[2rem] shadow-xl border border-white/60 text-center transition-all mt-4 hover:shadow-2xl hover:-translate-y-1 duration-300">
                <div 
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-10 sm:p-16 transition-all cursor-pointer group flex flex-col items-center justify-center gap-4 relative overflow-hidden ${
                    dragActive 
                      ? 'border-emerald-500 bg-emerald-50/80 scale-[1.02] shadow-inner' 
                      : 'border-emerald-300 hover:bg-emerald-50/50 hover:border-emerald-400'
                  }`}
                >
                  {dragActive && (
                    <div className="absolute inset-0 bg-emerald-400/5 backdrop-blur-[1px] z-0"></div>
                  )}
                  <div className={`p-5 rounded-full transition-all duration-300 shadow-sm z-10 ${
                    dragActive 
                      ? 'bg-emerald-200 text-emerald-700 scale-125' 
                      : 'bg-emerald-100 text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-200'
                  }`}>
                    <Upload size={40} strokeWidth={1.5} className={dragActive ? 'animate-bounce' : ''} />
                  </div>
                  <div className="z-10">
                    <p className={`font-semibold text-lg sm:text-xl transition-colors ${dragActive ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {dragActive ? "Drop image now!" : "Drag & Drop an image here"}
                    </p>
                    <p className="text-slate-500 text-sm mt-1">or click to browse from your device</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} id="file-upload" />
                  <label htmlFor="file-upload" className="mt-6 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/40 transition-all font-medium cursor-pointer z-10 active:scale-95">
                    Choose File
                  </label>
                </div>
                
                <div className="mt-8 flex items-center justify-center gap-4 opacity-70">
                  <div className="h-px bg-slate-300 flex-1" />
                  <span className="text-slate-500 text-sm font-medium tracking-widest uppercase">Or</span>
                  <div className="h-px bg-slate-300 flex-1" />
                </div>
                
                <button 
                  onClick={() => setMode('camera')} 
                  className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl shadow-lg transition-all font-medium text-lg hover:shadow-xl active:scale-[0.98] group"
                >
                  <CameraIcon size={22} className="group-hover:scale-110 transition-transform" /> Use Camera
                </button>
              </div>
            )}

            {mode === 'camera' && (
              <div className="w-full lg:col-span-7 bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl border-4 border-white aspect-[4/3] sm:aspect-video lg:aspect-auto lg:h-[70vh] min-h-[400px] flex flex-col mx-auto max-w-2xl lg:max-w-none group animate-in zoom-in-95 duration-300">
                <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
                  <button 
                    onClick={() => { stopCamera(); setMode('upload'); }} 
                    className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-all shadow-lg hover:scale-110 active:scale-95"
                    title="Close Camera"
                  >
                    <X size={24} />
                  </button>
                  <button 
                    onClick={() => setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user')} 
                    className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all shadow-lg hover:scale-110 active:scale-95"
                    title="Flip Camera"
                  >
                    <FlipHorizontal size={24} />
                  </button>
                </div>
                
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className={`w-full h-full object-cover bg-black transition-transform duration-500 ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
                />
                
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="scan-line-sleek animate-scan-line" />
                </div>
                
                {/* Viewfinder Corners */}
                <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-emerald-400/70 rounded-tl-xl pointer-events-none z-10 transition-all group-hover:border-emerald-400"></div>
                <div className="absolute top-6 right-6 w-12 h-12 border-t-4 border-r-4 border-emerald-400/70 rounded-tr-xl pointer-events-none z-10 transition-all group-hover:border-emerald-400"></div>
                <div className="absolute bottom-6 left-6 w-12 h-12 border-b-4 border-l-4 border-emerald-400/70 rounded-bl-xl pointer-events-none z-10 transition-all group-hover:border-emerald-400"></div>
                <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-emerald-400/70 rounded-br-xl pointer-events-none z-10 transition-all group-hover:border-emerald-400"></div>
                
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
                  <button 
                    onClick={capturePhoto} 
                    className="px-6 py-3 bg-emerald-600 text-white rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-emerald-500 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all whitespace-nowrap active:scale-95"
                  >
                    <CameraIcon className="w-5 h-5" /> Capture Photo
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {imagePreview && mode === 'upload' && (
              <>
                {/* Left Column: Image Preview / col-span-7 */}
                <div className="lg:col-span-7 flex flex-col gap-4 animate-in slide-in-from-left-4 duration-500">
                  <div className="w-full bg-slate-900 rounded-3xl overflow-hidden relative shadow-2xl border-4 border-white aspect-[4/3] sm:aspect-video lg:aspect-auto lg:h-[70vh] min-h-[400px] flex flex-col group">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    
                    {isAnalyzing && (
                      <div className="absolute inset-0 z-10 overflow-hidden bg-slate-900/60 backdrop-blur-sm transition-all flex flex-col items-center justify-center">
                        <div className="scan-line-sleek animate-scan-line" />
                        <div className="relative">
                          <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-50 rounded-full"></div>
                          <Cpu className="w-16 h-16 text-emerald-400 animate-pulse relative z-10" />
                        </div>
                        <p className="text-white font-medium mt-4 tracking-widest uppercase animate-pulse">Analyzing Material...</p>
                      </div>
                    )}
                    
                    {/* Viewfinder Corners */}
                    <div className="absolute top-6 left-6 w-12 h-12 border-t-4 border-l-4 border-white/50 rounded-tl-xl pointer-events-none z-10"></div>
                    <div className="absolute top-6 right-6 w-12 h-12 border-t-4 border-r-4 border-white/50 rounded-tr-xl pointer-events-none z-10"></div>
                    <div className="absolute bottom-6 left-6 w-12 h-12 border-b-4 border-l-4 border-white/50 rounded-bl-xl pointer-events-none z-10"></div>
                    <div className="absolute bottom-6 right-6 w-12 h-12 border-b-4 border-r-4 border-white/50 rounded-br-xl pointer-events-none z-10"></div>
                    
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
                      <button 
                        onClick={extractInsights} 
                        disabled={isAnalyzing}
                        className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-emerald-500 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-xl whitespace-nowrap active:scale-95"
                      >
                        {isAnalyzing ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing</>
                        ) : (
                          <><Cpu className="w-5 h-5" /> Extract Insights</>
                        )}
                      </button>
                      <button 
                        onClick={() => { setImage(null); setImagePreview(null); setAnalysisResult(null); }} 
                        disabled={isAnalyzing}
                        className="px-6 py-3 bg-slate-800/80 backdrop-blur-md text-white rounded-full font-bold shadow-xl border border-slate-600 flex items-center gap-2 hover:bg-red-500 hover:border-red-500 transition-all hidden sm:flex disabled:opacity-50 hover:-translate-y-1 active:scale-95"
                      >
                        <X className="w-5 h-5" /> Discard
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Right Column: Results / col-span-5 */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  {analysisResult ? (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-700">
                      {/* Identified Class */}
                      <div className={`p-6 border rounded-3xl shadow-lg relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ${getColorForClassHeader(analysisResult.detected_class)}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Recycle size={120} />
                        </div>
                        <div className="relative z-10">
                          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${getColorForClassTextMuted(analysisResult.detected_class)}`}>Material Detected</p>
                          <h2 className={`text-4xl font-black italic ${getColorForClassTextSolid(analysisResult.detected_class)}`}>{analysisResult.detected_class}</h2>
                        </div>
                      </div>
                      
                      {/* Description Card (Blue) */}
                      <div className="p-5 bg-blue-50/80 backdrop-blur-sm border border-blue-100 rounded-3xl flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow group">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shrink-0 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm">
                          <FileText size={22} />
                        </div>
                        <div>
                          <h3 className="font-bold text-blue-900">Description</h3>
                          <p className="text-sm text-blue-700 leading-relaxed mt-1.5">{analysisResult.description}</p>
                        </div>
                      </div>
                      
                      {/* Toxicity Card (Orange) */}
                      <div className="p-5 bg-orange-50/80 backdrop-blur-sm border border-orange-100 rounded-3xl flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow group">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl shrink-0 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm">
                          <ShieldAlert size={22} />
                        </div>
                        <div>
                          <h3 className="font-bold text-orange-900">Toxicity Level</h3>
                          <p className="text-sm text-orange-700 leading-relaxed mt-1.5">{analysisResult.toxicity}</p>
                        </div>
                      </div>
                      
                      {/* Disposal Card (Emerald) */}
                      <div className="p-5 bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 rounded-3xl flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow group">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm">
                          <Leaf size={22} />
                        </div>
                        <div>
                          <h3 className="font-bold text-emerald-900">Disposal Instructions</h3>
                          <p className="text-sm text-emerald-700 leading-relaxed mt-1.5">{analysisResult.disposal}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full bg-white/40 backdrop-blur-xl rounded-[2rem] border-2 border-white/60 border-dashed flex items-center justify-center p-12 text-center text-slate-400 min-h-[400px] animate-in fade-in duration-1000 shadow-sm">
                      <div className="flex flex-col items-center">
                        <div className="p-6 bg-slate-100/60 rounded-full mb-6 shadow-inner relative">
                          <div className="absolute inset-0 border-2 border-slate-200 border-dashed rounded-full animate-[spin_10s_linear_infinite]"></div>
                          <Cpu size={48} className="opacity-40" />
                        </div>
                        <p className="font-semibold text-lg text-slate-600">Awaiting Analysis</p>
                        <p className="text-sm mt-2 text-slate-500 max-w-xs leading-relaxed">Click <span className="font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Extract Insights</span> to process the image with our AI vision engine.</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>

        {/* Floating Chatbot */}
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 flex flex-col items-end gap-4 z-50">
          <div className={`w-[calc(100vw-3rem)] sm:w-[350px] h-[550px] max-h-[75vh] bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-200/60 overflow-hidden transition-all duration-500 origin-bottom-right ${chatOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-10 pointer-events-none hidden'}`}>
            <div className="bg-gradient-to-r from-emerald-700 to-teal-600 p-4 text-white flex items-center justify-between shrink-0 shadow-md z-10 relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-sm">
                  <Bot size={18} className="text-white drop-shadow-sm" />
                </div>
                <div>
                  <div className="font-bold text-sm tracking-wide">EcoBot Assistant</div>
                  <div className="text-[10px] text-emerald-100 font-medium opacity-80">Powered by Groq API</div>
                </div>
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,1)] animate-pulse"></div>
                <button onClick={() => setChatOpen(false)} title="Close chat" aria-label="Close chat" className="hover:bg-white/20 p-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-5 bg-slate-50/50 relative">
              {chatMessages.length === 0 && (
                <div className="text-center flex flex-col items-center justify-center h-full text-slate-500 text-sm opacity-80 animate-in fade-in zoom-in duration-700">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Bot size={32} className="text-emerald-600" />
                  </div>
                  <p className="font-medium text-slate-600 mb-1">Hello! I'm EcoBot.</p>
                  <p className="max-w-[200px] leading-relaxed">I'm here to help with your waste management. How can I assist today?</p>
                </div>
              )}
              
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  {msg.role === 'user' ? (
                    <div className="bg-emerald-600 p-3.5 chat-bubble text-sm text-white shadow-md max-w-[85%] break-words">
                      {formatMessage(msg.content)}
                    </div>
                  ) : (
                    <div className="bg-white p-3.5 rounded-2xl rounded-bl-none text-sm text-slate-700 shadow-sm border border-slate-100 break-words max-w-[85%]">
                      {formatMessage(msg.content)}
                    </div>
                  )}
                </div>
              ))}
              
              {isChatTyping && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce typing-dot-delay-0" />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce typing-dot-delay-150" />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce typing-dot-delay-300" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-white shrink-0 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 bg-slate-100/80 rounded-full p-1 border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500 transition-all">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="Ask EcoBot..." 
                  className="flex-1 text-sm bg-transparent border-none rounded-full px-4 py-2 outline-none text-slate-700 placeholder-slate-400"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isChatTyping} 
                  title="Send message"
                  aria-label="Send message"
                  className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all shadow-md active:scale-95"
                >
                  <Send size={16} className="-ml-0.5" />
                </button>
              </form>
            </div>
          </div>

          {!chatOpen && (
            <button 
              onClick={() => setChatOpen(true)}
              title="Open chat"
              aria-label="Open chat"
              className="group relative w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-full shadow-[0_10px_25px_rgba(16,185,129,0.4)] flex items-center justify-center text-white cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-all duration-300 active:scale-95"
            >
              <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <Bot size={28} className="drop-shadow-md group-hover:animate-bounce" />
              {chatMessages.length > 0 && !chatOpen && (
                <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-white rounded-full"></div>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
