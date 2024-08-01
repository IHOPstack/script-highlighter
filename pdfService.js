import { ScriptLine } from './dataManagement.js';

function cleanCharacterName(name) {
    return name.split(/\s*\(/)[0].trim();
}

function calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function calibratePDF(pdf, pdfjsLib, numPagesSample = 5) {
    let characterXPositions = [], parentheticalXPositions = [], dialogueXPositions = [];

    for (let i = 1; i <= Math.min(numPagesSample, pdf.numPages); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        lines.forEach((line, index) => {
            const trimmedText = line.text.trim();
            if (trimmedText === trimmedText.toUpperCase() && trimmedText.length < 30) {
                characterXPositions.push(line.x);
            } else if (trimmedText.startsWith('(') && trimmedText.endsWith(')') && characterXPositions.includes(lines[index - 1]?.x)) {
                parentheticalXPositions.push(line.x);
            } else if (characterXPositions.includes(lines[index - 1]?.x) || parentheticalXPositions.includes(lines[index - 1]?.x)) {
                dialogueXPositions.push(line.x);
            }
        });
    }

    return {
        characterX: calculateMedian(characterXPositions),
        parentheticalX: calculateMedian(parentheticalXPositions),
        dialogueX: calculateMedian(dialogueXPositions)
    };
}

export async function extractCharacters(pdfBuffer, pdfjsLib, pdfPageMap = new PDFPageMap()) {
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const characters = new Set();
    const uncertainCharacters = new Set();
    const X_TOLERANCE = 0.005;

    const { characterX, parentheticalX, dialogueX } = await calibratePDF(pdf, pdfjsLib);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        lines.forEach(line => {
            if (Math.abs(line.x - characterX) <= X_TOLERANCE) {
                line.type = 'character';
                const cleanedName = cleanCharacterName(line.text);
                characters.add(cleanedName);
            } else if (Math.abs(line.x - parentheticalX) <= X_TOLERANCE) {
                line.type = 'parenthetical';
            } else if (Math.abs(line.x - dialogueX) <= X_TOLERANCE) {
                line.type = 'dialogue';
            }
        });

        pdfPageMap.setPageLines(pageNum, lines);
    }

    return Array.from(characters).sort();
}

function getStandardSpaceWidth(items) {
    // First, try to find a standalone space
    const spaceItem = items.find(item => item.str.trim() === '' && item.str.length === 1);
    if (spaceItem && spaceItem.width > 0) return spaceItem.width;

    // If no standalone space, calculate using consecutive items
    for (let i = 0; i < items.length - 1; i++) {
        if (items[i].str.trim() && items[i+1].str.trim()) {  // Two consecutive non-empty items
            const gap = items[i+1].transform[4] - (items[i].transform[4] + items[i].width);
            if (gap > 0) return gap;  // If we found a positive gap, use it
        }
    }

    // If all fails, default
    return 7;  // Default
}

function constructLineFromItems(items) {
    const sortedItems = items.sort((a, b) => {
        const verticalDiff = b.transform[5] - a.transform[5];
        if (Math.abs(verticalDiff) > 2) return verticalDiff;
        return a.transform[4] - b.transform[4];
    });

    const standardSpaceWidth = getStandardSpaceWidth(sortedItems);
    const MAX_WORD_GAP = standardSpaceWidth * 3;  
    const MIN_WORD_GAP = standardSpaceWidth * 0.5;  // NEW: For tightly spaced PDFs


    const lines = [];
    let currentLine = {text: "", y: null, x: null, endX: null};

    for (const item of sortedItems) {
        const x = item.transform[4];
        const y = item.transform[5];
        const itemWidth = item.width || (item.str.length * standardSpaceWidth);

        const gap = currentLine.endX !== null ? x - currentLine.endX : 0;
        const isNewVerticalLine = currentLine.y === null || Math.abs(y - currentLine.y) > 3;
        const isHorizontalContinuation = !isNewVerticalLine && (gap <= MAX_WORD_GAP);

        // Crucial: Don't append empty items or items that are just whitespace
        const shouldAppendItem = item.str.trim().length > 0 || (gap >= MIN_WORD_GAP && gap <= MAX_WORD_GAP);

        if (isNewVerticalLine || !isHorizontalContinuation) {
            if (currentLine.text.trim()) {
                lines.push(new ScriptLine(currentLine.text.trim(), currentLine.x, currentLine.y, currentLine.endX));
            }
            currentLine = {text: item.str, y: y, x: x, endX: x + itemWidth};
        } else if (shouldAppendItem) {
            const addSpace = gap >= MIN_WORD_GAP ? ' ' : '';
            currentLine.text += addSpace + item.str;
            currentLine.endX = x + itemWidth;
        }
    }

    if (currentLine.text.trim()) {
        lines.push(new ScriptLine(currentLine.text.trim(), currentLine.x, currentLine.y, currentLine.endX));
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

            // Check if this text is a character name
            const matchingCharacter = characters.find(char => char.name.toUpperCase() === text.toUpperCase());
            if (matchingCharacter) {
                speakingCharacters.clear(); // Clear previous speaking characters
                speakingCharacters.add(matchingCharacter);
                continue;
            }

            // Highlight text for speaking characters
            for (const character of speakingCharacters) {
                if (text.toUpperCase() === text && text.length > 1) {
                    speakingCharacters.delete(character);
                } else if (text.startsWith("(") && text.endsWith(")")) {
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