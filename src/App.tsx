import { UploadZone } from './components/UploadZone';
import type { RoadmapData } from './types/roadmap';
import { useState } from 'react';

function App() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);

  const handleUploadComplete = (data: RoadmapData) => {
    setRoadmap(data);
    console.log('Roadmap generated:', data);
  };

  return (
    <div className="min-h-screen">
      <UploadZone onUploadComplete={handleUploadComplete} />
      
      {roadmap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="roadmap-title">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto shadow-xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 id="roadmap-title" className="text-2xl font-bold text-gray-800">{roadmap.course_title}</h2>
              <button
                onClick={() => setRoadmap(null)}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none p-1"
                aria-label="Close roadmap"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {roadmap.nodes.map((node) => (
                  <div key={node.id} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">{node.label}</h3>
                        <p className="text-gray-600 text-sm mb-2">{node.description}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ~{node.estimated_hours} hours
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3">Learning Dependencies</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  {roadmap.edges.map((edge, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">{edge.source}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-gray-700">{edge.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;