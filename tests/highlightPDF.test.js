import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import { highlightPDF } from '../services/highlighter.js';

describe('highlightPDF', () => {
  const inputPdfPath = '/Users/devinbeckwith/codezone/highlighter/tests/test_script.pdf';
  const outputPdfPath = path.join(__dirname, 'test_output.pdf');
  const characters = ["ASH", "VICTOR", "BEN", "GIUSEPPE", "QUINN", "ZOE", "BIGGY", "SMALLS", "BOOMBOX", "CARSEAT", "SNEAKERS", "CONVENTION WORKER", "GHOST OF BOB FOSSE"];

  afterEach(() => {
    // Clean up the output PDF after each test
    if (fs.existsSync(outputPdfPath)) {
      fs.unlinkSync(outputPdfPath);
    }
  });

  it('should highlight lines for a given character', async () => {
    const characterName = 'ASH';
    const highlightColor = rgb(1, 1, 0);

    await highlightPDF(inputPdfPath, outputPdfPath, characterName, highlightColor);

    // Load the output PDF and verify its contents
    const outputPdfBytes = fs.readFileSync(outputPdfPath);
    const pdfDoc = await PDFDocument.load(outputPdfBytes);

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const annotations = page.getAnnotations();
      expect(annotations.length).toBeGreaterThan(0); // Expect at least one annotation
    }
  });

  it('should handle multiple characters', async () => {
    for (const characterName of characters) {
      const outputPdfPath = path.join(__dirname, `test_output_${characterName}.pdf`);

      await highlightPDF(inputPdfPath, outputPdfPath, characterName);

      // Load the output PDF and verify its contents
      const outputPdfBytes = fs.readFileSync(outputPdfPath);
      const pdfDoc = await PDFDocument.load(outputPdfBytes);

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const annotations = page.getAnnotations();
        expect(annotations.length).toBeGreaterThan(0); // Expect at least one annotation
      }

      // Clean up the output PDF after the test
      fs.unlinkSync(outputPdfPath);
    }
  });
});
