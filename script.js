import { extractCharacters, highlightPDF, generateHeatMap } from './pdfService.js';
import { UIManager } from './uiManager.js';
import { PDFPageMap, CharacterSetManager } from './dataManagement.js';

const HIGHLIGHT_COLORS = {
    yellow: { hex: '#ffff00', rgb: {r: 1, g: 1, b: 0} },
    pink: { hex: '#ff6bff', rgb: {r: 1, g: 0.42, b: 1} },
    blue: { hex: '#1ac7ff', rgb: {r: 0.1, g: 0.78, b: 1} },
    green: { hex: '#51ff00', rgb: {r: 0.32, g: 1, b: 0} },
    orange: { hex: '#ff9b00', rgb: {r: 1, g: 0.61, b: 0} },
    purple: { hex: '#cb5eff', rgb: {r: 0.8, g: 0.37, b: 1} }
};

document.addEventListener('DOMContentLoaded', function() {
    const characterSetManager = new CharacterSetManager();
    const uiManager = new UIManager(characterSetManager, HIGHLIGHT_COLORS);
    const pdfData = new PDFPageMap();

    const uploadBtn = document.getElementById('uploadBtn');
    const highlightBtn = document.getElementById('highlightBtn');
    const previewArea = document.getElementById('previewArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const editBtn = document.getElementById('editBtn');
    const addCharacterBtn = document.getElementById('addCharacterBtn');
    
    let currentPdfDoc = null;

    uploadBtn.addEventListener('click', async function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async function(event) {
            const file = event.target.files[0];
            if (file) {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    currentPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    const characters = await extractCharacters(arrayBuffer, window.pdfjsLib, pdfData);
                    characterSetManager.setAvailableCharacters(characters);
                    uiManager.updateUI();
                } catch (error) {
                    console.error('Upload failed:', error);
                    alert('Upload failed. Please try again.');
                }
            }
        };
        input.click();
    });

    highlightBtn.addEventListener('click', async function() {
        const characters = characterSetManager.sets.filter(set => set.character).map(set => ({
            name: set.character,
            color: HIGHLIGHT_COLORS[set.color].rgb
        }));
        
        if (characters.length > 0 && currentPdfDoc) {
            try {
                const highlightedPdfDoc = await highlightPDF(currentPdfDoc, characters, PDFLib, pdfjsLib);
                const pdfBytes = await highlightedPdfDoc.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                previewArea.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="500px"></iframe>`;
            } catch (error) {
                console.error('Highlighting failed:', error);
                alert('Highlighting failed. Please try again.');
            }
        } else {
            alert('Please select at least one character and upload a script first.');
        }
    });

    addCharacterBtn.addEventListener('click', () => {
        characterSetManager.addSet();
        uiManager.updateUI();
    });

    const characterContainer = document.getElementById('characterContainer');
    
    characterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option') || e.target.closest('.color-option')) {
            const colorOption = e.target.classList.contains('color-option') ? e.target : e.target.closest('.color-option');
            const characterSet = colorOption.closest('.character-set');
            const index = parseInt(characterSet.dataset.index);
            const character = characterSet.querySelector('.characterSelect').value;
            const color = colorOption.dataset.color;
            characterSetManager.updateSet(index, character, color);
            uiManager.updateUI();
        }
    });

    characterContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('characterSelect')) {
            const characterSet = e.target.closest('.character-set');
            const index = parseInt(characterSet.dataset.index);
            const color = characterSet.querySelector('.color-option.selected').dataset.color;
            characterSetManager.updateSet(index, e.target.value, color);
            uiManager.updateUI();
        }
    });

    editBtn.addEventListener('click', async function() {
        if (currentPdfDoc && characterSetManager.sets.length > 0) {
            try {
                const heatMapPdf = await generateHeatMap(currentPdfDoc, characterSetManager.sets[0].character, PDFLib, pdfjsLib);
                const pdfBytes = await heatMapPdf.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                const heatMapDiv = document.createElement('div');
                heatMapDiv.innerHTML = `
                    <h3>Heat Map for ${characterSetManager.sets[0].character}</h3>
                    <iframe src="${pdfUrl}" width="100%" height="500px"></iframe>
                `;
                
                const existingHeatMap = document.getElementById('heatMapSection');
                if (existingHeatMap) {
                    existingHeatMap.remove();
                }
                
                heatMapDiv.id = 'heatMapSection';
                document.body.appendChild(heatMapDiv);
            } catch (error) {
                console.error('Heat map generation failed:', error);
                alert('Heat map generation failed. Please try again.');
            }
        } else {
            alert('Please select a character and upload a script first.');
        }
    });

    // Initial UI update
    uiManager.updateUI();
});
