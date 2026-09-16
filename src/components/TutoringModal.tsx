import { useState, useEffect, useRef, useCallback } from 'react';
import type { RoadmapNode, TutoringMessage } from '../types/roadmap';
import { generateTutoringNotes, askTutoringQuestion } from '../api/tutoring';
import { getTutoringSession, saveTutoringSession, addTutoringMessage, updateTutoringNotes } from '../lib/storage';

interface TutoringModalProps {
  node: RoadmapNode;
  courseTitle: string;
  roadmapId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TutoringModal({ node, courseTitle, roadmapId, isOpen, onClose }: TutoringModalProps) {
  const [notes, setNotes] = useState('');
  const [messages, setMessages] = useState<TutoringMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const session = getTutoringSession(roadmapId, node.id);
      if (session) {
        setNotes(session.notes);
        setMessages(session.messages);
      } else {
        setNotes('');
        setMessages([]);
      }
    }
  }, [isOpen, roadmapId, node.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGenerateNotes = useCallback(async () => {
    if (notes) return;
    setIsGeneratingNotes(true);
    setError(null);
    try {
      const generatedNotes = await generateTutoringNotes(node, courseTitle);
      setNotes(generatedNotes);
      saveTutoringSession({
        nodeId: node.id,
        roadmapId,
        notes: generatedNotes,
        messages: [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [node, courseTitle, roadmapId, notes]);

  const handleSaveNotes = useCallback(() => {
    if (notes) {
      updateTutoringNotes(roadmapId, node.id, notes);
    }
  }, [roadmapId, node.id, notes]);

  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAnswering) return;
    
    const userMessage = input.trim();
    setInput('');
    setIsAnswering(true);
    setError(null);
    
    const newUserMessage: TutoringMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      const answer = await askTutoringQuestion(
        node,
        courseTitle,
        notes,
        [...messages, newUserMessage],
        userMessage
      );
      
      const assistantMessage: TutoringMessage = {
        role: 'assistant',
        content: answer,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      addTutoringMessage(roadmapId, node.id, assistantMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setIsAnswering(false);
    }
  }, [input, isAnswering, messages, node, courseTitle, notes, roadmapId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl animate-fade-in">
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">Tutoring</span>
              <span className="text-sm text-gray-500">{node.label}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">{node.description}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto flex flex-col" style={{ minHeight: 0 }}>
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Study Notes</h3>
              {notes && (
                <button
                  onClick={handleSaveNotes}
                  className="ml-auto px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save Notes
                </button>
              )}
            </div>
            
            {!notes ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No study notes generated yet. Click below to create comprehensive notes for this module.</p>
                <button
                  onClick={handleGenerateNotes}
                  disabled={isGeneratingNotes}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingNotes ? 'Generating...' : 'Generate Study Notes'}
                </button>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-gray-200" style={{ maxHeight: '300px', overflow: 'auto' }}>
                {notes.split('\n').map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4" style={{ minHeight: 0 }}>
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>No questions yet. Ask anything about this module!</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    <svg className={`w-4 h-4 ${msg.role === 'user' ? 'text-blue-600' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      {msg.role === 'user' ? (
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                      ) : (
                        <path d="M9.428 1.428a.75.75 0 00-1.06 1.06L11.19 8H9.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H14a.75.75 0 100-1.5H11.19l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H9.896l1.707-1.707a.75.75 0 00-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H9.5l1.757-1.757a.75.75 0 00-1.06-1.06L2.25 9.75a.75.75 0 000 1.06l.428.428zm4.714 0a.75.75 0 00-1.06 1.06L12.72 8H10.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H16a.75.75 0 100-1.5H12.72l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H10.896l1.707-1.707a.75.75 0 00-1.06-1.06L5.25 9.75a.75.75 0 000 1.06l.428.428z" />
                      )}
                    </svg>
                  </div>
                  <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[80%] p-3 rounded-2xl ${
                      msg.role === 'user' ? 'bg-blue-50 text-blue-900' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            {error && (
              <p className="text-red-600 text-sm mb-2">{error}</p>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question about this module..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                disabled={isAnswering}
              />
              <button
                type="submit"
                disabled={!input.trim() || isAnswering}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnswering ? 'Thinking...' : 'Ask'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}