/**
 * ScoreManager - Scoring, Combos, and Multipliers
 */

export class ScoreManager {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.lastCollectionTime = 0;
        this.comboTimeout = 3; // seconds

        // Scoring values
        this.basePoints = 10;
        this.comboBonus = 5;
        this.survivalBonus = 1; // per second
        this.perfectPathBonus = 50;
    }

    reset() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.lastCollectionTime = Date.now() / 1000;
    }

    addCombo() {
        const now = Date.now() / 1000;

        if (now - this.lastCollectionTime < this.comboTimeout) {
            this.combo++;
        } else {
            this.combo = 1;
        }

        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.lastCollectionTime = now;
    }

    getMultiplier() {
        if (this.combo < 2) return 1;
        if (this.combo < 5) return 2;   // GREAT
        if (this.combo < 10) return 3;  // AMAZING
        if (this.combo < 20) return 5;  // UNSTOPPABLE
        return 10;                      // GODLIKE
    }

    getComboData() {
        if (this.combo < 2) return null;

        let label = '';
        let color = '#00f0ff'; // Default cyan
        const multiplier = this.getMultiplier();

        if (this.combo >= 20) {
            label = 'GODLIKE!';
            color = '#ff00ff'; // Neon magenta
        } else if (this.combo >= 10) {
            label = 'UNSTOPPABLE!';
            color = '#ff6600'; // Neon orange
        } else if (this.combo >= 5) {
            label = 'AMAZING!';
            color = '#00ff88'; // Neon green
        } else if (this.combo >= 2) {
            label = 'GREAT!';
            color = '#00f0ff'; // Neon cyan
        }

        return {
            label,
            color,
            multiplier,
            combo: this.combo,
            progress: Math.max(0, 1 - (Date.now() / 1000 - this.lastCollectionTime) / this.comboTimeout)
        };
    }

    update(deltaTime) {
        const now = Date.now() / 1000;

        // Reset combo if timeout
        if (now - this.lastCollectionTime > this.comboTimeout) {
            this.combo = 0;
        }
    }

    addSurvivalBonus(deltaTime) {
        return Math.floor(deltaTime * this.survivalBonus);
    }

    addPerfectPathBonus() {
        return this.perfectPathBonus * this.getMultiplier();
    }

    getStats() {
        return {
            score: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            multiplier: this.getMultiplier()
        };
    }
}
