import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore, GraphNode } from '../store/useStore';
import { File, Code2, Globe, Database, MessageSquare } from 'lucide-react';

// Custom Node Component
const CustomNode: React.FC<NodeProps> = ({ data }) => {
  const label = data.label;
  const props = data.properties;
  const isSelected = data.isSelected;
  const isHovered = data.isHovered;

  const nodeStyles = () => {
    let base = "px-4 py-3 rounded-lg border glass-panel text-left max-w-xs transition-all shadow-sm relative ";
    if (isSelected) {
      base += "ring-2 ring-indigo-500 scale-105 shadow-md ";
    } else if (isHovered) {
      base += "shadow-md ";
    }

    if (props.unreachable) {
      return base + "opacity-40 border-slate-300 text-slate-400 bg-slate-50";
    }

    switch (label) {
      case 'File': return base + "border-cyan-500/40 text-cyan-700 hover:border-cyan-500/70";
      case 'Class': return base + "border-purple-500/40 text-purple-700 hover:border-purple-500/70";
      case 'Method': return base + "border-amber-500/40 text-amber-700 hover:border-amber-500/70";
      case 'Endpoint': return base + "border-emerald-500/40 text-emerald-700 hover:border-emerald-500/70 pulse-entry";
      case 'Database': return base + "border-orange-500/40 text-orange-700 hover:border-orange-500/70";
      case 'Queue': return base + "border-pink-500/40 text-pink-700 hover:border-pink-500/70";
      default: return base + "border-slate-300 text-slate-600";
    }
  };

  const getIcon = () => {
    const size = 14;
    switch (label) {
      case 'File': return <File size={size} className="text-cyan-400" />;
      case 'Class': return <Code2 size={size} className="text-purple-400" />;
      case 'Method': return <Code2 size={size} className="text-yellow-400" />;
      case 'Endpoint': return <Globe size={size} className="text-emerald-400" />;
      case 'Database': return <Database size={size} className="text-orange-400" />;
      case 'Queue': return <MessageSquare size={size} className="text-pink-400" />;
      default: return null;
    }
  };

  return (
    <div className={nodeStyles()}>
      {/* Input/Output connection anchors */}
      <Handle type="target" position={Position.Top} className="opacity-0 w-2 h-2" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 w-2 h-2" />

      <div className="flex items-center gap-2 mb-1">
        {getIcon()}
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-50">
          {label}
        </span>
      </div>

      <div className="text-xs font-semibold truncate leading-snug text-slate-800">
        {props.name}
      </div>

      {props.path && (
        <div className="text-[9px] font-mono text-slate-400 truncate mt-1 break-all">
          {props.path}
        </div>
      )}

      {props.endpoint && (
        <div className="text-[9px] font-mono text-emerald-600 truncate mt-1">
          {props.method}: {props.endpoint}
        </div>
      )}
    </div>
  );
};

export const GraphCanvas: React.FC = () => {
  const { 
    graph, 
    selectedNode, 
    setSelectedNode, 
    loading, 
    analysisReport, 
    focusedNodeId, 
    setFocusedNodeId 
  } = useStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodeTypesMap = useMemo(() => ({
    File: CustomNode,
    Class: CustomNode,
    Method: CustomNode,
    Endpoint: CustomNode,
    Database: CustomNode,
    Queue: CustomNode,
  }), []);

  // Compute graph layouts on data change
  useEffect(() => {
    if (!graph.nodes || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Filter by focused neighborhood if active
    let activeNodes = graph.nodes;
    let activeEdges = graph.edges;

    if (focusedNodeId) {
      const connectedEdges = graph.edges.filter(e => e.source === focusedNodeId || e.target === focusedNodeId);
      const connectedNodeIds = new Set(connectedEdges.flatMap(e => [e.source, e.target]));
      connectedNodeIds.add(focusedNodeId);

      activeNodes = graph.nodes.filter(n => connectedNodeIds.has(n.id));
      activeEdges = connectedEdges;
    }

    // Step A: Layer Layout Position Engine
    // Categorize nodes by layers to render structured DAG flows
    const nodesByLabel: Record<string, GraphNode[]> = {};
    activeNodes.forEach(n => {
      if (!nodesByLabel[n.label]) nodesByLabel[n.label] = [];
      nodesByLabel[n.label].push(n);
    });

    const positions: Record<string, { x: number; y: number }> = {};
    const ySpacing = 160;
    
    // Layer mapping: y values
    const layers = ['Endpoint', 'File', 'Class', 'Method', 'Database', 'Queue'];
    
    layers.forEach((label, layerIdx) => {
      const list = nodesByLabel[label] || [];
      const width = list.length * 240;
      const startX = -width / 2;

      list.forEach((node, nodeIdx) => {
        positions[node.id] = {
          x: startX + nodeIdx * 240,
          y: layerIdx * ySpacing
        };
      });
    });

    // Node details mapping
    const rfNodes = activeNodes.map(n => {
      const pos = positions[n.id] || { x: Math.random() * 500, y: Math.random() * 500 };
      return {
        id: n.id,
        type: n.label, // Maps to registered CustomNode
        position: pos,
        data: {
          label: n.label,
          properties: n.properties,
          isSelected: selectedNode?.id === n.id,
          isHovered: hoveredNodeId === n.id
        }
      };
    });

    // Check circular dependencies from report to draw red dashed links
    const cyclicEdgeIds = new Set<string>();
    if (analysisReport?.circularDependencies) {
      analysisReport.circularDependencies.forEach(cycle => {
        for (let i = 0; i < cycle.cycle.length - 1; i++) {
          cyclicEdgeIds.add(`${cycle.cycle[i]}->${cycle.cycle[i+1]}`);
        }
        // Link last to first
        cyclicEdgeIds.add(`${cycle.cycle[cycle.cycle.length-1]}->${cycle.cycle[0]}`);
      });
    }

    const rfEdges = activeEdges.map((e, idx) => {
      const isCyclic = cyclicEdgeIds.has(`${e.source}->${e.target}`);
      const isRelatedToHover = hoveredNodeId === e.source || hoveredNodeId === e.target;
      
      return {
        id: `e-${idx}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: isRelatedToHover && !isCyclic,
        style: {
          stroke: isCyclic 
            ? '#e11d48' 
            : (isRelatedToHover ? '#6366f1' : 'rgba(100, 116, 139, 0.25)'),
          strokeWidth: isRelatedToHover ? 2 : 1,
          strokeDasharray: isCyclic ? '5,5' : '0'
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCyclic ? '#e11d48' : (isRelatedToHover ? '#6366f1' : 'rgba(100, 116, 139, 0.4)'),
          width: 12,
          height: 12
        }
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [graph, selectedNode, hoveredNodeId, analysisReport, focusedNodeId]);

  const onNodeClick = (_: any, node: any) => {
    const originalNode = graph.nodes.find(n => n.id === node.id);
    if (originalNode) setSelectedNode(originalNode);
  };

  const onNodeMouseEnter = (_: any, node: any) => {
    setHoveredNodeId(node.id);
  };

  const onNodeMouseLeave = () => {
    setHoveredNodeId(null);
  };

  return (
    <div className="flex-1 h-full relative bg-slate-100">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70 backdrop-blur-xs z-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-semibold text-slate-500">Assembling dependency map...</span>
          </div>
        </div>
      ) : null}

      {/* Focus Mode active overlay */}
      {focusedNodeId && (
        <div className="absolute top-4 left-16 z-10">
          <button
            onClick={() => setFocusedNodeId(null)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500 shadow-lg shadow-indigo-600/35 flex items-center gap-1.5 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Focus Mode Active (Reset)
          </button>
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
            <Code2 size={24} className="text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-600 mb-1">Interactive Workspace Empty</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Select a project from the header dropdown or click "Import Repo" to parse and construct a code maps index.
          </p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypesMap}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#cbd5e1" gap={16} size={1} />
          <Controls />
          <MiniMap nodeColor={() => 'rgba(99, 102, 241, 0.2)'} maskColor="rgba(241, 245, 249, 0.6)" />
        </ReactFlow>
      )}
    </div>
  );
};
