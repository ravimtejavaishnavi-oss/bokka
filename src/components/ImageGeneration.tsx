import React, { useState } from 'react';
import { Send, Download, Image as ImageIcon } from 'lucide-react';

const ImageGeneration: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Call our backend API instead of Azure directly
      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The authentication token will be handled by our backend proxy
        },
        body: JSON.stringify({
          prompt: prompt
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate image: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        setGeneratedImage(data.data[0].url);
      } else {
        throw new Error('No image generated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the image');
      console.error('Image generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ImageIcon className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Image Generation</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Input Panel */}
        <div className="w-full md:w-1/2 p-6 bg-white border-r border-slate-200 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Generate Image</h2>
          
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-2">
                Describe the image you want to generate
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A futuristic cityscape at sunset with flying cars..."
                className="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            
            <button
              onClick={generateImage}
              disabled={loading || !prompt.trim()}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                loading || !prompt.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Image
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>
        
        {/* Output Panel */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Generated Image</h2>
          
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 rounded-lg border-2 border-dashed border-slate-300">
            {generatedImage ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center p-4">
                  <img 
                    src={generatedImage} 
                    alt="Generated content" 
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                  <button
                    onClick={downloadImage}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {loading ? 'Generating your image...' : 'Your generated image will appear here'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGeneration;