/**
 * Gamification - Level, XP and badge system
 */

// Level system configuration
let unlockedLevels = new Set([1]); // Start with first level unlocked
let completedLevels = new Set();
let currentLevelId = null;
let level = 1;
let xp = 0;
let streak = 0;
let badges = [];
let lastTaskPoints = 0;

// Badge definitions
const badgeDefinitions = [
    // Bestehende Badges
    { id: 'beginner', name: 'Anfänger', xp: 100, icon: '🌟', description: 'Deine ersten Schritte im PAP-Training' },
    { id: 'intermediate', name: 'Fortgeschritten', xp: 500, icon: '🏆', description: 'Du hast schon viel gelernt!' },
    { id: 'expert', name: 'Experte', xp: 1000, icon: '👑', description: 'Ein wahrer PAP-Meister' },
    { id: 'streak3', name: 'Streak Master', streak: 3, icon: '🔥', description: '3 Aufgaben in Folge korrekt gelöst' },
    { id: 'streak5', name: 'Unstoppable', streak: 5, icon: '⚡', description: '5 Aufgaben in Folge richtig gelöst' },
    
    // Neue aufgabenspezifische Badges
    { id: 'speed_demon', name: 'Geschwindigkeitsmeister', timeUnder: 60, icon: '⚡', description: 'Eine Aufgabe in unter 60 Sekunden gelöst' },
    { id: 'perfectionist', name: 'Perfektionist', perfectSolutions: 5, icon: '💎', description: '5 Aufgaben ohne Fehler gelöst' },
    { id: 'math_wizard', name: 'Mathe-Genie', mathTasks: 3, icon: '🔢', description: '3 Mathe-Aufgaben gemeistert' },
    { id: 'loop_master', name: 'Schleifen-Meister', loopTasks: 3, icon: '🔄', description: '3 Aufgaben mit Schleifen gelöst' },
    { id: 'logic_king', name: 'Logik-König', ifTasks: 3, icon: '🧠', description: '3 Aufgaben mit Bedingungen gelöst' },
    { id: 'speed_run', name: 'Speedrunner', consecutive_fast: 3, icon: '🏃', description: '3 schnelle Lösungen hintereinander' },
    { id: 'accuracy', name: 'Präzisions-Ass', noMistakes: 3, icon: '🎯', description: '3 Aufgaben in Folge ohne Fehler' },
    { id: 'dedication', name: 'Durchhaltevermögen', dailyLogins: 7, icon: '📅', description: '7 Tage in Folge trainiert' },
    { id: 'night_owl', name: 'Nachteule', nightSolutions: 5, icon: '🦉', description: '5 Aufgaben nach 22 Uhr gelöst' },
    { id: 'early_bird', name: 'Früher Vogel', morningSolutions: 5, icon: '🌅', description: '5 Aufgaben vor 9 Uhr gelöst' }
];

// Level-Belohnungen und Meilensteine
const levelMilestones = [
    { level: 1, description: "Willkommen bei PAP-Trainer!" },
    { level: 3, description: "Freischaltung: Schwierigere Aufgaben" },
    { level: 5, description: "Bonus: Extra-Leben" },
    { level: 7, description: "Freischaltung: Komplexe Schleifen-Aufgaben" },
    { level: 10, description: "Bonus: 2x XP für die nächste Aufgabe" },
    { level: 15, description: "Bonus: Extra-Leben" },
    { level: 20, description: "Freischaltung: Experten-Aufgaben" },
    { level: 25, description: "Bonus: Verbessertes Leben-Regenerierungstempo" },
    { level: 30, description: "Meister-Abzeichen freigeschaltet" }
];

// Tracking-Variablen für neue Badges
let taskStats = {
    perfectSolutions: 0,
    mathTasks: 0,
    loopTasks: 0,
    ifTasks: 0,
    consecutive_fast: 0,
    noMistakes: 0,
    dailyLogins: 0,
    nightSolutions: 0,
    morningSolutions: 0,
    lastLoginDate: null
};

// Tägliche Belohnungen und Statistik
let statistics = {
    totalSolved: 0,
    fastestSolution: Infinity,
    perfectSolutions: 0,
    totalTime: 0,
    lastDaily: null,
    weeklyProgress: Array(7).fill(0),
    dailyStreak: 0
};

function checkDailyReward() {
    const now = new Date();
    const today = now.toDateString();
    
    if (statistics.lastDaily !== today) {
        statistics.lastDaily = today;
        statistics.dailyStreak++;
        const reward = Math.floor(25 * (1 + statistics.dailyStreak * 0.1));
        
        showFeedback(`Tägliche Belohnung! +${reward}XP (${statistics.dailyStreak} Tage Streak)`, true);
        addXP(reward);
        
        // Update weekly progress
        const dayOfWeek = now.getDay();
        statistics.weeklyProgress[dayOfWeek]++;
        
        saveStatistics();
    }
}

function updateStatistics(taskResult) {
    statistics.totalSolved++;
    statistics.totalTime += taskResult.timeSpent;
    if (taskResult.timeSpent < statistics.fastestSolution) {
        statistics.fastestSolution = taskResult.timeSpent;
    }
    if (taskResult.mistakes === 0) {
        statistics.perfectSolutions++;
    }
    
    // Aktualisiere wöchentlichen Fortschritt
    const dayOfWeek = new Date().getDay();
    statistics.weeklyProgress[dayOfWeek]++;
    
    saveStatistics();
    showWeeklyProgress();
}

function saveStatistics() {
    localStorage.setItem('papTrainerStats', JSON.stringify(statistics));
}

function loadStatistics() {
    const saved = localStorage.getItem('papTrainerStats');
    if (saved) {
        statistics = JSON.parse(saved);
    }
}

function showWeeklyProgress() {
    const weekDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    let progressHTML = '<div class="weekly-progress"><h3>Wöchentliche Aktivität</h3>';
    
    statistics.weeklyProgress.forEach((count, index) => {
        const height = Math.min(count * 10, 100);
        progressHTML += `
            <div class="day-progress">
                <div class="progress-bar" style="height: ${height}%"></div>
                <div class="day-label">${weekDays[index]}</div>
            </div>
        `;
    });
    
    progressHTML += '</div>';
    
    // Füge die Statistik zur Sidebar hinzu
    const sidebar = document.querySelector('.sidebar');
    const existingProgress = document.querySelector('.weekly-progress');
    if (existingProgress) {
        existingProgress.remove();
    }
    sidebar.insertAdjacentHTML('beforeend', progressHTML);
}

function showStatistics() {
    const stats = document.createElement('div');
    stats.className = 'statistics-overlay';
    stats.innerHTML = `
        <div class="statistics-content">
            <h2>Deine Statistiken</h2>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-icon">📊</span>
                    <span class="stat-label">Gelöste Aufgaben</span>
                    <span class="stat-value">${statistics.totalSolved}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">⚡</span>
                    <span class="stat-label">Schnellste Lösung</span>
                    <span class="stat-value">${Math.floor(statistics.fastestSolution)}s</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💎</span>
                    <span class="stat-label">Perfekte Lösungen</span>
                    <span class="stat-value">${statistics.perfectSolutions}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-label">Gesamtzeit</span>
                    <span class="stat-value">${Math.floor(statistics.totalTime / 60)}min</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">🔥</span>
                    <span class="stat-label">Tägliche Streak</span>
                    <span class="stat-value">${statistics.dailyStreak}</span>
                </div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()">Schließen</button>
        </div>
    `;
    document.body.appendChild(stats);
}

// Initialize statistics when loading
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    checkDailyReward();
    showWeeklyProgress();
});

// Level progress management
function loadLevelProgress() {
    const savedProgress = localStorage.getItem('papTrainerLevels');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        unlockedLevels = new Set(progress.unlocked);
        completedLevels = new Set(progress.completed);
    }
}

function saveLevelProgress() {
    const progress = {
        unlocked: Array.from(unlockedLevels),
        completed: Array.from(completedLevels)
    };
    localStorage.setItem('papTrainerLevels', JSON.stringify(progress));
}

// Dynamische Schwierigkeitsberechnung
function calculateDifficulty(task) {
    // Use the difficulty level from the filename if available
    if (task.difficulty) {
        let stars = '';
        for (let i = 0; i < task.difficulty; i++) {
            stars += '⭐';
        }
        
        let difficultyText;
        switch(task.difficulty) {
            case 1: 
                difficultyText = 'Einfach';
                break;
            case 2: 
                difficultyText = 'Mittel';
                break;
            case 3: 
                difficultyText = 'Fortgeschritten';
                break;
            case 4: 
                difficultyText = 'Schwer';
                break;
            case 5: 
                difficultyText = 'Experte';
                break;
            default:
                difficultyText = 'Mittel';
        }
        
        return { 
            difficulty: difficultyText, 
            stars: stars, 
            xpMultiplier: task.difficulty * 0.5
        };
    }
    
    // Fallback to old calculation
    let complexity = 0;
    complexity += (task.requiredElements?.length || 0) * 2;
    complexity += (task.code?.split('\n').length || 0) / 5;
    complexity += task.expectedTime ? Math.floor(task.expectedTime / 60) : 0;
    
    if (complexity < 10) return { difficulty: 'Einfach', stars: '⭐', xpMultiplier: 1 };
    if (complexity < 20) return { difficulty: 'Mittel', stars: '⭐⭐', xpMultiplier: 1.5 };
    return { difficulty: 'Schwer', stars: '⭐⭐⭐', xpMultiplier: 2 };
}

// Dynamische XP-Berechnung
function calculateXP(task, timeSpent, mistakes) {
    const { xpMultiplier } = calculateDifficulty(task);
    let xp = 50 * xpMultiplier; // Basis-XP

    // Zeitbonus
    const expectedTime = task.expectedTime || 300; // 5 Minuten Standard
    if (timeSpent < expectedTime) {
        xp += Math.floor((expectedTime - timeSpent) / 10);
    }

    // Präzisionsbonus
    if (mistakes === 0) {
        xp *= 1.5; // 50% Bonus für perfekte Lösungen
    }

    return Math.floor(xp);
}

// Erweiterte Level-Selektion mit Schwierigkeitssortierung
function initializeLevelSelection() {
    const levelGrid = document.querySelector('.level-grid');
    levelGrid.innerHTML = '';

    document.getElementById('unlock-all').addEventListener('click', () => {
        tasks.forEach(task => unlockedLevels.add(task.id));
        saveLevelProgress();
        initializeLevelSelection();
    });

    // Roadmap-Button hinzufügen
    const roadmapButton = document.createElement('button');
    roadmapButton.className = 'roadmap-button';
    roadmapButton.textContent = '🗺️ Fortschrittskarte';
    roadmapButton.addEventListener('click', showProgressRoadmap);
    const levelsContainer = document.querySelector('.levels-container');
    if (levelsContainer && !document.querySelector('.roadmap-button')) {
        levelsContainer.insertBefore(roadmapButton, levelGrid);
    }

    // Group tasks by difficulty
    const tasksByDifficulty = {};
    tasks.forEach(task => {
        const difficultyLevel = task.difficulty || 5; // Default to 5 if not set
        if (!tasksByDifficulty[difficultyLevel]) {
            tasksByDifficulty[difficultyLevel] = [];
        }
        tasksByDifficulty[difficultyLevel].push(task);
    });

    // Create difficulty headers and task cards
    const difficultyLabels = {
        1: '🌱 Einfach',
        2: '🔍 Grundlagen',
        3: '🧩 Fortgeschritten',
        4: '🔥 Herausfordernd',
        5: '⚡ Experte'
    };

    // Sort difficulty levels
    const sortedDifficulties = Object.keys(tasksByDifficulty).sort((a, b) => a - b);
    
    sortedDifficulties.forEach(difficultyLevel => {
        // Add difficulty section header
        const difficultyHeader = document.createElement('div');
        difficultyHeader.className = 'difficulty-header';
        // Set data-level attribute for CSS styling
        difficultyHeader.setAttribute('data-level', difficultyLevel);
        difficultyHeader.innerHTML = `<h2>${difficultyLabels[difficultyLevel] || `Schwierigkeit ${difficultyLevel}`}</h2>`;
        levelGrid.appendChild(difficultyHeader);

        // Create container for this difficulty level's cards
        const difficultySection = document.createElement('div');
        difficultySection.className = 'difficulty-section';
        levelGrid.appendChild(difficultySection);

        // Add task cards for this difficulty
        tasksByDifficulty[difficultyLevel].forEach((task, index) => {
            const card = document.createElement('div');
            const { difficulty, stars } = calculateDifficulty(task);
            card.className = `level-card ${unlockedLevels.has(task.id) ? '' : 'locked'} ${completedLevels.has(task.id) ? 'completed' : ''}`;
            
            // Use displayName (without leading number) if available, otherwise use title
            const displayTitle = task.displayName || task.title;
            
            // Tooltip-Info hinzufügen
            let tooltipContent = `Level ${task.id}: ${displayTitle}<br>
                                 Schwierigkeit: ${difficulty} ${stars}<br>`;
            
            // Füge Spezielle Belohnungen hinzu, falls vorhanden
            const levelInfo = task.levelUnlock ? `<div class="level-unlock">Schaltet Level ${task.levelUnlock} frei</div>` : '';
            const xpInfo = `Erwartete XP: ~${Math.floor(50 * calculateDifficulty(task).xpMultiplier)}`;
            
            tooltipContent += `${xpInfo}`;
            
            card.setAttribute('data-tooltip', tooltipContent);
            
            card.innerHTML = `
                <h3>Level ${task.id}</h3>
                <div class="difficulty">${difficulty}</div>
                <div class="stars">${stars}</div>
                <p>${displayTitle}</p>
                ${levelInfo}
                ${completedLevels.has(task.id) ? '<div class="best-time">Bestzeit: ' + (task.bestTime || '---') + 's</div>' : ''}
            `;

            if (unlockedLevels.has(task.id)) {
                card.addEventListener('click', () => startLevel(task));
            }
            
            difficultySection.appendChild(card);
        });
    });
    
    // Tooltip-System aktivieren
    initializeTooltips();
}

function updateStats() {
    document.getElementById('level').textContent = level;
    document.getElementById('xp').textContent = xp;
    
    // XP calculation
    const baseXP = 100;
    const xpNeeded = Math.floor(baseXP * Math.pow(1.1, level - 1));
    document.getElementById('xp-needed').textContent = xpNeeded;
    
    document.getElementById('solved').textContent = badges.length;
    
    // Update progress bar with proper calculation
    const progressPercentage = (xp / xpNeeded) * 100;
    const progressFill = document.getElementById('xp-progress');
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, progressPercentage)}%`;
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
        lastTaskPoints = progress.lastTaskPoints || 0;
        taskStats = progress.taskStats || taskStats;
        updateStats();
    }
}

function saveProgress() {
    const progress = { 
        level, 
        xp, 
        badges, 
        streak, 
        lastTaskPoints,
        taskStats 
    };
    localStorage.setItem('papTrainerProgress', JSON.stringify(progress));
}

// Erweiterte addXP Funktion für dynamischere Progression
function addXP(amount) {
    xp += amount;
    // Angepasste XP-Kurve mit sanfterem Anstieg
    const baseXP = 100;
    // Der Exponent wurde von 1.2 auf 1.1 reduziert für sanftere Progression
    const xpNeeded = Math.floor(baseXP * Math.pow(1.1, level - 1));
    
    while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        showFeedback(`Level Up! Du bist jetzt Level ${level}! 🎉 Neue Herausforderungen warten!`, true);
        
        // Spezielle Level-Meilensteine
        if (level % 5 === 0) {
            showFeedback('Bonus: Extra-Leben für Level-Milestone! 💖', true);
        }
        
        // Zeige Levelbelohnung an, falls vorhanden
        const milestone = levelMilestones.find(m => m.level === level);
        if (milestone) {
            showFeedback(`Level ${level} erreicht: ${milestone.description}`, true);
        }
        
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF69B4']
        });
    }
    
    updateStats();
    updateBadges();
    saveProgress();
}

// Add this function to handle point awards from handle_correct.js
function addPoints(amount) {
    // This function bridges handle_correct.js to our XP system
    const task = currentTask || {};
    const timeSpent = Math.floor((Date.now() - taskStartTime) / 1000); // Convert to seconds properly
    const earnedXP = calculateXP(task, timeSpent, 0); // Assume 0 mistakes when solved correctly
    
    // Show task completion with stats
    showTaskCompletion({
        task: task,
        timeSpent: timeSpent,
        mistakes: 0,
        expectedTime: task.expectedTime || 300,
        earnedXP: earnedXP
    });
    
    // Award XP
    addXP(earnedXP);
    
    // Mark level as completed
    if (currentLevelId && !completedLevels.has(currentLevelId)) {
        completedLevels.add(currentLevelId);
        saveLevelProgress();
        
        // Add best time if applicable
        if (tasks) {
            const taskIndex = tasks.findIndex(t => t.id === currentLevelId);
            if (taskIndex >= 0) {
                const bestTime = tasks[taskIndex].bestTime;
                if (!bestTime || timeSpent < bestTime) {
                    tasks[taskIndex].bestTime = timeSpent;
                }
            }
        }
    }
    
    // Increment streak counter
    streak++;
    saveProgress();
}

// Add function to handle badge awards
function addBadge(levelId) {
    // This function is called when a level is completed
    // Add the badge for the level if not already earned
    if (!badges.includes(`level_${levelId}`)) {
        const badge = {
            id: `level_${levelId}`,
            name: `Level ${levelId} gemeistert!`,
            icon: '🏆',
            description: `Du hast Level ${levelId} erfolgreich abgeschlossen.`
        };
        badges.push(badge.id);
        showAchievement(badge);
        saveProgress();
    }
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

// Detailliertes Feedback-System
function showTaskCompletion(taskResult) {
    const stats = document.createElement('div');
    stats.className = 'task-completion-overlay';
    
    // Berechne Performance-Metriken
    const timeBonus = taskResult.timeSpent < taskResult.expectedTime;
    const accuracyScore = Math.max(0, 100 - (taskResult.mistakes * 10));
    const earnedXP = calculateXP(taskResult.task, taskResult.timeSpent, taskResult.mistakes);
    
    stats.innerHTML = `
        <div class="completion-content">
            <h2>🎉 Aufgabe abgeschlossen! 🎉</h2>
            
            <div class="performance-metrics">
                <div class="metric ${timeBonus ? 'bonus' : ''}">
                    <span class="metric-icon">⏱️</span>
                    <span class="metric-label">Zeit</span>
                    <span class="metric-value">${Math.floor(taskResult.timeSpent)}s</span>
                    ${timeBonus ? '<span class="bonus-tag">Zeitbonus!</span>' : ''}
                </div>
                
                <div class="metric ${accuracyScore >= 90 ? 'bonus' : ''}">
                    <span class="metric-icon">🎯</span>
                    <span class="metric-label">Genauigkeit</span>
                    <span class="metric-value">${accuracyScore}%</span>
                </div>
                
                <div class="metric">
                    <span class="metric-icon">⭐</span>
                    <span class="metric-label">Verdiente XP</span>
                    <span class="metric-value">+${taskResult.earnedXP}</span>
                </div>
            </div>

            <div class="performance-tips">
                <h3>💡 Tipps für nächstes Mal:</h3>
                <ul>
                    ${generateTips(taskResult)}
                </ul>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove()">Weiter</button>
        </div>
    `;
    
    document.body.appendChild(stats);
    updateStatistics(taskResult);
}

function generateTips(taskResult) {
    let tips = [];
    
    if (taskResult.timeSpent > taskResult.expectedTime) {
        tips.push('Versuche die Aufgabe schneller zu lösen. Tipp: Plane deine Lösung zuerst!');
    }
    
    if (taskResult.mistakes > 0) {
        tips.push('Überprüfe deine Lösung vor dem Abgeben auf häufige Fehler.');
    }
    
    if (taskResult.unusedElements?.length > 0) {
        tips.push('Du hast nicht alle verfügbaren Elemente genutzt. Manchmal gibt es effizientere Lösungen!');
    }
    
    if (tips.length === 0) {
        tips.push('Perfekte Arbeit! Versuche diese Leistung beizubehalten!');
    }
    
    return tips.map(tip => `<li>${tip}</li>`).join('');
}

// Event-Handler für Feedback-Animation
function showFeedback(message, isPositive = true) {
    // Remove any existing popup notifications
    const existingPopups = document.querySelectorAll('.popup-notification');
    existingPopups.forEach(popup => popup.remove());

    // Create new popup notification
    const popup = document.createElement('div');
    popup.className = 'popup-notification';
    
    // Determine type and emoji based on message content
    let emoji = '✨';
    let title = 'Hinweis';
    let popupClass = '';
    
    // Determine notification type based on message content
    if (message.includes('Level Up')) {
        emoji = '🎉';
        title = 'Level Up!';
        popupClass = 'levelup';
    } else if (message.includes('XP')) {
        emoji = '💰';
        title = 'Belohnung!';
        popupClass = 'achievement';
    } else if (message.includes('Badge') || message.includes('Abzeichen')) {
        emoji = '🏆';
        title = 'Neuer Badge!';
        popupClass = 'achievement';
    } else if (message.includes('Streak')) {
        emoji = '🔥';
        title = 'Streak Belohnung!';
        popupClass = 'achievement';
    } else if (!isPositive) {
        emoji = '❌';
        title = 'Fehler';
        popupClass = 'error';
    }
    
    // Add class based on type
    if (popupClass) {
        popup.classList.add(popupClass);
    }
    
    popup.innerHTML = `
        <div class="emoji">${emoji}</div>
        <div class="title">${title}</div>
        <div class="message">${message}</div>
        <button class="button" onclick="this.parentElement.remove()">OK</button>
    `;
    
    document.body.appendChild(popup);
    
    // Trigger confetti effect for positive feedback
    if (isPositive) {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.5 },
            colors: ['#FFD700', '#FFA500', '#FF69B4', '#87CEFA']
        });
    }
    
    // Show the popup with animation
    setTimeout(() => {
        popup.classList.add('show');
        
        // Auto-hide after 3 seconds for minor notifications
        if (!message.includes('Level Up') && !message.includes('Badge')) {
            setTimeout(() => {
                popup.classList.remove('show');
                setTimeout(() => popup.remove(), 500);
            }, 3000);
        }
    }, 10);
}

// Roadmap für Erfolge und Level-Progression anzeigen
function showProgressRoadmap() {
    const overlay = document.createElement('div');
    overlay.className = 'roadmap-overlay';
    
    let roadmapContent = `
        <div class="roadmap-content">
            <h2>Deine Fortschrittskarte</h2>
            
            <div class="roadmap-section">
                <h3>Level-Fortschritt</h3>
                <div class="level-roadmap">
    `;
    
    // Level-Fortschritt visualisieren
    for (let i = 1; i <= Math.max(level + 5, 30); i++) {
        const milestone = levelMilestones.find(m => m.level === i);
        const isCurrent = i === level;
        const isCompleted = i < level;
        const hasReward = milestone !== undefined;
        
        roadmapContent += `
            <div class="roadmap-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${hasReward ? 'has-reward' : ''}"
                 data-tooltip="${hasReward ? milestone.description : `Level ${i}`}">
                <div class="node-level">${i}</div>
                ${hasReward ? '<div class="node-reward">🎁</div>' : ''}
                ${isCurrent ? '<div class="current-marker">👉</div>' : ''}
            </div>
        `;
    }
    
    roadmapContent += `
                </div>
            </div>
            
            <div class="roadmap-section">
                <h3>Badge-Sammlung</h3>
                <div class="badge-collection">
    `;
    
    // Badge-Fortschritt visualisieren
    badgeDefinitions.forEach(badge => {
        const isEarned = badges.includes(badge.id);
        
        roadmapContent += `
            <div class="badge-item ${isEarned ? 'earned' : ''}" data-tooltip="${badge.description}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}</div>
                ${isEarned ? '<div class="badge-earned">✓</div>' : ''}
            </div>
        `;
    });
    
    roadmapContent += `
                </div>
            </div>
            
            <div class="roadmap-section">
                <h3>XP bis zum nächsten Level</h3>
                <div class="xp-progress-container">
                    <div class="xp-progress-bar">
                        <div class="xp-progress-fill" style="width: ${(xp / (level * 100)) * 100}%"></div>
                    </div>
                    <div class="xp-progress-text">${xp} / ${level * 100} XP</div>
                </div>
            </div>
            
            <button onclick="this.parentElement.parentElement.remove()" class="roadmap-close">Schließen</button>
        </div>
    `;
    
    overlay.innerHTML = roadmapContent;
    document.body.appendChild(overlay);
    
    // Tooltips aktivieren
    initializeTooltips();
}

// Tooltip-System für bessere UX
function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = e.target.getAttribute('data-tooltip');
            document.body.appendChild(tooltip);
            
            const rect = e.target.getBoundingClientRect();
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
            tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
            tooltip.style.opacity = 1;
            
            e.target.addEventListener('mouseleave', () => {
                tooltip.remove();
            }, { once: true });
        });
    });
}

// Initialisiere Tooltips wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    checkDailyReward();
    showWeeklyProgress();
    
    // Initialisiere Tooltips
    setTimeout(initializeTooltips, 500);
});
