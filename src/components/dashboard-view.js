import { store } from '../js/store.js';
import { escapeHtml, formatBytes } from '../js/utils.js';
import './info-panel.js';

class DashboardView extends HTMLElement {
    connectedCallback() {
        this.render();
        this._unsubs = [
            store.on('counts-updated', () => this.update()),
            store.on('count-view-style-changed', () => this.update())
        ];
        this.addEventListener('click', (e) => this.handleClick(e));
    }

    disconnectedCallback() {
        this._unsubs?.forEach(fn => fn());
    }

    render() {
        this.innerHTML = `
            <info-panel></info-panel>

            <div class="dashboard-header">
                <div>
                    <h2><i class="fas fa-chart-line"></i> Dashboard Overview</h2>
                    <p class="dashboard-subtitle">Manage and track your inventory counts</p>
                </div>
                <div class="button-group">
                    <button class="btn" data-action="create-count"><i class="fas fa-plus"></i> Create New Count</button>
                    <button class="btn btn-secondary" data-action="download-backup"><i class="fas fa-download"></i> Download Backup</button>
                    <button class="btn btn-secondary" data-action="upload-backup"><i class="fas fa-upload"></i> Upload Backup</button>
                </div>
            </div>

            <div class="dashboard-stats-row">
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-clipboard-list"></i></div>
                    <div class="stat-card-content">
                        <div class="stat-card-value" id="total-counts">0</div>
                        <div class="stat-card-label">Total Counts</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-check-double"></i></div>
                    <div class="stat-card-content">
                        <div class="stat-card-value" id="completed-counts">0</div>
                        <div class="stat-card-label">Completed Counts</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-hourglass-start"></i></div>
                    <div class="stat-card-content">
                        <div class="stat-card-value" id="unstarted-counts">0</div>
                        <div class="stat-card-label">Unstarted Counts</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-database"></i></div>
                    <div class="stat-card-content">
                        <div class="stat-card-value" id="total-storage">0 MB</div>
                        <div class="stat-card-label">Storage Used</div>
                    </div>
                </div>
            </div>

            <div class="counts-section">
                <div class="counts-section-header">
                    <h3><i class="fas fa-folder-open"></i> My Counts</h3>
                    <div class="view-toggle">
                        <button class="view-toggle-btn" data-view="grid" data-action="switch-view">
                            <i class="fas fa-th"></i>
                        </button>
                        <button class="view-toggle-btn active" data-view="table" data-action="switch-view">
                            <i class="fas fa-table"></i>
                        </button>
                    </div>
                </div>
                <div id="counts-list" class="counts-list counts-table"></div>
            </div>
        `;
    }

    handleClick(e) {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        switch (action) {
            case 'create-count':
                store.showCreateView();
                break;
            case 'download-backup':
                store.exportAllData();
                break;
            case 'upload-backup':
                this.dispatchEvent(new CustomEvent('show-upload-backup-modal', { bubbles: true }));
                break;
            case 'switch-view': {
                const btn = e.target.closest('[data-view]');
                if (btn) store.switchCountView(btn.dataset.view);
                break;
            }
            case 'open-count': {
                const countId = e.target.closest('[data-count-id]')?.dataset.countId;
                if (countId) store.showCountView(countId);
                break;
            }
            case 'export-count': {
                e.stopPropagation();
                const countId = e.target.closest('[data-count-id]')?.dataset.countId;
                if (countId) store.exportCount(countId);
                break;
            }
            case 'delete-count': {
                e.stopPropagation();
                const countId = e.target.closest('[data-count-id]')?.dataset.countId;
                if (countId) this.dispatchEvent(new CustomEvent('show-delete-count-modal', {
                    bubbles: true,
                    detail: { countId }
                }));
                break;
            }
        }
    }

    async update() {
        const countIds = Object.keys(store.counts);
        await this.updateDashboardStats(countIds);
        this.updateViewToggle();
        this.renderCountsList(countIds);
    }

    async updateDashboardStats(countIds) {
        let completedCounts = 0;
        let unstartedCounts = 0;

        countIds.forEach(id => {
            const count = store.counts[id];
            const totalItems = count.items.length;
            const completedItems = count.items.filter(i => i.completed).length;
            if (totalItems > 0 && completedItems === totalItems) completedCounts++;
            if (completedItems === 0) unstartedCounts++;
        });

        const { totalSize } = await store.getStorageInfo();

        this.querySelector('#total-counts').textContent = countIds.length;
        this.querySelector('#completed-counts').textContent = completedCounts;
        this.querySelector('#unstarted-counts').textContent = unstartedCounts;
        this.querySelector('#total-storage').textContent = formatBytes(totalSize);
    }

    updateViewToggle() {
        this.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === store.currentCountView);
        });
    }

    async renderCountsList(countIds) {
        const listEl = this.querySelector('#counts-list');

        if (countIds.length === 0) {
            listEl.className = 'counts-list counts-grid';
            listEl.innerHTML = '<div class="empty-state"><i class="fas fa-inbox" style="font-size: 3em; color: var(--text-secondary); margin-bottom: 15px;"></i><h2>No counts yet</h2><p>Create your first count to get started</p></div>';
            return;
        }

        const { totalSize } = await store.getStorageInfo();

        if (store.currentCountView === 'grid') {
            listEl.className = 'counts-list counts-grid';
            listEl.innerHTML = countIds.map(id => {
                const count = store.counts[id];
                const date = new Date(count.createdAt).toLocaleDateString();
                const countSize = store.getCountSize(id);
                const sizePercent = totalSize > 0 ? Math.round((countSize / totalSize) * 100) : 0;
                const completedCount = count.items.filter(i => i.completed).length;
                const completionPercent = count.items.length > 0 ? Math.round((completedCount / count.items.length) * 100) : 0;

                return `
                    <div class="count-card">
                        <div data-action="open-count" data-count-id="${id}" style="cursor: pointer;">
                            <h3><i class="fas fa-clipboard-list"></i> ${escapeHtml(count.name)}</h3>
                            <p><i class="fas fa-boxes"></i> ${count.items.length} items</p>
                            <p><i class="fas fa-check-circle"></i> ${completedCount} completed (${completionPercent}%)</p>
                            <div class="count-progress">
                                <div class="count-progress-fill" style="width: ${completionPercent}%"></div>
                            </div>
                            <p style="margin-top: 10px;"><i class="fas fa-calendar"></i> ${date}</p>
                            <div class="count-size">
                                <i class="fas fa-database"></i>
                                <span class="count-size-mb">${formatBytes(countSize)}</span>
                                <span>(${sizePercent}%)</span>
                            </div>
                        </div>
                        <div class="count-card-actions">
                            <button class="btn btn-small btn-secondary" data-action="export-count" data-count-id="${id}" title="Export Count">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-small btn-danger" data-action="delete-count" data-count-id="${id}" title="Delete Count">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listEl.className = 'counts-list counts-table';
            const tableRows = countIds.map(id => {
                const count = store.counts[id];
                const date = new Date(count.createdAt).toLocaleDateString();
                const countSize = store.getCountSize(id);
                const completedCount = count.items.filter(i => i.completed).length;
                const completionPercent = count.items.length > 0 ? Math.round((completedCount / count.items.length) * 100) : 0;

                return `
                    <tr>
                        <td data-action="open-count" data-count-id="${id}" style="cursor: pointer;"><span class="table-count-name">${escapeHtml(count.name)}</span></td>
                        <td data-action="open-count" data-count-id="${id}" style="cursor: pointer;">${count.items.length}</td>
                        <td data-action="open-count" data-count-id="${id}" style="cursor: pointer;">
                            <div>${completedCount} / ${count.items.length}</div>
                            <div class="table-progress-bar">
                                <div class="table-progress-fill" style="width: ${completionPercent}%"></div>
                            </div>
                        </td>
                        <td data-action="open-count" data-count-id="${id}" style="cursor: pointer;">${formatBytes(countSize)}</td>
                        <td data-action="open-count" data-count-id="${id}" style="cursor: pointer;">${date}</td>
                        <td class="table-actions">
                            <button class="btn btn-small btn-secondary" data-action="export-count" data-count-id="${id}" title="Export Count">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-small btn-danger" data-action="delete-count" data-count-id="${id}" title="Delete Count">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            listEl.innerHTML = `
                <div class="counts-table-wrapper">
                    <table class="counts-table-inner">
                        <thead>
                            <tr>
                                <th>Count Name</th>
                                <th>Items</th>
                                <th>Progress</th>
                                <th>Size</th>
                                <th>Created</th>
                                <th class="table-actions-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `;
        }
    }
}

customElements.define('dashboard-view', DashboardView);
