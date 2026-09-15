import React, { useState, useRef } from 'react';
import { Copy, Trash2, FileText, CheckCircle, List, ListOrdered, ChevronRight, ChevronLeft } from 'lucide-react';

export default function App() {
  const [plainText, setPlainText] = useState('');
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);
  const plainTextRef = useRef(null);

  // Custom DOM Parser to explicitly preserve lists, indents, and tables
  const parseHtmlToPlainText = (element) => {
    let text = '';
    let currentHangingIndent = '';
    
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
          text += '\n' + currentHangingIndent;
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
          
          const previousHangingIndent = currentHangingIndent;
          currentHangingIndent = indent + ' '.repeat(bullet.length);

          Array.from(node.childNodes).forEach(child => walk(child, listDepth, true));
          
          currentHangingIndent = previousHangingIndent;
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
        } else if (isBlock && isInsideList) {
          // Keep internal blocks aligned within list items
          if (!text.endsWith('\n')) text += '\n' + currentHangingIndent;
        }
      }
    };

    walk(element);
    
    // --- POST-PROCESSING CLEANUP ---
    text = text.replace(/[ \t]+$/gm, '');
    text = text.replace(/^[ \t]+$/gm, '');
    text = text.replace(/^([o•\-])[ \t]+/gm, '$1 ');
    return text.replace(/\n{3,}/g, '\n\n').trim();
  };

  const handleInput = () => {
    if (editorRef.current) {
      setPlainText(parseHtmlToPlainText(editorRef.current));
    }
  };

  // Handles manual typing in the plain text box
  const handlePlainTextChange = (e) => {
    setPlainText(e.target.value);
  };

  // Handles formatting buttons (UL, OL, Indent, Outdent)
  const handleFormat = (type) => {
    const textarea = plainTextRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Find the bounds of the selected lines
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;

    const selectedLines = value.substring(lineStart, lineEnd).split('\n');
    let modifiedLines = [];

    if (type === 'indent') {
      modifiedLines = selectedLines.map(line => '    ' + line);
    } else if (type === 'outdent') {
      modifiedLines = selectedLines.map(line => line.replace(/^ {1,4}/, ''));
    } else if (type === 'ul') {
      modifiedLines = selectedLines.map(line => {
        const match = line.match(/^(\s*)(?:[•\-o]|\d+\.)\s+(.*)$/);
        if (match) return `${match[1]}• ${match[2]}`;
        return `• ${line}`;
      });
    } else if (type === 'ol') {
      modifiedLines = selectedLines.map((line, index) => {
        const match = line.match(/^(\s*)(?:[•\-o]|\d+\.)\s+(.*)$/);
        if (match) return `${match[1]}${index + 1}. ${match[2]}`;
        return `${index + 1}. ${line}`;
      });
    }

    const replacement = modifiedLines.join('\n');
    const newValue = value.substring(0, lineStart) + replacement + value.substring(lineEnd);
    
    setPlainText(newValue);

    const spacesAdded = replacement.length - (lineEnd - lineStart);

    // Restore focus and selection range properly based on if it was a selection or a standard cursor
    setTimeout(() => {
      textarea.focus();
      if (start !== end) {
        // If it was a multi-line selection, keep the block highlighted
        textarea.setSelectionRange(lineStart, lineStart + replacement.length);
      } else {
        // If it was a single cursor point, just shift the cursor appropriately
        const newPos = Math.max(lineStart, start + spacesAdded);
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Smart formatting: Auto-generates bullets/numbers on Enter, and handles Tab spacing
  const handlePlainTextKeyDown = (e) => {
    const { selectionStart, selectionEnd, value } = e.target;

    if (e.key === 'Tab') {
      e.preventDefault();
      // Use the format handler for tabs so it handles multi-line selections perfectly
      handleFormat(e.shiftKey ? 'outdent' : 'indent');
    } else if (e.key === 'Enter') {
      const textBeforeCursor = value.substring(0, selectionStart);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      const bulletMatch = currentLine.match(/^(\s*)([•\-o])\s+(.*)$/);
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      const indentMatch = currentLine.match(/^(\s+)/);

      if (e.shiftKey) {
        e.preventDefault();
        let hangingIndent = '';
        
        // Calculate exact space needed to align under the current bullet or number
        if (bulletMatch) {
          hangingIndent = ' '.repeat(bulletMatch[1].length + bulletMatch[2].length + 1);
        } else if (numberMatch) {
          hangingIndent = ' '.repeat(numberMatch[1].length + numberMatch[2].length + 2);
        } else if (indentMatch) {
          hangingIndent = indentMatch[1];
        }

        const insertText = `\n${hangingIndent}`;
        const newValue = value.substring(0, selectionStart) + insertText + value.substring(selectionEnd);
        setPlainText(newValue);
        setTimeout(() => {
          e.target.selectionStart = e.target.selectionEnd = selectionStart + insertText.length;
        }, 0);
        return;
      }

      if (bulletMatch || numberMatch) {
        e.preventDefault();
        const indent = bulletMatch ? bulletMatch[1] : numberMatch[1];
        const content = bulletMatch ? bulletMatch[3] : numberMatch[3];
        
        if (!content) {
          const newValue = value.substring(0, selectionStart - currentLine.length) + value.substring(selectionEnd);
          setPlainText(newValue);
          setTimeout(() => {
            e.target.selectionStart = e.target.selectionEnd = selectionStart - currentLine.length;
          }, 0);
          return;
        }

        let nextMarker = '';
        if (bulletMatch) {
          nextMarker = `${bulletMatch[2]} `;
        } else {
          const nextNum = parseInt(numberMatch[2], 10) + 1;
          nextMarker = `${nextNum}. `;
        }

        const insertText = `\n${indent}${nextMarker}`;
        const newValue = value.substring(0, selectionStart) + insertText + value.substring(selectionEnd);
        setPlainText(newValue);
        setTimeout(() => {
          e.target.selectionStart = e.target.selectionEnd = selectionStart + insertText.length;
        }, 0);
      }
    }
  };

  // Intercept pasting into the plain text area to auto-indent multiple lines 
  // so they line up perfectly under your current bullet!
  const handlePlainTextPaste = (e) => {
    const { selectionStart, selectionEnd, value } = e.target;
    const pastedText = e.clipboardData.getData('text');
    
    // Check if we are currently indented (e.g. inside a bullet)
    const textBeforeCursor = value.substring(0, selectionStart);
    const linesBefore = textBeforeCursor.split('\n');
    const currentLine = linesBefore[linesBefore.length - 1];
    
    const indentMatch = currentLine.match(/^(\s+)/);
    
    // If we are indented, and we are pasting multiple lines, we need to format them
    if (indentMatch && pastedText.includes('\n')) {
      e.preventDefault();
      const indent = indentMatch[1];
      
      // Split pasted text and indent all lines AFTER the first one
      const pastedLines = pastedText.split('\n');
      const indentedPastedText = pastedLines.map((line, i) => i === 0 ? line : indent + line).join('\n');
      
      const newValue = value.substring(0, selectionStart) + indentedPastedText + value.substring(selectionEnd);
      setPlainText(newValue);
      
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = selectionStart + indentedPastedText.length;
      }, 0);
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
      // Secure context approach first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(plainText);
      } else {
        // Fallback for non-secure contexts or permission blocked issues
        const textArea = document.createElement("textarea");
        textArea.value = plainText;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
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
              contentEditable={true}
              className="flex-grow p-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto empty:before:content-[attr(placeholder)] empty:before:text-gray-400"
              placeholder="Paste your formatted Word document, email, or web text here..."
              style={{ minHeight: '150px' }}
            ></div>
          </div>

          {/* Plain Text Output Box */}
          <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">2. Edit & Copy Plain Text</h2>
              <div className="flex items-center">
                
                {/* Editing Toolbar */}
                <div className="flex items-center bg-white border border-gray-300 rounded overflow-hidden mr-3">
                  <button onClick={() => handleFormat('ul')} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600 transition-colors" title="Bulleted List">
                    <List className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleFormat('ol')} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600 transition-colors" title="Numbered List">
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleFormat('outdent')} className="p-1.5 hover:bg-gray-100 border-r border-gray-300 text-gray-600 transition-colors" title="Decrease Indent">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleFormat('indent')} className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors" title="Increase Indent">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

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
            </div>

            <textarea
              ref={plainTextRef}
              value={plainText}
              onChange={handlePlainTextChange}
              onKeyDown={handlePlainTextKeyDown}
              onPaste={handlePlainTextPaste}
              className="flex-grow p-4 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto font-mono text-sm whitespace-pre-wrap"
              placeholder="Your stripped, plain text will appear here instantly. You can also type and edit directly in this box!"
            ></textarea>
          </div>

        </div>

      </div>
    </div>
  );
}