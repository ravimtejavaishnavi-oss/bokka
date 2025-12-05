import React, { useState } from 'react';
import { Link, Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
// Use dynamic imports only to avoid conflicts

interface SignUpPageProps {
  onBack: () => void;
  onSignUpSuccess: (user: any) => void;
  onNavigateToLogin: () => void;
  onNavigateToHome: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onBack, onSignUpSuccess, onNavigateToLogin, onNavigateToHome }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [socialLoginError, setSocialLoginError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading('local');
    setSocialLoginError(null);
    
    if (formData.password !== formData.confirmPassword) {
      setSocialLoginError('Passwords do not match');
      setIsLoading(null);
      return;
    }
    if (!agreeToTerms) {
      setSocialLoginError('Please agree to the Terms of Service and Privacy Policy');
      setIsLoading(null);
      return;
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
        }),
      });
      
      const data = await response.json();
      
      // Handle pending approval (HTTP 202)
      if (response.status === 202) {
        setSocialLoginError(
          `✅ Signup request submitted successfully!\n\n` +
          `Your account is pending admin approval.\n\n` +
          `Admin Contact: ${data.adminContact || 'system administrator'}\n` +
          `Request ID: ${data.requestId}\n\n` +
          `You will be able to log in once approved (usually within 24-48 hours).`
        );
        setIsLoading(null);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }
      
      // Account created successfully (this won't happen with approval flow, but keeping for safety)
      // Store JWT token
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Prepare user data for the frontend
        const userData = {
          id: data.user.id,
          name: `${data.user.firstName} ${data.user.lastName}`,
          email: data.user.email,
          avatar: data.user.firstName.charAt(0).toUpperCase() + data.user.lastName.charAt(0).toUpperCase(),
          provider: data.user.provider,
          role: data.user.role
        };
        
        onSignUpSuccess(userData);
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof Error) {
        setSocialLoginError(error.message);
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
      
      // Import auth functions dynamically
      const { handleGoogleLogin, handleMicrosoftLogin, handleYahooLogin, createOAuthPopup } = await import('../utils/auth');
      
      if (provider === 'microsoft') {
        // Use MSAL for Microsoft authentication
        const msalUser = await handleMicrosoftLogin();
        console.log(`${provider} signup user data received:`, msalUser);
        
        // Send Microsoft user data to backend for validation and database storage
        try {
          const response = await fetch('/api/auth/microsoft/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: 'placeholder',
              email: msalUser.email,
              name: msalUser.name,
              tenantId: msalUser.tenantId,
              provider: 'microsoft'
            }),
          });
          
          const data = await response.json();
          
          // Handle pending approval (HTTP 202)
          if (response.status === 202) {
            setSocialLoginError(
              `✅ Signup Request Submitted Successfully!\n\n` +
              `Your Microsoft account (@alyasra.com) signup request is pending admin approval.\n\n` +
              `📧 Admin Contact: ${data.adminContact || 'system administrator'}\n` +
              `🆔 Request ID: ${data.requestId}\n\n` +
              `⏱️ You will receive approval within 24-48 hours and will be able to log in.`
            );
            setIsLoading(null);
            return;
          }
          
          if (!response.ok) {
            throw new Error(data.message || data.error || 'Microsoft signup failed');
          }
          
          // Store JWT token from backend (if account was already approved/created)
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          user = {
            id: data.user.id,
            name: data.user.firstName + ' ' + data.user.lastName,
            email: data.user.email,
            avatar: (data.user.firstName?.charAt(0) || '') + (data.user.lastName?.charAt(0) || ''),
            provider: 'microsoft',
            role: data.user.role
          };
        } catch (error) {
          console.error('Backend Microsoft signup error:', error);
          throw error;
        }
      } else {
        // Create popup synchronously with user click for other providers
        const popup = createOAuthPopup(`${provider}-signup`);
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
      
      console.log(`${provider} signup successful:`, user);
      
      // Navigate to dashboard on successful OAuth signup
      if (user) {
        const userData = {
          name: user?.name || 'New User',
          email: user?.email || 'user@example.com',
          avatar: user?.name ? user.name.substring(0, 2).toUpperCase() : 'NU',
          provider: user?.provider
        };
        onSignUpSuccess(userData);
      }
    } catch (error) {
      console.error(`${provider} signup failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Popup blocked') || errorMessage.includes('popup')) {
        setSocialLoginError('Please allow pop-ups for this site and try again. Check your browser\'s address bar for a pop-up blocker icon.');
      } else if (errorMessage.includes('cancelled')) {
        setSocialLoginError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} signup was cancelled.`);
      } else {
        setSocialLoginError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} signup failed. Please try again.`);
      }
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4" onClick={onNavigateToHome}>
            <img src="/alyasra-logo.png" alt="Alyasra Logo" className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AIVA</h1>
          <p className="text-slate-300">Create your account to get started.</p>
        </div>

        {/* Sign Up Form */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Account</h2>
            <p className="text-gray-600">Sign up using your organization account</p>
          </div>

          {/* Email/password registration removed - OAuth only */}
          <form onSubmit={handleSubmit} className="space-y-6" style={{ display: 'none' }}>
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-700">
                  I agree to the <a href="#" className="text-blue-600 hover:text-blue-500">Terms of Service</a> and <a href="#" className="text-blue-600 hover:text-blue-500">Privacy Policy</a>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {socialLoginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{socialLoginError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading === 'local'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading === 'local' ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Microsoft OAuth Only Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-blue-600 mr-2" viewBox="0 0 24 24">
                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
              </svg>
              <h3 className="text-sm font-semibold text-blue-900">Sign Up with Your Microsoft Account</h3>
            </div>
            <p className="text-sm text-blue-800">
              Use your <strong>@alyasra.com</strong> Microsoft account to create your AIVA account. This is the only authentication method available.
            </p>
          </div>

          {/* Microsoft OAuth Button (Only Option) */}
          <div className="space-y-3">
            <button
              onClick={() => handleSocialLogin('microsoft')}
              disabled={!!isLoading}
              className="w-full flex items-center justify-center px-4 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg text-base font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
            >
              {isLoading === 'microsoft' ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00A4EF"/>
                </svg>
              )}
              Sign up with Microsoft
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Use your <strong>@alyasra.com</strong> Microsoft account
            </p>
          </div>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onNavigateToLogin}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-slate-300 hover:text-white flex items-center justify-center mx-auto"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;