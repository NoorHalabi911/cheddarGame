const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDiv = document.getElementById('score');
const highscoreDiv = document.getElementById('highscore');
const menuDiv = document.getElementById('menu');
const gameoverDiv = document.getElementById('gameover');
const musicBtn = document.getElementById('musicBtn');
const bgm = new Audio('music1.mp3');
const bgm2 = new Audio('music2.mp3');
const loseSound = new Audio('lose.mp3');
let currentTrack = 1;

let WIDTH = 1000;
let HEIGHT = 700;
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener('resize', () => {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
});

// Game state
let state = 'menu'; // menu, playing, gameover
let score = 0;
let highscore = parseInt(localStorage.getItem('cheddar_highscore') || '0');

// Player
const player = {
    x: WIDTH/2,
    y: HEIGHT/2,
    size: 32,
    speed: 5,
    angle: 0,
    health: 5,
    maxHealth: 5
};

// Bullets
let bullets = [];
const BULLET_SPEED = 18;

// Enemies
let enemies = [];

// Input
const keys = {};
let mouseX = WIDTH/2, mouseY = HEIGHT/2;
let lastShot = 0;

// Power-ups
const powerUpTypes = [
    {type: 'rapid', emoji: '⚡'},
    {type: 'shield', emoji: '🛡️'},
    {type: 'health', emoji: '❤️'},
    {type: 'score', emoji: '💰'}
];
let powerUps = [];
let powerUpTimer = 600;
let rapidFireActive = false;
let rapidFireTimer = 0;
let shieldActive = false;
let shieldTimer = 0;

// Utility
function dist(a, b) {
    return Math.hypot(a.x-b.x, a.y-b.y);
}

let difficultyLevel = 1;
let lastDifficultyScore = 0;

let boss = null;
let bossActive = false;
let bossHealth = 0;
let bossMaxHealth = 0;
let bossSpawnScore = 50;
let playerHitFlash = 0;
let bossWarning = 0;
let gameOverFade = 0;
const hitSound = new Audio('hit.mp3');

let isPaused = false;
let dashCooldown = 0;
let dashActive = false;
let dashTimer = 0;
let dashShake = 0;
let scoreAnim = 0;
let lastScore = 0;

let fireDelayBase = 80;
let inShop = false;

// DOM element checks
if (!canvas || !ctx || !scoreDiv || !highscoreDiv || !menuDiv || !gameoverDiv || !musicBtn || !bgm || !bgm2 || !loseSound || !hitSound) {
    throw new Error('One or more required DOM elements are missing. Please check your HTML for all required IDs.');
}

// Set audio properties
bgm.loop = true;
bgm.volume = 0.5;
bgm2.loop = true;
bgm2.volume = 0.5;
loseSound.volume = 0.7;
hitSound.volume = 0.3;

function resetGame() {
    player.x = WIDTH/2;
    player.y = HEIGHT/2;
    player.health = player.maxHealth;
    bullets = [];
    enemies = [];
    score = 0;
    difficultyLevel = 1;
    lastDifficultyScore = 0;
    boss = null;
    bossActive = false;
    bossHealth = 0;
    bossMaxHealth = 0;
    bossSpawnScore = 50;
    
    // Start background music
    if (currentTrack === 1) {
        bgm2.pause();
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log('Audio play failed:', e));
    } else {
        bgm.pause();
        bgm2.currentTime = 0;
        bgm2.play().catch(e => console.log('Audio play failed:', e));
    }
    
    isPaused = false;
    dashCooldown = 0;
    dashActive = false;
    dashTimer = 0;
    dashShake = 0;
    scoreAnim = 0;
    lastScore = 0;
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    // Draw aim direction arrow toward mouse
    let dx = mouseX - player.x;
    let dy = mouseY - player.y;
    let angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -player.size-10);
    ctx.lineTo(0, -player.size+10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, -player.size);
    ctx.lineTo(player.size*0.7, player.size*0.7);
    ctx.lineTo(-player.size*0.7, player.size*0.7);
    ctx.closePath();
    ctx.fillStyle = '#ffdc32';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Shield effect
    if (shieldActive) {
        ctx.beginPath();
        ctx.arc(0, 0, player.size+8, 0, 2*Math.PI);
        ctx.strokeStyle = '#00e6ff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5 + 0.5*Math.sin(Date.now()/100);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    ctx.restore();
    
    // Draw hearts for health (moved outside the player translation)
    for (let i = 0; i < player.maxHealth; i++) {
        ctx.font = '28px serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.globalAlpha = i < player.health ? 1 : 0.2;
        ctx.fillText('❤️', 16 + i*32, 8);
        ctx.globalAlpha = 1;
    }
}

const fastFoodEmojis = ['🍔','🍟','🍕','🌭','🍩','🌮','🍗','🥓','🥪','🍿'];
const healthyFoodEmojis = ['🥦','🥕','🍎','🥑','🍉','🍌','🍇','🍓','🍅','🥬','🥒','🍊'];

function drawBullet(b) {
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillText(b.emoji, b.x, b.y);
    ctx.restore();
}

function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.beginPath();
    if (e.type === 'mold') {
        ctx.arc(0, 0, 22, 0, 2*Math.PI);
        ctx.fillStyle = '#64c864';
    } else if (e.type === 'charger') {
        ctx.arc(0, 0, 18, 0, 2*Math.PI);
        ctx.fillStyle = '#ff4444';
    } else {
        ctx.rect(-16, -16, 32, 32);
        ctx.fillStyle = '#888';
    }
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Draw emoji above enemy
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(e.emoji, e.x, e.y-28);
}

function drawPowerUp(p) {
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    ctx.fillText(p.emoji, p.x, p.y);
}

function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, 2*Math.PI);
    ctx.fillStyle = '#a020f0';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Health bar
    ctx.fillStyle = '#e23232';
    ctx.fillRect(boss.x-30, boss.y-54, 60, 10);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(boss.x-30, boss.y-54, 60*(bossHealth/bossMaxHealth), 10);
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';
    ctx.fillText('BOSS', boss.x, boss.y-60);
}

function draw() {
    ctx.save();
    // Screen shake effect
    if (playerHitFlash > 0 || dashShake > 0) {
        let shake = (playerHitFlash > 0 ? 10 : 0) + (dashShake > 0 ? 8 : 0);
        ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
    }
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Player hit flash
    if (playerHitFlash > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.restore();
    }
    drawPlayer();
    bullets.forEach(drawBullet);
    enemies.forEach(drawEnemy);
    powerUps.forEach(drawPowerUp);
    if (bossActive) drawBoss();
    // Boss warning
    if (bossWarning > 0) {
        ctx.save();
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd700';
        ctx.globalAlpha = 0.8;
        ctx.fillText('BOSS INCOMING!', WIDTH/2, HEIGHT/2);
        ctx.restore();
    }
    // Game over fade
    if (gameOverFade > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, gameOverFade/60);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.restore();
    }
    ctx.restore();
    // Animated score
    if (scoreAnim > 0) {
        ctx.save();
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.globalAlpha = scoreAnim/30;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('+' + scoreAnim, WIDTH/2, 60);
        ctx.restore();
    }
}

function update() {
    if (isPaused) return;
    // Player movement
    let dx = 0, dy = 0;
    if (keys['w'] || keys['ArrowUp']) dy -= 1;
    if (keys['s'] || keys['ArrowDown']) dy += 1;
    if (keys['a'] || keys['ArrowLeft']) dx -= 1;
    if (keys['d'] || keys['ArrowRight']) dx += 1;
    let len = Math.hypot(dx, dy);
    if (len > 0) {
        dx /= len; dy /= len;
        let moveSpeed = player.speed;
        if (dashActive) moveSpeed = player.speed * 3.5;
        player.x += dx * moveSpeed;
        player.y += dy * moveSpeed;
        player.x = Math.max(0, Math.min(WIDTH, player.x));
        player.y = Math.max(0, Math.min(HEIGHT, player.y));
    }
    // Aim
    player.angle = Math.atan2(dy, dx) + Math.PI/2;
    // Bullets
    bullets.forEach(b => {
        b.x += b.dx;
        b.y += b.dy;
    });
    bullets = bullets.filter(b => b.x>=0 && b.x<=WIDTH && b.y>=0 && b.y<=HEIGHT);
    // Increase difficulty every 120 score
    if (score - lastDifficultyScore >= 120) {
        difficultyLevel++;
        lastDifficultyScore = Math.floor(score / 120) * 120;
    }
    // Enemies
    enemies.forEach(e => {
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let len = Math.hypot(dx, dy);
        if (len>0) { dx/=len; dy/=len; }
        e.x += dx * e.speed;
        e.y += dy * e.speed;
    });
    // Boss spawn logic
    if (!bossActive && score >= bossSpawnScore) {
        bossActive = true;
        boss = {x: WIDTH/2, y: 80, speed: 2};
        if (score < 50) bossMaxHealth = 3;
        else if (score < 100) bossMaxHealth = 4;
        else bossMaxHealth = 5;
        bossHealth = bossMaxHealth;
        bossSpawnScore += 50;
        bossWarning = 120; // 2 seconds at 60fps
    }
    // Boss movement
    if (bossActive && boss) {
        let dx = player.x - boss.x;
        let dy = player.y - boss.y;
        let len = Math.hypot(dx, dy);
        if (len>0) { dx/=len; dy/=len; }
        boss.x += dx * boss.speed;
        boss.y += dy * boss.speed;
    }
    // Bullet-boss collision (restore this logic after boss movement, before boss-player collision)
    if (bossActive && boss) {
        bullets.forEach((b, bi) => {
            if (Math.hypot(b.x-boss.x, b.y-boss.y) < 40+7) {
                bossHealth--;
                bullets.splice(bi,1);
                // Optional: play a sound or flash effect here
            }
        });
        if (bossHealth <= 0) {
            bossActive = false;
            boss = null;
            score += 25;
        }
    }
    // Boss-player collision (2 hearts, instant death if <=2)
    if (bossActive && boss && Math.hypot(player.x-boss.x, player.y-boss.y) < 40+player.size/2) {
        if (!shieldActive) {
            if (player.health <= 2) {
                player.health = 0;
                gameOverFade = 1;
            } else {
                player.health -= 2;
                playerHitFlash = 20;
                playSound(hitSound);
                // Prevent multiple hits in one frame
                boss.x += 60 * (Math.random() > 0.5 ? 1 : -1);
                boss.y += 60 * (Math.random() > 0.5 ? 1 : -1);
            }
        }
    }
    // Bullet-enemy collision
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            let hit = e.type==='mold' ? 
                Math.hypot(b.x-e.x, b.y-e.y) < 22+7 : 
                Math.abs(b.x-e.x) < 16+7 && Math.abs(b.y-e.y) < 16+7;
            if (hit) {
                e.health--;  // Decrease enemy health
                if (e.health <= 0) {  // Only remove enemy if health is 0 or less
                    if (e.type==='mold') score += Math.floor(2+Math.random()*5);
                    else score += Math.floor(5+Math.random()*6);
                    enemies.splice(ei, 1);
                }
                bullets.splice(bi, 1);
                return;  // Exit after handling collision
            }
        });
    });
    // Enemy-player collision (separate from bullet collision)
    enemies.forEach((e, ei) => {
        let hit = e.type==='mold' ? 
            Math.hypot(player.x-e.x, player.y-e.y) < 22+player.size/2 : 
            Math.abs(player.x-e.x) < 16+player.size/2 && Math.abs(player.y-e.y) < 16+player.size/2;
        if (hit) {
            if (!shieldActive) {
                player.health--;
                playerHitFlash = 20;
                playSound(hitSound);
            }
            enemies.splice(ei, 1);
        }
    });
    // Power-up spawn
    powerUpTimer--;
    if (powerUpTimer <= 0) {
        let p = powerUpTypes[Math.floor(Math.random()*powerUpTypes.length)];
        let px = 40 + Math.random()*(WIDTH-80);
        let py = 40 + Math.random()*(HEIGHT-80);
        powerUps.push({type: p.type, emoji: p.emoji, x: px, y: py});
        powerUpTimer = 600 + Math.random()*600;
    }
    // Power-up collection
    powerUps = powerUps.filter(p => {
        if (Math.hypot(player.x-p.x, player.y-p.y) < player.size+10) {
            if (p.type === 'rapid') {
                rapidFireActive = true;
                rapidFireTimer = 600;
            } else if (p.type === 'shield') {
                shieldActive = true;
                shieldTimer = 600;
            } else if (p.type === 'health') {
                player.health = Math.min(player.maxHealth, player.health+2);
            } else if (p.type === 'score') {
                score += 50;
            }
            return false;
        }
        return true;
    });
    // Power-up timers
    if (rapidFireActive) {
        rapidFireTimer--;
        if (rapidFireTimer <= 0) rapidFireActive = false;
    }
    if (shieldActive) {
        shieldTimer--;
        if (shieldTimer <= 0) shieldActive = false;
    }
    enemies = enemies.filter(e => e.health>0);
    if (playerHitFlash > 0) playerHitFlash--;
    if (bossWarning > 0) bossWarning--;
    if (gameOverFade > 0) gameOverFade++;
    // Game over check (must be after all damage)
    if (player.health <= 0 && state === 'playing') {
        state = 'gameover';
        if (score > highscore) {
            highscore = Math.floor(score);
            localStorage.setItem('cheddar_highscore', highscore);
        }
        updateLeaderboard(Math.floor(score));
        // Stop background music and play death sound
        bgm.pause();
        bgm2.pause();
        playSound(loseSound);
        gameOverFade = 1;
    }
    // Dash logic
    if (dashActive) {
        dashTimer--;
        if (dashTimer <= 0) {
            dashActive = false;
            dashCooldown = 60; // 1s cooldown
        }
    } else if (dashCooldown > 0) {
        dashCooldown--;
    }
    // Animate score increases
    if (score > lastScore) {
        scoreAnim = Math.min(30, score - lastScore);
        lastScore = Math.floor(score);
    }
    if (scoreAnim > 0) scoreAnim--;
    if (playerHitFlash > 0) dashShake = 10;
    if (dashShake > 0) dashShake--;
    // Open shop every 360 score (3 waves)
    if (!inShop && Math.floor(score/360) > Math.floor(lastScore/360)) {
        openShop();
    }
}

function gameLoop() {
    if (isPaused) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.globalAlpha = 1;
        ctx.font = '60px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText('PAUSED', WIDTH/2, HEIGHT/2);
        ctx.font = '28px sans-serif';
        ctx.fillText('Press P to resume', WIDTH/2, HEIGHT/2+60);
        ctx.restore();
        return;
    }
    if (state==='playing') {
        update();
        draw();
        scoreDiv.textContent = 'Score: ' + Math.floor(score);
        highscoreDiv.textContent = 'High Score: ' + highscore;
        menuDiv.style.display = 'none';
        gameoverDiv.style.display = 'none';
    } else if (state==='menu') {
        ctx.clearRect(0,0,WIDTH,HEIGHT);
        menuDiv.style.display = 'block';
        gameoverDiv.style.display = 'none';
    } else if (state==='gameover') {
        ctx.clearRect(0,0,WIDTH,HEIGHT);
        menuDiv.style.display = 'none';
        gameoverDiv.style.display = 'block';
        // Update game over screen content
        let lb = getLeaderboard();
        let lbHtml = '<ol>' + lb.map(s => `<li>${s}</li>`).join('') + '</ol>';
        gameoverDiv.innerHTML = `
            <h1>Game Over!</h1>
            <p>Your Score: ${Math.floor(score)}</p>
            <p>High Score: ${highscore}</p>
            <h2>Leaderboard</h2>
            ${lbHtml}
            <p>Press R to Restart</p>
        `;
    }
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (state==='menu' && (e.key===' '||e.key==='Enter')) {
        resetGame();
        state = 'playing';
    }
    if (state==='gameover' && (e.key==='r'||e.key==='R')) {
        resetGame();
        state = 'menu';
    }
    if (e.key === 'p' || e.key === 'P') {
        isPaused = !isPaused;
        if (isPaused) {
            bgm.pause();
            bgm2.pause();
        } else {
            if (currentTrack === 1) {
                bgm.play().catch(e => console.log('Audio play failed:', e));
            } else {
                bgm2.play().catch(e => console.log('Audio play failed:', e));
            }
        }
        if (!isPaused) requestAnimationFrame(gameLoop);
    }
    // Dash ability (Shift)
    if ((e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight') && !dashActive && dashCooldown === 0 && state === 'playing') {
        dashActive = true;
        dashTimer = 15; // Dash lasts 15 frames (~0.25s)
        dashShake = 10;
    }
});

document.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', e => {
    if (state!=='playing' || inShop) return;
    let now = Date.now();
    let fireDelay = rapidFireActive ? Math.max(20, fireDelayBase-20) : fireDelayBase;
    if (now - lastShot < fireDelay) return;
    lastShot = now;
    let dx = mouseX - player.x;
    let dy = mouseY - player.y;
    let len = Math.hypot(dx, dy);
    if (len>0) {
        dx/=len; dy/=len;
        const emoji = '🔫';
        bullets.push({x:player.x, y:player.y, dx:dx*BULLET_SPEED, dy:dy*BULLET_SPEED, emoji, rpg:false, sniper:false, ak:true});
    }
});

// Initialize audio context on user interaction
document.addEventListener('click', function initAudio() {
    // Resume all audio elements
    [bgm, bgm2, loseSound, hitSound].forEach(audio => {
        audio.play().catch(e => console.log('Audio play failed:', e));
        audio.pause();
    });
    document.removeEventListener('click', initAudio);
}, { once: true });

musicBtn.onclick = function() {
    if (currentTrack === 1) {
        bgm.pause();
        bgm2.currentTime = 0;
        bgm2.play().catch(e => console.log('Audio play failed:', e));
        currentTrack = 2;
        musicBtn.textContent = '🔊 Music 2';
    } else {
        bgm2.pause();
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log('Audio play failed:', e));
        currentTrack = 1;
        musicBtn.textContent = '🔊 Music 1';
    }
};

// Ensure music plays on user interaction (for browsers that block autoplay)
document.body.addEventListener('click', function playMusicOnce() {
    if (currentTrack === 1) {
        bgm.play();
    } else {
        bgm2.play();
    }
    document.body.removeEventListener('click', playMusicOnce);
});

resetGame();
// Spawn 1 enemy every second
setInterval(() => {
    if (state !== 'playing') return;
    let side = Math.floor(Math.random()*4);
    let ex, ey;
    if (side===0) { ex=Math.random()*WIDTH; ey=-30; }
    else if (side===1) { ex=WIDTH+30; ey=Math.random()*HEIGHT; }
    else if (side===2) { ex=Math.random()*WIDTH; ey=HEIGHT+30; }
    else { ex=-30; ey=Math.random()*HEIGHT; }
    let rand = Math.random();
    let type, health, speed, emoji;
    if (rand < 0.2) {
        type = 'charger';
        health = 1;
        speed = 5;
        emoji = '🐭'; // fast mouse
    } else if (rand < 0.6) {
        type = 'mold';
        health = 2;
        speed = 1.5;
        emoji = healthyFoodEmojis[Math.floor(Math.random()*healthyFoodEmojis.length)];
    } else {
        type = 'rat';
        health = 1;
        speed = 3;
        emoji = healthyFoodEmojis[Math.floor(Math.random()*healthyFoodEmojis.length)];
    }
    enemies.push({x:ex, y:ey, type:type, health:health, speed:speed, emoji});
}, 1000);

// Survival score: +0.5 every second
setInterval(() => {
    if (state === 'playing') score += 0.5;
}, 1000);

// Add How to Play instructions in menu
if (menuDiv) {
    menuDiv.innerHTML = `
        <h1>Cheddar Defense</h1>
        <p>Move: WASD or Arrow Keys<br>
        Aim: Mouse<br>
        Shoot: Mouse Click<br>
        Dash: Shift (short burst, 1s cooldown)<br>
        Pause: P<br>
        Collect power-ups, survive as long as you can!<br>
        Defeat bosses for bonus points.<br>
        <b>Press Space or Enter to Start</b></p>
    `;
}
gameLoop();

// Ensure hitSound and loseSound are Audio objects and play with error logging
// (already handled in previous code, but add extra logging for debugging)
function playSound(audio) {
    if (audio && typeof audio.play === 'function') {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e, audio.src));
    } else {
        console.log('Audio object missing or invalid:', audio);
    }
}

function openShop() {
    inShop = true;
    isPaused = true;
    // Show shop overlay
    menuDiv.style.display = 'block';
    menuDiv.innerHTML = `
        <h1>Shop</h1>
        <p>Spend your score to upgrade:</p>
        <button id='buyHealth'>+1 Heart (100 pts)</button><br><br>
        <button id='buyFire'>Faster Fire (150 pts)</button><br><br>
        <button id='closeShop'>Continue</button>
        <p>Your Score: ${Math.floor(score)}</p>
    `;
    document.getElementById('buyHealth').onclick = function() {
        if (score >= 100) {
            player.maxHealth++;
            player.health = player.maxHealth;
            score -= 100;
            openShop();
        }
    };
    document.getElementById('buyFire').onclick = function() {
        if (score >= 150 && fireDelayBase > 20) {
            fireDelayBase -= 10;
            score -= 150;
            openShop();
        }
    };
    document.getElementById('closeShop').onclick = function() {
        inShop = false;
        isPaused = false;
        menuDiv.style.display = 'none';
        requestAnimationFrame(gameLoop);
    };
}

// Leaderboard logic
function getLeaderboard() {
    let lb = JSON.parse(localStorage.getItem('cheddar_leaderboard') || '[]');
    return lb;
}
function updateLeaderboard(newScore) {
    let lb = getLeaderboard();
    lb.push(newScore);
    lb = lb.sort((a,b) => b-a).slice(0,5);
    localStorage.setItem('cheddar_leaderboard', JSON.stringify(lb));
    return lb;
}

// Add a 'Click to Start' button to handle autoplay restrictions
const startBtn = document.getElementById('startBtn');
startBtn.addEventListener('click', () => {
    startBtn.style.display = 'none';
    // Initialize audio and start the game
    bgm.play().catch(e => console.error('Error playing audio:', e));
    bgm2.play().catch(e => console.error('Error playing audio:', e));
    loseSound.play().catch(e => console.error('Error playing audio:', e));
    hitSound.play().catch(e => console.error('Error playing audio:', e));
    // Start the game loop
    requestAnimationFrame(gameLoop);
}); 