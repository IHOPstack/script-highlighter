import { extractCharacters, highlightPDF, generateHeatMap } from './pdfService.js';

document.addEventListener('DOMContentLoaded', function() {
    const HIGHLIGHT_COLORS = {
        yellow: { hex: '#ffff00', rgb: {r: 1, g: 1, b: 0} },
        pink: { hex: '#ff6bff', rgb: {r: 1, g: 0.42, b: 1} },
        blue: { hex: '#1ac7ff', rgb: {r: 0.1, g: 0.78, b: 1} },
        green: { hex: '#51ff00', rgb: {r: 0.32, g: 1, b: 0} },
        orange: { hex: '#ff9b00', rgb: {r: 1, g: 0.61, b: 0} },
        purple: { hex: '#cb5eff', rgb: {r: 0.8, g: 0.37, b: 1} }
    };    
    const uploadBtn = document.getElementById('uploadBtn');
    const characterSelect = document.getElementById('characterSelect');
    const highlightBtn = document.getElementById('highlightBtn');
    const previewArea = document.getElementById('previewArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const editBtn = document.getElementById('editBtn');
    
    // Single source of truth for character data
    let currentPdfDoc = null;
    let characters = [];
    let characterSets = [];
    let availableCharacters = [];

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
                    characters = await extractCharacters(arrayBuffer, window.pdfjsLib);
                    populateCharacterList(characters);
                    // After successful upload and character extraction
                    availableCharacters = characters; // Assume this is how we get characters from the PDF
                    updateCharacterSelects();

                    // Update the original character set in the data structure
                    if (characterSets.length === 0) {
                        characterSets.push({ character: '', color: {r: 1, g: 1, b: 0} });
                    }
                } catch (error) {
                    alert('Upload failed. Please try again.');
                }
            }
        };
        input.click();
    });

    highlightBtn.addEventListener('click', async function() {
        const characters = characterSets.filter(set => set.character).map(set => ({
            name: set.character,
            color: HIGHLIGHT_COLORS[set.color].rgb
        }));
        
        console.log('Characters to highlight:', characters);
        
        if (characters.length > 0 && currentPdfDoc) {
            try {
                const highlightedPdfDoc = await highlightPDF(currentPdfDoc, characters, PDFLib, pdfjsLib);
                const pdfBytes = await highlightedPdfDoc.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                // Log for debugging
                console.log('PDF URL created:', pdfUrl);
                
                // Update the preview area
                const previewArea = document.getElementById('previewArea');
                previewArea.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="500px"></iframe>`;
                
                // Log for debugging
                console.log('Preview area updated');
            } catch (error) {
                console.error('Highlighting failed:', error);
                alert('Highlighting failed. Please try again.');
            }
        } else {
            alert('Please select at least one character and upload a script first.');
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
        

    function createCharacterSet(character = '', colorName = 'yellow') {
        // Ensure colorName is valid
        if (!HIGHLIGHT_COLORS.hasOwnProperty(colorName)) {
            colorName = 'yellow';  // Default to yellow if an invalid color is provided
        }
            const characterSet = document.createElement('div');
        characterSet.className = 'character-set';
    
        const select = document.createElement('select');
        select.className = 'characterSelect';
        select.innerHTML = '<option value="">Select Character</option>';
        availableCharacters.forEach(char => {
            const option = document.createElement('option');
            option.value = char;
            option.textContent = char;
            select.appendChild(option);
        });
    
        const colorOptions = document.createElement('div');
        colorOptions.className = 'color-options';
        Object.keys(HIGHLIGHT_COLORS).forEach(color => {
            const button = document.createElement('button');
            button.className = `color-option ${color === colorName ? 'selected' : ''}`;
            button.id = color;
            button.setAttribute('data-color', color);
            button.innerHTML = '<i class="fas fa-highlighter"></i>';
            button.style.color = HIGHLIGHT_COLORS[color].hex;
            colorOptions.appendChild(button);
        });
            
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-character-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeCharacterSet(characterSet));
    
        characterSet.appendChild(select);
        characterSet.appendChild(colorOptions);
        characterSet.appendChild(removeBtn);
        
        return characterSet;
    }

    function updateCharacterSelects() {
        const selects = document.querySelectorAll('.characterSelect');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select Character</option>';
            availableCharacters.forEach(char => {
                const option = document.createElement('option');
                option.value = char;
                option.textContent = char;
                select.appendChild(option);
            });
            select.value = currentValue; // Maintain the current selection if possible
        });
    }
    
                        
    function removeCharacterSet(characterSet) {
        if (characterSets.length > 1) {  // Always keep at least one character set
            const index = Array.from(characterContainer.children).indexOf(characterSet);
            characterSets.splice(index, 1);
            characterSet.remove();
            updateHighlightButtonColor();
        }
    }
                            
    function updateHighlightButtonColor() {
        const lastSet = characterSets[characterSets.length - 1];
        highlightBtn.style.backgroundColor = HIGHLIGHT_COLORS[lastSet.color].hex;
    }
        
    const addCharacterBtn = document.getElementById('addCharacterBtn');
    const characterContainer = document.getElementById('characterContainer');
    
    addCharacterBtn.addEventListener('click', () => {
        const newSet = createCharacterSet();
        characterContainer.insertBefore(newSet, characterContainer.firstChild);
        characterSets.push({ character: '', color: 'yellow' });
    });
                    
    // Event delegation for color selection
    characterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option') || e.target.closest('.color-option')) {
            const colorOption = e.target.classList.contains('color-option') ? e.target : e.target.closest('.color-option');
            const characterSet = colorOption.closest('.character-set');
            const index = Array.from(document.querySelectorAll('.character-set')).indexOf(characterSet);
            
            characterSet.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            colorOption.classList.add('selected');
            
            const colorName = colorOption.getAttribute('data-color');
            if (HIGHLIGHT_COLORS.hasOwnProperty(colorName)) {
                characterSets[index].color = colorName;
                updateHighlightButtonColor();
                console.log('characterSets after color selection', characterSets);
            } else {
                console.error(`Invalid color selected: ${colorName}`);
            }
        }
    });
                    
    // Event delegation for character selection
    characterContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('characterSelect')) {
            const index = Array.from(document.querySelectorAll('.character-set')).indexOf(e.target.closest('.character-set'));
            characterSets[index].character = e.target.value;
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
function getColorRGB(color) {
    switch(color) {
        case 'yellow': return {r: 1, g: 1, b: 0};
        case 'pink': return {r: 1, g: 0.42, b: 1};
        case 'blue': return {r: 0.1, g: 0.78, b: 1};
        case 'green': return {r: 0.32, g: 1, b: 0};
        case 'orange': return {r: 1, g: 0.61, b: 0};
        case 'purple': return {r: 0.8, g: 0.37, b: 1};
        default: return {r: 1, g: 1, b: 0}; // Default to yellow
    }
}