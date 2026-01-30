/**
 * AudioManager - Jolly Jamming Music Style
 * Upbeat, happy, fun background music
 */

export class AudioManager {
    constructor() {
        this.context = null;
        this.muted = false;
        this.bgmPlaying = false;
        this.volume = 0.5;
        this.intensity = 0;

        this.bgmOscillators = [];
        this.bgmGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.value = this.volume;
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio not supported');
        }
    }

    playBGM() {
        this.init();
        if (!this.context || this.bgmPlaying) return;

        this.bgmPlaying = true;

        // Create jolly jamming style BGM
        this.bgmGain = this.context.createGain();
        this.bgmGain.gain.value = 0.12;
        this.bgmGain.connect(this.masterGain);

        // Bouncy bass
        this.createBouncyBass();

        // Happy chords
        this.createHappyChords();

        // Playful melody
        this.createPlayfulMelody();
    }

    createBouncyBass() {
        const bassGain = this.context.createGain();
        bassGain.gain.value = 0.25;
        bassGain.connect(this.bgmGain);

        // Happy major key bass notes (C major)
        const bassNotes = [130.81, 146.83, 164.81, 146.83]; // C3, D3, E3, D3
        let noteIndex = 0;

        const playBassNote = () => {
            if (!this.bgmPlaying) return;

            const osc = this.context.createOscillator();
            osc.type = 'triangle';  // Softer, rounder bass
            osc.frequency.value = bassNotes[noteIndex];

            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 300;

            const noteGain = this.context.createGain();
            noteGain.gain.setValueAtTime(0.3, this.context.currentTime);
            noteGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.25);

            osc.connect(filter);
            filter.connect(noteGain);
            noteGain.connect(bassGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.3);

            noteIndex = (noteIndex + 1) % bassNotes.length;

            setTimeout(playBassNote, 300);  // Bouncy tempo
        };

        playBassNote();
    }

    createHappyChords() {
        const chordGain = this.context.createGain();
        chordGain.gain.value = 0.08;
        chordGain.connect(this.bgmGain);

        // C major chord - happy and bright
        const chordNotes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

        chordNotes.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = (i - 1.5) * 5;  // Slight chorus effect

            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;

            osc.connect(filter);
            filter.connect(chordGain);

            osc.start();
            this.bgmOscillators.push(osc);
        });
    }

    createPlayfulMelody() {
        const melodyGain = this.context.createGain();
        melodyGain.gain.value = 0.12;
        melodyGain.connect(this.bgmGain);

        // Happy pentatonic melody
        const melodyNotes = [
            523.25, 587.33, 659.25, 783.99,  // C5, D5, E5, G5
            783.99, 659.25, 587.33, 523.25,  // G5, E5, D5, C5
            659.25, 783.99, 880.00, 783.99,  // E5, G5, A5, G5
            659.25, 587.33, 523.25, 523.25   // E5, D5, C5, C5
        ];
        let noteIndex = 0;

        const playMelodyNote = () => {
            if (!this.bgmPlaying) return;

            const osc = this.context.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = melodyNotes[noteIndex];

            const noteGain = this.context.createGain();
            noteGain.gain.setValueAtTime(0.25, this.context.currentTime);
            noteGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

            osc.connect(noteGain);
            noteGain.connect(melodyGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.2);

            noteIndex = (noteIndex + 1) % melodyNotes.length;

            // Playful timing - slightly faster
            const interval = 150 - this.intensity * 30;
            setTimeout(playMelodyNote, Math.max(100, interval));
        };

        playMelodyNote();
    }

    stopBGM() {
        this.bgmPlaying = false;

        this.bgmOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) { }
        });
        this.bgmOscillators = [];
    }

    pause() {
        if (this.context && this.context.state === 'running') {
            this.context.suspend();
        }
    }

    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    playSound(type) {
        this.init();
        if (!this.context || this.muted) return;

        switch (type) {
            case 'collect':
                this.playCollectSound();
                break;
            case 'powerup':
                this.playPowerUpSound();
                break;
            case 'death':
                this.playDeathSound();
                break;
            case 'explosion':
                this.playExplosionSound();
                break;
        }
    }

    playCollectSound() {
        // Happy "ding!" sound
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.context.currentTime + 0.08);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.25, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }

    playPowerUpSound() {
        // Ascending happy tones
        const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                const osc = this.context.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;

                const gain = this.context.createGain();
                gain.gain.setValueAtTime(0.2, this.context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start();
                osc.stop(this.context.currentTime + 0.2);
            }, i * 60);
        });
    }

    playDeathSound() {
        // Sad descending sound
        const osc = this.context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.4);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.6);
    }

    playExplosionSound() {
        // Deep boom explosion sound

        // Low frequency boom
        const boom = this.context.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(80, this.context.currentTime);
        boom.frequency.exponentialRampToValueAtTime(30, this.context.currentTime + 0.3);

        const boomGain = this.context.createGain();
        boomGain.gain.setValueAtTime(0.5, this.context.currentTime);
        boomGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

        boom.connect(boomGain);
        boomGain.connect(this.masterGain);

        boom.start();
        boom.stop(this.context.currentTime + 0.6);

        // Noise burst for explosion texture
        const bufferSize = this.context.sampleRate * 0.3;
        const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = this.context.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = this.context.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, this.context.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.3);

        const noiseGain = this.context.createGain();
        noiseGain.gain.setValueAtTime(0.3, this.context.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.4);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start();
        noise.stop(this.context.currentTime + 0.4);
    }

    updateIntensity(score) {
        this.intensity = Math.min(1, score / 500);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
        return this.muted;
    }

    setVolume(volume) {
        this.volume = volume;
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.value = volume;
        }
    }
}
