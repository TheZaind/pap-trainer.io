/**
 * PAP-Trainer - Solution Validation Module
 * This module handles the validation of user solutions for PAP tasks.
 */

/**
 * Check if the user's solution is correct
 * Validates that:
 * 1. All required blocks are present (no more, no less)
 * 2. Each block has the correct number of connections
 * @returns {boolean} True if solution is correct, false otherwise
 */
function validateSolution() {
    if (!currentTask || !currentTask.solution) {
        showFeedback("Keine Aufgabe oder Lösung verfügbar!", false);
        return false;
    }

    try {
        const drawingArea = document.getElementById('drawing-area');
        if (!drawingArea) {
            throw new Error('Drawing area not found');
        }

        // Get all blocks in the drawing area
        const shapes = Array.from(drawingArea.querySelectorAll('.pap-shape'));
        const currentBlocks = shapes.map(
            shape => shape.querySelector('span').textContent.trim()
        );

        // Debug: Ausgabe der gefundenen Blöcke
        console.log('Gefundene Blöcke:', currentBlocks);

        // 1. Check if all required blocks are present (exactly)
        const requiredBlocks = currentTask.availableBlocks?.required || [];
        const requiredBlockTexts = requiredBlocks.map(block => block.text);
        
        // Optional blocks are allowed but not required
        const optionalBlocks = currentTask.availableBlocks?.optional || [];
        const optionalBlockTexts = optionalBlocks.map(block => block.text);
        
        // All allowed blocks
        const allAllowedBlocks = [...requiredBlockTexts, ...optionalBlockTexts];
        
        // Check for missing required blocks
        const missingBlocks = requiredBlockTexts.filter(text => !currentBlocks.includes(text));
        
        // Check for extra blocks that are neither required nor optional
        const extraBlocks = currentBlocks.filter(text => !allAllowedBlocks.includes(text));
        
        // 2. Check for correct connection count for each block
        const connectionCounts = getExpectedConnectionCounts();
        const actualConnectionCounts = getCurrentConnectionCounts(shapes);
        
        // Debug: Ausgabe der erwarteten und tatsächlichen Verbindungen
        console.log('Erwartete Verbindungen:', connectionCounts);
        console.log('Tatsächliche Verbindungen:', actualConnectionCounts);
        console.log('Aktuelle LeaderLines:', leaderLines.length);
        
        // Compare expected vs actual connection counts for each block
        const incorrectConnections = [];
        Object.keys(connectionCounts).forEach(blockText => {
            if (currentBlocks.includes(blockText)) {
                if (connectionCounts[blockText] !== (actualConnectionCounts[blockText] || 0)) {
                    incorrectConnections.push({
                        block: blockText,
                        expected: connectionCounts[blockText],
                        actual: actualConnectionCounts[blockText] || 0
                    });
                }
            }
        });

        // VALIDATION RESULTS
        
        // Check if any blocks are missing
        if (missingBlocks.length > 0) {
            showFeedback(`Es fehlen folgende Blöcke: ${missingBlocks.join(", ")}`, false);
            return false;
        }
        
        // Check if there are any extra blocks
        if (extraBlocks.length > 0) {
            showFeedback(`Folgende Blöcke sind überschüssig: ${extraBlocks.join(", ")}`, false);
            return false;
        }
        
        // Check if all blocks have correct connection counts
        if (incorrectConnections.length > 0) {
            const errorMessages = incorrectConnections.map(err => 
                `"${err.block}" hat ${err.actual} Verbindungen, benötigt aber ${err.expected}`
            );
            showFeedback(`Falsche Anzahl an Verbindungen: ${errorMessages.join("; ")}`, false);
            return false;
        }
        
        // All checks passed - solution is correct!
        showFeedback("Deine Lösung ist korrekt! Gut gemacht!", true);
        
        // Award points and save progress if gamification functions are available
        if (typeof addPoints === 'function') {
            addPoints(10);
        }
        
        if (typeof addBadge === 'function' && currentTask.id) {
            addBadge(currentTask.id);
        }
        
        return true;
        
    } catch (error) {
        console.error('Fehler bei der Lösungsüberprüfung:', error);
        showFeedback("Ein Fehler ist aufgetreten bei der Überprüfung.", false);
        return false;
    }
}

/**
 * Calculate how many connections each block should have based on the solution
 * @returns {Object} Map of block text to expected connection count
 */
function getExpectedConnectionCounts() {
    if (!currentTask || !currentTask.solution || !currentTask.solution.connections) {
        return {};
    }
    
    const connections = currentTask.solution.connections;
    const connectionCounts = {};
    
    // Count the number of times each block appears in a connection
    connections.forEach(([from, to]) => {
        // Initialize counts if not already set
        connectionCounts[from] = connectionCounts[from] || 0;
        connectionCounts[to] = connectionCounts[to] || 0;
        
        // Increment counts
        connectionCounts[from]++;
        connectionCounts[to]++;
    });
    
    return connectionCounts;
}

/**
 * Count the actual connections for each block in the drawing area
 * @param {Array} shapes - Array of shape elements 
 * @returns {Object} Map of block text to actual connection count
 */
function getCurrentConnectionCounts(shapes) {
    if (!shapes || !Array.isArray(shapes) || shapes.length === 0) {
        return {};
    }
    
    const connectionCounts = {};
    
    // Initialize all blocks with 0 connections
    shapes.forEach(shape => {
        const text = shape.querySelector('span').textContent.trim();
        connectionCounts[text] = 0;
    });

    // Helper function to find a shape from a connection point
    const findShapeFromPoint = (point) => {
        if (!point) return null;

        // Wenn der Punkt ein DOM-Element ist
        if (point instanceof Element) {
            const shape = point.closest('.pap-shape');
            if (shape) return shape;
        }

        // Wenn der Punkt ein LeaderLine-Anker ist
        if (point._id && point.element instanceof Element) {
            const shape = point.element.closest('.pap-shape');
            if (shape) return shape;
        }

        return null;
    };

    // Gruppiere die LeaderLines nach ihren Kontrollpunkten
    const connectionGroups = new Map(); // Map<controlPoint, LeaderLine[]>
    leaderLines.forEach(line => {
        if (!line || line.removed) return;
        
        const controlPoint = line.controlPoint;
        if (controlPoint) {
            if (!connectionGroups.has(controlPoint)) {
                connectionGroups.set(controlPoint, []);
            }
            connectionGroups.get(controlPoint).push(line);
        }
    });

    // Verarbeite jede Verbindungsgruppe
    connectionGroups.forEach(lines => {
        if (lines.length !== 2) return; // Eine vollständige Verbindung besteht aus 2 Linien

        // Finde Start- und Endform für die gesamte Verbindung
        let startShape = null;
        let endShape = null;

        // Die erste Linie geht vom Start zum Kontrollpunkt
        const startLine = lines[0];
        // Die zweite Linie geht vom Kontrollpunkt zum Ende
        const endLine = lines[1];

        if (startLine && endLine) {
            startShape = findShapeFromPoint(startLine.start);
            endShape = findShapeFromPoint(endLine.end);

            if (startShape && endShape) {
                const startText = startShape.querySelector('span').textContent.trim();
                const endText = endShape.querySelector('span').textContent.trim();

                connectionCounts[startText] = (connectionCounts[startText] || 0) + 1;
                connectionCounts[endText] = (connectionCounts[endText] || 0) + 1;
            }
        }
    });

    // Debug output
    console.log('Detaillierte Verbindungsanalyse:');
    console.log('Gefundene Verbindungsgruppen:', connectionGroups.size);
    console.log('Verbindungszähler:', connectionCounts);
    
    return connectionCounts;
}

/**
 * Main solution checking function - called when user clicks check button
 */
function checkSolution() {
    validateSolution();
}