import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Image as ImageIcon, Send, X, AlertCircle, MessageSquare, User as UserIcon, 
  Clock, Maximize2, Download, ArrowLeft, RefreshCw, Sparkles, Settings, 
  Heart, Share2, Copy, Wand2, ImagePlus, Loader2, CheckCircle, Plus
} from 'lucide-react';

interface ChatMessage {
  id: string;
  isUser: boolean;
  type: 'text' | 'loading' | 'error' | 'image';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
  prompt?: string;
  size?: string;
  quality?: string;
  referenceImageId?: string; // ID of the image being modified
}

const STORAGE_KEY = 'imageGenerationChatMessages';
const FAVORITES_KEY = 'imageGenerationFavorites';

// Image size options
const IMAGE_SIZES = [
  { value: '1024x1024', label: 'Square (1024×1024)' },
  { value: '1024x1792', label: 'Portrait (1024×1792)' },
  { value: '1792x1024', label: 'Landscape (1792×1024)' }
];

// Quality options
const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'hd', label: 'HD' }
];

// Prompt suggestions for inspiration
const PROMPT_SUGGESTIONS = [
  'A futuristic cityscape at sunset with flying cars',
  'A serene mountain landscape with a crystal-clear lake',
  'A cozy coffee shop on a rainy day',
  'A majestic lion in the African savanna',
  'An abstract digital art piece with vibrant colors',
  'A steampunk-inspired mechanical dragon',
  'A beautiful Japanese garden with cherry blossoms',
  'A space station orbiting a distant planet'
];

type ImageGenerationChatProps = { onBack?: () => void };

const ImageGenerationChat: React.FC<ImageGenerationChatProps> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('1024x1024');
  const [selectedQuality, setSelectedQuality] = useState<string>('standard');
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load favorites on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save favorites
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch {
      // ignore
    }
  }, [favorites]);

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (imageUrl: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Generated Image',
          text: 'Check out this AI-generated image!',
          url: imageUrl
        });
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(imageUrl);
      alert('Image URL copied to clipboard!');
    }
  };

  const handleCopyPrompt = (prompt: string, messageId: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleFavorite = (messageId: string) => {
    setFavorites(prev => {
      const newFavs = new Set(prev);
      if (newFavs.has(messageId)) {
        newFavs.delete(messageId);
      } else {
        newFavs.add(messageId);
      }
      return newFavs;
    });
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
          text: '✨ Welcome to Interactive Image Generation! Describe the image you want me to create, and I will generate it for you using DALL-E 3.\n\n💡 Interactive Features:\n• Generate an image, then modify it with follow-up requests\n• Use quick modification buttons on generated images\n• Reference previous images in your prompts\n• Create variations and iterations\n\n📝 Tips for Better Results:\n• Be specific about details, style, and mood\n• Mention colors, composition, and atmosphere\n• Use adjectives to describe the desired aesthetic\n• For modifications, describe what you want to change',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        setMessages([welcome]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, promptOverride?: string, regenerateId?: string) => {
    if (e) e.preventDefault();
    const prompt = promptOverride || input.trim();
    if (!prompt || isGenerating) return;

    setIsGenerating(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userMsg: ChatMessage = { 
      id: `u-${Date.now()}`, 
      isUser: true, 
      type: 'text', 
      text: prompt, 
      timestamp,
      prompt,
      size: selectedSize,
      quality: selectedQuality
    };
    const loadingMsg: ChatMessage = { 
      id: `l-${Date.now()}`, 
      isUser: false, 
      type: 'loading', 
      text: 'Generating your image... This usually takes 10-20 seconds.', 
      timestamp 
    };

    if (regenerateId) {
      // Replace existing message
      setMessages(prev => {
        const index = prev.findIndex(m => m.id === regenerateId);
        if (index === -1) return [...prev, userMsg, loadingMsg];
        return [
          ...prev.slice(0, index),
          userMsg,
          loadingMsg,
          ...prev.slice(index + 1)
        ];
      });
    } else {
      setMessages(prev => [...prev, userMsg, loadingMsg]);
    }
    
    setInput('');

    try {
      const token = localStorage.getItem('authToken');
      const backendUrl = import.meta.env.PROD 
        ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
        : '/api';
      
      const res = await fetch(`${backendUrl}/generate/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ 
          prompt,
          size: selectedSize,
          quality: selectedQuality
        })
      });

      if (!res.ok) {
        let errText = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const data = await res.json();
          errText = data.error || data.message || errText;
        } catch {}
        throw new Error(errText);
      }

      const data = await res.json();
      let url: string | null = null;
      if (data?.data?.length > 0 && data.data[0].url) url = data.data[0].url;
      if (!url && data?.url) url = data.url;
      if (!url && data?.data?.[0]?.b64_json) {
        // Handle base64 response
        url = `data:image/png;base64,${data.data[0].b64_json}`;
      }
      if (!url) throw new Error('No image URL returned');

      const imageMsg: ChatMessage = {
        id: `img-${Date.now()}`,
        isUser: false,
        type: 'image',
        mediaUrl: url,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        prompt,
        size: selectedSize,
        quality: selectedQuality
      };

      setMessages(prev => {
        if (regenerateId) {
          const index = prev.findIndex(m => m.id === loadingMsg.id);
          if (index === -1) return prev.filter(m => m.id !== loadingMsg.id).concat(imageMsg);
          return [
            ...prev.slice(0, index),
            imageMsg,
            ...prev.slice(index + 1).filter(m => m.id !== loadingMsg.id)
          ];
        }
        return prev.filter(m => m.id !== loadingMsg.id).concat(imageMsg);
      });
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        isUser: false,
        type: 'error',
        text: err?.message || 'Failed to generate image. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      setMessages(prev => prev.filter(m => m.id !== loadingMsg.id).concat(errorMsg));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = (messageId: string, prompt: string) => {
    handleSend(undefined, prompt, messageId);
  };

  const handleModify = (imageId: string, imagePrompt: string) => {
    // Pre-fill input with modification prompt hint
    setInput(`Based on the previous image, modify: `);
    // Focus on input
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      inputElement?.focus();
      inputElement?.setSelectionRange(inputElement.value.length, inputElement.value.length);
    }, 100);
  };

  const handleQuickModify = (imageId: string, imagePrompt: string, modification: string) => {
    // Create enhanced prompt with context
    const enhancedPrompt = `Based on this image: "${imagePrompt}", ${modification.toLowerCase()}`;
    handleSend(undefined, enhancedPrompt);
  };

  const handleUseSuggestion = (suggestion: string) => {
    setInput(suggestion);
    // Auto-focus on input
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      inputElement?.focus();
    }, 100);
  };

  const handleNewChat = () => {
    // Clear messages and reset to welcome message
    const welcome: ChatMessage = {
      id: 'welcome',
      isUser: false,
      type: 'text',
      text: '✨ Welcome to Image Generation! Describe the image you want me to create, and I will generate it for you using DALL-E 3.\n\n💡 Tips:\n• Be specific about details, style, and mood\n• Mention colors, composition, and atmosphere\n• Use adjectives to describe the desired aesthetic',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setMessages([welcome]);
    setInput('');
    setPreviewUrl(null);
    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
    } catch {
      // ignore
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
            <ImageIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold">Image Generation</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              title="New Chat"
              disabled={isGenerating}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded transition-colors ${showSettings ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Image Size
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                >
                  {IMAGE_SIZES.map(size => (
                    <option key={size.value} value={size.value}>{size.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quality
                </label>
                <select
                  value={selectedQuality}
                  onChange={(e) => setSelectedQuality(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                >
                  {QUALITY_OPTIONS.map(quality => (
                    <option key={quality.value} value={quality.value}>{quality.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 p-6 overflow-y-auto scroll-smooth">
            <div className="max-w-4xl mx-auto">
              {/* Prompt Suggestions */}
              {messages.length <= 1 && (
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-semibold text-slate-700">Prompt Suggestions</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleUseSuggestion(suggestion)}
                        className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-sm"
                        disabled={isGenerating}
                      >
                        <div className="flex items-start space-x-2">
                          <Wand2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">{suggestion}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className="mb-6 transition-all duration-300 rounded-lg p-2">
                  <div className={`flex items-start space-x-3 ${msg.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.isUser ? 'bg-blue-600' : msg.type === 'error' ? 'bg-red-600' : msg.type === 'loading' ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {msg.isUser ? (
                        <UserIcon className="w-4 h-4 text-white" />
                      ) : msg.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-white" />
                      ) : msg.type === 'loading' ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`rounded-lg p-4 mb-2 ${
                        msg.isUser
                          ? 'bg-blue-600 text-white ml-12'
                          : msg.type === 'error'
                            ? 'bg-red-100 text-red-800 mr-12 border border-red-300'
                            : msg.type === 'loading'
                              ? 'bg-slate-100 text-slate-600 mr-12'
                              : 'bg-slate-200 text-slate-800 mr-12'
                      }`}>
                        {msg.type === 'image' && msg.mediaUrl ? (
                          <div className="space-y-3">
                            <div className="relative group">
                              <img
                                src={msg.mediaUrl}
                                alt={msg.prompt || 'Generated'}
                                className="max-w-full rounded-lg cursor-pointer transition-transform hover:scale-[1.02]"
                                onClick={() => setPreviewUrl(msg.mediaUrl!)}
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                              </div>
                            </div>
                            
                            {/* Image Actions */}
                            <div className="space-y-3 pt-2 border-t border-slate-300">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleFavorite(msg.id)}
                                    className={`p-2 rounded transition-colors ${
                                      favorites.has(msg.id)
                                        ? 'text-red-500 hover:bg-red-50'
                                        : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                    title={favorites.has(msg.id) ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    <Heart className={`w-4 h-4 ${favorites.has(msg.id) ? 'fill-current' : ''}`} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleShare(msg.mediaUrl!); }}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                    title="Share image"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDownload(msg.mediaUrl!, `generated_image_${msg.id}.png`); }}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                    title="Download image"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {msg.prompt && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyPrompt(msg.prompt!, msg.id)}
                                      className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                                      title="Copy prompt"
                                    >
                                      {copiedId === msg.id ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {msg.prompt && (
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerate(msg.id, msg.prompt!)}
                                    disabled={isGenerating}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                    title="Regenerate image"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                                    <span>Regenerate</span>
                                  </button>
                                )}
                              </div>
                              
                              {/* Modify Section */}
                              <div className="space-y-2 pt-2 border-t border-slate-200">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Wand2 className="w-4 h-4 text-blue-500" />
                                  <span className="text-sm font-medium text-slate-700">Modify this image:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Make it brighter')}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    ✨ Brighter
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Change the background')}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    🎨 New Background
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Add more detail')}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    🔍 More Detail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickModify(msg.id, msg.prompt || '', 'Make it more colorful')}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    🌈 More Color
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleModify(msg.id, msg.prompt || '')}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                  >
                                    ✏️ Custom Modify
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Image Metadata */}
                            {(msg.size || msg.quality) && (
                              <div className="text-xs text-slate-500 pt-2 border-t border-slate-300">
                                <span>Size: {msg.size} • Quality: {msg.quality}</span>
                              </div>
                            )}
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
                    placeholder="Describe the image or modification you want..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                    disabled={isGenerating}
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className={`p-3 rounded-lg transition-colors flex items-center ${
                    input.trim() && !isGenerating
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>💡 Describe what you want or how to modify previous images</span>
                <span>{input.length} characters</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-6xl w-full max-h-[90vh]">
            <button
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerationChat;
