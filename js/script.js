/**
 * PAP-Trainer - Main UI and Task Management
 */

// Initialize variables and configuration
const blockSize = 32;
const gridSize = blockSize;
let currentTask = null;
let leaderLines = [];
let draggingElement = null;
let connecting = false;
let connectionStart = null;
let isDragging = false;
let selectedElement = null;
let startX = 0;
let startY = 0;
let isSolutionVisible = false;
let mouseOverPoint = null;
let activeLine = null;
let undoStack = [];
let redoStack = [];
let isDeleteKeyPressed = false;
let isHintVisible = false;
let taskStartTime = Date.now(); // Add taskStartTime variable to track when a task starts
let isCodeStyle = false; // Add code style state

let tasks = [];

// Load tasks from JSON files dynamically
async function loadTasks() {
    try {
        // First, get the list of all JSON files in the tasks directory
        const response = await fetch('tasks/');
        if (!response.ok) {
            throw new Error('Failed to list task files');
        }
        
        const text = await response.text();
        // Create a temporary element to parse the HTML response
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(text, 'text/html');
        
        // Extract all links that end with .json
        const taskFileLinks = Array.from(htmlDoc.querySelectorAll('a'))
            .filter(a => a.href.endsWith('.json'))
            .map(a => a.href.split('/').pop());
            
        tasks = [];
        
        // Load each task file
        for (const fileName of taskFileLinks) {
            const response = await fetch(`tasks/${fileName}`);
            if (!response.ok) throw new Error(`Failed to load ${fileName}`);
            const task = await response.json();
            
            // Extract difficulty level from filename (first character)
            const difficultyMatch = fileName.match(/^(\d)/);
            const difficulty = difficultyMatch ? parseInt(difficultyMatch[1]) : 5; // Default to 5 if no number found
            
            // Extract the task name without the leading number
            const nameMatch = fileName.match(/^\d(.*?)\.json$/);
            const displayName = nameMatch ? nameMatch[1] : fileName.replace('.json', '');
            
            // Add difficulty and displayName to task object
            task.difficulty = difficulty;
            task.displayName = displayName;
            
            // Convert input/output types to match existing code
            if (task.availableBlocks?.required) {
                task.availableBlocks.required = task.availableBlocks.required.map(block => ({
                    ...block,
                    type: block.type === 'input' ? 'input-output' : 
                           block.type === 'output' ? 'input-output' : 
                           block.type
                }));
            }
            if (task.availableBlocks?.optional) {
                task.availableBlocks.optional = task.availableBlocks.optional.map(block => ({
                    ...block,
                    type: block.type === 'input' ? 'input-output' : 
                           block.type === 'output' ? 'input-output' : 
                           block.type
                }));
            }
            
            // If no hint exists, provide a default hint
            if (!task.hint) {
                task.hint = "Versuche, die Aufgabenstellung sorgfältig zu lesen und die Logik Schritt für Schritt zu entwickeln.";
            }
            
            tasks.push(task);
        }

        // Sort tasks by difficulty level first, then by id
        tasks.sort((a, b) => {
            if (a.difficulty !== b.difficulty) {
                return a.difficulty - b.difficulty;
            }
            return a.id - b.id;
        });

        if (currentTask === null && tasks.length > 0) {
            currentTask = tasks[0];
            loadTask(currentTask);
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showFeedback('Fehler beim Laden der Aufgaben', false);
        
        // Fallback to hardcoded list if directory listing fails
        fallbackLoadTasks();
    }
}

// Fallback method for loading tasks if directory listing doesn't work
async function fallbackLoadTasks() {
    try {
        const taskFiles = [
            '1Benutzerbegrüßungsprogramm.json', 
            '2GeradeZahlen.json', 
            '2Zinsrechner.json', 
            '3aufgabex.json',
            '3Durchschnittsalter.json'
        ];
        
        tasks = [];

        for (const fileName of taskFiles) {
            const response = await fetch(`tasks/${fileName}`);
            if (!response.ok) throw new Error(`Failed to load ${fileName}`);
            const task = await response.json();
            
            // Extract difficulty level from filename (first character)
            const difficultyMatch = fileName.match(/^(\d)/);
            const difficulty = difficultyMatch ? parseInt(difficultyMatch[1]) : 5; // Default to 5 if no number found
            
            // Extract the task name without the leading number
            const nameMatch = fileName.match(/^\d(.*?)\.json$/);
            const displayName = nameMatch ? nameMatch[1] : fileName.replace('.json', '');
            
            // Add difficulty and displayName to task object
            task.difficulty = difficulty;
            task.displayName = displayName;
            
            // Convert input/output types to match existing code
            if (task.availableBlocks?.required) {
                task.availableBlocks.required = task.availableBlocks.required.map(block => ({
                    ...block,
                    type: block.type === 'input' ? 'input-output' : 
                           block.type === 'output' ? 'input-output' : 
                           block.type
                }));
            }
            if (task.availableBlocks?.optional) {
                task.availableBlocks.optional = task.availableBlocks.optional.map(block => ({
                    ...block,
                    type: block.type === 'input' ? 'input-output' : 
                           block.type === 'output' ? 'input-output' : 
                           block.type
                }));
            }
            
            // If no hint exists, provide a default hint
            if (!task.hint) {
                task.hint = "Versuche, die Aufgabenstellung sorgfältig zu lesen und die Logik Schritt für Schritt zu entwickeln.";
            }
            
            tasks.push(task);
        }

        // Sort tasks by difficulty level first, then by id
        tasks.sort((a, b) => {
            if (a.difficulty !== b.difficulty) {
                return a.difficulty - b.difficulty;
            }
            return a.id - b.id;
        });

        if (currentTask === null && tasks.length > 0) {
            currentTask = tasks[0];
            loadTask(currentTask);
        }
    } catch (error) {
        console.error('Error loading tasks with fallback method:', error);
        showFeedback('Fehler beim Laden der Aufgaben', false);
    }
}

// Create connection helper function
function createConnection(start, end, startSocket, endSocket) {
    const line = new LeaderLine(
        start,
        end,
        {
        color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
        size: 2,
        path: 'fluid',
        startSocketGravity: 50,
        endSocketGravity: 50,
        anchorAutoRotation: true,
        startSocket: startSocket,
        endSocket: endSocket,
        endPlug: 'arrow3',
        gradient: true,
        dropShadow: true
        }
    );

    const controlPoint = document.createElement('div');
    controlPoint.className = 'line-control-point';
    document.querySelector('.drawing-area').appendChild(controlPoint);
    
    const startPos = start.getBoundingClientRect();
    const endPos = end.getBoundingClientRect();
    const drawingRect = document.querySelector('.drawing-area').getBoundingClientRect();
    const midX = (startPos.x + endPos.x) / 2 - drawingRect.left;
    const midY = (startPos.y + endPos.y) / 2 - drawingRect.top;
    
    controlPoint.style.left = `${midX}px`;
    controlPoint.style.top = `${midY}px`;
    
    controlPoint.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        isDragging = true;
        selectedElement = controlPoint;
        const rect = controlPoint.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    });
    
    line.controlPoint = controlPoint;
    controlPoint.line = line;

    line.setOptions({
                    path: 'fluid',
                    startSocketGravity: 50,
                    endSocketGravity: 50,
        anchorAutoRotation: true,
        middleAnchor: [midX, midY]
    });

    return line;
}

function createBlockElement(block) {
    const element = document.createElement('div');
    element.className = `pap-shape ${block.type}`;
    element.setAttribute('draggable', 'true');
    element.setAttribute('data-shape', block.type);
    
    const span = document.createElement('span');
    span.textContent = isCodeStyle && block.textC ? block.textC : block.text;
    element.appendChild(span);
    
    element.addEventListener('mousedown', startDragging);
    return element;
}

function updateBlockStyles() {
    // Update blocks in sidebar and drawing area
    document.querySelectorAll('.pap-shape span').forEach(span => {
        const block = currentTask?.availableBlocks?.required?.find(b => 
            b.text === span.textContent || b.textC === span.textContent
        ) || currentTask?.availableBlocks?.optional?.find(b => 
            b.text === span.textContent || b.textC === span.textContent
        );
        
        if (block) {
            span.textContent = isCodeStyle && block.textC ? block.textC : block.text;
        }
    });

    // Force redraw of sidebar blocks
    const shapesContainer = document.querySelector('.sidebar');
    if (shapesContainer && currentTask) {
        const blocksContainer = document.createElement('div');
        blocksContainer.className = 'shape-container';
        blocksContainer.innerHTML = '<div class="shape-title">📋 Verfügbare Blöcke</div>';
        
        const requiredBlocks = currentTask.availableBlocks?.required || [];
        const optionalBlocks = currentTask.availableBlocks?.optional || [];
        const allBlocks = [...requiredBlocks, ...optionalBlocks];
        
        allBlocks.forEach(block => {
            const blockElement = createBlockElement(block);
            blocksContainer.appendChild(blockElement);
        });
        
        // Replace existing sidebar content
        shapesContainer.innerHTML = '';
        shapesContainer.appendChild(blocksContainer);
    }
}

function saveCanvasState() {
    if (currentTask) {
        const state = getCurrentState();
        localStorage.setItem(`papTrainerCanvas_${currentTask.id}`, JSON.stringify(state));
    }
}

function loadTask(task) {
    currentTask = task;
    taskStartTime = Date.now(); // Reset the task start time when loading a new task
    
    const taskText = document.getElementById('task-text');
    if (taskText && currentTask) {
        // Use displayName (without leading number) if available, otherwise use title
        const displayTitle = currentTask.displayName || currentTask.title;
        
        taskText.innerHTML = `
            <strong>Aufgabe ${currentTask.id}: ${displayTitle}</strong><br>
            ${marked.parse(currentTask.description, { breaks: true })}
        `;
        taskText.dataset.showingSolution = '';
        
        // Hide hint when loading a new task
        isHintVisible = false;
        const hintContainer = document.getElementById('hint-container');
        hintContainer.classList.remove('visible');
        const hintText = document.getElementById('hint-text');
        hintText.textContent = currentTask.hint || "Kein Hinweis verfügbar.";
        
        // Try to load saved state for this task
        const savedState = localStorage.getItem(`papTrainerCanvas_${task.id}`);
        if (savedState) {
            clearDrawingArea(true); // Clear with state saving
            applyState(JSON.parse(savedState));
        } else {
            clearDrawingArea();
        }
        
        const shapesContainer = document.querySelector('.sidebar');
        if (shapesContainer) {
            shapesContainer.innerHTML = '';
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'shape-container';
            blocksContainer.innerHTML = '<div class="shape-title">📋 Verfügbare Blöcke</div>';
            
            const requiredBlocks = currentTask.availableBlocks?.required || [];
            const optionalBlocks = currentTask.availableBlocks?.optional || [];
            const allBlocks = [...requiredBlocks, ...optionalBlocks];
            
            allBlocks.forEach(block => {
                const blockElement = createBlockElement(block);
                blocksContainer.appendChild(blockElement);
            });
            
            shapesContainer.appendChild(blocksContainer);
        }
        
        if (currentTask.solution.initialPositions) {
            const maxX = Math.max(...currentTask.solution.initialPositions.map(p => p.x)) + 200;
            const maxY = Math.max(...currentTask.solution.initialPositions.map(p => p.y)) + 200;
            
            const drawingArea = document.getElementById('drawing-area');
            drawingArea.style.minWidth = `${maxX}px`;
            drawingArea.style.minHeight = `${maxY}px`;
        }
    }
}

function toggleHint() {
    if (!currentTask) return;
    
    isHintVisible = !isHintVisible;
    const hintContainer = document.getElementById('hint-container');
    
    if (isHintVisible) {
        hintContainer.classList.add('visible');
    } else {
        hintContainer.classList.remove('visible');
    }
}

function toggleHelp() {
    const helpPanel = document.getElementById('help-panel');
    helpPanel.classList.toggle('visible');
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function nextTask() {
    lastTaskPoints = 0;
    const currentIndex = tasks.findIndex(t => t.id === currentTask.id);
    const nextIndex = (currentIndex + 1) % tasks.length;
    loadTask(tasks[nextIndex]);
}

function previousTask() {
    lastTaskPoints = 0;
    const currentIndex = tasks.findIndex(t => t.id === currentTask.id);
    const prevIndex = (currentIndex - 1 + tasks.length) % tasks.length;
    loadTask(tasks[prevIndex]);
}

function startLevel(task) {
    document.getElementById('level-selection').style.display = 'none';
    document.querySelector('.main-container').style.display = 'grid';
    currentLevelId = task.id;
    loadTask(task);
}

function returnToLevelSelection() {
    // Save current state before returning to menu
    if (currentTask) {
        saveCanvasState();
    }
    document.getElementById('level-selection').style.display = 'block';
    document.querySelector('.main-container').style.display = 'none';
    initializeLevelSelection();
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

function updateStats() {
    document.getElementById('level').textContent = level;
    document.getElementById('xp').textContent = xp;
    document.getElementById('xp-needed').textContent = level * 100;
    document.getElementById('solved').textContent = badges.length;
    
    const xpNeeded = level * 100;
    const progress = (xp / xpNeeded) * 100;
    const progressBar = document.getElementById('xp-progress');
    progressBar.style.width = `${progress}%`;

    for (let i = 1; i <= 3; i++) {
        const heart = document.getElementById(`life${i}`);
        if (heart) {
            heart.classList.toggle('lost', i > lives);
        }
    }
}

function loadProgress() {
    const savedProgress = localStorage.getItem('papTrainerProgress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        level = progress.level || 1;
        xp = progress.xp || 0;
        badges = progress.badges || [];
        streak = progress.streak || 0;
        lives = progress.lives || 3;
        lastTaskPoints = progress.lastTaskPoints || 0;
        updateStats();
    }
}

function saveProgress() {
    const progress = { level, xp, badges, streak, lastTaskPoints };
    localStorage.setItem('papTrainerProgress', JSON.stringify(progress));
}

function saveState() {
    const state = getCurrentState();
    undoStack.push(JSON.stringify(state));
    redoStack = [];
    
    // Save canvas state whenever a change is made
    saveCanvasState();
}

function toggleSolution() {
    if (!currentTask) return;
    
    if (!isSolutionVisible) {
        if (!confirm("Bist du sicher, dass du die Lösung sehen möchtest?")) {
            return;
        }
    }
    
    isSolutionVisible = !isSolutionVisible;
    
    if (isSolutionVisible) {
        clearDrawingArea(true); // Clear with state saving
        const drawingArea = document.getElementById('drawing-area');
        const positions = currentTask.solution.initialPositions || [];
        
        const requiredBlockTexts = new Set();
        currentTask.solution.connections.forEach(([from, to]) => {
            requiredBlockTexts.add(from);
            requiredBlockTexts.add(to);
        });

        positions.forEach(pos => {
            if (requiredBlockTexts.has(pos.text)) {
                const block = currentTask.availableBlocks.required.find(b => b.text === pos.text);
                if (block) {
                    const shape = document.createElement('div');
                    shape.className = `pap-shape ${block.type}`;
                    shape.style.position = 'absolute';
                    const span = document.createElement('span');
                    span.textContent = block.text;
                    shape.appendChild(span);
                    shape.style.left = `${pos.x}px`;
                    shape.style.top = `${pos.y}px`;
                    drawingArea.appendChild(shape);
                    createConnectionPoints(shape);
                }
            }
        });

        setTimeout(() => {
            currentTask.solution.connections.forEach(([from, to, condition], index) => {
                const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape'));
                const startShape = shapes.find(s => s.querySelector('span').textContent.trim() === from);
                const endShape = shapes.find(s => s.querySelector('span').textContent.trim() === to);
                
                if (startShape && endShape) {
                    // Get all the connection points for each shape
                    const startPoints = {
                        top: startShape.querySelector('.connection-point.top'),
                        right: startShape.querySelector('.connection-point.right'),
                        bottom: startShape.querySelector('.connection-point.bottom'),
                        left: startShape.querySelector('.connection-point.left')
                    };
                    
                    const endPoints = {
                        top: endShape.querySelector('.connection-point.top'),
                        right: endShape.querySelector('.connection-point.right'),
                        bottom: endShape.querySelector('.connection-point.bottom'),
                        left: endShape.querySelector('.connection-point.left')
                    };
                    
                    // Determine correct connection points based on the condition
                    // For decision blocks, condition 'ja' means right, 'nein' means left
                    let startPointPosition = 'bottom'; // Default
                    let endPointPosition = 'top';     // Default
                    
                    // If startShape is a decision, use condition
                    if (startShape.classList.contains('decision')) {
                        startPointPosition = condition === 'ja' ? 'right' : 'left';
                    }
                    
                    // If specified in controlPoints, use those positions
                    if (currentTask.solution.controlPoints && currentTask.solution.controlPoints[index]) {
                        const controlPoint = currentTask.solution.controlPoints[index];
                        if (controlPoint) {
                            // You could use control point data here if needed
                        }
                    }
                    
                    const line = createConnection(
                        startPoints[startPointPosition],
                        endPoints[endPointPosition],
                        startPointPosition,
                        endPointPosition
                    );
                    leaderLines.push(line);
                }
            });
        }, 100);
    } else {
        clearDrawingArea(true); // Clear with state saving
        loadTask(currentTask);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    document.body.setAttribute('data-theme', savedTheme || 'dark');
    
    await loadTasks();
    loadProgress();
    loadLevelProgress();
    initializeLevelSelection();

    const drawingArea = document.querySelector('.drawing-area');
    if (drawingArea) {
        document.querySelectorAll('.pap-shape').forEach(shape => {
            shape.addEventListener('mousedown', startDragging);
            createConnectionPoints(shape);
        });

        // Event handlers moved to pap-functions.js
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', e => handleMouseMove(e));

        drawingArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('drawing-area')) {
                document.querySelectorAll('.pap-shape').forEach(shape => {
                    shape.classList.remove('selected');
                });
                if (connecting) {
                    const activePoint = document.querySelector('.connection-point.active');
                    if (activePoint) activePoint.classList.remove('active');
                    document.querySelectorAll('.connection-point').forEach(p => {
                        p.classList.remove('potential-target');
                    });
                    connecting = false;
                    connectionStart = null;
                }
            }
        });
    }

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            isDeleteKeyPressed = true;
        }
        if (e.ctrlKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.getElementById('redo-btn').click();
                } else {
                    document.getElementById('undo-btn').click();
                }
            } else if (e.key === 'y') {
                e.preventDefault();
                document.getElementById('redo-btn').click();
            } else if (e.key === 's') {
                e.preventDefault();
                checkSolution();
            } else if (e.key === 'n') {
                e.preventDefault();
                clearDrawingArea();
            }
        } else if (e.key === 'Delete') {
            const selectedShape = document.querySelector('.pap-shape.selected');
            if (selectedShape) {
                // Get block text before removal
                const blockText = selectedShape.querySelector('span').textContent.trim();

                // Remove connections
                leaderLines = leaderLines.filter(line => {
                    if (line.start.closest('.pap-shape') === selectedShape || 
                        line.end.closest('.pap-shape') === selectedShape) {
                        if (line.controlPoint) {
                            line.controlPoint.remove();
                        }
                        line.remove();
                        return false;
                    }
                    return true;
                });

                // Remove block
                selectedShape.remove();

                // Find and restore the original block in sidebar
                if (usedBlocks.has(blockText)) {
                    usedBlocks.delete(blockText);
                    const sidebarBlock = Array.from(document.querySelectorAll('.sidebar .pap-shape'))
                        .find(block => block.querySelector('span').textContent.trim() === blockText);
                    if (sidebarBlock) {
                        sidebarBlock.style.opacity = '';
                        sidebarBlock.style.pointerEvents = '';
                    }
                }

                saveState();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Delete') {
            isDeleteKeyPressed = false;
        }
    });

    // Add text style switch handler
    const textStyleToggle = document.getElementById('text-style-toggle');
    if (textStyleToggle) {
        isCodeStyle = localStorage.getItem('textStyle') === 'code';
        textStyleToggle.checked = isCodeStyle;
        
        textStyleToggle.addEventListener('change', (e) => {
            isCodeStyle = e.target.checked;
            localStorage.setItem('textStyle', isCodeStyle ? 'code' : 'simple');
            updateBlockStyles();
        });
    }
});
