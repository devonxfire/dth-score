// OCRImport.jsx
// React component for uploading an image, running OCR, and extracting names for 4-ball assignment
import React, { useRef, useState } from 'react';

// Lazy-load Tesseract.js for OCR
const loadTesseract = () => import('tesseract.js');

export default function OCRImport({ onNamesExtracted }) {
  const [image, setImage] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    setError('');
    setOcrText('');
    const file = e.target.files[0];
    if (!file) return;
    setImage(URL.createObjectURL(file));
    setLoading(true);
    try {
      const { createWorker } = await loadTesseract();
      const worker = await createWorker('eng');
      const {
        data: { text },
      } = await worker.recognize(file);
      setOcrText(text);
      await worker.terminate();
      // Improved: extract only likely names (ignore phone numbers, dates, symbols, etc.)
      const names = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          if (line.length < 2) return false;
          if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) return false; // date
          if (/^\+?\d{7,}/.test(line)) return false; // phone
          if (/\d{2}:\d{2}/.test(line)) return false; // time
          if (/votes/i.test(line)) return false; // votes
          if (/[^a-zA-Z\s'-]/.test(line)) return false; // exclude lines with numbers or special chars
          // Allow single-word lines if they have at least 3 letters (for short names)
          const words = line.split(/\s+/);
          const letterWords = words.filter(w => /[a-zA-Z]/.test(w));
          if (letterWords.length >= 2) return true;
          if (letterWords.length === 1 && letterWords[0].length >= 3) return true;
          return false;
        });
      if (onNamesExtracted) onNamesExtracted(names);
    } catch (err) {
      setError('OCR failed: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 border rounded bg-white max-w-md mx-auto my-6">
      <h2 className="text-lg font-bold mb-2">Import Names from Screenshot/Photo</h2>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="mb-2"
      />
      {loading && <div className="text-blue-600">Running OCR, please wait...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {image && (
        <img src={image} alt="Uploaded" className="max-w-full max-h-48 my-2 border" />
      )}
      {ocrText && (
        <div className="mt-2">
          <div className="font-semibold">Extracted Text:</div>
          <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap">{ocrText}</pre>
        </div>
      )}
    </div>
  );
}
