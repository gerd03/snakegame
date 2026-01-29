/**
 * UIManager - HUD and UI Updates
 */

export class UIManager {
    constructor() {
        this.elements = {
            score: document.getElementById('score-value'),
            length: document.getElementById('length-value'),
            time: document.getElementById('time-value'),
            combo: document.getElementById('combo-value'),
            aiMode: document.getElementById('ai-mode'),
            powerups: document.getElementById('powerup-container'),
            finalScore: document.getElementById('final-score'),
            finalLength: document.getElementById('final-length'),
            finalTime: document.getElementById('final-time')
        };

        this.notifications = [];
    }

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score.toLocaleString();
            this.pulseElement(this.elements.score);
        }
    }

    updateLength(length) {
        if (this.elements.length) {
            this.elements.length.textContent = length;
        }
    }

    updateTime(seconds) {
        if (this.elements.time) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            this.elements.time.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updateCombo(multiplier) {
        if (this.elements.combo) {
            if (multiplier > 1) {
                this.elements.combo.textContent = `x${multiplier}`;
                this.elements.combo.classList.remove('hidden');
                this.pulseElement(this.elements.combo);
            } else {
                this.elements.combo.classList.add('hidden');
            }
        }
    }

    updateAIMode(mode) {
        if (this.elements.aiMode) {
            const modeNames = {
                beginner: 'BEGINNER AI',
                pro: 'PRO AI',
                godmode: 'GOD MODE AI'
            };
            this.elements.aiMode.textContent = modeNames[mode] || mode.toUpperCase();
        }
    }

    updatePowerUps(activePowerUps) {
        if (!this.elements.powerups) return;

        this.elements.powerups.innerHTML = '';

        const icons = {
            timeSlow: '⏱️',
            phase: '👻',
            magnet: '🧲',
            turbo: '⚡'
        };

        activePowerUps.forEach(pu => {
            const item = document.createElement('div');
            item.className = 'powerup-item';
            item.innerHTML = `
                <span class="powerup-icon">${icons[pu.type] || '✨'}</span>
                <div class="powerup-bar">
                    <div class="powerup-fill" style="width: ${pu.remainingPercent}%"></div>
                </div>
            `;
            this.elements.powerups.appendChild(item);
        });
    }

    showGameOver(score, length, time) {
        if (this.elements.finalScore) {
            this.elements.finalScore.textContent = score.toLocaleString();
        }
        if (this.elements.finalLength) {
            this.elements.finalLength.textContent = length;
        }
        if (this.elements.finalTime) {
            const mins = Math.floor(time / 60);
            const secs = Math.floor(time % 60);
            this.elements.finalTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to screen
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    pulseElement(element) {
        element.classList.remove('pulse');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('pulse');
    }
}
