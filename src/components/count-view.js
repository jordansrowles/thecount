import { store } from '../js/store.js';
import { escapeHtml } from '../js/utils.js';

class CountView extends HTMLElement {
    connectedCallback() {
        this._searchDebounce = null;
        this.render();

        this._unsubs = [
            store.on('view-changed', (e) => {
                if (e.detail.view === 'count') this.update();
            }),
            store.on('items-changed', () => this.renderItems()),
            store.on('stats-updated', () => this.updateStats()),
            store.on('item-value-changed', (e) => {
                this.updateItemValueInDOM(e.detail.itemIndex, e.detail.field, e.detail.value);
                this.updateStats();
            })
        ];

        this.setupEventDelegation();
    }

    disconnectedCallback() {
        this._unsubs?.forEach(fn => fn());
    }

    render() {
        this.innerHTML = `
            <button class="btn btn-secondary back-btn" data-action="back"><i class="fas fa-arrow-left"></i> Back to Dashboard</button>
            <div id="count-header"></div>
            <div class="stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <i class="fas fa-clipboard-list stat-icon"></i>
                        <div class="stat-value" id="total-items">0</div>
                        <div class="stat-label">Total Items</div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-check-circle stat-icon"></i>
                        <div class="stat-value" id="completed-items">0</div>
                        <div class="stat-label">Completed</div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-circle-notch stat-icon"></i>
                        <div class="stat-value" id="incomplete-items">0</div>
                        <div class="stat-label">In Progress</div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-circle-check stat-icon"></i>
                        <div class="stat-value" id="empty-completed">0</div>
                        <div class="stat-label">Done (Empty)</div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-boxes-stacked stat-icon"></i>
                        <div class="stat-value" id="items-with-counts">0</div>
                        <div class="stat-label">Has Counts</div>
                    </div>
                </div>
            </div>
            <div class="search-box">
                <input type="text" id="search-items" placeholder="Search by PosID or Item Name...">
                <div class="filter-checkbox">
                    <input type="checkbox" id="show-only-done">
                    <label for="show-only-done">Only show done</label>
                </div>
            </div>
            <div class="button-group" style="margin-bottom: 20px;">
                <button class="btn btn-small" data-action="undo"><i class="fas fa-undo"></i> Undo</button>
                <button class="btn btn-small" data-action="redo"><i class="fas fa-redo"></i> Redo</button>
                <button class="btn btn-small btn-secondary" data-action="show-history"><i class="fas fa-clock-rotate-left"></i> History</button>
                <button class="btn btn-small btn-secondary" data-action="export"><i class="fas fa-download"></i> Export</button>
                <button class="btn btn-small btn-danger" data-action="delete"><i class="fas fa-trash"></i> Delete</button>
            </div>
            <div class="table-wrapper">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>PosID</th>
                            <th>Item Name</th>
                            <th>Cases</th>
                            <th>Inners</th>
                            <th>Individuals</th>
                            <th class="checkbox-cell">Done</th>
                        </tr>
                    </thead>
                    <tbody id="items-tbody"></tbody>
                </table>
            </div>
            <div class="items-accordion" id="items-accordion"></div>
        `;
    }

    setupEventDelegation() {
        // Top-level button actions
        this.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'back': store.showDashboard(); break;
                case 'undo': store.undo(); break;
                case 'redo': store.redo(); break;
                case 'show-history':
                    this.dispatchEvent(new CustomEvent('show-history-modal', { bubbles: true }));
                    break;
                case 'export': store.exportCount(); break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this count? This action cannot be undone.')) {
                        store.deleteCount(store.currentCountId);
                        store.showDashboard();
                    }
                    break;
                case 'increment':
                    store.changeValue(parseInt(e.target.closest('[data-index]').dataset.index), e.target.closest('[data-field]').dataset.field, 1);
                    break;
                case 'decrement':
                    store.changeValue(parseInt(e.target.closest('[data-index]').dataset.index), e.target.closest('[data-field]').dataset.field, -1);
                    break;
                case 'add':
                    this.dispatchEvent(new CustomEvent('show-custom-value-modal', {
                        bubbles: true,
                        detail: {
                            itemIndex: parseInt(e.target.closest('[data-index]').dataset.index),
                            field: e.target.closest('[data-field]').dataset.field,
                            operation: 'add'
                        }
                    }));
                    break;
                case 'subtract':
                    this.dispatchEvent(new CustomEvent('show-custom-value-modal', {
                        bubbles: true,
                        detail: {
                            itemIndex: parseInt(e.target.closest('[data-index]').dataset.index),
                            field: e.target.closest('[data-field]').dataset.field,
                            operation: 'subtract'
                        }
                    }));
                    break;
                case 'toggle-accordion': {
                    const header = e.target.closest('.accordion-header');
                    if (header) this.toggleAccordion(header);
                    break;
                }
            }
        });

        // Checkbox changes
        this.addEventListener('change', (e) => {
            if (e.target.dataset.action === 'toggle-complete') {
                store.toggleCompleted(parseInt(e.target.dataset.index));
            }
            if (e.target.id === 'show-only-done') {
                store.setShowOnlyDone(e.target.checked);
            }
        });

        // Search with debounce
        this.addEventListener('input', (e) => {
            if (e.target.id === 'search-items') {
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => {
                    store.setFilter(e.target.value);
                }, 300);
            }
        });
    }

    update() {
        const count = store.getCurrentCount();
        if (!count) return;

        this.querySelector('#count-header').innerHTML = `<h2>${escapeHtml(count.name)}</h2>`;
        this.querySelector('#search-items').value = '';
        const showOnlyDone = this.querySelector('#show-only-done');
        if (showOnlyDone) showOnlyDone.checked = false;

        this.renderItems();
        this.updateStats();
    }

    renderItems() {
        const count = store.getCurrentCount();
        if (!count) return;

        const items = store.getFilteredItems();
        const tbody = this.querySelector('#items-tbody');
        const accordion = this.querySelector('#items-accordion');

        // Table view
        tbody.innerHTML = items.map(item => {
            const actualIndex = count.items.indexOf(item);
            const completedClass = item.completed ? 'completed' : '';
            const disabled = item.completed ? 'disabled' : '';
            return `
                <tr class="${completedClass}" data-item-index="${actualIndex}">
                    <td>${escapeHtml(item.posId)}</td>
                    <td>${escapeHtml(item.itemName)}</td>
                    <td>
                        <div class="counter-controls">
                            <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="cases" ${disabled}>-x</button>
                            <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="cases" ${disabled}>-</button>
                            <span class="counter-value" data-field="cases">${item.cases}</span>
                            <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="cases" ${disabled}>+</button>
                            <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="cases" ${disabled}>+x</button>
                        </div>
                    </td>
                    <td>
                        <div class="counter-controls">
                            <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="inners" ${disabled}>-x</button>
                            <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="inners" ${disabled}>-</button>
                            <span class="counter-value" data-field="inners">${item.inners}</span>
                            <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="inners" ${disabled}>+</button>
                            <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="inners" ${disabled}>+x</button>
                        </div>
                    </td>
                    <td>
                        <div class="counter-controls">
                            <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="individuals" ${disabled}>-x</button>
                            <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="individuals" ${disabled}>-</button>
                            <span class="counter-value" data-field="individuals">${item.individuals}</span>
                            <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="individuals" ${disabled}>+</button>
                            <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="individuals" ${disabled}>+x</button>
                        </div>
                    </td>
                    <td class="checkbox-cell">
                        <input type="checkbox" ${item.completed ? 'checked' : ''} data-action="toggle-complete" data-index="${actualIndex}">
                    </td>
                </tr>
            `;
        }).join('');

        // Accordion (mobile) view
        accordion.innerHTML = items.map(item => {
            const actualIndex = count.items.indexOf(item);
            const completedClass = item.completed ? 'completed' : '';
            const disabled = item.completed ? 'disabled' : '';
            return `
                <div class="accordion-item ${completedClass}" data-item-index="${actualIndex}">
                    <div class="accordion-header" data-action="toggle-accordion">
                        <div class="accordion-title">
                            <div class="accordion-posid">${escapeHtml(item.posId)}</div>
                            <div class="accordion-itemname">${escapeHtml(item.itemName)}</div>
                        </div>
                        <div class="accordion-indicator">\u25BC</div>
                    </div>
                    <div class="accordion-content">
                        <div class="accordion-controls">
                            <div class="completed-checkbox">
                                <input type="checkbox" id="check-${actualIndex}" ${item.completed ? 'checked' : ''} data-action="toggle-complete" data-index="${actualIndex}">
                                <label for="check-${actualIndex}">Mark as done</label>
                            </div>
                            <div class="control-row">
                                <span class="control-label">Cases</span>
                                <div class="counter-controls">
                                    <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="cases" ${disabled}>-x</button>
                                    <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="cases" ${disabled}>-</button>
                                    <span class="counter-value" data-field="cases">${item.cases}</span>
                                    <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="cases" ${disabled}>+</button>
                                    <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="cases" ${disabled}>+x</button>
                                </div>
                            </div>
                            <div class="control-row">
                                <span class="control-label">Inners</span>
                                <div class="counter-controls">
                                    <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="inners" ${disabled}>-x</button>
                                    <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="inners" ${disabled}>-</button>
                                    <span class="counter-value" data-field="inners">${item.inners}</span>
                                    <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="inners" ${disabled}>+</button>
                                    <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="inners" ${disabled}>+x</button>
                                </div>
                            </div>
                            <div class="control-row">
                                <span class="control-label">Individuals</span>
                                <div class="counter-controls">
                                    <button class="counter-btn-custom" data-action="subtract" data-index="${actualIndex}" data-field="individuals" ${disabled}>-x</button>
                                    <button class="counter-btn" data-action="decrement" data-index="${actualIndex}" data-field="individuals" ${disabled}>-</button>
                                    <span class="counter-value" data-field="individuals">${item.individuals}</span>
                                    <button class="counter-btn" data-action="increment" data-index="${actualIndex}" data-field="individuals" ${disabled}>+</button>
                                    <button class="counter-btn-custom" data-action="add" data-index="${actualIndex}" data-field="individuals" ${disabled}>+x</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Restore active accordion
        if (store.activeAccordionIndex !== null) {
            const accordionItems = this.querySelectorAll('.accordion-item');
            if (accordionItems[store.activeAccordionIndex]) {
                accordionItems[store.activeAccordionIndex].classList.add('active');
            }
        }
    }

    updateItemValueInDOM(itemIndex, field, value) {
        const tableRow = this.querySelector(`tr[data-item-index="${itemIndex}"]`);
        if (tableRow) {
            const valueSpan = tableRow.querySelector(`.counter-value[data-field="${field}"]`);
            if (valueSpan) valueSpan.textContent = value;
        }
        const accordionItem = this.querySelector(`.accordion-item[data-item-index="${itemIndex}"]`);
        if (accordionItem) {
            const valueSpan = accordionItem.querySelector(`.counter-value[data-field="${field}"]`);
            if (valueSpan) valueSpan.textContent = value;
        }
    }

    updateStats() {
        const count = store.getCurrentCount();
        if (!count) return;

        let completedItems = 0, incompleteItems = 0, emptyCompleted = 0, itemsWithCounts = 0;

        count.items.forEach(item => {
            if (item.completed) {
                completedItems++;
                if (item.cases === 0 && item.inners === 0 && item.individuals === 0) emptyCompleted++;
            } else {
                incompleteItems++;
            }
            if (item.cases > 0 || item.inners > 0 || item.individuals > 0) itemsWithCounts++;
        });

        this.querySelector('#total-items').textContent = count.items.length;
        this.querySelector('#completed-items').textContent = completedItems;
        this.querySelector('#incomplete-items').textContent = incompleteItems;
        this.querySelector('#empty-completed').textContent = emptyCompleted;
        this.querySelector('#items-with-counts').textContent = itemsWithCounts;
    }

    toggleAccordion(header) {
        const accordionItem = header.parentElement;
        const wasActive = accordionItem.classList.contains('active');
        const allItems = Array.from(this.querySelectorAll('.accordion-item'));
        const itemIndex = allItems.indexOf(accordionItem);

        allItems.forEach(item => item.classList.remove('active'));

        if (!wasActive) {
            accordionItem.classList.add('active');
            store.activeAccordionIndex = itemIndex;
        } else {
            store.activeAccordionIndex = null;
        }
    }
}

customElements.define('count-view', CountView);
