import { AVAILABLE_LIBRARIES } from './libraries';
import { TaskLanguage } from './types';

export interface BuildSandboxOptions {
  language: TaskLanguage;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  pythonCode: string;
  libraries: string[];
  initialState?: Record<string, any>;
}

export function buildSandboxHtml(options: BuildSandboxOptions): string {
  const { language, htmlCode, cssCode, jsCode, pythonCode, libraries, initialState } = options;

  const selectedLibs = AVAILABLE_LIBRARIES.filter((lib) => libraries.includes(lib.id));

  const scriptTags = selectedLibs
    .flatMap((lib) => lib.scripts)
    .map((src) => `<script src="${src}" crossorigin="anonymous"></script>`)
    .join('\n');

  const styleTags = selectedLibs
    .flatMap((lib) => lib.styles || [])
    .map((href) => `<link rel="stylesheet" href="${href}" crossorigin="anonymous" />`)
    .join('\n');

  // Bridge script: the ONLY channel out of the sandbox is postMessage with a fixed
  // set of message types (score / state-save / console-log / time-tick). The parent
  // page's message listener (StudentPracticePage.tsx) only reacts to these types —
  // never eval, never DOM access into the parent.
  const bridgeScript = `
    <script>
      (function() {
        function sendToParent(data) {
          try {
            window.parent.postMessage(data, '*');
          } catch(e) {
            console.error('[App2Class Sandbox] postMessage error:', e);
          }
        }

        var originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
          info: console.info
        };

        function formatArg(arg) {
          if (arg === undefined) return 'undefined';
          if (arg === null) return 'null';
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch(e) {
              return String(arg);
            }
          }
          return String(arg);
        }

        ['log', 'warn', 'error', 'info'].forEach(function(level) {
          console[level] = function() {
            var args = Array.prototype.slice.call(arguments).map(formatArg);
            originalConsole[level].apply(console, arguments);

            if (level === 'warn' && args.some(function(a) { return String(a).indexOf('cdn.tailwindcss.com') !== -1; })) {
              return;
            }

            sendToParent({
              type: 'console-log',
              level: level,
              args: args,
              timestamp: new Date().toISOString()
            });
          };
        });

        window.onerror = function(message, source, lineno, colno, error) {
          var errorStr = String(message) + (lineno ? ' (Line ' + lineno + ')' : '');
          sendToParent({
            type: 'console-log',
            level: 'error',
            args: [errorStr],
            line: lineno,
            col: colno,
            timestamp: new Date().toISOString()
          });
          return false;
        };

        window.onunhandledrejection = function(event) {
          var reason = event.reason ? (event.reason.message || event.reason) : 'Unhandled Promise Rejection';
          sendToParent({
            type: 'console-log',
            level: 'error',
            args: ['Uncaught (in promise): ' + reason],
            timestamp: new Date().toISOString()
          });
        };

        // App2Class SDK exposed to task code (teacher's JS or Python via the pyWrapper below)
        var stateLoadListeners = [];
        window.App2Class = {
          submitScore: function(score, total) {
            total = total || 100;
            sendToParent({
              type: 'score',
              score: Number(score),
              total: Number(total)
            });
          },
          saveState: function(stateData) {
            sendToParent({
              type: 'state-save',
              state: stateData
            });
          },
          onLoadState: function(callback) {
            if (typeof callback === 'function') {
              stateLoadListeners.push(callback);
              if (window.__INITIAL_STATE__) {
                callback(window.__INITIAL_STATE__);
              }
            }
          }
        };

        window.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'state-load') {
            window.__INITIAL_STATE__ = event.data.state;
            stateLoadListeners.forEach(function(listener) {
              try { listener(event.data.state); } catch(err) { console.error('Error in state load listener:', err); }
            });
          }
        });

        window.__INITIAL_STATE__ = ${JSON.stringify(initialState || null)};

        // Time-on-task hook: injected automatically, not dependent on the teacher's own code
        var secondsActive = 0;
        setInterval(function() {
          if (!document.hidden) {
            secondsActive += 10;
            sendToParent({
              type: 'time-tick',
              seconds: secondsActive
            });
          }
        }, 10000);
      })();
    </script>
  `;

  if (language === 'python') {
    let pythonTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App2Class Python Sandbox</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${styleTags}
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background-color: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      box-sizing: border-box;
    }
    #python-output {
      font-family: 'Fira Code', 'Courier New', Courier, monospace;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px;
      min-height: 180px;
      white-space: pre-wrap;
      color: #38bdf8;
      overflow-x: auto;
      margin-top: 12px;
    }
    #loading-pyodide {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #38bdf8;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    /* __CUSTOM_CSS__ */
  </style>
  ${bridgeScript}
  ${scriptTags}
  <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
</head>
<body>
  <div id="loading-pyodide">
    <div class="spinner"></div>
    <span>טוען סביבת הרצה Python (Pyodide WASM)...</span>
  </div>

  <div id="python-canvas-container"></div>
  <div id="python-output">ממתין להרצת הקוד...</div>

  <!-- __HTML_CODE__ -->

  <script id="python-source" type="text/python">
/* __PYTHON_CODE__ */
  </script>

  <script>
    async function runPython() {
      const outputEl = document.getElementById('python-output');
      const loaderEl = document.getElementById('loading-pyodide');
      try {
        let pyodide = await loadPyodide({
          stdout: (text) => {
            console.log(text);
            if (outputEl) outputEl.innerText += text + '\\n';
          },
          stderr: (text) => {
            console.error(text);
            if (outputEl) outputEl.innerText += '[שגיאה] ' + text + '\\n';
          }
        });

        if (loaderEl) loaderEl.style.display = 'none';
        if (outputEl) outputEl.innerText = '';

        pyodide.globals.set('js_app2class', window.App2Class);

        const userPythonSource = document.getElementById('python-source').textContent;

        const pyWrapper = \`
import sys
import js

class App2ClassPython:
    @staticmethod
    def submit_score(score, total=100):
        js.js_app2class.submitScore(score, total)

    @staticmethod
    def save_state(state_dict):
        import json
        js.js_app2class.saveState(json.dumps(state_dict))

App2Class = App2ClassPython()

\` + userPythonSource;

        await pyodide.runPythonAsync(pyWrapper);
      } catch (err) {
        if (loaderEl) loaderEl.style.display = 'none';
        if (outputEl) outputEl.innerText += '\\n[שגיאת הרצה Python]:\\n' + (err.message || err);
        console.error('Python Error:', err);
      }
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', runPython);
    } else {
      runPython();
    }
  </script>
</body>
</html>`;

    let result = pythonTemplate.replace('/* __CUSTOM_CSS__ */', () => cssCode || '');
    result = result.replace('<!-- __HTML_CODE__ -->', () => htmlCode || '');
    result = result.replace('/* __PYTHON_CODE__ */', () => pythonCode || '');
    return result;
  }

  const hasTailwindInLibs = libraries.includes('tailwindcss');
  const tailwindScript = !hasTailwindInLibs ? '<script src="https://cdn.tailwindcss.com"></script>' : '';

  let webTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App2Class Interactive Task</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">
  ${tailwindScript}
  ${styleTags}
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Rubik', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    /* __CUSTOM_CSS__ */
  </style>
  ${bridgeScript}
  ${scriptTags}
</head>
<body>
  <!-- __HTML_CODE__ -->

  <script>
    /* __JS_CODE__ */
  </script>
</body>
</html>`;

  // Sanitize JS so it can't break out of the inline <script> tag early
  const safeJsCode = (jsCode || '').replace(/<\/script>/gi, '<\\/script>');

  let result = webTemplate.replace('/* __CUSTOM_CSS__ */', () => cssCode || '');
  result = result.replace('<!-- __HTML_CODE__ -->', () => htmlCode || '');
  result = result.replace('/* __JS_CODE__ */', () => safeJsCode);

  return result;
}
