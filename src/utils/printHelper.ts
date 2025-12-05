/**
 * Universal print helper that works across all browsers and devices
 */

interface PrintOptions {
  html: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  title?: string;
}

/**
 * Detects the browser type
 */
function detectBrowser(): 'chrome' | 'firefox' | 'safari' | 'edge' | 'ie' | 'other' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('chrome') && !ua.includes('edg')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('msie') || ua.includes('trident')) return 'ie';
  return 'other';
}

/**
 * Detects if running on mobile device
 */
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    navigator.userAgent
  );
}

/**
 * Detects if running on iOS
 */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Universal print function that works across all browsers and devices
 */
export function printHTML({ html, onSuccess, onError, title = 'Print' }: PrintOptions): void {
  const browser = detectBrowser();
  const isMobile = isMobileDevice();
  const isIOSDevice = isIOS();
  
  // Strategy 1: Try window.open with new window (works on most browsers)
  try {
    // For iOS Safari, we need to use a different approach
    if (isIOSDevice && browser === 'safari') {
      printForIOSSafari(html, onSuccess, onError);
      return;
    }
    
    // For other browsers, use standard approach
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    
    if (!printWindow) {
      // Popup blocked - try alternative method
      printFallback(html, onSuccess, onError);
      return;
    }
    
    // Write content to window
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Set title
    if (printWindow.document) {
      printWindow.document.title = title;
    }
    
    // Wait for content to load - use multiple strategies
    const printDelay = isMobile ? 1500 : 800;
    let printAttempted = false;
    
    const attemptPrint = () => {
      if (printAttempted) return;
      printAttempted = true;
      
      try {
        // Check if window is still open and document is ready
        if (printWindow.closed) {
          onError?.('Print window was closed');
          return;
        }
        
        // Focus the window
        printWindow.focus();
        
        // Attempt to print
        printWindow.print();
        
        onSuccess?.();
        
        // Close window after print (with delay for mobile)
        setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            printWindow.close();
          }
        }, isMobile ? 5000 : 3000);
      } catch (err) {
        console.error('Print error:', err);
        onError?.('Failed to open print dialog');
      }
    };
    
    // Strategy 1: Use onload event (works on most browsers)
    printWindow.onload = () => {
      setTimeout(attemptPrint, printDelay);
    };
    
    // Strategy 2: Check document readyState (fallback for browsers where onload doesn't fire)
    const checkReady = setInterval(() => {
      try {
        if (printWindow.document && printWindow.document.readyState === 'complete') {
          clearInterval(checkReady);
          if (!printAttempted) {
            setTimeout(attemptPrint, printDelay);
          }
        }
      } catch (e) {
        // Cross-origin or other error
        clearInterval(checkReady);
      }
    }, 100);
    
    // Strategy 3: Timeout fallback (last resort)
    setTimeout(() => {
      clearInterval(checkReady);
      if (!printAttempted && printWindow && !printWindow.closed) {
        attemptPrint();
      }
    }, printDelay + 2000);
    
  } catch (err) {
    console.error('Error in printHTML:', err);
    // Fallback to alternative method
    printFallback(html, onSuccess, onError);
  }
}

/**
 * Fallback print method using iframe (for when popups are blocked)
 */
function printFallback(html: string, onSuccess?: () => void, onError?: (error: string) => void): void {
  try {
    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (!iframeDoc) {
      onError?.('Cannot access iframe document');
      return;
    }
    
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    // Wait for iframe to load
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          onSuccess?.();
          
          // Remove iframe after print
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (err) {
          console.error('Iframe print error:', err);
          document.body.removeChild(iframe);
          onError?.('Failed to print from iframe');
        }
      }, 500);
    };
    
    // Fallback timeout
    setTimeout(() => {
      if (iframe.parentNode) {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          onSuccess?.();
          setTimeout(() => {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        } catch (err) {
          console.error('Iframe print timeout error:', err);
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
          onError?.('Print timeout');
        }
      }
    }, 2000);
    
  } catch (err) {
    console.error('Fallback print error:', err);
    onError?.('All print methods failed');
  }
}

/**
 * Special handling for iOS Safari
 */
function printForIOSSafari(html: string, onSuccess?: () => void, onError?: (error: string) => void): void {
  try {
    // iOS Safari requires a different approach
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      onError?.('Please allow popups to print');
      return;
    }
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // iOS Safari needs more time
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
        onSuccess?.();
        
        // Don't auto-close on iOS - let user close manually
        // iOS Safari handles window closing differently
      } catch (err) {
        console.error('iOS Safari print error:', err);
        onError?.('Failed to print on iOS');
      }
    }, 2000);
    
  } catch (err) {
    console.error('iOS Safari print error:', err);
    onError?.('iOS print failed');
  }
}

