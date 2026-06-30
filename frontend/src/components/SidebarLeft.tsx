import React from 'react';
import { useStore, GraphNode } from '../store/useStore';
import { Filter, Folder, File, Code2, Database, MessageSquare, Globe, ChevronRight, ChevronDown } from 'lucide-react';

export const SidebarLeft: React.FC = () => {
  const { graph, filters, setFilters, selectedNode, setSelectedNode } = useStore();

  const nodeTypes = [
    { label: 'File', color: 'border-cyan-300 text-cyan-700 bg-cyan-50', icon: File },
    { label: 'Class', color: 'border-purple-300 text-purple-700 bg-purple-50', icon: Code2 },
    { label: 'Method', color: 'border-amber-300 text-amber-700 bg-amber-50', icon: Code2 },
    { label: 'Endpoint', color: 'border-emerald-300 text-emerald-700 bg-emerald-50', icon: Globe },
    { label: 'Database', color: 'border-orange-300 text-orange-700 bg-orange-50', icon: Database },
    { label: 'Queue', color: 'border-pink-300 text-pink-700 bg-pink-50', icon: MessageSquare }
  ];

  const handleFilterToggle = (type: string) => {
    if (filters.includes(type)) {
      setFilters(filters.filter(f => f !== type));
    } else {
      setFilters([...filters, type]);
    }
  };

  // Group files in hierarchical list
  const fileNodes = graph.nodes.filter(n => n.label === 'File');

  return (
    <aside className="w-80 h-[calc(100vh-4rem)] border-r border-slate-200 glass-panel flex flex-col z-30">
      {/* Node Filters */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
          <Filter size={14} />
          Graph Node Filters
        </div>
        <div className="grid grid-cols-2 gap-2">
          {nodeTypes.map(type => {
            const Icon = type.icon;
            const isChecked = filters.includes(type.label);
            return (
              <button
                key={type.label}
                onClick={() => handleFilterToggle(type.label)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  isChecked 
                    ? `${type.color} shadow-sm` 
                    : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 bg-white'
                }`}
              >
                <Icon size={12} />
                {type.label}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
          <Folder size={14} />
          File Explorer ({fileNodes.length})
        </div>
        
        {fileNodes.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-2">No files indexed yet.</div>
        ) : (
          <div className="space-y-1">
            {fileNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                      : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <File size={12} className="text-cyan-500 flex-shrink-0" />
                  <span className="truncate">{node.properties.path}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
