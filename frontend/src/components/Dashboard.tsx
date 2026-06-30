import React from 'react';
import { useStore } from '../store/useStore';
import { 
  BarChart3, FileCode2, Code, Terminal, Globe, Database, 
  Layers, AlertTriangle, EyeOff, X, ArrowUpRight 
} from 'lucide-react';

interface DashboardProps {
  onClose: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onClose }) => {
  const { stats, selectedRepo, analysisReport } = useStore();

  if (!selectedRepo) return null;

  const statItems = [
    { label: 'Files', value: stats?.fileCount || 0, icon: FileCode2, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Classes', value: stats?.classCount || 0, icon: Code, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { label: 'Methods', value: stats?.methodCount || 0, icon: Terminal, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    { label: 'APIs', value: stats?.endpointCount || 0, icon: Globe, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Databases', value: stats?.databaseCount || 0, icon: Database, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { label: 'Relationships', value: stats?.relationshipCount || 0, icon: Layers, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' }
  ];

  const deadCodePercent = stats?.methodCount 
    ? Math.round(((stats.deadCodeCount || 0) / stats.methodCount) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 top-16 z-40 bg-darkBg/95 backdrop-blur-md overflow-y-auto p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-6xl w-full mx-auto">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <BarChart3 size={14} /> Repository Analytics
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            Dashboard for {selectedRepo.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-900 border border-white/15 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Core Stat Cards */}
        <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-6 gap-4">
          {statItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="glass-panel p-4 rounded-xl border flex flex-col shadow-sm">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${item.color}`}>
                  <Icon size={16} />
                </div>
                <span className="text-slate-500 text-xs font-semibold">{item.label}</span>
                <span className="text-2xl font-bold text-white mt-1">{item.value}</span>
              </div>
            );
          })}
        </div>

        {/* Circular Cycles Panel */}
        <div className="glass-panel p-5 rounded-xl flex flex-col min-h-64 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
              <AlertTriangle size={16} className="text-rose-400" />
              Circular Cycles
            </h3>
            <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2.5 py-0.5 rounded-full font-bold">
              {stats?.circularDependenciesCount || 0} Cycles
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {analysisReport?.circularDependencies && analysisReport.circularDependencies.length > 0 ? (
              analysisReport.circularDependencies.slice(0, 5).map((cycle, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-white/5 p-3 rounded-lg text-xs">
                  <span className="font-bold text-rose-400 block mb-1">Cycle #{idx + 1}</span>
                  <div className="font-mono text-[10px] text-slate-400 space-y-0.5">
                    {cycle.cycle.map((id, nIdx) => (
                      <div key={nIdx} className="truncate">→ {id.split(':').pop()}</div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic flex items-center justify-center h-full">
                No circular dependencies found.
              </div>
            )}
          </div>
        </div>

        {/* Dead Code Panel */}
        <div className="glass-panel p-5 rounded-xl flex flex-col min-h-64 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
              <EyeOff size={16} className="text-amber-500" />
              Dead Code Index
            </h3>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2.5 py-0.5 rounded-full font-bold">
              {deadCodePercent}% Dead
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center pb-4">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-slate-900 fill-none" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" className="stroke-amber-500 fill-none" strokeWidth="8" 
                  strokeDasharray={`${deadCodePercent * 2.51} 251`} 
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-white">{stats?.deadCodeCount || 0}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">methods</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4 max-w-[200px]">
              These methods are not reachable from main entry points or controller handlers.
            </p>
          </div>
        </div>

        {/* Hotspots Panel */}
        <div className="glass-panel p-5 rounded-xl flex flex-col min-h-64 shadow-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wide mb-4">
            <BarChart3 size={16} className="text-cyan-400" />
            Top Modifiers (Hotspots)
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {analysisReport?.hotspots && Object.keys(analysisReport.hotspots).length > 0 ? (
              Object.entries(analysisReport.hotspots)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([file, count]) => (
                  <div key={file} className="bg-slate-950/60 border border-white/5 p-2.5 rounded-lg flex items-center justify-between">
                    <div className="truncate max-w-[170px]">
                      <span className="text-xs text-slate-200 font-mono block truncate">{file.split('/').pop()}</span>
                      <span className="text-[9px] text-slate-500 truncate block font-mono">{file}</span>
                    </div>
                    <span className="text-xs text-cyan-400 font-bold bg-cyan-500/5 border border-cyan-500/15 px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                      {count}
                      <ArrowUpRight size={10} />
                    </span>
                  </div>
                ))
            ) : (
              <div className="text-xs text-slate-500 italic flex items-center justify-center h-full">
                No git modification logs found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
