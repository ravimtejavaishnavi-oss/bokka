import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { ArrowLeft, Camera, Upload, Scan, AlertCircle, X, Save, Printer, Smartphone } from 'lucide-react';
import { userCardAPI, kycAPI } from '../utils/api';
import { useCardDetection } from '../hooks/useCardDetection';
import { useImageCapture } from '../hooks/useImageCapture';
import { opencvLoader } from '../utils/opencvLoader';
import { printHTML } from '../utils/printHelper';
import { useReactToPrint } from 'react-to-print';

// Add OpenCV.js types
declare global {
  interface Window {
    cv: any;
    opencvLoading: boolean;
  }
}

const CardScanning: React.FC<{ onBack: () => void; onSwitchToMobile?: () => void }> = ({ onBack, onSwitchToMobile }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [cardId, setCardId] = useState<string | null>(null); // Store card ID after scanning
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const printContentRef = useRef<HTMLDivElement>(null);
  
  // Enhanced states for front and back card images
  const [frontCardImage, setFrontCardImage] = useState<string | null>(null);
  const [backCardImage, setBackCardImage] = useState<string | null>(null);
  const [frontCardFile, setFrontCardFile] = useState<File | null>(null);
  const [backCardFile, setBackCardFile] = useState<File | null>(null);
  // Store original uncropped images for sending to backend
  const [frontCardFileOriginal, setFrontCardFileOriginal] = useState<File | null>(null);
  const [backCardFileOriginal, setBackCardFileOriginal] = useState<File | null>(null);
  const [currentSide, setCurrentSide] = useState<'front' | 'back' | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  
  // Enhanced states for card detection and scanning
  const [isDetecting, setIsDetecting] = useState(false);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [focusQuality, setFocusQuality] = useState<number>(0);
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStep, setScanStep] = useState<string>('');
  const [imageQuality, setImageQuality] = useState<'poor' | 'fair' | 'good' | 'excellent'>('poor');
  const [extractionConfidence, setExtractionConfidence] = useState<number>(0);
  
  // Mobile number state
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [mobileNumberEntered, setMobileNumberEntered] = useState<boolean>(false);
  
  // KYC form state
  const [kycData, setKycData] = useState({
    customerName: '',
    civilIdNumber: '',
    civilValidity: '',
    phoneNumber: '',
    employmentStatus: '',
    employerType: '',
    jobTitle: '',
    sourceOfIncome: 'Salary',
    politicallyExposed: 'No',
    complianceRisk: 'Low' as 'High' | 'Medium' | 'Low'
  });
  
  // Language selection dialog state
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printHtmlContent, setPrintHtmlContent] = useState<string | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardBoundingBoxRef = useRef<{x: number, y: number, width: number, height: number} | null>(null); // Store card bounding box

  // Initialize reusable hooks (card detection + image capture)
  const { 
    isCardDetected: hookCardDetected,
    cardBoundary: hookCardBoundary,
    focusQuality: hookFocusQuality,
    isDetecting: hookDetecting,
    startDetection,
    stopDetection
  } = useCardDetection({
    videoRef,
    canvasRef,
    webcamRef,
    onCardDetected: (boundary) => {
      // Keep bounding box for cropping on capture
      cardBoundingBoxRef.current = boundary;
    }
  });

  const { captureFrame: hookCaptureFrame, cropToCard: hookCropToCard, detectAndCropCard: hookDetectAndCropCard, imageToFile: hookImageToFile } = useImageCapture();

  // Reflect hook state into local component state used by UI
  useEffect(() => {
    setIsCardDetected(hookCardDetected);
  }, [hookCardDetected]);

  useEffect(() => {
    setFocusQuality(hookFocusQuality);
  }, [hookFocusQuality]);

  // Load OpenCV.js when component mounts
  useEffect(() => {
    const loadOpenCv = async () => {
      try {
        await opencvLoader.loadOpenCV();
        setOpencvLoaded(true);
      } catch (err) {
        setError('Failed to load OpenCV.js: ' + (err instanceof Error ? err.message : 'Unknown error'));
        console.error('OpenCV loading error:', err);
      }
    };

    loadOpenCv();

    return () => {
      // Clean up video stream when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clear any pending timeouts
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, []);

  // Auto-fill KYC fields from extracted Document Intelligence data
  useEffect(() => {
    if (scannedData) {
      setKycData(prev => ({
        ...prev,
        customerName: scannedData.name || prev.customerName,
        civilIdNumber: scannedData.civilIdNo || prev.civilIdNumber,
        civilValidity: scannedData.expiryDate || prev.civilValidity
      }));
    }
  }, [scannedData]);

  // Auto-fill KYC phone number from entered mobile number
  useEffect(() => {
    setKycData(prev => ({ ...prev, phoneNumber: mobileNumber || prev.phoneNumber }));
  }, [mobileNumber]);

  // Print functionality
  const triggerReactPrint = useReactToPrint({
    contentRef: printableRef,
    documentTitle: 'KYC Form',
    onAfterPrint: () => {
      setIsPrinting(false);
      // clear content
      setTimeout(() => setPrintHtmlContent(null), 300);
    }
  });

  const handlePrint = () => {
    setIsPrinting(true);
    // Print the current page body as HTML via react-to-print
    try {
      const bodyHtml = document.body ? document.body.innerHTML : '';
      const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${bodyHtml}</body></html>`;
      setPrintHtmlContent(html);
    } catch (err) {
      setIsPrinting(false);
      alert('Print failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Print only the KYC section with a dedicated layout
  const handleKYCPrint = () => {
    // Show custom language selection dialog
    setShowLanguageDialog(true);
  };
  
  // Handle language selection
  const handleLanguageSelect = (language: 'english' | 'arabic') => {
    setShowLanguageDialog(false);
    if (language === 'english') {
      printEnglishForm();
    } else {
      printArabicForm();
    }
  };
  
  const printEnglishForm = () => {
    setIsPrinting(true);
    const formatValue = (value?: string) => (value && value.trim() ? value : '&nbsp;');
    const employmentStatus = kycData.employmentStatus;
    const employerType = kycData.employerType;
    const sourceOfIncome = kycData.sourceOfIncome;
    const politicallyExposed = kycData.politicallyExposed;
    const complianceRisk = kycData.complianceRisk;
    
    // Create checkbox markup for English form (similar to Arabic form)
    const buildCheckboxItem = (label: string, checked: boolean) => 
      `<div class="checkbox-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled> ${label}</div>`;
    
    // Build checkbox groups with current selections
    const employmentStatusMarkup = [
      buildCheckboxItem('Retired', employmentStatus === 'Retired'),
      buildCheckboxItem('Unemployed', employmentStatus === 'Unemployed'),
      buildCheckboxItem('Employee', employmentStatus === 'Employee'),
      buildCheckboxItem('Student', employmentStatus === 'Student'),
    ].join('');
    
    const employerOptionsMarkup = [
      buildCheckboxItem('Government Sector', employerType === 'Government Sector'),
      buildCheckboxItem('Private', employerType === 'Private'),
      buildCheckboxItem('Government-Owned Company', employerType === 'Government-Owned Company'),
      buildCheckboxItem('Self-Employed', employerType === 'Self-Employed'),
      buildCheckboxItem('Other', employerType === 'Other'),
    ].join('');
    
    const incomeOptionsMarkup = [
      buildCheckboxItem('Salary', sourceOfIncome === 'Salary'),
      buildCheckboxItem('Other', sourceOfIncome === 'Other'),
    ].join('');
    
    const politicallyExposedMarkup = [
      buildCheckboxItem('Yes', politicallyExposed === 'Yes'),
      buildCheckboxItem('No', politicallyExposed === 'No'),
    ].join('');
    
    const complianceRiskMarkup = [
      buildCheckboxItem('Low Risk', complianceRisk === 'Low'),
      buildCheckboxItem('Medium Risk', complianceRisk === 'Medium'),
      buildCheckboxItem('High Risk', complianceRisk === 'High'),
    ].join('');

    const printHtml = `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Form</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print { 
      @page { 
        size: A4; 
        margin: 0.4cm; 
      }
      body { margin: 0; padding: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
      margin: 0;
    }
    .kyc-form {
      width: 100%;
      max-width: 20.2cm;
      background: #ffffff;
      border: 1px solid #ccc;
      padding: 0.4cm 0.6cm;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .header .logo-text {
      font-size: 0.85em;
      font-weight: bold;
      color: #555;
    }
    .header h1 {
      margin: 0;
      font-size: 1.2em;
      color: #333;
    }
    .form-title {
      text-align: center;
      font-size: 1em;
      font-weight: bold;
      margin: 3px 0 6px 0;
    }
    .intro {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
    }
    .intro p {
      font-size: 0.7em;
      color: #d9534f;
      margin: 0;
      line-height: 1.2;
      flex-basis: 85%;
    }
    .cma-logo {
      font-weight: bold;
      color: #006a4e;
      font-size: 0.75em;
      text-align: center;
      flex-basis: 15%;
    }
    .section-title {
      font-size: 0.9em;
      font-weight: bold;
      color: #000;
      border-bottom: 1.5px solid #000;
      padding-bottom: 2px;
      margin: 8px 0 5px 0;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 4px 6px;
      align-items: center;
    }
    .form-grid label {
      font-weight: bold;
      font-size: 0.75em;
    }
    .field-value {
      border: 1px solid #ddd;
      background: #fafafa;
      padding: 3px 6px;
      font-size: 0.75em;
      border-radius: 2px;
      min-height: 14px;
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .checkbox-group.vertical {
      flex-direction: column;
      gap: 3px;
      align-items: flex-start;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7em;
    }
    input[type="checkbox"] {
      width: 11px;
      height: 11px;
      accent-color: #000;
      border: 2px solid #000;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
    }
    .definition {
      font-size: 0.65em;
      color: #444;
      border: 1px solid #eee;
      background: #fcfcfc;
      padding: 5px 8px;
      margin-top: 5px;
      line-height: 1.2;
    }
    .confirmation-text {
      font-size: 0.75em;
      margin-top: 6px;
      line-height: 1.2;
    }
    .signature-area {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    .signature-area label {
      font-weight: bold;
      font-size: 0.75em;
    }
    .signature-box {
      border: 1px solid #000;
      height: 24px;
      flex-grow: 1;
      max-width: 250px;
      border-radius: 2px;
    }
    .verification-text {
      font-size: 0.65em;
      color: #555;
      margin-top: 8px;
      border-top: 1px solid #eee;
      padding-top: 5px;
      line-height: 1.2;
    }
    .compliance-section {
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1.5px solid #000;
    }
    .compliance-section strong {
      font-size: 0.75em;
    }
    .footer-line {
      border: 0;
      height: 4px;
      background-image: repeating-linear-gradient(to right, #000 0, #000 4px, transparent 4px, transparent 8px);
      margin-top: 6px;
    }

  </style>
</head>

<body>
  <div class="kyc-form">
    <div class="header">
      <span class="logo-text">MEJURI</span>
      <h1>KYC</h1>
    </div>
    <h2 class="form-title">Know Your Customer Form - Individuals</h2>
    <div class="intro">
      <p>In implementation of Law No. (106) regarding Anti-Money Laundering and Combating the Financing of Terrorism and according to Ministerial Resolution No. (43) of 2016 regarding the controls regulating the work of institutions and companies operating in the field of gold trade and precious stones and precious metals trading.</p>
      <div class="cma-logo"></div>
    </div>
    <h3 class="section-title">Personal Data</h3>
    <div class="form-grid">
      <label>Client Name:</label>
      <div class="field-value">${formatValue(kycData.customerName)}</div>
      <label>Civil ID Number:</label>
      <div class="field-value">${formatValue(kycData.civilIdNumber)}</div>
      <label>Civil ID Expiry Date:</label>
      <div class="field-value">${formatValue(kycData.civilValidity)}</div>
      <label>Phone Number:</label>
      <div class="field-value">${formatValue(kycData.phoneNumber)}</div>
      <label>Employment Status:</label>
      <div class="checkbox-group">
        ${employmentStatusMarkup}
      </div>
      <label>Employer / Place of Work:</label>
      <div class="checkbox-group vertical">
        ${employerOptionsMarkup}
      </div>
      <label>Job Title:</label>
      <div class="field-value">${formatValue(kycData.jobTitle)}</div>
      <label>Source of Income:</label>
      <div class="checkbox-group">
        ${incomeOptionsMarkup}
      </div>
      <label>Is the client politically exposed?</label>
      <div class="checkbox-group">
        ${politicallyExposedMarkup}
      </div>
    </div>
    <p class="definition">(A politically exposed person is anyone who is or has been entrusted with high public functions in the State of Kuwait or in a foreign country, such as heads of state or government, senior politicians, or government, judicial, or military officials, and senior executives in state-owned companies, and prominent close associates in political parties)</p>
    <h3 class="section-title">I, the undersigned, confirm:</h3>
    <p class="confirmation-text">That the following personal information I have provided to the seller is correct and up-to-date.</p>
    <div class="signature-area">
      <label>Client Signature</label>
      <div class="signature-box"></div>
    </div>
    <p class="verification-text">The client's details have been verified and matched with the special measures according to the rules and laws related to combating money laundering and terrorist financing, and approval from senior management has been obtained regarding politically exposed clients.</p>
    <div class="compliance-section">
      <strong>For Compliance Officer Use:</strong>
      <div class="checkbox-group" style="margin-top: 10px;">
        ${complianceRiskMarkup}
      </div>
    </div>
    <hr class="footer-line">
  </div>

</body>

</html>`;

    // Use react-to-print: render HTML into hidden container then trigger print
    setPrintHtmlContent(printHtml);
  };

  const printArabicForm = () => {
    setIsPrinting(true);
    const formatValue = (value?: string) => (value && value.trim() ? value : '&nbsp;');
    const employmentStatus = kycData.employmentStatus;
    const employerType = kycData.employerType;
    const sourceOfIncome = kycData.sourceOfIncome;
    const politicallyExposed = kycData.politicallyExposed;
    const complianceRisk = kycData.complianceRisk;
    
    // Create checkbox markup for Arabic form
    const buildCheckboxItem = (label: string, checked: boolean) => 
      `<div class="checkbox-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled> ${label}</div>`;
    
    // Build checkbox groups with current selections
    const employmentStatusMarkup = [
      buildCheckboxItem('طالب', employmentStatus === 'Student'),
      buildCheckboxItem('موظف', employmentStatus === 'Employee'),
      buildCheckboxItem('غير موظف', employmentStatus === 'Unemployed'),
      buildCheckboxItem('متقاعد', employmentStatus === 'Retired')
    ].join('');
    
    const employerOptionsMarkup = [
      buildCheckboxItem('قطاع حكومي', employerType === 'Government Sector'),
      buildCheckboxItem('خاص', employerType === 'Private'),
      buildCheckboxItem('شركة مملوكة للحكومة', employerType === 'Government-Owned Company'),
      buildCheckboxItem('أعمال حرة', employerType === 'Self-Employed'),
      buildCheckboxItem('أخرى', employerType === 'Other')
    ].join('');
    
    const incomeOptionsMarkup = [
      buildCheckboxItem('الراتب', sourceOfIncome === 'Salary'),
      buildCheckboxItem('أخرى', sourceOfIncome === 'Other')
    ].join('');
    
    const politicallyExposedMarkup = [
      buildCheckboxItem('نعم', politicallyExposed === 'Yes'),
      buildCheckboxItem('لا', politicallyExposed === 'No')
    ].join('');
    
    const complianceRiskMarkup = [
      buildCheckboxItem('منخفض المخاطر', complianceRisk === 'Low'),
      buildCheckboxItem('متوسط المخاطر', complianceRisk === 'Medium'),
      buildCheckboxItem('عالي المخاطر', complianceRisk === 'High')
    ].join('');

    const printHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>استمارة اعرف عميلك</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media print { 
            @page { 
                size: A4; 
                margin: 0.4cm; 
            }
            body { margin: 0; padding: 0; }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            margin: 0;
        }
        .kyc-form {
            width: 100%;
            max-width: 20.2cm;
            background: #ffffff;
            border: 1px solid #ccc;
            padding: 0.4cm 0.6cm;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            page-break-inside: avoid;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 3px;
            margin-bottom: 3px;
        }
        .header .logo-text {
            font-size: 0.85em;
            font-weight: bold;
            color: #555;
        }
        .header h1 {
            margin: 0;
            font-size: 1.2em;
            color: #333;
        }
        .form-title {
            text-align: center;
            font-size: 1em;
            font-weight: bold;
            margin: 3px 0 6px 0;
        }
        .intro {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 8px;
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
        }
        .intro p {
            font-size: 0.7em;
            color: #d9534f;
            margin: 0;
            line-height: 1.2;
            flex-basis: 85%;
        }
        .cma-logo {
            font-weight: bold;
            color: #006a4e;
            font-size: 0.75em;
            text-align: center;
            flex-basis: 15%;
        }
        .section-title {
            font-size: 0.9em;
            font-weight: bold;
            color: #000;
            border-bottom: 1.5px solid #000;
            padding-bottom: 2px;
            margin: 8px 0 5px 0;
        }
        .form-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 4px 6px;
            align-items: center;
        }
        .form-grid label {
            font-weight: bold;
            font-size: 0.75em;
        }
        .field-value {
            border: 1px solid #ddd;
            background: #fafafa;
            padding: 3px 6px;
            font-size: 0.75em;
            border-radius: 2px;
            min-height: 14px;
        }
        .checkbox-group {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .checkbox-group.vertical {
            flex-direction: column;
            gap: 3px;
            align-items: flex-start;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.7em;
        }
        input[type="checkbox"] {
            width: 11px;
            height: 11px;
            accent-color: #000 !important;
            border: 2px solid #000 !important;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
        }
        .definition {
            font-size: 0.65em;
            color: #444;
            border: 1px solid #eee;
            background: #fcfcfc;
            padding: 5px 8px;
            margin-top: 5px;
            line-height: 1.2;
        }
        .confirmation-text {
            font-size: 0.75em;
            margin-top: 6px;
            line-height: 1.2;
        }
        .signature-area {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            margin-top: 6px;
        }
        .signature-area label {
            font-weight: bold;
            font-size: 0.75em;
        }
        .signature-box {
            border: 1px solid #000;
            height: 24px;
            flex-grow: 1;
            max-width: 250px;
            border-radius: 2px;
        }
        .verification-text {
            font-size: 0.65em;
            color: #555;
            margin-top: 8px;
            border-top: 1px solid #eee;
            padding-top: 5px;
            line-height: 1.2;
        }
        .compliance-section {
            margin-top: 8px;
            padding-top: 5px;
            border-top: 1.5px solid #000;
        }
        .compliance-section strong {
            font-size: 0.75em;
        }
        .footer-line {
            border: 0;
            height: 4px;
            background-image: repeating-linear-gradient(to right, #000 0, #000 4px, transparent 4px, transparent 8px);
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="kyc-form">
        <div class="header">
            <span class="logo-text">MEJURI</span>
            <h1>KYC</h1>
        </div>
        <h2 class="form-title">استمارة اعرف عميلك - الأفراد</h2>

        <div class="intro">
            <p>تطبيقاً للقانون رقم (٠٦) بشأن مكافحة غسل الأموال وتمويل الإرهاب وحسب القرار الوزاري رقم (٤٣) لسنة ٢٠١٦ بشأن الضوابط المنظمة لأعمال المؤسسات والشركات التي تعمل في مجال تجارة الذهب والاتجار الكريمة والمعادن الثمينة.</p>
            <div class="cma-logo"></div>
        </div>

        <h3 class="section-title">البيانات الشخصية</h3>
        <div class="form-grid">
            <label>اسم العميل:</label>
            <div class="field-value">${formatValue(kycData.customerName)}</div>

            <label>الرقم المدني:</label>
            <div class="field-value">${formatValue(kycData.civilIdNumber)}</div>

            <label>صلاحية البطاقة المدنية:</label>
            <div class="field-value">${formatValue(kycData.civilValidity)}</div>

            <label>رقم الهاتف:</label>
            <div class="field-value">${formatValue(kycData.phoneNumber)}</div>

            <label>الحالة الوظيفية:</label>
            <div class="checkbox-group">
                ${employmentStatusMarkup}
            </div>

            <label>جهة العمل:</label>
            <div class="checkbox-group vertical">
                ${employerOptionsMarkup}
            </div>

            <label>المسمى الوظيفي:</label>
            <div class="field-value">${formatValue(kycData.jobTitle)}</div>

            <label>مصدر الدخل:</label>
            <div class="checkbox-group">
                ${incomeOptionsMarkup}
            </div>

            <label>هل العميل معرض سياسياً؟</label>
            <div class="checkbox-group">
                ${politicallyExposedMarkup}
            </div>
        </div>

        <p class="definition">
            (هو أي شخص أوكلت إليه حالياً أو في السابق مهام عامة عليا في دولة الكويت أو في دولة أجنبية، مثل رؤساء الدول أو الحكومات، كبار السياسيين، أو المسؤولين الحكوميين أو القضائيين أو العسكريين، وكبار المسؤولين التنفيذيين في الشركات التي تملكها الدولة، والمقاولين البارزين في الأحزاب السياسية)
        </p>

        <h3 class="section-title">أؤكد أنا الموقع أدناه:</h3>
        <p class="confirmation-text">
            أن المعلومات الشخصية التالية التي قمت بإعطائها للبائع هي معلومات صحيحة وحديثة.
        </p>
        <div class="signature-area">
            <label>توقيع العميل</label>
            <div class="signature-box"></div>
        </div>

        <p class="verification-text">
            تم التأكد من تفاصيل العميل ومطابقتها للتدابير الخاصة حسب اللوائح والقوانين الخاصة بمكافحة غسل الأموال وتمويل الإرهاب وأخذ موافقة الإدارة العليا بخصوص العملاء المعرضين سياسياً.
        </p>

        <div class="compliance-section">
            <strong>لإستعمال مراقب الإلتزام:</strong>
            <div class="checkbox-group" style="margin-top: 10px;">
                ${complianceRiskMarkup}
            </div>
        </div>
        
        <hr class="footer-line">
    </div>

</body>
</html>`;

    // Use react-to-print: render HTML into hidden container then trigger print
    setPrintHtmlContent(printHtml);
  };

  // When printable HTML content is set, trigger react-to-print
  useEffect(() => {
    if (printHtmlContent) {
      const t = setTimeout(() => {
        try {
          triggerReactPrint();
        } catch (err) {
          setIsPrinting(false);
          alert('Print failed: ' + (err instanceof Error ? err.message : String(err)));
        }
      }, 120);
      return () => clearTimeout(t);
    }
    return;
  }, [printHtmlContent, triggerReactPrint]);

  const handleFileUpload = async (file: File, side: 'front' | 'back') => {
    if (!file) return;

    try {
      setError(null);
      
      // Save the image for display and file for scanning
      const imageUrl = URL.createObjectURL(file);
      if (side === 'front') {
        setFrontCardImage(imageUrl);
        setFrontCardFile(file);
      } else {
        setBackCardImage(imageUrl);
        setBackCardFile(file);
      }
      
      // Check if both sides are available to scan
      // Use setTimeout to ensure state is updated before checking
      setTimeout(() => {
        // Get current values directly from state setters
        const hasFront = side === 'front' ? true : !!frontCardFile;
        const hasBack = side === 'back' ? true : !!backCardFile;
        
        if (hasFront && hasBack && mobileNumberEntered) {
          // Both sides are available and mobile number is entered, run the scan
          // Use original uncropped files for backend (file uploads are already uncropped)
          scanBothSides(side === 'front' ? file : frontCardFile!, side === 'back' ? file : backCardFile!);
        } else if (hasFront && hasBack && !mobileNumberEntered) {
          setError('Please enter the customer mobile number before scanning');
        }
      }, 0);
    } catch (err: any) {
      setError('Failed to process card: ' + (err.message || 'Unknown error'));
      console.error(err);
    }
  };

  const scanBothSides = async (frontFile: File, backFile: File) => {
    if (!frontFile || !backFile) return;

    try {
      setIsScanning(true);
      setLoading(true);
      setError(null);
      setScanProgress(0);
      setScanStep('Preparing images...');
      
      // Step 1: Validate image quality
      setScanProgress(10);
      setScanStep('Analyzing image quality...');
      
      const frontQuality = await analyzeImageQuality(frontFile);
      const backQuality = await analyzeImageQuality(backFile);
      
      setImageQuality(frontQuality > 80 && backQuality > 80 ? 'excellent' : 
                     frontQuality > 60 && backQuality > 60 ? 'good' : 
                     frontQuality > 40 && backQuality > 40 ? 'fair' : 'poor');
      
      // Step 2: Preprocess images for better extraction
      setScanProgress(25);
      setScanStep('Preprocessing images...');
      
      const processedFrontFile = await preprocessImage(frontFile);
      const processedBackFile = await preprocessImage(backFile);
      
      // Step 3: Send to Azure Document Intelligence
      setScanProgress(50);
      setScanStep('Extracting data with AI...');
      
      const result = await userCardAPI.scanDualCard(processedFrontFile, processedBackFile, mobileNumber);
      const combinedData = result.cardData;
      
      // Step 4: Validate extracted data
      setScanProgress(75);
      setScanStep('Validating extracted data...');
      
      const validationResult = validateCardData(combinedData);
      setExtractionConfidence(validationResult.confidence);
      
      if (validationResult.confidence < 70) {
        console.warn('Low confidence in extracted data:', validationResult.issues);
      }
      
      // Step 5: Complete
      setScanProgress(100);
      setScanStep('Scan completed successfully!');
      
      // Set the combined scanned data and card ID
      setScannedData(combinedData);
      if (result.id) {
        setCardId(result.id);
      }
      setIsScanning(false);
      setLoading(false);
      
      // Reset progress after a delay
      setTimeout(() => {
        setScanProgress(0);
        setScanStep('');
      }, 2000);
      
    } catch (err: any) {
      setError('Failed to scan card: ' + (err.message || 'Unknown error'));
      setIsScanning(false);
      setLoading(false);
      setScanProgress(0);
      setScanStep('');
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, side);
    }
  };

  const triggerFileSelect = (side: 'front' | 'back') => {
    setCurrentSide(side);
    // Store the side in a ref to access it in the onChange handler
    if (fileInputRef.current) {
      (fileInputRef.current as any).side = side;
      fileInputRef.current.click();
    }
  };

  const startCamera = (side: 'front' | 'back') => {
    setCurrentSide(side);
    setIsCameraActive(true);
    setIsCardDetected(false);
    setAutoCaptureEnabled(false); // Disable auto capture - manual only
    setFocusQuality(0);
    cardBoundingBoxRef.current = null; // Reset bounding box
    // Auto-detection disabled to prevent flickering and hanging
    // Manual capture only - no need to start detection loop
    // startDetection();
  };

  // Enhanced helper functions for better card scanning
  
  const analyzeImageQuality = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (!imageData) {
          resolve(50); // Default quality
          return;
        }
        
        // Calculate sharpness using Laplacian variance
        let sharpness = 0;
        const data = imageData.data;
        
        for (let i = 0; i < data.length - 4; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const nextGray = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
          sharpness += Math.abs(gray - nextGray);
        }
        
        // Normalize sharpness score (0-100)
        const normalizedSharpness = Math.min(100, (sharpness / (data.length / 4)) * 10);
        resolve(normalizedSharpness);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };
  
  const preprocessImage = async (file: File): Promise<File> => {
    // Skip preprocessing - Document Intelligence works better with original images
    // Preprocessing can degrade quality and reduce field extraction accuracy
    console.log('Skipping image preprocessing to preserve quality for Document Intelligence');
    return file;
    
    // OLD CODE - Disabled to preserve image quality
    // return new Promise((resolve) => {
    //   const img = new Image();
    //   const canvas = document.createElement('canvas');
    //   const ctx = canvas.getContext('2d');
    //   
    //   img.onload = () => {
    //     canvas.width = img.width;
    //     canvas.height = img.height;
    //     ctx?.drawImage(img, 0, 0);
    //     
    //     const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    //     if (imageData) {
    //       const data = imageData.data;
    //       for (let i = 0; i < data.length; i += 4) {
    //         data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 128));
    //         data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.2 + 128));
    //         data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.2 + 128));
    //       }
    //       ctx?.putImageData(imageData, 0, 0);
    //     }
    //     
    //     canvas.toBlob((blob) => {
    //       if (blob) {
    //         const processedFile = new File([blob], file.name, { type: file.type });
    //         resolve(processedFile);
    //       } else {
    //         resolve(file);
    //       }
    //     }, file.type, 1.0);
    //   };
    //   
    //   img.src = URL.createObjectURL(file);
    // });
  };
  
  const validateCardData = (data: any): { confidence: number; issues: string[] } => {
    const issues: string[] = [];
    let confidence = 100;
    
    // Check for required fields
    const requiredFields = ['civilIdNo', 'name', 'nationality'];
    requiredFields.forEach(field => {
      if (!data[field] || data[field].trim() === '') {
        issues.push(`Missing or empty ${field}`);
        confidence -= 20;
      }
    });
    
    // Validate Civil ID format (assuming Kuwait format)
    if (data.civilIdNo && !/^\d{12}$/.test(data.civilIdNo.replace(/\s/g, ''))) {
      issues.push('Invalid Civil ID format');
      confidence -= 15;
    }
    
    // Check data completeness
    const totalFields = Object.keys(data).length;
    const filledFields = Object.values(data).filter(value => 
      value && typeof value === 'string' && value.trim() !== ''
    ).length;
    
    const completeness = (filledFields / totalFields) * 100;
    if (completeness < 70) {
      issues.push('Low data completeness');
      confidence -= 10;
    }
    
    return {
      confidence: Math.max(0, confidence),
      issues
    };
  };

  const stopCamera = () => {
    setIsCameraActive(false);
    setCurrentSide(null);
    setIsCardDetected(false);
    setAutoCaptureEnabled(false);
    setFocusQuality(0);
    cardBoundingBoxRef.current = null;
    // Stop OpenCV detection loop via hook
    stopDetection();
  };

  // Toggle between front and back camera
  const toggleCameraFacingMode = () => {
    setCameraFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };

  // Capture image from camera with smart cropping
  const captureImage = async () => {
    console.log('Capture button clicked!', { currentSide, hasWebcamRef: !!webcamRef.current });
    
    if (!webcamRef.current || !currentSide) {
      console.error('Missing webcamRef or currentSide', { webcamRef: !!webcamRef.current, currentSide });
      return;
    }
    
    try {
      const video = webcamRef.current.video;
      if (!video) {
        console.error('No video element found');
        return;
      }
      
      console.log('Starting capture process...');
      
      // Capture frame using hook
      const imageSrc = hookCaptureFrame(video);
      console.log('Frame captured:', { hasImageSrc: !!imageSrc, imageLength: imageSrc?.length });
      
      if (!imageSrc) {
        console.error('Failed to capture frame');
        setError('Failed to capture image');
        return;
      }
      
      // ALWAYS crop to card - never use full frame
      let finalImageSrc = imageSrc;
      
      if (cardBoundingBoxRef.current) {
        // Use detected card boundary
        console.log('Cropping to detected card boundary:', cardBoundingBoxRef.current);
        try {
          finalImageSrc = await hookCropToCard(imageSrc, cardBoundingBoxRef.current);
          console.log('Image cropped successfully to card boundary');
        } catch (cropErr) {
          console.warn('Failed to crop with detected boundary, trying edge detection:', cropErr);
          // Fallback: Try edge detection (now returns full image if detection fails)
          try {
            finalImageSrc = await hookDetectAndCropCard(imageSrc);
            console.log('Image processed using edge detection fallback');
          } catch (edgeErr) {
            // Edge detection now returns full image on failure, so this shouldn't happen
            console.warn('Edge detection had an issue, using full image:', edgeErr);
            finalImageSrc = imageSrc; // Use full image as last resort
          }
        }
      } else {
        // No boundary detected - use edge detection as fallback
        console.log('No card boundary detected, using edge detection fallback');
        try {
          finalImageSrc = await hookDetectAndCropCard(imageSrc);
          console.log('Image processed (cropped or full image used)');
        } catch (edgeErr) {
          // Edge detection now returns full image on failure, so this shouldn't happen
          // But keep as safety net
          console.warn('Edge detection had an issue, using full image:', edgeErr);
          finalImageSrc = imageSrc; // Use full image as last resort
        }
      }
      
      // Convert cropped image to File (for display)
      const filename = `card-${currentSide}-${Date.now()}.jpg`;
      console.log('Converting cropped image to file:', filename);
      const croppedFile = await hookImageToFile(finalImageSrc, filename);
      console.log('Cropped file created:', { name: croppedFile.name, size: croppedFile.size, type: croppedFile.type });
      
      // Convert original uncropped image to File (for sending to backend)
      const originalFilename = `card-${currentSide}-original-${Date.now()}.jpg`;
      console.log('Converting original uncropped image to file:', originalFilename);
      const originalFile = await hookImageToFile(imageSrc, originalFilename);
      console.log('Original file created:', { name: originalFile.name, size: originalFile.size, type: originalFile.type });
      
      // Save both cropped (for display) and original (for backend) images
      if (currentSide === 'front') {
        console.log('Saving front card images (cropped for display, original for backend)');
        setFrontCardImage(finalImageSrc); // Cropped for display
        setFrontCardFile(croppedFile); // Cropped for display
        setFrontCardFileOriginal(originalFile); // Original uncropped for backend
      } else {
        console.log('Saving back card images (cropped for display, original for backend)');
        setBackCardImage(finalImageSrc); // Cropped for display
        setBackCardFile(croppedFile); // Cropped for display
        setBackCardFileOriginal(originalFile); // Original uncropped for backend
      }
      
      console.log('Capture complete! Stopping camera...');
      // Stop camera
      stopCamera();
      
      // Check if both sides are captured for auto-scanning
      setTimeout(() => {
        const hasFront = currentSide === 'front' ? true : !!frontCardFileOriginal;
        const hasBack = currentSide === 'back' ? true : !!backCardFileOriginal;
        
        if (hasFront && hasBack) {
          // Use original uncropped files for backend processing
          const frontFile = currentSide === 'front' ? originalFile : frontCardFileOriginal;
          const backFile = currentSide === 'back' ? originalFile : backCardFileOriginal;
          
          if (frontFile && backFile) {
            scanBothSides(frontFile, backFile);
          }
        }
      }, 0);
    } catch (err) {
      setError('Failed to capture and process image');
      console.error(err);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // No parsing needed - keep the entire string for bloodGroup and block fields
  // The fields will contain the full extracted value as-is

  // Save edited data
  const saveCardData = async () => {
    if (!scannedData) {
      setError('No card data to save');
      return;
    }

    if (!cardId) {
      setError('Card not yet saved. Please scan the card first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Update the card data via API
      await userCardAPI.updateCard(cardId, scannedData);
      
      alert('Card data saved successfully!');
    } catch (err: any) {
      setError('Failed to save card data: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="w-12 h-12 bg-slate-600 hover:bg-slate-500 rounded-full flex items-center justify-center text-white transition-colors mr-4"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-4xl font-bold text-white">Civil ID Card Scanning</h1>
          </div>
          <button
            onClick={() => {
              // Navigate to mobile card scanning
              if (onSwitchToMobile) {
                onSwitchToMobile();
              } else {
                window.location.href = '/mobile-card-scan';
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Smartphone className="mr-2 h-5 w-5" />
            Switch to Mobile View
          </button>
        </div>

        {/* Card Scanning Section */}
        <div className="bg-white rounded-2xl p-8 mb-8 shadow-xl">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Scan Civil ID Card</h2>
              <p className="text-gray-600">Upload or capture images of both sides of your Civil ID card for automatic data extraction</p>
            </div>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Mobile Number Input Section */}
            {!mobileNumberEntered && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Smartphone className="mr-3 h-6 w-6 text-blue-600" />
                  <h3 className="text-xl font-semibold text-gray-800">Enter Customer Mobile Number</h3>
                </div>
                <p className="text-gray-600 mb-4">Please enter the customer's mobile number before scanning the card.</p>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <p className="text-red-600 text-xs mb-1">*number should not start with 0/+965/spaces/symbols</p>
                    <input
                      type="tel"
                      id="mobileNumber"
                      value={mobileNumber}
                      onChange={(e) => {
                        // Remove spaces and limit to 8 digits
                        const value = e.target.value.replace(/\s/g, '').slice(0, 8);
                        // Check if it starts with invalid characters
                        if (value.startsWith('0') || value.startsWith('+965')) {
                          setError('Mobile number should not start with 0 or +965');
                        } else {
                          setError(null);
                        }
                        setMobileNumber(value);
                      }}
                      placeholder="Enter 8-digit mobile number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      autoFocus
                      maxLength={8}
                    />
                  </div>
                  <button
                    onClick={() => {
                      // Validate mobile number format and length
                      if (mobileNumber.trim() && mobileNumber.length === 8 && !mobileNumber.startsWith('0') && !mobileNumber.startsWith('+965')) {
                        setMobileNumberEntered(true);
                      } else {
                        setError('Please enter a valid 8-digit mobile number that does not start with 0 or +965');
                      }
                    }}
                    disabled={!mobileNumber.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
            
            {mobileNumberEntered && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center">
                  <Smartphone className="mr-2 h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">Mobile Number: {mobileNumber}</span>
                </div>
                <button
                  onClick={() => {
                    setMobileNumberEntered(false);
                    setMobileNumber('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Change
                </button>
              </div>
            )}
            
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${!mobileNumberEntered ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Front Side Section */}
              <div className="border border-gray-200 rounded-xl p-6">
                <h3 className="font-medium text-gray-700 mb-4 flex items-center text-lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Front Side of Civil ID Card
                </h3>
                
                <div className="space-y-4">
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                    {isCameraActive && currentSide === 'front' ? (
                      <>
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          videoConstraints={{ facingMode: cameraFacingMode }}
                          className="w-full h-full object-cover"
                        />
                        {/* Canvas for OpenCV processing overlay */}
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                        {/* Video element for OpenCV processing (hidden) */}
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="hidden"
                          onLoadedData={() => {
                            if (videoRef.current) {
                              // Set up video stream for OpenCV
                              streamRef.current = (webcamRef.current?.video as HTMLVideoElement)?.srcObject as MediaStream;
                              if (streamRef.current) {
                                videoRef.current.srcObject = streamRef.current;
                              }
                            }
                          }}
                        />
                      </>
                    ) : frontCardImage ? (
                      <img 
                        src={frontCardImage} 
                        alt="Front side of Civil ID card" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <Camera className="mx-auto h-12 w-12 mb-2" />
                        <p>Front side image will appear here</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    {isCameraActive && currentSide === 'front' ? (
                      <>
                        <button
                          onClick={captureImage}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Scan className="mr-2 h-4 w-4" />
                          Capture Front Side
                        </button>
                        <button
                          onClick={toggleCameraFacingMode}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Switch Camera
                        </button>
                        <button
                          onClick={stopCamera}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startCamera('front')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Start Camera
                        </button>
                        <button
                          onClick={() => triggerFileSelect('front')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Camera status indicators */}
                  {isCameraActive && currentSide === 'front' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isCardDetected 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isCardDetected ? '✓ Card Detected' : 'Looking for Card'}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        focusQuality >= 60 
                          ? 'bg-green-100 text-green-800' 
                          : focusQuality >= 40 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                      }`}>
                        Focus: {focusQuality}/100
                      </div>
                      {!isCardDetected && (
                        <p className="text-xs text-gray-600 italic w-full mt-1">
                          💡 Tip: Hold card 15-30 cm (6-12 inches) from camera
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Back Side Section */}
              <div className="border border-gray-200 rounded-xl p-6">
                <h3 className="font-medium text-gray-700 mb-4 flex items-center text-lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Back Side of Civil ID Card
                </h3>
                
                <div className="space-y-4">
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                    {isCameraActive && currentSide === 'back' ? (
                      <>
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          videoConstraints={{ facingMode: cameraFacingMode }}
                          className="w-full h-full object-cover"
                        />
                        {/* Canvas for OpenCV processing overlay */}
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                        {/* Video element for OpenCV processing (hidden) */}
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="hidden"
                          onLoadedData={() => {
                            if (videoRef.current) {
                              // Set up video stream for OpenCV
                              streamRef.current = (webcamRef.current?.video as HTMLVideoElement)?.srcObject as MediaStream;
                              if (streamRef.current) {
                                videoRef.current.srcObject = streamRef.current;
                              }
                            }
                          }}
                        />
                      </>
                    ) : backCardImage ? (
                      <img 
                        src={backCardImage} 
                        alt="Back side of Civil ID card" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <Camera className="mx-auto h-12 w-12 mb-2" />
                        <p>Back side image will appear here</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    {isCameraActive && currentSide === 'back' ? (
                      <>
                        <button
                          onClick={captureImage}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Scan className="mr-2 h-4 w-4" />
                          Capture Back Side
                        </button>
                        <button
                          onClick={toggleCameraFacingMode}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Switch Camera
                        </button>
                        <button
                          onClick={stopCamera}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startCamera('back')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Start Camera
                        </button>
                        <button
                          onClick={() => triggerFileSelect('back')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center font-medium"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* Camera status indicators */}
                  {isCameraActive && currentSide === 'back' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isCardDetected 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isCardDetected ? '✓ Card Detected' : 'Looking for Card'}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        focusQuality >= 60 
                          ? 'bg-green-100 text-green-800' 
                          : focusQuality >= 40 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                      }`}>
                        Focus: {focusQuality}/100
                      </div>
                      {!isCardDetected && (
                        <p className="text-xs text-gray-600 italic w-full mt-1">
                          💡 Tip: Hold card 15-30 cm (6-12 inches) from camera
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Enhanced Scanning Progress */}
            {isScanning && (
              <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-blue-800 font-medium">{scanStep || 'Scanning card with AIVA Document Intelligence...'}</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${scanProgress}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{scanProgress}% Complete</span>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      imageQuality === 'excellent' ? 'bg-green-100 text-green-800' :
                      imageQuality === 'good' ? 'bg-blue-100 text-blue-800' :
                      imageQuality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      Quality: {imageQuality}
                    </span>
                    {extractionConfidence > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        extractionConfidence >= 80 ? 'bg-green-100 text-green-800' :
                        extractionConfidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Confidence: {extractionConfidence}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* OpenCV Loading Indicator */}
            {isCameraActive && !opencvLoaded && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600 mr-3"></div>
                <span className="text-yellow-700 font-medium">Loading card detection system...</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Scanned Data Form */}
        {scannedData && (
          <div ref={printContentRef} className="bg-white rounded-2xl p-8 mb-8 shadow-xl print-card-content">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <Scan className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Scanned Card Data</h2>
                <p className="text-gray-600">Review and edit the extracted information</p>
              </div>
            </div>
            
            {/* Data Validation Summary */}
            {extractionConfidence > 0 && (
              <div className={`mb-6 p-4 rounded-lg border ${
                extractionConfidence >= 80 ? 'bg-green-50 border-green-200' :
                extractionConfidence >= 60 ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      extractionConfidence >= 80 ? 'bg-green-500' :
                      extractionConfidence >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className={`font-medium ${
                      extractionConfidence >= 80 ? 'text-green-800' :
                      extractionConfidence >= 60 ? 'text-yellow-800' :
                      'text-red-800'
                    }`}>
                      Data Extraction Confidence: {extractionConfidence}%
                    </span>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    extractionConfidence >= 80 ? 'bg-green-100 text-green-800' :
                    extractionConfidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {extractionConfidence >= 80 ? 'High Quality' :
                     extractionConfidence >= 60 ? 'Medium Quality' :
                     'Low Quality'}
                  </span>
                </div>
                {extractionConfidence < 80 && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>⚠️ Some fields may need manual verification. Please review the extracted data carefully.</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Print button */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium flex items-center print:hidden"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Card Data
              </button>
            </div>
            
            {/* Uploaded Images for Printing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:grid-cols-2 print-images-section">
              <div className="print:border print:border-gray-300 print:p-2">
                <h3 className="font-medium text-gray-700 mb-2 text-sm">Front Side of Civil ID Card</h3>
                {frontCardImage && (
                  <img 
                    src={frontCardImage} 
                    alt="Front side of Civil ID card" 
                    className="w-full h-auto object-contain max-h-40 print:max-h-72"
                  />
                )}
              </div>
              
              <div className="print:border print:border-gray-300 print:p-2">
                <h3 className="font-medium text-gray-700 mb-2 text-sm">Back Side of Civil ID Card</h3>
                {backCardImage && (
                  <img 
                    src={backCardImage} 
                    alt="Back side of Civil ID card" 
                    className="w-full h-auto object-contain max-h-40 print:max-h-72"
                  />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print-form-grid">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={scannedData.name || ''}
                  onChange={(e) => setScannedData({...scannedData, name: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Passport Number</label>
                <input
                  type="text"
                  value={scannedData.passportNo || ''}
                  onChange={(e) => setScannedData({...scannedData, passportNo: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nationality</label>
                <input
                  type="text"
                  value={scannedData.nationality || ''}
                  onChange={(e) => setScannedData({...scannedData, nationality: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sex</label>
                <input
                  type="text"
                  value={scannedData.sex || ''}
                  onChange={(e) => setScannedData({...scannedData, sex: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Birth Date</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={scannedData.birthDate || ''}
                  onChange={(e) => setScannedData({...scannedData, birthDate: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={scannedData.expiryDate || ''}
                  onChange={(e) => setScannedData({...scannedData, expiryDate: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Civil ID Number</label>
                <input
                  type="text"
                  value={scannedData.civilIdNo || ''}
                  onChange={(e) => setScannedData({...scannedData, civilIdNo: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Blood Group</label>
                <input
                  type="text"
                  value={scannedData.bloodGroup || ''}
                  onChange={(e) => setScannedData({...scannedData, bloodGroup: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Block</label>
                <input
                  type="text"
                  value={scannedData.block || ''}
                  onChange={(e) => setScannedData({...scannedData, block: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Building No</label>
                <input
                  type="text"
                  value={scannedData.buildingNo || ''}
                  onChange={(e) => setScannedData({...scannedData, buildingNo: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Floor No</label>
                <input
                  type="text"
                  value={scannedData.floorNo || ''}
                  onChange={(e) => setScannedData({...scannedData, floorNo: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Occupation</label>
                <input
                  type="text"
                  value={scannedData.occupation || ''}
                  onChange={(e) => setScannedData({...scannedData, occupation: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={scannedData.companyName || ''}
                  onChange={(e) => setScannedData({...scannedData, companyName: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={scannedData.city || ''}
                  onChange={(e) => setScannedData({...scannedData, city: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Article</label>
                <input
                  type="text"
                  value={scannedData.article || ''}
                  onChange={(e) => setScannedData({...scannedData, article: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Serial No</label>
                <input
                  type="text"
                  value={scannedData.serialNo || ''}
                  onChange={(e) => setScannedData({...scannedData, serialNo: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ID Type</label>
                <input
                  type="text"
                  value={scannedData.idType || ''}
                  onChange={(e) => setScannedData({...scannedData, idType: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Arabic Name</label>
                <input
                  type="text"
                  value={scannedData.arabicName || ''}
                  onChange={(e) => setScannedData({...scannedData, arabicName: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Arabic Nationality</label>
                <input
                  type="text"
                  value={scannedData.arabicNationality || ''}
                  onChange={(e) => setScannedData({...scannedData, arabicNationality: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Arabic Sex</label>
                <input
                  type="text"
                  value={scannedData.arabicSex || ''}
                  onChange={(e) => setScannedData({...scannedData, arabicSex: e.target.value})}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all print:border-gray-400 print:bg-white print:rounded-none print:text-xs print:py-0.5"
                />
              </div>
            </div>
            

          </div>
        )}
        
        {/* KYC Form - visible only after data is extracted */}
        {scannedData && (
          <div className="bg-white rounded-2xl p-8 mb-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <Scan className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">KYC Form</h2>
                <p className="text-gray-600">Auto-filled from Document Intelligence. Edit if needed.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  value={kycData.customerName}
                  onChange={(e) => setKycData({ ...kycData, customerName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Civil ID Number</label>
                <input
                  type="text"
                  value={kycData.civilIdNumber}
                  onChange={(e) => setKycData({ ...kycData, civilIdNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Civil ID Validity</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={kycData.civilValidity}
                  onChange={(e) => setKycData({ ...kycData, civilValidity: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={kycData.phoneNumber}
                  onChange={(e) => setKycData({ ...kycData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
              <div className="flex flex-wrap gap-4">
                {['Retired', 'Unemployed', 'Employee', 'Student'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="employmentStatus"
                      value={option}
                      checked={kycData.employmentStatus === option}
                      onChange={(e) => setKycData({ ...kycData, employmentStatus: e.target.value })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Employer</label>
              <div className="flex flex-wrap gap-4">
                {[
                  'Government-Owned Company',
                  'Private',
                  'Government Sector',
                  'Other',
                  'Self-Employed'
                ].map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="employerType"
                      value={option}
                      checked={kycData.employerType === option}
                      onChange={(e) => setKycData({ ...kycData, employerType: e.target.value })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
              <input
                type="text"
                value={kycData.jobTitle}
                onChange={(e) => setKycData({ ...kycData, jobTitle: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Source of Income</label>
              <div className="flex flex-wrap gap-4">
                {['Salary', 'Other'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="sourceOfIncome"
                      value={option}
                      checked={kycData.sourceOfIncome === option}
                      onChange={(e) => setKycData({ ...kycData, sourceOfIncome: e.target.value })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Is the Customer Politically Exposed?</label>
              <div className="flex flex-wrap gap-4">
                {['Yes', 'No'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="politicallyExposed"
                      value={option}
                      checked={kycData.politicallyExposed === option}
                      onChange={(e) => setKycData({ ...kycData, politicallyExposed: e.target.value })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Use Compliance Officer</label>
              <div className="flex flex-wrap gap-4">
                {['High','Medium','Low'].map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="complianceRisk"
                      checked={kycData.complianceRisk === opt}
                      onChange={() => setKycData({ ...kycData, complianceRisk: opt as 'High'|'Medium'|'Low' })}
                    />
                    <span>{opt} Risk</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={async () => {
                  if (
                    !kycData.customerName ||
                    !kycData.civilIdNumber ||
                    !kycData.civilValidity ||
                    !kycData.phoneNumber ||
                    !kycData.employmentStatus ||
                    !kycData.employerType ||
                    !kycData.jobTitle ||
                    !kycData.sourceOfIncome ||
                    !kycData.politicallyExposed
                  ) {
                    alert('Please fill all required KYC fields.');
                    return;
                  }
                  
                  // Submit KYC data to backend
                  try {
                    // Generate form HTML for both languages
                    const formatValue = (value?: string) => (value && value.trim() ? value : '&nbsp;');
                    const employmentStatus = kycData.employmentStatus;
                    const employerType = kycData.employerType;
                    const sourceOfIncome = kycData.sourceOfIncome;
                    const politicallyExposed = kycData.politicallyExposed;
                    const complianceRisk = kycData.complianceRisk || 'Low';
                    
                    const buildCheckboxItem = (label: string, checked: boolean) => 
                      `<div class="checkbox-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled> ${label}</div>`;
                    
                    const employmentStatusMarkup = [
                      buildCheckboxItem('Retired', employmentStatus === 'Retired'),
                      buildCheckboxItem('Unemployed', employmentStatus === 'Unemployed'),
                      buildCheckboxItem('Employee', employmentStatus === 'Employee'),
                      buildCheckboxItem('Student', employmentStatus === 'Student')
                    ].join('');
                    
                    const employerOptionsMarkup = [
                      buildCheckboxItem('Government Sector', employerType === 'Government Sector'),
                      buildCheckboxItem('Private', employerType === 'Private'),
                      buildCheckboxItem('Government-Owned Company', employerType === 'Government-Owned Company'),
                      buildCheckboxItem('Self-Employed', employerType === 'Self-Employed'),
                      buildCheckboxItem('Other', employerType === 'Other')
                    ].join('');
                    
                    const incomeOptionsMarkup = [
                      buildCheckboxItem('Salary', sourceOfIncome === 'Salary'),
                      buildCheckboxItem('Other', sourceOfIncome === 'Other')
                    ].join('');
                    
                    const politicallyExposedMarkup = [
                      buildCheckboxItem('Yes', politicallyExposed === 'Yes'),
                      buildCheckboxItem('No', politicallyExposed === 'No')
                    ].join('');
                    
                    const complianceRiskMarkup = [
                      buildCheckboxItem('Low Risk', complianceRisk === 'Low'),
                      buildCheckboxItem('Medium Risk', complianceRisk === 'Medium'),
                      buildCheckboxItem('High Risk', complianceRisk === 'High'),
                    ].join('');
                    
                    // Generate English form HTML (simplified version - you can use the full printHtml from printEnglishForm)
                    const englishFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KYC Form</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print { 
      @page { 
        size: A4; 
        margin: 0.4cm; 
      }
      body { margin: 0; padding: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
      margin: 0;
    }
    .kyc-form {
      width: 100%;
      max-width: 20.2cm;
      background: #ffffff;
      border: 1px solid #ccc;
      padding: 0.4cm 0.6cm;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      page-break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .header .logo-text {
      font-size: 0.85em;
      font-weight: bold;
      color: #555;
    }
    .header h1 {
      margin: 0;
      font-size: 1.2em;
      color: #333;
    }
    .form-title {
      text-align: center;
      font-size: 1em;
      font-weight: bold;
      margin: 3px 0 6px 0;
    }
    .intro {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
    }
    .intro p {
      font-size: 0.7em;
      color: #d9534f;
      margin: 0;
      line-height: 1.2;
      flex-basis: 85%;
    }
    .cma-logo {
      font-weight: bold;
      color: #006a4e;
      font-size: 0.75em;
      text-align: center;
      flex-basis: 15%;
    }
    .section-title {
      font-size: 0.9em;
      font-weight: bold;
      color: #000;
      border-bottom: 1.5px solid #000;
      padding-bottom: 2px;
      margin: 8px 0 5px 0;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 4px 6px;
      align-items: center;
    }
    .form-grid label {
      font-weight: bold;
      font-size: 0.75em;
    }
    .field-value {
      border: 1px solid #ddd;
      background: #fafafa;
      padding: 3px 6px;
      font-size: 0.75em;
      border-radius: 2px;
      min-height: 14px;
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .checkbox-group.vertical {
      flex-direction: column;
      gap: 3px;
      align-items: flex-start;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7em;
    }
    input[type="checkbox"] {
      width: 11px;
      height: 11px;
      accent-color: #000;
      border: 2px solid #000;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
    }
    .definition {
      font-size: 0.65em;
      color: #444;
      border: 1px solid #eee;
      background: #fcfcfc;
      padding: 5px 8px;
      margin-top: 5px;
      line-height: 1.2;
    }
    .confirmation-text {
      font-size: 0.75em;
      margin-top: 6px;
      line-height: 1.2;
    }
    .signature-area {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    .signature-area label {
      font-weight: bold;
      font-size: 0.75em;
    }
    .signature-box {
      border: 1px solid #000;
      height: 24px;
      flex-grow: 1;
      max-width: 250px;
      border-radius: 2px;
    }
    .verification-text {
      font-size: 0.65em;
      color: #555;
      margin-top: 8px;
      border-top: 1px solid #eee;
      padding-top: 5px;
      line-height: 1.2;
    }
    .compliance-section {
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1.5px solid #000;
    }
    .compliance-section strong {
      font-size: 0.75em;
    }
    .footer-line {
      border: 0;
      height: 4px;
      background-image: repeating-linear-gradient(to right, #000 0, #000 4px, transparent 4px, transparent 8px);
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="kyc-form">
    <div class="header">
      <span class="logo-text">MEJURI</span>
      <h1>KYC</h1>
    </div>
    <h2 class="form-title">Know Your Customer Form - Individuals</h2>
    <div class="intro">
      <p>In implementation of Law No. (106) regarding Anti-Money Laundering and Combating the Financing of Terrorism and according to Ministerial Resolution No. (43) of 2016 regarding the controls regulating the work of institutions and companies operating in the field of gold trade and precious stones and precious metals trading.</p>
      <div class="cma-logo"></div>
    </div>
    <h3 class="section-title">Personal Data</h3>
    <div class="form-grid">
      <label>Client Name:</label>
      <div class="field-value">${formatValue(kycData.customerName)}</div>
      <label>Civil ID Number:</label>
      <div class="field-value">${formatValue(kycData.civilIdNumber)}</div>
      <label>Civil ID Expiry Date:</label>
      <div class="field-value">${formatValue(kycData.civilValidity)}</div>
      <label>Phone Number:</label>
      <div class="field-value">${formatValue(kycData.phoneNumber)}</div>
      <label>Employment Status:</label>
      <div class="checkbox-group">
        ${employmentStatusMarkup}
      </div>
      <label>Employer / Place of Work:</label>
      <div class="checkbox-group vertical">
        ${employerOptionsMarkup}
      </div>
      <label>Job Title:</label>
      <div class="field-value">${formatValue(kycData.jobTitle)}</div>
      <label>Source of Income:</label>
      <div class="checkbox-group">
        ${incomeOptionsMarkup}
      </div>
      <label>Is the client politically exposed?</label>
      <div class="checkbox-group">
        ${politicallyExposedMarkup}
      </div>
    </div>
    <p class="definition">(A politically exposed person is anyone who is or has been entrusted with high public functions in the State of Kuwait or in a foreign country, such as heads of state or government, senior politicians, or government, judicial, or military officials, and senior executives in state-owned companies, and prominent close associates in political parties)</p>
    <h3 class="section-title">I, the undersigned, confirm:</h3>
    <p class="confirmation-text">That the following personal information I have provided to the seller is correct and up-to-date.</p>
    <div class="signature-area">
      <label>Client Signature</label>
      <div class="signature-box"></div>
    </div>
    <p class="verification-text">The client's details have been verified and matched with the special measures according to the rules and laws related to combating money laundering and terrorist financing, and approval from senior management has been obtained regarding politically exposed clients.</p>
    <div class="compliance-section">
      <strong>For Compliance Officer Use:</strong>
      <div class="checkbox-group" style="margin-top: 10px;">
        ${complianceRiskMarkup}
      </div>
    </div>
    <hr class="footer-line">
  </div>
</body>
</html>`;
                    
                    // Generate Arabic form HTML with proper Arabic content
                    const arabicFormHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>استمارة اعرف عميلك</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media print { 
            @page { 
                size: A4; 
                margin: 0.4cm; 
            }
            body { margin: 0; padding: 0; }
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f4f4f4;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            margin: 0;
        }
        .kyc-form {
            width: 100%;
            max-width: 20.2cm;
            background: #ffffff;
            border: 1px solid #ccc;
            padding: 0.4cm 0.6cm;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            page-break-inside: avoid;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 3px;
            margin-bottom: 3px;
        }
        .header .logo-text {
            font-size: 0.85em;
            font-weight: bold;
            color: #555;
        }
        .header h1 {
            margin: 0;
            font-size: 1.2em;
            color: #333;
        }
        .form-title {
            text-align: center;
            font-size: 1em;
            font-weight: bold;
            margin: 3px 0 6px 0;
        }
        .intro {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 8px;
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
        }
        .intro p {
            font-size: 0.7em;
            color: #d9534f;
            margin: 0;
            line-height: 1.2;
            flex-basis: 85%;
        }
        .cma-logo {
            font-weight: bold;
            color: #006a4e;
            font-size: 0.75em;
            text-align: center;
            flex-basis: 15%;
        }
        .section-title {
            font-size: 0.9em;
            font-weight: bold;
            color: #000;
            border-bottom: 1.5px solid #000;
            padding-bottom: 2px;
            margin: 8px 0 5px 0;
        }
        .form-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 4px 6px;
            align-items: center;
        }
        .form-grid label {
            font-weight: bold;
            font-size: 0.75em;
        }
        .field-value {
            border: 1px solid #ddd;
            background: #fafafa;
            padding: 3px 6px;
            font-size: 0.75em;
            border-radius: 2px;
            min-height: 14px;
        }
        .checkbox-group {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .checkbox-group.vertical {
            flex-direction: column;
            gap: 3px;
            align-items: flex-start;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 0.7em;
        }
        input[type="checkbox"] {
            width: 11px;
            height: 11px;
            accent-color: #000 !important;
            border: 2px solid #000 !important;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
        }
        .definition {
            font-size: 0.65em;
            color: #444;
            border: 1px solid #eee;
            background: #fcfcfc;
            padding: 5px 8px;
            margin-top: 5px;
            line-height: 1.2;
        }
        .confirmation-text {
            font-size: 0.75em;
            margin-top: 6px;
            line-height: 1.2;
        }
        .signature-area {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            margin-top: 6px;
        }
        .signature-area label {
            font-weight: bold;
            font-size: 0.75em;
        }
        .signature-box {
            border: 1px solid #000;
            height: 24px;
            flex-grow: 1;
            max-width: 250px;
            border-radius: 2px;
        }
        .verification-text {
            font-size: 0.65em;
            color: #555;
            margin-top: 8px;
            border-top: 1px solid #eee;
            padding-top: 5px;
            line-height: 1.2;
        }
        .compliance-section {
            margin-top: 8px;
            padding-top: 5px;
            border-top: 1.5px solid #000;
        }
        .compliance-section strong {
            font-size: 0.75em;
        }
        .footer-line {
            border: 0;
            height: 4px;
            background-image: repeating-linear-gradient(to right, #000 0, #000 4px, transparent 4px, transparent 8px);
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="kyc-form">
        <div class="header">
            <span class="logo-text">MEJURI</span>
            <h1>KYC</h1>
        </div>
        <h2 class="form-title">استمارة اعرف عميلك - الأفراد</h2>
        <div class="intro">
            <p>تطبيقاً للقانون رقم (٠٦) بشأن مكافحة غسل الأموال وتمويل الإرهاب وحسب القرار الوزاري رقم (٤٣) لسنة ٢٠١٦ بشأن الضوابط المنظمة لأعمال المؤسسات والشركات التي تعمل في مجال تجارة الذهب والاتجار الكريمة والمعادن الثمينة.</p>
            <div class="cma-logo"></div>
        </div>
        <h3 class="section-title">البيانات الشخصية</h3>
        <div class="form-grid">
            <label>اسم العميل:</label>
            <div class="field-value">${formatValue(kycData.customerName)}</div>
            <label>رقم الهوية المدنية:</label>
            <div class="field-value">${formatValue(kycData.civilIdNumber)}</div>
            <label>تاريخ انتهاء الهوية المدنية:</label>
            <div class="field-value">${formatValue(kycData.civilValidity)}</div>
            <label>رقم الهاتف:</label>
            <div class="field-value">${formatValue(kycData.phoneNumber)}</div>
            <label>الحالة الوظيفية:</label>
            <div class="checkbox-group">
                ${buildCheckboxItem('طالب', employmentStatus === 'Student')}
                ${buildCheckboxItem('موظف', employmentStatus === 'Employee')}
                ${buildCheckboxItem('غير موظف', employmentStatus === 'Unemployed')}
                ${buildCheckboxItem('متقاعد', employmentStatus === 'Retired')}
            </div>
            <label>صاحب العمل / مكان العمل:</label>
            <div class="checkbox-group vertical">
                ${buildCheckboxItem('قطاع حكومي', employerType === 'Government Sector')}
                ${buildCheckboxItem('خاص', employerType === 'Private')}
                ${buildCheckboxItem('شركة مملوكة للحكومة', employerType === 'Government-Owned Company')}
                ${buildCheckboxItem('أعمال حرة', employerType === 'Self-Employed')}
                ${buildCheckboxItem('أخرى', employerType === 'Other')}
            </div>
            <label>المسمى الوظيفي:</label>
            <div class="field-value">${formatValue(kycData.jobTitle)}</div>
            <label>مصدر الدخل:</label>
            <div class="checkbox-group">
                ${buildCheckboxItem('الراتب', sourceOfIncome === 'Salary')}
                ${buildCheckboxItem('أخرى', sourceOfIncome === 'Other')}
            </div>
            <label>هل العميل شخص معرض سياسياً؟</label>
            <div class="checkbox-group">
                ${buildCheckboxItem('نعم', politicallyExposed === 'Yes')}
                ${buildCheckboxItem('لا', politicallyExposed === 'No')}
            </div>
        </div>
        <p class="definition">(الشخص المعرض سياسياً هو أي شخص تم تكليفه أو كان مكلفاً بوظائف عامة رفيعة في دولة الكويت أو في دولة أجنبية، مثل رؤساء الدول أو الحكومات، وكبار السياسيين، أو المسؤولين الحكوميين أو القضائيين أو العسكريين، وكبار المسؤولين التنفيذيين في الشركات المملوكة للدولة، وأقارب المقربين البارزين في الأحزاب السياسية)</p>
        <h3 class="section-title">أنا الموقع أدناه، أؤكد:</h3>
        <p class="confirmation-text">أن المعلومات الشخصية التالية التي قدمتها للبائع صحيحة ومحدثة.</p>
        <div class="signature-area">
            <label>توقيع العميل</label>
            <div class="signature-box"></div>
        </div>
        <p class="verification-text">تم التحقق من تفاصيل العميل ومطابقتها مع الإجراءات الخاصة وفقاً للقواعد والقوانين المتعلقة بمكافحة غسل الأموال وتمويل الإرهاب، وتم الحصول على موافقة الإدارة العليا فيما يتعلق بالعملاء المعرضين سياسياً.</p>
        <div class="compliance-section">
            <strong>للاستخدام من قبل مسؤول الامتثال:</strong>
            <div class="checkbox-group" style="margin-top: 10px;">
                ${buildCheckboxItem('منخفض المخاطر', complianceRisk === 'Low')}
                ${buildCheckboxItem('متوسط المخاطر', complianceRisk === 'Medium')}
                ${buildCheckboxItem('عالي المخاطر', complianceRisk === 'High')}
            </div>
        </div>
        <hr class="footer-line">
    </div>
</body>
</html>`;
                    
                    const kycSubmissionData = {
                      customerName: kycData.customerName,
                      civilId: kycData.civilIdNumber,
                      civilIdValidity: kycData.civilValidity,
                      phoneNumber: kycData.phoneNumber,
                      employmentStatus: kycData.employmentStatus,
                      employer: kycData.employerType,
                      jobTitle: kycData.jobTitle,
                      sourceOfIncome: kycData.sourceOfIncome,
                      politicallyExposed: kycData.politicallyExposed,
                      complianceOfficer: kycData.complianceRisk,
                      formHtmlEnglish: englishFormHtml,
                      formHtmlArabic: arabicFormHtml
                    };
                    
                    await kycAPI.submitKYC(kycSubmissionData);
                    
                    // Also save scanned data if available
                    if (scannedData && cardId) {
                      await userCardAPI.updateCard(cardId, scannedData);
                    }
                    
                    alert('KYC form and scanned data submitted successfully!');
                  } catch (error) {
                    console.error('KYC submission error:', error);
                    alert('Failed to submit KYC form and scanned data. Please try again.');
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                Submit
              </button>
              <button
                onClick={handleKYCPrint}
                disabled={isPrinting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium flex items-center"
              >
                {isPrinting ? (
                  <>
                    <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Preview in progress...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const side = (e.target as any).side as 'front' | 'back';
            handleFileChange(e, side || 'front');
          }}
        />
        
        {/* Language Selection Dialog */}
        {showLanguageDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Select Language</h3>
                <button
                  onClick={() => {
                    setShowLanguageDialog(false);
                    setIsPrinting(false);
                  }}
                  disabled={isPrinting}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-gray-600 mb-6">Which form would you like to print?</p>
              {isPrinting && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-700 text-sm">Preview in progress...</span>
                </div>
              )}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleLanguageSelect('english')}
                  disabled={isPrinting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isPrinting && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  English
                </button>
                <button
                  onClick={() => handleLanguageSelect('arabic')}
                  disabled={isPrinting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isPrinting && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Arabic
                </button>
                <button
                  onClick={() => setShowLanguageDialog(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-card-content, .print-card-content * {
            visibility: visible;
          }
          
          .print-card-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            visibility: visible !important;
            padding: 10px !important;
            font-size: 12px !important;
          }
          
          .print-images-section {
            grid-template-columns: 1fr 1fr !important;
            gap: 15px !important;
            margin-bottom: 15px !important;
          }
          
          .print-form-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 6px !important;
          }
          
          .print-hidden {
            display: none !important;
          }
          
          /* Increase image size by 20% for printing */
          .print-images-section img {
            max-height: 144px !important;
          }
          
          /* Reduce input field padding for printing */
          .print-form-grid input {
            padding: 3px 5px !important;
            font-size: 11px !important;
          }
          
          /* Reduce label font size for printing */
          .print-form-grid label {
            font-size: 10px !important;
            margin-bottom: 2px !important;
          }
          
          /* Reduce heading sizes for printing */
          .print-card-content h2 {
            font-size: 18px !important;
          }
          
          .print-card-content h3 {
            font-size: 14px !important;
          }
          
          /* Remove shadows and rounded corners for printing */
          .print-card-content {
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
      {/* Hidden printable container used by react-to-print */}
      <div
        ref={printableRef}
        style={{ display: printHtmlContent ? 'block' : 'none', position: 'fixed', left: '-10000px', top: 0 }}
        dangerouslySetInnerHTML={{ __html: printHtmlContent || '' }}
      />
    </div>
  );
};

export default CardScanning;
