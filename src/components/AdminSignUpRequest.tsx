import React, { useState } from 'react';
import { ChevronLeft, User, Mail, Key, Lock, Loader2, CheckCircle } from 'lucide-react';
import { submitAdminRequest, verifyLicenseKey } from '../utils/adminApi';

interface AdminSignUpRequestProps {
  onBack: () => void;
  onSignUpRequested: () => void;
}

const AdminSignUpRequest: React.FC<AdminSignUpRequestProps> = ({ onBack, onSignUpRequested }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [step, setStep] = useState<'request' | 'license' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username || !email || !password) {
      setError('Username, email, and password are required');
      setLoading(false);
      return;
    }

    try {
      // Submit admin request via API to backend server
      const generatedLicenseKey = await submitAdminRequest(username, email, password);
      
      // Store current request for license verification in localStorage as backup
      const newRequest = {
        username,
        email,
        licenseKey: generatedLicenseKey,
        state: 'pending',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('currentAdminRequest', JSON.stringify(newRequest));

      setStep('license');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit admin signup request. Please try again.');
      console.error('API error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!licenseKey) {
      setError('License key is required');
      setLoading(false);
      return;
    }

    try {
      // Verify license key via API with backend server
      await verifyLicenseKey(email, licenseKey);

      // Store admin credentials in localStorage for future use
      localStorage.setItem('adminUsername', username);
      localStorage.setItem('adminEmail', email);
      localStorage.setItem('adminLicenseVerified', 'true');
      localStorage.setItem('adminAuthenticated', 'true');

      setStep('success');
      setSuccessMessage('License key verified successfully!');
      
      // Notify parent component that signup is complete
      setTimeout(() => {
        onSignUpRequested();
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid license key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background elements (same as AdminLogin) */}
      <div className="absolute inset-0 overflow-hidden">
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
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center text-slate-300 hover:text-white mb-8 transition-all duration-300 transform hover:scale-110 animate-slide-in-left"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Login
          </button>

          <div className="bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl shadow-2xl p-8 animate-slide-in-right animation-delay-300 hover:shadow-blue-500/20 transition-all duration-500">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                <img src="alyasra-logo.png" alt="logo" />
              </div>
              <h1 className="text-2xl font-bold text-white animate-fade-in-up animation-delay-400">
                {step === 'request' ? 'Admin Signup Request' : 
                 step === 'license' ? 'License Key Verification' : 
                 'Signup Complete'}
              </h1>
              <p className="text-slate-300 mt-2 animate-fade-in-up animation-delay-500">
                {step === 'request' ? 'Request admin access by providing your details' :
                 step === 'license' ? 'Enter your license key to complete registration' :
                 'Your admin account is ready!'}
              </p>
            </div>

            {/* Request Form */}
            {step === 'request' && (
              <form onSubmit={handleRequestSubmit} className="space-y-6 animate-stagger-children">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 animate-slide-in-left">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 rounded-[30px] text-white py-3 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-105 animate-pulse-glow shadow-lg hover:shadow-blue-500/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Request Admin Access'
                  )}
                </button>
              </form>
            )}

            {/* License Key Form */}
            {step === 'license' && (
              <form onSubmit={handleLicenseSubmit} className="space-y-6 animate-stagger-children">
                <div className="text-center mb-6">
                  <p className="text-slate-300">
                    An email has been sent to the account holder. Once they generate a license key for you, enter it below.
                  </p>
                  <p className="text-slate-400 text-sm mt-2">
                    Demo license key: ADMIN-KEY-2025
                  </p>
                </div>

                {/* License Key */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    License Key
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 transition-all text-white placeholder-slate-400 hover:border-slate-500/50"
                      placeholder="Enter your license key"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-lg p-3 animate-slide-in-left">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 rounded-[30px] text-white py-3 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-105 animate-pulse-glow shadow-lg hover:shadow-blue-500/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify License Key'
                  )}
                </button>
              </form>
            )}

            {/* Success Message */}
            {step === 'success' && (
              <div className="text-center animate-fade-in-up">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 text-green-500">
                  <CheckCircle className="w-16 h-16" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Registration Complete!</h2>
                <p className="text-slate-300 mb-6">
                  {successMessage || 'Your admin account has been successfully verified.'}
                </p>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-slate-600/30">
                  <p className="text-sm text-slate-400">
                    You can now log in to the admin dashboard with your credentials.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSignUpRequest;