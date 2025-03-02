/**
 * PAP-Functions - Core PAP (Program Flow Chart) functionality
 */

// Track which blocks are currently in use
let usedBlocks = new Set();

// Grid snapping functions
function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
}

// Helper functions for connection validation and shape type
function getShapeType(shape) {
    if (shape.classList.contains('start-end')) return 'start-end';
    if (shape.classList.contains('process')) return 'process';
    if (shape.classList.contains('input-output')) return 'input-output';
    if (shape.classList.contains('decision')) return 'decision';
    return '';
}

function hasIncomingConnection(point) {
    return leaderLines.some(line => line.end === point);
}

function hasOutgoingConnection(point) {
    return leaderLines.some(line => line.start === point);
}

function hasDecisionConnection(position, block) {
    return leaderLines.some(line => 
        line.start.closest('.pap-shape') === block && 
        line.start.dataset.position === position
    );
}

function validateConnection(startPoint, endPoint) {
    if (!startPoint || !endPoint) {
        console.warn('Connection validation failed: Invalid start or end point');
        return false;
    }
    
    const startBlock = startPoint.closest('.pap-shape');
    const endBlock = endPoint.closest('.pap-shape');
    
    if (!startBlock || !endBlock) {
        console.warn('Connection validation failed: Invalid start or end block');
        return false;
    }

    if (startBlock === endBlock) {
        console.warn('Connection validation failed: Self-connection not allowed');
        return false;
    }

    // Validate connection based on block types
    const startType = getShapeType(startBlock);
    const endType = getShapeType(endBlock);
    
    // Start/End block can only have one connection
    if (startType === 'start-end') {
        if (hasOutgoingConnection(startPoint)) {
            console.warn('Connection validation failed: Start block already has a connection');
            return false;
        }
    }

    // Decision block specific validation
    if (startType === 'decision') {
        const position = startPoint.dataset.position;
        // Check if this decision output is already connected
        if (hasDecisionConnection(position, startBlock)) {
            console.warn('Connection validation failed: Decision output already connected');
            return false;
        }
    }

    // Check for circular dependencies
    if (wouldCreateCircularDependency(startBlock, endBlock)) {
        console.warn('Connection validation failed: Would create circular dependency');
        return false;
    }

    return true;
}

function wouldCreateCircularDependency(startBlock, endBlock, visited = new Set()) {
    if (startBlock === endBlock) return true;
    if (visited.has(startBlock)) return false;
    
    visited.add(startBlock);
    
    // Get all outgoing connections from the end block
    const outgoingConnections = leaderLines.filter(line => 
        line.start.closest('.pap-shape') === endBlock
    );
    
    // Check each connection recursively
    for (const connection of outgoingConnections) {
        const nextBlock = connection.end.closest('.pap-shape');
        if (wouldCreateCircularDependency(startBlock, nextBlock, visited)) {
            return true;
        }
    }
    
    return false;
}

// Error handling utility function
function handleError(error, context, showUser = false) {
    const errorMessage = `Error in ${context}: ${error.message}`;
    console.error(errorMessage, error);
    
    if (showUser) {
        showFeedback(errorMessage, false);
    }
    return null;
}

// Cleanup function for connections
function cleanupConnection(connection) {
    try {
        if (!connection) return;

        // Remove control point if it exists
        if (connection.controlPoint && connection.controlPoint.parentNode) {
            connection.controlPoint.remove();
        }

        // Remove the connection from leaderLines array
        const index = leaderLines.indexOf(connection);
        if (index > -1) {
            leaderLines.splice(index, 1);
            
            // Mark as removed before actually removing to prevent callback errors
            connection.removed = true;
            connection.remove();
        }
    } catch (error) {
        handleError(error, 'cleanupConnection');
    }
}

let previewLine = null;

function showConnectionPreview(startPoint, mousePos) {
    if (!startPoint) return;
    
    // Remove old preview if exists
    if (previewLine) {
        previewLine.remove();
        previewLine = null;
    }
    
    // Create temporary preview line
    const drawingArea = document.querySelector('.drawing-area');
    const rect = drawingArea.getBoundingClientRect();
    const endPos = {
        x: mousePos.clientX - rect.left,
        y: mousePos.clientY - rect.top
    };
    
    previewLine = new LeaderLine(
        startPoint,
        LeaderLine.pointAnchor(document.elementFromPoint(mousePos.clientX, mousePos.clientY), {
            x: endPos.x,
            y: endPos.y
        }),
        {
            color: 'rgba(128, 128, 128, 0.5)',
            size: 2,
            path: 'fluid',
            startSocket: startPoint.dataset.position,
            dash: true
        }
    );
}

function removeConnectionPreview() {
    if (previewLine) {
        previewLine.remove();
        previewLine = null;
    }
    document.querySelectorAll('.connection-point').forEach(point => {
        point.classList.remove('valid-target', 'invalid-target');
    });
}

function snapFinal(element) {
    if (!element) return;
    const x = parseInt(element.style.left);
    const y = parseInt(element.style.top);
    element.style.left = `${snapToGrid(x)}px`;
    element.style.top = `${snapToGrid(y)}px`;
}

function createConnectionPoints(element) {
    if (element.classList.contains('decision')) {
        // Füge die Labels für Entscheidungsblöcke hinzu
        const jaLabel = document.createElement('div');
        jaLabel.className = 'label-ja';
        jaLabel.textContent = 'ja';
        element.appendChild(jaLabel);

        const neinLabel = document.createElement('div');
        neinLabel.className = 'label-nein';
        neinLabel.textContent = 'nein';
        element.appendChild(neinLabel);
    }

    ['top', 'right', 'bottom', 'left'].forEach(position => {
        const point = document.createElement('div');
        point.className = `connection-point ${position}`;
        point.dataset.position = position;
        element.appendChild(point);

        // Remove the label creation code since it's now handled by CSS
        
        point.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            isDragging = false;
            
            connecting = true;
            connectionStart = {
                element: element,
                point: position,
                anchor: point
            };
            point.classList.add('active');

            // Add mousemove listener for preview
            document.addEventListener('mousemove', (e) => {
                if (connecting) {
                    showConnectionPreview(connectionStart.anchor, e);
                }
            });
        });

        // Add global mouseup listener
        document.addEventListener('mouseup', () => {
            if (connecting) {
                removeConnectionPreview();
            }
        });

        point.addEventListener('mouseenter', () => {
            mouseOverPoint = {
                element: element,
                point: position,
                anchor: point
            };

            if (connecting && element !== connectionStart?.element) {
                point.classList.add('highlight');
            }
        });

        point.addEventListener('mouseleave', () => {
            if (mouseOverPoint?.anchor === point) {
                mouseOverPoint = null;
            }
            point.classList.remove('highlight');
        });

        point.addEventListener('mouseup', (e) => {
            if (connecting && connectionStart && element !== connectionStart.element) {
                e.stopPropagation();
                e.preventDefault();

                try {
                    removeConnectionPreview();
                    
                    // Create and add control point first
                    const controlPoint = document.createElement('div');
                    controlPoint.className = 'line-control-point';
                    controlPoint.wasManuallyMoved = false;
                    document.querySelector('.drawing-area').appendChild(controlPoint);
                    
                    // Position control point at the midpoint
                    const startPos = connectionStart.anchor.getBoundingClientRect();
                    const endPos = point.getBoundingClientRect();
                    const drawingRect = document.querySelector('.drawing-area').getBoundingClientRect();
                    const midX = (startPos.x + endPos.x) / 2 - drawingRect.left;
                    const midY = (startPos.y + endPos.y) / 2 - drawingRect.top;
                    
                    controlPoint.style.left = `${midX}px`;
                    controlPoint.style.top = `${midY}px`;
                    
                    // 1. Linie vom Startpunkt zum Kontrollpunkt
                    const startLine = new LeaderLine(
                        connectionStart.anchor,
                        LeaderLine.pointAnchor(controlPoint),
                        {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                            size: 2,
                            path: 'straight',
                            startSocket: connectionStart.point,
                            endSocket: 'bottom',
                            endPlug: 'behind',
                            startSocketGravity: 0,
                            endSocketGravity: 0
                        }
                    );
                    
                    // 2. Linie vom Kontrollpunkt zum Endpunkt
                    const endLine = new LeaderLine(
                        LeaderLine.pointAnchor(controlPoint),
                        point,
                        {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                            size: 2,
                            path: 'straight',
                            startSocket: 'top',
                            endSocket: position,
                            endPlug: 'arrow3',
                            startSocketGravity: 0,
                            endSocketGravity: 0
                        }
                    );
                    
                    // Speichere Referenzen auf beide Linien im Kontrollpunkt
                    controlPoint.startLine = startLine;
                    controlPoint.endLine = endLine;
                    
                    // Referenzen in den Linien auf den Kontrollpunkt speichern
                    startLine.controlPoint = controlPoint;
                    endLine.controlPoint = controlPoint;
                    
                    // Add the two lines to the leaderLines array
                    leaderLines.push(startLine);
                    leaderLines.push(endLine);

                    // Rest des Codes bleibt gleich...
                    // ...existing code...

                    // Add control point drag behavior
                    controlPoint.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        
                        // If Delete key is being held, delete both lines
                        if (isDeleteKeyPressed) {
                            // Entferne beide Linien
                            const startIndex = leaderLines.indexOf(startLine);
                            const endIndex = leaderLines.indexOf(endLine);
                            
                            if (startIndex > -1) {
                                leaderLines.splice(startIndex, 1);
                                startLine.remove();
                            }
                            
                            if (endIndex > -1) {
                                leaderLines.splice(endIndex > startIndex ? endIndex - 1 : endIndex, 1);
                                endLine.remove();
                            }
                            
                            controlPoint.remove();
                            saveState();
                            return;
                        }

                        // Normal dragging behavior
                        isDragging = true;
                        selectedElement = controlPoint;
                        const rect = controlPoint.getBoundingClientRect();
                        startX = e.clientX - rect.left;
                        startY = e.clientY - rect.top;
                        controlPoint.wasManuallyMoved = true; // User started dragging
                    });
                    
                    // Add click event for deletion via UI
                    const deleteConnection = () => {
                        const startIndex = leaderLines.indexOf(startLine);
                        const endIndex = leaderLines.indexOf(endLine);
                        
                        if (startIndex > -1) {
                            leaderLines.splice(startIndex, 1);
                            startLine.remove();
                        }
                        
                        if (endIndex > -1) {
                            leaderLines.splice(endIndex > startIndex ? endIndex - 1 : endIndex, 1);
                            endLine.remove();
                        }
                        
                        controlPoint.remove();
                        saveState();
                    };
                    
                    // Make both lines clickable for deletion
                    if (startLine.element) {
                        startLine.element.style.cursor = 'pointer';
                        startLine.element.title = 'Klicken zum Löschen der Verbindung';
                        startLine.element.addEventListener('click', deleteConnection);
                    }
                    
                    if (endLine.element) {
                        endLine.element.style.cursor = 'pointer';
                        endLine.element.title = 'Klicken zum Löschen der Verbindung';
                        endLine.element.addEventListener('click', deleteConnection);
                    }
                    
                    saveState();
                } catch (error) {
                    console.error('Error creating connection:', error);
                }
            }

            const activePoint = document.querySelector('.connection-point.active');
            if (activePoint) activePoint.classList.remove('active');
            document.querySelectorAll('.connection-point').forEach(p => {
                p.classList.remove('potential-target');
                p.classList.remove('highlight');
            });
            connecting = false;
            connectionStart = null;
        });

        point.addEventListener('dragstart', (e) => e.preventDefault());
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
    });
}

function startDragging(e) {
    if (e.button !== 0) return;
    if (e.target.classList.contains('connection-point') || connecting) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    
    const target = e.target.closest('.pap-shape');
    if (!target) return;

    const drawingArea = document.getElementById('drawing-area');
    isDragging = true;
    selectedElement = target;
    draggingElement = target;

    const rect = target.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    if (!target.parentElement.classList.contains('drawing-area')) {
        const blockText = target.querySelector('span').textContent.trim();
        
        // If block is already in use, don't allow dragging
        if (usedBlocks.has(blockText)) {
            isDragging = false;
            selectedElement = null;
            draggingElement = null;
            return;
        }

        // Deep clone für decision blocks
        if (target.classList.contains('decision')) {
            selectedElement = target.cloneNode(true);
        } else {
            selectedElement = target.cloneNode(true);
        }
        
        selectedElement.style.position = 'absolute';
        drawingArea.appendChild(selectedElement);
        createConnectionPoints(selectedElement);
        selectedElement.addEventListener('mousedown', startDragging);

        const drawingRect = drawingArea.getBoundingClientRect();
        const newX = e.clientX - drawingRect.left - rect.width / 2;
        const newY = e.clientY - drawingRect.top - rect.height / 2;
        
        selectedElement.style.left = `${snapToGrid(newX)}px`;
        selectedElement.style.top = `${snapToGrid(newY)}px`;

        // Add to used blocks and hide original
        usedBlocks.add(blockText);
        target.style.opacity = '0.3';
        target.style.pointerEvents = 'none';
    }

    selectedElement.classList.add('dragging');
    selectedElement.classList.add('selected');
    document.querySelectorAll('.pap-shape').forEach(shape => {
        if (shape !== selectedElement) shape.classList.remove('selected');
    });

    if (target.parentElement.classList.contains('drawing-area')) {
        saveState();
    }
    e.preventDefault();
    e.stopPropagation();
}

// Update handleMouseMove to include null checks
function handleMouseMove(e) {
    if (!isDragging || !selectedElement) return;

    const drawingArea = document.getElementById('drawing-area');
    if (!drawingArea) return;

    const drawingRect = drawingArea.getBoundingClientRect();
    
    // Check if dragging a control point
    if (selectedElement.classList.contains('line-control-point')) {
        try {
            // Freie Positionierung für Kontrollpunkte ohne Snapping
            const mouseX = e.clientX - drawingRect.left;
            const mouseY = e.clientY - drawingRect.top;

            selectedElement.style.left = `${mouseX}px`;
            selectedElement.style.top = `${mouseY}px`;
            
            // Update verbundener Linien mit zusätzlichen Null-Checks
            if (selectedElement.startLine && 
                selectedElement.endLine && 
                typeof selectedElement.startLine?.position === 'function' &&
                typeof selectedElement.endLine?.position === 'function' &&
                !selectedElement.startLine.removed && 
                !selectedElement.endLine.removed) {
                requestAnimationFrame(() => {
                    try {
                        selectedElement.startLine.position();
                        selectedElement.endLine.position();
                    } catch (error) {
                        handleError(error, 'Updating connection lines');
                    }
                });
            }
            
            selectedElement.wasManuallyMoved = true;
        } catch (error) {
            handleError(error, 'Control point movement');
        }
    } else {
        // Normal shape dragging behavior mit Grid-Snapping
        let newX = e.clientX - drawingRect.left - startX;
        let newY = e.clientY - drawingRect.top - startY;

        newX = snapToGrid(newX);
        newY = snapToGrid(newY);

        const maxX = drawingRect.width - selectedElement.offsetWidth;
        const maxY = drawingRect.height - selectedElement.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        selectedElement.style.left = `${newX}px`;
        selectedElement.style.top = `${newY}px`;

        // Update verbundener Linien mit requestAnimationFrame
        requestAnimationFrame(() => {
            document.querySelectorAll('.line-control-point').forEach(controlPoint => {
                if (controlPoint.startLine && controlPoint.endLine) {
                    controlPoint.startLine.position();
                    controlPoint.endLine.position();
                }
            });
        });
    }
}

function handleMouseUp(e) {
    if (connecting && mouseOverPoint && mouseOverPoint.element !== connectionStart?.element) {
        return;
    }

    if (connecting) {
        const activePoint = document.querySelector('.connection-point.active');
        if (activePoint) activePoint.classList.remove('active');
        document.querySelectorAll('.connection-point').forEach(p => {
            p.classList.remove('potential-target');
            p.classList.remove('highlight');
        });
        connecting = false;
        connectionStart = null;
    }

    if (selectedElement) {
        selectedElement.classList.remove('dragging');
        snapFinal(selectedElement);
        saveState();
    }
    isDragging = false;
    selectedElement = null;
    draggingElement = null;
}

function saveState() {
    const state = getCurrentState();
    undoStack.push(JSON.stringify(state));
    redoStack = [];
}

function validateConnectionPoints(startPoint, endPoint) {
    try {
        if (!startPoint || !endPoint) {
            handleError(new Error('Missing connection points'), 'validateConnectionPoints');
            return false;
        }

        // Check if points are DOM elements
        if (!(startPoint instanceof Element) || !(endPoint instanceof Element)) {
            handleError(new Error('Connection points are not DOM elements'), 'validateConnectionPoints');
            return false;
        }

        const startShape = startPoint.closest('.pap-shape');
        const endShape = endPoint.closest('.pap-shape');

        if (!startShape || !endShape) {
            handleError(new Error('Connection points not attached to shapes'), 'validateConnectionPoints');
            return false;
        }

        if (!startShape.dataset?.id || !endShape.dataset?.id) {
            handleError(new Error('Shapes missing IDs'), 'validateConnectionPoints');
            return false;
        }

        if (!startPoint.dataset?.position || !endPoint.dataset?.position) {
            handleError(new Error('Missing connection positions'), 'validateConnectionPoints');
            return false;
        }

        return true;
    } catch (error) {
        handleError(error, 'validateConnectionPoints');
        return false;
    }
}

function getCurrentState() {
    try {
        const drawingArea = document.getElementById('drawing-area');
        if (!drawingArea) {
            throw new Error('Drawing area not found');
        }

        const shapes = [];
        const connections = [];
        const processedLines = new Set();

        // Process shapes with improved error handling
        drawingArea.querySelectorAll('.pap-shape').forEach(shape => {
            try {
                if (!shape.dataset.id) {
                    shape.dataset.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                }

                const textElement = shape.querySelector('span');
                if (!textElement) {
                    throw new Error('Shape missing text element');
                }

                shapes.push({
                    type: getShapeType(shape),
                    left: shape.style.left || '0px',
                    top: shape.style.top || '0px',
                    text: textElement.textContent.trim(),
                    id: shape.dataset.id
                });
            } catch (error) {
                handleError(error, 'Shape processing');
            }
        });

        // Process connections with improved validation
        leaderLines.forEach(line => {
            try {
                if (!line || processedLines.has(line)) return;

                // Skip if line is being removed or is invalid
                if (!line.start || !line.end || !line.element || line.removed) {
                    return;
                }

                const startPoint = line.start;
                const endPoint = line.end;

                // Skip invalid connections
                if (!validateConnectionPoints(startPoint, endPoint)) {
                    return;
                }

                const startShape = startPoint.closest('.pap-shape');
                const endShape = endPoint.closest('.pap-shape');
                
                if (!startShape || !endShape) return;

                const connectionData = {
                    startId: startShape.dataset.id,
                    endId: endShape.dataset.id,
                    startPoint: startPoint.dataset.position,
                    endPoint: endPoint.dataset.position
                };

                // Handle control point data if it exists
                if (line.controlPoint && line.controlPoint.style) {
                    try {
                        connectionData.controlPoint = {
                            x: parseInt(line.controlPoint.style.left) || 0,
                            y: parseInt(line.controlPoint.style.top) || 0,
                            wasManuallyMoved: !!line.controlPoint.wasManuallyMoved
                        };
                    } catch (controlPointError) {
                        handleError(controlPointError, 'Control point processing');
                    }
                }

                connections.push(connectionData);
                processedLines.add(line);
            } catch (error) {
                handleError(error, 'Connection processing');
            }
        });

        return { shapes, connections };
    } catch (error) {
        handleError(error, 'getCurrentState', true);
        return { shapes: [], connections: [] };
    }
}

function applyState(state) {
    clearDrawingArea();
    const drawingArea = document.getElementById('drawing-area');

    state.shapes.forEach(shapeData => {
        const shape = document.createElement('div');
        shape.className = `pap-shape ${shapeData.type}`;
        shape.style.position = 'absolute';
        shape.style.left = shapeData.left;
        shape.style.top = shapeData.top;

        const span = document.createElement('span');
        span.textContent = shapeData.text;
        shape.appendChild(span);

        shape.dataset.id = shapeData.id;
        drawingArea.appendChild(shape);
        createConnectionPoints(shape);
        shape.addEventListener('mousedown', startDragging);
    });

    state.connections.forEach(connData => {
        const startShape = document.querySelector(`[data-id="${connData.startId}"]`);
        const endShape = document.querySelector(`[data-id="${connData.endId}"]`);
        if (startShape && endShape) {
            const startPoint = startShape.querySelector(`.connection-point.${connData.startPoint}`);
            const endPoint = endShape.querySelector(`.connection-point.${connData.endPoint}`);
            if (startPoint && endPoint) {
                const line = new LeaderLine(
                    startPoint,
                    endPoint,
                    {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                        size: 2,
                        path: 'grid', // Ändern von 'fluid' zu 'grid' für konsistente Anzeige
                        startSocketGravity: 50,
                        endSocketGravity: 50,
                        anchorAutoRotation: true,
                        startSocket: connData.startPoint,
                        endSocket: connData.endPoint,
                        endPlug: 'arrow3',
                        gradient: true,
                        dropShadow: true
                    }
                );
                
                // Create control point
                if (connData.controlPoint) {
                    const controlPoint = document.createElement('div');
                    controlPoint.className = 'line-control-point';
                    controlPoint.wasManuallyMoved = connData.controlPoint.wasManuallyMoved;
                    drawingArea.appendChild(controlPoint);
                    
                    controlPoint.style.left = `${connData.controlPoint.x}px`;
                    controlPoint.style.top = `${connData.controlPoint.y}px`;
                    
                    controlPoint.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        
                        // If Delete key is being held, delete the line
                        if (isDeleteKeyPressed) {
                            const index = leaderLines.indexOf(line);
                            if (index > -1) {
                                if (line.controlPoint) {
                                    line.controlPoint.remove();
                                }
                                leaderLines.splice(index, 1);
                                line.remove();
                                saveState();
                            }
                            return;
                        }

                        isDragging = true;
                        selectedElement = controlPoint;
                        const rect = controlPoint.getBoundingClientRect();
                        startX = e.clientX - rect.left;
                        startY = e.clientY - rect.top;
                        controlPoint.wasManuallyMoved = true;
                    });
                    
                    line.controlPoint = controlPoint;
                    controlPoint.line = line;
                    
                    // Setze die Line-Optionen und verwende den Kontrollpunkt als Anker
                    line.setOptions({
                        path: 'grid',
                        startSocketGravity: 50,
                        endSocketGravity: 50,
                        anchorAutoRotation: true,
                        middleAnchor: LeaderLine.pointAnchor(controlPoint) // Verwende pointAnchor für konsistentes Verhalten
                    });
                }
                
                leaderLines.push(line);
                
                const svgContainer = line.element;
                if (svgContainer) {
                    svgContainer.style.cursor = 'pointer';
                    svgContainer.title = 'Klicken zum Löschen der Verbindung';
                    svgContainer.addEventListener('click', () => {
                        const index = leaderLines.indexOf(line);
                        if (index > -1) {
                            if (line.controlPoint) {
                                line.controlPoint.remove();
                            }
                            leaderLines.splice(index, 1);
                            line.remove();
                            saveState();
                        }
                    });
                }
            }
        }
    });
}

function undo() {
    if (undoStack.length > 0) {
        const currentState = getCurrentState();
        redoStack.push(JSON.stringify(currentState));
        const previousState = JSON.parse(undoStack.pop());
        applyState(previousState);
    }
}

function redo() {
    if (redoStack.length > 0) {
        const currentState = getCurrentState();
        undoStack.push(JSON.stringify(currentState));
        const nextState = JSON.parse(redoStack.pop());
        applyState(nextState);
    }
}

function clearDrawingArea(shouldSaveState = false) {
    if (shouldSaveState && currentTask) {
        // Save the current state before clearing
        saveCanvasState();
    }
    
    const drawingArea = document.getElementById('drawing-area');
    
    // Reset all used blocks in sidebar
    usedBlocks.clear();
    document.querySelectorAll('.sidebar .pap-shape').forEach(block => {
        block.style.opacity = '';
        block.style.pointerEvents = '';
    });
    
    // Remove control points
    document.querySelectorAll('.line-control-point').forEach(point => {
        point.remove();
    });
    
    // Remove all other elements
    while (drawingArea.firstChild) {
        drawingArea.removeChild(drawingArea.firstChild);
    }
    
    // Remove leader lines
    leaderLines.forEach(line => {
        if (line.controlPoint) {
            line.controlPoint.remove();
        }
        line.remove();
    });
    leaderLines = [];
    connecting = false;
    connectionStart = null;
}

function showFeedback(message, isSuccess = false) {
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isSuccess ? 'success' : 'error'}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
}

// checkSolution function has been moved to handle_correct.js
