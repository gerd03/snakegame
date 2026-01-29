/**
 * AudioManager - Synthwave Audio with Adaptive Intensity
 */

export class AudioManager {
    constructor() {
        this.context = null;
        this.muted = false;
        this.bgmPlaying = false;
        this.volume = 0.5;
        this.intensity = 0;

        // Oscillators for procedural audio
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

        // Create synthwave-style BGM with oscillators
        this.bgmGain = this.context.createGain();
        this.bgmGain.gain.value = 0.15;
        this.bgmGain.connect(this.masterGain);

        // Bass line
        this.createBassLine();

        // Pad
        this.createPad();

        // Arp
        this.createArpeggio();
    }

    createBassLine() {
        const bassGain = this.context.createGain();
        bassGain.gain.value = 0.3;
        bassGain.connect(this.bgmGain);

        const bassNotes = [55, 55, 73.42, 82.41]; // A1, A1, D2, E2
        let noteIndex = 0;

        const playBassNote = () => {
            if (!this.bgmPlaying) return;

            const osc = this.context.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = bassNotes[noteIndex];

            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;

            const noteGain = this.context.createGain();
            noteGain.gain.setValueAtTime(0.3, this.context.currentTime);
            noteGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.4);

            osc.connect(filter);
            filter.connect(noteGain);
            noteGain.connect(bassGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.5);

            noteIndex = (noteIndex + 1) % bassNotes.length;

            setTimeout(playBassNote, 500);
        };

        playBassNote();
    }

    createPad() {
        const padGain = this.context.createGain();
        padGain.gain.value = 0.1;
        padGain.connect(this.bgmGain);

        const chordNotes = [220, 277.18, 329.63, 440]; // A3, C#4, E4, A4

        chordNotes.forEach((freq, i) => {
            const osc = this.context.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Slight detune for width
            osc.detune.value = (i - 1.5) * 10;

            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            osc.connect(filter);
            filter.connect(padGain);

            osc.start();
            this.bgmOscillators.push(osc);
        });
    }

    createArpeggio() {
        const arpGain = this.context.createGain();
        arpGain.gain.value = 0.1;
        arpGain.connect(this.bgmGain);

        const arpNotes = [440, 554.37, 659.25, 880, 659.25, 554.37];
        let noteIndex = 0;

        const playArpNote = () => {
            if (!this.bgmPlaying) return;

            const osc = this.context.createOscillator();
            osc.type = 'square';
            osc.frequency.value = arpNotes[noteIndex];

            const filter = this.context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            filter.Q.value = 5;

            const noteGain = this.context.createGain();
            noteGain.gain.setValueAtTime(0.2, this.context.currentTime);
            noteGain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);

            osc.connect(filter);
            filter.connect(noteGain);
            noteGain.connect(arpGain);

            osc.start();
            osc.stop(this.context.currentTime + 0.15);

            noteIndex = (noteIndex + 1) % arpNotes.length;

            // Speed up with intensity
            const interval = 150 - this.intensity * 50;
            setTimeout(playArpNote, Math.max(75, interval));
        };

        playArpNote();
    }

    stopBGM() {
        this.bgmPlaying = false;

        // Stop all oscillators
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
        }
    }

    playCollectSound() {
        const osc = this.context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, this.context.currentTime + 0.1);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }

    playPowerUpSound() {
        const frequencies = [261.63, 329.63, 392, 523.25];

        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                const osc = this.context.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;

                const gain = this.context.createGain();
                gain.gain.setValueAtTime(0.2, this.context.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start();
                osc.stop(this.context.currentTime + 0.25);
            }, i * 75);
        });
    }

    playDeathSound() {
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.5);

        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.5);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.4, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.context.currentTime + 0.7);

        // Impact noise
        const noise = this.context.createBufferSource();
        const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.2, this.context.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.1));
        }
        noise.buffer = noiseBuffer;

        const noiseGain = this.context.createGain();
        noiseGain.gain.value = 0.3;

        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start();
    }

    updateIntensity(score) {
        // Increase intensity based on score
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
