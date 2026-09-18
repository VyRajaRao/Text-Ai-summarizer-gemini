import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export class PDFService {
  static generateProjectDocumentation() {
    console.log('Starting PDF generation...');
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Helper for centered text
      const centerText = (text: string, y: number, size = 12, style = 'normal') => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
      };

      // Title Page
      doc.setFillColor(15, 23, 42); // Dark blue background
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      centerText('CLARITY: TECHNICAL DOCUMENTATION', 25, 22, 'bold');
      
      doc.setTextColor(0, 0, 0);
      centerText('Project Architecture & System Design', 55, 16, 'bold');
      centerText(`Generated on: ${new Date().toLocaleDateString()}`, 65, 10, 'italic');

      // 1. Project Overview
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Project Overview', 20, 85);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const overview = "Clarity is a high-performance document analysis and intelligent chat platform. It leverages Google's Gemini Pro and Flash models to provide deep insights, summarization, and interactive querying of complex documents. The system is designed with a focus on scalability, security, and high availability through advanced API key management.";
      doc.text(doc.splitTextToSize(overview, pageWidth - 40), 20, 95);

      // 2. High-Level Architecture
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('2. System Architecture', 20, 125);
      
      // Simplified Architecture Diagram using lines/boxes
      doc.setDrawColor(200, 200, 200);
      doc.rect(20, 135, 40, 20); // Frontend
      doc.text('Frontend', 25, 147);
      
      doc.line(60, 145, 80, 145); // Arrow
      
      doc.rect(80, 135, 50, 20); // Firebase
      doc.text('Firebase (BaaS)', 85, 147);
      
      doc.line(130, 145, 150, 145); // Arrow
      
      doc.rect(150, 135, 40, 20); // Gemini
      doc.text('Gemini API', 155, 147);

      doc.setFontSize(10);
      doc.text('React + Tailwind + Vite', 20, 160);
      doc.text('Auth | Firestore | Rules', 80, 160);
      doc.text('Pro | Flash | Embed', 150, 160);

      // 3. Database Design (Firestore)
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Database Design (NoSQL)', 20, 20);
      
      const dbData = [
        ['Collection', 'Purpose', 'Key Fields'],
        ['users', 'User profiles & RBAC', 'uid, email, role (admin/user)'],
        ['documents', 'User uploaded content', 'userId, content, createdAt'],
        ['geminiKeys', 'API Key Rotation Pool', 'key, label, status, lastTested'],
        ['feedback', 'User satisfaction data', 'userId, rating, comment'],
        ['embeddings', 'Vector data for RAG', 'textHash, vector, text']
      ];

      autoTable(doc, {
        startY: 30,
        head: [dbData[0]],
        body: dbData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      });

      // 4. Authentication & Authorization
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const finalY = (doc as any).lastAutoTable?.finalY || 80;
      doc.text('4. Auth & Authorization (RBAC)', 20, finalY + 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const authDesc = "Authentication is handled via Firebase Auth (Google OAuth 2.0). Authorization is enforced through server-side Firestore Security Rules. A custom Role-Based Access Control (RBAC) system distinguishes between standard users and administrators, protecting sensitive operations like API key management.";
      doc.text(doc.splitTextToSize(authDesc, pageWidth - 40), 20, finalY + 30);

      // 5. API Key Rotation Logic
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('5. Advanced API Key Rotation', 20, 20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const rotationDesc = "To bypass rate limits and ensure 100% uptime, Clarity implements a custom rotation algorithm:\n\n" +
        "1. Hybrid Sourcing: Combines Env Vars and Firestore keys.\n" +
        "2. Round-Robin Selection: Cycles through active keys for each request.\n" +
        "3. Auto-Failover: Detects 429 (Rate Limit) errors and immediately rotates to a fresh key.\n" +
        "4. Health Auditing: Real-time integrity checks to prune invalid keys.";
      doc.text(doc.splitTextToSize(rotationDesc, pageWidth - 40), 20, 30);

      // 6. RAG & AI Pipeline
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('6. RAG Pipeline (Retrieval Augmented Generation)', 20, 90);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const ragDesc = "1. Ingestion: Documents are chunked and hashed.\n" +
        "2. Embedding: Gemini Embedding-001 generates 768-dim vectors.\n" +
        "3. Storage: Vectors are stored in Firestore with metadata.\n" +
        "4. Retrieval: Cosine similarity search finds relevant chunks.\n" +
        "5. Generation: Gemini Pro 1.5 processes context + query for accurate answers.";
      doc.text(doc.splitTextToSize(ragDesc, pageWidth - 40), 20, 100);

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Clarity Technical Docs | Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      console.log('Saving PDF...');
      try {
        doc.save('Clarity_Technical_Documentation.pdf');
        console.log('PDF saved successfully via doc.save().');
      } catch (saveError) {
        console.warn('doc.save() failed, trying fallback:', saveError);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Clarity_Technical_Documentation.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        console.log('PDF download triggered via fallback.');
      }
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  }
}
