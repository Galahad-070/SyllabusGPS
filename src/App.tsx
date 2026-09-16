import { useState, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { RoadmapGraph } from './components/RoadmapGraph';
import type { RoadmapData, RoadmapNode } from './types/roadmap';

function App() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const [currentNode, setCurrentNode] = useState<RoadmapNode | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleUploadComplete = useCallback((data: RoadmapData) => {
    setRoadmap(data);
    setCompletedNodes(new Set());
    setCurrentNode(null);
    setShowDetail(false);
  }, []);

  const handleNodeClick = useCallback((node: RoadmapNode) => {
    setCurrentNode(node);
    setShowDetail(true);
  }, []);

  const handleMarkComplete = useCallback((nodeId: string) => {
    setCompletedNodes(prev => new Set([...prev, nodeId]));
    setShowDetail(false);
    setCurrentNode(null);
  }, []);

  const handlePrerequisiteCheck = useCallback((_node: RoadmapNode, knowsPrerequisite: boolean) => {
    if (knowsPrerequisite && currentNode) {
      handleNodeClick(currentNode);
    }
  }, [currentNode, handleNodeClick]);

  const handleBackToGraph = useCallback(() => {
    setShowDetail(false);
    setCurrentNode(null);
  }, []);

  const progress = roadmap ? Math.round((completedNodes.size / roadmap.nodes.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-green-50">
      <UploadZone onUploadComplete={handleUploadComplete} />

      {roadmap && (
        <div className="fixed inset-0 z-40 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shadow-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">{roadmap.course_title}</h1>
                <p className="text-sm text-gray-500">{roadmap.nodes.length} modules • {roadmap.nodes.reduce((sum, n) => sum + n.estimated_hours, 0).toFixed(1)} hours total</p>
              </div>
              <div className="flex items-center gap-4">
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
                  onClick={() => {
                    setRoadmap(null);
                    setCompletedNodes(new Set());
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                  aria-label="Close roadmap"
                >
                  ×
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

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleMarkComplete(currentNode.id)}
                      disabled={completedNodes.has(currentNode.id)}
                      className={`
                        flex-1 py-3 px-6 rounded-lg font-medium transition-colors
                        ${completedNodes.has(currentNode.id) 
                          ? 'bg-green-100 text-green-700 cursor-default' 
                          : 'bg-green-600 text-white hover:bg-green-700'}
                      `}
                    >
                      {completedNodes.has(currentNode.id) ? '✓ Completed' : 'Mark Complete'}
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
            <RoadmapGraph
              data={roadmap}
              onNodeClick={handleNodeClick}
              completedNodes={completedNodes}
              onPrerequisiteCheck={handlePrerequisiteCheck}
            />
          </main>
        </div>
      )}
    </div>
  );
}

export default App;