/**
 * Multi-strategy QR code scanner for maximum accuracy across environments.
 * Tries BarcodeDetector (ZXing), jsQR, and html5-qrcode with image preprocessing.
 */
import jsQR from 'jsqr';

type BarcodeDetectorLike = {
  new (options?: { formats?: string[] }): {
    detect(image: HTMLCanvasElement): Promise<Array<{ rawValue: string }>>;
  };
};

let BarcodeDetectorClass: BarcodeDetectorLike | null = null;
let Html5QrcodeClass: typeof import('html5-qrcode').Html5Qrcode | null = null;

async function getBarcodeDetector(): Promise<BarcodeDetectorLike | null> {
  if (BarcodeDetectorClass) return BarcodeDetectorClass;
  try {
    if ('BarcodeDetector' in window) {
      BarcodeDetectorClass = (window as unknown as { BarcodeDetector: BarcodeDetectorLike })
        .BarcodeDetector;
      return BarcodeDetectorClass;
    }
    const mod = await import('barcode-detector/ponyfill');
    BarcodeDetectorClass = mod.BarcodeDetector as BarcodeDetectorLike;
    return BarcodeDetectorClass;
  } catch {
    return null;
  }
}

async function getHtml5Qrcode(): Promise<typeof import('html5-qrcode').Html5Qrcode | null> {
  if (Html5QrcodeClass) return Html5QrcodeClass;
  try {
    const mod = await import('html5-qrcode');
    Html5QrcodeClass = mod.Html5Qrcode;
    return Html5QrcodeClass;
  } catch {
    return null;
  }
}

/** Load image file to ImageBitmap or HTMLImageElement for scanning */
async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Create canvas from image with optional resize and preprocessing */
function imageToCanvas(
  img: HTMLImageElement,
  options?: { maxDim?: number; grayscale?: boolean; contrast?: number },
): HTMLCanvasElement {
  const { maxDim = 0, grayscale = false, contrast = 1 } = options || {};
  let w = img.width;
  let h = img.height;
  if (maxDim > 0 && (w > maxDim || h > maxDim)) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  if (grayscale || contrast !== 1) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      if (grayscale) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = gray;
      }
      if (contrast !== 1) {
        r = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
        g = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
        b = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

/** Try BarcodeDetector API (native or polyfill with ZXing) */
async function scanWithBarcodeDetector(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  const BD = await getBarcodeDetector();
  if (!BD) return null;
  try {
    const detector = new BD({ formats: ['qr_code'] });
    const barcodes = await detector.detect(canvas);
    return barcodes.length > 0 ? barcodes[0].rawValue : null;
  } catch {
    return null;
  }
}

/** Try jsQR (pure JS, good for various lighting/contrast) */
function scanWithJsQR(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data ?? null;
}

/** Try html5-qrcode (fallback) */
async function scanWithHtml5Qrcode(file: File, elementId: string): Promise<string | null> {
  const Html5Qrcode = await getHtml5Qrcode();
  if (!Html5Qrcode) return null;
  try {
    const scanner = new Html5Qrcode(elementId);
    const result = await scanner.scanFile(file, false);
    await scanner.clear();
    return result || null;
  } catch {
    return null;
  }
}

/** Convert canvas to File for html5-qrcode */
function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(new File([blob], filename, { type: 'image/png' }));
        } else {
          reject(new Error('Canvas to blob failed'));
        }
      },
      'image/png',
      0.95,
    );
  });
}

/** Image variants to try (different sizes and preprocessing) */
const SCAN_VARIANTS = [
  { maxDim: 0, grayscale: false, contrast: 1 },
  { maxDim: 1600, grayscale: false, contrast: 1 },
  { maxDim: 1200, grayscale: false, contrast: 1 },
  { maxDim: 800, grayscale: false, contrast: 1 },
  { maxDim: 1200, grayscale: true, contrast: 1 },
  { maxDim: 1200, grayscale: false, contrast: 1.3 },
  { maxDim: 800, grayscale: true, contrast: 1.2 },
];

/**
 * Scan an image file for QR code using multiple strategies and image variants.
 * Returns the first successfully decoded QR code content, or null.
 */
export async function scanImageForQrCode(
  file: File,
  html5QrElementId: string = 'qr-reader-temp',
): Promise<string | null> {
  const img = await loadImage(file);

  // Strategy 1: BarcodeDetector (most accurate, ZXing-based)
  for (const variant of SCAN_VARIANTS) {
    const canvas = imageToCanvas(img, variant);
    const result = await scanWithBarcodeDetector(canvas);
    if (result) return result;
  }

  // Strategy 2: jsQR (different algorithm, good for difficult images)
  for (const variant of SCAN_VARIANTS) {
    const canvas = imageToCanvas(img, variant);
    const result = scanWithJsQR(canvas);
    if (result) return result;
  }

  // Strategy 3: html5-qrcode (try original and resized file)
  const result = await scanWithHtml5Qrcode(file, html5QrElementId);
  if (result) return result;

  const resizedFile = await canvasToFile(
    imageToCanvas(img, { maxDim: 1200 }),
    file.name,
  );
  return scanWithHtml5Qrcode(resizedFile, html5QrElementId);
}
