import React, { useState } from 'react';
import { useStore, GraphNode } from '../store/useStore';
import { 
  Info, GitBranch, AlertCircle, EyeOff, Sparkles, User, 
  ChevronRight, Calendar, AlertTriangle, Play, Eye, MessageSquare,
  Globe, Database
} from 'lucide-react';

export const SidebarRight: React.FC = () => {
  const { 
    selectedNode, 
    selectedNodeDetails, 
    analysisReport, 
    setSelectedNode,
    graph,
    setFocusedNodeId,
    setFilters
  } = useStore();

  const [activeTab, setActiveTab] = useState<'details' | 'analysis' | 'ai'>('details');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai', text: string }>>([
    { sender: 'ai', text: "Hello! I can help you understand the architecture of this repository. Ask me to explain the layout, find cycles, list entry points, or explain specific classes." }
  ]);
  const [chatInput, setChatInput] = useState('');

  const getReadableSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const focusNodeById = (nodeId: string) => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) setSelectedNode(node);
  };

  const handleAiPrompt = (prompt: string, type: 'api' | 'db' | 'circular') => {
    setChatMessages(prev => [...prev, { sender: 'user', text: prompt }]);
    
    setTimeout(() => {
      let reply = '';
      if (type === 'api') {
        reply = "I've filtered the graph to highlight the REST API execution flow. Endpoint nodes (green) represent REST controllers, which delegate requests to Method nodes (yellow) and Class services (purple).";
        setFilters(['Endpoint', 'Class', 'Method']);
      } else if (type === 'db') {
        reply = "I've focused the graph on the data access layer. Repository layers (orange) represent databases and database entities. They are typically accessed by services.";
        setFilters(['Database', 'Class']);
      } else if (type === 'circular') {
        reply = "I've checked the repository and highlighted dependency loops. Circular import cycles are highlighted in red dashed lines between File nodes (cyan).";
        setFilters(['File']);
      }
      
      setChatMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    }, 400);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const query = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: query }]);

    setTimeout(() => {
      let reply = '';
      const q = query.toLowerCase();
      
      if (q.includes('api') || q.includes('endpoint') || q.includes('route') || q.includes('controller')) {
        reply = "I have filtered the graph to focus on REST Controller endpoints (green nodes) and classes. They expose mapping annotations like @GetMapping or Express routing handlers.";
        setFilters(['Endpoint', 'Class']);
      } else if (q.includes('db') || q.includes('database') || q.includes('entity') || q.includes('jpa') || q.includes('sql')) {
        reply = "The data access layer consists of JPA Entities and Spring repositories. I've filtered the graph to focus on Database nodes.";
        setFilters(['Database', 'Class']);
      } else if (q.includes('cycle') || q.includes('circular') || q.includes('loop')) {
        reply = "Found circular dependencies! Cycles in imports have been highlighted with red dashed lines on File nodes.";
        setFilters(['File']);
      } else if (q.includes('dead') || q.includes('unused') || q.includes('unreachable')) {
        reply = "Methods that are unreachable from main or endpoint handlers are marked as dead code (translucent gray method nodes). Try filtering by 'Method' and 'Class' to see them.";
        setFilters(['Method', 'Class']);
      } else {
        reply = "I scanned the AST metadata. To learn more about this project, try clicking a node to read its Git history, complexity analysis, and declarations, or use 'Focus Neighborhood' to isolate its local flow.";
      }

      setChatMessages(prev => [...prev, { sender: 'ai', text: reply }]);
    }, 500);
  };

  return (
    <aside className="w-80 h-[calc(100vh-4rem)] border-l glass-panel flex flex-col z-30">
      {/* Tabs */}
      <div className="flex bg-slate-900/60 p-1 border-b border-white/5">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors ${
            activeTab === 'details' ? 'bg-slate-800 text-white border border-white/5' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Node Details
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors ${
            activeTab === 'analysis' ? 'bg-slate-800 text-white border border-white/5' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Analysis
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'ai' ? 'bg-slate-800 text-white border border-white/5' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles size={11} className={activeTab === 'ai' ? 'text-indigo-400 animate-pulse' : ''} />
          AI Chat
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' ? (
          selectedNode ? (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white leading-tight break-all">
                    {selectedNode.properties.name}
                  </h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border border-white/5 uppercase mt-1 inline-block ${
                    selectedNode.label === 'File' ? 'text-cyan-400 bg-cyan-500/5' :
                    selectedNode.label === 'Class' ? 'text-purple-400 bg-purple-500/5' :
                    selectedNode.label === 'Method' ? 'text-yellow-400 bg-yellow-500/5' :
                    selectedNode.label === 'Endpoint' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-400 bg-slate-500/5'
                  }`}>
                    {selectedNode.label}
                  </span>
                </div>
              </div>

              {/* Specific Properties */}
              <div className="space-y-2 text-xs border-t border-white/5 pt-3">
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 mb-2">
                  <Info size={12} /> properties
                </div>
                {selectedNode.properties.path && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Path</span>
                    <span className="text-slate-300 font-mono break-all">{selectedNode.properties.path}</span>
                  </div>
                )}
                {selectedNode.properties.fullName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500 uppercase">Qualified Name</span>
                    <span className="text-slate-300 font-mono break-all">{selectedNode.properties.fullName}</span>
                  </div>
                )}
                {selectedNode.properties.size && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">File Size</span>
                    <span className="text-slate-200">{getReadableSize(selectedNode.properties.size)}</span>
                  </div>
                )}
                {selectedNode.properties.language && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Language</span>
                    <span className="text-slate-200">{selectedNode.properties.language}</span>
                  </div>
                )}
                {selectedNode.properties.endpoint && (
                  <>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">HTTP Method</span>
                      <span className="text-emerald-400 font-bold">{selectedNode.properties.method}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase">Route Endpoint</span>
                      <span className="text-slate-200 font-mono">{selectedNode.properties.endpoint}</span>
                    </div>
                  </>
                )}
                {selectedNode.properties.annotations && selectedNode.properties.annotations.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase">Annotations</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.properties.annotations.map(ann => (
                        <span key={ann} className="bg-slate-900 border border-white/5 px-2 py-0.5 rounded text-[10px] text-slate-400">
                          @{ann}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedNode.properties.unreachable && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 mt-2">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <span>This method is unreachable from entry points (Dead Code).</span>
                  </div>
                )}
              </div>

              {/* Focus Node action */}
              <div className="pt-2 border-t border-white/5 pb-3 mt-2">
                <button
                  onClick={() => setFocusedNodeId(selectedNode.id)}
                  className="w-full bg-indigo-600/10 border border-indigo-500/20 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Eye size={12} />
                  Focus Neighborhood
                </button>
              </div>

              {/* Git Contributors (Loaded dynamically) */}
              {selectedNodeDetails?.gitHistory && selectedNodeDetails.gitHistory.length > 0 && (
                <div className="border-t border-white/5 pt-3">
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 mb-2">
                    <Calendar size={12} /> Git Contributors
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedNodeDetails.gitHistory.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User size={12} className="text-indigo-400" />
                          <span className="truncate max-w-[150px]">{item.author}</span>
                        </div>
                        <span className="text-slate-500 text-[10px] font-bold">{item.commits} commits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic flex items-center justify-center h-48 border border-dashed border-white/5 rounded-lg">
              Select a node in the graph to view properties.
            </div>
          )
        ) : activeTab === 'analysis' ? (
          <div className="space-y-4">
            {/* Circular Dependencies */}
            <div className="space-y-2">
              <div className="text-rose-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <AlertCircle size={12} /> Circular Cycles
              </div>
              {analysisReport?.circularDependencies && analysisReport.circularDependencies.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {analysisReport.circularDependencies.map((cycle, idx) => (
                    <div key={idx} className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                      <div className="text-[10px] text-rose-400 font-bold mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={10} /> Cycle {idx + 1} ({cycle.length} nodes)
                      </div>
                      <div className="space-y-1">
                        {cycle.cycle.map((nodeId, nIdx) => (
                          <button
                            key={nIdx}
                            onClick={() => focusNodeById(nodeId)}
                            className="w-full text-left font-mono text-[9px] text-slate-400 hover:text-white flex items-center gap-1 truncate"
                          >
                            <Play size={8} /> {nodeId.split(':').pop()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  No circular dependencies detected.
                </div>
              )}
            </div>

            {/* Dead Code list */}
            <div className="space-y-2">
              <div className="text-amber-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <EyeOff size={12} /> Unused / Dead Methods
              </div>
              {analysisReport?.deadCode && analysisReport.deadCode.length > 0 ? (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {analysisReport.deadCode.map(item => (
                    <button
                      key={item.id}
                      onClick={() => focusNodeById(item.id)}
                      className="w-full text-left p-1.5 hover:bg-white/5 rounded text-[11px] font-mono text-slate-400 hover:text-amber-400 truncate flex items-center gap-1.5"
                    >
                      <ChevronRight size={10} />
                      {item.fullName.split('.').pop()}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  No dead code/methods detected.
                </div>
              )}
            </div>

            {/* Git Hotspots */}
            <div className="space-y-2">
              <div className="text-cyan-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Sparkles size={12} /> Modification Hotspots
              </div>
              {analysisReport?.hotspots && Object.keys(analysisReport.hotspots).length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Object.entries(analysisReport.hotspots)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([file, count]) => {
                      // Find matching node ID
                      const fileNode = graph.nodes.find(n => n.properties.path === file);
                      return (
                        <div key={file} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5">
                          {fileNode ? (
                            <button
                              onClick={() => setSelectedNode(fileNode)}
                              className="text-cyan-400 hover:underline truncate max-w-[180px] font-mono text-[10px]"
                            >
                              {file.split('/').pop()}
                            </button>
                          ) : (
                            <span className="text-slate-400 truncate max-w-[180px] font-mono text-[10px]">
                              {file.split('/').pop()}
                            </span>
                          )}
                          <span className="text-slate-500 font-bold text-[9px] bg-slate-950 px-2 py-0.5 rounded border border-white/5">
                            {count} commits
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded-lg border border-white/5">
                  No git modification metrics.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* AI Assistant Chat Panel */
          <div className="flex flex-col h-[calc(100vh-8.5rem)]">
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 ml-6' 
                    : 'bg-slate-950 border border-white/5 text-slate-300 mr-6'
                }`}>
                  <div className="font-bold text-[9px] text-slate-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                    {msg.sender === 'user' ? 'You' : <><Sparkles size={10} className="text-indigo-400" /> RepoMind AI</>}
                  </div>
                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="space-y-1 mb-3 border-t border-white/5 pt-3">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block mb-1">Quick Prompts</span>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAiPrompt('Explain REST API execution flow', 'api')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-[10px] truncate transition-colors flex items-center gap-1.5"
                >
                  <Globe size={10} /> "Explain REST API execution flow"
                </button>
                <button
                  onClick={() => handleAiPrompt('Show database repository layout', 'db')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-[10px] truncate transition-colors flex items-center gap-1.5"
                >
                  <Database size={10} /> "Show database repository layout"
                </button>
                <button
                  onClick={() => handleAiPrompt('Detect circular cycles', 'circular')}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 text-[10px] truncate transition-colors flex items-center gap-1.5"
                >
                  <AlertTriangle size={10} /> "Detect architectural cycles"
                </button>
              </div>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex gap-2 border-t border-white/5 pt-3">
              <input
                type="text"
                placeholder="Ask RepoMind..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-slate-950 placeholder-slate-600"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10"
              >
                Ask
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
