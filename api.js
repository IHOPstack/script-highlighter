
export async function uploadScript(file) {
    const formData = new FormData();
    formData.append('script', file);

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    return await response.json();
}

export async function getCharacters(filePath) {
    const response = await fetch(`/api/characters?filePath=${encodeURIComponent(filePath)}`);

    if (!response.ok) {
        throw new Error('Failed to get characters');
    }

    return await response.json();
}

export async function highlightScript(filePath, characterName) {
    const response = await fetch('/api/highlight', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath, characterName })
    });

    if (!response.ok) {
        throw new Error('Highlighting failed');
    }

    return await response.blob();
}
