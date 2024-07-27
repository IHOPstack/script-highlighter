export class UIManager {
    constructor(characterSetManager, highlightColors) {
        this.characterSetManager = characterSetManager;
        this.highlightColors = highlightColors;
        this.container = document.getElementById('characterContainer');
    }

    updateUI() {
        this.container.innerHTML = '';
        this.characterSetManager.sets.forEach((set, index) => {
            this.container.appendChild(this.createCharacterSetElement(index, set.character, set.color));
        });
        this.updateHighlightButtonColor();
    }

    createCharacterSetElement(index, character = '', color = 'yellow') {
        const characterSet = document.createElement('div');
        characterSet.className = 'character-set';
        characterSet.dataset.index = index;

        const select = document.createElement('select');
        select.className = 'characterSelect';
        select.innerHTML = '<option value="">Select Character</option>';
        this.characterSetManager.availableCharacters.forEach(char => {
            const option = document.createElement('option');
            option.value = char;
            option.textContent = char;
            if (char === character) option.selected = true;
            select.appendChild(option);
        });

        const colorOptions = document.createElement('div');
        colorOptions.className = 'color-options';
        Object.keys(this.highlightColors).forEach(colorName => {
            const button = document.createElement('button');
            button.className = `color-option ${colorName === color ? 'selected' : ''}`;
            button.setAttribute('data-color', colorName);
            button.innerHTML = '<i class="fas fa-highlighter"></i>';
            button.style.color = this.highlightColors[colorName].hex;
            colorOptions.appendChild(button);
        });

        characterSet.appendChild(select);
        characterSet.appendChild(colorOptions);

        if (index > 0) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-character-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                this.characterSetManager.removeSet(index);
                this.updateUI();
            });
            characterSet.appendChild(removeBtn);
        }

        return characterSet;
    }

    updateHighlightButtonColor() {
        const highlightBtn = document.getElementById('highlightBtn');
        const lastSet = this.characterSetManager.sets[this.characterSetManager.sets.length - 1];
        highlightBtn.style.backgroundColor = this.highlightColors[lastSet.color].hex;
    }
}
