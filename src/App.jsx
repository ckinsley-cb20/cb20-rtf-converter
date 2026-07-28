import React, { useState, useRef } from 'react';
import { Copy, Trash2, FileText, CheckCircle } from 'lucide-react';

export default function App() {
  const [plainText, setPlainText] = useState('');
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);

  // Custom DOM Parser to explicitly preserve lists, indents, and tables
  const parseHtmlToPlainText = (element) => {
    let text = '';
    
    const walk = (node, listDepth = 0, isInsideList = false) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        
        // Skip invisible tags
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return;

        // Differentiate between headers and standard text blocks
        const isHeader = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
        const isParagraph = ['p', 'div'].includes(tag);
        const isBlock = isHeader || isParagraph || tag === 'tr';
        
        // Add a newline BEFORE block elements
        if (isBlock && !isInsideList) {
          if (text.length > 0 && !text.endsWith('\n')) text += '\n';
          
          if (isHeader && text.length > 0 && !text.endsWith('\n\n')) {
            text += '\n';
          }
        }

        // Check for CSS indentations
        if (node.style?.marginLeft || node.style?.paddingLeft) {
          text += '\t'; 
        }

        if (tag === 'br') {
          text += '\n';
        } else if (tag === 'td' || tag === 'th') {
          Array.from(node.childNodes).forEach(child => walk(child, listDepth, isInsideList));
          text += '\t';
          return;
        } else if (tag === 'ul' || tag === 'ol') {
          if (!text.endsWith('\n')) text += '\n';
          Array.from(node.childNodes).forEach(child => walk(child, listDepth + 1, true));
          if (!text.endsWith('\n')) text += '\n';
          return; 
        } else if (tag === 'li') {
          const isOrdered = node.parentNode?.tagName?.toLowerCase() === 'ol';
          const siblings = Array.from(node.parentNode?.children || []).filter(n => n.tagName?.toLowerCase() === 'li');
          const index = siblings.indexOf(node) + 1;
          
          const indent = '    '.repeat(Math.max(0, listDepth - 1));
          const bullet = isOrdered ? `${index}. ` : '• ';
          
          if (!text.endsWith('\n')) text += '\n';
          text += indent + bullet;
          
          Array.from(node.childNodes).forEach(child => walk(child, listDepth, true));
          return;
        }

        // Recurse through all other children
        Array.from(node.childNodes).forEach(child => walk(child, listDepth, isInsideList));

        // Add a newline AFTER block elements
        if (isBlock && !isInsideList) {
          if (!text.endsWith('\n')) text += '\n';
          
          if (isParagraph && !text.endsWith('\n\n')) {
            text += '\n';
          }
        }
      }
    };

    walk(element);
    
    // --- NEW POST-PROCESSING CLEANUP ---
    
    // 1. Remove trailing spaces and tabs from the end of every single line
    text = text.replace(/[ \t]+$/gm, '');
    
    // 2. Remove completely blank lines that just contain hidden spaces or tabs
    text = text.replace(/^[ \t]+$/gm, '');
    
    // 3. Clean up weird Microsoft Word bullets (e.g., changing "o    " to just "o ")
    text = text.replace(/^([o•\-])[ \t]+/gm, '$1 ');

    // 4. Replace 3+ blank lines with a standard double space, and trim the ends
    return text.replace(/\n{3,}/g, '\n\n').trim();
  };

  const handleInput = () => {
    if (editorRef.current) {
      setPlainText(parseHtmlToPlainText(editorRef.current));
    }
  };

  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setPlainText('');
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 flex items-center space-x-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">RTF to PTF Converter</h1>
        </header>

        {/* Main Interface */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Rich Text Input Box */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">1. Paste Rich Text</h2>
              <button 
                onClick={handleClear}
                className="text-gray-400 hover:text-red-500 transition-colors flex items-center text-sm"
                title="Clear contents"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </button>
            </div>
            
            <div
              ref={editorRef}
              onInput={handleInput}
              contentEditable
              className="flex-grow p-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto"
              placeholder="Paste your formatted Word document, email, or web text here..."
              style={{ minHeight: '150px' }}
            />
          </div>

          {/* Plain Text Output Box */}
          <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">2. Copy Plain Text</h2>
              <button 
                onClick={handleCopy}
                disabled={!plainText}
                className={`flex items-center text-sm px-3 py-1.5 rounded transition-colors ${
                  plainText 
                    ? copied ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {copied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>

            <textarea
              readOnly
              value={plainText}
              className="flex-grow p-4 border border-gray-300 rounded bg-white focus:outline-none resize-none overflow-y-auto font-mono text-sm whitespace-pre-wrap"
              placeholder="Your stripped, plain text will appear here instantly..."
            />
          </div>

        </div>

      </div>
    </div>
  );
}