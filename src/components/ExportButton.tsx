import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { PDFService } from '../services/pdfService';
import { Download, FileText, FileCode, FileType, Loader2, Info } from 'lucide-react';

interface ExportButtonProps {
  title: string;
  content: string;
  summary?: string;
  paraphrase?: string;
}

export default function ExportButton({ title, content, summary, paraphrase }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportAsTXT = () => {
    const text = `TITLE: ${title}\n\nORIGINAL CONTENT:\n${content}\n\nSUMMARY:\n${summary || 'N/A'}\n\nPARAPHRASE:\n${paraphrase || 'N/A'}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${title.replace(/\s+/g, '_')}_analysis.txt`);
  };

  const exportAsPDF = () => {
    const doc = new jsPDF();
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;

    doc.setFontSize(20);
    doc.text(title, margin, 20);

    doc.setFontSize(12);
    let y = 30;

    const addSection = (header: string, body: string) => {
      if (!body) return;
      doc.setFont('helvetica', 'bold');
      doc.text(header, margin, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(body, maxLineWidth);
      lines.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 6;
      });
      y += 10;
    };

    addSection('SUMMARY', summary || '');
    addSection('PARAPHRASE', paraphrase || '');
    addSection('ORIGINAL CONTENT', content);

    try {
      doc.save(`${title.replace(/\s+/g, '_')}_analysis.pdf`);
    } catch (error) {
      console.warn('PDF save failed, using fallback:', error);
      const blob = doc.output('blob');
      saveAs(blob, `${title.replace(/\s+/g, '_')}_analysis.pdf`);
    }
  };

  const exportAsDOCX = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'SUMMARY', bold: true, size: 24 })],
          }),
          new Paragraph({ text: summary || 'N/A' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'PARAPHRASE', bold: true, size: 24 })],
          }),
          new Paragraph({ text: paraphrase || 'N/A' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [new TextRun({ text: 'ORIGINAL CONTENT', bold: true, size: 24 })],
          }),
          new Paragraph({ text: content }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title.replace(/\s+/g, '_')}_analysis.docx`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-all shadow-lg"
      >
        <Download className="w-4 h-4" />
        Export Results
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 bottom-full mb-4 w-48 glass-morphism-heavy rounded-2xl p-2 z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <button
              onClick={() => { exportAsPDF(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-all text-left"
            >
              <FileType className="w-4 h-4 text-red-400" />
              <span className="text-[14px] font-bold">Export PDF</span>
            </button>
            <button
              onClick={() => { exportAsDOCX(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-all text-left"
            >
              <FileCode className="w-4 h-4 text-blue-400" />
              <span className="text-[14px] font-bold">Export DOCX</span>
            </button>
            <button
              onClick={() => { exportAsTXT(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-all text-left"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-[14px] font-bold">Export TXT</span>
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => { PDFService.generateProjectDocumentation(); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-500/10 text-emerald-400/80 hover:text-emerald-400 transition-all text-left"
            >
              <Info className="w-4 h-4" />
              <span className="text-[14px] font-bold">Project Docs PDF</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
