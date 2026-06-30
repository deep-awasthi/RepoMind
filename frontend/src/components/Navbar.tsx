import React, { useEffect, useState } from 'react';
import { useStore, Repository } from '../store/useStore';
import { Plus, Search, BarChart3, Download, RefreshCw, AlertTriangle, Cpu, Terminal } from 'lucide-react';

interface NavbarProps {
  onOpenImport: () => void;
  onToggleDashboard: () => void;
  showDashboard: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenImport, onToggleDashboard, showDashboard }) => {
  const { 
    repos, 
    selectedRepo, 
    selectRepo, 
    fetchRepos, 
    graph, 
    setSelectedNode,
    searchQuery,
    setSearchQuery
  } = useStore();

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Poll status of active repo if cloning or parsing
  useEffect(() => {
    fetchRepos();
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    if (selectedRepo.status === 'PENDING' || selectedRepo.status === 'CLONING' || selectedRepo.status === 'PARSING') {
      const interval = setInterval(async () => {
        const res = await fetch(`http://localhost:8080/api/repositories/${selectedRepo.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== selectedRepo.status) {
            // Status changed, reload repos
            fetchRepos();
            // Update selected repo ref
            const updatedRepo = { ...selectedRepo, status: data.status, errorMessage: data.errorMessage };
            selectRepo(updatedRepo);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedRepo]);

  // Search autocomplete logic
  useEffect(() => {
    if (!searchQuery.trim() || !graph.nodes) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = graph.nodes.filter(node => {
      const name = node.properties.name.toLowerCase();
      const fullName = (node.properties.fullName || '').toLowerCase();
      const endpoint = (node.properties.endpoint || '').toLowerCase();
      const annotations = (node.properties.annotations || []).map(a => a.toLowerCase());
      
      return name.includes(q) || 
             fullName.includes(q) || 
             endpoint.includes(q) || 
             annotations.some(a => a.includes(q));
    }).slice(0, 8); // Limit to 8 results

    setSearchResults(matches);
  }, [searchQuery, graph.nodes]);

  const handleSelectRepo = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    if (!id) {
      selectRepo(null);
      return;
    }
    const repo = repos.find(r => r.id === id);
    if (repo) selectRepo(repo);
  };

  const handleExport = (type: 'json' | 'mermaid' | 'plantuml') => {
    if (!selectedRepo || !graph.nodes.length) return;
    
    let content = '';
    let filename = `${selectedRepo.name}-graph.json`;
    let mimeType = 'application/json';

    if (type === 'json') {
      content = JSON.stringify(graph, null, 2);
    } else if (type === 'mermaid') {
      filename = `${selectedRepo.name}-graph.mermaid`;
      mimeType = 'text/plain';
      content = 'graph TD\n';
      // Map node colors by label
      graph.nodes.forEach(n => {
        content += `  ${n.id.replace(/:/g, '_')}["${n.properties.name} (${n.label})"]\n`;
      });
      graph.edges.forEach(e => {
        content += `  ${e.source.replace(/:/g, '_')} -->|${e.type}| ${e.target.replace(/:/g, '_')}\n`;
      });
    } else if (type === 'plantuml') {
      filename = `${selectedRepo.name}-graph.puml`;
      mimeType = 'text/plain';
      content = '@startuml\n';
      graph.nodes.forEach(n => {
        content += `class "${n.properties.name}" as ${n.id.replace(/:/g, '_')} << ${n.label} >>\n`;
      });
      graph.edges.forEach(e => {
        content += `${e.source.replace(/:/g, '_')} --> ${e.target.replace(/:/g, '_')} : ${e.type}\n`;
      });
      content += '@enduml\n';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAILED': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CLONING':
      case 'PARSING': return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <nav className="glass-panel h-16 border-b border-slate-200 flex items-center justify-between px-6 z-40 relative">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/25">
            <Cpu className="text-white" size={18} />
          </div>
          <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
            REPOMIND
          </span>
        </div>

        {/* Repo Selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedRepo?.id || ''}
            onChange={handleSelectRepo}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 max-w-[200px] shadow-sm"
          >
            <option value="">Select a repository...</option>
            {repos.map(repo => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>

          {selectedRepo && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${getStatusColor(selectedRepo.status)}`}>
              {selectedRepo.status === 'CLONING' || selectedRepo.status === 'PARSING' ? (
                <RefreshCw size={10} className="animate-spin" />
              ) : selectedRepo.status === 'FAILED' ? (
                <AlertTriangle size={10} />
              ) : null}
              {selectedRepo.status}
            </span>
          )}
        </div>
      </div>

      {/* Global Search */}
      {selectedRepo && selectedRepo.status === 'COMPLETED' && (
        <div className="flex-1 max-w-md mx-6 relative">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search files, classes, methods, endpoints..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors placeholder-slate-400 shadow-sm"
            />
          </div>

          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-11 left-0 right-0 glass-panel rounded-lg shadow-lg p-2 border border-slate-200 max-h-80 overflow-y-auto z-50">
              <div className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">Search Results</div>
              {searchResults.map(node => (
                <button
                  key={node.id}
                  onClick={() => {
                    setSelectedNode(node);
                    setShowSearchDropdown(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-sm text-slate-700 font-medium truncate group-hover:text-indigo-600 transition-colors">
                      {node.properties.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {node.properties.fullName || node.properties.path || node.properties.endpoint}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                    node.label === 'File' ? 'text-cyan-700 bg-cyan-50 border-cyan-200' :
                    node.label === 'Class' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                    node.label === 'Method' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                    node.label === 'Endpoint' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-50 border-slate-200'
                  }`}>
                    {node.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {selectedRepo && selectedRepo.status === 'COMPLETED' && (
          <>
            <button
              onClick={onToggleDashboard}
              className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm font-semibold ${
                showDashboard 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/25' 
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm'
              }`}
            >
              <BarChart3 size={16} />
              Dashboard
            </button>

            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all flex items-center justify-center gap-2 text-sm font-semibold shadow-sm"
              >
                <Download size={16} />
                Export
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-11 glass-panel w-44 rounded-lg shadow-lg p-1.5 border border-slate-200 z-50">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors"
                  >
                    Export JSON Graph
                  </button>
                  <button
                    onClick={() => handleExport('mermaid')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors"
                  >
                    Export Mermaid
                  </button>
                  <button
                    onClick={() => handleExport('plantuml')}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors"
                  >
                    Export PlantUML
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <button
          onClick={onOpenImport}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          Import Repo
        </button>
      </div>
    </nav>
  );
};
