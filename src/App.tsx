import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import LoginSelection from './components/LoginSelection';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import AdminLogin from './components/AdminLogin';
import AdminSignUpRequest from './components/AdminSignUpRequest';
import AdminDashboard from './components/AdminDashboard';
import OAuthCallback from './components/OAuthCallback';
import CardScanning from './components/CardScanning';
import CardScanningWrapper from './components/CardScanningWrapper';
import MobileCardScanning from './components/MobileCardScanning';
import WorkspacesPage from './components/WorkspacesPage';
import HistoryPage from './components/HistoryPage';
import BookmarksPage from './components/BookmarksPage';
import LikedMessagesPage from './components/LikedMessagesPage';
import DislikedMessagesPage from './components/DislikedMessagesPage';
import FeedbackPage from './components/FeedbackPage';
import AboutAIVA from './components/AboutAIVA';
import AIVAPresentation from './components/AIVAPresentation';
import DataQueryPanel from './components/DataQueryPanel';
import ImageGenerationChat from './components/ImageGenerationChat';
import VideoGenerationChat from './components/VideoGenerationChat';
import MobileCardScanningWrapper from './components/MobileCardScanningWrapper';

// Wrapper component for AdminSignUpRequest to use useNavigate hook
const AdminSignUpRequestWrapper: React.FC = () => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    navigate('/admin/login');
  };
  
  const handleSignUpRequested = () => {
    navigate('/admin/login');
  };
  
  return <AdminSignUpRequest onBack={handleBack} onSignUpRequested={handleSignUpRequested} />;
};

// Wrapper component for HomePage to use useNavigate hook
const HomePageWrapper: React.FC = () => {
  const navigate = useNavigate();
  
  const handleNavigateToLogin = () => {
    console.log('HomePage: Navigating to login...');
    navigate('/login');
  };
  
  const handleNavigateToSignUp = () => {
    console.log('HomePage: Navigating to signup...');
    navigate('/signup');
  };
  
  const handleNavigateToDashboard = () => {
    console.log('HomePage: Navigating to dashboard...');
    navigate('/dashboard');
  };
  
  // Get user from localStorage if available
  const [storedUser, setStoredUser] = useState<any>(null);
  
  useEffect(() => {
    const userFromStorage = localStorage.getItem('user');
    if (userFromStorage) {
      try {
        setStoredUser(JSON.parse(userFromStorage));
      } catch (e) {
        console.error('Error parsing user data:', e);
        setStoredUser(null);
      }
    }
  }, []);
  
  return (
    <HomePage 
      user={storedUser}
      onNavigateToLogin={handleNavigateToLogin}
      onNavigateToSignUp={handleNavigateToSignUp}
      onNavigateToDashboard={handleNavigateToDashboard}
    />
  );
};

function App() {
  // Initialize state from localStorage immediately
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('adminAuthenticated') === 'true';
  });
  const [user, setUser] = useState<any>(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error('Error parsing stored user:', e);
        return null;
      }
    }
    return null;
  });
  const [isMsalHandled, setIsMsalHandled] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  // Debug: Log initial state
  useEffect(() => {
    console.log('🔍 App initialized with state:', {
      isAuthenticated,
      isAdminAuthenticated,
      hasUser: !!user,
      userEmail: user?.user?.email || user?.email
    });
  }, []);

  // Handle OAuth redirect on app load (checks for authorization code)
  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        // Check if there's an authorization code in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code && !isProcessingAuth) {
          setIsProcessingAuth(true);
          
          // Clear URL immediately to prevent reprocessing
          window.history.replaceState({}, '', window.location.pathname);
          
          console.log('=== OAUTH TOKEN EXCHANGE ===');
          console.log('Authorization code detected, processing...');
          console.log('Code:', code.substring(0, 20) + '...');
          console.log('Timestamp:', new Date().toISOString());
          
          // Get admin flag from local storage
          // NOTE: NOT using code_verifier - Web platform uses client_secret instead
          const isAdminLogin = localStorage.getItem('is_admin_login') === 'true';
          
          console.log('Is Admin Login:', isAdminLogin);
          
          // Send to backend for token exchange (call backend directly, not via /api proxy)
          const backendUrl = import.meta.env.PROD 
            ? 'https://aiva-backend-prod-app.azurewebsites.net'
            : 'http://localhost:8080';
          
          console.log('Calling backend token exchange (Web platform - no PKCE)...');
          const response = await fetch(`${backendUrl}/api/auth/microsoft/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              code: code,
              redirectUri: import.meta.env.PROD 
                ? 'https://mango-moss-04cf10e03.2.azurestaticapps.net' 
                : 'http://localhost:5173'
            }),
          });
          
          console.log('Token exchange response status:', response.status);
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token exchange successful!');
            console.log('User:', userData.firstName, userData.lastName);
            console.log('User role:', userData.user?.role || userData.role);
            console.log('Is admin login:', isAdminLogin);
            
            // Clear auth data
            localStorage.removeItem('is_admin_login');
            
            // Normalize user data structure (backend returns user.firstName/lastName, frontend expects name)
            const normalizedUserData = {
              ...userData,
              name: userData.user 
                ? `${userData.user.firstName || ''} ${userData.user.lastName || ''}`.trim()
                : `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
              email: userData.user?.email || userData.email,
              firstName: userData.user?.firstName || userData.firstName,
              lastName: userData.user?.lastName || userData.lastName,
              role: userData.user?.role || userData.role
            };
            
            // Store authentication
            const userRole = normalizedUserData.role;
            // Admin if: (explicitly clicked admin login) OR (user has admin role)
            // This ensures admins always go to admin dashboard when they have admin role
            const isAdmin = isAdminLogin || userRole === 'admin';
            
            if (isAdmin) {
              console.log('Setting admin authentication...');
              setIsAdminAuthenticated(true);
              setIsMsalHandled(true);
              localStorage.setItem('adminAuthenticated', 'true');
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('user', JSON.stringify(normalizedUserData));
              localStorage.setItem('authToken', userData.token);
              console.log('✅ Admin auth set, redirecting to admin dashboard...');
              // Use setTimeout to ensure state is set before redirect
              setTimeout(() => {
                window.location.href = '/admin/dashboard';
              }, 100);
            } else {
              console.log('Setting user authentication...');
              setIsAuthenticated(true);
              setIsMsalHandled(true);
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('user', JSON.stringify(normalizedUserData));
              localStorage.setItem('authToken', userData.token);
              console.log('✅ User auth set, redirecting to dashboard...');
              // Use setTimeout to ensure state is set before redirect
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 100);
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Token exchange failed:', response.status, errorText);
            setIsMsalHandled(true);
            setIsProcessingAuth(false);
          }
        } else {
          // No auth code, proceed normally
          setIsMsalHandled(true);
        }
      } catch (error) {
        console.error('❌ OAuth redirect handling error:', error);
        setIsMsalHandled(true);
        setIsProcessingAuth(false);
      }
    };
    
    handleOAuthRedirect();
  }, [isProcessingAuth]);

  // Check authentication status on app load
  useEffect(() => {
    if (!isMsalHandled) return; // Wait for MSAL to be handled first
    
    const storedAuth = localStorage.getItem('isAuthenticated');
    const storedAdminAuth = localStorage.getItem('adminAuthenticated');
    const storedUser = localStorage.getItem('user');
    
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    
    if (storedAdminAuth === 'true') {
      setIsAdminAuthenticated(true);
    }
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, [isMsalHandled]);

  const handleLogin = (userData: any) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleAdminLogin = (adminData: any) => {
    setIsAdminAuthenticated(true);
    setUser(adminData);
    localStorage.setItem('adminAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(adminData));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsAdminAuthenticated(false);
    setUser(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('user');
    localStorage.removeItem('adminUsername');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminLicenseVerified');
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('currentAdminRequest');
  };

  // Wrapper components for pages that need navigation
  const LoginSelectionWrapper: React.FC = () => {
    const navigate = useNavigate();
    
    const handleSelectUserLogin = () => {
      navigate('/login/user');
    };
    
    const handleSelectAdminLogin = () => {
      navigate('/login/admin');
    };
    
    const handleBack = () => {
      navigate('/');
    };
    
    return (
      <LoginSelection 
        onSelectUserLogin={handleSelectUserLogin}
        onSelectAdminLogin={handleSelectAdminLogin}
        onBack={handleBack}
      />
    );
  };

  const LoginPageWrapper: React.FC = () => {
    const navigate = useNavigate();
    
    const handleBack = () => {
      navigate('/login');
    };
    
    const handleNavigateToSignUp = () => {
      navigate('/signup');
    };
    
    const handleNavigateToHome = () => {
      navigate('/');
    };
    
    const handleNavigateToAdminLogin = () => {
      navigate('/login/admin');
    };
    
    // Modified login success handler that also navigates to dashboard
    const handleLoginSuccess = (userData: any) => {
      handleLogin(userData);
      navigate('/dashboard');
    };
    
    return (
      <LoginPage 
        onBack={handleBack}
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSignUp={handleNavigateToSignUp}
        onNavigateToHome={handleNavigateToHome}
        onNavigateToAdminLogin={handleNavigateToAdminLogin}
      />
    );
  };
  
  const SignUpPageWrapper: React.FC = () => {
    const navigate = useNavigate();
    
    const handleBack = () => {
      navigate('/');
    };
    
    const handleSignUpSuccess = (userData: any) => {
      handleLogin(userData);
      navigate('/dashboard');
    };
    
    const handleNavigateToLogin = () => {
      navigate('/login');
    };
    
    const handleNavigateToHome = () => {
      navigate('/');
    };
    
    return (
      <SignUpPage 
        onBack={handleBack}
        onSignUpSuccess={handleSignUpSuccess}
        onNavigateToLogin={handleNavigateToLogin}
        onNavigateToHome={handleNavigateToHome}
      />
    );
  };
  
  const AdminLoginWrapper: React.FC = () => {
    const navigate = useNavigate();
    
    const handleBack = () => {
      navigate('/');
    };
    
    const handleAdminLoginSuccess = (adminData: any) => {
      handleAdminLogin(adminData);
      navigate('/admin/dashboard');
    };
    
    const handleNavigateToAdminSignUp = () => {
      navigate('/admin/signup-request');
    };
    
    return (
      <AdminLogin 
        onBack={handleBack}
        onAdminLoginSuccess={handleAdminLoginSuccess}
        onNavigateToAdminSignUp={handleNavigateToAdminSignUp}
      />
    );
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePageWrapper />} />
          <Route path="/test-routing" element={<div>Test route placeholder</div>} />
          <Route path="/login" element={<LoginSelectionWrapper />} />
          <Route path="/login/user" element={<LoginPageWrapper />} />
          <Route path="/login/admin" element={<AdminLoginWrapper />} />
          <Route path="/signup" element={<SignUpPageWrapper />} />
          <Route path="/dashboard/*" element={isAuthenticated ? <Dashboard user={user} onLogout={handleLogout} onSwitchAccount={() => {}} onNavigateToHome={() => {}} onNavigateHome={() => {}} onNavigateToDashboard={() => {}} /> : <Navigate to="/login/user" />} />
          <Route path="/image-generation" element={isAuthenticated ? <ImageGenerationChat /> : <Navigate to="/login/user" />} />
          <Route path="/video-generation" element={isAuthenticated ? <VideoGenerationChat /> : <Navigate to="/login/user" />} />
          <Route path="/admin/login" element={<AdminLoginWrapper />} />
          <Route path="/admin/signup-request" element={<AdminSignUpRequestWrapper />} />
          <Route path="/admin/dashboard" element={isAdminAuthenticated ? <AdminDashboard admin={user} onLogout={handleLogout} /> : <Navigate to="/admin/login" />} />
          <Route path="/auth/microsoft/callback" element={<OAuthCallback provider="microsoft" />} />
          <Route path="/card-scanning" element={<CardScanningWrapper />} />
          <Route path="/mobile-card-scan" element={<MobileCardScanningWrapper />} />
          <Route path="/workspaces" element={<WorkspacesPage onBack={() => {}} workspaces={[]} onSelectWorkspace={() => {}} />} />
          <Route path="/history" element={<HistoryPage onBack={() => {}} chatHistory={[]} onLoadChat={() => {}} onNavigateToMessage={() => {}} />} />
          <Route path="/bookmarks" element={<BookmarksPage onBack={() => {}} bookmarkedMessages={[]} onNavigateToMessage={() => {}} />} />
          <Route path="/liked" element={<LikedMessagesPage onBack={() => {}} likedMessages={[]} onNavigateToMessage={() => {}} />} />
          <Route path="/disliked" element={<DislikedMessagesPage onBack={() => {}} dislikedMessages={[]} onNavigateToMessage={() => {}} />} />
          <Route path="/feedback" element={<FeedbackPage user={user} onNavigateToDashboard={() => {}} />} />
          <Route path="/about" element={<AboutAIVA onBack={() => {}} />} />
          <Route path="/presentation" element={<AIVAPresentation isOpen={false} onClose={() => {}} />} />
          <Route path="/data-query" element={<DataQueryPanel />} />
          <Route path="/test-admin-db" element={<div>Test admin DB placeholder</div>} />
          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;