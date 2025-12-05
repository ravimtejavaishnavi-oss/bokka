import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Key, 
  Server, 
  Save, 
  RefreshCw, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Settings,
  Shield,
  Cloud,
  HardDrive,
  Brain,
  Activity,
  XCircle,
  ExternalLink,
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  Edit3,
  TestTube,
  SaveIcon,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { adminAPI } from '../../utils/api';

// Define TypeScript interfaces
interface ServiceConfig {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  status: 'connected' | 'disconnected' | 'error' | 'configuring';
  endpoint?: string;
  lastChecked?: string;
  dependsOn?: string[];
  errorMessage?: string;
  fallbackUsed?: boolean;
}

interface ConfigField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'password' | 'number' | 'url' | 'email';
  required: boolean;
  description?: string;
  placeholder?: string;
}

const ConfigurationManagement: React.FC = () => {
  // State management
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [configFields, setConfigFields] = useState<Record<string, ConfigField[]>>({});
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [editingServices, setEditingServices] = useState<Record<string, boolean>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);
  const [serviceCounters, setServiceCounters] = useState({
    connected: 0,
    disconnected: 0,
    error: 0
  });
  const [notifications, setNotifications] = useState<any[]>([]);

  // Define all Azure services
  const azureServices: ServiceConfig[] = [
    {
      id: 'database',
      name: 'SQL Database',
      icon: Database,
      description: 'Azure SQL Database connection settings',
      status: 'connected'
    },
    {
      id: 'openai',
      name: 'Azure OpenAI',
      icon: Brain,
      description: 'Azure OpenAI API configuration',
      status: 'connected'
    },
    {
      id: 'storage',
      name: 'Storage Accounts',
      icon: HardDrive,
      description: 'Azure Blob Storage configuration',
      status: 'connected'
    },
    {
      id: 'identity',
      name: 'Active Directory',
      icon: Shield,
      description: 'Azure Active Directory settings',
      status: 'disconnected'
    },
    {
      id: 'fabric',
      name: 'Microsoft Fabric',
      icon: Activity,
      description: 'Microsoft Fabric data platform',
      status: 'disconnected'
    },
    {
      id: 'security',
      name: 'Security',
      icon: Key,
      description: 'Authentication and security settings',
      status: 'connected'
    },
    {
      id: 'aiSearch',
      name: 'Azure AI Search',
      icon: Search,
      description: 'Azure AI Search service configuration',
      status: 'connected'
    },
    {
      id: 'documentIntelligence',
      name: 'Document Intelligence',
      icon: FileText,
      description: 'Azure Document Intelligence service',
      status: 'connected'
    }
  ];

  // Initialize component
  useEffect(() => {
    console.log('ConfigurationManagement: Component mounted, initializing services...');
    initializeServices();
    fetchNotifications();
  }, []);

  // Initialize services and configurations
  const initializeServices = async () => {
    try {
      console.log('ConfigurationManagement: Starting initialization...');
      setLoading(true);
      
      // Fetch current configurations from backend
      console.log('ConfigurationManagement: Fetching configurations from backend...');
      const configResponse = await adminAPI.getConfig();
      console.log('ConfigurationManagement: Raw configuration response:', configResponse);
      
      // Transform backend config to our format
      console.log('ConfigurationManagement: Transforming backend config...');
      const transformedConfigs = transformBackendConfig(configResponse.config);
      console.log('ConfigurationManagement: Transformed configs:', transformedConfigs);
      setConfigFields(transformedConfigs);
      
      // Update services with actual data
      const updatedServices = azureServices.map(service => ({
        ...service,
        status: 'connected' as const // Default to connected since we have data
      }));
      
      setServices(updatedServices);
      updateServiceCounters(updatedServices);
      
      console.log('ConfigurationManagement: Initialization completed successfully');
      setLoading(false);
    } catch (error) {
      console.error('ConfigurationManagement: Failed to initialize services:', error);
      setServices(azureServices);
      loadDefaultConfigurations();
      updateServiceCounters(azureServices);
      setLoading(false);
    }
  };

  // Fetch admin notifications
  const fetchNotifications = async () => {
    try {
      console.log('ConfigurationManagement: Fetching notifications...');
      const response = await adminAPI.getNotifications();
      console.log('ConfigurationManagement: Notifications response:', response);
      if (response.notifications && response.notifications.length > 0) {
        setNotifications(response.notifications);
      }
    } catch (error) {
      console.error('ConfigurationManagement: Failed to fetch notifications:', error);
    }
  };

  // Transform backend configuration to frontend format
  const transformBackendConfig = (backendConfig: any): Record<string, ConfigField[]> => {
    console.log('ConfigurationManagement: Transforming backend config:', backendConfig);
    const configs: Record<string, ConfigField[]> = {};
    
    // Database configuration
    configs.database = [
      { 
        key: 'SQL_SERVER', 
        label: 'Server', 
        value: backendConfig.database?.SQL_SERVER || '', 
        type: 'text', 
        required: true, 
        description: 'SQL Server hostname' 
      },
      { 
        key: 'SQL_DATABASE', 
        label: 'Database', 
        value: backendConfig.database?.SQL_DATABASE || '', 
        type: 'text', 
        required: true, 
        description: 'Database name' 
      },
      { 
        key: 'SQL_USERNAME', 
        label: 'Username', 
        value: backendConfig.database?.SQL_USERNAME || '', 
        type: 'text', 
        required: true, 
        description: 'Database username' 
      },
      { 
        key: 'SQL_PASSWORD', 
        label: 'Password', 
        value: backendConfig.database?.SQL_PASSWORD || '', 
        type: 'password', 
        required: true, 
        description: 'Database password' 
      },
      { 
        key: 'SQL_ENCRYPT', 
        label: 'Encrypt Connection', 
        value: backendConfig.database?.SQL_ENCRYPT || 'true', 
        type: 'text', 
        required: false, 
        description: 'Encrypt database connection (true/false)' 
      },
      { 
        key: 'SQL_TRUST_SERVER_CERTIFICATE', 
        label: 'Trust Server Certificate', 
        value: backendConfig.database?.SQL_TRUST_SERVER_CERTIFICATE || 'false', 
        type: 'text', 
        required: false, 
        description: 'Trust server certificate (true/false)' 
      },
      { 
        key: 'SQL_REQUEST_TIMEOUT', 
        label: 'Request Timeout (ms)', 
        value: backendConfig.database?.SQL_REQUEST_TIMEOUT || '30000', 
        type: 'number', 
        required: false, 
        description: 'Request timeout in milliseconds' 
      },
      { 
        key: 'SQL_CONNECTION_TIMEOUT', 
        label: 'Connection Timeout (ms)', 
        value: backendConfig.database?.SQL_CONNECTION_TIMEOUT || '15000', 
        type: 'number', 
        required: false, 
        description: 'Connection timeout in milliseconds' 
      },
      { 
        key: 'SQL_POOL_MAX', 
        label: 'Max Pool Size', 
        value: backendConfig.database?.SQL_POOL_MAX || '10', 
        type: 'number', 
        required: false, 
        description: 'Maximum connection pool size' 
      },
      { 
        key: 'SQL_POOL_MIN', 
        label: 'Min Pool Size', 
        value: backendConfig.database?.SQL_POOL_MIN || '0', 
        type: 'number', 
        required: false, 
        description: 'Minimum connection pool size' 
      },
      { 
        key: 'SQL_POOL_IDLE_TIMEOUT', 
        label: 'Pool Idle Timeout (ms)', 
        value: backendConfig.database?.SQL_POOL_IDLE_TIMEOUT || '30000', 
        type: 'number', 
        required: false, 
        description: 'Pool idle timeout in milliseconds' 
      },
      { 
        key: 'SQL_POOL_ACQUIRE_TIMEOUT', 
        label: 'Pool Acquire Timeout (ms)', 
        value: backendConfig.database?.SQL_POOL_ACQUIRE_TIMEOUT || '60000', 
        type: 'number', 
        required: false, 
        description: 'Pool acquire timeout in milliseconds' 
      }
    ];
    
    // OpenAI configuration
    configs.openai = [
      { 
        key: 'AZURE_OPENAI_ENDPOINT', 
        label: 'Endpoint', 
        value: backendConfig.openai?.AZURE_OPENAI_ENDPOINT || '', 
        type: 'url', 
        required: true, 
        description: 'Azure OpenAI service endpoint' 
      },
      { 
        key: 'AZURE_OPENAI_API_KEY', 
        label: 'API Key', 
        value: backendConfig.openai?.AZURE_OPENAI_API_KEY || '', 
        type: 'password', 
        required: true, 
        description: 'Azure OpenAI API key' 
      },
      { 
        key: 'AZURE_OPENAI_DEPLOYMENT_NAME', 
        label: 'Deployment Name', 
        value: backendConfig.openai?.AZURE_OPENAI_DEPLOYMENT_NAME || '', 
        type: 'text', 
        required: true, 
        description: 'OpenAI model deployment name' 
      }
    ];
    
    // Storage configuration - THIS IS THE CRITICAL PART FOR YOUR ISSUE
    configs.storage = [
      { 
        key: 'AZURE_STORAGE_ACCOUNT_NAME', 
        label: 'Account Name', 
        value: backendConfig.storage?.AZURE_STORAGE_ACCOUNT_NAME || '', 
        type: 'text', 
        required: true, 
        description: 'Azure Storage account name' 
      },
      { 
        key: 'AZURE_STORAGE_ACCOUNT_KEY', 
        label: 'Account Key', 
        value: backendConfig.storage?.AZURE_STORAGE_ACCOUNT_KEY || '', 
        type: 'password', 
        required: false, 
        description: 'Storage account key' 
      },
      { 
        key: 'AZURE_STORAGE_CONTAINER_NAME', 
        label: 'Container Name', 
        value: backendConfig.storage?.AZURE_STORAGE_CONTAINER_NAME || '', 
        type: 'text', 
        required: false, 
        description: 'Default storage container name' 
      }
    ];
    
    // Identity configuration
    configs.identity = [
      { 
        key: 'AZURE_TENANT_ID', 
        label: 'Tenant ID', 
        value: backendConfig.identity?.AZURE_TENANT_ID || '', 
        type: 'text', 
        required: true, 
        description: 'Azure AD tenant ID' 
      },
      { 
        key: 'AZURE_CLIENT_ID', 
        label: 'Client ID', 
        value: backendConfig.identity?.AZURE_CLIENT_ID || '', 
        type: 'text', 
        required: true, 
        description: 'Azure AD application ID' 
      },
      { 
        key: 'AZURE_CLIENT_SECRET', 
        label: 'Client Secret', 
        value: backendConfig.identity?.AZURE_CLIENT_SECRET || '', 
        type: 'password', 
        required: true, 
        description: 'Azure AD client secret' 
      }
    ];
    
    // Fabric configuration
    configs.fabric = [
      { 
        key: 'FABRIC_WORKSPACE_ID', 
        label: 'Workspace ID', 
        value: backendConfig.fabric?.FABRIC_WORKSPACE_ID || '', 
        type: 'text', 
        required: false, 
        description: 'Microsoft Fabric workspace ID' 
      }
    ];
    
    // Security configuration
    configs.security = [
      { 
        key: 'JWT_SECRET', 
        label: 'JWT Secret', 
        value: backendConfig.security?.JWT_SECRET || '', 
        type: 'password', 
        required: true, 
        description: 'Secret for JWT token signing' 
      },
      { 
        key: 'ADMIN_EMAILS', 
        label: 'Admin Emails', 
        value: backendConfig.security?.ADMIN_EMAILS || '', 
        type: 'text', 
        required: false, 
        description: 'Comma-separated list of admin emails' 
      }
    ];
    
    // AI Search configuration
    configs.aiSearch = [
      { 
        key: 'AZURE_AI_SEARCH_ENDPOINT', 
        label: 'Search Endpoint', 
        value: backendConfig.aiSearch?.AZURE_AI_SEARCH_ENDPOINT || '', 
        type: 'url', 
        required: true, 
        description: 'Azure AI Search service endpoint' 
      },
      { 
        key: 'AZURE_AI_SEARCH_API_KEY', 
        label: 'API Key', 
        value: backendConfig.aiSearch?.AZURE_AI_SEARCH_API_KEY || '', 
        type: 'password', 
        required: true, 
        description: 'Azure AI Search API key' 
      }
    ];
    
    // Document Intelligence configuration
    configs.documentIntelligence = [
      { 
        key: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', 
        label: 'Service Endpoint', 
        value: backendConfig.documentIntelligence?.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || '', 
        type: 'url', 
        required: true, 
        description: 'Azure Document Intelligence service endpoint' 
      },
      { 
        key: 'AZURE_DOCUMENT_INTELLIGENCE_KEY', 
        label: 'API Key', 
        value: backendConfig.documentIntelligence?.AZURE_DOCUMENT_INTELLIGENCE_KEY || '', 
        type: 'password', 
        required: true, 
        description: 'Azure Document Intelligence API key' 
      },
      { 
        key: 'AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID', 
        label: 'Model ID', 
        value: backendConfig.documentIntelligence?.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID || 'aivaid', 
        type: 'text', 
        required: false, 
        description: 'Custom model ID for Document Intelligence (default: aivaid)',
        placeholder: 'aivaid'
      }
    ];
    
    console.log('ConfigurationManagement: Final transformed configs:', configs);
    return configs;
  };

  // Update service counters based on current services
  const updateServiceCounters = (servicesList: ServiceConfig[]) => {
    const counters = {
      connected: servicesList.filter(s => s.status === 'connected').length,
      disconnected: servicesList.filter(s => s.status === 'disconnected').length,
      error: servicesList.filter(s => s.status === 'error').length
    };
    setServiceCounters(counters);
  };

  // Load default configurations
  const loadDefaultConfigurations = () => {
    console.log('ConfigurationManagement: Loading default configurations...');
    const defaultConfigs: Record<string, ConfigField[]> = {
      database: [
        { key: 'SQL_SERVER', label: 'Server', value: 'aiva-sql-server.database.windows.net', type: 'text', required: true, description: 'SQL Server hostname' },
        { key: 'SQL_DATABASE', label: 'Database', value: 'aiva-production', type: 'text', required: true, description: 'Database name' },
        { key: 'SQL_USERNAME', label: 'Username', value: 'aivaadmin', type: 'text', required: true, description: 'Database username' },
        { key: 'SQL_PASSWORD', label: 'Password', value: '••••••••••••', type: 'password', required: true, description: 'Database password' },
        { key: 'SQL_ENCRYPT', label: 'Encrypt Connection', value: 'true', type: 'text', required: false, description: 'Encrypt database connection (true/false)' },
        { key: 'SQL_TRUST_SERVER_CERTIFICATE', label: 'Trust Server Certificate', value: 'false', type: 'text', required: false, description: 'Trust server certificate (true/false)' },
        { key: 'SQL_REQUEST_TIMEOUT', label: 'Request Timeout (ms)', value: '30000', type: 'number', required: false, description: 'Request timeout in milliseconds' },
        { key: 'SQL_CONNECTION_TIMEOUT', label: 'Connection Timeout (ms)', value: '15000', type: 'number', required: false, description: 'Connection timeout in milliseconds' },
        { key: 'SQL_POOL_MAX', label: 'Max Pool Size', value: '10', type: 'number', required: false, description: 'Maximum connection pool size' },
        { key: 'SQL_POOL_MIN', label: 'Min Pool Size', value: '0', type: 'number', required: false, description: 'Minimum connection pool size' },
        { key: 'SQL_POOL_IDLE_TIMEOUT', label: 'Pool Idle Timeout (ms)', value: '30000', type: 'number', required: false, description: 'Pool idle timeout in milliseconds' },
        { key: 'SQL_POOL_ACQUIRE_TIMEOUT', label: 'Pool Acquire Timeout (ms)', value: '60000', type: 'number', required: false, description: 'Pool acquire timeout in milliseconds' }
      ],
      openai: [
        { key: 'AZURE_OPENAI_ENDPOINT', label: 'Endpoint', value: 'https://aiva-openai.openai.azure.com', type: 'url', required: true, description: 'Azure OpenAI service endpoint' },
        { key: 'AZURE_OPENAI_API_KEY', label: 'API Key', value: '••••••••••••••••••••••••••••••••', type: 'password', required: true, description: 'Azure OpenAI API key' },
        { key: 'AZURE_OPENAI_DEPLOYMENT_NAME', label: 'Deployment Name', value: 'gpt-4o', type: 'text', required: true, description: 'OpenAI model deployment name' }
      ],
      storage: [
        { key: 'AZURE_STORAGE_ACCOUNT_NAME', label: 'Account Name', value: 'storageaiva', type: 'text', required: true, description: 'Azure Storage account name' },
        { key: 'AZURE_STORAGE_ACCOUNT_KEY', label: 'Account Key', value: '••••••••••••••••••••••••••••••••', type: 'password', required: false, description: 'Storage account key' },
        { key: 'AZURE_STORAGE_CONTAINER_NAME', label: 'Container Name', value: 'blob', type: 'text', required: false, description: 'Default storage container name' }
      ],
      identity: [
        { key: 'AZURE_TENANT_ID', label: 'Tenant ID', value: '', type: 'text', required: true, description: 'Azure AD tenant ID' },
        { key: 'AZURE_CLIENT_ID', label: 'Client ID', value: '', type: 'text', required: true, description: 'Azure AD application ID' },
        { key: 'AZURE_CLIENT_SECRET', label: 'Client Secret', value: '', type: 'password', required: true, description: 'Azure AD client secret' }
      ],
      fabric: [
        { key: 'FABRIC_WORKSPACE_ID', label: 'Workspace ID', value: '', type: 'text', required: false, description: 'Microsoft Fabric workspace ID' }
      ],
      security: [
        { key: 'JWT_SECRET', label: 'JWT Secret', value: '••••••••••••••••••••••••••••••••', type: 'password', required: true, description: 'Secret for JWT token signing' },
        { key: 'ADMIN_EMAILS', label: 'Admin Emails', value: 'admin@aiva.com', type: 'text', required: false, description: 'Comma-separated list of admin emails' }
      ],
      aiSearch: [
        { key: 'AZURE_AI_SEARCH_ENDPOINT', label: 'Search Endpoint', value: 'https://aivasearch.search.windows.net', type: 'url', required: true, description: 'Azure AI Search service endpoint' },
        { key: 'AZURE_AI_SEARCH_API_KEY', label: 'API Key', value: '••••••••••••••••••••••••••••••••', type: 'password', required: true, description: 'Azure AI Search API key' }
      ],
      documentIntelligence: [
        { key: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', label: 'Service Endpoint', value: 'https://aivadi.cognitiveservices.azure.com/', type: 'url', required: true, description: 'Azure Document Intelligence service endpoint' },
        { key: 'AZURE_DOCUMENT_INTELLIGENCE_KEY', label: 'API Key', value: '••••••••••••••••••••••••••••••••', type: 'password', required: true, description: 'Azure Document Intelligence API key' },
        { key: 'AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID', label: 'Model ID', value: 'aivaid', type: 'text', required: false, description: 'Custom model ID for Document Intelligence (default: aivaid)', placeholder: 'aivaid' }
      ]
    };

    setConfigFields(defaultConfigs);
  };

  // Toggle service expansion
  const toggleService = (serviceId: string) => {
    console.log(`ConfigurationManagement: Toggling service ${serviceId}`);
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  // Start editing a service
  const startEditing = (serviceId: string) => {
    console.log(`ConfigurationManagement: Starting edit for service ${serviceId}`);
    setEditingServices(prev => ({
      ...prev,
      [serviceId]: true
    }));
  };

  // Cancel editing a service
  const cancelEditing = (serviceId: string) => {
    console.log(`ConfigurationManagement: Cancelling edit for service ${serviceId}`);
    setEditingServices(prev => ({
      ...prev,
      [serviceId]: false
    }));
    
    // Remove unsaved changes for this service
    setUnsavedChanges(prev => 
      prev.filter(change => !change.startsWith(`${serviceId}.`))
    );
  };

  // Test service connection
  const testConnection = async (serviceId: string) => {
    console.log(`ConfigurationManagement: Testing connection for service ${serviceId}`);
    setTesting(serviceId);
    
    try {
      let response;
      
      // For database service, use the tenant test endpoint which also checks/creates tables
      if (serviceId === 'database') {
        // Get current database configuration values
        const dbConfig = configFields.database || [];
        const configData: Record<string, string> = {};
        
        // Check if we have masked passwords and need to fetch actual values
        const hasMaskedPasswords = dbConfig.some(field => 
          field.type === 'password' && field.value.includes('••••')
        );
        
        if (hasMaskedPasswords) {
          console.log(`ConfigurationManagement: Fetching actual values for masked passwords...`);
          try {
            const actualValuesResponse = await adminAPI.getConfigWithActualValues();
            console.log('ConfigurationManagement: Actual values response:', actualValuesResponse);
            const serviceActualValues = actualValuesResponse.config.database || {};
            
            // Use actual values for password fields
            dbConfig.forEach(field => {
              if (field.type === 'password' && field.value.includes('••••')) {
                const actualValue = serviceActualValues[field.key] || field.value;
                console.log(`ConfigurationManagement: Using actual value for ${field.key}: ${actualValue.substring(0, 4)}...`);
                configData[field.key] = actualValue;
              } else {
                configData[field.key] = field.value;
              }
            });
          } catch (fetchError) {
            console.error('ConfigurationManagement: Failed to fetch actual values, using current values:', fetchError);
            // Fallback to current values if we can't fetch actual values
            dbConfig.forEach(field => {
              configData[field.key] = field.value;
            });
          }
        } else {
          // No masked passwords, use current values
          dbConfig.forEach(field => {
            configData[field.key] = field.value;
          });
        }
        
        console.log(`ConfigurationManagement: Testing tenant database with config:`, configData);
        response = await adminAPI.testTenantDatabaseConnection(configData);
      } else {
        // For other services, use the regular test endpoint
        response = await adminAPI.testConfigSection(serviceId);
      }
      
      console.log(`ConfigurationManagement: Test response for ${serviceId}:`, response);
      
      // Update service status based on test result
      let updatedServices: ServiceConfig[] = [...services];
      
      // Find the service being tested
      const serviceIndex = updatedServices.findIndex(service => service.id === serviceId);
      if (serviceIndex !== -1) {
        updatedServices[serviceIndex] = {
          ...updatedServices[serviceIndex],
          status: response.success ? ('connected' as const) : ('error' as const),
          lastChecked: new Date().toISOString(),
          errorMessage: response.success ? undefined : response.message
        };
      }
      
      setServices(updatedServices);
      updateServiceCounters(updatedServices);
      
      console.log(`ConfigurationManagement: Connection test completed for ${serviceId}`, response);
    } catch (error) {
      console.error(`ConfigurationManagement: Connection test failed for ${serviceId}:`, error);
      // Update service status to error
      const updatedServices: ServiceConfig[] = services.map(service => 
        service.id === serviceId 
          ? { ...service, status: 'error', lastChecked: new Date().toISOString(), errorMessage: error instanceof Error ? error.message : 'Connection test failed' } 
          : service
      );
      
      setServices(updatedServices);
      updateServiceCounters(updatedServices);
    } finally {
      setTesting(null);
    }
  };

  // Save configuration for a service
  const saveConfiguration = async (serviceId: string) => {
    console.log(`ConfigurationManagement: Saving configuration for service ${serviceId}`);
    setSaving(true);
    
    try {
      // Get the configuration data for this service
      const serviceConfig = configFields[serviceId] || [];
      const configData: Record<string, string> = {};
      
      serviceConfig.forEach(field => {
        // Don't send masked passwords
        if (field.type === 'password' && field.value.includes('••••')) {
          console.log(`ConfigurationManagement: Skipping masked password field: ${field.key}`);
          return;
        }
        configData[field.key] = field.value;
      });
      
      console.log(`ConfigurationManagement: Saving config data for ${serviceId}:`, configData);
      
      // Send configuration to backend
      const response = await adminAPI.updateConfigSection(serviceId, configData);
      console.log(`ConfigurationManagement: Save response for ${serviceId}:`, response);
      
      // Update service status to connected after successful save
      let updatedServices: ServiceConfig[] = services.map(service => 
        service.id === serviceId 
          ? { ...service, status: 'connected' as const, lastChecked: new Date().toISOString() } 
          : service
      );
      
      setServices(updatedServices);
      updateServiceCounters(updatedServices);
      
      // Exit edit mode
      setEditingServices(prev => ({
        ...prev,
        [serviceId]: false
      }));
      
      // Clear unsaved changes
      setUnsavedChanges(prev => 
        prev.filter(change => !change.startsWith(`${serviceId}.`))
      );
      
      // Refresh configurations to show updated values
      await initializeServices();
      
      console.log(`ConfigurationManagement: Configuration saved successfully for ${serviceId}`);
    } catch (error) {
      console.error(`ConfigurationManagement: Failed to save configuration for ${serviceId}:`, error);
      // Update service status to error
      const updatedServices: ServiceConfig[] = services.map(service => 
        service.id === serviceId 
          ? { ...service, status: 'error', lastChecked: new Date().toISOString() } 
          : service
      );
      
      setServices(updatedServices);
      updateServiceCounters(updatedServices);
    } finally {
      setSaving(false);
    }
  };

  // Handle configuration field changes
  const handleFieldChange = (serviceId: string, fieldKey: string, value: string) => {
    console.log(`ConfigurationManagement: Field changed - service: ${serviceId}, field: ${fieldKey}, value: ${value}`);
    setConfigFields(prev => ({
      ...prev,
      [serviceId]: prev[serviceId]?.map(field => 
        field.key === fieldKey ? { ...field, value } : field
      ) || []
    }));

    const changeKey = `${serviceId}.${fieldKey}`;
    if (!unsavedChanges.includes(changeKey)) {
      setUnsavedChanges(prev => [...prev, changeKey]);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = async (fieldKey: string, serviceId: string) => {
    console.log(`ConfigurationManagement: Toggling password visibility for ${fieldKey} in ${serviceId}`);
    // If we're making a password visible, we need to fetch the actual value
    if (!visiblePasswords.includes(fieldKey)) {
      try {
        // Fetch actual values for this service
        console.log('ConfigurationManagement: Fetching actual values for password visibility...');
        const actualValuesResponse = await adminAPI.getConfigWithActualValues();
        console.log('ConfigurationManagement: Actual values response:', actualValuesResponse);
        const serviceActualValues = actualValuesResponse.config[serviceId] || {};
        
        // Update the config fields with actual values
        setConfigFields(prev => {
          const updated = { ...prev };
          if (updated[serviceId]) {
            updated[serviceId] = updated[serviceId].map(field => {
              if (field.key === fieldKey && field.type === 'password') {
                const actualValue = serviceActualValues[fieldKey] || field.value;
                console.log(`ConfigurationManagement: Updating ${fieldKey} with actual value: ${actualValue.substring(0, 10)}...`);
                return { ...field, value: actualValue };
              }
              return field;
            });
          }
          return updated;
        });
      } catch (error) {
        console.error('ConfigurationManagement: Failed to fetch actual values:', error);
      }
    }
    
    // Toggle visibility
    setVisiblePasswords(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'configuring':
        return <Settings className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'configuring':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading configuration...</p>
          <p className="mt-2 text-sm text-muted-foreground">Retrieving configurations from database for sudhenreddym@gmail.com</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <div key={index} className="p-4 rounded-lg border bg-yellow-50 border-yellow-200 flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800">{notification.title}</h4>
                <p className="text-sm text-yellow-700 mt-1">{notification.message}</p>
                {notification.serviceName && (
                  <p className="text-xs text-yellow-600 mt-1">Service: {notification.serviceName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">System Configuration</h2>
          <p className="text-muted-foreground mt-1">Manage and configure your Azure services</p>
        </div>
        <div className="flex items-center space-x-2">
          {unsavedChanges.length > 0 && (
            <div className="flex items-center px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {unsavedChanges.length} unsaved changes
            </div>
          )}
        </div>
      </div>

      {/* Services Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-foreground">
                {serviceCounters.connected}
              </p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-foreground">
                {serviceCounters.disconnected}
              </p>
              <p className="text-sm text-muted-foreground">Disconnected</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-foreground">
                {serviceCounters.error}
              </p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Configuration */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Azure Services</h3>
              <p className="text-sm text-muted-foreground mt-1">Configure and manage your cloud services</p>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={initializeServices}
                className="flex items-center px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
        
        {/* Services List */}
        <div className="divide-y divide-border">
          {services.map((service) => {
            const Icon = service.icon;
            const isExpanded = expandedServices[service.id];
            const isEditing = editingServices[service.id];
            const fields = configFields[service.id] || [];
            const hasUnsaved = unsavedChanges.some(change => change.startsWith(`${service.id}.`));
            
            return (
              <div key={service.id} className="p-6">
                {/* Service Header */}
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => toggleService(service.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-lg group-hover:bg-muted/80 transition-colors">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-medium text-foreground">{service.name}</h4>
                        <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                          {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                        </span>
                        {service.fallbackUsed && (
                          <span className="ml-2 flex items-center text-yellow-600 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Fallback
                          </span>
                        )}
                        {hasUnsaved && (
                          <span className="ml-2 flex items-center text-orange-600 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Unsaved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {service.endpoint && (
                      <div className="hidden md:flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        <span className="font-mono truncate max-w-xs">{service.endpoint}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </div>
                    )}
                    <button className="p-1 text-muted-foreground hover:text-foreground rounded">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Service Details */}
                {isExpanded && (
                  <div className="mt-6 pl-2 md:pl-12 space-y-6">
                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => cancelEditing(service.id)}
                            className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </button>
                          <button
                            onClick={() => saveConfiguration(service.id)}
                            disabled={saving}
                            className="flex items-center px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            <SaveIcon className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(service.id)}
                            className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                          <button
                            onClick={() => testConnection(service.id)}
                            disabled={testing === service.id}
                            className="flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            <TestTube className={`h-4 w-4 mr-2 ${testing === service.id ? 'animate-pulse' : ''}`} />
                            {testing === service.id ? 'Testing...' : 'Test Connection'}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Configuration Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-foreground">
                              {field.label}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </label>
                            {field.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(field.key, service.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {visiblePasswords.includes(field.key) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                          
                          {isEditing ? (
                            <input
                              type={
                                field.type === 'password' && !visiblePasswords.includes(field.key)
                                  ? 'password'
                                  : field.type
                              }
                              value={field.value}
                              onChange={(e) => handleFieldChange(service.id, field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                              required={field.required}
                            />
                          ) : (
                            <div className="w-full px-3 py-2 bg-muted rounded-lg font-mono text-sm break-all">
                              {field.type === 'password' ? (
                                <div className="flex items-center">
                                  {visiblePasswords.includes(field.key) ? (
                                    <Unlock className="h-4 w-4 mr-2 text-muted-foreground" />
                                  ) : (
                                    <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
                                  )}
                                  <span>{visiblePasswords.includes(field.key) ? field.value : '••••••••••••••••••••••••••••••••'}</span>
                                </div>
                              ) : (
                                field.value || <span className="text-muted-foreground">Not configured</span>
                              )}
                            </div>
                          )}
                          
                          {field.description && (
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Service Info */}
                    {service.lastChecked && (
                      <div className="text-xs text-muted-foreground flex items-center">
                        <span>Last checked: {new Date(service.lastChecked).toLocaleString()}</span>
                      </div>
                    )}
                    {service.errorMessage && (
                      <div className="text-xs text-destructive flex items-center mt-1">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        <span>Error: {service.errorMessage}</span>
                      </div>
                    )}
                    {service.dependsOn && service.dependsOn.length > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center mt-2">
                        <span>Depends on: {service.dependsOn.map(dep => 
                          dep === 'active-directory' ? 'Azure AD' : dep
                        ).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConfigurationManagement;