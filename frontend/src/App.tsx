import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { GraphCanvas } from './components/GraphCanvas';
import { CodeViewer } from './components/CodeViewer';
import { Dashboard } from './components/Dashboard';
import { ImportModal } from './components/ImportModal';
import { useStore } from './store/useStore';

export const App: React.FC = () => {
  const { selectedRepo, activeCodePath } = useStore();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-darkBg text-slate-100">
      {/* Header */}
      <Navbar 
        onOpenImport={() => setIsImportOpen(true)}
        onToggleDashboard={() => setShowDashboard(!showDashboard)}
        showDashboard={showDashboard}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {selectedRepo && selectedRepo.status === 'COMPLETED' && <SidebarLeft />}

        <div className="flex-1 flex flex-col overflow-hidden">
          <GraphCanvas />
          {activeCodePath && <CodeViewer />}
        </div>

        {selectedRepo && selectedRepo.status === 'COMPLETED' && <SidebarRight />}
      </div>

      {/* Overlays / Modals */}
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      {showDashboard && <Dashboard onClose={() => setShowDashboard(false)} />}
    </div>
  );
};

export default App;
