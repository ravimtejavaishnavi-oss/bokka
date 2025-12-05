import React, { useState, useRef } from 'react';
import { Send, Download, Video as VideoIcon, Play, AlertCircle, Clock } from 'lucide-react';

const VideoGeneration: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const processingStartTimeRef = useRef<number | null>(null);

  const generateVideo = async () => {
    if (!prompt.trim()) return;
    
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    setLoading(true);
    setError(null);
    setGeneratedVideo(null);
    retryCountRef.current = 0;
    processingStartTimeRef.current = Date.now();
    setProcessingTime(0);
    
    try {
      // Initial request to generate video through our backend
      const response = await fetch('/api/generate/video', {
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
        // Check if it's a deployment not found error
        if (errorData.error === 'Video generation service not available') {
          throw new Error('Video generation service is not properly configured. Please contact the administrator to set up the Sora deployment in Azure.');
        }
        throw new Error(errorData.error || `Failed to start video generation: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.id) {
        setJobId(data.id);
        pollForVideo(data.id);
      } else {
        throw new Error('Failed to start video generation job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while starting video generation');
      console.error('Video generation error:', err);
      setLoading(false);
    }
  };

  const pollForVideo = async (id: string) => {
    setPolling(true);
    
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Start polling with exponential backoff
    const poll = async () => {
      try {
        const response = await fetch(`/api/generate/video/${id}`, {
          method: 'GET',
          headers: {
            // The authentication token will be handled by our backend proxy
          }
        });
        
        // Handle rate limiting
        if (response.status === 429) {
          retryCountRef.current++;
          if (retryCountRef.current <= maxRetries) {
            // Exponential backoff: 5s, 10s, 20s
            const delay = 5000 * Math.pow(2, retryCountRef.current - 1);
            console.log(`Rate limited. Retrying in ${delay/1000} seconds...`);
            setTimeout(poll, delay);
            return;
          } else {
            throw new Error('Too many requests. Please wait before trying again.');
          }
        }
        
        // Reset retry count on successful request
        retryCountRef.current = 0;
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to check video generation status: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update processing time
        if (processingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - processingStartTimeRef.current) / 1000);
          setProcessingTime(elapsed);
        }
        
        if (data.status === 'succeeded') {
          // Extract video URL from generations array
          let videoUrl = null;
          let contentUrl = null;
          
          if (data.generations && data.generations.length > 0) {
            const firstGeneration = data.generations[0];
            
            // Check if there's a direct video URL
            if (firstGeneration.video) {
              videoUrl = firstGeneration.video;
            }
            
            // Check if there's a content URL we added on the backend
            if (firstGeneration.contentUrl) {
              contentUrl = firstGeneration.contentUrl;
            }
            
            // If no direct video URL but we have a content URL, use that
            if (!videoUrl && contentUrl) {
              videoUrl = contentUrl;
            }
          }
          
          // If no video URL in generations, check if there's a direct video property
          if (!videoUrl && data.video) {
            videoUrl = data.video;
          }
          
          if (videoUrl) {
            setGeneratedVideo(videoUrl);
          } else {
            // If no video URL found, this indicates the video might be stored differently
            // or there's an issue with the Sora API response structure
            setError('Video generation completed successfully, but the video content is not available for download at this time. This is a known limitation with the current Azure Sora API implementation. Please try again later or contact support.');
            console.warn('Video generation succeeded but no video URL found in response:', data);
          }
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPolling(false);
          setLoading(false);
          processingStartTimeRef.current = null;
        } else if (data.status === 'failed') {
          setError(`Video generation failed: ${data.failure_reason || 'Unknown error'}`);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPolling(false);
          setLoading(false);
          processingStartTimeRef.current = null;
        } else if (data.status === 'cancelled') {
          setError('Video generation was cancelled');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPolling(false);
          setLoading(false);
          processingStartTimeRef.current = null;
        }
        // Continue polling if status is 'processing', 'preprocessing', 'running', or other non-final state
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while checking video generation status');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setPolling(false);
        setLoading(false);
        processingStartTimeRef.current = null;
      }
    };
    
    // Start polling with adaptive interval
    // Start with 10s, then increase to 15s after first check, then 20s after 2 minutes
    let intervalTime = 10000;
    pollIntervalRef.current = setInterval(poll, intervalTime);
    
    // After first execution, adjust interval
    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        intervalTime = 15000; // Increase to 15s after first check
        pollIntervalRef.current = setInterval(poll, intervalTime);
        
        // After 2 minutes, increase to 20s
        setTimeout(() => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            intervalTime = 20000; // Increase to 20s after 2 minutes
            pollIntervalRef.current = setInterval(poll, intervalTime);
          }
        }, 120000); // 2 minutes
      }
    }, intervalTime);
  };

  const downloadVideo = () => {
    if (!generatedVideo) return;
    
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `generated-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cancelGeneration = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
    setLoading(false);
    setError('Video generation cancelled by user');
    processingStartTimeRef.current = null;
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <VideoIcon className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Video Generation</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Input Panel */}
        <div className="w-full md:w-1/2 p-6 bg-white border-r border-slate-200 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Generate Video</h2>
          
          <div className="flex-1 flex flex-col">
            <div className="mb-4">
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-2">
                Describe the video you want to generate
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A majestic lion walking through a savanna at sunset..."
                className="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            
            <button
              onClick={generateVideo}
              disabled={loading || polling || !prompt.trim()}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                loading || polling || !prompt.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {(loading || polling) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {polling ? 'Processing...' : 'Generating...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </button>
            
            {(loading || polling) && (
              <div className="mt-4 flex justify-between items-center">
                <button
                  onClick={cancelGeneration}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Cancel Generation
                </button>
                {processingTime > 0 && (
                  <div className="text-sm text-slate-500 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {Math.floor(processingTime / 60)}:{(processingTime % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Error</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            )}
            
            {(loading || polling) && (
              <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded-lg">
                <div className="font-medium">Video Generation in Progress</div>
                <div className="text-sm mt-1">
                  {polling 
                    ? 'Your video is being processed. This may take 1-3 minutes...' 
                    : 'Starting video generation...'}
                </div>
                {retryCountRef.current > 0 && (
                  <div className="text-sm mt-1 text-orange-700 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Rate limited - retrying soon...
                  </div>
                )}
                {processingTime > 60 && (
                  <div className="text-sm mt-2 text-blue-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Video generation is taking longer than usual. This is normal for complex prompts and can take up to 3-5 minutes.
                  </div>
                )}
                {processingTime > 120 && (
                  <div className="text-sm mt-2 text-blue-800">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Please be patient. Some video generations can take several minutes to complete.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Output Panel */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Generated Video</h2>
          
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 rounded-lg border-2 border-dashed border-slate-300">
            {generatedVideo ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center p-4">
                  <video 
                    controls
                    className="max-w-full max-h-full object-contain rounded-lg"
                  >
                    <source src={generatedVideo} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                  <button
                    onClick={downloadVideo}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <VideoIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">
                  {loading || polling 
                    ? 'Processing your video...' 
                    : 'Your generated video will appear here'}
                </p>
                {(loading || polling) && processingTime > 0 && (
                  <p className="text-slate-400 text-sm mt-2">
                    Processing time: {Math.floor(processingTime / 60)}:{(processingTime % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoGeneration;