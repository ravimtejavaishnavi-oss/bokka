import React from 'react';
import { Users, Shield, ArrowLeft } from 'lucide-react';

interface LoginSelectionProps {
  onSelectUserLogin: () => void;
  onSelectAdminLogin: () => void;
  onBack: () => void;
}

const LoginSelection: React.FC<LoginSelectionProps> = ({ 
  onSelectUserLogin, 
  onSelectAdminLogin, 
  onBack 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-full blur-lg animate-float-medium"></div>
        <div className="absolute bottom-40 left-20 w-40 h-40 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-2xl animate-float-fast"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-xl animate-float-slow"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl">
          {/* Logo and Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6 cursor-pointer" onClick={onBack}>
              <img src="/alyasra-logo.png" alt="Alyasra Logo" className="w-16 h-16" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Welcome to AIVA</h1>
            <p className="text-slate-300 text-lg">Choose your login type to continue</p>
          </div>

          {/* Login Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* User Login Card */}
            <div 
              onClick={onSelectUserLogin}
              className="group bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:bg-slate-700/70 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-105 transform"
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-600/30 transition-all duration-300 group-hover:scale-110">
                  <Users className="w-10 h-10 text-blue-400 group-hover:text-blue-300" />
                </div>
                
                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors duration-300">
                  User Login
                </h2>
                
                {/* Description */}
                <p className="text-slate-300 mb-6 group-hover:text-slate-200 transition-colors duration-300">
                  Access your personal workspace, chat with AI, manage files, and collaborate.
                </p>
                
                {/* Features */}
                <ul className="text-sm text-slate-400 space-y-2 mb-6 text-left w-full">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                    AI Chat (GPT-4o)
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                    File Management
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                    Workspaces
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                    Bookmarks
                  </li>
                </ul>
                
                {/* Button */}
                <div className="w-full bg-blue-600 hover:bg-blue-700 rounded-full text-white font-semibold py-3 px-6 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/50">
                  Continue as User →
                </div>
              </div>
            </div>

            {/* Admin Login Card */}
            <div 
              onClick={onSelectAdminLogin}
              className="group bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:bg-slate-700/70 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-105 transform"
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mb-6 group-hover:bg-purple-600/30 transition-all duration-300 group-hover:scale-110">
                  <Shield className="w-10 h-10 text-purple-400 group-hover:text-purple-300" />
                </div>
                
                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors duration-300">
                  Admin Login
                </h2>
                
                {/* Description */}
                <p className="text-slate-300 mb-6 group-hover:text-slate-200 transition-colors duration-300">
                  Manage users, approve signups, monitor system, and configure settings.
                </p>
                
                {/* Features */}
                <ul className="text-sm text-slate-400 space-y-2 mb-6 text-left w-full">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></span>
                    Approve Signups
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></span>
                    User Management
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></span>
                    System Monitor
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-2"></span>
                    Configuration
                  </li>
                </ul>
                
                {/* Button */}
                <div className="w-full bg-purple-600 hover:bg-purple-700 rounded-full text-white font-semibold py-3 px-6 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-purple-500/50">
                  Continue as Admin →
                </div>
              </div>
            </div>
          </div>

          {/* Info Message */}
          <div className="mt-8 bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-300">
                  <strong className="text-blue-200">Microsoft OAuth Only:</strong> Both user and admin login use your Microsoft account (@alyasra.com). 
                  No passwords needed - just select your role and sign in with Microsoft.
                </p>
              </div>
            </div>
          </div>

          {/* Back Button */}
          <div className="text-center mt-8">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-slate-300 transition-colors duration-200 text-sm flex items-center justify-center mx-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginSelection;

