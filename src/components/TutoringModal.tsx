import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
import type { RoadmapNode, TutoringMessage } from '../types/roadmap';
import { generateTutoringNotes, askTutoringQuestion } from '../api/tutoring';
import { getTutoringSession, saveTutoringSession, addTutoringMessage } from '../lib/storage';

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
    
    // Reset character spacing to prevent letter spacing issues
    doc.setCharSpace(0);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    
    // Helper to strip markdown syntax for PDF
    const stripMarkdown = (text: string) => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '$1')           // **bold**
        .replace(/\*(.+?)\*/g, '$1')               // *italic*
        .replace(/\*\*\*(.+?)\*\*\*/g, '$1')       // ***bold italic***
        .replace(/\* \*(.+?)\* \*/g, '$1')         // * *spaced italic* *
        .replace(/\* \* \*(.+?)\* \* \*/g, '$1')   // * * *spaced bold* * *
        .replace(/`(.+?)`/g, '$1')                 // `code`
        .replace(/#{1,6}\s+/g, '')                 // # headers
        .replace(/^\s*[-*]\s+/, '')                // list markers
        .replace(/^\s*\d+\.\s+/, '');              // numbered list markers
    };
    
    // Helper to clean up weird character spacing from AI output
    const cleanSpacedText = (text: string) => {
      return text
        // Fix spaced acronyms like "S D L C" -> "SDLC"
        .replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\s+([A-Z])\b/g, '$1$2$3$4')
        .replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\b/g, '$1$2$3')
        .replace(/\b([A-Z])\s+([A-Z])\b/g, '$1$2')
        // Fix words with excessive internal spacing (3+ spaces between chars)
        .replace(/([a-zA-Z])\s{2,}([a-zA-Z])/g, '$1 $2')
        // Fix spaced punctuation
        .replace(/\s+([.,;:!?)}\]])/g, '$1')
        .replace(/([([{])\s+/g, '$1')
        .trim();
    };
    
    // Helper to check if line is a markdown table row
    const isTableRow = (line: string) => {
      const trimmed = line.trim();
      return trimmed.startsWith('|') && trimmed.includes('|', 1);
    };
    
    // Helper to parse table row into readable text
    const parseTableRow = (line: string) => {
      const cells = line.split('|').map(c => stripMarkdown(c.trim())).filter(c => c.length > 0);
      // Skip separator rows like |---|---|
      if (cells.every(c => /^[-:]+$/.test(c))) return null;
      return cells.join(' — ');
    };
    
    // Helper to add wrapped text and return new y position
    const addText = (text: string, x: number, y: number, fontSize: number, fontStyle: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [40, 40, 40], maxWidth = contentWidth) => {
      const cleaned = cleanSpacedText(text);
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(...color);
      doc.setCharSpace(0); // Ensure no character spacing
      
      // Use splitTextToSize for proper word wrapping
      const lines = doc.splitTextToSize(cleaned, maxWidth);
      
      // Get actual line height from the document (in mm)
      const lineHeight = doc.getLineHeight();
      
      lines.forEach((line: string, idx: number) => {
        doc.text(line, x, y + idx * lineHeight);
      });
      return y + lines.length * lineHeight;
    };
    
    let yPos = margin;
    
    // Title
    yPos = addText(node.label, margin, yPos, 22, 'bold', [22, 101, 52]);
    yPos += 4;
    
    // Course title
    yPos = addText(courseTitle, margin, yPos, 12, 'normal', [100, 100, 100]);
    yPos += 2;
    
    // Module description
    yPos = addText(node.description, margin, yPos, 10, 'normal', [80, 80, 80]);
    yPos += 6;
    
    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    // Parse markdown content
    const lines = notes.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (yPos > pageHeight - 20) {
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
          doc.setFont('courier', 'normal');
          doc.setFontSize(9);
          doc.setCharSpace(0);
          const lineHeight = doc.getLineHeight();
          const blockHeight = codeBlockContent.length * lineHeight + 8;
          if (yPos + blockHeight > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }
          doc.roundedRect(margin, yPos - 2, contentWidth, blockHeight, 2, 2, 'F');
          doc.setTextColor(60, 60, 60);
          codeBlockContent.forEach((cl, idx) => {
            doc.text(cl, margin + 4, yPos + 6 + idx * lineHeight);
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
      
      const cleanLine = stripMarkdown(line);
      
      // Headers
      if (line.startsWith('# ')) {
        yPos = addText(cleanLine.substring(2), margin, yPos, 18, 'bold', [22, 101, 52]);
        yPos += 3;
      } else if (line.startsWith('## ')) {
        yPos = addText(cleanLine.substring(3), margin, yPos, 15, 'bold', [40, 40, 40]);
        yPos += 2;
      } else if (line.startsWith('### ')) {
        yPos = addText(cleanLine.substring(4), margin, yPos, 13, 'bold', [60, 60, 60]);
        yPos += 2;
      } else if (line.startsWith('> ')) {
        // Blockquote
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(22, 101, 52);
        doc.setLineWidth(2);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setCharSpace(0);
        const quoteText = cleanLine.substring(2);
        const quoteLines = doc.splitTextToSize(quoteText, contentWidth - 10);
        const lineHeight = doc.getLineHeight();
        const quoteHeight = quoteLines.length * lineHeight + 6;
        if (yPos + quoteHeight > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }
        doc.roundedRect(margin, yPos - 2, contentWidth, quoteHeight, 1, 1, 'FD');
        doc.setTextColor(100, 100, 100);
        // Write each line individually to avoid array text issues
        quoteLines.forEach((ql: string, idx: number) => {
          doc.text(ql, margin + 5, yPos + 3 + idx * lineHeight);
        });
        yPos += quoteHeight + 4;
      } else if (isTableRow(line)) {
        // Handle markdown tables
        const parsed = parseTableRow(line);
        if (parsed) {
          yPos = addText(parsed, margin, yPos, 10, 'normal', [60, 60, 60]);
        }
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        yPos = addText('• ' + cleanLine.substring(2), margin + 5, yPos, 11, 'normal', [40, 40, 40], contentWidth - 5);
      } else if (line.match(/^\d+\.\s/)) {
        // Numbered list
        yPos = addText(cleanLine, margin + 5, yPos, 11, 'normal', [40, 40, 40], contentWidth - 5);
      } else if (line.trim() === '') {
        yPos += 4;
      } else {
        // Regular text
        yPos = addText(cleanLine, margin, yPos, 11, 'normal', [40, 40, 40]);
      }
    }
    
    // Footer - add to each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 15;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(130, 130, 130);
      doc.setCharSpace(0);
      doc.text('Made with SyllabusGPS', pageWidth / 2, footerY, { align: 'center' });
      
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
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role !== 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-100">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.428 1.428a.75.75 0 00-1.06 1.06L11.19 8H9.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H14a.75.75 0 100-1.5H11.19l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H9.896l1.707-1.707a.75.75 0 00-1.06-1.06L2.25 9.75a.75.75 0 000 1.06l.428.428zm4.714 0a.75.75 0 00-1.06 1.06L12.72 8H10.5a.75.75 0 000 1.5h.098v4.758a.75.75 0 001.5 0v-4.5H16a.75.75 0 100-1.5H12.72l1.757-1.757a.75.75 0 10-1.06-1.06l-3.5 3.5a.75.75 0 000 1.06l3.5 3.5a.75.75 0 101.06-1.06l-1.757-1.757h.098a.75.75 0 000-1.5H10.896l1.707-1.707a.75.75 0 00-1.06-1.06L5.25 9.75a.75.75 0 000 1.06l.428.428z" />
                          </svg>
                        </div>
                      )}
                      <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-full p-4 rounded-2xl ${
                          msg.role === 'user' ? 'bg-blue-50 text-blue-900 rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        } prose prose-sm max-w-none whitespace-pre-wrap`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        <p className={`text-xs text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>{new Date(msg.timestamp).toLocaleTimeString()}</p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                        </div>
                      )}
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