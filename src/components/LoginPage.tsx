import React, { useState, useEffect } from 'react';
import { Link, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
// Use dynamic imports only to avoid conflicts

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: (user: any) => void;
  onNavigateToSignUp: () => void;
  onNavigateToHome: () => void;
  onNavigateToAdminLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBack, onLoginSuccess, onNavigateToSignUp, onNavigateToHome, onNavigateToAdminLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [socialLoginError, setSocialLoginError] = useState<string | null>(null);

  // Check for error messages in URL params (from OAuth callback redirects)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const errorType = urlParams.get('type');
    
    if (errorParam) {
      // Decode and display the error
      setSocialLoginError(decodeURIComponent(errorParam));
      
      // Clear URL params to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Fallback: read any pending auth error saved by the OAuth callback
    try {
      const pendingError = localStorage.getItem('pendingAuthError');
      if (pendingError) {
        setSocialLoginError(pendingError);
        // Clear after reading
        localStorage.removeItem('pendingAuthError');
        localStorage.removeItem('pendingAuthErrorType');
      }
    } catch {}
  }, []);

  // No need to initialize MSAL - we're using direct OAuth 2.0 flow

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading('local');
    setSocialLoginError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      // Check if response is ok first
      if (!response.ok) {
        // Try to parse JSON error response
        let errorMessage = 'Login failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Parse successful response
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned invalid response. Please try again.');
      }
      
      // Store JWT token
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Prepare user data for the frontend
      const userData = {
        id: data.user.id,
        name: `${data.user.firstName} ${data.user.lastName}`.trim(),
        email: data.user.email,
        avatar: `${data.user.firstName.charAt(0)}${data.user.lastName.charAt(0)}`.toUpperCase(),
        provider: data.user.provider,
        role: data.user.role,
        tenantId: data.user.tenantId
      };
      
      onLoginSuccess(userData);
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        // Provide more specific error messages
        if (error.message.includes('Failed to fetch')) {
          setSocialLoginError('Unable to connect to the server. Please make sure the backend is running.');
        } else if (error.message.includes('Invalid email or password')) {
          setSocialLoginError('Invalid email or password. Please check your credentials and try again.');
        } else {
          setSocialLoginError(error.message);
        }
      } else {
        setSocialLoginError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(null);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'microsoft' | 'yahoo') => {
    setIsLoading(provider);
    setSocialLoginError(null); // Clear any existing error messages
    
    try {
      let user;
      
      console.log(`Starting ${provider} login...`);
      
      if (provider === 'microsoft') {
        // Use direct OAuth flow for Microsoft (works with Web platform)
        const { loginWithMicrosoft } = await import('../utils/directMicrosoftAuth');
        await loginWithMicrosoft();
        // Will redirect to Microsoft, so we won't reach here
        return;
      } else {
        // Import auth functions for other providers
        const { handleGoogleLogin, handleYahooLogin, createOAuthPopup } = await import('../utils/auth');
        
        // Create popup synchronously with user click for other providers
        const popup = createOAuthPopup(`${provider}-login`);
        if (!popup) {
          setIsLoading(null);
          setSocialLoginError('Please allow pop-ups for this site and try again. Check your browser\'s address bar for a pop-up blocker icon.');
          return;
        }
        
        // Handle other providers
        switch (provider) {
          case 'google':
            user = await handleGoogleLogin(popup);
            break;
          case 'yahoo':
            user = await handleYahooLogin(popup);
            break;
        }
      }
      
      console.log(`${provider} login successful, processing user data:`, user);
      
      // Validate user data
      if (!user) {
        throw new Error('No user data received from authentication provider');
      }
      
      if (!user.email && !user.name) {
        throw new Error('Incomplete user information received. Please try again.');
      }
      
      // For Microsoft, send to backend for validation
      if (provider === 'microsoft') {
        const backendUrl = import.meta.env.PROD 
          ? 'https://aiva-backend-prod-app.azurewebsites.net/api'
          : '/api';
        
        const response = await fetch(`${backendUrl}/auth/microsoft/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: user.email,
            name: user.name,
            accessToken: user.accessToken
          }),
        });
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { 
              message: response.statusText || 'Backend authentication failed',
              error: 'Authentication failed'
            };
          }
          
          // Check for access denied errors (403)
          if (response.status === 403) {
            const errorMessage = errorData.message || errorData.error || 'Your account does not have access. Please contact your administrator.';
            setSocialLoginError(errorMessage);
            setIsLoading(null);
            return;
          }
          
          throw new Error(errorData.message || errorData.error || 'Backend authentication failed');
        }
        
        const userData = await response.json();
        
        // Store authentication
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('authToken', userData.token);
        
        // Call success callback with backend data
        onLoginSuccess(userData);
      } else {
        // For other providers, store and proceed
        localStorage.setItem('user', JSON.stringify(user));
        onLoginSuccess(user);
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Set more specific error messages
      if (errorMessage.includes('Popup blocked') || errorMessage.includes('popup')) {
        setSocialLoginError('Please allow pop-ups for this site and try again. Check your browser\'s address bar for a pop-up blocker icon.');
      } else if (errorMessage.includes('cancelled')) {
        setSocialLoginError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login was cancelled.`);
      } else if (errorMessage.includes('consent_required')) {
        setSocialLoginError('Additional permissions required. Please contact your administrator.');
      } else if (errorMessage.includes('interaction_required')) {
        setSocialLoginError('User interaction required. Please try logging in again.');
      } else {
        setSocialLoginError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Geometric Shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-full blur-lg animate-float-medium"></div>
        <div className="absolute bottom-40 left-20 w-40 h-40 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-2xl animate-float-fast"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-xl animate-float-slow"></div>
        
        {/* 3D Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        
        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-radial from-blue-600/30 via-purple-600/20 to-transparent rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-radial from-green-600/30 via-cyan-600/20 to-transparent rounded-full animate-pulse-medium"></div>
        
        {/* Floating Particles */}
        <div className="absolute top-1/3 left-1/2 w-2 h-2 bg-blue-400/60 rounded-full animate-particle-1"></div>
        <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-purple-400/60 rounded-full animate-particle-2"></div>
        <div className="absolute top-1/2 right-1/3 w-3 h-3 bg-cyan-400/60 rounded-full animate-particle-3"></div>
        <div className="absolute bottom-1/3 left-2/3 w-2 h-2 bg-green-400/60 rounded-full animate-particle-4"></div>
        
        {/* 3D Perspective Lines */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-blue-500/30 to-transparent transform -translate-x-1/2 animate-line-glow"></div>
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent transform -translate-y-1/2 animate-line-glow-horizontal"></div>
        </div>
        
        {/* Rotating 3D Elements */}
        <div className="absolute top-1/4 right-1/4 w-16 h-16 border border-blue-500/30 rotate-45 animate-rotate-slow"></div>
        <div className="absolute bottom-1/3 left-1/3 w-12 h-12 border border-purple-500/30 rotate-12 animate-rotate-reverse"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo and Header */}
          <div className="text-center mb-8">
           <div onClick={onNavigateToHome} className="cursor-pointer mb-4">
            <div className="flex items-center justify-center mb-4">
              <img src="/alyasra-logo.png" alt="Alyasra Logo" className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">AIVA</h1>
            </div>
            <p className="text-slate-300">Welcome back! Please sign in to continue.</p>
          </div>

          {/* Login Form */}
          <div className="bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl shadow-2xl p-8 animate-slide-in-right animation-delay-300 hover:shadow-blue-500/20 transition-all duration-500">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Sign In</h2>
              <p className="text-slate-300">Sign in using your organization account</p>
            </div>

            {/* Email/password login removed - OAuth only */}
            <form onSubmit={handleSubmit} className="space-y-6 animate-stagger-children" style={{ display: 'none' }}>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-all duration-300 transform hover:scale-110"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me and Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-800/50 border-slate-600/50 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="ml-2 text-sm text-slate-300">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading === 'local'}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-[30px] text-white font-semibold py-3 px-4 transition-all duration-300 transform hover:scale-105 animate-pulse-glow shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
              >
                {isLoading === 'local' ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Signing In...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Admin Login Button */}
              <button
                type="button"
                onClick={onNavigateToAdminLogin}
                className="w-full bg-slate-600 hover:bg-slate-700 rounded-[30px] text-white font-semibold py-3 px-4 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-slate-500/20"
              >
                Admin Login
              </button>

              {/* Sign Up Link */}
              <div className="text-center">
                <span className="text-slate-300">Don't have an account? </span>
                <button
                  type="button"
                  onClick={onNavigateToSignUp}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
                >
                  Sign up
                </button>
              </div>

            </form>

            {/* Microsoft OAuth Only Message */}
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <svg className="w-6 h-6 text-blue-400 mr-2" viewBox="0 0 24 24">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
                </svg>
                <h3 className="text-sm font-semibold text-blue-200">Sign In with Your Microsoft Account</h3>
              </div>
              <p className="text-sm text-blue-300">
                Use your <strong>@alyasra.com</strong> Microsoft account to sign in. This is the only authentication method available.
              </p>
            </div>

            {/* Social Login Error */}
            {socialLoginError && (
              <div className={`backdrop-blur-sm border-2 rounded-lg p-5 mb-4 animate-slide-in-left shadow-lg ${
                socialLoginError.toLowerCase().includes('approval') || 
                socialLoginError.toLowerCase().includes('pending') || 
                socialLoginError.toLowerCase().includes('access denied') ||
                socialLoginError.toLowerCase().includes('does not have access') ||
                socialLoginError.toLowerCase().includes('awaiting')
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50' 
                  : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-500/50'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      socialLoginError.toLowerCase().includes('approval') || 
                      socialLoginError.toLowerCase().includes('pending') || 
                      socialLoginError.toLowerCase().includes('access denied') ||
                      socialLoginError.toLowerCase().includes('does not have access') ||
                      socialLoginError.toLowerCase().includes('awaiting')
                        ? 'bg-yellow-500/30' 
                        : 'bg-red-500/30'
                    }`}>
                      <span className={`text-2xl ${
                        socialLoginError.toLowerCase().includes('approval') || 
                        socialLoginError.toLowerCase().includes('pending') || 
                        socialLoginError.toLowerCase().includes('access denied') ||
                        socialLoginError.toLowerCase().includes('does not have access') ||
                        socialLoginError.toLowerCase().includes('awaiting')
                          ? 'text-yellow-400' 
                          : 'text-red-400'
                      }`}>
                        {socialLoginError.toLowerCase().includes('approval') || 
                         socialLoginError.toLowerCase().includes('pending') || 
                         socialLoginError.toLowerCase().includes('awaiting')
                          ? '⏳' 
                          : socialLoginError.toLowerCase().includes('access denied') ||
                            socialLoginError.toLowerCase().includes('does not have access')
                          ? '🚫'
                          : '⚠️'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <h4 className={`font-bold text-base mb-2 ${
                      socialLoginError.toLowerCase().includes('approval') || 
                      socialLoginError.toLowerCase().includes('pending') || 
                      socialLoginError.toLowerCase().includes('access denied') ||
                      socialLoginError.toLowerCase().includes('does not have access') ||
                      socialLoginError.toLowerCase().includes('awaiting')
                        ? 'text-yellow-200' 
                        : 'text-red-200'
                    }`}>
                      {socialLoginError.toLowerCase().includes('approval') || socialLoginError.toLowerCase().includes('pending') || socialLoginError.toLowerCase().includes('awaiting')
                        ? '⏳ Account Pending Approval'
                        : socialLoginError.toLowerCase().includes('access denied') ||
                          socialLoginError.toLowerCase().includes('does not have access')
                        ? '🚫 Access Denied'
                        : '⚠️ Login Error'}
                    </h4>
                    <p className={`text-sm whitespace-pre-line leading-relaxed ${
                      socialLoginError.toLowerCase().includes('approval') || 
                      socialLoginError.toLowerCase().includes('pending') || 
                      socialLoginError.toLowerCase().includes('access denied') ||
                      socialLoginError.toLowerCase().includes('does not have access') ||
                      socialLoginError.toLowerCase().includes('awaiting')
                        ? 'text-yellow-100' 
                        : 'text-red-100'
                    }`}>
                      {socialLoginError}
                    </p>
                    {(socialLoginError.toLowerCase().includes('approval') || 
                        socialLoginError.toLowerCase().includes('pending') || 
                        socialLoginError.toLowerCase().includes('awaiting') ||
                        socialLoginError.toLowerCase().includes('access denied') ||
                        socialLoginError.toLowerCase().includes('does not have access')) && (
                      <div className="mt-3 pt-3 border-t border-yellow-400/30">
                        <p className="text-xs text-yellow-200/80 leading-relaxed">
                          💡 <strong>What to do:</strong> Contact your system administrator to request account approval or access. 
                          <br />📧 Email them with your account details: {new URLSearchParams(window.location.search).get('email') || 'your email address'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Microsoft OAuth Login Button (ONLY Option) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('microsoft')}
                disabled={isLoading !== null}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-[30px] text-white font-semibold py-4 px-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center space-x-2 shadow-xl hover:shadow-blue-500/40 animate-pulse-glow"
              >
                {isLoading === 'microsoft' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="white"/>
                    </svg>
                    <span>Continue with Microsoft</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Sign Up Link */}
            <div className="text-center mt-6">
              <span className="text-slate-300">Don't have an account? </span>
              <button
                type="button"
                onClick={onNavigateToSignUp}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200"
              >
                Sign up with Microsoft
              </button>
            </div>
          </div>

          {/* Terms and Privacy */}
          <div className="text-center mt-6">
            <p className="text-sm text-slate-400">
              By signing in, you agree to our{' '}
              <button className="text-blue-400 hover:text-blue-300 transition-colors duration-200">
                Terms of Service
              </button>{' '}
              and{' '}
              <button className="text-blue-400 hover:text-blue-300 transition-colors duration-200">
                Privacy Policy
              </button>
            </p>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-4">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-300 transition-colors duration-200 text-sm"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;