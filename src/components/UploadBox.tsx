import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2 } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface UploadBoxProps {
  onUpload: (content: string, title: string) => void;
}

export default function UploadBox({ onUpload }: UploadBoxProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      let combinedContent = '';
      let combinedTitle = acceptedFiles.length > 1 
        ? `Multi-Doc Analysis (${acceptedFiles.length} files)` 
        : acceptedFiles[0].name;

      for (const file of acceptedFiles) {
        let content = '';
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          }
          content = fullText;
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else if (file.type === 'text/plain') {
          content = await file.text();
        } else {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        if (content.trim().length > 0) {
          combinedContent += `--- DOCUMENT: ${file.name} ---\n${content}\n\n`;
        }
      }

      if (combinedContent.trim().length === 0) {
        throw new Error('Files appear to be empty');
      }

      onUpload(combinedContent, combinedTitle);
    } catch (err: any) {
      console.error('File processing error:', err);
      setError(err.message || 'Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: true
  } as any);

  return (
    <div className="w-full max-w-[900px] mx-auto px-8">
      <div 
        {...getRootProps()} 
        className={`
          relative h-[300px] glass-morphism rounded-[40px] flex flex-col items-center justify-center cursor-pointer transition-all group
          ${isDragActive ? 'bg-white/10 border-emerald-500/50' : 'hover:bg-white/5 hover:border-white/20'}
          ${isProcessing ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
            <p className="text-[18px] font-medium text-white/60">Processing document...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-white/5 rounded-[24px] flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
              <Upload className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-[24px] font-display font-bold text-white mb-2">Drop your file here</p>
              <p className="text-[16px] text-white/40 font-medium">or click to browse (PDF, DOCX, TXT)</p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-between">
          <span className="text-[14px] font-medium">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}
