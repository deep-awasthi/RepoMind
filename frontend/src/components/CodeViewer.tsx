import React from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../store/useStore';
import { X, Code2, Copy, Check } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const { activeCode, activeCodePath, activeCodeLang, closeCodeViewer } = useStore();
  const [copied, setCopied] = React.useState(false);

  if (!activeCodePath) return null;

  const handleCopy = () => {
    if (activeCode) {
      navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-96 border-t glass-panel flex flex-col z-35 relative">
      {/* Editor Header */}
      <div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-indigo-400" />
          <span className="text-xs font-mono text-slate-300 truncate max-w-xl">
            {activeCodePath}
          </span>
          <span className="text-[10px] bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-slate-500 uppercase font-mono">
            {activeCodeLang}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={closeCodeViewer}
            className="text-slate-400 hover:text-rose-400 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Editor Workspace */}
      <div className="flex-1 overflow-hidden relative">
        {activeCode !== null ? (
          <Editor
            height="100%"
            language={activeCodeLang}
            theme="vs-dark"
            value={activeCode}
            options={{
              readOnly: true,
              fontSize: 12,
              fontFamily: 'Fira Code, Menlo, Monaco, Consolas, monospace',
              minimap: { enabled: true },
              automaticLayout: true,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 8, bottom: 8 }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-950/40">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading file source...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
