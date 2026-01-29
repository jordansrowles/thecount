class InfoPanel extends HTMLElement {
    connectedCallback() {
        this.render();
        this.addEventListener('click', (e) => {
            if (e.target.closest('.info-accordion-header')) {
                this.querySelector('.info-accordion').classList.toggle('open');
            }
        });
    }

    render() {
        this.innerHTML = `
            <div class="info-accordion">
                <div class="info-accordion-header">
                    <div class="info-accordion-title">
                        <i class="fas fa-info-circle"></i>
                        <span>About The Count & How to Use</span>
                    </div>
                    <i class="fas fa-chevron-down info-accordion-icon"></i>
                </div>
                <div class="info-accordion-content">
                    <div class="info-section">
                        <h4><i class="fas fa-clipboard-check"></i> What is The Count?</h4>
                        <p>The Count is a powerful inventory counting tool designed to help you manage and track stock counts efficiently. Upload XML files containing your inventory items, count them in real-time, and export the results for further processing.</p>
                    </div>
                    <div class="info-section">
                        <h4><i class="fas fa-rocket"></i> Getting Started</h4>
                        <ol>
                            <li><strong>Create a Count:</strong> Click "Create New Count" and give your count a name</li>
                            <li><strong>Upload XML Files:</strong> Select one or more XML files containing your inventory items</li>
                            <li><strong>Start Counting:</strong> Click on a count to open it and begin counting items</li>
                            <li><strong>Track Progress:</strong> Use the statistics at the top to monitor your progress</li>
                            <li><strong>Export Results:</strong> When finished, export your count as a CSV file</li>
                        </ol>
                    </div>
                    <div class="info-section">
                        <h4><i class="fas fa-keyboard"></i> Features</h4>
                        <ul>
                            <li><strong>Counter Controls:</strong> Use +/- buttons for single increments, or +x/-x for custom amounts</li>
                            <li><strong>Mark as Done:</strong> Check items off as you complete them</li>
                            <li><strong>Search & Filter:</strong> Quickly find items by PosID or name</li>
                            <li><strong>Undo/Redo:</strong> Made a mistake? Use Ctrl+Z to undo (Ctrl+Shift+Z or Ctrl+Y to redo)</li>
                            <li><strong>History:</strong> View and restore previous states of your count</li>
                            <li><strong>IndexedDB Storage:</strong> Store large amounts of data locally (50MB+ capacity)</li>
                            <li><strong>Themes:</strong> Choose from Light, Dark, Windows XP, Vista Aero, or Star Trek LCARS using the theme picker in the header</li>
                        </ul>
                    </div>
                    <div class="info-section">
                        <h4><i class="fas fa-lightbulb"></i> Tips</h4>
                        <ul>
                            <li>Mark items as "done" as you complete them to track progress accurately</li>
                            <li>Use the search box to quickly locate specific items</li>
                            <li>Export your counts regularly as backups</li>
                            <li>On mobile devices, the interface automatically adapts to an accordion view for easier use</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('info-panel', InfoPanel);
