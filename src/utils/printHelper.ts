/**
 * Cross-platform print helper optimized for Android tablets, mobile browsers, and desktop.
 * Uses an isolated hidden iframe so Android Print Spooler / Chrome never renders a blank page,
 * with seamless fallback to standard window.print().
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
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
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

    const pageCss =
      format === '80mm'
        ? `@page { size: 80mm auto; margin: 0mm; }
           html, body {
             margin: 0 !important;
             padding: 0 !important;
             width: 80mm !important;
             max-width: 80mm !important;
             background: #ffffff !important;
           }
           body {
             padding: 1.5mm 2mm !important;
             font-family: 'Courier New', Courier, monospace, 'Lucida Console', -apple-system, sans-serif !important;
             font-size: 13px !important;
             font-weight: 700 !important;
             line-height: 1.35 !important;
             color: #000000 !important;
           }
           .receipt-80mm {
             width: 100% !important;
             max-width: 76mm !important;
             margin: 0 auto !important;
             padding: 0 !important;
             border: none !important;
             box-shadow: none !important;
           }
           * {
             color: #000000 !important;
             border-color: #000000 !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
           }`
        : `@page { size: A4 portrait; margin: 8mm; }
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
           * {
             color: #000000 !important;
             border-color: #000000 !important;
             -webkit-print-color-adjust: exact !important;
             print-color-adjust: exact !important;
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
          <style>
            ${pageCss}
            .print\\:hidden { display: none !important; }
            img {
              filter: grayscale(100%) contrast(180%) !important;
              -webkit-filter: grayscale(100%) contrast(180%) !important;
              max-width: 60px !important;
              max-height: 60px !important;
              display: block !important;
              margin: 0 auto !important;
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Give browser a short tick to complete style & image layout before triggering print
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print()', err);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }
    }, 250);
  } catch (e) {
    console.error('Print helper error, invoking window.print() fallback', e);
    window.print();
  }
}
