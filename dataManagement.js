export class ScriptLine {
    constructor(text, x, y, endX, height, type = 'unknown', speakingCharacter = null) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.endX = endX;
        this.height = height;
        this.type = type;
        this.speakingCharacter = speakingCharacter;
    }
}

export class PDFPageMap {
    constructor() {
        this.map = new Map();
    }

    setPageLines(pageNumber, lines) {
        this.map.set(pageNumber, lines);
    }

    getPageLines(pageNumber) {
        return this.map.get(pageNumber) || [];
    }

    getAllPages() {
        return Array.from(this.map.keys());
    }

    getTotalLines() {
        return Array.from(this.map.values()).reduce((acc, lines) => acc + lines.length, 0);
    }
}
export class CharacterSetManager {
    constructor() {
        this.sets = [{character: '', color: 'yellow'}]; // Initialize with the default set
        this.availableCharacters = [];
    }

    addSet(character = '', color = 'yellow') {
        this.sets.push({ character, color });
    }

    removeSet(index) {
        if (this.sets.length > 1 && index > 0) {
            this.sets.splice(index, 1);
        }
    }

    updateSet(index, character, color) {
        if (index >= 0 && index < this.sets.length) {
            this.sets[index] = { character, color };
        }
    }

    setAvailableCharacters(characters) {
        this.availableCharacters = characters;
    }
}