import fs from 'fs';
import { PDFDocument, rgb } from 'pdf-lib';
import { pdfParse } from 'pdf-parse';
import { extractCharacters } from './characterExtractor.js';

export async function highlightPDF(inputPdfPath, outputPdfPath, characterName, highlightColor = rgb(1, 1, 0)) {
  const inputPdfBytes = fs.readFileSync(inputPdfPath);
  const pdfData = await pdfParse(inputPdfBytes);

  const outputPdfDoc = await PDFDocument.create();
  const outputPdfPages = [];

  for (let pageIndex = 1; pageIndex <= pdfDoc.numPages; pageIndex++) {
    const page = await pdfDoc.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const blocks = textContent.items.map(item => item.str.trim());

    let isCharacterSpeaking = false;
    let currentPage = await outputPdfDoc.addPage();

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];

      if (!block) continue; // Skip empty blocks

      if (block === characterName.toUpperCase()) {
        isCharacterSpeaking = true;
        continue; // Skip the character name block
      }

      if (isCharacterSpeaking) {
        if (block.toUpperCase() === block) { // New character found
          isCharacterSpeaking = false;
        } else if (block.startsWith('(') && block.endsWith(')')) { // Parenthetical
          continue; // Skip parentheticals
        } else if (!/\w/.test(block)) { // Action line
          isCharacterSpeaking = false; // Reset after action line
        } else {
          // Highlight the block
          // Note: You will need to calculate the bounding box for the block
          // This can be complex and might require additional libraries
          // For simplicity, let's just highlight the entire page
          currentPage.drawLine({
            start: { x: 0, y: 0 },
            end: { x: currentPage.getWidth(), y: currentPage.getHeight() },
            thickness: 10,
            color: highlightColor,
            opacity: 0.5,
          });
          isCharacterSpeaking = false;
        }
      }
    }
  }

  const outputPdfBytes = await outputPdfDoc.save();
  fs.writeFileSync(outputPdfPath, outputPdfBytes);
}
