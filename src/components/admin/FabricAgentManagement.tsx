import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Settings, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Play,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ExternalLink,
  Info,
  MessageSquare,
  Activity
} from 'lucide-react';
import { adminAPI } from '../../utils/api';

interface AgentConfig {
  endpoint: string;
  agentId: string;
  projectName: string;
  status: 'connected' | 'disconnected' | 'error';
  lastTested?: string;
  errorMessage?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
}

const FabricAgentManagement: React.FC = () => {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [formData, setFormData] = useState({
    endpoint: '',
    agentId: '',
    projectName: ''
  });

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getFabricAgentConfig();
      setConfig(data);
      setFormData({
        endpoint: data.endpoint || '',
        agentId: data.agentId || '',
        projectName: data.projectName || ''
      });
    } catch (error: any) {
      console.error('Failed to load agent configuration:', error);
      setConfig({
        endpoint: '',
        agentId: '',
        projectName: '',
        status: 'error',
        errorMessage: error.message || 'Failed to load configuration'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setLoading(true);
      await adminAPI.updateFabricAgentConfig(formData);
      await loadConfiguration();
      setShowConfig(false);
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      alert(`Failed to save configuration: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await adminAPI.testFabricAgentConnection();
      setTestResult({
        success: result.success || false,
        message: result.message || 'Connection test completed',
        details: result.details,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Connection test failed',
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  const testThreadCreation = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await adminAPI.testFabricAgentThread();
      setTestResult({
        success: result.success || false,
        message: result.message || 'Thread creation test completed',
        details: result.details,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Thread creation test failed',
        details: error.response?.data || error,
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  const testMessage = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const testMessage = 'Hello, can you help me with data analysis?';
      const result = await adminAPI.testFabricAgentMessage(testMessage);
      setTestResult({
        success: result.success || false,
        message: result.message || 'Message test completed',
        details: result.details,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || 'Message test failed',
        details: error.response?.data || error,
        timestamp: new Date().toISOString()
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const statusColors = {
    connected: 'text-green-500 bg-green-50 border-green-200',
    disconnected: 'text-gray-500 bg-gray-50 border-gray-200',
    error: 'text-red-500 bg-red-50 border-red-200'
  };

  const statusIcons = {
    connected: CheckCircle,
    disconnected: XCircle,
    error: AlertTriangle
  };

  const StatusIcon = config ? statusIcons[config.status] : AlertTriangle;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Fabric Agent Management</h2>
            <p className="text-sm text-gray-500">Configure and test Azure AI Projects Agent</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>{showConfig ? 'Hide' : 'Edit'} Configuration</span>
          </button>
          <button
            onClick={loadConfiguration}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Configuration Form */}
      {showConfig && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Agent Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Endpoint URL
              </label>
              <input
                type="text"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="https://{resource}.services.ai.azure.com/projects/{projectName}"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Full endpoint URL including project name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent ID
              </label>
              <input
                type="text"
                value={formData.agentId}
                onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                placeholder="asst_..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Agent ID from Azure AI Studio
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="my-project"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Project name (extracted from endpoint if not provided)
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setShowConfig(false);
                loadConfiguration();
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveConfiguration}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className={`bg-white border-2 rounded-lg p-6 ${config ? statusColors[config.status] : statusColors.disconnected}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <StatusIcon className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-semibold">Connection Status</h3>
              <p className="text-sm">
                {config?.status === 'connected' 
                  ? 'Agent is configured and ready'
                  : config?.status === 'error'
                  ? config.errorMessage || 'Configuration error'
                  : 'Agent not configured'}
              </p>
            </div>
          </div>
          {config?.lastTested && (
            <span className="text-xs text-gray-500">
              Last tested: {new Date(config.lastTested).toLocaleString()}
            </span>
          )}
        </div>

        {config && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Endpoint:</span>
                <p className="text-gray-600 break-all">{config.endpoint || 'Not set'}</p>
              </div>
              <div>
                <span className="font-medium">Agent ID:</span>
                <p className="text-gray-600 break-all">{config.agentId || 'Not set'}</p>
              </div>
              <div>
                <span className="font-medium">Project:</span>
                <p className="text-gray-600">{config.projectName || 'Not set'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={testConnection}
            disabled={testing || !config}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className="w-6 h-6 text-blue-500" />
            <span className="font-medium">Test Connection</span>
            <span className="text-xs text-gray-500">Verify agent access</span>
          </button>

          <button
            onClick={testThreadCreation}
            disabled={testing || !config}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TestTube className="w-6 h-6 text-blue-500" />
            <span className="font-medium">Test Thread</span>
            <span className="text-xs text-gray-500">Create a test thread</span>
          </button>

          <button
            onClick={testMessage}
            disabled={testing || !config}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageSquare className="w-6 h-6 text-blue-500" />
            <span className="font-medium">Test Message</span>
            <span className="text-xs text-gray-500">Send test message</span>
          </button>
        </div>

        {testing && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Running test...</span>
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResult && (
        <div className={`bg-white border-2 rounded-lg p-6 ${
          testResult.success 
            ? 'border-green-500 bg-green-50' 
            : 'border-red-500 bg-red-50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {testResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  {testResult.success ? 'Test Passed' : 'Test Failed'}
                </h4>
                <p className="text-sm mb-2">{testResult.message}</p>
                {testResult.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      View Details
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(testResult.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">Configuration Guide</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Get your Project Endpoint from Azure AI Studio → Your Project → Settings</li>
              <li>Find your Agent ID in Azure AI Studio → Agents → Your Agent</li>
              <li>Ensure the App Service managed identity has "AI Project User" role</li>
              <li>Test connection first, then test thread creation, then test message</li>
            </ul>
            <a
              href="https://ai.azure.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <span>Open Azure AI Studio</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricAgentManagement;

