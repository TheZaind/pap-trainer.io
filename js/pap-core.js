/**
 * PAP-Core - Core functionality for shapes and connections
 */

// Grid and sizing configuration
const blockSize = 32;
const gridSize = blockSize;
const snapThreshold = blockSize / 2;

// State variables for shape manipulation
let connecting = false;
let connectionStart = null;
let isDragging = false;
let selectedElement = null;
let draggingElement = null;
let startX = 0;
let startY = 0;
let mouseOverPoint = null;
let activeLine = null;
let leaderLines = [];
let selectedControlPoint = null;
let isDraggingControlPoint = false;
let controlPoints = new Map(); // Map to store line -> control point relationships

// Grid snapping functions
function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
}

function snapFinal(element) {
    if (!element) return;
    const x = parseInt(element.style.left);
    const y = parseInt(element.style.top);
    element.style.left = `${snapToGrid(x)}px`;
    element.style.top = `${snapToGrid(y)}px`;
}

// Helper function to get shape type
function getShapeType(shape) {
    if (shape.classList.contains('start-end')) return 'start-end';
    if (shape.classList.contains('process')) return 'process';
    if (shape.classList.contains('input-output')) return 'input-output';
    if (shape.classList.contains('decision')) return 'decision';
    return '';
}

// Helper function to safely call PAPUI.saveState
function trySaveState() {
    if (window.PAPUI && typeof window.PAPUI.saveState === 'function') {
        window.PAPUI.saveState();
    }
}

// Line management functions
function updateLinePosition(line, startX, startY, controlX, controlY, endX, endY) {
    const baseColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
    
    // Update line with path and styling
    line.setOptions({
        path: [
            ['M', startX, startY],
            ['L', controlX, controlY],
            ['L', endX, endY]
        ],
        color: baseColor,
        size: 2.5,
        startPlug: 'behind',
        endPlug: 'arrow3',
        outline: false,
        dropShadow: false
    });

    // Force immediate position update
    line.position();

    // Ensure proper z-index and styling
    if (line.element) {
        line.element.style.zIndex = '1';
        // Style all path elements
        line.element.querySelectorAll('path').forEach(el => {
            el.style.fill = 'none';
            el.style.stroke = baseColor;
            el.style.strokeWidth = '2.5px';
        });
        
        // Style arrow head specifically
        const arrow = line.element.querySelector('.leader-line-arrow-head');
        if (arrow) {
            arrow.style.fill = baseColor;
        }
    }

// Keep control point on top and update its offset
    const controlPoint = controlPoints.get(line);
    if (controlPoint) {
        controlPoint.style.zIndex = '2';
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        
        // Update offset if control point is moved
        if (isDraggingControlPoint && selectedControlPoint === controlPoint) {
            controlPoint.dataset.offsetX = (controlX - centerX).toString();
            controlPoint.dataset.offsetY = (controlY - centerY).toString();
        } 
        // Otherwise maintain current offset
        else {
            const offsetX = parseFloat(controlPoint.dataset.offsetX) || 0;
            const offsetY = parseFloat(controlPoint.dataset.offsetY) || 0;
            controlPoint.style.left = `${centerX + offsetX}px`;
            controlPoint.style.top = `${centerY + offsetY}px`;
        }
    }
}

function createControlPoint(line) {
    const point = document.createElement('div');
    point.className = 'line-control-point';
    document.querySelector('.drawing-area').appendChild(point);
    
    const startPos = line.start.getBoundingClientRect();
    const endPos = line.end.getBoundingClientRect();
    const drawingRect = document.querySelector('.drawing-area').getBoundingClientRect();
    const midX = (startPos.x + endPos.x) / 2 - drawingRect.left;
    const midY = (startPos.y + endPos.y) / 2 - drawingRect.top;

    point.style.left = `${midX}px`;
    point.style.top = `${midY}px`;
    point.style.zIndex = '2';
    
    point.dataset.offsetX = "0";
    point.dataset.offsetY = "0";

    point.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        isDraggingControlPoint = true;
        selectedControlPoint = point;
        point.classList.add('selected');
        
        const rect = point.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    });

    point.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.line-control-point').forEach(p => p.classList.remove('selected'));
        point.classList.add('selected');
        selectedControlPoint = point;
    });

    point.tabIndex = 0;
    point.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            for (const [l, p] of controlPoints.entries()) {
                if (p === point) {
                    const index = leaderLines.indexOf(l);
                    if (index > -1) {
                        leaderLines.splice(index, 1);
                        l.remove();
                        point.remove();
                        controlPoints.delete(l);
                        trySaveState();
                    }
                    break;
                }
            }
        }
    });

    controlPoints.set(line, point);
    return point;
}

function createConnectionPoints(element) {
    ['top', 'right', 'bottom', 'left'].forEach(position => {
        const point = document.createElement('div');
        point.className = `connection-point ${position} visible`;
        point.dataset.position = position;
        element.appendChild(point);

        point.addEventListener('mousedown', (e) => {
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

            document.querySelectorAll('.pap-shape').forEach(shape => {
                if (shape !== element) {
                    shape.querySelectorAll('.connection-point').forEach(p => {
                        p.classList.add('potential-target');
                    });
                }
            });
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

        // Ensure LeaderLine is loaded before proceeding
        if (!window.LeaderLine) {
            console.error('LeaderLine is not loaded');
            return;
        }
                    
        try {
            const drawingRect = document.querySelector('.drawing-area').getBoundingClientRect();
            const startRect = connectionStart.anchor.getBoundingClientRect();
            const endRect = point.getBoundingClientRect();
            
            const startX = startRect.x - drawingRect.left + startRect.width/2;
            const startY = startRect.y - drawingRect.top + startRect.height/2;
            const endX = endRect.x - drawingRect.left + endRect.width/2;
            const endY = endRect.y - drawingRect.top + endRect.height/2;
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Create initial line
            const line = new window.LeaderLine(connectionStart.anchor, point, {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                        size: 2.5,
                        path: [
                            ['M', startX, startY],
                            ['L', midX, midY],
                            ['L', endX, endY]
                        ],
                        startPlug: 'behind',
                        endPlug: 'arrow3',
                        outline: false,
                        dropShadow: false
                    });

                    if (line.element) {
                        line.element.style.zIndex = '1';
                    }
                    leaderLines.push(line);
                    
                    // Create control point
                    const controlPoint = createControlPoint(line);
                    controlPoint.style.left = `${midX}px`;
                    controlPoint.style.top = `${midY}px`;
                    
                    // Update line with initial path
                    updateLinePosition(line, startX, startY, midX, midY, endX, endY);
                    
                    // Add click handler for line deletion
                    const svgContainer = line.element;
                    if (svgContainer) {
                        svgContainer.style.cursor = 'pointer';
                        svgContainer.title = 'Klicken zum Löschen der Verbindung';
                        svgContainer.addEventListener('click', () => {
                            const controlPoint = controlPoints.get(line);
                            if (controlPoint) {
                                controlPoint.remove();
                                controlPoints.delete(line);
                            }
                            const index = leaderLines.indexOf(line);
                            if (index > -1) {
                                leaderLines.splice(index, 1);
                                line.remove();
                                trySaveState();
                            }
                        });
                    }
                    
                    trySaveState();
                } catch (error) {
                    console.error('Error creating connection:', error);
                    PAPUI?.showFeedback?.('Fehler beim Erstellen der Verbindung', false);
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
        selectedElement = target.cloneNode(true);
        selectedElement.style.position = 'absolute';
        drawingArea.appendChild(selectedElement);
        createConnectionPoints(selectedElement);
        selectedElement.addEventListener('mousedown', startDragging);

        const drawingRect = drawingArea.getBoundingClientRect();
        const newX = e.clientX - drawingRect.left - rect.width / 2;
        const newY = e.clientY - drawingRect.top - rect.height / 2;
        
        selectedElement.style.left = `${snapToGrid(newX)}px`;
        selectedElement.style.top = `${snapToGrid(newY)}px`;
    }

    selectedElement.classList.add('dragging');
    selectedElement.classList.add('selected');
    document.querySelectorAll('.pap-shape').forEach(shape => {
        if (shape !== selectedElement) shape.classList.remove('selected');
    });

    if (target.parentElement.classList.contains('drawing-area')) {
        trySaveState();
    }
    e.preventDefault();
    e.stopPropagation();
}

function handleMouseMove(e) {
    if (isDraggingControlPoint && selectedControlPoint) {
        const drawingRect = document.getElementById('drawing-area').getBoundingClientRect();
        
        let newX = e.clientX - drawingRect.left;
        let newY = e.clientY - drawingRect.top;

        selectedControlPoint.style.left = `${newX}px`;
        selectedControlPoint.style.top = `${newY}px`;

        for (const [line, point] of controlPoints.entries()) {
            if (point === selectedControlPoint) {
                const startRect = line.start.getBoundingClientRect();
                const endRect = line.end.getBoundingClientRect();
                
                const startX = startRect.x - drawingRect.left + startRect.width/2;
                const startY = startRect.y - drawingRect.top + startRect.height/2;
                const endX = endRect.x - drawingRect.left + endRect.width/2;
                const endY = endRect.y - drawingRect.top + endRect.height/2;

                updateLinePosition(line, startX, startY, newX, newY, endX, endY);
                break;
            }
        }
    } else if (isDragging && selectedElement) {
        const drawingRect = document.getElementById('drawing-area').getBoundingClientRect();
        
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

        leaderLines.forEach(line => {
            const startParent = line.start.closest('.pap-shape');
            const endParent = line.end.closest('.pap-shape');
            
            if (startParent === selectedElement || endParent === selectedElement) {
                const controlPoint = controlPoints.get(line);
                if (controlPoint) {
                    const startRect = line.start.getBoundingClientRect();
                    const endRect = line.end.getBoundingClientRect();
                    const cpRect = controlPoint.getBoundingClientRect();
                    
                    const startX = startRect.x - drawingRect.left + startRect.width/2;
                    const startY = startRect.y - drawingRect.top + startRect.height/2;
                    const endX = endRect.x - drawingRect.left + endRect.width/2;
                    const endY = endRect.y - drawingRect.top + endRect.height/2;
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    
                    const offsetX = parseFloat(controlPoint.dataset.offsetX) || 0;
                    const offsetY = parseFloat(controlPoint.dataset.offsetY) || 0;
                    
                    const cpX = midX + offsetX;
                    const cpY = midY + offsetY;

                    updateLinePosition(line, startX, startY, cpX, cpY, endX, endY);
                    
                    // Update control point position
                    controlPoint.style.left = `${cpX}px`;
                    controlPoint.style.top = `${cpY}px`;
                }
            }
        });
    }
}

function handleMouseUp(e) {
    if (isDraggingControlPoint) {
        isDraggingControlPoint = false;
        trySaveState();
        return;
    }

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
        trySaveState();
    }

    isDragging = false;
    selectedElement = null;
    draggingElement = null;
}

function ensureLeaderLine() {
    return new Promise((resolve, reject) => {
        if (window.LeaderLine) {
            resolve(window.LeaderLine);
            return;
        }

        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(() => {
            if (window.LeaderLine) {
                clearInterval(interval);
                resolve(window.LeaderLine);
                return;
            }
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('LeaderLine konnte nicht geladen werden'));
            }
        }, 200);
    });
}

function clearDrawingArea() {
    const drawingArea = document.getElementById('drawing-area');
    while (drawingArea.firstChild) {
        drawingArea.removeChild(drawingArea.firstChild);
    }
    leaderLines.forEach(line => line.remove());
    leaderLines = [];
    controlPoints.forEach(point => point.remove());
    controlPoints.clear();
    connecting = false;
    connectionStart = null;
}

function clearConnectionState() {
    const activePoint = document.querySelector('.connection-point.active');
    if (activePoint) activePoint.classList.remove('active');
    document.querySelectorAll('.connection-point').forEach(p => {
        p.classList.remove('potential-target');
        p.classList.remove('highlight');
    });
    connecting = false;
    connectionStart = null;
}

// Register keydown handler for control point deletion
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedControlPoint) {
        e.preventDefault();
        for (const [line, point] of controlPoints.entries()) {
            if (point === selectedControlPoint) {
                const index = leaderLines.indexOf(line);
                if (index > -1) {
                    leaderLines.splice(index, 1);
                    line.remove();
                    point.remove();
                    controlPoints.delete(line);
                    selectedControlPoint = null;
                    trySaveState();
                }
                break;
            }
        }
    }
});

// Export public interface
window.PAPCore = {
    blockSize,
    gridSize,
    snapThreshold,
    leaderLines,
    createConnectionPoints,
    startDragging,
    handleMouseMove,
    handleMouseUp,
    clearDrawingArea,
    clearConnectionState,
    snapToGrid,
    snapFinal,
    getShapeType
};
