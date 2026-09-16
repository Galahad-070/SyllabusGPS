import { useState } from 'react';
import type { StoredRoadmap, RoadmapNode, RoadmapEdge } from '../types/roadmap';

interface FilesSidebarProps {
  roadmaps: Array<StoredRoadmap>;
  activeId: string | null;
  activeRoadmapNodes: RoadmapNode[];
  activeRoadmapEdges: RoadmapEdge[];
  completedNodes: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (nodeId: string, completed: boolean) => void;
}

function getPrerequisiteStatus(node: RoadmapNode, edges: RoadmapEdge[], completedNodes: Set<string>): {
  total: number;
  completed: number;
  isPrerequisiteFor: string[];
} {
  const incomingEdges = edges.filter(e => e.target === node.id);
  const outgoingEdges = edges.filter(e => e.source === node.id);
  
  return {
    total: incomingEdges.length,
    completed: incomingEdges.filter(e => completedNodes.has(e.source)).length,
    isPrerequisiteFor: outgoingEdges.map(e => e.target),
  };
}

export function FilesSidebar({ 
  roadmaps, 
  activeId, 
  activeRoadmapNodes, 
  activeRoadmapEdges, 
  completedNodes,
  onSelect, 
  onNew, 
  onRename, 
  onDelete,
  onToggleComplete,
}: FilesSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showModules, setShowModules] = useState<string | null>(null);

  const handleRenameStart = (roadmap: StoredRoadmap) => {
    setEditingId(roadmap.id);
    setEditName(roadmap.name);
  };

  const handleRenameConfirm = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleRenameConfirm(id);
    if (e.key === 'Escape') handleRenameCancel();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Your Syllabi</h2>
          <button
            onClick={onNew}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="New syllabus"
            title="New syllabus"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500">{roadmaps.length} file{roadmaps.length !== 1 ? 's' : ''} stored locally</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {roadmaps.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No syllabi yet</p>
            <p className="text-xs mt-1">Upload a PDF to get started</p>
          </div>
        ) : (
          <ul className="space-y-1" role="list">
            {roadmaps.map(roadmap => (
              <li key={roadmap.id}>
                {editingId === roadmap.id ? (
                  <div className="flex items-center gap-1 p-1.5">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleRenameConfirm(roadmap.id)}
                      onKeyDown={e => handleKeyDown(e, roadmap.id)}
                      className="flex-1 px-2 py-1.5 text-sm border border-green-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameConfirm(roadmap.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      aria-label="Save"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleRenameCancel}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                      aria-label="Cancel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelect(roadmap.id)}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-3 group
                        ${activeId === roadmap.id 
                          ? 'bg-green-50 border border-green-200' 
                          : 'hover:bg-gray-50'}
                      `}
                      aria-current={activeId === roadmap.id ? 'true' : 'false'}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`
                          font-medium text-sm truncate
                          ${activeId === roadmap.id ? 'text-green-800' : 'text-gray-800'}
                        `}>
                          {roadmap.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{roadmap.fileName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(roadmap.updatedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); handleRenameStart(roadmap); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          aria-label="Rename"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(roadmap.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setShowModules(showModules === roadmap.id ? null : roadmap.id); }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                          aria-label={showModules === roadmap.id ? 'Hide modules' : 'Show modules'}
                          title={showModules === roadmap.id ? 'Hide modules' : 'Show modules'}
                        >
                          <svg className={`w-4 h-4 transition-transform ${showModules === roadmap.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </button>

                    {showModules === roadmap.id && activeRoadmapNodes.length > 0 && (
                      <ul className="mt-1 ml-2 space-y-1 border-l border-gray-200 pl-2">
                        {activeRoadmapNodes.map((node, index) => {
                          const prereqStatus = getPrerequisiteStatus(node, activeRoadmapEdges, completedNodes);
                          const isCompleted = completedNodes.has(node.id);
                          const isUnlocked = prereqStatus.total === 0 || prereqStatus.completed === prereqStatus.total;
                          const isPrerequisiteFor = prereqStatus.isPrerequisiteFor.length > 0;
                          
                          const targetNodes = activeRoadmapNodes.filter(n => prereqStatus.isPrerequisiteFor.includes(n.id));
                          const dependentNames = targetNodes.map(n => n.label).join(', ');
                          
                          return (
                            <li key={node.id} className="relative">
                              <button
                                onClick={() => onToggleComplete(node.id, !isCompleted)}
                                className={`
                                  w-full text-left px-2 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-2
                                  ${isCompleted ? 'bg-green-50' : isUnlocked ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60 cursor-not-allowed'}
                                `}
                                disabled={!isUnlocked}
                                title={!isUnlocked ? `Requires ${prereqStatus.total - prereqStatus.completed} more prerequisite(s)` : ''}
                              >
                                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                  {isCompleted ? (
                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <span className={`
                                      w-4 h-4 rounded border-2 flex items-center justify-center text-center
                                      ${isUnlocked ? 'border-gray-300 text-gray-400' : 'border-gray-200 text-gray-300'}
                                    `}>
                                      {index + 1}
                                    </span>
                                  )}
                                </span>
                                
                                <div className="flex-1 min-w-0">
                                  <p className={`
                                    text-xs font-medium truncate
                                    ${isCompleted ? 'text-green-800' : isUnlocked ? 'text-gray-700' : 'text-gray-400'}
                                  `}>
                                    {node.label}
                                  </p>
                                  {(prereqStatus.total > 0 || isPrerequisiteFor) && (
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      {prereqStatus.total > 0 && (
                                        <span className={`
                                          text-[10px] px-1.5 py-0.5 rounded
                                          ${prereqStatus.completed === prereqStatus.total ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}
                                        `}>
                                          {prereqStatus.completed}/{prereqStatus.total} prereq
                                        </span>
                                      )}
                                      {isPrerequisiteFor && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700" title={`Prerequisite for: ${dependentNames}`}>
                                          → {targetNodes.length} next
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          Data stored locally in your browser
        </p>
      </div>
    </aside>
  );
}