// Centralized pdf.js loader for Vite.
// Uses ?url to let Vite resolve the worker file path at build time.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.js?url';

// Assign resolved worker URL
GlobalWorkerOptions.workerSrc = workerSrc;

export { getDocument, GlobalWorkerOptions }; 
