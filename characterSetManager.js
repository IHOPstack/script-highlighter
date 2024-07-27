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
