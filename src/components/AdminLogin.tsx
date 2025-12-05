import React, { useState, useEffect } from 'react';
import { ChevronLeft, Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
// Use dynamic imports only to avoid conflicts

interface AdminLoginProps {
  onBack: () => void;
  onAdminLoginSuccess: (admin: any) => void;
  onNavigateToAdminSignUp?: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onBack, onAdminLoginSuccess, onNavigateToAdminSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [productKey, setProductKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingMicrosoft, setIsLoadingMicrosoft] = useState(false);
  const [socialLoginError, setSocialLoginError] = useState<string | null>(null);

  const handleMicrosoftAdminLogin = async () => {
    setIsLoadingMicrosoft(true);
    setSocialLoginError(null);
    
    try {
      console.log('Starting Microsoft admin login with direct OAuth flow...');
      
      // Store admin flag for callback processing
      localStorage.setItem('is_admin_login', 'true');
      
      // Use direct OAuth flow for Microsoft (works with Web platform)
      const { loginWithMicrosoft } = await import('../utils/directMicrosoftAuth');
      await loginWithMicrosoft();
      // Will redirect to Microsoft, so we won't reach here
    } catch (error) {
      console.error('Microsoft admin login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSocialLoginError(`Microsoft admin login failed: ${errorMessage}`);
      setIsLoadingMicrosoft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }

    // Check if this is a license key verification
    if (localStorage.getItem('adminLicenseVerified') === 'true' && 
        localStorage.getItem('adminEmail') === email) {
      // License already verified, proceed to admin dashboard
      localStorage.setItem('adminAuthenticated', 'true');
      onAdminLoginSuccess({ 
        email, 
        firstName: 'Admin', 
        lastName: 'User' 
      });
      setLoading(false);
      return;
    }

    // Check for valid license key in localStorage (simulated database)
    const validLicenseKey = 'ADMIN-KEY-2025';
    if (productKey === validLicenseKey) {
      // Verify if this user has a pending request
      const adminRequests = JSON.parse(localStorage.getItem('adminRequests') || '[]');
      const userRequest = adminRequests.find((req: any) => req.email === email);
      
      if (userRequest) {
        // Mark as authenticated
        localStorage.setItem('adminAuthenticated', 'true');
        localStorage.setItem('adminEmail', email);
        localStorage.setItem('adminUsername', userRequest.username);
        
        onAdminLoginSuccess({ 
          email, 
          firstName: 'Admin', 
          lastName: 'User' 
        });
        setLoading(false);
        return;
      }
    }

    try {
      // Make API call to backend for admin login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, adminLogin: true }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Invalid email or password');
        setLoading(false);
        return;
      }
      
      // Check if user has admin role
      if (data.user.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }
      
      // Store JWT token
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('adminAuthenticated', 'true');
      
      onAdminLoginSuccess({ 
        email: data.user.email, 
        firstName: data.user.firstName || 'Admin', 
        lastName: data.user.lastName || 'User' 
      });
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize MSAL instance when component mounts
  useEffect(() => {
    const initializeMSAL = async () => {
      try {
        const { msalInstance } = await import('../utils/auth');
        await msalInstance.initialize();
      } catch (error) {
        console.error('MSAL initialization error:', error);
      }
    };
    
    initializeMSAL();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center text-slate-300 hover:text-white mb-8 transition-colors duration-300"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Back
        </button>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto bg-gradient-to-br from-blue-600 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Portal</h1>
            <p className="text-slate-400">Sign in to your admin account</p>
          </div>

          {/* Social Login Error */}
          {socialLoginError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{socialLoginError}</p>
            </div>
          )}

          {/* Microsoft OAuth Only Message */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-blue-400 mr-2" viewBox="0 0 24 24">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
              </svg>
              <h3 className="text-sm font-semibold text-blue-200">Admin Login - Microsoft Only</h3>
            </div>
            <p className="text-sm text-blue-300">
              Use your <strong>@alyasra.com</strong> Microsoft account to access the admin portal. 
              You must have <strong>admin role</strong> to proceed.
            </p>
          </div>

          {/* Microsoft Admin Login Button (Large & Prominent) */}
          <button
            onClick={handleMicrosoftAdminLogin}
            disabled={isLoadingMicrosoft}
            className="w-full flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 rounded-2xl py-4 px-6 mb-6 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-purple-500/40"
          >
            {isLoadingMicrosoft ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="white" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
              </svg>
            )}
            <span className="text-white font-bold text-lg">
              {isLoadingMicrosoft ? 'Signing in...' : 'Continue with Microsoft (Admin)'}
            </span>
          </button>

          {/* Email/password form removed - hidden */}
          <form onSubmit={handleSubmit} className="space-y-6" style={{ display: 'none' }}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Product Key */}
            <div>
              <label htmlFor="productKey" className="block text-sm font-medium text-white mb-2">
                Product Key
              </label>
              <input
                id="productKey"
                type="text"
                value={productKey}
                onChange={(e) => setProductKey(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter your product key"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg py-3 px-4 text-white font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Admin Signup Link */}
          <div className="mt-6 text-center">
            <button
              onClick={onNavigateToAdminSignUp}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Don't have admin access? Request access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;