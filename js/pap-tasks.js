/**
 * PAP-Tasks - Task management and validation
 */

// Task management
let tasks = [];
let currentTask = null;
let currentLevelId = null;
let unlockedLevels = new Set([1]); // Start with first level unlocked
let completedLevels = new Set();
let lastTaskPoints = 0;
let isSolutionVisible = false;

// Task file configuration
const TASK_FILES = [
    '../tasks/aufgabex.json',
    '../tasks/Durchschnittsalter.json',
    '../tasks/GeradeZahlen.json',
    '../tasks/Zinsrechner.json'
];
let lastLoadError = null;

// Validate task structure
function validateTask(task) {
    const requiredFields = ['id', 'title', 'description', 'availableBlocks', 'solution'];
    const missingFields = requiredFields.filter(field => !task[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Ungültige Aufgabe: Fehlende Felder: ${missingFields.join(', ')}`);
    }
    
    if (!Array.isArray(task.availableBlocks?.required)) {
        throw new Error('Ungültige Aufgabe: availableBlocks.required muss ein Array sein');
    }
    
    if (!Array.isArray(task.solution.connections)) {
        throw new Error('Ungültige Aufgabe: solution.connections muss ein Array sein');
    }
    
    return true;
}

async function loadTasks() {
    try {
        tasks = [];
        lastLoadError = null;
        let loadedCount = 0;

        for (const file of TASK_FILES) {
            try {
                const response = await fetch(file);
                if (!response.ok) {
                    console.error(`Fehler beim Laden von ${file}: ${response.statusText}`);
                    continue;
                }
                
                const task = await response.json();
                
                // Validate task structure
                validateTask(task);
                
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
                loadedCount++;
            } catch (error) {
                console.error(`Error processing ${file}:`, error);
                continue;
            }
        }

        // Sort tasks by ID
        tasks.sort((a, b) => a.id - b.id);

        if (tasks.length === 0) {
            throw new Error('Keine Aufgaben gefunden');
        }

        console.log(`${loadedCount} Aufgaben erfolgreich geladen`);
        PAPUI.showFeedback(`${loadedCount} Aufgaben geladen`, true);

        // Initialize first task if none loaded
        currentTask = tasks[0];

        return tasks;
    } catch (error) {
        lastLoadError = error;
        console.error('Error loading tasks:', error);
        PAPUI.showFeedback(`Fehler beim Laden der Aufgaben: ${error.message}`, false);
        return []; // Return empty array instead of throwing
    }
}

// Load level progress from localStorage
function loadLevelProgress() {
    try {
        const savedProgress = localStorage.getItem('papTrainerLevels');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            unlockedLevels = new Set(progress.unlocked);
            completedLevels = new Set(progress.completed);
        }
    } catch (error) {
        console.error('Error loading level progress:', error);
        PAPUI.showFeedback('Fehler beim Laden des Spielstands', false);
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

function loadTask(task) {
    if (!task || !validateTask(task)) {
        PAPUI.showFeedback('Ungültige Aufgabe', false);
        return;
    }

    currentTask = task;
    const taskText = document.getElementById('task-text');
    if (taskText && currentTask) {
        taskText.innerHTML = `
            <strong>Aufgabe ${currentTask.id}: ${currentTask.title}</strong><br>
            ${currentTask.description}
        `;
        taskText.dataset.showingSolution = '';
        PAPCore.clearDrawingArea();
        
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
    
    element.addEventListener('mousedown', PAPCore.startDragging);
    return element;
}

function checkSolution() {
    if (!currentTask) {
        PAPUI.showFeedback('Keine Aufgabe geladen', false);
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
        PAPUI.loseLife();
        PAPUI.showFeedback(`Fehlende Blöcke: ${missingBlocks.join(', ')}`, false);
        PAPUI.resetStreak();
        return;
    }

    if (extraBlocks.length > 0) {
        PAPUI.loseLife();
        PAPUI.showFeedback(`Überflüssige Blöcke: ${extraBlocks.join(', ')}`, false);
        PAPUI.resetStreak();
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
    PAPCore.leaderLines.forEach(line => {
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
        const streakBonus = Math.floor(PAPUI.getStreak() / 3) * 25;
        const earnedXP = baseXP + streakBonus;
        
        PAPUI.addXP(earnedXP);
        PAPUI.incrementStreak();
        
        // Mark current level as completed and unlock next level
        completedLevels.add(currentLevelId);
        const nextLevelId = tasks.find(t => t.id > currentLevelId)?.id;
        if (nextLevelId) {
            unlockedLevels.add(nextLevelId);
        }
        saveLevelProgress();

        PAPUI.showFeedback(`Perfekt! +${earnedXP} XP${streakBonus > 0 ? ` (+${streakBonus} Streak Bonus!)` : ''}`, true);
        PAPUI.saveProgress();

        // Return to level selection after short delay to show completion
        setTimeout(() => {
            PAPUI.returnToLevelSelection();
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
            PAPUI.addXP(newPoints);
            lastTaskPoints = pointsEarned;
            PAPUI.showFeedback(`${percentage}% richtig! +${newPoints} XP`, true);
        } else {
            PAPUI.loseLife();
            PAPUI.showFeedback(`${percentage}% richtig, aber keine weiteren Punkte für diese Aufgabe`, false);
        }
        
        PAPUI.resetStreak();
    }
}

function toggleSolution() {
    if (!currentTask) return;
    
    const wasVisible = isSolutionVisible;
    if (!wasVisible) {
        if (!confirm("Bist du sicher, dass du die Lösung sehen möchtest?")) {
            return;
        }
    }
    
    isSolutionVisible = !wasVisible;
    
    if (isSolutionVisible) {
        PAPCore.clearDrawingArea();
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
                    PAPCore.createConnectionPoints(shape);
                }
            }
        });

setTimeout(() => {
            // Ensure LeaderLine is available before creating connections
            if (!window.LeaderLine) {
                console.error('LeaderLine is not loaded');
                return;
            }

            currentTask.solution.connections.forEach(([from, to, decision]) => {
                const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape'));
                const startShape = shapes.find(s => s.querySelector('span').textContent.trim() === from);
                const endShape = shapes.find(s => s.querySelector('span').textContent.trim() === to);
                
                if (startShape && endShape) {
                    let startPoint = startShape.querySelector(decision === 'ja' ? '.connection-point.right' : '.connection-point.bottom');
                    let endPoint = endShape.querySelector('.connection-point.top');

                    if (startPoint && endPoint) {
                        const line = new window.LeaderLine(
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
                        PAPCore.leaderLines.push(line);
                    }
                }
            });
        }, 100);
    } else {
        PAPCore.clearDrawingArea();
        loadTask(currentTask);
    }
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

// Export functions for use in other modules
window.PAPTasks = {
    // Task loading and management
    loadTasks,
    loadLevelProgress,
    saveLevelProgress,
    loadTask,
    // Task interaction
    checkSolution,
    toggleSolution,
    nextTask,
    previousTask,
    // Task state
    get tasks() { return tasks; }, // Use getter to ensure latest state
    get currentTask() { return currentTask; },
    set currentTask(value) { currentTask = value; },
    get currentLevelId() { return currentLevelId; },
    set currentLevelId(value) { currentLevelId = value; },
    get unlockedLevels() { return unlockedLevels; },
    get completedLevels() { return completedLevels; },
    // Debug information
    getTaskCount: () => tasks.length,
    getLoadedTaskFiles: () => TASK_FILES,
    getLastError: () => lastLoadError,
    // Task validation
    isTaskValid: validateTask
};

// Add error handler
window.addEventListener('error', (event) => {
    if (event.filename.includes('pap-tasks.js')) {
        lastLoadError = event.error;
        console.error('PAP Tasks Error:', event.error);
        PAPUI.showFeedback(`Fehler: ${event.error.message}`, false);
    }
});
