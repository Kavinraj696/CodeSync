/**
 * Detect language identifier from file extension
 */
export function detectLanguageFromExtension(filepath = '') {
  if (!filepath) return 'javascript';
  const ext = filepath.split('.').pop().toLowerCase();
  switch (ext) {
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
      return 'css';
    case 'json':
      return 'json';
    default:
      return 'javascript';
  }
}
