/**
 * Detect language identifier from file extension
 */
export function detectLanguageFromExtension(filepath = '') {
  if (!filepath) return 'text';
  const ext = filepath.split('.').pop().toLowerCase();
  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
    case 'avif':
    case 'tiff':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'py':
      return 'python';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'cpp':
    case 'c':
    case 'cc':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'rs':
      return 'rust';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'cs':
      return 'csharp';
    case 'dart':
      return 'dart';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'txt':
      return 'text';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'sql':
      return 'sql';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return ext ? ext.toUpperCase() : 'FILE';
  }
}
