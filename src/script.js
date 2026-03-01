// CAN Frame Playground - Main JavaScript Implementation
// This file contains all the core functionality for the CAN Frame Playground tool

// Global variables
let canFrames = [];
let canGroups = new Map();
let selectedId = null;
let selectedGroupId = null;
let darkMode = true;
let chart = null;
let annotations = new Map(); // Store annotations by ID

// DOM Elements
const logInput = document.getElementById('logInput');
const parseBtn = document.getElementById('parseBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const idList = document.getElementById('idList');
const idFilter = document.getElementById('idFilter');
const hexDumpContainer = document.getElementById('hexDumpContainer');
const selectedIdTitle = document.getElementById('selectedIdTitle');
const highlightMode = document.getElementById('highlightMode');
const statusMessage = document.getElementById('statusMessage');
const parseStats = document.getElementById('parseStats');
const frameCount = document.getElementById('frameCount');
const annotationList = document.getElementById('annotationList');
const annotationForm = document.getElementById('annotationForm');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateFrameCount();
    loadSampleData();
});

// Set up event listeners
function setupEventListeners() {
    parseBtn.addEventListener('click', parseLog);
    clearBtn.addEventListener('click', clearAll);
    exportBtn.addEventListener('click', exportAnnotations);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    idFilter.addEventListener('input', filterIds);
    highlightMode.addEventListener('change', renderHexDump);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', switchTab);
    });
    annotationForm.addEventListener('submit', addAnnotation);
}

// Load sample data for demonstration (removed for privacy)
function loadSampleData() {
    // Removed sample data to ensure only user-provided data is used
    // Users must paste their own CAN log data
}

// Parse CAN log input
function parseLog() {
    const input = logInput.value.trim();
    if (!input) {
        showMessage('Please enter some CAN log data', 'error');
        return;
    }

    // Reset data
    canFrames = [];
    canGroups.clear();
    annotations.clear();

    // Split input into lines
    const lines = input.split('\n').filter(line => line.trim() !== '');
    
    let parsedCount = 0;
    let errorCount = 0;
    
    // Parse each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
            const frame = parseLine(line);
            if (frame) {
                canFrames.push(frame);
                parsedCount++;
                
                // Group frames by ID
                if (!canGroups.has(frame.id)) {
                    canGroups.set(frame.id, []);
                }
                canGroups.get(frame.id).push(frame);
            }
        } catch (error) {
            console.error(`Error parsing line ${i + 1}:`, error);
            errorCount++;
        }
    }
    
    // Auto-detect fields for each group
    canGroups.forEach((frames, id) => {
        detectChangingFields(frames, id);
    });
    
    // Update UI
    updateIdList();
    updateFrameCount();
    showMessage(`Parsed ${parsedCount} frames${errorCount > 0 ? ` with ${errorCount} errors` : ''}`, 'success');
    
    // Show first ID if available
    if (canGroups.size > 0) {
        const firstId = Array.from(canGroups.keys())[0];
        selectCanId(firstId);
    }
}

// Parse a single line of CAN log data
function parseLine(line) {
    // Match candump format: (timestamp) interface ID#payload
    const candumpRegex = /^\((\d+\.\d+)\)\s+(\w+)\s+([0-9A-Fa-f]+)#([0-9A-Fa-f]*)$/;
    const match = line.match(candumpRegex);
    
    if (match) {
        const timestamp = parseFloat(match[1]);
        const interfaceName = match[2];
        const id = match[3];
        const payloadHex = match[4];
        
        // Convert payload to bytes array
        const payload = [];
        for (let i = 0; i < payloadHex.length; i += 2) {
            payload.push(parseInt(payloadHex.substr(i, 2), 16));
        }
        
        return {
            id: id,
            timestamp: timestamp,
            payload: payload,
            dlc: payload.length
        };
    }
    
    // Try alternative formats
    // Simple format: ID#payload
    const simpleRegex = /^([0-9A-Fa-f]+)#([0-9A-Fa-f]*)$/;
    const simpleMatch = line.match(simpleRegex);
    
    if (simpleMatch) {
        const id = simpleMatch[1];
        const payloadHex = simpleMatch[2];
        
        // Convert payload to bytes array
        const payload = [];
        for (let i = 0; i < payloadHex.length; i += 2) {
            payload.push(parseInt(payloadHex.substr(i, 2), 16));
        }
        
        return {
            id: id,
            timestamp: Date.now() / 1000, // Use current timestamp
            payload: payload,
            dlc: payload.length
        };
    }
    
    // If no match, throw error to be caught by caller
    throw new Error(`Invalid CAN log format: ${line}`);
}

// Update the list of CAN IDs in the sidebar
function updateIdList() {
    idList.innerHTML = '';
    
    if (canGroups.size === 0) {
        idList.innerHTML = '<p class="empty-message">No data loaded. Paste CAN log and click Parse.</p>';
        return;
    }
    
    // Sort IDs numerically
    const sortedIds = Array.from(canGroups.keys()).sort((a, b) => {
        const numA = parseInt(a, 16);
        const numB = parseInt(b, 16);
        return numA - numB;
    });
    
    sortedIds.forEach(id => {
        const frames = canGroups.get(id);
        const firstFrame = frames[0];
        const lastFrame = frames[frames.length - 1];
        
        const idItem = document.createElement('div');
        idItem.className = 'id-item';
        idItem.dataset.id = id;
        idItem.innerHTML = `
            <div class="id-info">
                <span>${id}</span>
                <span>${frames.length} frames</span>
            </div>
            <div class="id-stats">
                <span>${firstFrame.timestamp.toFixed(3)} → ${lastFrame.timestamp.toFixed(3)}</span>
            </div>
        `;
        
        idItem.addEventListener('click', () => selectCanId(id));
        idList.appendChild(idItem);
    });
}

// Filter CAN IDs based on search term
function filterIds() {
    const searchTerm = idFilter.value.toLowerCase();
    const idItems = document.querySelectorAll('.id-item');
    
    idItems.forEach(item => {
        const id = item.dataset.id.toLowerCase();
        if (id.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Select a CAN ID to view
function selectCanId(id) {
    // Update UI to show selected ID
    selectedId = id;
    selectedGroupId = id;
    
    // Remove selected class from all items
    document.querySelectorAll('.id-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to clicked item
    const selectedItem = document.querySelector(`.id-item[data-id="${id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Update title
    selectedIdTitle.textContent = `CAN ID: ${id}`;
    
    // Render hex dump
    renderHexDump();
    
    // Render annotations
    renderAnnotations();
    
    // Render graph
    renderGraph();
}

// Render the hex dump view
function renderHexDump() {
    if (!selectedId || !canGroups.has(selectedId)) {
        hexDumpContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view hex dump</p>';
        return;
    }
    
    const frames = canGroups.get(selectedId);
    if (frames.length === 0) {
        hexDumpContainer.innerHTML = '<p class="empty-message">No frames for selected ID</p>';
        return;
    }
    
    // Determine max payload length
    const maxPayloadLength = Math.max(...frames.map(f => f.payload.length));
    
    // Create table
    let html = '<table class="hex-table"><thead><tr>';
    
    // Header row with byte positions
    html += '<th>Time</th>';
    for (let i = 0; i < maxPayloadLength; i++) {
        html += `<th>Byte ${i}</th>`;
    }
    html += '</tr></thead><tbody>';
    
    // Data rows
    const highlightType = highlightMode.value;
    
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        html += '<tr>';
        html += `<td>${frame.timestamp.toFixed(3)}</td>`;
        
        // Add payload bytes
        for (let j = 0; j < maxPayloadLength; j++) {
            const byteValue = j < frame.payload.length ? frame.payload[j] : null;
            
            let cellClass = 'byte-cell';
            let cellContent = '';
            let tooltipContent = '';
            
            if (byteValue !== null) {
                cellContent = `0x${byteValue.toString(16).toUpperCase().padStart(2, '0')}`;
                
                // Add tooltip with value history
                tooltipContent = `Byte ${j}: `;
                if (i > 0) {
                    const prevFrame = frames[i - 1];
                    const prevByte = j < prevFrame.payload.length ? prevFrame.payload[j] : null;
                    if (prevByte !== null) {
                        tooltipContent += `${prevByte.toString(16).toUpperCase().padStart(2, '0')} → `;
                    }
                }
                tooltipContent += byteValue.toString(16).toUpperCase().padStart(2, '0');
                
                // Apply highlighting based on change detection
                if (i > 0) {
                    const prevFrame = frames[i - 1];
                    const prevByte = j < prevFrame.payload.length ? prevFrame.payload[j] : null;
                    
                    if (prevByte !== null && prevByte !== byteValue) {
                        // Calculate change intensity (0-255)
                        const diff = Math.abs(prevByte - byteValue);
                        if (diff > 200) {
                            cellClass += ' changed-heavy';
                        } else if (diff > 100) {
                            cellClass += ' changed-medium';
                        } else if (diff > 0) {
                            cellClass += ' changed-light';
                        }
                    }
                }
            } else {
                cellContent = '--';
            }
            
            // Wrap cell in tooltip if needed
            if (tooltipContent) {
                html += `<td class="${cellClass} tooltip">${cellContent}<span class="tooltip-text">${tooltipContent}</span></td>`;
            } else {
                html += `<td class="${cellClass}">${cellContent}</td>`;
            }
        }
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    hexDumpContainer.innerHTML = html;
}

// Detect changing fields in a group of frames
function detectChangingFields(frames, id) {
    if (frames.length < 2) return;
    
    // For each byte position, analyze how often it changes
    const maxBytes = Math.max(...frames.map(f => f.payload.length));
    const fieldAnalysis = [];
    
    for (let bytePos = 0; bytePos < maxBytes; bytePos++) {
        let changes = 0;
        let uniqueValues = new Set();
        
        // Check how many times this byte position changes
        for (let i = 1; i < frames.length; i++) {
            const currentFrame = frames[i];
            const prevFrame = frames[i - 1];
            
            if (bytePos < currentFrame.payload.length && bytePos < prevFrame.payload.length) {
                const currentValue = currentFrame.payload[bytePos];
                const prevValue = prevFrame.payload[bytePos];
                
                if (currentValue !== prevValue) {
                    changes++;
                }
                uniqueValues.add(currentValue);
            }
        }
        
        // Calculate change frequency
        const changeFrequency = frames.length > 1 ? changes / (frames.length - 1) : 0;
        
        fieldAnalysis.push({
            bytePosition: bytePos,
            changes: changes,
            changeFrequency: changeFrequency,
            uniqueValues: uniqueValues.size,
            isStable: uniqueValues.size <= 1,
            isVariable: uniqueValues.size > 1
        });
    }
    
    // Store analysis for later use
    // In a real implementation, we'd store this in a more persistent way
    console.log(`Field analysis for ID ${id}:`, fieldAnalysis);
}

// Render annotations for selected ID
function renderAnnotations() {
    if (!selectedId) {
        annotationList.innerHTML = '<p class="empty-message">Select a CAN ID to view annotations</p>';
        return;
    }
    
    // Get annotations for this ID
    const idAnnotations = annotations.get(selectedId) || [];
    
    if (idAnnotations.length === 0) {
        annotationList.innerHTML = '<p class="empty-message">No annotations for selected ID</p>';
        return;
    }
    
    // Render annotations
    let html = '';
    idAnnotations.forEach(annotation => {
        html += `
            <div class="annotation-item">
                <h4>${annotation.name}</h4>
                <p>Bits ${annotation.startBit}-${annotation.startBit + annotation.length - 1} (${annotation.length} bits)</p>
                <p>Type: ${annotation.type} | Scale: ${annotation.factor} | Offset: ${annotation.offset}</p>
                ${annotation.unit ? `<p>Unit: ${annotation.unit}</p>` : ''}
            </div>
        `;
    });
    
    annotationList.innerHTML = html;
}

// Render graph view
function renderGraph() {
    if (!selectedId || !canGroups.has(selectedId)) {
        return;
    }
    
    const frames = canGroups.get(selectedId);
    
    // Prepare data for chart
    const timestamps = frames.map(f => f.timestamp);
    const byteValues = {};
    
    // For each byte position, collect values
    const maxBytes = Math.max(...frames.map(f => f.payload.length));
    
    for (let bytePos = 0; bytePos < maxBytes; bytePos++) {
        byteValues[bytePos] = frames.map(f => {
            return bytePos < f.payload.length ? f.payload[bytePos] : null;
        });
    }
    
    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('deltaChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: Object.entries(byteValues).map(([bytePos, values], index) => ({
                label: `Byte ${bytePos}`,
                data: values,
                borderColor: getColorForIndex(index),
                backgroundColor: getColorForIndex(index, 0.1),
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Timestamp'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Byte Value'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Helper function to get consistent colors for chart lines
function getColorForIndex(index, alpha = 1) {
    const colors = [
        'rgba(255, 99, 132, {alpha})',
        'rgba(54, 162, 235, {alpha})',
        'rgba(255, 205, 86, {alpha})',
        'rgba(75, 192, 192, {alpha})',
        'rgba(153, 102, 255, {alpha})',
        'rgba(255, 159, 64, {alpha})',
        'rgba(199, 199, 199, {alpha})',
        'rgba(83, 102, 255, {alpha})'
    ];
    
    const color = colors[index % colors.length];
    return color.replace('{alpha}', alpha);
}

// Add annotation to selected ID
function addAnnotation(e) {
    e.preventDefault();
    
    if (!selectedId) {
        showMessage('Please select a CAN ID first', 'error');
        return;
    }
    
    // Get form values
    const name = document.getElementById('signalName').value;
    const startBit = parseInt(document.getElementById('signalStart').value);
    const length = parseInt(document.getElementById('signalLength').value);
    const type = document.getElementById('signalType').value;
    const factor = parseFloat(document.getElementById('signalFactor').value);
    const offset = parseFloat(document.getElementById('signalOffset').value);
    const unit = document.getElementById('signalUnit').value;
    
    // Create annotation object
    const annotation = {
        name: name,
        startBit: startBit,
        length: length,
        type: type,
        factor: factor,
        offset: offset,
        unit: unit
    };
    
    // Store annotation
    if (!annotations.has(selectedId)) {
        annotations.set(selectedId, []);
    }
    annotations.get(selectedId).push(annotation);
    
    // Update UI
    renderAnnotations();
    showMessage('Annotation added successfully', 'success');
    
    // Reset form
    annotationForm.reset();
}

// Clear all data
function clearAll() {
    canFrames = [];
    canGroups.clear();
    selectedId = null;
    selectedGroupId = null;
    
    // Clear UI
    logInput.value = '';
    idList.innerHTML = '<p class="empty-message">No data loaded. Paste CAN log and click Parse.</p>';
    hexDumpContainer.innerHTML = '<p class="empty-message">Select a CAN ID to view hex dump</p>';
    selectedIdTitle.textContent = 'Select a CAN ID';
    annotationList.innerHTML = '<p class="empty-message">No annotations for selected ID</p>';
    
    // Reset chart
    if (chart) {
        chart.destroy();
        chart = null;
    }
    
    updateFrameCount();
    showMessage('Data cleared', 'success');
}

// Export annotations
function exportAnnotations() {
    if (canGroups.size === 0) {
        showMessage('No data to export', 'error');
        return;
    }
    
    // Create export data
    const exportData = {
        annotations: Object.fromEntries(annotations),
        timestamp: new Date().toISOString()
    };
    
    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'can-annotations.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showMessage('Annotations exported successfully', 'success');
}

// Toggle dark mode
function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    darkModeToggle.textContent = darkMode ? 'Light Mode' : 'Dark Mode';
}

// Switch between tabs
function switchTab(e) {
    const tabBtn = e.target;
    const tabId = tabBtn.dataset.tab;
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    tabBtn.classList.add('active');
    
    // Show corresponding tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabId}Tab`).classList.add('active');
    
    // Render content when switching to hex or graph tabs
    if (tabId === 'hex') {
        renderHexDump();
    } else if (tabId === 'graph') {
        renderGraph();
    }
}

// Update frame count in footer
function updateFrameCount() {
    const frameCountValue = canFrames.length;
    const idCount = canGroups.size;
    frameCount.textContent = `Frames: ${frameCountValue} | IDs: ${idCount}`;
}

// Show status message
function showMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-${type}`;
    
    // Clear message after delay
    setTimeout(() => {
        if (statusMessage.textContent === message) {
            statusMessage.textContent = 'Ready to parse';
        }
    }, 3000);
}