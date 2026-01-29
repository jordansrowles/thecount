/**
 * Escape HTML to prevent XSS.
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format byte count to human-readable string.
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID for a count.
 */
export function generateId() {
    return 'count_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Parse XML files into an array of inventory items.
 */
export async function parseXMLFiles(files) {
    const itemsMap = new Map();

    for (const file of files) {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const items = xmlDoc.getElementsByTagName('CountingListItem');

        for (const item of items) {
            const posIdEl = item.getElementsByTagName('PosID')[0];
            const itemNameEl = item.getElementsByTagName('ItemName')[0];

            if (posIdEl && itemNameEl) {
                const posId = posIdEl.textContent.trim();
                const itemName = itemNameEl.textContent.trim();

                if (!itemsMap.has(posId)) {
                    itemsMap.set(posId, {
                        posId,
                        itemName,
                        cases: 0,
                        inners: 0,
                        individuals: 0,
                        completed: false
                    });
                }
            }
        }
    }

    const itemsArray = Array.from(itemsMap.values());
    itemsArray.sort((a, b) => a.posId.localeCompare(b.posId));
    return itemsArray;
}
