import { extractCharacters, highlightPDF, generateHeatMap } from './pdfService.js';

document.addEventListener('DOMContentLoaded', function() {
    const uploadBtn = document.getElementById('uploadBtn');
    const characterSelect = document.getElementById('characterSelect');
    const highlightBtn = document.getElementById('highlightBtn');
    const previewArea = document.getElementById('previewArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const editBtn = document.getElementById('editBtn');

    let currentPdfDoc = null;
    let characters = [];

    uploadBtn.addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async function(event) {
            const file = event.target.files[0];
            if (file) {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    currentPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
                    characters = await extractCharacters(arrayBuffer, window.pdfjsLib);
                    populateCharacterList(characters);
                } catch (error) {
                    alert('Upload failed. Please try again.');
                }
            }
        };
        input.click();
    });

    highlightBtn.addEventListener('click', async function() {
        const selectedCharacter = characterSelect.value;
        if (selectedCharacter && currentPdfDoc) {
            try {
                const highlightedPdfDoc = await highlightPDF(currentPdfDoc, selectedCharacter, PDFLib, pdfjsLib, selectedColor);
                const pdfBytes = await highlightedPdfDoc.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                previewArea.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="500px"></iframe>`;
            } catch (error) {
                console.error('Highlighting failed:', error);
                alert('Highlighting failed. Please try again.');
            }
        } else {
            alert('Please select a character and upload a script first.');
        }
    });
    
    let selectedColor = {r: 1, g: 1, b: 0}; // Default yellow

    const colorOptions = document.querySelectorAll('.color-option');
    
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            
            const color = this.getAttribute('data-color');
            switch(color) {
                case 'yellow': selectedColor = {r: 1, g: 1, b: 0}; break;
                case 'pink': selectedColor = {r: 1, g: 0.42, b: 1}; break;
                case 'blue': selectedColor = {r: 0.1, g: 0.78, b: 1}; break;
                case 'green': selectedColor = {r: 0.32, g: 1, b: 0}; break;
                case 'orange': selectedColor = {r: 1, g: 0.61, b: 0}; break;
                case 'purple': selectedColor = {r: 0.8, g: 0.37, b: 1}; break;
            }
            
            highlightBtn.style.backgroundColor = `rgb(${selectedColor.r * 255}, ${selectedColor.g * 255}, ${selectedColor.b * 255})`;
        });
    });
    
    // Set default selected color
    document.getElementById('yellow').classList.add('selected');
        
    highlightBtn.addEventListener('click', async function() {
        const selectedCharacter = characterSelect.value;
        if (selectedCharacter && currentPdfDoc) {
            try {
                const highlightedPdfDoc = await highlightPDF(currentPdfDoc, selectedCharacter, PDFLib, pdfjsLib, selectedColor);
                const pdfBytes = await highlightedPdfDoc.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                previewArea.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="500px"></iframe>`;
            } catch (error) {
                console.error('Highlighting failed:', error);
                alert('Highlighting failed. Please try again.');
            }
        } else {
            alert('Please select a character and upload a script first.');
        }
    });
    
    editBtn.addEventListener('click', async function() {
        if (currentPdfDoc && characterSelect.value) {
            try {
                const heatMapPdf = await generateHeatMap(currentPdfDoc, characterSelect.value, PDFLib, pdfjsLib);
                const pdfBytes = await heatMapPdf.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                const heatMapDiv = document.createElement('div');
                heatMapDiv.innerHTML = `
                    <h3>Heat Map for ${characterSelect.value}</h3>
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
        
    function populateCharacterList(characters) {
        characterSelect.innerHTML = '<option value="">Select Character</option>';
        if (characters.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No characters found";
            characterSelect.appendChild(option);
            characterSelect.disabled = true;
        } else {
            characters.forEach(character => {
                const option = document.createElement('option');
                option.value = character;
                option.textContent = character;
                characterSelect.appendChild(option);
            });
            characterSelect.disabled = false;
        }
    }
});