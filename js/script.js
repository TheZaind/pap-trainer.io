/**
 * PAP-Trainer - JavaScript Implementation
 */

// Initialize variables and configuration
const blockSize = 32;
const gridSize = blockSize;
const snapThreshold = blockSize / 2;

// Level system configuration
let unlockedLevels = new Set([1]); // Start with first level unlocked
let completedLevels = new Set();
let currentLevelId = null;

// Load level progress from localStorage
function loadLevelProgress() {
    const savedProgress = localStorage.getItem('papTrainerLevels');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        unlockedLevels = new Set(progress.unlocked);
        completedLevels = new Set(progress.completed);
    }
}

// Save level progress to localStorage
function saveLevelProgress() {
    const progress = {
        unlocked: Array.from(unlockedLevels),
        completed: Array.from(completedLevels)
    };
    localStorage.setItem('papTrainerLevels', JSON.stringify(progress));
}

// Initialize level selection interface
function initializeLevelSelection() {
    const levelGrid = document.querySelector('.level-grid');
    levelGrid.innerHTML = ''; // Clear existing content

    // Configure unlock all button
    document.getElementById('unlock-all').addEventListener('click', () => {
        tasks.forEach(task => unlockedLevels.add(task.id));
        saveLevelProgress();
        initializeLevelSelection(); // Refresh the display
    });

    tasks.forEach((task, index) => {
        const card = document.createElement('div');
        card.className = `level-card ${unlockedLevels.has(task.id) ? '' : 'locked'} ${completedLevels.has(task.id) ? 'completed' : ''}`;
        
        // Calculate difficulty based on task complexity
        const difficulty = index < 2 ? 'Einfach' : index < 4 ? 'Mittel' : 'Schwer';
        const stars = index < 2 ? '⭐' : index < 4 ? '⭐⭐' : '⭐⭐⭐';
        
        card.innerHTML = `
            <h3>Level ${task.id}</h3>
            <div class="difficulty">${difficulty}</div>
            <div class="stars">${stars}</div>
            <p>${task.title}</p>
        `;

        if (unlockedLevels.has(task.id)) {
            card.addEventListener('click', () => startLevel(task));
        }
        
        // Add connecting paths between levels
        if (index > 0) {
            const path = document.createElement('div');
            path.className = `level-path ${unlockedLevels.has(task.id) ? 'unlocked' : ''}`;
            card.appendChild(path);
        }
        
        levelGrid.appendChild(card);
    });
}

// Start a specific level
function startLevel(task) {
    document.getElementById('level-selection').style.display = 'none';
    document.querySelector('.main-container').style.display = 'grid';
    currentLevelId = task.id;
    loadTask(task);
}

// Return to level selection
function returnToLevelSelection() {
    document.getElementById('level-selection').style.display = 'block';
    document.querySelector('.main-container').style.display = 'none';
    initializeLevelSelection();
}

// Grid snapping functions
function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
}

// Helper function to get shape type
function getShapeType(shape) {
    if (shape.classList.contains('start-end')) return 'start-end';
    if (shape.classList.contains('process')) return 'process';
    if (shape.classList.contains('input-output')) return 'input-output';
    if (shape.classList.contains('decision')) return 'decision';
    return '';
}

function snapFinal(element) {
    if (!element) return;
    const x = parseInt(element.style.left);
    const y = parseInt(element.style.top);
    element.style.left = `${snapToGrid(x)}px`;
    element.style.top = `${snapToGrid(y)}px`;
}

// State variables
let level = 1;
let xp = 0;
let currentTask = null;
let streak = 0;
let badges = [];
let lives = 3;
let lastTaskPoints = 0;
let undoStack = [];
let redoStack = [];
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

// Badge definitions
const badgeDefinitions = [
    { id: 'beginner', name: 'Anfänger', xp: 100, icon: '🌟' },
    { id: 'intermediate', name: 'Fortgeschritten', xp: 500, icon: '🏆' },
    { id: 'expert', name: 'Experte', xp: 1000, icon: '👑' },
    { id: 'streak3', name: 'Streak Master', streak: 3, icon: '🔥' },
    { id: 'streak5', name: 'Unstoppable', streak: 5, icon: '⚡' }
];

let tasks = [];

// Load tasks from JSON files
async function loadTasks() {
    try {
        const taskFiles = ['aufgabex.json', 'Durchschnittsalter.json', 'GeradeZahlen.json', 'Zinsrechner.json'];
        tasks = [];

        for (const file of taskFiles) {
            const response = await fetch(`tasks/${file}`);
            if (!response.ok) throw new Error(`Failed to load ${file}`);
            const task = await response.json();
            
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
            
            tasks.push(task);
        }

        // Sort tasks by ID
        tasks.sort((a, b) => a.id - b.id);

        // Initialize first task if none loaded
        if (currentTask === null && tasks.length > 0) {
            currentTask = tasks[0];
            loadTask(currentTask);
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showFeedback('Fehler beim Laden der Aufgaben', false);
    }
}

// Function declarations for UI controls
function toggleHelp() {
    const helpPanel = document.getElementById('help-panel');
    helpPanel.classList.toggle('visible');
}

function resetLives() {
    lives = 3;
    updateStats();
}

function loseLife() {
    lives--;
    updateStats();
    
    if (lives <= 0) {
        showFeedback('Keine Leben mehr! Möchtest du die Lösung sehen?', false);
        if (confirm('Keine Leben mehr! Möchtest du die Lösung sehen?')) {
            resetLives();
            toggleSolution();
        } else {
            resetLives();
            clearDrawingArea();
            loadTask(currentTask);
        }
    }
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
        clearDrawingArea();
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
            currentTask.solution.connections.forEach(([from, to, decision]) => {
                const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape'));
                const startShape = shapes.find(s => s.querySelector('span').textContent.trim() === from);
                const endShape = shapes.find(s => s.querySelector('span').textContent.trim() === to);
                
                if (startShape && endShape) {
                    let startPoint = startShape.querySelector(decision === 'ja' ? '.connection-point.right' : '.connection-point.bottom');
                    let endPoint = endShape.querySelector('.connection-point.top');

                    if (startPoint && endPoint) {
                        const line = new LeaderLine(
                            startPoint,
                            endPoint,
                            {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                                size: 2,
                                path: 'straight',
                                startSocket: startPoint.dataset.position,
                                endSocket: endPoint.dataset.position,
                                endPlug: 'arrow3',
                                gradient: true,
                                dropShadow: true
                            }
                        );
                        leaderLines.push(line);
                    }
                }
            });
        }, 100);
    } else {
        clearDrawingArea();
        loadTask(currentTask);
    }
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

function loadTask(task) {
    currentTask = task;
    const taskText = document.getElementById('task-text');
    if (taskText && currentTask) {
        taskText.innerHTML = `
            <strong>Aufgabe ${currentTask.id}: ${currentTask.title}</strong><br>
            ${currentTask.description}
        `;
        taskText.dataset.showingSolution = '';
        clearDrawingArea();
        
        const shapesContainer = document.querySelector('.sidebar');
        if (shapesContainer) {
            shapesContainer.innerHTML = '';
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'shape-container';
            blocksContainer.innerHTML = '<div class="shape-title">📋 Verfügbare Blöcke</div>';
            
            // Ensure required blocks exist and optional is handled safely
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

function createBlockElement(block) {
    const element = document.createElement('div');
    element.className = `pap-shape ${block.type}`;
    element.setAttribute('draggable', 'true');
    element.setAttribute('data-shape', block.type);
    
    const span = document.createElement('span');
    span.textContent = block.text;
    element.appendChild(span);
    
    element.addEventListener('mousedown', startDragging);
    return element;
}

function checkSolution() {
    if (!currentTask) {
        showFeedback('Keine Aufgabe geladen', false);
        return;
    }

    const drawingArea = document.getElementById('drawing-area');
    const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape'));
    
    // Get required block texts
    const requiredBlockTexts = new Set();
    currentTask.solution.connections.forEach(([from, to]) => {
        requiredBlockTexts.add(from);
        requiredBlockTexts.add(to);
    });
    
    // Check for missing or extra blocks
    const existingBlockTexts = new Set(shapes.map(shape => shape.querySelector('span').textContent.trim()));
    const missingBlocks = Array.from(requiredBlockTexts).filter(text => !existingBlockTexts.has(text));
    const extraBlocks = Array.from(existingBlockTexts).filter(text => !requiredBlockTexts.has(text));

    if (missingBlocks.length > 0) {
        loseLife();
        showFeedback(`Fehlende Blöcke: ${missingBlocks.join(', ')}`, false);
        streak = 0;
        return;
    }

    if (extraBlocks.length > 0) {
        loseLife();
        showFeedback(`Überflüssige Blöcke: ${extraBlocks.join(', ')}`, false);
        streak = 0;
        return;
    }

    // Count required connections per block
    const requiredConnections = new Map();
    currentTask.solution.connections.forEach(([from, to]) => {
        requiredConnections.set(from, (requiredConnections.get(from) || 0) + 1);
        requiredConnections.set(to, (requiredConnections.get(to) || 0) + 1);
    });

    // Count user's connections per block
    const userConnections = new Map();
    leaderLines.forEach(line => {
        const startShape = line.start.closest('.pap-shape');
        const endShape = line.end.closest('.pap-shape');
        const startText = startShape ? startShape.querySelector('span').textContent.trim() : '';
        const endText = endShape ? endShape.querySelector('span').textContent.trim() : '';
        
        userConnections.set(startText, (userConnections.get(startText) || 0) + 1);
        userConnections.set(endText, (userConnections.get(endText) || 0) + 1);
    });

    // Check if each block has the correct number of connections
    let correctConnectionCounts = 0;
    let totalConnectionChecks = requiredConnections.size;

    for (const [block, requiredCount] of requiredConnections) {
        const userCount = userConnections.get(block) || 0;
        if (userCount === requiredCount) {
            correctConnectionCounts++;
        }
    }

    const percentage = Math.round((correctConnectionCounts / totalConnectionChecks) * 100);
    
    if (percentage === 100) {
        const baseXP = 100;
        const streakBonus = Math.floor(streak / 3) * 25;
        const earnedXP = baseXP + streakBonus;
        
        addXP(earnedXP);
        streak++;
        
        // Mark current level as completed and unlock next level
        completedLevels.add(currentLevelId);
        const nextLevelId = tasks.find(t => t.id > currentLevelId)?.id;
        if (nextLevelId) {
            unlockedLevels.add(nextLevelId);
        }
        saveLevelProgress();

        showFeedback(`Perfekt! +${earnedXP} XP${streakBonus > 0 ? ` (+${streakBonus} Streak Bonus!)` : ''}`, true);
        saveProgress();

        // Return to level selection after short delay to show completion
        setTimeout(() => {
            returnToLevelSelection();
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }, 1500);
    } else {
        const maxPointsPerTask = 100;
        const pointsEarned = Math.round(percentage);
        const newPoints = Math.max(0, Math.min(pointsEarned - lastTaskPoints, maxPointsPerTask - lastTaskPoints));
        
        if (newPoints > 0) {
            addXP(newPoints);
            lastTaskPoints = pointsEarned;
            showFeedback(`${percentage}% richtig! +${newPoints} XP`, true);
        } else {
            loseLife();
            showFeedback(`${percentage}% richtig, aber keine weiteren Punkte für diese Aufgabe`, false);
        }
        
        streak = 0;
    }
}

function clearDrawingArea() {
    const drawingArea = document.getElementById('drawing-area');
    while (drawingArea.firstChild) {
        drawingArea.removeChild(drawingArea.firstChild);
    }
    leaderLines.forEach(line => line.remove());
    leaderLines = [];
    connecting = false;
    connectionStart = null;
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

                try {
                    const line = new LeaderLine(
                        connectionStart.anchor,
                        point,
                        {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--primary-color'),
                            size: 2,
                            path: 'straight',
                            startSocket: connectionStart.point,
                            endSocket: position,
                            endPlug: 'arrow3',
                            gradient: true,
                            dropShadow: true
                        }
                    );
                    leaderLines.push(line);
                    
                    const svgContainer = line.element;
                    if (svgContainer) {
                        svgContainer.style.cursor = 'pointer';
                        svgContainer.title = 'Klicken zum Löschen der Verbindung';
                        svgContainer.addEventListener('click', () => {
                            const index = leaderLines.indexOf(line);
                            if (index > -1) {
                                leaderLines.splice(index, 1);
                                line.remove();
                                saveState();
                            }
                        });
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

function saveState() {
    const state = getCurrentState();
    undoStack.push(JSON.stringify(state));
    redoStack = [];
}

function getCurrentState() {
    const drawingArea = document.getElementById('drawing-area');
    const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape')).map(shape => {
        if (!shape.dataset.id) {
            shape.dataset.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        return {
            type: getShapeType(shape),
            left: shape.style.left,
            top: shape.style.top,
            text: shape.querySelector('span').textContent.trim(),
            id: shape.dataset.id
        };
    });

    const connections = leaderLines.map(line => {
        try {
            const startPoint = line.start;
            const endPoint = line.end;
            
            const startShape = startPoint.closest('.pap-shape');
            const endShape = endPoint.closest('.pap-shape');
            
            if (!startShape?.dataset?.id || !endShape?.dataset?.id) return null;

            const startPosition = startPoint.dataset.position;
            const endPosition = endPoint.dataset.position;

            if (!startPosition || !endPosition) return null;

            return {
                startId: startShape.dataset.id,
                endId: endShape.dataset.id,
                startPoint: startPosition,
                endPoint: endPosition
            };
        } catch (error) {
            console.log('Error saving connection state:', error);
            return null;
        }
    }).filter(Boolean);

    return { shapes, connections };
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
                        path: 'straight',
                        startSocket: connData.startPoint,
                        endSocket: connData.endPoint,
                        endPlug: 'arrow3',
                        gradient: true,
                        dropShadow: true
                    }
                );
                leaderLines.push(line);
                
                const svgContainer = line.element;
                if (svgContainer) {
                    svgContainer.style.cursor = 'pointer';
                    svgContainer.title = 'Klicken zum Löschen der Verbindung';
                    svgContainer.addEventListener('click', () => {
                        const index = leaderLines.indexOf(line);
                        if (index > -1) {
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

function showFeedback(message, isSuccess = false) {
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isSuccess ? 'success' : 'error'}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
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
        saveState();
    }
    e.preventDefault();
    e.stopPropagation();
}

function handleMouseMove(e) {
    if (isDragging && selectedElement) {
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
                line.position();
                const svgContainer = line.element;
                if (svgContainer) {
                    svgContainer.style.zIndex = '2';
                }
            }
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

function updateStats() {
    document.getElementById('level').textContent = level;
    document.getElementById('xp').textContent = xp;
    document.getElementById('xp-needed').textContent = level * 100;
    document.getElementById('solved').textContent = badges.length;
    
    // Update progress bar
    const xpNeeded = level * 100;
    const progress = (xp / xpNeeded) * 100;
    const progressBar = document.getElementById('xp-progress');
    progressBar.style.width = `${progress}%`;

    // Update lives display
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
    const progress = { level, xp, badges, streak, lives, lastTaskPoints };
    localStorage.setItem('papTrainerProgress', JSON.stringify(progress));
}

function addXP(amount) {
    xp += amount;
    const xpNeeded = level * 100;
    
    while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        showFeedback(`Level Up! Du bist jetzt Level ${level}! 🎉`, true);
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
    
    updateStats();
    updateBadges();
}

function updateBadges() {
    badgeDefinitions.forEach(badge => {
        if (!badges.includes(badge.id)) {
            if ((badge.xp && xp >= badge.xp) || (badge.streak && streak >= badge.streak)) {
                badges.push(badge.id);
                showAchievement(badge);
                saveProgress();
            }
        }
    });
}

function showAchievement(badge) {
    const achievement = document.createElement('div');
    achievement.className = 'achievement';
    achievement.innerHTML = `
        <div class="achievement-icon">${badge.icon}</div>
        <div class="achievement-text">
            <div class="achievement-title">Neuer Badge!</div>
            <div class="achievement-name">${badge.name}</div>
        </div>
    `;
    document.body.appendChild(achievement);

    setTimeout(() => {
        achievement.classList.add('show');
        setTimeout(() => {
            achievement.classList.remove('show');
            setTimeout(() => achievement.remove(), 300);
        }, 2000);
    }, 100);

    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500']
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('theme');
    document.body.setAttribute('data-theme', savedTheme || 'dark');
    
    await loadTasks();
    loadProgress();
    loadLevelProgress();
    initializeLevelSelection();

    // Hide main container initially and show level selection
    document.querySelector('.main-container').style.display = 'none';
    document.getElementById('level-selection').style.display = 'block';
    
    const drawingArea = document.querySelector('.drawing-area');
    if (drawingArea) {
        document.querySelectorAll('.pap-shape').forEach(shape => {
            shape.addEventListener('mousedown', startDragging);
            createConnectionPoints(shape);
        });

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleMouseMove);

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

    // Setup keyboard shortcuts and undo/redo buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
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
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            const selectedShape = document.querySelector('.pap-shape.selected');
            if (selectedShape) {
                leaderLines = leaderLines.filter(line => {
                    if (line.start.closest('.pap-shape') === selectedShape || 
                        line.end.closest('.pap-shape') === selectedShape) {
                        line.remove();
                        return false;
                    }
                    return true;
                });
                selectedShape.remove();
                saveState();
            }
        }
    });
});
