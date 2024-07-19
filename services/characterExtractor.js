import { pdfParse } from 'pdf-parse';

export async function extractCharacters(pdfBuffer) {
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    const lines = text.split('\n');

    const characters = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === line.toUpperCase() && line.length > 0) {
            // Assume all-caps lines are character names
            characters.add(line);
        }
    }

    return Array.from(characters);
}
