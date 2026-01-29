/**
 * Central application state store.
 * Components subscribe to events emitted here.
 */
import {
    migrateFromLocalStorage,
    loadAllCounts,
    saveAllCounts,
    deleteCount as dbDeleteCount,
    getStorageSize,
    loadThemeSetting,
    saveThemeSetting
} from './db.js';
import { generateId, parseXMLFiles, formatBytes } from './utils.js';

class AppStore extends EventTarget {
    constructor() {
        super();
        this.counts = {};
        this.currentCountId = null;
        this.currentView = 'dashboard';
        this.uploadedFiles = [];
        this.currentFilter = '';
        this.showOnlyDone = false;
        this.currentCountView = 'table';
        this.history = { past: [], future: [], maxSize: 50 };
        this.modalContext = null;
        this.activeAccordionIndex = null;
        this.countToDelete = null;
        this.selectedBackupFile = null;
        this.searchDebounce = null;
    }

    /**
     * Subscribe to a store event. Returns an unsubscribe function.
     */
    on(event, handler) {
        this.addEventListener(event, handler);
        return () => this.removeEventListener(event, handler);
    }

    /**
     * Emit a custom event.
     */
    emit(event, detail) {
        this.dispatchEvent(new CustomEvent(event, { detail }));
    }

    /**
     * Initialize the store: migrate data, load theme and counts.
     */
    async init() {
        await migrateFromLocalStorage();
        await this.loadTheme();
        this.counts = await loadAllCounts();
        this.emit('initialized');
        this.emit('counts-updated');
    }

    // ─── Theme ───────────────────────────────────────────

    async loadTheme() {
        const theme = await loadThemeSetting();
        document.documentElement.setAttribute('data-theme', theme);
        this.emit('theme-changed', { theme });
    }

    async setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        await saveThemeSetting(theme);
        this.emit('theme-changed', { theme });
    }

    // ─── Navigation ──────────────────────────────────────

    showDashboard() {
        this.currentCountId = null;
        this.currentView = 'dashboard';
        this.emit('view-changed', { view: 'dashboard' });
        this.emit('counts-updated');
    }

    showCreateView() {
        this.uploadedFiles = [];
        this.currentView = 'create';
        this.emit('view-changed', { view: 'create' });
    }

    showCountView(countId) {
        this.currentCountId = countId;
        this.currentFilter = '';
        this.showOnlyDone = false;
        this.activeAccordionIndex = null;
        this.history = { past: [], future: [], maxSize: 50 };
        this.currentView = 'count';
        this.emit('view-changed', { view: 'count' });
    }

    switchCountView(view) {
        this.currentCountView = view;
        this.emit('count-view-style-changed', { view });
        this.emit('counts-updated');
    }

    // ─── Counts CRUD ─────────────────────────────────────

    async createCount(name, files) {
        if (!name) {
            alert('Please enter a count name');
            return;
        }
        if (!files || files.length === 0) {
            alert('Please upload at least one XML file');
            return;
        }
        try {
            const items = await parseXMLFiles(files);
            const countId = generateId();
            this.counts[countId] = {
                name,
                createdAt: new Date().toISOString(),
                items
            };
            await this.saveCounts();
            this.showCountView(countId);
        } catch (error) {
            alert('Error creating count: ' + error.message);
        }
    }

    async saveCounts() {
        try {
            await saveAllCounts(this.counts);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.handleQuotaExceeded();
            } else {
                console.error('Failed to save:', e);
                alert('Failed to save data. Please export your counts as a backup.');
            }
        }
    }

    handleQuotaExceeded() {
        alert('Storage limit reached! Your data will be automatically exported as a backup. Please delete old counts to free up space.');
        this.exportAllData();
        this.showDashboard();
    }

    async deleteCount(countId) {
        await dbDeleteCount(countId);
        delete this.counts[countId];
        this.emit('counts-updated');
    }

    // ─── Items ───────────────────────────────────────────

    async changeValue(itemIndex, field, delta) {
        const count = this.counts[this.currentCountId];
        if (!count) return;
        const item = count.items[itemIndex];
        if (item.completed) return;

        this.recordHistory();
        item[field] = Math.max(0, item[field] + delta);
        await this.saveCounts();
        this.emit('item-value-changed', { itemIndex, field, value: item[field] });
        this.emit('stats-updated');
    }

    async toggleCompleted(itemIndex) {
        const count = this.counts[this.currentCountId];
        if (!count) return;

        this.recordHistory();
        count.items[itemIndex].completed = !count.items[itemIndex].completed;
        await this.saveCounts();
        this.emit('items-changed');
        this.emit('stats-updated');
        this.checkAndCelebrate();
    }

    // ─── History ─────────────────────────────────────────

    recordHistory() {
        if (!this.currentCountId) return;
        const snapshot = {
            countId: this.currentCountId,
            state: JSON.parse(JSON.stringify(this.counts[this.currentCountId])),
            timestamp: Date.now()
        };
        this.history.past.push(snapshot);
        this.history.future = [];
        if (this.history.past.length > this.history.maxSize) {
            this.history.past.shift();
        }
    }

    async undo() {
        if (this.history.past.length === 0) return;
        const current = {
            countId: this.currentCountId,
            state: JSON.parse(JSON.stringify(this.counts[this.currentCountId])),
            timestamp: Date.now()
        };
        this.history.future.push(current);
        const previous = this.history.past.pop();
        this.counts[previous.countId] = JSON.parse(JSON.stringify(previous.state));
        await this.saveCounts();
        this.emit('items-changed');
        this.emit('stats-updated');
        this.checkAndCelebrate();
        this.showNotification('Undo');
    }

    async redo() {
        if (this.history.future.length === 0) return;
        const current = {
            countId: this.currentCountId,
            state: JSON.parse(JSON.stringify(this.counts[this.currentCountId])),
            timestamp: Date.now()
        };
        this.history.past.push(current);
        const next = this.history.future.pop();
        this.counts[next.countId] = JSON.parse(JSON.stringify(next.state));
        await this.saveCounts();
        this.emit('items-changed');
        this.emit('stats-updated');
        this.checkAndCelebrate();
        this.showNotification('Redo');
    }

    async restoreFromHistory(index) {
        if (!this.history.past[index]) return;
        const removed = this.history.past.splice(index + 1);
        this.history.future = removed.reverse().concat(this.history.future);
        const snapshot = this.history.past[index];
        this.counts[snapshot.countId] = JSON.parse(JSON.stringify(snapshot.state));
        await this.saveCounts();
        this.emit('items-changed');
        this.emit('stats-updated');
        this.checkAndCelebrate();
        this.showNotification('Restored');
    }

    // ─── Export / Backup ─────────────────────────────────

    exportAllData() {
        const data = {
            counts: this.counts,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `the-count-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportCount(countId) {
        const id = countId || this.currentCountId;
        const count = this.counts[id];
        if (!count) return;

        let csv = 'PosID,Item Name,Cases,Inners,Individuals,Completed\n';
        count.items.forEach(item => {
            csv += `${item.posId},"${item.itemName}",${item.cases},${item.inners},${item.individuals},${item.completed ? 'Yes' : 'No'}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${count.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async restoreBackup(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.counts || typeof data.counts !== 'object') {
                alert('Invalid backup file format.');
                return false;
            }
            const countKeys = Object.keys(data.counts);
            if (!confirm(`This will restore ${countKeys.length} count(s) from the backup.\n\nExisting counts with the same IDs will be overwritten.\n\nContinue?`)) {
                return false;
            }
            Object.assign(this.counts, data.counts);
            await this.saveCounts();
            this.emit('counts-updated');
            alert('Backup restored successfully!');
            return true;
        } catch (error) {
            console.error('Error restoring backup:', error);
            alert('Failed to restore backup. Please check the file format.');
            return false;
        }
    }

    // ─── Filter ──────────────────────────────────────────

    setFilter(filter) {
        this.currentFilter = filter;
        this.activeAccordionIndex = null;
        this.emit('items-changed');
    }

    setShowOnlyDone(value) {
        this.showOnlyDone = value;
        this.activeAccordionIndex = null;
        this.emit('items-changed');
    }

    // ─── Helpers ─────────────────────────────────────────

    checkAndCelebrate() {
        const count = this.counts[this.currentCountId];
        if (!count || count.items.length === 0) return;
        if (count.items.every(item => item.completed)) {
            this.emit('celebration');
        }
    }

    showNotification(text) {
        this.emit('notification', { text });
    }

    async getStorageInfo() {
        const size = await getStorageSize();
        return { totalSize: size };
    }

    getCountSize(countId) {
        const count = this.counts[countId];
        if (!count) return 0;
        return JSON.stringify(count).length * 2;
    }

    getCurrentCount() {
        return this.currentCountId ? this.counts[this.currentCountId] : null;
    }

    getFilteredItems() {
        const count = this.getCurrentCount();
        if (!count) return [];

        let items = count.items;

        if (this.currentFilter) {
            const filter = this.currentFilter.toLowerCase();
            items = items.filter(item =>
                item.posId.toLowerCase().includes(filter) ||
                item.itemName.toLowerCase().includes(filter)
            );
        }

        if (this.showOnlyDone) {
            items = items.filter(item => item.completed);
        }

        items = [...items].sort((a, b) => {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });

        return items;
    }
}

export const store = new AppStore();
