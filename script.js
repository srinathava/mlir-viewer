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

    loadSample() {
        const sample = `#loc1 = loc("example.mlir":10:5)
#loc2 = loc("example.mlir":11:5)
#loc3 = loc("example.mlir":12:5)
#loc4 = loc("example.mlir":13:5)
#loc5 = loc("example.mlir":14:5)
#loc6 = loc("example.mlir":15:5)
#loc7 = loc("example.mlir":16:5)
#loc8 = loc("example.mlir":17:5)
#loc9 = loc("example.mlir":18:5)

%0 = "arith.constant"() {value = 42 : i32} : () -> i32 loc(#loc1)
%1 = "arith.constant"() {value = 10 : i32} : () -> i32 loc(#loc2)
%2 = "arith.addi"(%0, %1) : (i32, i32) -> i32 loc(#loc3)
%result = "arith.muli"(%2, %1) {fastmath = "fast"} : (i32, i32) -> i32 loc(#loc4)
%3 = "tensor.empty"() : () -> tensor<4x4xf32> loc(#loc5)
%4 = "linalg.fill"(%result, %3) : (i32, tensor<4x4xf32>) -> tensor<4x4xf32> loc(#loc6)
%5 = "tensor.cast"(%3) : (tensor<4x4xf32>) -> tensor<3x3xsi32, #foo.Attr<bufferLoc = global, attr2 = attr2val : attr2type>> loc(#loc7)
%6 = "scf.if"(%result) ({
  %7 = "arith.addi"(%0, %1) : (i32, i32) -> i32 loc(#loc8)
  "scf.yield"(%7) : (i32) -> () loc(#loc9)
}) : (i32) -> i32 loc(#loc7)`;
        
        document.getElementById('mlirInput').value = sample;
        
        // Load sample filters
        document.getElementById('showTypes').checked = true;
        document.getElementById('inlineAttrs').value = 'fastmath, value';
        document.getElementById('inlineTypeAttrs').value = 'bufferLoc';
        
        // Apply the sample configuration
        this.applyConfig();
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
                        this.parsedLines.push({
                            ...parsed[0],
                            original: fullOp
                        });
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
                html += `<span class="ssa-value" data-index="${index}" data-type="output">${this.escapeHtml(parsed.output)}</span> = `;
            }

            // Operation name
            if (parsed.opName) {
                html += `<span class="op-name" data-index="${index}">"${this.escapeHtml(parsed.opName)}"</span>`;
            }

            // Input SSA values
            if (parsed.inputs.length > 0) {
                html += '(';
                parsed.inputs.forEach((input, i) => {
                    if (i > 0) html += ', ';
                    html += `<span class="ssa-value" data-index="${index}" data-type="input" data-input-idx="${i}">${this.escapeHtml(input)}</span>`;
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
                        region.forEach(op => {
                            const opDiv = this.renderOperation(op, `${index}-${regionIdx}`);
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
            html += `<span class="ssa-value" data-index="${indexStr}" data-type="output">${this.escapeHtml(parsed.output)}</span> = `;
        }

        // Operation name
        if (parsed.opName) {
            html += `<span class="op-name" data-index="${indexStr}">"${this.escapeHtml(parsed.opName)}"</span>`;
        }

        // Input SSA values
        if (parsed.inputs.length > 0) {
            html += '(';
            parsed.inputs.forEach((input, i) => {
                if (i > 0) html += ', ';
                html += `<span class="ssa-value" data-index="${indexStr}" data-type="input" data-input-idx="${i}">${this.escapeHtml(input)}</span>`;
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

        // Parse type attributes from angle brackets
        // e.g., tensor<3x3xsi32, #foo.Attr<bufferLoc = global, attr2 = val>>
        const match = type.match(/^([^<]+)<(.+)>$/);
        if (!match) {
            return type; // No attributes to filter
        }

        const baseType = match[1];
        const content = match[2];

        // Find attribute section (starts with #)
        const attrMatch = content.match(/(.*?)(#[^<]+<([^>]+)>)(.*)$/);
        if (!attrMatch) {
            return type; // No attributes found
        }

        const beforeAttr = attrMatch[1];
        const fullAttrSection = attrMatch[2];
        const attrContent = attrMatch[3];
        const afterAttr = attrMatch[4];

        // Parse attributes
        const attrs = attrContent.split(',').map(s => s.trim());
        
        // Filter attributes based on config if specified
        let filteredAttrs = attrs;
        if (this.config.inlineTypeAttrs.length > 0) {
            filteredAttrs = attrs.filter(attr => {
                const key = attr.split('=')[0].trim();
                return this.config.inlineTypeAttrs.includes(key);
            });
        }

        if (filteredAttrs.length === 0) {
            // No attributes to show, remove the attribute section
            const filtered = beforeAttr.trim().replace(/,\s*$/, '');
            return `${baseType}<${filtered}${afterAttr}>`;
        }

        // Reconstruct with simplified format: just show key=value pairs
        const simplifiedAttrs = filteredAttrs.join(', ');
        const beforeClean = beforeAttr.trim();
        const separator = beforeClean && !beforeClean.endsWith(',') ? ', ' : '';
        return `${baseType}<${beforeClean}${separator}${simplifiedAttrs}${afterAttr}>`;
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
                const index = parseInt(e.target.dataset.index);
                const type = e.target.dataset.type;
                const inputIdx = e.target.dataset.inputIdx;
                this.showSSADetails(index, type, inputIdx);
            });
        });

        // Operation name clicks
        document.querySelectorAll('.op-name').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showOpDetails(index);
            });
        });
    }

    showSSADetails(lineIndex, type, inputIdx) {
        const parsed = this.parsedLines[lineIndex];
        const detailsDiv = document.getElementById('detailsContent');
        
        let html = '<div class="detail-section">';
        
        if (type === 'output') {
            html += `<h3>SSA Value: ${this.escapeHtml(parsed.output)}</h3>`;
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Type:</span>`;
            html += `<span class="detail-value type-info">${this.escapeHtml(parsed.outputType || 'unknown')}</span>`;
            html += '</div>';
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Defined by:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(parsed.opName || 'unknown')}</span>`;
            html += '</div>';
        } else if (type === 'input') {
            const inputName = parsed.inputs[inputIdx];
            const inputType = parsed.inputTypes[inputIdx] || 'unknown';
            html += `<h3>SSA Value: ${this.escapeHtml(inputName)}</h3>`;
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Type:</span>`;
            html += `<span class="detail-value type-info">${this.escapeHtml(inputType)}</span>`;
            html += '</div>';
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Used by:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(parsed.opName || 'unknown')}</span>`;
            html += '</div>';
        }
        
        if (parsed.location) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Location:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(parsed.location)}</span>`;
            html += '</div>';
        }
        
        html += '</div>';
        detailsDiv.innerHTML = html;
    }

    showOpDetails(lineIndex) {
        const parsed = this.parsedLines[lineIndex];
        const detailsDiv = document.getElementById('detailsContent');
        
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
                html += `<div style="margin-left: 20px; margin-bottom: 4px;">`;
                html += `<span class="ssa-value">${this.escapeHtml(input)}</span> : `;
                html += `<span class="type-info">${this.escapeHtml(type)}</span>`;
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
            html += `<span class="type-info">${this.escapeHtml(parsed.outputType || 'unknown')}</span>`;
            html += `</span>`;
            html += '</div>';
        }
        
        if (parsed.location) {
            html += '<div class="detail-item">';
            html += `<span class="detail-label">Location:</span>`;
            html += `<span class="detail-value">${this.escapeHtml(parsed.location)}</span>`;
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