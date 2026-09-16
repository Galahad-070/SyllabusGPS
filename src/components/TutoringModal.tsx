import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
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

  const handleCopyNotes = useCallback(() => {
    if (!notes) return;
    navigator.clipboard.writeText(notes).then(() => {
      // Could add a toast notification here
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = notes;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }, [notes]);

  const handleExportPDF = useCallback(() => {
    if (!notes) return;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    
    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    const titleLines = doc.splitTextToSize(node.label, contentWidth);
    doc.text(titleLines, margin, margin + 10);
    
    // Course title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(courseTitle, margin, margin + 10 + titleLines.length * 10 + 5);
    
    // Module description
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(node.description, contentWidth);
    doc.text(descLines, margin, margin + 10 + titleLines.length * 10 + 5 + 10);
    
    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    const lineY = margin + 10 + titleLines.length * 10 + 5 + 10 + descLines.length * 6 + 5;
    doc.line(margin, lineY, pageWidth - margin, lineY);
    
    // Parse markdown with inline formatting support
    let yPos = lineY + 8;
    const lines = notes.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    
    // Helper to render text with inline markdown (bold, italic, code)
    const renderInlineMarkdown = (text: string, x: number, y: number, fontSize: number, fontStyle: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [40, 40, 40]) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...color);
      
      // Parse inline markdown: **bold**, *italic*, `code`
      const parts = text.split(/(\*\*.+?\*\*|\*.+?\*|`.+?`)/g);
      let currentX = x;
      
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          doc.setFont('helvetica', 'bold');
          doc.text(part.slice(2, -2), currentX, y);
          currentX += doc.getTextWidth(part.slice(2, -2));
        } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          doc.setFont('helvetica', 'italic');
          doc.text(part.slice(1, -1), currentX, y);
          currentX += doc.getTextWidth(part.slice(1, -1));
        } else if (part.startsWith('`') && part.endsWith('`')) {
          doc.setFont('courier', 'normal');
          doc.setFillColor(240, 240, 240);
          const textW = doc.getTextWidth(part.slice(1, -1));
          doc.roundedRect(currentX - 1, y - 3, textW + 2, 5, 1, 1, 'F');
          doc.text(part.slice(1, -1), currentX, y);
          currentX += textW + 2;
        } else if (part) {
          doc.setFont('helvetica', fontStyle);
          doc.text(part, currentX, y);
          currentX += doc.getTextWidth(part);
        }
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = margin;
      }
      
      // Code block handling
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          // Render code block
          doc.setFillColor(245, 245, 245);
          const blockHeight = codeBlockContent.length * 5 + 8;
          if (yPos + blockHeight > pageHeight - 25) {
            doc.addPage();
            yPos = margin;
          }
          doc.roundedRect(margin, yPos - 2, contentWidth, blockHeight, 2, 2, 'F');
          doc.setFont('courier', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          codeBlockContent.forEach((cl, idx) => {
            doc.text(cl, margin + 4, yPos + 6 + idx * 5);
          });
          yPos += blockHeight + 4;
          codeBlockContent = [];
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }
      
      // Headers
      if (line.startsWith('# ')) {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        renderInlineMarkdown(line.substring(2), margin, yPos, 18, 'bold', [22, 101, 52]);
        yPos += 10;
      } else if (line.startsWith('## ')) {
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        renderInlineMarkdown(line.substring(3), margin, yPos, 15, 'bold', [40, 40, 40]);
        yPos += 8;
      } else if (line.startsWith('### ')) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        renderInlineMarkdown(line.substring(4), margin, yPos, 13, 'bold', [60, 60, 60]);
        yPos += 7;
      } else if (line.startsWith('> ')) {
        // Blockquote
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.setFillColor(240, 240, 240);
        renderInlineMarkdown(line.substring(2), margin + 5, yPos, 10, 'italic', [100, 100, 100]);
        yPos += 7;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text('•', margin, yPos);
        renderInlineMarkdown(line.substring(2), margin + 5, yPos, 11, 'normal', [40, 40, 40]);
        yPos += 7;
      } else if (line.match(/^\d+\.\s/)) {
        // Numbered list
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        renderInlineMarkdown(line, margin + 5, yPos, 11, 'normal', [40, 40, 40]);
        yPos += 7;
      } else if (line.trim() === '') {
        yPos += 4;
      } else {
        // Regular text with inline markdown
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        renderInlineMarkdown(line, margin, yPos, 11, 'normal', [40, 40, 40]);
        yPos += 7;
      }
    }
    
    // Footer
    const footerY = pageHeight - 15;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(130, 130, 130);
    doc.text('Made with SyllabusGPS', pageWidth / 2, footerY, { align: 'center' });
    
    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
    
    // Save
    const fileName = `${node.label.replace(/[^a-z0-9]/gi, '_')}_notes.pdf`;
    doc.save(fileName);
  }, [notes, node.label, courseTitle]);

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
                <div className="flex items-center gap-2">
                  {notes && (
                    <>
                      <button
                        onClick={handleCopyNotes}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Copy notes"
                        title="Copy notes to clipboard"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        aria-label="Export as PDF"
                        title="Export notes as PDF"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Save Notes
                      </button>
                    </>
                  )}
                </div>
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