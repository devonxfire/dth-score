// Route for OCR import demo
import React from 'react';
import OCRImport from './OCRImport';

export default function OCRImportPage() {
  const handleNamesExtracted = (names) => {
    // For demo, just alert the names. In production, pass to assignment logic.
    alert('Extracted names:\n' + names.join('\n'));
  };
  return (
    <div className="p-8">
      <OCRImport onNamesExtracted={handleNamesExtracted} />
    </div>
  );
}
