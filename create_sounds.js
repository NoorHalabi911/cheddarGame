// This is a helper script to create simple sound files
// Run this in Node.js to generate the required sound files

const fs = require('fs');

// Function to create a simple beep sound
function createBeepSound(filename, duration = 0.5) {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit audio

    for (let i = 0; i < numSamples; i++) {
        const value = Math.sin(i * 440 * 2 * Math.PI / sampleRate) * 32767;
        buffer.writeInt16LE(value, i * 2);
    }

    // Create WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + buffer.length, 4);
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
    header.writeUInt32LE(buffer.length, 40);

    // Combine header and buffer
    const wavFile = Buffer.concat([header, buffer]);
    fs.writeFileSync(filename, wavFile);
}

// Create all required sound files
createBeepSound('hit.mp3', 0.1);  // Short beep for hits
createBeepSound('lose.mp3', 1.0); // Longer beep for game over
createBeepSound('why.mp3', 0.3);  // Medium beep for other sounds
createBeepSound('music1.mp3', 2.0); // Background music 1
createBeepSound('music2.mp3', 2.0); // Background music 2

console.log('Sound files created successfully!');