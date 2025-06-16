import pygame
import math
import random
import os
import json

pygame.init()

WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('Cheddar Showdown')

# Asset loading helper
def load_sprite(name, fallback_shape, size):
    path = os.path.join('assets', name)
    if os.path.exists(path):
        img = pygame.image.load(path).convert_alpha()
        return pygame.transform.smoothscale(img, size)
    return None

# Load sprites (fallbacks will be used if not found)
PLAYER_SPRITE = load_sprite('cheddrick.png', 'triangle', (60, 60))
MOLD_SPRITE = load_sprite('mold.png', 'circle', (56, 56))
RAT_SPRITE = load_sprite('rat.png', 'rect', (36, 36))
BOSS_SPRITE = load_sprite('toaster_titan.png', 'rect', (80, 80))
SAUCE_SPRITE = load_sprite('sauce.png', 'circle', (36, 36))
GRATER_SPRITE = load_sprite('grater.png', 'rect', (28, 28))
SWISS_SPRITE = load_sprite('swiss.png', 'circle', (32, 32))
MILK_BOMB_SPRITE = load_sprite('milk_bomb.png', 'circle', (60, 60))

# Colors
YELLOW = (255, 220, 50)
ORANGE = (255, 170, 30)
BG = (30, 30, 40)
MOLD_GREEN = (100, 200, 100)
RAT_GRAY = (120, 120, 120)
RED = (220, 50, 50)
WHITE = (255, 255, 255)
BLUE = (100, 200, 255)
PURPLE = (180, 100, 255)
GOLD = (255, 215, 0)

# Player settings
PLAYER_SIZE = 50
PLAYER_SPEED = 6
PLAYER_MAX_HEALTH = 5
player_x = WIDTH // 2
player_y = HEIGHT // 2
player_angle = 0
player_health = PLAYER_MAX_HEALTH
score = 0

# Bullet settings
BULLET_RADIUS = 8
BULLET_SPEED = 12
bullets = []  # Each bullet: [x, y, dx, dy, pierce]
FIRE_COOLDOWN = 200  # ms
last_fire_time = 0

# Powerups
powerups = []  # Each: dict with type, x, y, timer
POWERUP_TYPES = ['sauce', 'grater', 'swiss']
powerup_active = {'sauce': False, 'grater': False, 'swiss': False}
powerup_timer = {'sauce': 0, 'grater': 0, 'swiss': 0}
POWERUP_DURATION = 6000  # ms
POWERUP_SPAWN_EVENT = pygame.USEREVENT + 2
pygame.time.set_timer(POWERUP_SPAWN_EVENT, 8000)

# Milk Bomb
milk_bomb_ready = True
milk_bomb_cooldown = 6000  # ms
last_milk_bomb = -milk_bomb_cooldown
milk_bombs = []  # Each: [x, y, timer]

# Enemy settings
enemies = []  # Each: dict with type, x, y, health, speed
ENEMY_SPAWN_EVENT = pygame.USEREVENT + 1
pygame.time.set_timer(ENEMY_SPAWN_EVENT, 1200)

MOLD_HEALTH = 2
MOLD_SPEED = 2
RAT_HEALTH = 1
RAT_SPEED = 4

# Boss
boss = None
BOSS_HEALTH = 30
BOSS_SPEED = 1.5
BOSS_BULLETS = []
BOSS_FIRE_EVENT = pygame.USEREVENT + 3
boss_spawned = False

clock = pygame.time.Clock()
running = True
game_over = False
font = pygame.font.SysFont(None, 40)

# High score persistence
HIGHSCORE_FILE = 'cheddar_highscore.json'
def load_highscore():
    if os.path.exists(HIGHSCORE_FILE):
        with open(HIGHSCORE_FILE, 'r') as f:
            return json.load(f).get('highscore', 0)
    return 0

def save_highscore(score):
    with open(HIGHSCORE_FILE, 'w') as f:
        json.dump({'highscore': score}, f)

highscore = load_highscore()

# Visual effects
explosions = []  # Each: [x, y, timer]
hit_flashes = []  # Each: [x, y, timer]

# Game states
STATE_TITLE = 0
STATE_PLAYING = 1
STATE_PAUSED = 2
STATE_GAMEOVER = 3
game_state = STATE_TITLE

# Utility functions
def draw_player(x, y, angle, health):
    points = []
    for i in range(3):
        theta = angle + i * 2 * math.pi / 3
        px = x + PLAYER_SIZE * math.cos(theta) * (0.7 if i else 1)
        py = y + PLAYER_SIZE * math.sin(theta) * (0.7 if i else 1)
        points.append((px, py))
    pygame.draw.polygon(screen, YELLOW, points)
    pygame.draw.rect(screen, RED, (x-25, y-45, 50, 8))
    pygame.draw.rect(screen, ORANGE, (x-25, y-45, 50*health/PLAYER_MAX_HEALTH, 8))
    if powerup_active['sauce']:
        pygame.draw.circle(screen, GOLD, (int(x), int(y)), PLAYER_SIZE//2+8, 3)
    if powerup_active['grater']:
        pygame.draw.circle(screen, WHITE, (int(x), int(y)), PLAYER_SIZE//2+14, 2)
    if powerup_active['swiss']:
        pygame.draw.circle(screen, BLUE, (int(x), int(y)), PLAYER_SIZE//2+20, 2)

def draw_enemy(enemy):
    if enemy['type'] == 'mold':
        pygame.draw.circle(screen, MOLD_GREEN, (int(enemy['x']), int(enemy['y'])), 28)
    elif enemy['type'] == 'rat':
        pygame.draw.rect(screen, RAT_GRAY, (enemy['x']-18, enemy['y']-18, 36, 36))
    pygame.draw.rect(screen, RED, (enemy['x']-20, enemy['y']-32, 40, 6))
    pygame.draw.rect(screen, WHITE, (enemy['x']-20, enemy['y']-32, 40*enemy['health']/enemy['max_health'], 6))

def draw_boss(boss):
    pygame.draw.rect(screen, PURPLE, (boss['x']-40, boss['y']-40, 80, 80), border_radius=12)
    pygame.draw.rect(screen, RED, (boss['x']-40, boss['y']-60, 80, 12))
    pygame.draw.rect(screen, GOLD, (boss['x']-40, boss['y']-60, 80*boss['health']/boss['max_health'], 12))
    font_boss = pygame.font.SysFont(None, 30)
    text = font_boss.render('Toaster Titan', True, WHITE)
    screen.blit(text, (boss['x']-50, boss['y']-80))

def draw_powerup(p):
    if p['type'] == 'sauce':
        pygame.draw.circle(screen, GOLD, (int(p['x']), int(p['y'])), 18)
    elif p['type'] == 'grater':
        pygame.draw.rect(screen, WHITE, (p['x']-14, p['y']-14, 28, 28), 0, 6)
    elif p['type'] == 'swiss':
        pygame.draw.circle(screen, BLUE, (int(p['x']), int(p['y'])), 16, 3)

def spawn_enemy():
    side = random.choice(['top','bottom','left','right'])
    if side == 'top':
        x, y = random.randint(40, WIDTH-40), -30
    elif side == 'bottom':
        x, y = random.randint(40, WIDTH-40), HEIGHT+30
    elif side == 'left':
        x, y = -30, random.randint(40, HEIGHT-40)
    else:
        x, y = WIDTH+30, random.randint(40, HEIGHT-40)
    if random.random() < 0.6:
        enemies.append({'type':'mold','x':x,'y':y,'health':MOLD_HEALTH,'max_health':MOLD_HEALTH,'speed':MOLD_SPEED})
    else:
        enemies.append({'type':'rat','x':x,'y':y,'health':RAT_HEALTH,'max_health':RAT_HEALTH,'speed':RAT_SPEED})

def spawn_powerup():
    t = random.choice(POWERUP_TYPES)
    x, y = random.randint(60, WIDTH-60), random.randint(60, HEIGHT-60)
    powerups.append({'type': t, 'x': x, 'y': y, 'timer': pygame.time.get_ticks()})

def reset():
    global player_x, player_y, player_health, score, enemies, bullets, game_over, boss, boss_spawned, powerups, powerup_active, powerup_timer, milk_bomb_ready, last_milk_bomb, milk_bombs, BOSS_BULLETS
    player_x, player_y = WIDTH//2, HEIGHT//2
    player_health = PLAYER_MAX_HEALTH
    score = 0
    enemies = []
    bullets = []
    game_over = False
    boss = None
    boss_spawned = False
    powerups = []
    for k in powerup_active: powerup_active[k] = False
    for k in powerup_timer: powerup_timer[k] = 0
    milk_bomb_ready = True
    last_milk_bomb = -milk_bomb_cooldown
    milk_bombs = []
    BOSS_BULLETS.clear()

# Main loop
while running:
    dt = clock.tick(60)
    now = pygame.time.get_ticks()
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if not game_over and event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if powerup_active['sauce']:
                fire_rate = FIRE_COOLDOWN // 2
            else:
                fire_rate = FIRE_COOLDOWN
            if now - last_fire_time > fire_rate:
                mx, my = pygame.mouse.get_pos()
                dx = mx - player_x
                dy = my - player_y
                dist = math.hypot(dx, dy)
                if dist != 0:
                    dx /= dist
                    dy /= dist
                    pierce = powerup_active['grater']
                    bullets.append([player_x, player_y, dx * BULLET_SPEED, dy * BULLET_SPEED, pierce])
                    last_fire_time = now
        if not game_over and event.type == ENEMY_SPAWN_EVENT and not boss_spawned:
            spawn_enemy()
        if not game_over and event.type == POWERUP_SPAWN_EVENT:
            spawn_powerup()
        if not game_over and event.type == pygame.KEYDOWN:
            if event.key == pygame.K_e and milk_bomb_ready:
                milk_bombs.append([player_x, player_y, now])
                milk_bomb_ready = False
                last_milk_bomb = now
            if event.key == pygame.K_r and game_over:
                reset()
        if not game_over and boss and event.type == BOSS_FIRE_EVENT:
            # Boss fires projectiles in 8 directions
            for i in range(8):
                angle = i * math.pi/4
                dx = math.cos(angle)
                dy = math.sin(angle)
                BOSS_BULLETS.append({'x': boss['x'], 'y': boss['y'], 'dx': dx*7, 'dy': dy*7})
        if game_state == STATE_TITLE:
            if event.type == pygame.KEYDOWN and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                reset()
                game_state = STATE_PLAYING
        elif game_state == STATE_PAUSED:
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                game_state = STATE_PLAYING
        elif game_state == STATE_GAMEOVER:
            if event.type == pygame.KEYDOWN and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                game_state = STATE_TITLE

    if not game_over:
        # Movement
        keys = pygame.key.get_pressed()
        speed = PLAYER_SPEED * (0.5 if powerup_active['swiss'] else 1)
        if keys[pygame.K_a] or keys[pygame.K_LEFT]:
            player_x -= speed
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]:
            player_x += speed
        if keys[pygame.K_w] or keys[pygame.K_UP]:
            player_y -= speed
        if keys[pygame.K_s] or keys[pygame.K_DOWN]:
            player_y += speed
        player_x = max(0, min(WIDTH, player_x))
        player_y = max(0, min(HEIGHT, player_y))
        mx, my = pygame.mouse.get_pos()
        player_angle = math.atan2(my - player_y, mx - player_x)
        # Move bullets
        for bullet in bullets:
            bullet[0] += bullet[2]
            bullet[1] += bullet[3]
        bullets = [b for b in bullets if 0 <= b[0] <= WIDTH and 0 <= b[1] <= HEIGHT]
        # Move enemies
        for enemy in enemies:
            dx = player_x - enemy['x']
            dy = player_y - enemy['y']
            dist = math.hypot(dx, dy)
            if dist != 0:
                dx /= dist
                dy /= dist
            enemy['x'] += dx * enemy['speed'] * (0.5 if powerup_active['swiss'] else 1)
            enemy['y'] += dy * enemy['speed'] * (0.5 if powerup_active['swiss'] else 1)
        # Bullet-enemy collision
        for bullet in bullets[:]:
            for enemy in enemies:
                ex, ey = enemy['x'], enemy['y']
                if enemy['type'] == 'mold':
                    hit = math.hypot(bullet[0]-ex, bullet[1]-ey) < 28+BULLET_RADIUS
                else:
                    hit = abs(bullet[0]-ex) < 18+BULLET_RADIUS and abs(bullet[1]-ey) < 18+BULLET_RADIUS
                if hit:
                    enemy['health'] -= 1
                    if not bullet[4]:
                        if bullet in bullets:
                            bullets.remove(bullet)
                    break
        # Remove dead enemies, add to score
        for enemy in enemies[:]:
            if enemy['health'] <= 0:
                enemies.remove(enemy)
                score += 1
        # Enemy-player collision
        for enemy in enemies[:]:
            ex, ey = enemy['x'], enemy['y']
            if enemy['type'] == 'mold':
                hit = math.hypot(player_x-ex, player_y-ey) < 28+PLAYER_SIZE//2
            else:
                hit = abs(player_x-ex) < 18+PLAYER_SIZE//2 and abs(player_y-ey) < 18+PLAYER_SIZE//2
            if hit:
                player_health -= 1
                enemies.remove(enemy)
                if player_health <= 0:
                    game_over = True
                break
        # Powerup collision
        for p in powerups[:]:
            if math.hypot(player_x-p['x'], player_y-p['y']) < PLAYER_SIZE//2+20:
                powerup_active[p['type']] = True
                powerup_timer[p['type']] = now
                powerups.remove(p)
        # Powerup timers
        for t in POWERUP_TYPES:
            if powerup_active[t] and now - powerup_timer[t] > POWERUP_DURATION:
                powerup_active[t] = False
        # Milk bomb logic
        if not milk_bomb_ready and now - last_milk_bomb > milk_bomb_cooldown:
            milk_bomb_ready = True
        for bomb in milk_bombs[:]:
            if now - bomb[2] > 400:
                # Explode
                for enemy in enemies[:]:
                    if math.hypot(bomb[0]-enemy['x'], bomb[1]-enemy['y']) < 120:
                        enemy['health'] -= 2
                milk_bombs.remove(bomb)
        # Boss spawn
        if not boss_spawned and score >= 20:
            boss = {'x': WIDTH//2, 'y': 80, 'health': BOSS_HEALTH, 'max_health': BOSS_HEALTH}
            boss_spawned = True
            pygame.time.set_timer(BOSS_FIRE_EVENT, 1200)
        # Boss logic
        if boss:
            dx = player_x - boss['x']
            dy = player_y - boss['y']
            dist = math.hypot(dx, dy)
            if dist != 0:
                dx /= dist
                dy /= dist
            boss['x'] += dx * BOSS_SPEED * (0.5 if powerup_active['swiss'] else 1)
            boss['y'] += dy * BOSS_SPEED * (0.5 if powerup_active['swiss'] else 1)
            # Bullet-boss collision
            for bullet in bullets[:]:
                if abs(bullet[0]-boss['x']) < 40+BULLET_RADIUS and abs(bullet[1]-boss['y']) < 40+BULLET_RADIUS:
                    boss['health'] -= 1
                    if not bullet[4]:
                        if bullet in bullets:
                            bullets.remove(bullet)
            if boss['health'] <= 0:
                boss = None
                boss_spawned = False
                score += 10
                pygame.time.set_timer(BOSS_FIRE_EVENT, 0)
            # Boss bullets
            for b in BOSS_BULLETS[:]:
                b['x'] += b['dx']
                b['y'] += b['dy']
                if not (0 <= b['x'] <= WIDTH and 0 <= b['y'] <= HEIGHT):
                    BOSS_BULLETS.remove(b)
                elif math.hypot(player_x-b['x'], player_y-b['y']) < PLAYER_SIZE//2+12:
                    player_health -= 2
                    BOSS_BULLETS.remove(b)
                    if player_health <= 0:
                        game_over = True
        # Boss-player collision
        if boss and math.hypot(player_x-boss['x'], player_y-boss['y']) < 40+PLAYER_SIZE//2:
            player_health = 0
            game_over = True
    # Draw everything
    screen.fill(BG)
    if not game_over:
        draw_player(player_x, player_y, player_angle, player_health)
        for enemy in enemies:
            draw_enemy(enemy)
        for bullet in bullets:
            pygame.draw.circle(screen, ORANGE, (int(bullet[0]), int(bullet[1])), BULLET_RADIUS)
        for p in powerups:
            draw_powerup(p)
        for bomb in milk_bombs:
            pygame.draw.circle(screen, WHITE, (int(bomb[0]), int(bomb[1])), 30, 3)
            pygame.draw.circle(screen, WHITE, (int(bomb[0]), int(bomb[1])), 120, 2)
        if boss:
            draw_boss(boss)
            for b in BOSS_BULLETS:
                pygame.draw.circle(screen, PURPLE, (int(b['x']), int(b['y'])), 12)
        score_text = font.render(f'Score: {score}', True, WHITE)
        screen.blit(score_text, (20, 20))
        if milk_bomb_ready:
            mb_text = font.render('Milk Bomb (E): READY', True, BLUE)
        else:
            mb_text = font.render('Milk Bomb (E): ...', True, (120,120,120))
        screen.blit(mb_text, (20, 60))
    else:
        over_text = font.render('Game Over! Press R to Restart', True, RED)
        screen.blit(over_text, (WIDTH//2-220, HEIGHT//2-30))
        score_text = font.render(f'Final Score: {score}', True, WHITE)
        screen.blit(score_text, (WIDTH//2-100, HEIGHT//2+20))
    pygame.display.flip()

pygame.quit() 