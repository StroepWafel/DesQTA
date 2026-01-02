/**
 * Build HTML content for message iframe
 * Separated to avoid PostCSS preprocessor issues
 */
export function buildIframeHtml(content: string): string {
  const styleRules = [
    'body{font-family:system-ui,-apple-system,sans-serif;color:#f1f5f9;margin:0;padding:0 1px;background-color:transparent;line-height:1.8;font-size:15px}',
    'a{color:#60a5fa;text-decoration:none;cursor:pointer}',
    'a:hover{text-decoration:underline}',
    'p{margin:0 0 1.2em}',
    '.forward{border:1px solid rgba(255,255,255,0.1);background-color:rgba(0,0,0,0.05);padding:8px;border-radius:8px;margin:0}',
    '.forward .preamble{font-size:12px;color:rgba(255,255,255,0.8);margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1)}',
    'blockquote{border-left:3px solid #3b82f6;margin-left:0;padding-left:12px;color:rgba(241,245,249,0.8)}'
  ].join('');
  
  const scriptCode = [
    'document.addEventListener("click",function(e){',
    'let target=e.target;',
    'while(target&&target.tagName!=="A"){target=target.parentElement}',
    'if(target&&target.tagName==="A"&&target.href){',
    'e.preventDefault();e.stopPropagation();',
    'window.parent.postMessage({type:"openUrl",url:target.href},"*")',
    '}},true)'
  ].join('');
  
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<style>', styleRules, '</style>',
    '<script>', scriptCode, '</script>',
    '</head><body>', content, '</body></html>'
  ].join('');
}
