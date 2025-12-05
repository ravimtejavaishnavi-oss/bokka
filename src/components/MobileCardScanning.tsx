import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { ArrowLeft, Camera, Upload, Scan, AlertCircle, X, Save, Printer, Smartphone, Monitor } from 'lucide-react';
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

const MobileCardScanning: React.FC<{ onBack: () => void; onSwitchToDesktop?: () => void }> = ({ onBack, onSwitchToDesktop }) => {
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
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment'); // Default to back camera for mobile
  
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
  const cardBoundingBoxRef = useRef<{x: number, y: number, width: number, height: number} | null>(null);

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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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
      setTimeout(() => setPrintHtmlContent(null), 300);
    }
  });

  const handlePrint = () => {
    setIsPrinting(true);
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
      
      const imageUrl = URL.createObjectURL(file);
      if (side === 'front') {
        setFrontCardImage(imageUrl);
        setFrontCardFile(file);
      } else {
        setBackCardImage(imageUrl);
        setBackCardFile(file);
      }
      
      setTimeout(() => {
        const hasFront = side === 'front' ? true : !!frontCardFile;
        const hasBack = side === 'back' ? true : !!backCardFile;
        
        if (hasFront && hasBack && mobileNumberEntered) {
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
      
      setScanProgress(10);
      setScanStep('Analyzing image quality...');
      
      const frontQuality = await analyzeImageQuality(frontFile);
      const backQuality = await analyzeImageQuality(backFile);
      
      setImageQuality(frontQuality > 80 && backQuality > 80 ? 'excellent' : 
                     frontQuality > 60 && backQuality > 60 ? 'good' : 
                     frontQuality > 40 && backQuality > 40 ? 'fair' : 'poor');
      
      setScanProgress(25);
      setScanStep('Preprocessing images...');
      
      const processedFrontFile = await preprocessImage(frontFile);
      const processedBackFile = await preprocessImage(backFile);
      
      setScanProgress(50);
      setScanStep('Extracting data with AI...');
      
      const result = await userCardAPI.scanDualCard(processedFrontFile, processedBackFile, mobileNumber);
      const combinedData = result.cardData;
      
      setScanProgress(75);
      setScanStep('Validating extracted data...');
      
      const validationResult = validateCardData(combinedData);
      setExtractionConfidence(validationResult.confidence);
      
      if (validationResult.confidence < 70) {
        console.warn('Low confidence in extracted data:', validationResult.issues);
      }
      
      setScanProgress(100);
      setScanStep('Scan completed successfully!');
      
      setScannedData(combinedData);
      if (result.id) {
        setCardId(result.id);
      }
      setIsScanning(false);
      setLoading(false);
      
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
    if (fileInputRef.current) {
      (fileInputRef.current as any).side = side;
      fileInputRef.current.click();
    }
  };

  const startCamera = (side: 'front' | 'back') => {
    setCurrentSide(side);
    setIsCameraActive(true);
    setIsCardDetected(false);
    setAutoCaptureEnabled(false);
    setFocusQuality(0);
    cardBoundingBoxRef.current = null;
    // Auto-detection disabled to prevent flickering and hanging
    // Manual capture only - no need to start detection loop
    // startDetection();
  };

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
          resolve(50);
          return;
        }
        
        let sharpness = 0;
        const data = imageData.data;
        
        for (let i = 0; i < data.length - 4; i += 4) {
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const nextGray = (data[i + 4] + data[i + 5] + data[i + 6]) / 3;
          sharpness += Math.abs(gray - nextGray);
        }
        
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
    
    const requiredFields = ['civilIdNo', 'name', 'nationality'];
    requiredFields.forEach(field => {
      if (!data[field] || data[field].trim() === '') {
        issues.push(`Missing or empty ${field}`);
        confidence -= 20;
      }
    });
    
    if (data.civilIdNo && !/^\d{12}$/.test(data.civilIdNo.replace(/\s/g, ''))) {
      issues.push('Invalid Civil ID format');
      confidence -= 15;
    }
    
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
        
        if (hasFront && hasBack && mobileNumberEntered) {
          // Use original uncropped files for backend processing
          const frontFile = currentSide === 'front' ? originalFile : frontCardFileOriginal;
          const backFile = currentSide === 'back' ? originalFile : backCardFileOriginal;
          
          if (frontFile && backFile) {
            scanBothSides(frontFile, backFile);
          }
        } else if (hasFront && hasBack && !mobileNumberEntered) {
          setError('Please enter the customer mobile number before scanning');
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

  const handleClear = () => {
    setScannedData(null);
    setFrontCardImage(null);
    setBackCardImage(null);
    setFrontCardFile(null);
    setBackCardFile(null);
    setError(null);
  };

  // Save KYC data and scanned data
  const saveKYCData = async () => {
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
      // Generate form HTML for both languages (same as CardScanning.tsx)
      const formatValue = (value?: string) => (value && value.trim() ? value : '&nbsp;');
      const employmentStatus = kycData.employmentStatus;
      const employerType = kycData.employerType;
      const sourceOfIncome = kycData.sourceOfIncome;
      const politicallyExposed = kycData.politicallyExposed;
      const complianceRisk = kycData.complianceRisk || 'Low';
      
      const buildCheckboxItem = (label: string, checked: boolean) => 
        `<div class="checkbox-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled> ${label}</div>`;
      
      // Generate English form HTML (same structure as CardScanning.tsx)
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
        ${buildCheckboxItem('Retired', employmentStatus === 'Retired')}
        ${buildCheckboxItem('Unemployed', employmentStatus === 'Unemployed')}
        ${buildCheckboxItem('Employee', employmentStatus === 'Employee')}
        ${buildCheckboxItem('Student', employmentStatus === 'Student')}
      </div>
      <label>Employer / Place of Work:</label>
      <div class="checkbox-group vertical">
        ${buildCheckboxItem('Government Sector', employerType === 'Government Sector')}
        ${buildCheckboxItem('Private', employerType === 'Private')}
        ${buildCheckboxItem('Government-Owned Company', employerType === 'Government-Owned Company')}
        ${buildCheckboxItem('Self-Employed', employerType === 'Self-Employed')}
        ${buildCheckboxItem('Other', employerType === 'Other')}
      </div>
      <label>Job Title:</label>
      <div class="field-value">${formatValue(kycData.jobTitle)}</div>
      <label>Source of Income:</label>
      <div class="checkbox-group">
        ${buildCheckboxItem('Salary', sourceOfIncome === 'Salary')}
        ${buildCheckboxItem('Other', sourceOfIncome === 'Other')}
      </div>
      <label>Is the client politically exposed?</label>
      <div class="checkbox-group">
        ${buildCheckboxItem('Yes', politicallyExposed === 'Yes')}
        ${buildCheckboxItem('No', politicallyExposed === 'No')}
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
        ${buildCheckboxItem('Low Risk', complianceRisk === 'Low')}
        ${buildCheckboxItem('Medium Risk', complianceRisk === 'Medium')}
        ${buildCheckboxItem('High Risk', complianceRisk === 'High')}
      </div>
    </div>
    <hr class="footer-line">
  </div>
</body>
</html>`;
      
      // Generate Arabic form HTML (same structure as CardScanning.tsx)
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
  };

  // Mobile-optimized UI
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => {
              console.log('Back button clicked in MobileCardScanning');
              onBack();
            }}
            className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Civil ID Scan</h1>
          <button
            onClick={onSwitchToDesktop}
            className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <Monitor className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-red-500" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        {/* Mobile Number Input Section */}
        {!mobileNumberEntered && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center mb-3">
              <Smartphone className="mr-2 h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Enter Customer Mobile Number</h3>
            </div>
            <p className="text-gray-600 text-sm mb-3">Please enter the customer's mobile number before scanning the card.</p>
            <div className="space-y-3">
              <div>
                <label htmlFor="mobileNumberMobile" className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <p className="text-red-600 text-xs mb-1">*number should not start with 0/+965/spaces/symbols</p>
                <input
                  type="tel"
                  id="mobileNumberMobile"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
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
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {mobileNumberEntered && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <Smartphone className="mr-2 h-4 w-4 text-green-600" />
              <span className="text-green-800 font-medium text-sm">Mobile: {mobileNumber}</span>
            </div>
            <button
              onClick={() => {
                setMobileNumberEntered(false);
                setMobileNumber('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Change
            </button>
          </div>
        )}

        {/* Scanning Progress */}
        {isScanning && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 text-sm">{scanStep}</span>
              <span className="text-blue-500 text-sm">{scanProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Camera View */}
        {isCameraActive && mobileNumberEntered && (
          <div className="relative">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[3/4] max-h-[70vh]">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ 
                  facingMode: cameraFacingMode,
                  width: { ideal: 1080 },
                  height: { ideal: 1440 }
                }}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="hidden"
                onLoadedData={() => {
                  if (videoRef.current) {
                    streamRef.current = (webcamRef.current?.video as HTMLVideoElement)?.srcObject as MediaStream;
                    if (streamRef.current) {
                      videoRef.current.srcObject = streamRef.current;
                    }
                  }
                }}
              />
              
              {/* Card Detection Overlay */}
              {isCardDetected && (
                <div className="absolute inset-0 border-4 border-green-500 rounded-lg pointer-events-none">
                  <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                    Card Detected
                  </div>
                </div>
              )}

              {/* Focus Quality Indicator */}
              {focusQuality > 0 && (
                <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                  Focus: {Math.round(focusQuality)}%
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={stopCamera}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <button
                onClick={captureImage}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-gray-300"
              >
                <Camera className="w-8 h-8 text-gray-800" />
              </button>
              
              <button
                onClick={toggleCameraFacingMode}
                className="w-12 h-12 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Card Image Preview */}
        {!isCameraActive && (
          <div className={`space-y-4 ${!mobileNumberEntered ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Front Side */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-gray-800 font-medium mb-3 flex items-center">
                <Camera className="mr-2 h-4 w-4" />
                Front Side
              </h3>
              
              <div className="relative bg-gray-200 rounded-lg overflow-hidden aspect-[3/4] mb-3">
                {frontCardImage ? (
                  <img 
                    src={frontCardImage} 
                    alt="Front side" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Camera className="h-12 w-12 mb-2" />
                    <p className="text-sm">No front image</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => startCamera('front')}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Camera
                </button>
                <button
                  onClick={() => triggerFileSelect('front')}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </button>
              </div>
            </div>

            {/* Back Side */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-gray-800 font-medium mb-3 flex items-center">
                <Camera className="mr-2 h-4 w-4" />
                Back Side
              </h3>
              
              <div className="relative bg-gray-200 rounded-lg overflow-hidden aspect-[3/4] mb-3">
                {backCardImage ? (
                  <img 
                    src={backCardImage} 
                    alt="Back side" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Camera className="h-12 w-12 mb-2" />
                    <p className="text-sm">No back image</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => startCamera('back')}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Camera
                </button>
                <button
                  onClick={() => triggerFileSelect('back')}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KYC Form - visible only after data is extracted */}
        {scannedData && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <Scan className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">KYC Form</h2>
                <p className="text-gray-600 text-xs">Auto-filled from Document Intelligence. Edit if needed.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={kycData.customerName}
                  onChange={(e) => setKycData({ ...kycData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Civil ID Number</label>
                <input
                  type="text"
                  value={kycData.civilIdNumber}
                  onChange={(e) => setKycData({ ...kycData, civilIdNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Civil ID Validity</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={kycData.civilValidity}
                  onChange={(e) => setKycData({ ...kycData, civilValidity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={kycData.phoneNumber}
                  onChange={(e) => setKycData({ ...kycData, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Employment Status</label>
              <div className="flex flex-wrap gap-2">
                {['Retired', 'Unemployed', 'Employee', 'Student'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1 text-xs">
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

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Employer</label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Government-Owned Company',
                  'Private',
                  'Government Sector',
                  'Other',
                  'Self-Employed'
                ].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1 text-xs">
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

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                value={kycData.jobTitle}
                onChange={(e) => setKycData({ ...kycData, jobTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Source of Income</label>
              <div className="flex flex-wrap gap-2">
                {['Salary', 'Other'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1 text-xs">
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

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Is the Customer Politically Exposed?</label>
              <div className="flex flex-wrap gap-2">
                {['Yes', 'No'].map((option) => (
                  <label key={option} className="inline-flex items-center gap-1 text-xs">
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

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Use Compliance Officer</label>
              <div className="flex flex-wrap gap-2">
                {['High','Medium','Low'].map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-1 text-xs">
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

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={saveKYCData}
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg font-medium flex items-center text-xs"
              >
                <Save className="mr-1 h-3 w-3" />
                Submit
              </button>
              <button
                onClick={handleKYCPrint}
                disabled={isPrinting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2 px-3 rounded-lg font-medium flex items-center text-xs"
              >
                {isPrinting ? (
                  <>
                    <div className="mr-1 h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Preview...
                  </>
                ) : (
                  <>
                    <Printer className="mr-1 h-3 w-3" />
                    Print
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const side = (fileInputRef.current as any)?.side;
          if (side) {
            handleFileChange(e, side);
          }
        }}
        className="hidden"
      />

      {/* Language Selection Dialog */}
      {showLanguageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-800">Select Language</h3>
              <button
                onClick={() => {
                  setShowLanguageDialog(false);
                  setIsPrinting(false);
                }}
                disabled={isPrinting}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4 text-sm">Which form would you like to print?</p>
            {isPrinting && (
              <div className="mb-3 p-2 bg-blue-50 rounded-lg flex items-center gap-2">
                <div className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-700 text-xs">Preview in progress...</span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleLanguageSelect('english')}
                disabled={isPrinting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isPrinting && <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                English
              </button>
              <button
                onClick={() => handleLanguageSelect('arabic')}
                disabled={isPrinting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isPrinting && <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                Arabic
              </button>
              <button
                onClick={() => setShowLanguageDialog(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print content */}
      <div ref={printContentRef} className="print-only">
        {scannedData && (
          <div className="p-4">
            <h2>Civil ID Card Data</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(scannedData).map(([key, value]) => (
                <div key={key}>
                  <strong>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong> {value as string}
                </div>
              ))}
            </div>
            <p>Scanned on: {formatTimestamp(new Date().toISOString())}</p>
          </div>
        )}
      </div>
      {/* Hidden printable container used by react-to-print */}
      <div
        ref={printableRef}
        style={{ display: printHtmlContent ? 'block' : 'none', position: 'fixed', left: '-10000px', top: 0 }}
        dangerouslySetInnerHTML={{ __html: printHtmlContent || '' }}
      />
    </div>
  );
};

export default MobileCardScanning;