import { useState, useCallback, useEffect } from 'react';
import { UploadZone } from './components/UploadZone';
import { RoadmapGraph } from './components/RoadmapGraph';
import { FilesSidebar } from './components/FilesSidebar';
import { getStoredRoadmaps, saveRoadmap, updateRoadmap, deleteRoadmap } from './lib/storage';
import type { RoadmapData, RoadmapNode, StoredRoadmap } from './types/roadmap';

function App() {
  const [roadmaps, setRoadmaps] = useState<StoredRoadmap[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const [currentNode, setCurrentNode] = useState<RoadmapNode | null>(null);
  const [currentNodePrereqs, setCurrentNodePrereqs] = useState<Array<{id: string, label: string, completed: boolean}>>([]);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const stored = getStoredRoadmaps();
    setRoadmaps(stored);
    if (stored.length > 0 && !activeId) {
      setActiveId(stored[0].id);
      setCompletedNodes(new Set(stored[0].completedNodes));
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      const roadmap = roadmaps.find(r => r.id === activeId);
      if (roadmap) {
        setCompletedNodes(new Set(roadmap.completedNodes));
      }
    }
  }, [activeId, roadmaps]);

  const activeRoadmap = roadmaps.find(r => r.id === activeId);

  const handleUploadComplete = useCallback((data: RoadmapData, fileName: string) => {
    const name = fileName.replace(/\.pdf$/i, '');
    const newRoadmap = saveRoadmap({
      name,
      fileName,
      data,
      completedNodes: [],
    });
    setRoadmaps(prev => [newRoadmap, ...prev]);
    setActiveId(newRoadmap.id);
    setCompletedNodes(new Set());
    setShowUpload(false);
  }, []);

  const handleSelectRoadmap = useCallback((id: string) => {
    setActiveId(id);
    const roadmap = roadmaps.find(r => r.id === id);
    if (roadmap) {
      setCompletedNodes(new Set(roadmap.completedNodes));
    }
    setShowDetail(false);
    setCurrentNode(null);
  }, [roadmaps]);

  const handleNewRoadmap = useCallback(() => {
    setShowUpload(true);
    setActiveId(null);
    setCompletedNodes(new Set());
  }, []);

  const handleRenameRoadmap = useCallback((id: string, newName: string) => {
    updateRoadmap(id, { name: newName });
    setRoadmaps(prev => prev.map(r => r.id === id ? { ...r, name: newName } : r));
  }, []);

  const handleDeleteRoadmap = useCallback((id: string) => {
    deleteRoadmap(id);
    setRoadmaps(prev => prev.filter(r => r.id !== id));
    if (activeId === id) {
      const remaining = roadmaps.filter(r => r.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
      setCompletedNodes(new Set());
    }
  }, [activeId, roadmaps]);

  const handleNodeClick = useCallback((node: RoadmapNode, prerequisites: Array<{id: string, label: string, completed: boolean}>) => {
    setCurrentNode(node);
    setCurrentNodePrereqs(prerequisites);
    setShowDetail(true);
  }, []);

  const handleToggleComplete = useCallback((nodeId: string, completed: boolean) => {
    setCompletedNodes(prev => {
      const next = new Set(prev);
      if (completed) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      if (activeId) {
        updateRoadmap(activeId, { completedNodes: Array.from(next) });
        setRoadmaps(prevMaps => prevMaps.map(r => 
          r.id === activeId ? { ...r, completedNodes: Array.from(next) } : r
        ));
      }
      return next;
    });
  }, [activeId]);

  const handlePrerequisiteCheck = useCallback((_node: RoadmapNode, knowsPrerequisite: boolean) => {
    if (knowsPrerequisite && currentNode) {
      // Find prerequisites for current node
      const edges = activeRoadmap?.data.edges || [];
      const nodes = activeRoadmap?.data.nodes || [];
      const prerequisites = edges
        .filter(e => e.target === currentNode.id)
        .map(e => {
          const prereqNode = nodes.find(n => n.id === e.source);
          return {
            id: e.source,
            label: prereqNode?.label || '',
            completed: completedNodes.has(e.source),
          };
        });
      handleNodeClick(currentNode, prerequisites);
    }
  }, [currentNode, handleNodeClick, activeRoadmap, completedNodes]);

  const handleBackToGraph = useCallback(() => {
    setShowDetail(false);
    setCurrentNode(null);
  }, []);

  const progress = activeRoadmap ? Math.round((completedNodes.size / activeRoadmap.data.nodes.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-green-50 flex">
      <FilesSidebar
        roadmaps={roadmaps}
        activeId={activeId}
        activeRoadmapNodes={activeRoadmap?.data.nodes || []}
        activeRoadmapEdges={activeRoadmap?.data.edges || []}
        completedNodes={completedNodes}
        onSelect={handleSelectRoadmap}
        onNew={handleNewRoadmap}
        onRename={handleRenameRoadmap}
        onDelete={handleDeleteRoadmap}
        onToggleComplete={handleToggleComplete}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {showUpload || roadmaps.length === 0 ? (
          <UploadZone onUploadComplete={handleUploadComplete} />
        ) : (
          <>
            <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm sticky top-0 z-10">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-800 truncate">{activeRoadmap?.data.course_title || 'Roadmap'}</h1>
                  <p className="text-sm text-gray-500">
                    {activeRoadmap?.data.nodes.length || 0} modules • 
                    {activeRoadmap?.data.nodes.reduce((sum, n) => sum + n.estimated_hours, 0).toFixed(1)} hours total
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="hidden sm:block w-48">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{progress}% complete</span>
                  <button
                    onClick={handleNewRoadmap}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="New syllabus"
                    title="New syllabus"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            </header>

            {showDetail && currentNode && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto" role="dialog" aria-modal="true">
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-auto shadow-xl animate-fade-in">
                  <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`
                            text-xs font-medium px-2 py-1 rounded-full
                            ${currentNode.difficulty === 'advanced' ? 'bg-red-100 text-red-700' : currentNode.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
                          `}>
                            {currentNode.difficulty || 'beginner'}
                          </span>
                          <span className="text-sm text-gray-500">~{currentNode.estimated_hours}h</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">{currentNode.label}</h2>
                      </div>
                      <button
                        onClick={handleBackToGraph}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 mb-6">{currentNode.description}</p>
                    
                    {currentNode.topics && currentNode.topics.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-3">Topics Covered</h3>
                        <div className="flex flex-wrap gap-2">
                          {currentNode.topics.map((topic, i) => (
                            <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentNodePrereqs.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          Prerequisites
                          <span className="text-xs text-gray-400 font-normal">
                            ({currentNodePrereqs.filter(p => p.completed).length}/{currentNodePrereqs.length})
                          </span>
                        </h3>
                        <div className="space-y-1.5">
                          {currentNodePrereqs.map((prereq) => (
                            <div 
                              key={prereq.id} 
                              className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border"
                            >
                              <div className={`
                                flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                                ${prereq.completed ? 'bg-green-500' : 'bg-amber-500'}
                              `}>
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  {prereq.completed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  )}
                                </svg>
                              </div>
                              <span className={`
                                text-sm font-medium
                                ${prereq.completed ? 'text-green-700' : 'text-amber-700'}
                              `}>
                                {prereq.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleToggleComplete(currentNode.id, !completedNodes.has(currentNode.id))}
                        className={`
                          flex-1 py-3 px-6 rounded-lg font-medium transition-colors
                          ${completedNodes.has(currentNode.id) 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                      >
                        {completedNodes.has(currentNode.id) ? 'Unmark' : 'Mark Complete'}
                      </button>
                      <button
                        onClick={handleBackToGraph}
                        className="flex-1 py-3 px-6 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Back to Roadmap
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <main className="flex-1 overflow-auto">
              {activeRoadmap && (
                <RoadmapGraph
                  data={activeRoadmap.data}
                  onNodeClick={handleNodeClick}
                  completedNodes={completedNodes}
                  onToggleComplete={handleToggleComplete}
                  onPrerequisiteCheck={handlePrerequisiteCheck}
                />
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
}

export default App;