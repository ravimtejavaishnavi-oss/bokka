import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video as VideoIcon, Send, X, AlertCircle, MessageSquare, User as UserIcon, Clock, Maximize2, Download, ArrowLeft, Plus, Wand2, RefreshCw } from 'lucide-react';

interface ChatMessage {
  id: string;
  isUser: boolean;
  type: 'text' | 'loading' | 'error' | 'video';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
  prompt?: string;
  referenceVideoId?: string; // ID of the video being modified
}

const STORAGE_KEY = 'videoGenerationChatMessages';

type VideoGenerationChatProps = { onBack?: () => void };

const VideoGenerationChat: React.FC<VideoGenerationChatProps> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [playableUrls, setPlayableUrls] = useState<Record<string, string>>({});
  const createdBlobUrlsRef = useRef<string[]>([]);

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        const welcome: ChatMessage = {
          id: 'welcome',
          isUser: false,
          type: 'text',
          text: '✨ Welcome to Interactive Video Generation! Describe the video you want me to generate, and I will create it for you.\n\n💡 Interactive Features:\n• Generate a video, then modify it with follow-up requests\n• Use quick modification buttons on generated videos\n• Reference previous videos in your prompts\n• Create variations and iterations\n\n📝 Tips:\n• Be specific about actions, scenes, and mood\n• Describe camera movements and transitions\n• Mention style, colors, and atmosphere\n• For modifications, describe what you want to change',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setMessages([welcome]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Prepare playable URLs for video messages (handle auth-gated internal endpoints)
  useEffect(() => {
    const prepare = async (id: string, url: string) => {
      try {
        // If URL points to internal API (requires Authorization), we'll use it directly with credentials
        // instead of creating blob URLs which can be rejected by browser security
        const isInternalApi = url.startsWith('/api/') || url.includes('azurewebsites.net/api');
        
        if (isInternalApi) {
          console.log(`Preparing video URL for internal API: ${url.substring(0, 100)}...`);
          
          // Build the full URL with token as query parameter for direct video element access
          // This avoids blob URL security issues
          const token = localStorage.getItem('authToken');
          const fullUrl = url.startsWith('/api/') && import.meta.env.PROD
            ? `https://aiva-backend-prod-app.azurewebsites.net${url}`
            : url;
          
          // Add token as query parameter so video element can access it directly
          // Backend will accept token in query params
          const urlWithToken = token 
            ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
            : fullUrl;
          
          console.log(`Using direct URL with token for video element access`);
          setPlayableUrls(prev => ({ ...prev, [id]: urlWithToken }));
        } else {
          // Use original URL for public/cross-origin URLs
          console.log(`Using direct video URL: ${url.substring(0, 100)}...`);
          setPlayableUrls(prev => ({ ...prev, [id]: url }));
        }
      } catch (error) {
        console.error(`Error preparing video URL for ${id}:`, error);
        // On error, use the original URL directly - video element might handle it
        const originalUrl = url.startsWith('/api/') && import.meta.env.PROD
          ? `https://aiva-backend-prod-app.azurewebsites.net${url}`
          : url;
        setPlayableUrls(prev => ({ ...prev, [id]: originalUrl }));
      }
    };

    messages.forEach(m => {
      if (m.type === 'video' && m.mediaUrl && !playableUrls[m.id]) {
        prepare(m.id, m.mediaUrl);
      }
    });
  }, [messages, playableUrls]);

  // Cleanup any created blob URLs on unmount
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      createdBlobUrlsRef.current = [];
    };
  }, []);

  const pollStatus = async (jobId: string, loadingId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      // Use full backend URL in production
      const backendUrl = import.meta.env.PROD 
        ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
        : '/api';
      const res = await fetch(`${backendUrl}/generate/video/${jobId}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.status === 429) {
        // Just wait a bit longer and retry
        return;
      }

      if (!res.ok) {
        let errText = `HTTP ${res.status}: ${res.statusText}`;
        try { const d = await res.json(); errText = d.error || d.message || errText; } catch {}
        throw new Error(errText);
      }

      const data = await res.json();

      if (['processing', 'preprocessing', 'running', 'queued'].includes(data.status)) {
        // keep polling
        return;
      }

      // Stop timer
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (data.status === 'succeeded') {
        let videoUrl: string | null = null;
        let contentUrl: string | null = null;
        
        console.log('Video generation succeeded, response data:', {
          hasGenerations: !!data.generations,
          generationsLength: data.generations?.length,
          hasDirectVideo: !!data.video,
          fullData: data
        });
        
        if (data.generations && data.generations.length > 0) {
          const gen = data.generations[0];
          console.log('First generation:', {
            hasVideo: !!gen.video,
            hasContentUrl: !!gen.contentUrl,
            hasId: !!gen.id,
            genKeys: Object.keys(gen)
          });
          
          if (gen.video) {
            videoUrl = gen.video;
            console.log('Using direct video URL from generation');
          }
          if (gen.contentUrl) {
            contentUrl = gen.contentUrl;
            console.log('Found contentUrl:', contentUrl);
          }
        }
        if (!videoUrl && data.video) {
          videoUrl = data.video;
          console.log('Using direct video URL from response');
        }
        if (!videoUrl && contentUrl) {
          videoUrl = contentUrl;
          console.log('Using contentUrl as video URL');
        }

        if (videoUrl) {
          console.log('Video URL determined:', videoUrl.substring(0, 100) + '...');
          // Ensure contentUrl uses full backend URL if it's a relative path
          if (videoUrl.startsWith('/api/') && import.meta.env.PROD) {
            videoUrl = `https://aiva-backend-prod-app.azurewebsites.net${videoUrl}`;
          }
          
          // Find the user prompt that triggered this video by looking at previous messages
          setMessages(prev => {
            const loadingIndex = prev.findIndex(m => m.id === loadingId);
            const userPrompt = loadingIndex > 0 ? prev[loadingIndex - 1]?.text || '' : '';
            const videoMsg: ChatMessage = {
              id: `vid-${Date.now()}`,
              isUser: false,
              type: 'video',
              mediaUrl: videoUrl!,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              prompt: userPrompt
            };
            return prev.filter(m => m.id !== loadingId).concat(videoMsg);
          });
        } else {
          console.error('No video URL found in response:', data);
          const infoMsg: ChatMessage = {
            id: `i-${Date.now()}`,
            isUser: false,
            type: 'error',
            text: 'Video generation finished but content URL was not found. Please check the console for details or try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          setMessages(prev => prev.filter(m => m.id !== loadingId).concat(infoMsg));
        }
      } else if (data.status === 'failed') {
        const errMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          isUser: false,
          type: 'error',
          text: `Video generation failed${data.failure_reason ? `: ${data.failure_reason}` : ''}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setMessages(prev => prev.filter(m => m.id !== loadingId).concat(errMsg));
      } else if (data.status === 'cancelled') {
        const errMsg: ChatMessage = {
          id: `c-${Date.now()}`,
          isUser: false,
          type: 'error',
          text: 'Video generation was cancelled',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setMessages(prev => prev.filter(m => m.id !== loadingId).concat(errMsg));
      }
    } catch (err: any) {
      if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        isUser: false,
        type: 'error',
        text: err?.message || 'Failed to check video status',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => prev.concat(errMsg));
    }
  };

  const handleModify = (videoId: string, videoPrompt: string) => {
    // Pre-fill input with modification prompt hint
    setInput(`Based on the previous video, modify: `);
    // Focus on input
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      inputElement?.focus();
      inputElement?.setSelectionRange(inputElement.value.length, inputElement.value.length);
    }, 100);
  };

  const handleQuickModify = (videoId: string, videoPrompt: string, modification: string) => {
    // Create enhanced prompt with context
    const enhancedPrompt = `Based on this video: "${videoPrompt}", ${modification.toLowerCase()}`;
    handleSend(undefined, enhancedPrompt);
  };

  const handleRegenerate = (videoId: string, prompt: string) => {
    handleSend(undefined, prompt);
  };

  const handleNewChat = () => {
    // Clear messages and reset to welcome message
    const welcome: ChatMessage = {
      id: 'welcome',
      isUser: false,
      type: 'text',
      text: '✨ Welcome to Interactive Video Generation! Describe the video you want me to generate, and I will create it for you.\n\n💡 Interactive Features:\n• Generate a video, then modify it with follow-up requests\n• Use quick modification buttons on generated videos\n• Reference previous videos in your prompts\n• Create variations and iterations\n\n📝 Tips:\n• Be specific about actions, scenes, and mood\n• Describe camera movements and transitions\n• Mention style, colors, and atmosphere\n• For modifications, describe what you want to change',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setMessages([welcome]);
    setInput('');
    setPreviewUrl(null);
    setProcessingTime(0);
    // Stop any ongoing polling
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
    } catch {
      // ignore
    }
  };

  const handleSend = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const prompt = promptOverride || input.trim();
    if (!prompt) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, isUser: true, type: 'text', text: prompt, timestamp, prompt };
    const loadingId = `l-${Date.now()}`;
    const loadingMsg: ChatMessage = { id: loadingId, isUser: false, type: 'loading', text: 'Starting video generation...', timestamp };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    if (!promptOverride) {
      setInput('');
    }

    try {
      const token = localStorage.getItem('authToken');
      // Use full backend URL in production
      const backendUrl = import.meta.env.PROD 
        ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
        : '/api';
      const res = await fetch(`${backendUrl}/generate/video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        let errText = `HTTP ${res.status}: ${res.statusText}`;
        try { const data = await res.json(); errText = data.error || data.message || errText; } catch {}
        throw new Error(errText);
      }

      const data = await res.json();
      const jobId: string | undefined = data?.id;
      if (!jobId) throw new Error('Failed to start video generation job');

      // Start processing timer
      startTimeRef.current = Date.now();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setProcessingTime(elapsed);
        }
        // Poll status
        pollStatus(jobId, loadingId);
      }, 10000);

      // Immediate first poll for faster feedback
      await pollStatus(jobId, loadingId);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        isUser: false,
        type: 'error',
        text: err?.message || 'Failed to start video generation',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => prev.filter(m => m.id !== loadingId).concat(errorMsg));
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      <div className="flex-1 flex flex-col h-screen">
        <header className="bg-slate-800 text-white p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate('/dashboard'))}
              className="mr-1 p-2 rounded hover:bg-slate-700 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <VideoIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">Video Generation</h1>
          </div>
          <div className="flex items-center space-x-3">
            {processingTime > 0 && (
              <div className="text-sm text-slate-300 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {Math.floor(processingTime / 60)}:{(processingTime % 60).toString().padStart(2, '0')}
              </div>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 p-6 overflow-y-auto scroll-smooth">
            <div className="max-w-4xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="mb-6 transition-all duration-300 rounded-lg p-2">
                  <div className={`flex items-start space-x-3 ${msg.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.isUser ? 'bg-blue-600' : msg.type === 'error' ? 'bg-red-600' : msg.type === 'loading' ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {msg.isUser ? (
                        <UserIcon className="w-4 h-4 text-white" />
                      ) : msg.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-white" />
                      ) : msg.type === 'loading' ? (
                        <Clock className="w-4 h-4 text-white animate-pulse" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`rounded-lg p-4 mb-2 ${
                        msg.isUser
                          ? 'bg-blue-600 text-white ml-12'
                          : msg.type === 'error'
                            ? 'bg-red-100 text-red-800 mr-12 border border-red-300'
                            : msg.type === 'loading'
                              ? 'bg-slate-100 text-slate-600 mr-12 animate-pulse'
                              : 'bg-slate-200 text-slate-800 mr-12'
                      }`}>
                        {msg.type === 'video' && msg.mediaUrl ? (
                          <div className="space-y-3">
                            <div className="relative group">
                              {(() => {
                                const playUrl = playableUrls[msg.id] || msg.mediaUrl!;
                                const isBlobUrl = playUrl.startsWith('blob:');
                                const originalUrl = msg.mediaUrl!;
                                
                                return (
                                  <video
                                    key={`video-${msg.id}-${isBlobUrl ? 'blob' : 'direct'}-${playUrl.substring(playUrl.length - 20)}`}
                                    src={playUrl}
                                    controls
                                    playsInline
                                    preload="auto"
                                    crossOrigin={playUrl.includes('token=') ? "anonymous" : undefined}
                                    className="max-w-full rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ maxWidth: '100%', borderRadius: '0.5rem', marginTop: 0 }}
                                    onLoadedMetadata={(e) => {
                                      const video = e.currentTarget;
                                      console.log(`Video metadata loaded for ${msg.id}:`, {
                                        duration: video.duration,
                                        videoWidth: video.videoWidth,
                                        videoHeight: video.videoHeight,
                                        readyState: video.readyState,
                                        isBlobUrl
                                      });
                                      if (video.duration === 0 || isNaN(video.duration)) {
                                        console.error('Video has zero or invalid duration!');
                                      }
                                    }}
                                    onError={async (e) => {
                                      const video = e.currentTarget;
                                      console.error(`Video error for ${msg.id}:`, {
                                        error: video.error,
                                        code: video.error?.code,
                                        message: video.error?.message,
                                        networkState: video.networkState,
                                        readyState: video.readyState,
                                        src: video.src.substring(0, 100),
                                        isBlobUrl,
                                        currentUrl: playUrl.substring(0, 100)
                                      });
                                      
                                      // If error code 4 (security rejection), try alternative approaches
                                      if (video.error?.code === 4) {
                                        console.log('Video rejected by browser security, attempting fix...');
                                        
                                        // If it was a blob URL, revoke it
                                        if (isBlobUrl) {
                                          URL.revokeObjectURL(playUrl);
                                        }
                                        
                                        // Use the original URL with token query parameter (even if we already tried)
                                        const token = localStorage.getItem('authToken');
                                        const fullOriginalUrl = originalUrl.startsWith('/api/') && import.meta.env.PROD
                                          ? `https://aiva-backend-prod-app.azurewebsites.net${originalUrl}`
                                          : originalUrl;
                                        
                                        // Ensure token is included
                                        let urlWithToken = fullOriginalUrl;
                                        if (token && !fullOriginalUrl.includes('token=')) {
                                          urlWithToken = `${fullOriginalUrl}${fullOriginalUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
                                        }
                                        
                                        // If current URL already has token, try adding crossOrigin attribute
                                        if (playUrl === urlWithToken) {
                                          console.log('URL already has token, trying with crossOrigin="use-credentials"');
                                          // Force reload with credentials
                                          setTimeout(() => {
                                            video.setAttribute('crossOrigin', 'use-credentials');
                                            video.load();
                                          }, 100);
                                        } else {
                                          // Update to use direct URL with token
                                          console.log('Updating to URL with token');
                                          setPlayableUrls(prev => ({ ...prev, [msg.id]: urlWithToken }));
                                          
                                          // Force video reload with new src
                                          setTimeout(() => {
                                            video.load();
                                          }, 100);
                                        }
                                      }
                                    }}
                                    onLoadedData={(e) => {
                                      const video = e.currentTarget;
                                      console.log(`Video data loaded for ${msg.id}, duration: ${video.duration}s`);
                                    }}
                                  >
                                    <source src={playUrl} type="video/mp4" />
                                    Your browser does not support the video tag.
                                  </video>
                                );
                              })()}
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white rounded p-1">
                                <button
                                  type="button"
                                  className="p-0 m-0"
                                  onClick={(e) => { e.stopPropagation(); setPreviewUrl(playableUrls[msg.id] || msg.mediaUrl!); }}
                                  title="Expand"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </div>
                              <button
                                type="button"
                                title="Download Video"
                                onClick={(e) => { e.stopPropagation(); handleDownload(msg.mediaUrl!, `generated_video_${Date.now()}.mp4`); }}
                                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/70 text-white rounded p-1"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* Video Actions */}
                            <div className="space-y-3 pt-2 border-t border-slate-300">
                              {msg.prompt && (
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerate(msg.id, msg.prompt!)}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                                    title="Regenerate video"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Regenerate</span>
                                  </button>
                                </div>
                              )}
                              
                              {/* Modify Section */}
                              {msg.prompt && (
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Wand2 className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium text-slate-700">Modify this video:</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Make it longer')}
                                      className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                    >
                                      ⏱️ Longer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Change the scene')}
                                      className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                    >
                                      🎬 New Scene
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Add more action')}
                                      className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                    >
                                      🎬 More Action
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Change the style')}
                                      className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                    >
                                      🎨 New Style
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleModify(msg.id, msg.prompt || '')}
                                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                                    >
                                      ✏️ Custom Modify
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                        )}
                      </div>
                      <div className={`flex items-center ${msg.isUser ? 'justify-end' : ''}`}>
                        <span className="text-xs text-slate-400 ml-2">{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 p-4 flex-shrink-0 sticky bottom-0 bg-white z-20">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSend} className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe the video or modification you want..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={`p-3 rounded-lg transition-colors flex items-center ${
                    input.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            <button
              className="absolute -top-10 right-0 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <video controls className="w-full max-h-[80vh] rounded">
              <source src={previewUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGenerationChat;
