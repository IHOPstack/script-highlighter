import { highlightPDF } from '../services/highlighter.js';
import { fs } from 'fs';
import pdf from 'pdf-parse';

test('highlightPDF creates annotations for character lines', async () => {
  const inputPdf = 'test_script.pdf';
  const outputPdf = 'test_output.pdf';
  const character = 'ASH';

  await highlightPDF(inputPdf, outputPdf, character);

  const dataBuffer = fs.readFileSync(outputPdf);
  const data = await pdf(dataBuffer);

  expect(data.numpages).toBe(1);
  expect(data.text).toContain("ASH's line");
  // You might also check for the presence of annotations, 
  // though this depends on the capabilities of the parsing library
});
