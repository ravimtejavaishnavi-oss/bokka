import React, { useState, useEffect } from 'react';
import { X, Upload, File, Trash2, Download, FileText, AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { workspaceAPI } from '../../utils/api';
import { workspaceDocumentApi } from '../../utils/workspaceDocumentApi';

interface WorkspaceFile {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface WorkspaceDocument {
  id: string;
  name: string;
  type: 'legal' | 'default';
  workspaceId: string;
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  startingDate?: string;
  endingDate?: string;
  isNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceFileManagerProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

const WorkspaceFileManager: React.FC<WorkspaceFileManagerProps> = ({ 
  workspaceId, 
  workspaceName,
  onClose 
}) => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'documents'>('files');
  const [uploading, setUploading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false); // Start with false, only set to true when actually loading
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [indexing, setIndexing] = useState(false);
  
  // Document management state
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState<'legal' | 'default'>('default');
  const [startingDate, setStartingDate] = useState('');
  const [endingDate, setEndingDate] = useState('');
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentError, setDocumentError] = useState('');

  // Load files when component mounts
  useEffect(() => {
    console.log('Component mounted, loading files for workspace:', workspaceId);
    loadFiles();
  }, [workspaceId]);

  // Load documents when switching to documents tab
  useEffect(() => {
    console.log('Tab effect triggered:', { activeTab, documentsLength: documents.length, documentsLoading });
    if (activeTab === 'documents') {
      // Always try to load documents when switching to documents tab
      // But avoid loading if already loading or if we have documents
      if (!documentsLoading && documents.length === 0) {
        console.log('Loading documents because tab is active and no documents loaded yet');
        loadDocuments();
      } else if (documents.length > 0) {
        console.log('Documents already loaded, skipping load');
      } else if (documentsLoading) {
        console.log('Documents already loading, skipping load');
      }
    } else if (activeTab === 'files') {
      // Load files if not already loaded
      if (!filesLoading && files.length === 0) {
        console.log('Loading files because tab is active and no files loaded yet');
        loadFiles();
      } else if (files.length > 0) {
        console.log('Files already loaded, skipping load');
      } else if (filesLoading) {
        console.log('Files already loading, skipping load');
      }
    }
  }, [activeTab, workspaceId, documents.length, files.length]); // Simplified dependencies

  const loadFiles = async () => {
    try {
      console.log('Loading files for workspace:', workspaceId);
      setFilesLoading(true);
      const data = await workspaceAPI.getWorkspaceFiles(workspaceId);
      console.log('Files loaded:', data);
      setFiles(data?.files || []);
      console.log('Files state updated, length:', data?.files?.length || 0);
    } catch (error: any) {
      console.error('Failed to load workspace files:', error);
      const errorMessage = error.details?.message || error.message || 'Failed to load workspace files. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setFilesLoading(false);
    }
  };

  const loadDocuments = async () => {
    // Don't reload if already loading
    if (documentsLoading) {
      console.log('Documents are already loading, skipping reload');
      return;
    }
    
    try {
      console.log('Loading documents for workspace:', workspaceId);
      setDocumentsLoading(true);
      const response = await workspaceAPI.getWorkspaceDocuments(workspaceId);
      console.log('Documents API response:', response);
      
      // Handle case where response might be undefined or not have documents property
      const docs = response && Array.isArray(response.documents) ? response.documents : [];
      console.log('Documents to set:', docs.length);
      setDocuments(docs);
      console.log('Documents state updated, length:', docs.length);
    } catch (error: any) {
      console.error('Failed to load workspace documents:', error);
      // Show error message to user instead of silently failing
      const errorMessage = error.details?.message || error.message || 'Failed to load workspace documents. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }
    
    try {
      setUploading(true);
      console.log('Uploading file to workspace:', workspaceId, selectedFile.name);
      const result = await workspaceAPI.uploadFileToWorkspace(workspaceId, selectedFile);
      console.log('Upload result:', result);
      setSelectedFile(null);
      await loadFiles(); // Refresh the file list
      alert('File uploaded successfully!');
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      const errorMessage = error.details?.message || error.message || 'Failed to upload file. Please try again.';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      try {
        await workspaceAPI.deleteWorkspaceFile(workspaceId, fileId);
        await loadFiles(); // Refresh the file list
        alert('File deleted successfully!');
      } catch (error: any) {
        console.error('Failed to delete file:', error);
        const errorMessage = error.details?.message || error.message || 'Failed to delete file. Please try again.';
        alert(`Delete failed: ${errorMessage}`);
      }
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await workspaceAPI.deleteWorkspaceDocument(workspaceId, documentId);
        await loadDocuments(); // Refresh the document list
        alert('Document deleted successfully!');
      } catch (error: any) {
        console.error('Failed to delete document:', error);
        const errorMessage = error.details?.message || error.message || 'Failed to delete document. Please try again.';
        alert(`Delete failed: ${errorMessage}`);
      }
    }
  };

  // Function to trigger workspace indexing
  const triggerIndexing = async () => {
    try {
      setIndexing(true);
      console.log('Triggering workspace indexing for:', workspaceId);
      const result = await workspaceAPI.triggerWorkspaceIndexing(workspaceId);
      console.log('Indexing trigger result:', result);
    } catch (error: any) {
      console.error('Failed to trigger workspace indexing:', error);
      const errorMessage = error.details?.message || error.message || 'Failed to trigger workspace indexing. Please try again.';
      console.error(`Indexing trigger failed: ${errorMessage}`);
    } finally {
      setIndexing(false);
    }
  };

  // Function to refresh both files and documents
  const refreshData = async () => {
    if (activeTab === 'files') {
      await loadFiles();
    } else {
      await loadDocuments();
    }
  };

  // Handle close with automatic indexing
  const handleClose = async () => {
    // Trigger indexing before closing
    await triggerIndexing();
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Document management functions
  const handleOpenDocumentUpload = () => {
    setShowDocumentUpload(true);
    // Reset form
    setDocumentName('');
    setDocumentType('default');
    setStartingDate('');
    setEndingDate('');
    setSelectedDocumentFile(null);
    setDocumentError('');
  };

  const handleCloseDocumentUpload = () => {
    setShowDocumentUpload(false);
    // Reset form
    setDocumentName('');
    setDocumentType('default');
    setStartingDate('');
    setEndingDate('');
    setSelectedDocumentFile(null);
    setDocumentError('');
    setDocumentUploading(false);
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedDocumentFile(e.target.files[0]);
      setDocumentError('');
    }
  };

  const handleDocumentTypeChange = (type: 'legal' | 'default') => {
    setDocumentType(type);
    // Clear dates if switching to default type
    if (type === 'default') {
      setStartingDate('');
      setEndingDate('');
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDocumentFile) {
      setDocumentError('Please select a file to upload');
      return;
    }
    
    if (!documentName.trim()) {
      setDocumentError('Please enter a document name');
      return;
    }
    
    // For legal documents, validate dates
    if (documentType === 'legal') {
      if (!startingDate || !endingDate) {
        setDocumentError('Please enter both starting and ending dates for legal documents');
        return;
      }
      
      const startDate = new Date(startingDate);
      const endDate = new Date(endingDate);
      
      if (startDate >= endDate) {
        setDocumentError('Starting date must be before ending date');
        return;
      }
      
      // Check if ending date is within 14 days from now (for notification)
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      if (endDate <= twoWeeksFromNow) {
        if (!confirm('This document will expire within 14 days. Do you want to proceed?')) {
          return;
        }
      }
    }
    
    try {
      setDocumentUploading(true);
      setDocumentError('');
      
      const documentData = {
        name: documentName,
        type: documentType,
        startingDate: documentType === 'legal' ? startingDate : undefined,
        endingDate: documentType === 'legal' ? endingDate : undefined
      };
      
      const result = await workspaceAPI.uploadDocumentToWorkspace(workspaceId, selectedDocumentFile, documentData);
      console.log('Document upload result:', result);
      
      // Close modal and reset form
      handleCloseDocumentUpload();
      
      // Refresh documents list
      await loadDocuments();
      
      // Show success message
      alert('Document uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      const errorMessage = error.details?.message || error.message || 'Failed to upload document. Please try again.';
      setDocumentError(errorMessage);
    } finally {
      setDocumentUploading(false);
    }
  };

  // Function to check if a document is expiring soon (within 14 days)
  const isDocumentExpiringSoon = (doc: WorkspaceDocument) => {
    if (doc.type !== 'legal' || !doc.endingDate) return false;
    
    const endingDate = new Date(doc.endingDate);
    const today = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14);
    
    return endingDate <= twoWeeksFromNow && endingDate >= today;
  };

  // Update the tab change handler to load documents when switching to documents tab
  const handleTabChange = (tab: 'files' | 'documents') => {
    console.log('Tab changing to:', tab);
    setActiveTab(tab);
    
    // If switching to documents tab and documents haven't been loaded yet, load them
    if (tab === 'documents' && documents.length === 0 && !documentsLoading) {
      console.log('Loading documents because tab changed to documents');
      loadDocuments();
    }
    
    // If switching to files tab and files haven't been loaded yet, load them
    if (tab === 'files' && files.length === 0 && !filesLoading) {
      console.log('Loading files because tab changed to files');
      loadFiles();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Files & Documents - {workspaceName}
          </h3>
          <button
            onClick={handleClose}
            disabled={indexing}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            {indexing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
            ) : (
              <X className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => handleTabChange('files')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => handleTabChange('documents')}
            className={`px-4 py-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Documents
          </button>
        </div>

        {activeTab === 'files' ? (
          <>
            {/* File Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      id="file-upload"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading}
                    />
                    <label
                      htmlFor="file-upload"
                      className={`flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium cursor-pointer ${
                        uploading 
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {selectedFile ? selectedFile.name : 'Choose a file'}
                    </label>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                      !selectedFile || uploading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
                <button
                  onClick={refreshData}
                  disabled={filesLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                  title="Refresh files"
                >
                  <RefreshCw className={`w-4 h-4 ${filesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Supported file types: PDF, DOC, DOCX, TXT, JPG, PNG. Max file size: 10MB
              </p>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto">
              {filesLoading ? (
                <div className="text-center py-8 text-gray-500">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="text-center py-8">
                  <File className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No files uploaded</h3>
                  <p className="text-gray-500">Upload your first file to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <File className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{file.originalName}</div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Document Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-between w-full">
                  <p className="text-gray-600">
                    Upload legal or default documents to this workspace
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={refreshData}
                      disabled={documentsLoading}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                      title="Refresh documents"
                    >
                      <RefreshCw className={`w-4 h-4 ${documentsLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={handleOpenDocumentUpload}
                      className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Upload Document
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto">
              {documentsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No documents uploaded</h3>
                  <p className="text-gray-500">Upload your first document to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 ${
                        isDocumentExpiringSoon(doc) ? 'bg-red-50 border-red-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          doc.type === 'legal' ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            doc.type === 'legal' ? 'text-green-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{doc.name}</div>
                          <div className="text-xs text-gray-500">
                            {doc.type === 'legal' ? 'Legal Document' : 'Default Document'} • {formatFileSize(doc.size)}
                          </div>
                          {doc.type === 'legal' && doc.endingDate && (
                            <div className={`text-xs mt-1 flex items-center ${
                              isDocumentExpiringSoon(doc) ? 'text-red-600 font-medium' : 'text-gray-500'
                            }`}>
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Expires: {new Date(doc.endingDate).toLocaleDateString()}
                              {doc.isNotified && ' (Notified)'}
                              {isDocumentExpiringSoon(doc) && !doc.isNotified && ' (Expiring soon)'}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            Uploaded: {formatDate(doc.createdAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
        <div className="flex justify-end mt-6 pt-4 border-t">
          <button
            onClick={handleClose}
            disabled={indexing}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center"
          >
            {indexing && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {indexing ? 'Indexing...' : 'Close'}
          </button>
        </div>
      </div>

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Upload Document</h3>
              <button
                onClick={handleCloseDocumentUpload}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleUploadDocument}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Name
                  </label>
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter document name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={documentType === 'default'}
                        onChange={() => handleDocumentTypeChange('default')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-gray-700">Default</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={documentType === 'legal'}
                        onChange={() => handleDocumentTypeChange('legal')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-gray-700">Legal</span>
                    </label>
                  </div>
                </div>
                
                {documentType === 'legal' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Starting Date
                      </label>
                      <input
                        type="date"
                        value={startingDate}
                        onChange={(e) => setStartingDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ending Date
                      </label>
                      <input
                        type="date"
                        value={endingDate}
                        onChange={(e) => setEndingDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File
                  </label>
                  <input
                    type="file"
                    onChange={handleDocumentFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedDocumentFile && (
                    <p className="mt-1 text-sm text-gray-500">
                      Selected: {selectedDocumentFile.name}
                    </p>
                  )}
                </div>
                
                {documentError && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{documentError}</span>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseDocumentUpload}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={documentUploading}
                    className={`px-4 py-2 rounded-md text-white transition-colors ${
                      documentUploading
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {documentUploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceFileManager;