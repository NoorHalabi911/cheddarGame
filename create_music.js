// This is a helper script to create simple music files
// Run this in Node.js to generate the required sound files

const fs = require('fs');

// Function to create a simple music note
function createNote(frequency, duration, sampleRate = 44100) {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit audio

    for (let i = 0; i < numSamples; i++) {
        const value = Math.sin(i * frequency * 2 * Math.PI / sampleRate) * 32767;
        buffer.writeInt16LE(value, i * 2);
    }

    return buffer;
}

// Function to create a simple melody
function createMelody(notes, durations, sampleRate = 44100) {
    let buffers = [];
    for (let i = 0; i < notes.length; i++) {
        buffers.push(createNote(notes[i], durations[i], sampleRate));
    }
    return Buffer.concat(buffers);
}

// Create WAV header
function createWavHeader(dataLength, sampleRate = 44100) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    return header;
}

// Create background music 1 (upbeat)
const notes1 = [440, 494, 523, 587, 659, 587, 523, 494];
const durations1 = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];
const melody1 = createMelody(notes1, durations1);
const wav1 = Buffer.concat([createWavHeader(melody1.length), melody1]);
fs.writeFileSync('music1.mp3', wav1);

// Create background music 2 (dramatic)
const notes2 = [392, 440, 494, 523, 587, 659, 698, 784];
const durations2 = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
const melody2 = createMelody(notes2, durations2);
const wav2 = Buffer.concat([createWavHeader(melody2.length), melody2]);
fs.writeFileSync('music2.mp3', wav2);

// Create lose sound (sad descending notes)
const notes3 = [784, 698, 659, 587, 523, 494, 440, 392];
const durations3 = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];
const melody3 = createMelody(notes3, durations3);
const wav3 = Buffer.concat([createWavHeader(melody3.length), melody3]);
fs.writeFileSync('lose.mp3', wav3);

// Create hit sound (short beep)
const hitSound = createNote(880, 0.1);
const wav4 = Buffer.concat([createWavHeader(hitSound.length), hitSound]);
fs.writeFileSync('hit.mp3', wav4);

console.log('Music files created successfully!'); 