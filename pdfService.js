import { ScriptLine } from './dataManagement.js';

function cleanCharacterName(name) {
    return name.split(/\s*\(/)[0].trim();
}

function calculateMode(numbers) {
    let frequencyMap = {}
    numbers.forEach((num) => { frequencyMap[num] = (frequencyMap[num] || 0) + 1 })
    let highestValue = 0
    let mode = null
    for (const key in frequencyMap) {
        if (frequencyMap[key] >= highestValue) {
            highestValue = frequencyMap[key]
            mode = key
        }
    }
    return mode
}
export async function calibratePDF(pdf, pdfjsLib, numPagesSample = Math.max(5, pdf.numPages / 10)) {
    let characterXPositions = [], parentheticalXPositions = [], dialogueXPositions = [];
    console.log('calibrating');

    for (let i = 1; i <= Math.min(numPagesSample, pdf.numPages); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        lines.forEach((line, index) => {
            const trimmedText = line.text.trim();
            if (trimmedText === trimmedText.toUpperCase() && !trimmedText.includes('.')) {
                characterXPositions.push(line.x);
                console.log('character line: ', line.text);
            } else if (trimmedText.startsWith('(') && trimmedText.endsWith(')') && characterXPositions.includes(lines[index - 1]?.x)) {
                parentheticalXPositions.push(line.x);
            } else if (characterXPositions.includes(lines[index - 1]?.x) || parentheticalXPositions.includes(lines[index - 1]?.x)) {
                dialogueXPositions.push(line.x);
            }
        });
    }
    return {
        characterX: calculateMode(characterXPositions),
        parentheticalX: calculateMode(parentheticalXPositions),
        dialogueX: calculateMode(dialogueXPositions)
    };
}

export async function extractCharacters(pdfBuffer, pdfjsLib, pdfPageMap = new PDFPageMap()) {
    console.log('extracting');
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const characters = new Set();
    const uncertainCharacters = new Set();
    const X_TOLERANCE = 0.005;

    const { characterX, parentheticalX, dialogueX } = await calibratePDF(pdf, pdfjsLib);
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        let currentCharacter = null;
        lines.forEach(line => {
            if (Math.abs(line.x - characterX) <= X_TOLERANCE) {
                line.type = 'character';
                const cleanedName = cleanCharacterName(line.text);
                currentCharacter = cleanedName
                characters.add(cleanedName);
            } else if (Math.abs(line.x - parentheticalX) <= X_TOLERANCE) {
                line.type = 'parenthetical';
                line.speakingCharacter = currentCharacter
            } else if (Math.abs(line.x - dialogueX) <= X_TOLERANCE) {
                line.type = 'dialogue';
                line.speakingCharacter = currentCharacter
            }
        });

        pdfPageMap.setPageLines(pageNum, lines);
    }

    return Array.from(characters).sort();
}

function constructLineFromItems(items) {
    const sortedItems = items.sort((a, b) => {
        const verticalDiff = b.transform[5] - a.transform[5];
        if (Math.abs(verticalDiff) > 2) return verticalDiff;
        return a.transform[4] - b.transform[4];
    });

    const standardSpaceWidth = 7; // Standard space width across most documents
    const MAX_WORD_GAP = standardSpaceWidth * 3;
    const MIN_WORD_GAP = standardSpaceWidth * 0.5;


    const lines = [];
    let currentLine = { text: "", y: null, x: null, endX: null };

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
            currentLine = { text: item.str, y: y, x: x, endX: x + itemWidth };
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
export async function highlightPDF(pdfDoc, characters, PDFLib, pdfjsLib, pageMap) {
    const pdfBytes = await pdfDoc.save();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const newPdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

    const numPages = pdf.numPages;
    const pages = newPdfDoc.getPages();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = pages[pageNum - 1];
        const { height } = page.getSize();
        const lines = pageMap.getPageLines(pageNum) || [];

        lines.forEach(line => {
            if (line.isDialogue()) {
                const matchedCharacter = characters.find(c => c.name === line.speakingCharacter);
                if (matchedCharacter) {
                    const { r, g, b } = matchedCharacter.color;
                    page.drawRectangle({
                        x: line.x,
                        y: line.y,
                        width: line.width(),
                        height: line.height || 10,
                        color: PDFLib.rgb(r, g, b),
                        opacity: 0.3
                    });
                }
            }
        });
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