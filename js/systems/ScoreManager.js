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
        if (this.combo < 5) return 2;
        if (this.combo < 10) return 3;
        if (this.combo < 20) return 5;
        return 10;
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
