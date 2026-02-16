/**
 * Build HTML content for message iframe
 * Separated to avoid PostCSS preprocessor issues
 */
export function buildIframeHtml(content: string): string {
  // Detect current theme mode
  const isDarkMode =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Theme-aware colors
  const textColor = isDarkMode ? '#f1f5f9' : '#18181b'; // zinc-50 for dark, zinc-900 for light
  const textColorSecondary = isDarkMode ? 'rgba(241,245,249,0.8)' : 'rgba(24,24,27,0.8)'; // zinc-50/80% for dark, zinc-900/80% for light
  const linkColor = isDarkMode ? '#60a5fa' : '#3b82f6'; // blue-400 for dark, blue-500 for light
  const forwardBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const forwardBg = isDarkMode ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.03)';
  const forwardPreambleBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const forwardPreambleText = isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(24,24,27,0.7)';

  const styleRules = [
    `body{font-family:system-ui,-apple-system,sans-serif;color:${textColor};margin:0;padding:0 1px;background-color:transparent;line-height:1.8;font-size:15px}`,
    `a{color:${linkColor};text-decoration:none;cursor:pointer}`,
    'a:hover{text-decoration:underline}',
    'p{margin:0 0 1.2em}',
    `.forward{border:1px solid ${forwardBorder};background-color:${forwardBg};padding:8px;border-radius:8px;margin:0}`,
    `.forward .preamble{font-size:12px;color:${forwardPreambleText};margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid ${forwardPreambleBorder}}`,
    `blockquote{border-left:3px solid ${linkColor};margin-left:0;padding-left:12px;color:${textColorSecondary}}`,
  ].join('');

  const scriptCode = [
    'document.addEventListener("click",function(e){',
    'let target=e.target;',
    'while(target&&target.tagName!=="A"){target=target.parentElement}',
    'if(target&&target.tagName==="A"&&target.href){',
    'e.preventDefault();e.stopPropagation();',
    'window.parent.postMessage({type:"openUrl",url:target.href},"*")',
    '}},true)',
  ].join('');

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<style>',
    styleRules,
    '</style>',
    '<script>',
    scriptCode,
    '</script>',
    '</head><body>',
    content,
    '</body></html>',
  ].join('');
}
