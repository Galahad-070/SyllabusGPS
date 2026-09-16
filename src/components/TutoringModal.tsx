import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-0" 
      role="dialog" 
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="w-full h-full max-w-[1400px] max-h-[90vh] bg-white rounded-none flex flex-col shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">Tutoring</span>
            <h2 className="text-xl font-bold text-gray-800 truncate max-w-[400px]">{node.label}</h2>
            <span className="text-sm text-gray-500 hidden sm:inline">{node.description}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'notes' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📝 Notes
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              💬 Chat
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close tutoring"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
          {activeTab === 'notes' && (
            <div className="w-full flex flex-col p-6 overflow-auto">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Study Notes</h3>
                  <p className="text-sm text-gray-500">AI-generated comprehensive notes for this module</p>
                </div>
                {notes && (
                  <button
                    onClick={handleSaveNotes}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save Notes
                  </button>
                )}
              </div>

              {!notes ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-xl">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 mb-6 text-lg">No study notes generated yet</p>
                    <p className="text-gray-400 mb-6">Click below to create comprehensive AI-generated notes covering key concepts, formulas, examples, and practice problems for this module.</p>
                    <button
                      onClick={handleGenerateNotes}
                      disabled={isGeneratingNotes}
                      className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                      {isGeneratingNotes ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Generating notes...
                        </span>
                      ) : 'Generate Study Notes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto prose prose-blue max-w-none bg-gray-50 rounded-xl p-6 border border-gray-100 text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notes}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="w-full flex flex-col p-6 overflow-hidden">
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800">Ask Questions</h3>
                <p className="text-sm text-gray-500">Get help with this module. Context includes notes and conversation history.</p>
              </div>

              <div className="flex-1 overflow-auto space-y-4" style={{ minHeight: 0 }}>
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-gray-400 py-12">
                    <div className="max-w-md">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-lg">No questions yet</p>
                      <p className="text-sm mt-1">Ask anything about this module - concepts, examples, clarifications</p>
                    </div>
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
                            <path d="M9.428 1.428a.75.75 0 00-1.06 1.06L11.19 8H9.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H14a.75.75 0 100-1.5H11.19l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H9.896l1.707-1.707a.75.75 0 00-1.06-1.06L2.25 9.75a.75.75 0 000 1.06l.428.428zm4.714 0a.75.75 0 00-1.06 1.06L12.72 8H10.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H16a.75.75 0 100-1.5H12.72l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H10.896l1.707-1.707a.75.75 0 00-1.06-1.06L5.25 9.75a.75.75 0 000 1.06l.428.428z" />
                          )}
                        </svg>
                      </div>
                      <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-[85%] p-4 rounded-2xl ${
                          msg.role === 'user' ? 'bg-blue-50 text-blue-900 rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        } prose prose-sm max-w-none whitespace-pre-wrap`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4">
                {error && (
                  <p className="text-red-600 text-sm mb-2">{error}</p>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask a question about this module..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    disabled={isAnswering}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isAnswering}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnswering ? 'Thinking...' : 'Ask'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}