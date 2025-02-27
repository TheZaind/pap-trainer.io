/**
 * PAP-UI - User interface and state management
 */

// State variables
let level = 1;
let xp = 0;
let badges = [];
let streak = 0;
let lives = 3;
let undoStack = [];
let redoStack = [];

// Badge definitions
const badgeDefinitions = [
    { id: 'beginner', name: 'Anfänger', xp: 100, icon: '🌟' },
    { id: 'intermediate', name: 'Fortgeschritten', xp: 500, icon: '🏆' },
    { id: 'expert', name: 'Experte', xp: 1000, icon: '👑' },
    { id: 'streak3', name: 'Streak Master', streak: 3, icon: '🔥' },
    { id: 'streak5', name: 'Unstoppable', streak: 5, icon: '⚡' }
];


// Initialize level selection interface
async function initializeLevelSelection() {
    const levelGrid = document.querySelector('.level-grid');
    if (!levelGrid) return;
    
    levelGrid.innerHTML = ''; // Clear existing content

    // Configure unlock all button
    const unlockAllBtn = document.getElementById('unlock-all');
    if (unlockAllBtn) {
        unlockAllBtn.addEventListener('click', () => {
            const tasks = PAPTasks.tasks;
            if (!tasks.length) {
                showFeedback('Keine Aufgaben verfügbar', false);
                return;
            }
            tasks.forEach(task => PAPTasks.unlockedLevels.add(task.id));
            PAPTasks.saveLevelProgress();
            initializeLevelSelection(); // Refresh the display
            showFeedback('Alle Level wurden freigeschaltet!', true);
        });
    }

    const tasks = PAPTasks.tasks;
    if (!tasks.length) {
        showFeedback('Keine Aufgaben verfügbar', false);
        return;
    }

    tasks.forEach((task, index) => {
        const card = document.createElement('div');
        card.className = `level-card ${PAPTasks.unlockedLevels.has(task.id) ? '' : 'locked'} ${PAPTasks.completedLevels.has(task.id) ? 'completed' : ''}`;
        
        // Calculate difficulty based on task complexity
        const difficulty = index < 2 ? 'Einfach' : index < 4 ? 'Mittel' : 'Schwer';
        const stars = index < 2 ? '⭐' : index < 4 ? '⭐⭐' : '⭐⭐⭐';
        
        card.innerHTML = `
            <h3>Level ${task.id}</h3>
            <div class="difficulty">${difficulty}</div>
            <div class="stars">${stars}</div>
            <p>${task.title}</p>
        `;

        if (PAPTasks.unlockedLevels.has(task.id)) {
            card.addEventListener('click', () => startLevel(task));
        }
        
        // Add connecting paths between levels
        if (index > 0) {
            const path = document.createElement('div');
            path.className = `level-path ${PAPTasks.unlockedLevels.has(task.id) ? 'unlocked' : ''}`;
            card.appendChild(path);
        }
        
        levelGrid.appendChild(card);
    });
}

// Start a specific level
function startLevel(task) {
    document.getElementById('level-selection').style.display = 'none';
    document.querySelector('.main-container').style.display = 'grid';
    PAPTasks.currentLevelId = task.id;
    PAPTasks.loadTask(task);
}

// Return to level selection
function returnToLevelSelection() {
    document.getElementById('level-selection').style.display = 'block';
    document.querySelector('.main-container').style.display = 'none';
    initializeLevelSelection();
}

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
            PAPTasks.toggleSolution();
        } else {
            resetLives();
            PAPCore.clearDrawingArea();
            PAPTasks.loadTask(PAPTasks.currentTask);
        }
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function showFeedback(message, isSuccess = false) {
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isSuccess ? 'success' : 'error'}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
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
        updateStats();
    }
}

function saveProgress() {
    const progress = { level, xp, badges, streak, lives };
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
            type: PAPCore.getShapeType(shape),
            left: shape.style.left,
            top: shape.style.top,
            text: shape.querySelector('span').textContent.trim(),
            id: shape.dataset.id
        };
    });

    const connections = PAPCore.leaderLines.map(line => {
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
    try {
        // Check if LeaderLine is available
        if (!window.LeaderLine) {
            console.error('LeaderLine is not loaded');
            return;
        }
        
        PAPCore.clearDrawingArea();
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
            PAPCore.createConnectionPoints(shape);
            shape.addEventListener('mousedown', PAPCore.startDragging);
        });

        for (const connData of state.connections) {
            const startShape = document.querySelector(`[data-id="${connData.startId}"]`);
            const endShape = document.querySelector(`[data-id="${connData.endId}"]`);
            if (startShape && endShape) {
                const startPoint = startShape.querySelector(`.connection-point.${connData.startPoint}`);
                const endPoint = endShape.querySelector(`.connection-point.${connData.endPoint}`);
                if (startPoint && endPoint) {
                    try {
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
                        PAPCore.leaderLines.push(line);
                        
                        const svgContainer = line.element;
                        if (svgContainer) {
                            svgContainer.style.cursor = 'pointer';
                            svgContainer.title = 'Klicken zum Löschen der Verbindung';
                            svgContainer.addEventListener('click', () => {
                                const index = PAPCore.leaderLines.indexOf(line);
                                if (index > -1) {
                                    PAPCore.leaderLines.splice(index, 1);
                                    line.remove();
                                    saveState();
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Error creating connection:', error);
                        showFeedback('Fehler beim Erstellen einer Verbindung', false);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error applying state:', error);
        showFeedback('Fehler beim Wiederherstellen des Zustands', false);
    }
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

function getStreak() {
    return streak;
}

function incrementStreak() {
    streak++;
}

function resetStreak() {
    streak = 0;
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Ensure PAPUI is available before initialization
        window.PAPUI = {
            initializeLevelSelection,
            startLevel,
            returnToLevelSelection,
            toggleHelp,
            resetLives,
            loseLife,
            toggleTheme,
            showFeedback,
            loadProgress,
            saveProgress,
            addXP,
            saveState,
            undo,
            redo,
            getStreak,
            incrementStreak,
            resetStreak
        };

        // Setup initial UI state
        const savedTheme = localStorage.getItem('theme');
        document.body.setAttribute('data-theme', savedTheme || 'dark');
        
        // Hide main container initially
        document.querySelector('.main-container').style.display = 'none';
        document.getElementById('level-selection').style.display = 'block';

        // Load user progress and tasks
        loadProgress();
        await PAPTasks.loadLevelProgress();
        const loadedTasks = await PAPTasks.loadTasks();

        // Verify tasks loaded successfully
        if (!loadedTasks || loadedTasks.length === 0) {
            throw new Error('Keine Aufgaben gefunden');
        }

        // Initialize UI with loaded data
        await initializeLevelSelection();
        console.log(`${loadedTasks.length} Aufgaben geladen`);
        showFeedback(`${loadedTasks.length} Aufgaben erfolgreich geladen`, true);

    } catch (error) {
        console.error('Initialisierungsfehler:', error);
        document.body.innerHTML = `
            <div class="error-screen">
                <h2>⚠️ Fehler beim Laden</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()">Neu laden</button>
            </div>
        `;
        return;
    }

    const drawingArea = document.querySelector('.drawing-area');
    if (drawingArea) {
        document.querySelectorAll('.pap-shape').forEach(shape => {
            shape.addEventListener('mousedown', PAPCore.startDragging);
            PAPCore.createConnectionPoints(shape);
        });

        document.addEventListener('mouseup', PAPCore.handleMouseUp);
        document.addEventListener('mousemove', PAPCore.handleMouseMove);

        drawingArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('drawing-area')) {
                document.querySelectorAll('.pap-shape').forEach(shape => {
                    shape.classList.remove('selected');
                });
                // Clear any active connections - handled by PAPCore
                PAPCore.clearConnectionState();
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
                PAPTasks.checkSolution();
            } else if (e.key === 'n') {
                e.preventDefault();
                PAPCore.clearDrawingArea();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            const selectedShape = document.querySelector('.pap-shape.selected');
            if (selectedShape) {
                PAPCore.leaderLines = PAPCore.leaderLines.filter(line => {
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
