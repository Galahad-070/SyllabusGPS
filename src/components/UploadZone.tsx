import { useCallback, useRef, useState } from 'react';
import type { UploadState, RoadmapData } from '../types/roadmap';
import { uploadPdf, generateRoadmap } from '../api/groq';

const CLOUD_UPLOAD_ICON = (
  <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

interface UploadZoneProps {
  onUploadComplete: (roadmap: RoadmapData) => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>({
    file: null,
    isDragging: false,
    isLoading: false,
    error: null,
    roadmap: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: false }));
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState(prev => ({ ...prev, isDragging: false }));

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      await processFile(files[0]);
    } else {
      setState(prev => ({ ...prev, error: 'Please upload a PDF file' }));
    }
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      await processFile(files[0]);
    } else if (files && files.length > 0) {
      setState(prev => ({ ...prev, error: 'Please upload a PDF file' }));
    }
    e.target.value = '';
  }, []);

  const processFile = async (file: File) => {
    setState(prev => ({ ...prev, file, isLoading: true, error: null }));

    try {
      const uploadResult = await uploadPdf(file);
      const roadmap = await generateRoadmap(uploadResult.text);
      setState(prev => ({ ...prev, isLoading: false, roadmap }));
      onUploadComplete(roadmap);
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to process PDF',
      }));
    }
  };

  const isHovered = state.isDragging || state.isLoading;

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="w-full max-w-2xl mb-8 sm:mb-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-md mb-4">
          <svg className="w-10 h-10 sm:w-12 sm:h-12 text-green-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">SyllabusGPS</h1>
        <p className="text-gray-500 mt-1">Turn your syllabus into a study roadmap</p>
      </header>

      <main className="w-full max-w-2xl">
        <div
          className={`
            relative rounded-2xl border-2 border-dashed p-8 sm:p-12 transition-all duration-200
            ${isHovered ? 'border-green-400 bg-green-50' : 'border-green-300 bg-white hover:border-green-400 hover:bg-green-50'}
            ${state.isLoading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
          aria-label="Upload syllabus PDF"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-hidden="true"
            disabled={state.isLoading}
          />

          <div className="text-center">
            <div className="mx-auto mb-6">{CLOUD_UPLOAD_ICON}</div>
            <p className="text-lg sm:text-xl text-gray-700 font-medium mb-2">
              Drag & drop your Syllabus PDF here, or click to browse
            </p>
            <p className="text-sm text-gray-500">Supports PDF files up to 10MB</p>

            {state.file && !state.isLoading && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-left">
                <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  {state.file.name}
                </p>
                <p className="text-xs text-green-600 mt-1">{(state.file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}

            {state.isLoading && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-green-300 border-t-green-500 rounded-full animate-spin" aria-label="Processing"></div>
                <p className="text-gray-600">Analyzing syllabus and generating roadmap...</p>
              </div>
            )}

            {state.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                {state.error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}