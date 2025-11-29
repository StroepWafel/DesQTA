import DOMPurify from 'dompurify';
import { logger } from './logger';

/**
 * Centralized sanitization utilities for user input and HTML content
 */

// Configure DOMPurify with secure defaults
DOMPurify.setConfig({
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
});

// Add hook to make all links open in new tab
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitize HTML content for safe rendering
 */
export function sanitizeHtml(html: string, customConfig?: any): string {
  if (!html) return '';
  
  try {
    const sanitized = DOMPurify.sanitize(html, customConfig).toString();
    
    logger.debug('sanitization', 'sanitizeHtml', 'HTML sanitized', {
      originalLength: html.length,
      sanitizedLength: sanitized.length,
      removed: html.length - sanitized.length
    });
    
    return sanitized;
  } catch (error) {
    logger.error('sanitization', 'sanitizeHtml', 'Failed to sanitize HTML', { error });
    return ''; // Return empty string on error for safety
  }
}

/**
 * Sanitize user input text (for search queries, etc.)
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove HTML tags completely
  const withoutHtml = text.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  const sanitized = withoutHtml
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
  
  logger.debug('sanitization', 'sanitizeText', 'Text sanitized', {
    originalLength: text.length,
    sanitizedLength: sanitized.length
  });
  
  return sanitized;
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  const sanitized = query
    .trim()
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .replace(/\\/g, '') // Remove backslashes
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .substring(0, 500); // Limit length
  
  logger.debug('sanitization', 'sanitizeSearchQuery', 'Search query sanitized', {
    original: query,
    sanitized
  });
  
  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(urlObj.protocol)) {
      logger.warn('sanitization', 'sanitizeUrl', 'Blocked dangerous URL protocol', {
        url,
        protocol: urlObj.protocol
      });
      return null;
    }
    
    return urlObj.href;
  } catch (error) {
    logger.warn('sanitization', 'sanitizeUrl', 'Invalid URL', { url, error });
    return null;
  }
}

/**
 * Validate file upload
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedName?: string;
}

export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): FileValidationResult {
  const {
    maxSizeMB = 50, // Default 50MB
    allowedTypes = [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    allowedExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.pdf',
      '.doc', '.docx',
      '.xls', '.xlsx',
      '.txt', '.csv'
    ]
  } = options;

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    logger.warn('sanitization', 'validateFileUpload', 'File too large', {
      fileName: file.name,
      size: file.size,
      maxSize: maxSizeBytes
    });
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    logger.warn('sanitization', 'validateFileUpload', 'Invalid file type', {
      fileName: file.name,
      type: file.type
    });
    return {
      valid: false,
      error: 'File type not allowed'
    };
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    logger.warn('sanitization', 'validateFileUpload', 'Invalid file extension', {
      fileName: file.name,
      extension
    });
    return {
      valid: false,
      error: 'File extension not allowed'
    };
  }

  // Sanitize filename
  const sanitizedName = sanitizeFilename(file.name);

  logger.info('sanitization', 'validateFileUpload', 'File validated successfully', {
    originalName: file.name,
    sanitizedName,
    size: file.size,
    type: file.type
  });

  return {
    valid: true,
    sanitizedName
  };
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';
  
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  
  // Remove potentially dangerous characters
  sanitized = sanitized
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Windows forbidden chars
    .replace(/^\.+/, '') // Leading dots
    .trim();
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.length - (ext?.length || 0) - 1);
    sanitized = nameWithoutExt.substring(0, 250) + '.' + ext;
  }
  
  return sanitized || 'unnamed';
}

/**
 * Sanitize JSON data - remove potentially dangerous properties
 */
export function sanitizeJson<T>(data: T): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeJson(item)) as T;
  }

  const sanitized: any = {};
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  for (const [key, value] of Object.entries(data)) {
    // Skip dangerous keys
    if (dangerousKeys.includes(key.toLowerCase())) {
      logger.warn('sanitization', 'sanitizeJson', 'Blocked dangerous key', { key });
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeJson(value);
    } else if (typeof value === 'string') {
      // Sanitize string values
      sanitized[key] = sanitizeText(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Sanitize CSS - remove potentially dangerous CSS
 */
export function sanitizeCss(css: string): string {
  if (!css) return '';
  
  // Remove expressions, imports, and potentially dangerous functions
  const dangerous = [
    /expression\s*\(/gi,
    /@import/gi,
    /javascript:/gi,
    /behavior:/gi,
    /-moz-binding:/gi,
    /eval\(/gi
  ];
  
  let sanitized = css;
  dangerous.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
}

/**
 * Validate and sanitize base64 image data
 */
export function validateBase64Image(base64: string): { valid: boolean; error?: string } {
  if (!base64) return { valid: false, error: 'Empty data' };
  
  // Check if it's a valid base64 data URL
  const dataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
  if (!dataUrlPattern.test(base64)) {
    return { valid: false, error: 'Invalid image format' };
  }
  
  try {
    // Extract base64 part
    const base64Data = base64.split(',')[1];
    
    // Decode to check size
    const binaryString = atob(base64Data);
    const bytes = binaryString.length;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (bytes > maxSize) {
      return { valid: false, error: 'Image too large' };
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('sanitization', 'validateBase64Image', 'Failed to validate base64 image', { error });
    return { valid: false, error: 'Invalid base64 data' };
  }
}

export default {
  sanitizeHtml,
  sanitizeText,
  sanitizeSearchQuery,
  sanitizeUrl,
  validateFileUpload,
  sanitizeFilename,
  sanitizeJson,
  escapeHtml,
  sanitizeCss,
  validateBase64Image
};

