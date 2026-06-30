import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, GitBranch, Key, Folder, Link } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { importRepo, importLocalRepo, importLoading, selectRepo } = useStore();
  const [importType, setImportType] = useState<'git' | 'local'>('git');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a name');
      return;
    }

    try {
      let repo;
      if (importType === 'git') {
        if (!url.trim()) {
          setError('Please provide a GitHub URL');
          return;
        }
        repo = await importRepo(name, url, branch, token);
      } else {
        if (!localPath.trim()) {
          setError('Please provide a local folder path');
          return;
        }
        repo = await importLocalRepo(name, localPath);
      }
      
      selectRepo(repo);
      onClose();
      // Reset forms
      setName('');
      setUrl('');
      setBranch('main');
      setToken('');
      setLocalPath('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during import');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 rounded-xl shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        <h3 className="text-xl font-bold mb-4 text-white">Import Repository</h3>

        {/* Tabs */}
        <div className="flex bg-slate-900/60 p-1 rounded-lg mb-6 border border-white/5">
          <button
            onClick={() => setImportType('git')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
              importType === 'git' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link size={14} /> GitHub Repo
          </button>
          <button
            onClick={() => setImportType('local')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
              importType === 'local' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder size={14} /> Local Folder
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Project Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. spring-petclinic"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            />
          </div>

          {importType === 'git' ? (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/repo"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <GitBranch size={12} /> Branch
                  </label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Key size={12} /> Auth Token (PAT)
                  </label>
                  <input
                    type="password"
                    placeholder="ghp_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Local Absolute Path
              </label>
              <input
                type="text"
                required
                placeholder="/absolute/path/to/project"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Make sure the path is accessible to the backend runner.
              </span>
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={importLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-semibold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Importing & Cloning...
              </span>
            ) : (
              'Start Import & Parsing'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
