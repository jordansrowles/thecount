import { store } from '../js/store.js';
import { escapeHtml } from '../js/utils.js';

class CreateView extends HTMLElement {
    connectedCallback() {
        this._uploadedFiles = [];
        this.render();

        this._unsubs = [
            store.on('view-changed', (e) => {
                if (e.detail.view === 'create') this.reset();
            })
        ];

        this.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'back') store.showDashboard();
            if (action === 'create') this.createCount();
            if (action === 'pick-file') this.querySelector('#xml-files').click();
        });

        this.addEventListener('change', (e) => {
            if (e.target.id === 'xml-files') this.handleFileUpload(e);
        });
    }

    disconnectedCallback() {
        this._unsubs?.forEach(fn => fn());
    }

    render() {
        this.innerHTML = `
            <button class="btn btn-secondary back-btn" data-action="back"><i class="fas fa-arrow-left"></i> Back to Dashboard</button>
            <h2><i class="fas fa-file-plus"></i> Create New Count</h2>
            <div class="form-group">
                <label for="count-name">Count Name</label>
                <input type="text" id="count-name" placeholder="Enter count name...">
            </div>
            <div class="form-group">
                <label>Upload XML Files</label>
                <div class="file-upload" data-action="pick-file">
                    <input type="file" id="xml-files" accept=".xml" multiple>
                    <p>Click to select XML files or drag and drop</p>
                    <p style="color: #6c757d; margin-top: 10px; font-size: 0.9em;">You can select multiple files at once</p>
                </div>
                <div id="file-list" style="margin-top: 15px;"></div>
            </div>
            <button class="btn" data-action="create"><i class="fas fa-check"></i> Create Count</button>
        `;
    }

    reset() {
        this._uploadedFiles = [];
        const nameInput = this.querySelector('#count-name');
        const fileInput = this.querySelector('#xml-files');
        const fileList = this.querySelector('#file-list');
        if (nameInput) nameInput.value = '';
        if (fileInput) fileInput.value = '';
        if (fileList) fileList.innerHTML = '';
    }

    handleFileUpload(event) {
        this._uploadedFiles = Array.from(event.target.files);
        const fileListEl = this.querySelector('#file-list');

        if (this._uploadedFiles.length === 0) {
            fileListEl.innerHTML = '';
            return;
        }

        fileListEl.innerHTML = `
            <p style="color: var(--text-primary); font-weight: 600;">Selected files:</p>
            <ul style="margin-top: 10px; padding-left: 20px;">
                ${this._uploadedFiles.map(f => `<li>${escapeHtml(f.name)}</li>`).join('')}
            </ul>
        `;
    }

    createCount() {
        const name = this.querySelector('#count-name').value.trim();
        store.createCount(name, this._uploadedFiles);
    }
}

customElements.define('create-view', CreateView);
