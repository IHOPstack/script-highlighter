function cleanCharacterName(name) {
    return name.replace(/\s{3,}.*$/, '').trim();
}
async function calibratePDF(pdf, pdfjsLib, numPagesSample = 5) {
    let characterXPositions = [];
    let dialogueXPositions = [];

    for (let i = 1; i <= Math.min(numPagesSample, pdf.numPages); i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        lines.forEach((line, index) => {
            if (line.text === line.text.toUpperCase() && line.text.length < 30 && lines[index + 1]?.text !== lines[index + 1]?.text.toUpperCase()) {
                characterXPositions.push(line.x);
            } else if (index > 0 && lines[index - 1].text === lines[index - 1].text.toUpperCase()) {
                dialogueXPositions.push(line.x);
            }
        });
    }

    const medianCharacterX = calculateMedian(characterXPositions);
    const medianDialogueX = calculateMedian(dialogueXPositions);

    return { characterX: medianCharacterX, dialogueX: medianDialogueX };
}

function calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
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

    const Y_THRESHOLD = 3;  // Adjust as needed
    const X_MARGIN_THRESHOLD = 100; // For dete cting character-names, dialogue, etc

    for (const item of sortedItems) {
        const {str, transform} = item;
        const [x, y] = [transform[4], transform[5]];

        if (currentLine.y === null || Math.abs(y - currentLine.y) <= Y_THRESHOLD) {
            // Same line:  Append
            currentLine.text += str + " ";
            currentLine.y = y;  // Update y (smoother)
            if (currentLine.x === null) currentLine.x = x;  // Only set x if it's null
        } else {
            // New line: Push the current, start a new
            if (currentLine.text.trim()) {
                lines.push({
                    text: currentLine.text.trim(),
                    x: currentLine.x,
                    y: currentLine.y
                });
            }
            currentLine = {text: str + " ", y: y, x: x};
        }
    }

    // Don't forget the last line:
    if (currentLine.text.trim()) {
        lines.push({
            text: currentLine.text.trim(), 
            x: currentLine.x, 
            y: currentLine.y
        });
    }

    return lines;  // Correct the order
}

export async function extractCharacters(pdfBuffer, pdfjsLib) {
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const characters = new Set();
    const maxNameLength = 30;
    const groupDialogueKeywords = ['EVERYONE', 'BOTH', 'ALL'];
    const nonCharacterKeywords = ['FADE', 'CUT', 'DISSOLVE', 'TRANSITION'];

    // Calibrate the PDF
    const { characterX, dialogueX } = await calibratePDF(pdf, pdfjsLib);
    const xTolerance = 10; // Tolerance for x position variation

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const lines = constructLineFromItems(textContent.items);

        for (let j = 0; j < lines.length; j++) {
            const line = lines[j];
            const trimmedText = line.text.trim();
            console.log(trimmedText, line.x)

            // Skip empty lines and lines containing non-character keywords
            if (!trimmedText || nonCharacterKeywords.some(keyword => trimmedText.includes(keyword))) {
                continue;
            }

            // Check if the line is likely a character name based on x position and other criteria
            if (Math.abs(line.x - characterX) < xTolerance) {
                console.log("Potential Character Line: ", trimmedText, "X-value: ", line.x);
            }
            if (Math.abs(line.x - characterX) < xTolerance &&
                trimmedText === trimmedText.toUpperCase() &&
                trimmedText.length > 1 &&
                trimmedText.length <= maxNameLength &&
                /[A-Z]/.test(trimmedText) &&
                !/^\d+$/.test(trimmedText) &&
                j < lines.length - 1 && // Ensure there's a next line
                Math.abs(lines[j + 1].x - dialogueX) < xTolerance) // Check if next line is likely dialogue
            {
                let cleanedText = trimmedText.split('(')[0].trim(); // Remove parentheticals like "(CONT'D)" or "(V.O.)"
                cleanedText = cleanedText.split(/\s+/).filter(word => !word.includes('*')).join(' ').trim();

                if (!groupDialogueKeywords.includes(cleanedText)) {
                    characters.add(cleanCharacterName(cleanedText));
                }
            }
        }
    }

    return Array.from(characters).sort();
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
function measureLines(items, margin = 1) {
    const lines = [];
    items.sort((a,b) => (a.transform[5] - b.transform[5]) || (a.transform[4] - b.transform[4]));
    
    let current = { top: items[0]?.transform[5] || 0, text: '' };
    items.forEach(item => {
       if(Math.abs(item.transform[5] - current.top) > margin) {
          if(current.text) lines.push(current.text.trim());
          current = { top: item.transform[5], text: item.str };
       } else {
          current.text += ' ' + item.str;
       }
    });
    
    if(current.text) lines.push(current.text.trim());
    return lines;
 }
 
 function detectScriptElement(line, {CHARACTER_MARGIN, DIALOGUE_MARGIN}) {
 
 }