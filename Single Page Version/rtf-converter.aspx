<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rich Text to Plain Text Converter</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React 18 & Babel for single-file browser execution -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-slate-100 min-h-screen text-slate-800 font-sans antialiased p-4 md:p-8">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useRef } = React;

    // Core HTML DOM to Clean Plain Text Parser
    function convertHtmlToPlainText(htmlContent, fallbackText) {
      if (!htmlContent) return fallbackText || "";

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      function processNode(node, depth = 0) {
        let result = "";

        node.childNodes.forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent;
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();

            if (tagName === 'br') {
              result += "\n";
            } else if (tagName === 'p' || tagName === 'div') {
              const text = processNode(child, depth).trim();
              if (text) {
                result += (result && !result.endsWith('\n') ? "\n" : "") + text + "\n";
              }
            } else if (tagName === 'ul' || tagName === 'ol') {
              let itemCounter = 1;
              const isOrdered = tagName === 'ol';

              child.childNodes.forEach((li) => {
                if (li.nodeType === Node.ELEMENT_NODE && li.tagName.toLowerCase() === 'li') {
                  const indent = "    ".repeat(depth);
                  const prefix = isOrdered ? `${itemCounter}. ` : "• ";
                  const itemText = processNode(li, depth + 1).trim();
                  
                  if (itemText) {
                    result += (result && !result.endsWith('\n') ? "\n" : "") + indent + prefix + itemText + "\n";
                    itemCounter++;
                  }
                }
              });
            } else if (tagName === 'table') {
              const rows = child.querySelectorAll('tr');
              rows.forEach((row) => {
                const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim());
                if (cells.length > 0) {
                  result += (result && !result.endsWith('\n') ? "\n" : "") + cells.join("\t") + "\n";
                }
              });
            } else if (tagName === 'tr' || tagName === 'td' || tagName === 'th') {
              result += processNode(child, depth);
            } else {
              result += processNode(child, depth);
            }
          }
        });

        return result;
      }

      let text = processNode(doc.body);

      // Clean up common web/clipboard artifacts
      text = text
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return text;
    }

    function RtfConverterApp() {
      const [text, setText] = useState("");
      const [copied, setCopied] = useState(false);
      const textareaRef = useRef(null);

      // Intercept paste to clean rich text HTML
      const handlePaste = (e) => {
        const htmlData = e.clipboardData.getData('text/html');
        const plainData = e.clipboardData.getData('text/plain');

        if (htmlData) {
          e.preventDefault();
          const cleanText = convertHtmlToPlainText(htmlData, plainData);
          
          const textarea = textareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = text.substring(0, start) + cleanText + text.substring(end);
          
          setText(newText);
          
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + cleanText.length;
          }, 0);
        }
      };

      // Keyboard shortcuts for Tab indentation and Enter auto-bullets
      const handleKeyDown = (e) => {
        const textarea = textareaRef.current;
        const { selectionStart, selectionEnd } = textarea;

        // Tab / Shift+Tab (Indent / Outdent)
        if (e.key === 'Tab') {
          e.preventDefault();
          const tabStr = "    ";

          if (e.shiftKey) {
            const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
            if (text.substring(lineStart, lineStart + 4) === tabStr) {
              const updated = text.substring(0, lineStart) + text.substring(lineStart + 4);
              setText(updated);
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, selectionStart - 4);
              }, 0);
            }
          } else {
            const updated = text.substring(0, selectionStart) + tabStr + text.substring(selectionEnd);
            setText(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart + 4;
            }, 0);
          }
        }

        // Enter key for list continuation or soft returns
        if (e.key === 'Enter') {
          const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
          const currentLine = text.substring(lineStart, selectionStart);
          const bulletMatch = currentLine.match(/^(\s*)(•|-|\*|\d+\.)\s+/);
          
          if (bulletMatch && !e.shiftKey) {
            e.preventDefault();
            const indent = bulletMatch[1];
            const symbol = bulletMatch[2];
            
            let nextSymbol = symbol;
            if (/^\d+\.$/.test(symbol)) {
              nextSymbol = `${parseInt(symbol, 10) + 1}.`;
            }

            const prefix = `\n${indent}${nextSymbol} `;
            const updated = text.substring(0, selectionStart) + prefix + text.substring(selectionEnd);
            setText(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart + prefix.length;
            }, 0);
          } else if (e.shiftKey && bulletMatch) {
            // Shift + Enter: Aligned soft return
            e.preventDefault();
            const indent = bulletMatch[1] + "  ";
            const prefix = `\n${indent}`;
            const updated = text.substring(0, selectionStart) + prefix + text.substring(selectionEnd);
            setText(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart + prefix.length;
            }, 0);
          }
        }
      };

      const copyToClipboard = () => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      };

      const clearText = () => {
        setText("");
      };

      const charCount = text.length;
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const lineCount = text ? text.split('\n').length : 0;

      return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-tight">Rich Text to Plain Text Converter</h1>
            <p className="text-slate-400 text-sm mt-1">
              Paste formatted text from Word, Outlook, Teams, or Excel to convert to clean plain text.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center justify-between text-xs font-medium text-slate-700">
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition"
              >
                {copied ? "Copied!" : "Copy Clean Text"}
              </button>
              <button
                onClick={clearText}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
              >
                Clear
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-slate-500">
              <span>Lines: <strong className="text-slate-800">{lineCount}</strong></span>
              <span>Words: <strong className="text-slate-800">{wordCount}</strong></span>
              <span>Chars: <strong className="text-slate-800">{charCount}</strong></span>
            </div>
          </div>

          {/* Text Area */}
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Paste formatted rich text or spreadsheets here..."
              className="w-full h-96 p-4 font-mono text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition resize-y"
            ></textarea>
          </div>

          {/* Shortcuts Legend */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
            <span>Shortcut: <strong>Tab</strong> / <strong>Shift+Tab</strong> to indent or outdent</span>
            <span>Shortcut: <strong>Shift+Enter</strong> for indented soft return</span>
          </div>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<RtfConverterApp />);
  </script>
</body>
</html>
