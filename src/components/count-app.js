/**
 * Main application shell.
 * Manages view switching, modals, keyboard shortcuts, and celebrations.
 */
import { store } from '../js/store.js';
import './app-header.js';
import './dashboard-view.js';
import './create-view.js';
import './count-view.js';

class CountApp extends HTMLElement {
    connectedCallback() {
        this.render();

        this._unsubs = [
            store.on('view-changed', (e) => this.updateView(e.detail.view)),
            store.on('notification', (e) => this.showNotification(e.detail.text)),
            store.on('celebration', () => this.celebrate())
        ];

        this.setupModals();
        this.setupKeyboardShortcuts();

        // Listen for modal events from child components
        this.addEventListener('show-custom-value-modal', (e) => this.showCustomValueModal(e.detail));
        this.addEventListener('show-history-modal', () => this.showHistoryModal());
        this.addEventListener('show-upload-backup-modal', () => this.showUploadBackupModal());
        this.addEventListener('show-delete-count-modal', (e) => this.showDeleteCountModal(e.detail.countId));
        this.addEventListener('show-report-modal', () => this.showReportModal());

        // Initialize
        store.init();
    }

    disconnectedCallback() {
        this._unsubs?.forEach(fn => fn());
    }

    render() {
        this.innerHTML = `
            <div class="container">
                <app-header></app-header>
                <div class="content">
                    <dashboard-view id="dashboard-view"></dashboard-view>
                    <create-view id="create-view" class="hidden"></create-view>
                    <count-view id="count-view" class="hidden"></count-view>
                </div>
            </div>

            <!-- Custom Value Modal -->
            <div id="custom-value-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Enter Value</h3>
                        <p id="modal-description"></p>
                    </div>
                    <input type="number" id="modal-input" class="modal-input" placeholder="Enter amount..." min="1">
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" data-modal-action="cancel-custom">Cancel</button>
                        <button class="btn" data-modal-action="apply-custom">Apply</button>
                    </div>
                </div>
            </div>

            <!-- History Modal -->
            <div id="history-modal" class="modal">
                <div class="modal-content history-modal-content">
                    <div class="modal-header">
                        <h3>History</h3>
                        <p>Click on any point in time to restore</p>
                    </div>
                    <div id="history-list" class="history-list"></div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" data-modal-action="close-history">Close</button>
                    </div>
                </div>
            </div>

            <!-- Upload Backup Modal -->
            <div id="upload-backup-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-upload"></i> Upload Backup</h3>
                        <p>Restore your counts from a backup file</p>
                    </div>
                    <div class="file-upload" data-modal-action="pick-backup" style="margin-bottom: 20px;">
                        <input type="file" id="backup-file-input" accept=".json" style="display: none;">
                        <p><i class="fas fa-file-upload" style="font-size: 2em; margin-bottom: 10px; color: var(--accent-primary);"></i></p>
                        <p>Click to select a backup file (.json)</p>
                    </div>
                    <div id="backup-file-info" style="margin-bottom: 20px; display: none;">
                        <p style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">Selected file:</p>
                        <p id="backup-file-name" style="color: var(--text-secondary); font-size: 0.9em;"></p>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" data-modal-action="cancel-backup">Cancel</button>
                        <button class="btn" id="restore-backup-btn" data-modal-action="restore-backup" disabled>Restore Backup</button>
                    </div>
                </div>
            </div>

            <!-- Delete Count Modal -->
            <div id="delete-count-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i> Delete Count</h3>
                        <p>Are you sure you want to delete this count?</p>
                    </div>
                    <div style="padding: 20px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: var(--text-primary); font-weight: 600; margin-bottom: 5px;" id="delete-count-name"></p>
                        <p style="color: var(--text-secondary); font-size: 0.85em;">This action cannot be undone.</p>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" data-modal-action="cancel-delete">Cancel</button>
                        <button class="btn btn-danger" data-modal-action="confirm-delete">Delete Count</button>
                    </div>
                </div>
            </div>

            <!-- Report Modal -->
            <div id="report-modal" class="modal">
                <div class="modal-content report-modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-file-alt"></i> Count Report</h3>
                        <p>Report of all completed items</p>
                    </div>
                    <div id="report-content" class="report-content"></div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" data-modal-action="close-report">Close</button>
                        <button class="btn" data-modal-action="export-png"><i class="fas fa-image"></i> Export as PNG</button>
                        <button class="btn" data-modal-action="export-pdf"><i class="fas fa-file-pdf"></i> Export as PDF</button>
                    </div>
                </div>
            </div>
        `;
    }

    updateView(view) {
        this.querySelector('#dashboard-view').classList.toggle('hidden', view !== 'dashboard');
        this.querySelector('#create-view').classList.toggle('hidden', view !== 'create');
        this.querySelector('#count-view').classList.toggle('hidden', view !== 'count');
    }

    // ─── Modals ──────────────────────────────────────────

    setupModals() {
        this._modalContext = null;
        this._selectedBackupFile = null;
        this._countToDelete = null;

        this.addEventListener('click', (e) => {
            const action = e.target.closest('[data-modal-action]')?.dataset.modalAction;
            if (!action) {
                // Close modal on background click
                if (e.target.classList.contains('modal')) {
                    e.target.classList.remove('show');
                }
                return;
            }

            switch (action) {
                case 'cancel-custom':
                    this.querySelector('#custom-value-modal').classList.remove('show');
                    break;
                case 'apply-custom':
                    this.applyCustomValue();
                    break;
                case 'close-history':
                    this.querySelector('#history-modal').classList.remove('show');
                    break;
                case 'pick-backup':
                    this.querySelector('#backup-file-input').click();
                    break;
                case 'cancel-backup':
                    this.querySelector('#upload-backup-modal').classList.remove('show');
                    this._selectedBackupFile = null;
                    break;
                case 'restore-backup':
                    this.restoreBackup();
                    break;
                case 'cancel-delete':
                    this.querySelector('#delete-count-modal').classList.remove('show');
                    this._countToDelete = null;
                    break;
                case 'confirm-delete':
                    this.confirmDeleteCount();
                    break;
                case 'close-report':
                    this.querySelector('#report-modal').classList.remove('show');
                    break;
                case 'export-png':
                    this.exportReportAsPNG();
                    break;
                case 'export-pdf':
                    this.exportReportAsPDF();
                    break;
            }
        });

        // History item clicks
        this.addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            if (historyItem && historyItem.dataset.historyIndex !== undefined) {
                store.restoreFromHistory(parseInt(historyItem.dataset.historyIndex));
                this.querySelector('#history-modal').classList.remove('show');
            }
        });

        // Backup file selection
        this.addEventListener('change', (e) => {
            if (e.target.id === 'backup-file-input') {
                this.handleBackupFileSelect(e);
            }
        });

        // Enter key in modal input
        this.addEventListener('keydown', (e) => {
            if (e.target.id === 'modal-input' && e.key === 'Enter') {
                this.applyCustomValue();
            }
        });
    }

    showCustomValueModal(detail) {
        const { itemIndex, field, operation } = detail;
        const count = store.getCurrentCount();
        if (!count) return;
        const item = count.items[itemIndex];
        if (item.completed) return;

        this._modalContext = { itemIndex, field, operation };

        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        this.querySelector('#modal-title').textContent = operation === 'add' ? `Add to ${fieldName}` : `Subtract from ${fieldName}`;
        this.querySelector('#modal-description').textContent = `${item.posId} - ${item.itemName}`;
        this.querySelector('#modal-input').value = '';
        this.querySelector('#custom-value-modal').classList.add('show');
        this.querySelector('#modal-input').focus();
    }

    applyCustomValue() {
        const value = parseInt(this.querySelector('#modal-input').value);
        if (isNaN(value) || value < 1) {
            alert('Please enter a valid positive number');
            return;
        }
        const { itemIndex, field, operation } = this._modalContext;
        const delta = operation === 'add' ? value : -value;
        store.changeValue(itemIndex, field, delta);
        this.querySelector('#custom-value-modal').classList.remove('show');
        this._modalContext = null;
    }

    showHistoryModal() {
        this.querySelector('#history-modal').classList.add('show');
        this.renderHistoryList();
    }

    renderHistoryList() {
        const listEl = this.querySelector('#history-list');
        const history = store.history;

        if (history.past.length === 0) {
            listEl.innerHTML = '<div class="empty-history">No history available</div>';
            return;
        }

        listEl.innerHTML = history.past.slice().reverse().map((snapshot, index) => {
            const actualIndex = history.past.length - 1 - index;
            const date = new Date(snapshot.timestamp);
            const timeStr = date.toLocaleTimeString();
            const completedCount = snapshot.state.items.filter(i => i.completed).length;
            const totalItems = snapshot.state.items.length;

            let totalCases = 0, totalInners = 0, totalIndividuals = 0;
            snapshot.state.items.forEach(item => {
                totalCases += item.cases;
                totalInners += item.inners;
                totalIndividuals += item.individuals;
            });

            return `
                <div class="history-item" data-history-index="${actualIndex}">
                    <div class="history-time">${timeStr}</div>
                    <div class="history-stats">
                        <span>${completedCount}/${totalItems} done</span>
                        <span>Cases: ${totalCases}</span>
                        <span>Inners: ${totalInners}</span>
                        <span>Indiv: ${totalIndividuals}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    showUploadBackupModal() {
        this._selectedBackupFile = null;
        const modal = this.querySelector('#upload-backup-modal');
        this.querySelector('#backup-file-input').value = '';
        this.querySelector('#backup-file-info').style.display = 'none';
        this.querySelector('#restore-backup-btn').disabled = true;
        modal.classList.add('show');
    }

    handleBackupFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        this._selectedBackupFile = file;
        this.querySelector('#backup-file-name').textContent = file.name;
        this.querySelector('#backup-file-info').style.display = 'block';
        this.querySelector('#restore-backup-btn').disabled = false;
    }

    async restoreBackup() {
        if (!this._selectedBackupFile) return;
        const success = await store.restoreBackup(this._selectedBackupFile);
        if (success) {
            this.querySelector('#upload-backup-modal').classList.remove('show');
            this._selectedBackupFile = null;
        }
    }

    showDeleteCountModal(countId) {
        this._countToDelete = countId;
        const count = store.counts[countId];
        this.querySelector('#delete-count-name').textContent = count.name;
        this.querySelector('#delete-count-modal').classList.add('show');
    }

    async confirmDeleteCount() {
        if (!this._countToDelete) return;
        await store.deleteCount(this._countToDelete);
        this.querySelector('#delete-count-modal').classList.remove('show');
        this._countToDelete = null;
    }

    // ─── Keyboard Shortcuts ──────────────────────────────

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
            }
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    store.undo();
                } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                    e.preventDefault();
                    store.redo();
                }
            }
        });
    }

    // ─── Notifications & Celebration ─────────────────────

    showNotification(text) {
        const notification = document.createElement('div');
        notification.className = 'undo-notification';
        notification.textContent = text;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 1500);
    }

    celebrate() {
        // Confetti (uses globally loaded canvas-confetti)
        if (typeof confetti === 'function') {
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);
                const particleCount = 50 * (timeLeft / duration);
                confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 }
                }));
                confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 }
                }));
            }, 250);
        }

        // Celebration message
        const notification = document.createElement('div');
        notification.className = 'celebration-notification';
        notification.innerHTML = '<i class="fas fa-trophy"></i> Count Completed! Well done!';
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ─── Report Generation ───────────────────────────────

    showReportModal() {
        const count = store.getCurrentCount();
        if (!count) return;

        const completedItems = count.items.filter(item => item.completed);
        
        if (completedItems.length === 0) {
            this.showNotification('No completed items to report');
            return;
        }

        const reportContent = this.generateReportHTML(count, completedItems);
        this.querySelector('#report-content').innerHTML = reportContent;
        this.querySelector('#report-modal').classList.add('show');
    }

    generateReportHTML(count, completedItems) {
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();

        let totalCases = 0, totalInners = 0, totalIndividuals = 0;
        completedItems.forEach(item => {
            totalCases += item.cases;
            totalInners += item.inners;
            totalIndividuals += item.individuals;
        });

        return `
            <div class="report-document">
                <div class="report-header">
                    <h1>Count Report: ${this.escapeHtml(count.name)}</h1>
                    <p class="report-date">Generated: ${dateStr} at ${timeStr}</p>
                </div>

                <div class="report-summary">
                    <h2>Summary</h2>
                    <div class="report-stats">
                        <div class="report-stat">
                            <span class="report-stat-label">Total Completed Items:</span>
                            <span class="report-stat-value">${completedItems.length}</span>
                        </div>
                        <div class="report-stat">
                            <span class="report-stat-label">Total Cases:</span>
                            <span class="report-stat-value">${totalCases}</span>
                        </div>
                        <div class="report-stat">
                            <span class="report-stat-label">Total Inners:</span>
                            <span class="report-stat-value">${totalInners}</span>
                        </div>
                        <div class="report-stat">
                            <span class="report-stat-label">Total Individuals:</span>
                            <span class="report-stat-value">${totalIndividuals}</span>
                        </div>
                    </div>
                </div>

                <div class="report-items">
                    <h2>Completed Items</h2>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>PosID</th>
                                <th>Item Name</th>
                                <th>Cases</th>
                                <th>Inners</th>
                                <th>Individuals</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${completedItems.map(item => `
                                <tr>
                                    <td>${this.escapeHtml(item.posId)}</td>
                                    <td>${this.escapeHtml(item.itemName)}</td>
                                    <td>${item.cases}</td>
                                    <td>${item.inners}</td>
                                    <td>${item.individuals}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getHtml2CanvasConfig() {
        return {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false
        };
    }

    generateReportFilename(extension) {
        const count = store.getCurrentCount();
        const timestamp = new Date().toISOString().split('T')[0];
        // Sanitize filename: replace non-alphanumeric chars, collapse underscores, trim edges
        const sanitizedName = count.name
            .replace(/[^a-z0-9]+/gi, '_')
            .replace(/^_|_$/g, '');
        return `${sanitizedName}_report_${timestamp}.${extension}`;
    }

    async exportReportAsPNG() {
        const reportContent = this.querySelector('#report-content');
        if (!reportContent) return;

        // Check if html2canvas is available
        if (typeof html2canvas === 'undefined') {
            this.showNotification('Export library not loaded');
            return;
        }

        try {
            const canvas = await html2canvas(reportContent, this.getHtml2CanvasConfig());

            const link = document.createElement('a');
            link.download = this.generateReportFilename('png');
            link.href = canvas.toDataURL('image/png');
            link.click();

            this.showNotification('Report exported as PNG');
        } catch (error) {
            console.error('Error exporting PNG:', error);
            this.showNotification('Failed to export as PNG');
        }
    }

    async exportReportAsPDF() {
        const reportContent = this.querySelector('#report-content');
        if (!reportContent) return;

        // Check if libraries are available
        if (typeof html2canvas === 'undefined') {
            this.showNotification('Export library not loaded');
            return;
        }

        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            this.showNotification('PDF library not loaded');
            return;
        }

        try {
            const canvas = await html2canvas(reportContent, this.getHtml2CanvasConfig());

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            
            // Use canvas dimensions for orientation (aspect ratio is already correct)
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth() - 20;
            const pageHeight = pdf.internal.pageSize.getHeight() - 20;
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // If content fits on one page, add it directly
            if (imgHeight <= pageHeight) {
                pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            } else {
                // Scale down to fit page
                const scaledHeight = pageHeight;
                const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
                pdf.addImage(imgData, 'PNG', 10, 10, scaledWidth, scaledHeight);
            }

            pdf.save(this.generateReportFilename('pdf'));

            this.showNotification('Report exported as PDF');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showNotification('Failed to export as PDF');
        }
    }
}

customElements.define('count-app', CountApp);
