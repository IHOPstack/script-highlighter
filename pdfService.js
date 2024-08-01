import { ScriptLine } from './dataManagement.js';

function cleanCharacterName(name) {
    return name.split(/\s*\(|\s{2,}/)[0].trim();
}

function calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function calibratePDF(pdf, pdfjsLib, numPagesSample = 5) {
    let characterXPositions = [];
    let dialogueXPositions = [];

    for (let i = 1; i <= Math.min(numPagesSample, pdf.numPages); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);  // This now returns ScriptLines automatically!

        lines.forEach((line, index) => {
            const nextLine = lines[index + 1];
            if (line.text === line.text.toUpperCase() && 
                line.text.length < 30 && 
                nextLine?.text !== nextLine?.text.toUpperCase()) {
                characterXPositions.push(line.x);
            } else if (index > 0 && 
                       lines[index - 1].text === lines[index - 1].text.toUpperCase()) {
                dialogueXPositions.push(line.x);
            }
        });
    }

    return { 
        characterX: calculateMedian(characterXPositions), 
        dialogueX: calculateMedian(dialogueXPositions) 
    };
}

export async function extractCharacters(pdfBuffer, pdfjsLib, pdfPageMap) {
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const characters = new Set();
    const uncertainCharacters = new Set();
    const xTolerance = 10;

    const { characterX, dialogueX } = await calibratePDF(pdf, pdfjsLib);
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        const typedLines = lines.map((line, index) => {
            const nextLine = lines[index + 1];
            if (Math.abs(line.x - characterX) < xTolerance) {
                line.type = 'character';
                const cleanedName = cleanCharacterName(line.text);
                if (nextLine && Math.abs(nextLine.x - dialogueX) < xTolerance) {
                    characters.add(cleanedName);
                } else {
                    uncertainCharacters.add(cleanedName);
                }
            } else if (Math.abs(line.x - dialogueX) < xTolerance) {
                line.type = 'dialogue';
            } else {
                line.type = 'action';
            }
            return line;
        });

        pdfPageMap.setPageLines(i, typedLines);
    }

    console.log("Total detected characters:", characters.size);
    console.log("Total uncertain characters:", uncertainCharacters.size);

    return Array.from(characters).sort();
}
function sortItemsByVerticalPosition(items) {
    // Top-to-Bottom, Left-to-Right
    return items.sort((a, b) => {
        const verticalDiff = b.transform[5] - a.transform[5];  // reverse-vertical
        if (Math.abs(verticalDiff) > 2) return verticalDiff;   // If not on same line, use vertical
        return a.transform[4] - b.transform[4];  // If on same line, Left-to-Right
    });
}

function constructLineFromItems(items) {
    const sortedItems = sortItemsByVerticalPosition(items);
    const lines = [];
    let currentLine = {text: "", y: null, x: null};

    const Y_THRESHOLD = 3;  

    for (const item of sortedItems) {
        const {str, transform} = item;
        const [x, y] = [transform[4], transform[5]];

        if (currentLine.y === null || Math.abs(y - currentLine.y) <= Y_THRESHOLD) {
            currentLine.text += str + " ";
            currentLine.y = y;
            if (currentLine.x === null) currentLine.x = x;
        } else {
            if (currentLine.text.trim()) {
                // NEW: construct ScriptLine instead of raw object
                lines.push(new ScriptLine(
                    currentLine.text.trim(), 
                    currentLine.x, 
                    currentLine.y
                ));
            }
            currentLine = {text: str + " ", y: y, x: x};
        }
    }

    if (currentLine.text.trim()) {
        // NEW: construct ScriptLine for last line as well
        lines.push(new ScriptLine(
            currentLine.text.trim(), 
            currentLine.x, 
            currentLine.y
        ));
    }

    return lines;
}

export async function highlightPDF(pdfDoc, characters, PDFLib, pdfjsLib) {
    const pdfBytes = await pdfDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const newPdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

    for (let i = 1; i <= numPages; i++) {
        const page = newPdfDoc.getPage(i - 1);
        const pdfJsPage = await pdf.getPage(i);
        const textContent = await pdfJsPage.getTextContent();
        const { width, height } = page.getSize();
        
        let speakingCharacters = new Set();

        const sortedItems = textContent.items.sort((a, b) => b.transform[5] - a.transform[5]);

        for (const item of sortedItems) {
            const text = item.str.trim();

            if (!text) continue;

            console.log(`Text: "${text}", Position: (${item.transform[4]}, ${item.transform[5]}), Size: ${item.width}x${item.height}`);

            // Check if this text is a character name
            const matchingCharacter = characters.find(char => char.name.toUpperCase() === text.toUpperCase());
            if (matchingCharacter) {
                speakingCharacters.clear(); // Clear previous speaking characters
                speakingCharacters.add(matchingCharacter);
                console.log(`Character ${matchingCharacter.name} starts speaking`);
                continue;
            }

            // Highlight text for speaking characters
            for (const character of speakingCharacters) {
                if (text.toUpperCase() === text && text.length > 1) {
                    speakingCharacters.delete(character);
                    console.log(`Character ${character.name} stops speaking`);
                } else if (text.startsWith("(") && text.endsWith(")")) {
                    console.log('Parenthetical, skipping');
                    continue;
                } else if (!/\w/.test(text)) {
                    speakingCharacters.delete(character);
                } else {
                    const rect = {
                        x: item.transform[4],
                        y: item.transform[5],
                        width: item.width,
                        height: item.height,
                    };
                    console.log(`Highlighting for ${character.name} with color:`, character.color);
                    page.drawRectangle({
                        ...rect,
                        color: PDFLib.rgb(character.color.r, character.color.g, character.color.b),
                        opacity: 0.3,
                    });
                }
            }

            if (sortedItems.indexOf(item) < sortedItems.length - 1) {
                const nextItem = sortedItems[sortedItems.indexOf(item) + 1];
                if (Math.abs(nextItem.transform[5] - item.transform[5]) > item.height) {
                    speakingCharacters.clear();
                }
            }
        }
    }

    return newPdfDoc;
}

export async function generateHeatMap(pdfDoc, characterName, PDFLib, pdfjsLib) {
    const copiedPdfDoc = await PDFLib.PDFDocument.create();
    const pages = await copiedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
    pages.forEach(page => copiedPdfDoc.addPage(page));

    const pdfJsDoc = await pdfjsLib.getDocument(await pdfDoc.save()).promise;

    for (let i = 0; i < copiedPdfDoc.getPageCount(); i++) {
        const page = copiedPdfDoc.getPage(i);
        const pdfJsPage = await pdfJsDoc.getPage(i + 1);
        const textContent = await pdfJsPage.getTextContent();
        
        let lineCount = 0;
        let isCharacterSpeaking = false;

        for (const item of textContent.items) {
            if (!item.str.trim()) continue;

            if (item.str.trim().startsWith(characterName.toUpperCase())) {
                isCharacterSpeaking = true;
                continue;
            }

            if (isCharacterSpeaking) {
                if (item.str.trim().toUpperCase() === item.str.trim() && item.str.trim().length > 1) {
                    isCharacterSpeaking = false;
                } else if (item.str.trim().startsWith('(') && item.str.trim().endsWith(')')) {
                    continue;
                } else if (!/\w/.test(item.str.trim())) {
                    isCharacterSpeaking = false;
                } else {
                    lineCount++;
                }
            }
        }

        // Highlight the entire page based on line count
        const heatColor = getHeatColor(lineCount);
        page.drawRectangle({
            x: 0,
            y: 0,
            width: page.getWidth(),
            height: page.getHeight(),
            color: PDFLib.rgb(heatColor.r, heatColor.g, heatColor.b),
            opacity: 0.3,
        });
    }

    return copiedPdfDoc;
}

function getHeatColor(lineCount) {
    const maxLines = 50; // Adjust this based on your script's typical max lines per page
    const intensity = Math.min(lineCount / maxLines, 1);
    return {
        r: intensity,
        g: 1 - intensity,
        b: 0,
    };
}