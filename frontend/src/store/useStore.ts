import { create } from 'zustand';

export interface Repository {
  id: number;
  name: string;
  url: string;
  branch: string;
  status: string;
  clonePath?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  properties: {
    id: string;
    repoId: number;
    name: string;
    path?: string;
    fullName?: string;
    language?: string;
    size?: number;
    type?: string;
    method?: string;
    endpoint?: string;
    controllerName?: string;
    annotations?: string[];
    unreachable?: boolean;
  };
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface RepoStats {
  repositoryCount?: number;
  fileCount?: number;
  classCount?: number;
  methodCount?: number;
  endpointCount?: number;
  databaseCount?: number;
  queueCount?: number;
  totalNodes?: number;
  relationshipCount?: number;
  circularDependenciesCount?: number;
  deadCodeCount?: number;
}

export interface AnalysisReport {
  circularDependencies: Array<{ cycle: string[]; length: number }>;
  deadCode: Array<{ id: string; name: string; fullName: string }>;
  hotspots: Record<string, number>;
}

interface RepoState {
  apiBaseUrl: string;
  repos: Repository[];
  selectedRepo: Repository | null;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  stats: RepoStats | null;
  analysisReport: AnalysisReport | null;
  
  selectedNode: GraphNode | null;
  selectedNodeDetails: {
    gitHistory?: Array<{ author: string; commits: number }>;
    complexity?: string;
  } | null;

  activeCode: string | null;
  activeCodePath: string | null;
  activeCodeLang: string;
  
  filters: string[];
  searchQuery: string;
  loading: boolean;
  importLoading: boolean;

  fetchRepos: () => Promise<void>;
  selectRepo: (repo: Repository | null) => void;
  importRepo: (name: string, url: string, branch: string, token: string) => Promise<Repository>;
  importLocalRepo: (name: string, path: string) => Promise<Repository>;
  deleteRepo: (id: number) => Promise<void>;
  fetchGraph: (id: number) => Promise<void>;
  fetchStats: (id: number) => Promise<void>;
  fetchAnalysis: (id: number) => Promise<void>;
  fetchFileContent: (id: number, path: string) => Promise<void>;
  fetchNodeDetails: (id: number, nodeType: string, nodeId: string, filePath?: string) => Promise<void>;
  setSelectedNode: (node: GraphNode | null) => void;
  setFilters: (filters: string[]) => void;
  setSearchQuery: (query: string) => void;
  closeCodeViewer: () => void;
  focusedNodeId: string | null;
  setFocusedNodeId: (id: string | null) => void;
}

export const useStore = create<RepoState>((set, get) => ({
  apiBaseUrl: 'http://localhost:8080/api/repositories',
  repos: [],
  selectedRepo: null,
  graph: { nodes: [], edges: [] },
  stats: null,
  analysisReport: null,
  selectedNode: null,
  selectedNodeDetails: null,
  activeCode: null,
  activeCodePath: null,
  activeCodeLang: 'plaintext',
  filters: ['File', 'Class', 'Method', 'Endpoint', 'Database', 'Queue'],
  searchQuery: '',
  loading: false,
  importLoading: false,
  focusedNodeId: null,

  fetchRepos: async () => {
    try {
      const res = await fetch(get().apiBaseUrl);
      const data = await res.json();
      set({ repos: data });
    } catch (e) {
      console.error('Failed to fetch repos', e);
    }
  },

  selectRepo: (repo) => {
    set({
      selectedRepo: repo,
      graph: { nodes: [], edges: [] },
      stats: null,
      analysisReport: null,
      selectedNode: null,
      selectedNodeDetails: null,
      activeCode: null,
      activeCodePath: null,
      focusedNodeId: null
    });
    if (repo) {
      get().fetchGraph(repo.id);
      get().fetchStats(repo.id);
      get().fetchAnalysis(repo.id);
    }
  },

  importRepo: async (name, url, branch, token) => {
    set({ importLoading: true });
    try {
      const res = await fetch(get().apiBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, branch, token })
      });
      if (!res.ok) throw new Error('Failed to import repository');
      const newRepo = await res.json();
      set((state) => ({ repos: [newRepo, ...state.repos] }));
      return newRepo;
    } finally {
      set({ importLoading: false });
    }
  },

  importLocalRepo: async (name, path) => {
    set({ importLoading: true });
    try {
      const res = await fetch(`${get().apiBaseUrl}/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path })
      });
      if (!res.ok) throw new Error('Failed to import local folder');
      const newRepo = await res.json();
      set((state) => ({ repos: [newRepo, ...state.repos] }));
      return newRepo;
    } finally {
      set({ importLoading: false });
    }
  },

  deleteRepo: async (id) => {
    try {
      await fetch(`${get().apiBaseUrl}/${id}`, { method: 'DELETE' });
      set((state) => ({
        repos: state.repos.filter((r) => r.id !== id),
        selectedRepo: state.selectedRepo?.id === id ? null : state.selectedRepo
      }));
    } catch (e) {
      console.error('Failed to delete repo', e);
    }
  },

  fetchGraph: async (id) => {
    set({ loading: true });
    try {
      const nodeTypesParam = get().filters.join(',');
      const res = await fetch(`${get().apiBaseUrl}/${id}/graph?nodeTypes=${nodeTypesParam}`);
      const data = await res.json();
      set({ graph: data });
    } catch (e) {
      console.error('Failed to fetch graph', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async (id) => {
    try {
      const res = await fetch(`${get().apiBaseUrl}/${id}/stats`);
      const data = await res.json();
      set({ stats: data });
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  },

  fetchAnalysis: async (id) => {
    try {
      const res = await fetch(`${get().apiBaseUrl}/${id}/analysis`);
      const data = await res.json();
      set({ analysisReport: data });
    } catch (e) {
      console.error('Failed to fetch analysis report', e);
    }
  },

  fetchFileContent: async (id, path) => {
    try {
      const res = await fetch(`${get().apiBaseUrl}/${id}/code?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        set({
          activeCode: data.content,
          activeCodePath: path,
          activeCodeLang: data.language
        });
      }
    } catch (e) {
      console.error('Failed to fetch code content', e);
    }
  },

  fetchNodeDetails: async (id, nodeType, nodeId, filePath) => {
    try {
      let url = `${get().apiBaseUrl}/${id}/node-details?nodeType=${nodeType}&nodeId=${encodeURIComponent(nodeId)}`;
      if (filePath) {
        url += `&filePath=${encodeURIComponent(filePath)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      set({ selectedNodeDetails: data });
    } catch (e) {
      console.error('Failed to fetch node details', e);
    }
  },

  setSelectedNode: (node) => {
    set({ selectedNode: node, selectedNodeDetails: null });
    const repo = get().selectedRepo;
    if (node && repo) {
      // Find file path if applicable (for Files, Classes, Methods)
      let filePath: string | undefined = undefined;
      if (node.label === 'File') {
        filePath = node.properties.path;
      } else if (node.label === 'Class' || node.label === 'Method') {
        // Find declaring File in graph to fetch its git history
        const fileEdge = get().graph.edges.find((e) => e.target === node.id && e.type === 'DECLARES');
        if (fileEdge) {
          const fileNode = get().graph.nodes.find((n) => n.id === fileEdge.source);
          if (fileNode) filePath = fileNode.properties.path;
        }
      }
      get().fetchNodeDetails(repo.id, node.label, node.id, filePath);

      // Auto-load code viewer if a File, Class, or Method node is selected
      if (filePath) {
        get().fetchFileContent(repo.id, filePath);
      }
    }
  },

  setFilters: (filters) => {
    set({ filters });
    const repo = get().selectedRepo;
    if (repo) {
      get().fetchGraph(repo.id);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  closeCodeViewer: () => {
    set({ activeCode: null, activeCodePath: null });
  },

  setFocusedNodeId: (id) => {
    set({ focusedNodeId: id });
  }
}));
