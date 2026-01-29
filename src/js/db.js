/**
 * Database layer using Dexie (IndexedDB wrapper).
 * Dexie is loaded globally via CDN <script> tag.
 */

const db = new Dexie('TheCountDB');
db.version(1).stores({
    counts: 'id, name, createdAt',
    settings: 'key'
});

/**
 * Migrate legacy data from localStorage to IndexedDB.
 */
export async function migrateFromLocalStorage() {
    try {
        const localStorageCounts = localStorage.getItem('counts');
        if (localStorageCounts) {
            const parsedCounts = JSON.parse(localStorageCounts);
            for (const countId in parsedCounts) {
                await db.counts.put({ ...parsedCounts[countId], id: countId });
            }
            console.log('Migrated data from localStorage to IndexedDB');
            localStorage.removeItem('counts');
        }

        const localStorageTheme = localStorage.getItem('theme');
        if (localStorageTheme) {
            await db.settings.put({ key: 'theme', value: localStorageTheme });
            localStorage.removeItem('theme');
        }
    } catch (error) {
        console.error('Error migrating from localStorage:', error);
    }
}

/**
 * Load all counts from IndexedDB.
 * @returns {Object} counts keyed by ID
 */
export async function loadAllCounts() {
    try {
        const allCounts = await db.counts.toArray();
        const counts = {};
        allCounts.forEach(count => {
            counts[count.id] = count;
            count.items.forEach(item => {
                if (item.completed === undefined) {
                    item.completed = false;
                }
            });
        });
        return counts;
    } catch (error) {
        console.error('Error loading counts from IndexedDB:', error);
        return {};
    }
}

/**
 * Save all counts to IndexedDB.
 */
export async function saveAllCounts(counts) {
    const savePromises = Object.keys(counts).map(countId => {
        return db.counts.put({ ...counts[countId], id: countId });
    });
    await Promise.all(savePromises);
}

/**
 * Delete a single count from IndexedDB.
 */
export async function deleteCount(countId) {
    await db.counts.delete(countId);
}

/**
 * Calculate total storage size used by the database.
 */
export async function getStorageSize() {
    try {
        let total = 0;
        const allCounts = await db.counts.toArray();
        allCounts.forEach(count => {
            total += JSON.stringify(count).length * 2;
        });
        const allSettings = await db.settings.toArray();
        allSettings.forEach(setting => {
            total += JSON.stringify(setting).length * 2;
        });
        return total;
    } catch (error) {
        console.error('Error calculating storage size:', error);
        return 0;
    }
}

/**
 * Load saved theme preference.
 * @returns {string} theme name
 */
export async function loadThemeSetting() {
    try {
        const themeSetting = await db.settings.get('theme');
        return themeSetting ? themeSetting.value : 'light';
    } catch (error) {
        console.error('Error loading theme:', error);
        return 'light';
    }
}

/**
 * Save theme preference to IndexedDB.
 */
export async function saveThemeSetting(theme) {
    await db.settings.put({ key: 'theme', value: theme });
}

export { db };
