import { useMemo, useState } from 'react';
import type { RoadmapData, RoadmapNode, RoadmapEdge } from '../types/roadmap';

interface RoadmapGraphProps {
  data: RoadmapData;
  onNodeClick: (node: RoadmapNode) => void;
  completedNodes: Set<string>;
  onPrerequisiteCheck: (node: RoadmapNode, knowsPrerequisite: boolean) => void;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const LAYER_SPACING = 280;
const NODE_SPACING = 140;

function getNodeLevel(nodeId: string, edges: RoadmapEdge[]): number {
  const visited = new Set<string>();

  function dfs(id: string, level: number): number {
    if (visited.has(id)) return level;
    visited.add(id);
    
    const incomingEdges = edges.filter(e => e.target === id);
    if (incomingEdges.length === 0) return level;
    
    return Math.max(...incomingEdges.map(e => dfs(e.source, level + 1)));
  }

  return dfs(nodeId, 0);
}

function getNodePosition(
  node: RoadmapNode,
  nodes: RoadmapNode[],
  edges: RoadmapEdge[],
  _index: number,
  levelCounts: Map<number, number>
): { x: number; y: number } {
  const level = getNodeLevel(node.id, edges);
  const levelIndex = levelCounts.get(level) || 0;
  levelCounts.set(level, levelIndex + 1);
  
  const totalInLevel = nodes.filter(n => getNodeLevel(n.id, edges) === level).length;
  const startY = -(totalInLevel - 1) * NODE_SPACING / 2;
  
  return {
    x: level * LAYER_SPACING + 100,
    y: startY + levelIndex * NODE_SPACING + 200,
  };
}

export function RoadmapGraph({
  data,
  onNodeClick,
  completedNodes,
  onPrerequisiteCheck,
}: RoadmapGraphProps) {
  const { nodes, edges } = data;
  
  const nodePositions = useMemo(() => {
    const levelCounts = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();
    
    const sortedNodes = [...nodes].sort((a, b) => 
      getNodeLevel(a.id, edges) - getNodeLevel(b.id, edges)
    );
    
    sortedNodes.forEach((node, index) => {
      positions.set(node.id, getNodePosition(node, nodes, edges, index, levelCounts));
    });
    
    return positions;
  }, [nodes, edges]);

  const getEdgePath = (edge: RoadmapEdge) => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) return '';
    
    const startX = source.x + NODE_WIDTH;
    const startY = source.y + NODE_HEIGHT / 2;
    const endX = target.x;
    const endY = target.y + NODE_HEIGHT / 2;
    const midX = (startX + endX) / 2;
    
    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  };

  const isAdvanced = (node: RoadmapNode): boolean => {
    const incomingEdges = edges.filter(e => e.target === node.id);
    return incomingEdges.length >= 2 || 
           node.estimated_hours > 6 ||
           node.label.toLowerCase().includes('advanced') ||
           node.label.toLowerCase().includes('capstone') ||
           node.label.toLowerCase().includes('final');
  };

  const [showPrerequisiteCheck, setShowPrerequisiteCheck] = useState<RoadmapNode | null>(null);

  const handleNodeClick = (node: RoadmapNode) => {
    if (completedNodes.has(node.id)) return;
    
    if (isAdvanced(node) && !completedNodes.has(node.id)) {
      const incomingEdges = edges.filter(e => e.target === node.id);
      const prerequisites = incomingEdges.map(e => e.source);
      const missingPrereqs = prerequisites.filter(p => !completedNodes.has(p));
      
      if (missingPrereqs.length > 0) {
        setShowPrerequisiteCheck(node);
        return;
      }
    }
    onNodeClick(node);
  };

  if (showPrerequisiteCheck) {
    const node = showPrerequisiteCheck;
    const incomingEdges = edges.filter(e => e.target === node.id);
    const prerequisites = incomingEdges.map(e => e.source);
    const missingPrereqs = prerequisites.filter(p => !completedNodes.has(p));
    const prereqNodes = nodes.filter(n => missingPrereqs.includes(n.id));

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Prerequisite Check</h3>
          <p className="text-gray-600 mb-4">
            <span className="font-medium">{node.label}</span> requires understanding of:
          </p>
          <ul className="space-y-2 mb-6">
            {prereqNodes.map(prereq => (
              <li key={prereq.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">{prereq.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-500 mb-6">Do you have a solid understanding of these topics?</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                missingPrereqs.forEach(p => completedNodes.add(p));
                setShowPrerequisiteCheck(null);
                onPrerequisiteCheck(node, true);
              }}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Yes, I know these
            </button>
            <button
              onClick={() => {
                setShowPrerequisiteCheck(null);
                onPrerequisiteCheck(node, false);
              }}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              No, guide me through them first
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-auto p-8" style={{ minHeight: '600px' }}>
      <svg 
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', minWidth: '1200px' }}
      >
        <defs>
          <marker id="arrowhead-gray" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
          <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
          </marker>
        </defs>
        
        {edges.map((edge, index) => {
          const path = getEdgePath(edge);
          const sourceCompleted = completedNodes.has(edge.source);
          const targetCompleted = completedNodes.has(edge.target);
          const isActive = sourceCompleted && !targetCompleted;
          
          return (
            <path
              key={index}
              d={path}
              stroke={isActive ? '#22c55e' : '#6b7280'}
              strokeWidth={isActive ? 3 : 2}
              fill="none"
              markerEnd={isActive ? 'url(#arrowhead-green)' : 'url(#arrowhead-gray)'}
              className="transition-colors duration-300"
              style={{ filter: isActive ? 'drop-shadow(0 0 4px #22c55e)' : 'none' }}
            />
          );
        })}
      </svg>

      <div className="relative" style={{ minWidth: '1200px', minHeight: '600px' }}>
        {nodes.map(node => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          
          const isCompleted = completedNodes.has(node.id);
          const incomingEdges = edges.filter(e => e.target === node.id);
          const prerequisitesMet = incomingEdges.every(e => completedNodes.has(e.source));
          const isUnlocked = incomingEdges.length === 0 || prerequisitesMet;
          const isAdvancedNode = isAdvanced(node);
          const isCurrent = isUnlocked && !isCompleted && 
            edges.some(e => e.target === node.id && completedNodes.has(e.source));
          
          return (
            <div
              key={node.id}
              className="absolute transition-all duration-300"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${NODE_WIDTH}px`,
              }}
            >
              <div
                className={`
                  relative rounded-xl p-4 cursor-pointer transition-all duration-200
                  ${isCompleted ? 'bg-green-50 border-2 border-green-400 shadow-lg' : ''}
                  ${!isCompleted && isUnlocked ? 'bg-white border-2 border-gray-200 hover:border-green-300 hover:shadow-md' : ''}
                  ${!isUnlocked ? 'bg-gray-50 border-2 border-gray-200 opacity-60 cursor-not-allowed' : ''}
                  ${isCurrent && !isCompleted ? 'ring-2 ring-green-300' : ''}
                `}
                onClick={() => handleNodeClick(node)}
                style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
              >
                {isCompleted && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                
                {!isCompleted && isUnlocked && isAdvancedNode && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center" title="Advanced topic">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                
                <div className="flex items-start gap-3 h-full">
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white
                    ${isCompleted ? 'bg-green-500' : isUnlocked ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}
                  `}>
                    {nodes.findIndex(n => n.id === node.id) + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={`
                      font-semibold truncate
                      ${isCompleted ? 'text-green-800' : isUnlocked ? 'text-gray-800' : 'text-gray-400'}
                    `}>
                      {node.label}
                    </h4>
                    <p className={`
                      text-sm mt-1 line-clamp-2
                      ${isCompleted ? 'text-green-600' : isUnlocked ? 'text-gray-600' : 'text-gray-400'}
                    `}>
                      {node.description}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className={`
                        text-xs font-medium px-2 py-1 rounded-full
                        ${isCompleted ? 'bg-green-100 text-green-700' : isUnlocked ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}
                      `}>
                        ~{node.estimated_hours}h
                      </span>
                      {incomingEdges.length > 0 && (
                        <span className="text-xs text-gray-400">
                          ← {incomingEdges.length} prereq{incomingEdges.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {!isCompleted && isUnlocked && (
                  <div className="absolute bottom-2 right-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}