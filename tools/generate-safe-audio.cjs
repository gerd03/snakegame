"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const lameAllPath = require.resolve("lamejs/lame.all.js");
vm.runInThisContext(fs.readFileSync(lameAllPath, "utf8"), { filename: lameAllPath });

const SAMPLE_RATE = 44100;
const BIT_RATE = 192;
const TWO_PI = Math.PI * 2;

function semitone(root, offset) {
    return root * Math.pow(2, offset / 12);
}

function waveform(type, phase) {
    switch (type) {
        case "triangle":
            return (2 * Math.asin(Math.sin(phase))) / Math.PI;
        case "square":
            return Math.sin(phase) >= 0 ? 1 : -1;
        case "saw": {
            const x = phase / TWO_PI;
            return 2 * (x - Math.floor(x + 0.5));
        }
        default:
            return Math.sin(phase);
    }
}

function envelope(t, duration) {
    const attack = Math.min(0.02, duration * 0.2);
    const decay = Math.min(0.08, duration * 0.25);
    const release = Math.min(0.12, duration * 0.35);
    const sustainLevel = 0.75;

    if (t < attack) {
        return t / Math.max(attack, 1e-6);
    }

    if (t < attack + decay) {
        const p = (t - attack) / Math.max(decay, 1e-6);
        return 1 - (1 - sustainLevel) * p;
    }

    if (t < duration - release) {
        return sustainLevel;
    }

    const p = (t - (duration - release)) / Math.max(release, 1e-6);
    return sustainLevel * Math.max(0, 1 - p);
}

function addTone(samples, {
    start = 0,
    duration = 0.2,
    freq = 440,
    volume = 0.1,
    type = "sine",
    vibratoFreq = 0,
    vibratoDepth = 0
}) {
    const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const endIndex = Math.min(samples.length, startIndex + Math.floor(duration * SAMPLE_RATE));

    for (let i = startIndex; i < endIndex; i++) {
        const localTime = (i - startIndex) / SAMPLE_RATE;
        const absoluteTime = i / SAMPLE_RATE;
        const vibrato = vibratoDepth > 0 ? 1 + vibratoDepth * Math.sin(TWO_PI * vibratoFreq * absoluteTime) : 1;
        const phase = TWO_PI * freq * vibrato * localTime;
        samples[i] += waveform(type, phase) * volume * envelope(localTime, duration);
    }
}

function addNoiseBurst(samples, { start = 0, duration = 0.05, volume = 0.04 }) {
    const startIndex = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const endIndex = Math.min(samples.length, startIndex + Math.floor(duration * SAMPLE_RATE));

    for (let i = startIndex; i < endIndex; i++) {
        const t = (i - startIndex) / SAMPLE_RATE;
        const env = envelope(t, duration);
        const n = (Math.random() * 2 - 1) * volume;
        samples[i] += n * env;
    }
}

function addMasterFade(samples, fadeSeconds = 0.06) {
    const fadeSamples = Math.max(1, Math.floor(fadeSeconds * SAMPLE_RATE));
    const limit = Math.min(fadeSamples, Math.floor(samples.length / 2));

    for (let i = 0; i < limit; i++) {
        const fadeIn = i / limit;
        const fadeOut = (limit - i) / limit;
        samples[i] *= fadeIn;
        samples[samples.length - 1 - i] *= fadeOut;
    }
}

function normalize(samples, peak = 0.92) {
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        if (a > max) max = a;
    }

    if (max <= 0) return;

    const gain = peak / max;
    for (let i = 0; i < samples.length; i++) {
        samples[i] *= gain;
    }
}

function encodeMp3(samples, filePath) {
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const v = Math.max(-1, Math.min(1, samples[i]));
        int16[i] = v < 0 ? v * 32768 : v * 32767;
    }

    const encoder = new lamejs.Mp3Encoder(1, SAMPLE_RATE, BIT_RATE);
    const mp3Chunks = [];
    const frameSize = 1152;

    for (let i = 0; i < int16.length; i += frameSize) {
        const chunk = int16.subarray(i, i + frameSize);
        const encoded = encoder.encodeBuffer(chunk);
        if (encoded.length > 0) mp3Chunks.push(Buffer.from(encoded));
    }

    const flush = encoder.flush();
    if (flush.length > 0) mp3Chunks.push(Buffer.from(flush));

    fs.writeFileSync(filePath, Buffer.concat(mp3Chunks));
}

function makeBuffer(seconds) {
    return new Float32Array(Math.floor(seconds * SAMPLE_RATE));
}

function renderMenuTrack() {
    const duration = 38;
    const samples = makeBuffer(duration);
    const beat = 60 / 96;
    const roots = [220.0, 174.61, 196.0, 164.81];
    const arp = [12, 7, 4, 7];

    const beats = Math.floor(duration / beat);
    for (let b = 0; b < beats; b++) {
        const start = b * beat;
        const measure = Math.floor(b / 4);
        const root = roots[measure % roots.length];

        addTone(samples, {
            start,
            duration: beat * 0.92,
            freq: semitone(root, arp[b % arp.length]),
            volume: 0.11,
            type: "triangle",
            vibratoFreq: 4,
            vibratoDepth: 0.003
        });

        addTone(samples, {
            start,
            duration: beat * 0.96,
            freq: root / 2,
            volume: 0.06,
            type: "sine"
        });

        if (b % 4 === 0) {
            [0, 4, 7].forEach((offset) => {
                addTone(samples, {
                    start,
                    duration: beat * 3.9,
                    freq: semitone(root, offset),
                    volume: 0.025,
                    type: "sine"
                });
            });
        }
    }

    addMasterFade(samples, 0.1);
    normalize(samples, 0.88);
    return samples;
}

function renderGameplayTrackOne() {
    const duration = 42;
    const samples = makeBuffer(duration);
    const beat = 60 / 128;
    const roots = [146.83, 174.61, 196.0, 220.0];
    const riff = [0, 3, 7, 10, 12, 10, 7, 3];
    const steps = Math.floor(duration / (beat / 2));

    for (let s = 0; s < steps; s++) {
        const start = s * (beat / 2);
        const measure = Math.floor(s / 8);
        const root = roots[measure % roots.length];
        const offset = riff[s % riff.length];

        addTone(samples, {
            start,
            duration: beat * 0.45,
            freq: semitone(root, offset),
            volume: 0.1,
            type: "saw"
        });

        if (s % 2 === 0) {
            addTone(samples, {
                start,
                duration: beat * 0.8,
                freq: root / 2,
                volume: 0.07,
                type: "square"
            });

            addNoiseBurst(samples, { start, duration: 0.025, volume: 0.018 });
        }
    }

    addMasterFade(samples, 0.1);
    normalize(samples, 0.9);
    return samples;
}

function renderGameplayTrackTwo() {
    const duration = 44;
    const samples = makeBuffer(duration);
    const beat = 60 / 136;
    const roots = [130.81, 164.81, 196.0, 164.81];
    const melody = [12, 14, 15, 14, 12, 10, 7, 10];
    const steps = Math.floor(duration / (beat / 2));

    for (let s = 0; s < steps; s++) {
        const start = s * (beat / 2);
        const measure = Math.floor(s / 8);
        const root = roots[measure % roots.length];
        const note = melody[s % melody.length];

        addTone(samples, {
            start,
            duration: beat * 0.45,
            freq: semitone(root, note),
            volume: 0.11,
            type: "triangle",
            vibratoFreq: 5,
            vibratoDepth: 0.004
        });

        if (s % 2 === 0) {
            addTone(samples, {
                start,
                duration: beat * 0.82,
                freq: root / 2,
                volume: 0.065,
                type: "sine"
            });
        }

        if (s % 4 === 0) {
            addNoiseBurst(samples, { start: start + 0.02, duration: 0.02, volume: 0.016 });
        }
    }

    addMasterFade(samples, 0.1);
    normalize(samples, 0.9);
    return samples;
}

function renderSequenceSfx({ duration, notes, type = "sine", volume = 0.18 }) {
    const samples = makeBuffer(duration);
    notes.forEach((n) => {
        addTone(samples, {
            start: n.start,
            duration: n.length,
            freq: n.freq,
            volume: n.volume ?? volume,
            type: n.type ?? type,
            vibratoFreq: n.vibratoFreq ?? 0,
            vibratoDepth: n.vibratoDepth ?? 0
        });
    });
    addMasterFade(samples, 0.02);
    normalize(samples, 0.9);
    return samples;
}

function writeTrack(fileName, samples) {
    const out = path.resolve(process.cwd(), fileName);
    encodeMp3(samples, out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`Generated ${fileName} (${kb} KB)`);
}

function main() {
    writeTrack("menu.mp3", renderMenuTrack());
    writeTrack("gameplay.mp3", renderGameplayTrackOne());
    writeTrack("gameplay2.mp3", renderGameplayTrackTwo());

    writeTrack("1kscore.mp3", renderSequenceSfx({
        duration: 1.2,
        type: "triangle",
        notes: [
            { start: 0.00, length: 0.20, freq: 523.25, volume: 0.16 },
            { start: 0.18, length: 0.20, freq: 659.25, volume: 0.16 },
            { start: 0.36, length: 0.22, freq: 783.99, volume: 0.17 },
            { start: 0.58, length: 0.30, freq: 1046.5, volume: 0.19, vibratoFreq: 6, vibratoDepth: 0.01 }
        ]
    }));

    writeTrack("combowhore.mp3", renderSequenceSfx({
        duration: 1.0,
        type: "square",
        notes: [
            { start: 0.00, length: 0.16, freq: 311.13, volume: 0.16 },
            { start: 0.15, length: 0.16, freq: 392.00, volume: 0.16 },
            { start: 0.30, length: 0.18, freq: 466.16, volume: 0.16 },
            { start: 0.50, length: 0.24, freq: 587.33, volume: 0.18 }
        ]
    }));

    writeTrack("holyshit.mp3", renderSequenceSfx({
        duration: 1.1,
        type: "triangle",
        notes: [
            { start: 0.00, length: 0.18, freq: 587.33, volume: 0.16 },
            { start: 0.17, length: 0.18, freq: 523.25, volume: 0.16 },
            { start: 0.34, length: 0.18, freq: 659.25, volume: 0.17 },
            { start: 0.52, length: 0.28, freq: 783.99, volume: 0.19, vibratoFreq: 5, vibratoDepth: 0.008 }
        ]
    }));

    writeTrack("unstoppable.mp3", renderSequenceSfx({
        duration: 1.2,
        type: "saw",
        notes: [
            { start: 0.00, length: 0.16, freq: 440.00, volume: 0.15 },
            { start: 0.14, length: 0.16, freq: 554.37, volume: 0.16 },
            { start: 0.30, length: 0.18, freq: 659.25, volume: 0.17 },
            { start: 0.48, length: 0.22, freq: 880.00, volume: 0.18 },
            { start: 0.70, length: 0.24, freq: 987.77, volume: 0.19 }
        ]
    }));

    writeTrack("godlike.mp3", renderSequenceSfx({
        duration: 1.4,
        type: "triangle",
        notes: [
            { start: 0.00, length: 0.22, freq: 392.00, volume: 0.14 },
            { start: 0.20, length: 0.22, freq: 523.25, volume: 0.15 },
            { start: 0.42, length: 0.22, freq: 659.25, volume: 0.16 },
            { start: 0.64, length: 0.24, freq: 783.99, volume: 0.18 },
            { start: 0.88, length: 0.30, freq: 1046.5, volume: 0.2, vibratoFreq: 6, vibratoDepth: 0.01 }
        ]
    }));
}

main();
