/**
 * Cross-platform print helper optimized for Android tablets, mobile browsers, and desktop.
 * Uses an isolated off-screen iframe so Android Print Spooler / Chrome never renders a blank page,
 * eliminates trailing blank footer space by measuring and setting exact receipt height,
 * and stretches content edge-to-edge across the 80mm thermal paper roll.
 */
export function printReceiptElement(
  elementId: string,
  format: '80mm' | 'a4' = '80mm',
  title = 'Print Receipt'
) {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  try {
    // Remove any previously created print iframe
    const existingIframe = document.getElementById('distributor-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'distributor-print-iframe';
    // Position off-screen with explicit layout dimensions so browser layout engine computes valid geometry
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = format === '80mm' ? '80mm' : '210mm';
    iframe.style.height = 'auto';
    iframe.style.border = '0';
    iframe.style.visibility = 'visible';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      window.print();
      return;
    }

    // Collect all stylesheets from main document so Tailwind utility classes work identically
    let styleSheetsHtml = '';
    const styleTags = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleTags.forEach((tag) => {
      styleSheetsHtml += tag.outerHTML + '\n';
    });

    const baseCss =
      format === '80mm'
        ? `@page {
             size: 80mm 200mm; /* Initial page size, dynamically measured before print */
             margin: 0mm !important;
           }
           *, *::before, *::after {
             box-sizing: border-box !important;
             color: #000000 !important;
             border-color: #000000 !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }
           html, body {
             margin: 0 !important;
             padding: 0 !important;
             width: 100% !important;
             min-width: 100% !important;
             max-width: 100% !important;
             background: #ffffff !important;
             background-color: #ffffff !important;
           }
           body {
             padding: 0 1.5mm !important; /* Gentle 1.5mm physical margin from roll edges */
             font-family: 'Courier New', Courier, monospace, 'Lucida Console', -apple-system, sans-serif !important;
             font-size: 13.5px !important;
             font-weight: 700 !important;
             line-height: 1.3 !important;
             color: #000000 !important;
           }
           .receipt-80mm,
           [class*="receipt-80mm"],
           [class*="max-w-"] {
             width: 100% !important;
             min-width: 100% !important;
             max-width: 100% !important;
             margin: 0 !important;
             padding: 0 !important;
             border: none !important;
             box-shadow: none !important;
             background: transparent !important;
           }
           .flex {
             display: flex !important;
             width: 100% !important;
           }
           .justify-between {
             justify-content: space-between !important;
           }
           .border-t-2, .border-b-2 {
             border-color: #000000 !important;
             width: 100% !important;
           }
           .receipt-80mm .w-28 {
             width: 7rem !important;
           }
           .receipt-80mm .font-black {
             font-weight: 900 !important;
           }
           .receipt-80mm img {
             max-width: 55px !important;
             max-height: 55px !important;
             display: block !important;
             margin: 0 auto 4px auto !important;
             filter: grayscale(100%) contrast(200%) !important;
             -webkit-filter: grayscale(100%) contrast(200%) !important;
           }
           .print\\:hidden {
             display: none !important;
           }`
        : `@page {
             size: A4 portrait;
             margin: 8mm;
           }
           *, *::before, *::after {
             box-sizing: border-box !important;
             color: #000000 !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }
           html, body {
             margin: 0 !important;
             padding: 0 !important;
             width: 100% !important;
             background: #ffffff !important;
           }
           body {
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
             color: #000000 !important;
             font-size: 13px !important;
           }
           .invoice-a4 {
             width: 100% !important;
             max-width: 100% !important;
             margin: 0 !important;
             padding: 0 !important;
             border: none !important;
             box-shadow: none !important;
           }
           .print\\:hidden {
             display: none !important;
           }`;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          ${styleSheetsHtml}
          <style id="base-print-css">
            ${baseCss}
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    const triggerPrint = () => {
      try {
        if (format === '80mm') {
          // Measure the exact rendered height in px after DOM layout and images are loaded
          const body = iframeDoc.body;
          const html = iframeDoc.documentElement;
          const heightPx = Math.max(
            body ? body.scrollHeight : 0,
            body ? body.offsetHeight : 0,
            html ? html.scrollHeight : 0,
            html ? html.offsetHeight : 0
          );

          if (heightPx > 50) {
            // 1 px @ 96 DPI = 25.4 / 96 mm = 0.2645833 mm
            // Add 2.5mm safety buffer to ensure Android Print Spooler finishes immediately without generating a trailing blank page
            const exactHeightMm = Math.ceil(heightPx * 0.2645833) + 3;

            const dynamicStyle = iframeDoc.createElement('style');
            dynamicStyle.id = 'dynamic-receipt-dimensions';
            dynamicStyle.textContent = `
              @page {
                size: 80mm ${exactHeightMm}mm !important;
                margin: 0mm !important;
              }
              html, body {
                width: 80mm !important;
                max-width: 80mm !important;
                height: ${exactHeightMm}mm !important;
                max-height: ${exactHeightMm}mm !important;
                overflow: hidden !important;
              }
            `;
            iframeDoc.head.appendChild(dynamicStyle);
          }
        }

        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print()', err);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 4000);
      }
    };

    // Ensure all images (e.g. logos) have finished loading before measuring height
    const images = iframeDoc.images;
    let pendingImages = images.length;

    if (pendingImages === 0) {
      setTimeout(triggerPrint, 120);
    } else {
      let isExecuted = false;
      const onImageReady = () => {
        pendingImages--;
        if (pendingImages <= 0 && !isExecuted) {
          isExecuted = true;
          setTimeout(triggerPrint, 120);
        }
      };

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.complete) {
          pendingImages--;
        } else {
          img.onload = onImageReady;
          img.onerror = onImageReady;
        }
      }

      if (pendingImages <= 0 && !isExecuted) {
        isExecuted = true;
        setTimeout(triggerPrint, 120);
      }

      // Safety timeout: if an image takes too long, trigger print anyway
      setTimeout(() => {
        if (!isExecuted) {
          isExecuted = true;
          triggerPrint();
        }
      }, 500);
    }
  } catch (e) {
    console.error('Print helper error, invoking window.print() fallback', e);
    window.print();
  }
}

