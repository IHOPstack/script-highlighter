export async function extractCharacters(pdfBuffer, pdfjsLib) {
    const pdf = await pdfjsLib.getDocument(pdfBuffer).promise;
    const characters = new Set();
    const maxNameLength = 30;
    const groupDialogueKeywords = ['EVERYONE', 'BOTH', 'ALL'];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            const trimmedText = item.str.trim();

            // Skip lines completely encased in parentheses
            if (trimmedText.startsWith('(') && trimmedText.endsWith(')')) {
                continue;
            }

            // Check if the text is all uppercase, not too long, and not just numbers
            if (trimmedText === trimmedText.toUpperCase() && 
                trimmedText.length > 1 && 
                trimmedText.length <= maxNameLength &&
                /[A-Z]/.test(trimmedText) && 
                !/^\d+$/.test(trimmedText))
            {
                // Check if the next line is not all uppercase (to avoid including scene headings)
                const nextItem = items[j + 1];
                if (nextItem && nextItem.str.trim() !== nextItem.str.trim().toUpperCase()) {
                    // Remove any text in parentheses
                    const cleanedText = trimmedText.split('(')[0].trim();
                    
                    // Exclude group dialogue keywords
                    if (!groupDialogueKeywords.includes(cleanedText)) {
                        characters.add(cleanedText);
                    }
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
                    console.log('New line detected, stop highlighting for all characters');
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