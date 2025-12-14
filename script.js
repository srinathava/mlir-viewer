// MLIR Parser and Viewer using PEG.js
class MLIRViewer {
    constructor() {
        this.parsedLines = [];
        this.parser = null;
        this.locationAliases = {}; // Store location alias definitions
        this.config = {
            showTypes: true,
            inlineAttrs: [],
            inlineTypeAttrs: []
        };
        this.highlightedSSA = null; // Currently highlighted SSA value
        this.ssaOccurrences = []; // Array of DOM elements for current SSA value
        this.currentOccurrenceIndex = -1; // Current position in occurrences
        this.init();
    }

    async init() {
        // Wait for PEG.js to be available
        if (typeof PEG === 'undefined') {
            console.error('PEG.js library not loaded');
            alert('PEG.js library failed to load. Please check your internet connection and refresh the page.');
            return;
        }
        
        // Load and compile the PEG.js grammar
        await this.loadGrammar();
        
        document.getElementById('parseBtn').addEventListener('click', () => this.parseAndDisplay());
        document.getElementById('loadSample').addEventListener('click', () => this.loadSample());
        document.getElementById('toggleConfig').addEventListener('click', () => this.toggleConfig());
        document.getElementById('applyConfig').addEventListener('click', () => this.applyConfig());
        
        // SSA navigation controls
        document.getElementById('ssaFirst').addEventListener('click', () => this.navigateSSA('first'));
        document.getElementById('ssaPrev').addEventListener('click', () => this.navigateSSA('prev'));
        document.getElementById('ssaNext').addEventListener('click', () => this.navigateSSA('next'));
        document.getElementById('ssaLast').addEventListener('click', () => this.navigateSSA('last'));
        document.getElementById('ssaClear').addEventListener('click', () => this.clearSSAHighlights());
    }

    toggleConfig() {
        const panel = document.getElementById('configPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    applyConfig() {
        this.config.showTypes = document.getElementById('showTypes').checked;
        
        const inlineAttrsText = document.getElementById('inlineAttrs').value;
        this.config.inlineAttrs = inlineAttrsText
            .split(',')
            .map(s => s.trim())
            .filter(s => s);
        
        const inlineTypeAttrsText = document.getElementById('inlineTypeAttrs').value;
        this.config.inlineTypeAttrs = inlineTypeAttrsText
            .split(',')
            .map(s => s.trim())
            .filter(s => s);
        
        this.displaySimplified();
    }

    async loadGrammar() {
        try {
            // Add cache-busting parameter to always get fresh grammar
            const response = await fetch('mlir.pegjs?t=' + Date.now());
            if (!response.ok) {
                throw new Error(`Failed to fetch grammar: ${response.status}`);
            }
            const grammarText = await response.text();
            
            // Check if PEG is available
            if (typeof PEG === 'undefined') {
                throw new Error('PEG.js library is not loaded');
            }
            
            // PEG.js 0.7.0 uses buildParser instead of generate
            console.log('Grammar text starts with:', grammarText.substring(0, 100));
            this.parser = PEG.buildParser(grammarText);
            console.log('PEG.js parser loaded successfully');
        } catch (error) {
            console.error('Failed to load grammar:', error);
            alert(`Failed to load MLIR grammar: ${error.message}\n\nPlease ensure:\n1. mlir.pegjs is in the same directory\n2. You are accessing via HTTP (not file://)\n3. PEG.js library loaded correctly`);
        }
    }

    async loadSample() {
        try {
            const response = await fetch('sample.mlir?t=' + Date.now());
            if (!response.ok) {
                throw new Error(`Failed to fetch sample: ${response.status}`);
            }
            const sample = await response.text();
            
            document.getElementById('mlirInput').value = sample;
            
            // Load sample filters
            document.getElementById('showTypes').checked = true;
            document.getElementById('inlineAttrs').value = 'fastmath, value';
            document.getElementById('inlineTypeAttrs').value = 'bufferLoc';
            
            // Apply the sample configuration
            this.applyConfig();
        } catch (error) {
            console.error('Failed to load sample:', error);
            alert(`Failed to load sample MLIR file: ${error.message}\n\nPlease ensure sample.mlir is in the same directory.`);
        }
    }

    parseAndDisplay() {
        if (!this.parser) {
            alert('Parser not ready yet. Please wait a moment and try again.');
            return;
        }

        const input = document.getElementById('mlirInput').value;
        const lines = input.split('\n');
        
        this.parsedLines = [];
        this.locationAliases = {};
        this.operationById = {}; // Map of operation IDs to operation objects
        let nextOpId = 0;
        
        // First pass: extract location aliases
        lines.forEach(line => {
            const aliasMatch = line.match(/^(#\w+)\s*=\s*loc\((.+)\)$/);
            if (aliasMatch) {
                this.locationAliases[aliasMatch[1]] = aliasMatch[2];
            }
        });
        
        // Second pass: parse operations (handle multi-line)
        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();
            
            // Skip empty lines and location alias definitions
            if (!line || line.match(/^#\w+\s*=\s*loc\(/)) {
                i++;
                continue;
            }
            
            // Check if this line starts an operation
            if (line.match(/^%\w+\s*=/)) {
                // Collect the full operation (may span multiple lines)
                let fullOp = line;
                let braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                let parenCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
                
                i++;
                while (i < lines.length && (braceCount > 0 || parenCount > 0)) {
                    const nextLine = lines[i];
                    fullOp += '\n' + nextLine;
                    braceCount += (nextLine.match(/\{/g) || []).length - (nextLine.match(/\}/g) || []).length;
                    parenCount += (nextLine.match(/\(/g) || []).length - (nextLine.match(/\)/g) || []).length;
                    i++;
                }
                
                // Try to parse the full operation
                console.log('Attempting to parse operation:', fullOp);
                console.log('Brace count:', braceCount, 'Paren count:', parenCount);
                try {
                    const parsed = this.parser.parse(fullOp.trim());
                    console.log('Parse successful:', parsed);
                    if (parsed && parsed.length > 0) {
                        const op = {
                            ...parsed[0],
                            original: fullOp,
                            _id: nextOpId++
                        };
                        // Assign IDs to nested operations too
                        if (op.regions) {
                            op.regions = op.regions.map(region =>
                                region.map(nestedOp => ({
                                    ...nestedOp,
                                    _id: nextOpId++
                                }))
                            );
                        }
                        this.parsedLines.push(op);
                        this.operationById[op._id] = op;
                        // Store nested ops in the map too
                        if (op.regions) {
                            op.regions.forEach(region => {
                                region.forEach(nestedOp => {
                                    this.operationById[nestedOp._id] = nestedOp;
                                });
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to parse operation:`, fullOp);
                    console.error(`Error details:`, error);
                    console.error(`Error message:`, error.message);
                    if (error.expected) {
                        console.error(`Expected:`, error.expected);
                        console.error(`Found:`, error.found);
                        console.error(`Location:`, error.location);
                    }
                    this.parsedLines.push({
                        original: fullOp,
                        output: null,
                        opName: null,
                        inputs: [],
                        attributes: {},
                        inputTypes: [],
                        outputType: null,
                        location: null,
                        parseError: true
                    });
                }
            } else {
                i++;
            }
        }
        
        this.displaySimplified();
    }

    displaySimplified() {
        const container = document.getElementById('simplifiedView');
        container.innerHTML = '';

        this.parsedLines.forEach((parsed, index) => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'mlir-line';

            if (parsed.parseError) {
                // Display original line if parsing failed
                lineDiv.innerHTML = `<span style="color: #f48771;">${this.escapeHtml(parsed.original)}</span>`;
                container.appendChild(lineDiv);
                return;
            }

            // Build simplified view: %out = "op" %in1, %in2 loc("loc")
            let html = '';

            // Output SSA value
            if (parsed.output) {
                html += `<span class="ssa-value" data-ssa="${this.escapeHtml(parsed.output)}">${this.escapeHtml(parsed.output)}</span> = `;
            }

            // Operation name - use operation ID
            if (parsed.opName) {
                html += `<span class="op-name" data-op-id="${parsed._id}">"${this.escapeHtml(parsed.opName)}"</span>`;
            }

            // Input SSA values
            if (parsed.inputs.length > 0) {
                html += '(';
                parsed.inputs.forEach((input, i) => {
                    if (i > 0) html += ', ';
                    html += `<span class="ssa-value" data-ssa="${this.escapeHtml(input)}">${this.escapeHtml(input)}</span>`;
                });
                html += ')';
            } else {
                html += '()';
            }

            // Regions (collapsed by default)
            if (parsed.regions && parsed.regions.length > 0) {
                html += ` <span class="region-toggle" data-index="${index}" style="cursor: pointer; color: #dcdcaa;">({...})</span>`;
            }

            // Inline selected attributes
            if (this.config.inlineAttrs.length > 0 && Object.keys(parsed.attributes).length > 0) {
                const inlineAttrs = {};
                this.config.inlineAttrs.forEach(key => {
                    if (parsed.attributes[key]) {
                        inlineAttrs[key] = parsed.attributes[key];
                    }
                });
                if (Object.keys(inlineAttrs).length > 0) {
                    html += ' {';
                    let first = true;
                    for (const [key, value] of Object.entries(inlineAttrs)) {
                        if (!first) html += ', ';
                        html += `<span class="attr-key">${this.escapeHtml(key)}</span> = <span class="attr-value">${this.escapeHtml(value)}</span>`;
                        first = false;
                    }
                    html += '}';
                }
            }

            // Show types if enabled
            if (this.config.showTypes && (parsed.inputTypes.length > 0 || parsed.outputType)) {
                html += ' : (';
                if (parsed.inputTypes.length > 0) {
                    parsed.inputTypes.forEach((type, i) => {
                        if (i > 0) html += ', ';
                        const filteredType = this.filterTypeAttributes(type);
                        html += `<span class="type-info">${this.escapeHtml(filteredType)}</span>`;
                    });
                }
                html += ') -> ';
                const filteredOutputType = this.filterTypeAttributes(parsed.outputType || 'unknown');
                html += `<span class="type-info">${this.escapeHtml(filteredOutputType)}</span>`;
            }

            // Location with alias inlining
            if (parsed.location) {
                const inlinedLoc = this.inlineLocationAlias(parsed.location);
                html += ` <span class="loc-info">loc(${this.escapeHtml(inlinedLoc)})</span>`;
            }

            lineDiv.innerHTML = html;
            container.appendChild(lineDiv);
        });

        // Add click listeners
        this.attachClickListeners();
        this.attachRegionToggles();
        
        // Render nested operations in regions
        this.renderRegions();
    }

    renderRegions() {
        this.parsedLines.forEach((parsed, index) => {
            if (parsed.regions && parsed.regions.length > 0) {
                const regionContainer = document.createElement('div');
                regionContainer.id = `region-${index}`;
                regionContainer.className = 'region-content';
                regionContainer.style.display = 'none';
                regionContainer.style.marginLeft = '20px';
                regionContainer.style.borderLeft = '2px solid #3e3e42';
                regionContainer.style.paddingLeft = '10px';
                
                parsed.regions.forEach((region, regionIdx) => {
                    if (region.length > 0) {
                        region.forEach((op, opIdx) => {
                            const opDiv = this.renderOperation(op, `${index}-${regionIdx}-${opIdx}`);
                            // Store reference to the operation object
                            opDiv.dataset.opRef = JSON.stringify(op);
                            regionContainer.appendChild(opDiv);
                        });
                    }
                });
                
                // Insert after the parent operation line
                const parentLine = document.querySelector(`[data-index="${index}"]`)?.closest('.mlir-line');
                if (parentLine && parentLine.nextSibling) {
                    parentLine.parentNode.insertBefore(regionContainer, parentLine.nextSibling);
                } else if (parentLine) {
                    parentLine.parentNode.appendChild(regionContainer);
                }
            }
        });
        
        // Re-attach click listeners for nested operations
        this.attachClickListeners();
    }

    renderOperation(parsed, indexStr) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'mlir-line';
        lineDiv.style.margin = '2px 0';

        // Build simplified view using the same logic as displaySimplified
        let html = '';

        // Output SSA value
        if (parsed.output) {
            html += `<span class="ssa-value" data-ssa="${this.escapeHtml(parsed.output)}">${this.escapeHtml(parsed.output)}</span> = `;
        }

        // Operation name - use operation ID for click handling
        if (parsed.opName) {
            html += `<span class="op-name" data-op-id="${parsed._id}">"${this.escapeHtml(parsed.opName)}"</span>`;
        }

        // Input SSA values
        if (parsed.inputs.length > 0) {
            html += '(';
            parsed.inputs.forEach((input, i) => {
                if (i > 0) html += ', ';
                html += `<span class="ssa-value" data-ssa="${this.escapeHtml(input)}" data-index="${indexStr}" data-type="input" data-input-idx="${i}">${this.escapeHtml(input)}</span>`;
            });
            html += ')';
        } else {
            html += '()';
        }

        // Inline selected attributes
        if (this.config.inlineAttrs.length > 0 && Object.keys(parsed.attributes).length > 0) {
            const inlineAttrs = {};
            this.config.inlineAttrs.forEach(key => {
                if (parsed.attributes[key]) {
                    inlineAttrs[key] = parsed.attributes[key];
                }
            });
            if (Object.keys(inlineAttrs).length > 0) {
                html += ' {';
                let first = true;
                for (const [key, value] of Object.entries(inlineAttrs)) {
                    if (!first) html += ', ';
                    html += `<span class="attr-key">${this.escapeHtml(key)}</span> = <span class="attr-value">${this.escapeHtml(value)}</span>`;
                    first = false;
                }
                html += '}';
            }
        }

        // Show types if enabled
        if (this.config.showTypes && (parsed.inputTypes.length > 0 || parsed.outputType)) {
            html += ' : (';
            if (parsed.inputTypes.length > 0) {
                parsed.inputTypes.forEach((type, i) => {
                    if (i > 0) html += ', ';
                    const filteredType = this.filterTypeAttributes(type);
                    html += `<span class="type-info">${this.escapeHtml(filteredType)}</span>`;
                });
            }
            html += ') -> ';
            const filteredOutputType = this.filterTypeAttributes(parsed.outputType || 'unknown');
            html += `<span class="type-info">${this.escapeHtml(filteredOutputType)}</span>`;
        }

        // Location with alias inlining
        if (parsed.location) {
            const inlinedLoc = this.inlineLocationAlias(parsed.location);
            html += ` <span class="loc-info">loc(${this.escapeHtml(inlinedLoc)})</span>`;
        }

        lineDiv.innerHTML = html;
        return lineDiv;
    }

    attachRegionToggles() {
        document.querySelectorAll('.region-toggle').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                const regionContent = document.getElementById(`region-${index}`);
                if (regionContent.style.display === 'none') {
                    regionContent.style.display = 'block';
                    e.target.textContent = '({▼})';
                } else {
                    regionContent.style.display = 'none';
                    e.target.textContent = '({...})';
                }
            });
        });
    }

    filterTypeAttributes(type) {
        if (!type) {
            return type;
        }

        // Handle string types (for backward compatibility or simple types)
        if (typeof type === 'string') {
            return type;
        }

        // Handle structured type objects
        if (type.kind === 'simple') {
            return type.value;
        }

        if (type.kind === 'complex') {
            const content = type.content;
            
            // If no hash types, just return the string representation
            if (!content.hashTypes || content.hashTypes.length === 0) {
                return `${type.base}<${content.text || content}>`;
            }

            // Filter hash type attributes based on config
            const filteredAttrStrings = content.hashTypes.map(hashType => {
                let filteredAttrs = {};

                if (this.config.inlineTypeAttrs.length > 0) {
                    // Only include specified attributes (supports nested paths like "sharding.begin2")
                    this.config.inlineTypeAttrs.forEach(path => {
                        const value = this.getNestedValue(hashType.attributes, path);
                        if (value !== undefined) {
                            this.setNestedValue(filteredAttrs, path, value);
                        }
                    });
                } else {
                    // Include all attributes
                    filteredAttrs = hashType.attributes;
                }

                if (Object.keys(filteredAttrs).length === 0) {
                    return null; // Skip this hash type
                }

                // Reconstruct attributes in compact form (without hash type wrapper)
                return this.stringifyAttributes(filteredAttrs);
            }).filter(h => h !== null);

            // Build the final type string
            const textContent = content.text || '';
            
            if (filteredAttrStrings.length === 0) {
                // No hash types to show
                return `${type.base}<${textContent}>`;
            }

            // Combine text content with filtered attributes (compact form)
            const parts = [textContent, ...filteredAttrStrings].filter(p => p);
            return `${type.base}<${parts.join(', ')}>`;
        }

        // Fallback for unknown type structure
        return String(type);
    }

    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        current[parts[parts.length - 1]] = value;
    }

    stringifyAttributes(attrs, indent = '') {
        const parts = [];
        for (const [key, value] of Object.entries(attrs)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Nested object
                const nested = this.stringifyAttributes(value, indent + '  ');
                parts.push(`${key} = <${nested}>`);
            } else if (Array.isArray(value)) {
                // Array
                parts.push(`${key} = [${value.join(', ')}]`);
            } else if (typeof value === 'object' && value.value !== undefined && value.type !== undefined) {
                // Typed value like {value: 0, type: "si64"}
                parts.push(`${key} = ${value.value} : ${value.type}`);
            } else if (typeof value === 'boolean') {
                parts.push(`${key} = ${value}`);
            } else {
                parts.push(`${key} = ${value}`);
            }
        }
        return parts.join(', ');
    }

    inlineLocationAlias(location) {
        // If location is an alias reference (e.g., #loc1), inline it
        if (location.startsWith('#')) {
            return this.locationAliases[location] || location;
        }
        return location;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    attachClickListeners() {
        // SSA value clicks
        document.querySelectorAll('.ssa-value').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const ssaValue = e.target.dataset.ssa || e.target.textContent.trim();
                this.highlightSSAValue(ssaValue, e.target);
                this.showSSADetails(ssaValue);
            });
        });

        // Operation name clicks - use operation ID
        document.querySelectorAll('.op-name').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const opId = parseInt(e.target.dataset.opId);
                this.showOpDetails(opId);
            });
        });
    }

    highlightSSAValue(ssaValue, clickedElement) {
        // Clear previous highlights
        this.clearSSAHighlights();
        
        // Find all occurrences of this SSA value
        this.highlightedSSA = ssaValue;
        this.ssaOccurrences = Array.from(document.querySelectorAll(`.ssa-value[data-ssa="${ssaValue}"]`));
        
        // Find which occurrence was clicked
        this.currentOccurrenceIndex = this.ssaOccurrences.indexOf(clickedElement);
        if (this.currentOccurrenceIndex === -1) {
            this.currentOccurrenceIndex = 0;
        }
        
        // Highlight all occurrences
        this.ssaOccurrences.forEach((elem, idx) => {
            elem.classList.add('ssa-highlighted');
            if (idx === this.currentOccurrenceIndex) {
                elem.classList.add('ssa-current');
                // Don't auto-scroll - just highlight in place
            }
        });
        
        // Update navigation controls
        this.updateNavigationControls();
    }
    
    clearSSAHighlights() {
        document.querySelectorAll('.ssa-highlighted').forEach(elem => {
            elem.classList.remove('ssa-highlighted', 'ssa-current');
        });
        this.highlightedSSA = null;
        this.ssaOccurrences = [];
        this.currentOccurrenceIndex = -1;
        this.updateNavigationControls();
    }
    
    navigateSSA(direction) {
        if (this.ssaOccurrences.length === 0) return;
        
        // Remove current highlight
        if (this.currentOccurrenceIndex >= 0 && this.currentOccurrenceIndex < this.ssaOccurrences.length) {
            this.ssaOccurrences[this.currentOccurrenceIndex].classList.remove('ssa-current');
        }
        
        // Update index based on direction
        if (direction === 'first') {
            this.currentOccurrenceIndex = 0;
        } else if (direction === 'prev') {
            this.currentOccurrenceIndex = Math.max(0, this.currentOccurrenceIndex - 1);
        } else if (direction === 'next') {
            this.currentOccurrenceIndex = Math.min(this.ssaOccurrences.length - 1, this.currentOccurrenceIndex + 1);
        } else if (direction === 'last') {
            this.currentOccurrenceIndex = this.ssaOccurrences.length - 1;
        }
        
        // Highlight current occurrence
        const currentElem = this.ssaOccurrences[this.currentOccurrenceIndex];
        currentElem.classList.add('ssa-current');
        currentElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Update navigation controls
        this.updateNavigationControls();
    }
    
    updateNavigationControls() {
        const navDiv = document.getElementById('ssaNavigation');
        if (!navDiv) return;
        
        if (this.ssaOccurrences.length === 0) {
            navDiv.style.display = 'none';
            return;
        }
        
        navDiv.style.display = 'flex';
        document.getElementById('ssaValueName').textContent = this.highlightedSSA;
        document.getElementById('ssaCounter').textContent =
            `${this.currentOccurrenceIndex + 1} / ${this.ssaOccurrences.length}`;
        
        // Enable/disable buttons based on position
        const firstBtn = document.getElementById('ssaFirst');
        const prevBtn = document.getElementById('ssaPrev');
        const nextBtn = document.getElementById('ssaNext');
        const lastBtn = document.getElementById('ssaLast');
        
        firstBtn.disabled = this.currentOccurrenceIndex === 0;
        prevBtn.disabled = this.currentOccurrenceIndex === 0;
        nextBtn.disabled = this.currentOccurrenceIndex === this.ssaOccurrences.length - 1;
        lastBtn.disabled = this.currentOccurrenceIndex === this.ssaOccurrences.length - 1;
    }

    showSSADetails(ssaValue) {
        const detailsDiv = document.getElementById('detailsContent');
        
        // Find the definition of this SSA value
        const definition = this.findSSADefinition(ssaValue);
        
        if (!definition) {
            detailsDiv.innerHTML = `<p class="placeholder">Could not find definition for ${this.escapeHtml(ssaValue)}</p>`;
            return;
        }
        
        let html = '<div class="detail-section">';
        html += `<h3>SSA Value: ${this.escapeHtml(ssaValue)}</h3>`;
        html += '<div class="detail-item">';
        html += `<span class="detail-label">Type:</span>`;
        const typeStr = this.filterTypeAttributes(definition.outputType) || 'unknown';
        html += `<span class="detail-value type-info">${this.escapeHtml(typeStr)}</span>`;
        html += '</div>';
        html += '<div class="detail-item">';
        html += `<span class="detail-label">Defined by:</span>`;
        html += `<span class="detail-value">${this.escapeHtml(definition.opName || 'unknown')}</span>`;
        html += '</div>';
        
        if (definition.location) {
            const inlinedLoc = this.inlineLocationAlias(definition.location);
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Defined at:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(inlinedLoc)}</span>`;
            html += '</div>';
        }
        
        // Find all uses of this SSA value
        const uses = this.findSSAUses(ssaValue);
        if (uses.length > 0) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Used by:</span>`;
            html += '<div style="margin-top: 8px;">';
            uses.forEach(use => {
                html += `<div style="margin-left: 20px; margin-bottom: 4px;">`;
                html += `${this.escapeHtml(use.opName)}`;
                if (use.location) {
                    const inlinedLoc = this.inlineLocationAlias(use.location);
                    html += ` <span style="color: #6a9955;">at ${this.escapeHtml(inlinedLoc)}</span>`;
                }
                html += `</div>`;
            });
            html += '</div>';
            html += '</div>';
        }
        
        html += '</div>';
        detailsDiv.innerHTML = html;
    }

    findSSAUses(ssaValue) {
        const uses = [];
        for (const parsed of this.parsedLines) {
            if (parsed.inputs && parsed.inputs.includes(ssaValue)) {
                uses.push(parsed);
            }
            // Also search in regions
            if (parsed.regions) {
                for (const region of parsed.regions) {
                    for (const op of region) {
                        if (op.inputs && op.inputs.includes(ssaValue)) {
                            uses.push(op);
                        }
                    }
                }
            }
        }
        return uses;
    }

    findSSADefinition(ssaValue) {
        // Search through all parsed lines to find where this SSA value is defined
        for (const parsed of this.parsedLines) {
            if (parsed.output === ssaValue) {
                return parsed;
            }
            // Also search in regions
            if (parsed.regions) {
                for (const region of parsed.regions) {
                    for (const op of region) {
                        if (op.output === ssaValue) {
                            return op;
                        }
                    }
                }
            }
        }
        return null;
    }

    showOpDetails(opId) {
        console.log('showOpDetails called with opId:', opId, 'type:', typeof opId);
        console.log('operationById map:', this.operationById);
        console.log('operationById keys:', Object.keys(this.operationById));
        
        const detailsDiv = document.getElementById('detailsContent');
        
        // Look up operation by ID
        const parsed = this.operationById[opId];
        console.log('Found operation:', parsed);
        
        if (!parsed) {
            detailsDiv.innerHTML = `<p class="placeholder">Could not find operation with ID ${opId}</p>`;
            return;
        }
        
        let html = '<div class="detail-section">';
        html += `<h3>Operation: ${this.escapeHtml(parsed.opName)}</h3>`;
        
        // Show attributes
        if (Object.keys(parsed.attributes).length > 0) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Attributes:</span>`;
            html += '<div style="margin-top: 8px;">';
            for (const [key, value] of Object.entries(parsed.attributes)) {
                html += `<div style="margin-left: 20px; margin-bottom: 4px;">`;
                html += `<span class="attr-key">${this.escapeHtml(key)}</span> = `;
                html += `<span class="attr-value">${this.escapeHtml(value)}</span>`;
                html += `</div>`;
            }
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Attributes:</span>`;
            html += `<span class="detail-value">none</span>`;
            html += '</div>';
        }
        
        // Show inputs
        if (parsed.inputs.length > 0) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Inputs:</span>`;
            html += '<div style="margin-top: 8px;">';
            parsed.inputs.forEach((input, i) => {
                const type = parsed.inputTypes[i] || 'unknown';
                const typeStr = this.filterTypeAttributes(type);
                html += `<div style="margin-left: 20px; margin-bottom: 4px;">`;
                html += `<span class="ssa-value">${this.escapeHtml(input)}</span> : `;
                html += `<span class="type-info">${this.escapeHtml(typeStr)}</span>`;
                html += `</div>`;
            });
            html += '</div>';
            html += '</div>';
        }
        
        // Show output
        if (parsed.output) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Output:</span>`;
            html += `<span class="detail-value">`;
            html += `<span class="ssa-value">${this.escapeHtml(parsed.output)}</span> : `;
            const outputTypeStr = this.filterTypeAttributes(parsed.outputType) || 'unknown';
            html += `<span class="type-info">${this.escapeHtml(outputTypeStr)}</span>`;
            html += `</span>`;
            html += '</div>';
        }
        
        if (parsed.location) {
            const inlinedLoc = this.inlineLocationAlias(parsed.location);
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Location:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(inlinedLoc)}</span>`;
            html += '</div>';
        }
        
        html += '</div>';
        detailsDiv.innerHTML = html;
    }
}

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MLIRViewer();
});