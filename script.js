// --- Constants and Globals ---
const FPS = 60;
const IS_HIDPI = window.devicePixelRatio > 1;
const IS_IOS = /CriOS/.test(window.navigator.userAgent);
const IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;
const RESOURCE_POSTFIX = "offline-resources-";

// --- Utility Functions ---
function getRandomNum(t, e) {
    return Math.floor(Math.random() * (e - t + 1)) + t;
}

function vibrate(t) {
    IS_MOBILE && window.navigator.vibrate && window.navigator.vibrate(t);
}

function createCanvas(t, e, i, s) {
    const n = document.createElement("canvas");
    n.className = s ? Runner.classes.CANVAS + " " + s : Runner.classes.CANVAS;
    n.width = e;
    n.height = i;
    t.appendChild(n);
    return n;
}

function getTimeStamp() {
    return IS_IOS ? new Date().getTime() : performance.now();
}

function CollisionBox(t, e, i, s) {
    this.x = t;
    this.y = e;
    this.width = i;
    this.height = s;
}

function createAdjustedCollisionBox(t, e) {
    return new CollisionBox(t.x + e.x, t.y + e.y, t.width, t.height)
}

function boxCompare(t, e) {
    const s = e.x;
    return t.x < s + e.width && t.x + t.width > s && t.y < e.y + e.height && t.height + t.y > e.y;
}

// --- Collision Detection ---
function checkForCollision(t, e, i) {
    const s = new CollisionBox(e.xPos + 1, e.yPos + 1, e.config.WIDTH - 2, e.config.HEIGHT - 2);
    const n = new CollisionBox(t.xPos + 1, t.yPos + 1, t.typeConfig.width * t.size - 2, t.typeConfig.height - 2);

    if (boxCompare(s, n)) {
        const a = t.collisionBoxes;
        const o = e.ducking ? Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING;
        for (let t = 0; t < o.length; t++)
            for (let e = 0; e < a.length; e++) {
                const h = createAdjustedCollisionBox(o[t], s);
                const r = createAdjustedCollisionBox(a[e], n);
                if (boxCompare(h, r)) return [h, r];
            }
    }
    return false;
}

// --- Class Definitions ---
function Runner(t) {
    if (Runner.instance_) return Runner.instance_;
    Runner.instance_ = this;

    this.outerContainerEl = document.querySelector(t);
    this.containerEl = null;
    this.config = Object.assign({}, Runner.config, Runner.normalConfig);
    this.dimensions = Runner.defaultDimensions;
    this.canvas = null;
    this.canvasCtx = null;
    this.tRex = null;
    this.distanceMeter = null;
    this.distanceRan = 0;
    this.highestScore = 0;
    this.time = 0;
    this.runningTime = 0;
    this.msPerFrame = 1e3 / FPS;
    this.currentSpeed = this.config.SPEED;
    this.obstacles = [];
    this.activated = false;
    this.playing = false;
    this.crashed = false;
    this.paused = false;
    this.inverted = false;
    this.invertTimer = 0;
    this.resizeTimerId_ = null;
    this.playCount = 0;
    this.audioContext = null;
    this.soundFx = {};
    this.gameOverPanel = null;

    this.loadImages();
}

function Trex(t, e) {
    this.canvas = t;
    this.canvasCtx = t.getContext("2d");
    this.spritePos = e;
    this.xPos = 0;
    this.yPos = 0;
    this.groundYPos = 0;
    this.currentFrame = 0;
    this.currentAnimFrames = [];
    this.blinkDelay = 0;
    this.blinkCount = 0;
    this.animStartTime = 0;
    this.timer = 0;
    this.msPerFrame = 1e3 / FPS;
    this.config = Trex.config;
    this.status = Trex.status.WAITING;
    this.jumping = false;
    this.ducking = false;
    this.jumpVelocity = 0;
    this.reachedMinHeight = false;
    this.speedDrop = false;
    this.jumpCount = 0;
    this.playingIntro = false;
    this.init();
}

function DistanceMeter(t, e, i) {
    this.canvas = t;
    this.canvasCtx = t.getContext("2d");
    this.image = Runner.imageSprite;
    this.spritePos = e;
    this.x = 0;
    this.y = 5;
    this.currentDistance = 0;
    this.maxScore = 0;
    this.highScore = "00000";
    this.digits = [];
    this.achievement = false;
    this.defaultString = "";
    this.flashTimer = 0;
    this.flashIterations = 0;
    this.config = DistanceMeter.config;
    this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
    this.init(i);
}

function Cloud(t, e, i) {
    this.canvas = t;
    this.canvasCtx = this.canvas.getContext("2d");
    this.spritePos = e;
    this.containerWidth = i;
    this.xPos = i;
    this.yPos = 0;
    this.remove = false;
    this.gap = getRandomNum(Cloud.config.MIN_CLOUD_GAP, Cloud.config.MAX_CLOUD_GAP);
    this.init();
}

function Obstacle(t, e, i, s, n, a) {
    this.canvasCtx = t;
    this.spritePos = i;
    this.typeConfig = e;
    this.gapCoefficient = n;
    this.size = getRandomNum(1, Runner.config.MAX_OBSTACLE_LENGTH);
    this.dimensions = s;
    this.remove = false;
    this.xPos = s.WIDTH;
    this.yPos = 0;
    this.width = 0;
    this.collisionBoxes = [];
    this.gap = 0;
    this.speedOffset = 0;
    this.currentFrame = 0;
    this.timer = 0;
    this.init(a);
}

function HorizonLine(t, e) {
    this.spritePos = e;
    this.canvas = t;
    this.canvasCtx = t.getContext("2d");
    this.sourceDimensions = {};
    this.dimensions = HorizonLine.dimensions;
    this.sourceXPos = [this.spritePos.x, this.spritePos.x + this.dimensions.WIDTH];
    this.xPos = [];
    this.yPos = 0;
    this.bumpThreshold = .5;
    this.setSourceDimensions();
    this.draw();
}

function Horizon(t, e, i, s) {
    this.canvas = t;
    this.canvasCtx = this.canvas.getContext("2d");
    this.config = Horizon.config;
    this.dimensions = i;
    this.gapCoefficient = s;
    this.obstacles = [];
    this.obstacleHistory = [];
    this.cloudFrequency = this.config.CLOUD_FREQUENCY;
    this.spritePos = e; // this.spritePos will hold the sprite definition object (LDPI or HDPI)
    this.clouds = [];
    this.cloudSpeed = this.config.BG_CLOUD_SPEED;
    this.horizonLine = null;
    this.init();
}

function GameOverPanel(t, e, i, s) {
    this.canvas = t;
    this.canvasCtx = t.getContext("2d");
    this.canvasDimensions = s;
    this.textImgPos = e;
    this.restartImgPos = i;
    this.draw();
}

// --- Game Configurations ---
Runner.config = {
    BG_CLOUD_SPEED: .2,
    BOTTOM_PAD: 10,
    CLEAR_TIME: 3e3,
    CLOUD_FREQUENCY: .5,
    GAMEOVER_CLEAR_TIME: 1200,
    INVERT_FADE_DURATION: 12e3,
    MAX_CLOUDS: 6,
    MAX_OBSTACLE_LENGTH: 3,
    MAX_OBSTACLE_DUPLICATION: 2,
    MAX_BLINK_COUNT: 3,
    SPEED_DROP_COEFFICIENT: 3,
};

Runner.normalConfig = {
    ACCELERATION: .001,
    GAP_COEFFICIENT: .6,
    INVERT_DISTANCE: 700,
    MAX_SPEED: 13,
    SPEED: 6
};

Runner.defaultDimensions = {
    WIDTH: 600,
    HEIGHT: 150
};

Runner.classes = {
    CANVAS: "runner-canvas",
    CONTAINER: "runner-container",
    CRASHED: "crashed",
    INVERTED: "inverted",
    TOUCH_CONTROLLER: "controller"
};

Runner.sounds = {
    BUTTON_PRESS: "offline-sound-press",
    HIT: "offline-sound-hit",
    SCORE: "offline-sound-reached"
};

Runner.keycodes = {
    JUMP: { 38: 1, 32: 1 },
    DUCK: { 40: 1 },
    RESTART: { 13: 1, 32: 1 }
};

Runner.events = {
    ANIM_END: "webkitAnimationEnd",
    CLICK: "click",
    KEYDOWN: "keydown",
    KEYUP: "keyup",
    RESIZE: "resize",
    TOUCHSTART: "touchstart",
    TOUCHEND: "touchend",
    VISIBILITY: "visibilitychange",
    BLUR: "blur",
    FOCUS: "focus",
    LOAD: "load"
};

Trex.config = {
    DROP_VELOCITY: -5,
    GRAVITY: .6,
    HEIGHT: 47,
    HEIGHT_DUCK: 25,
    INITIAL_JUMP_VELOCITY: -10,
    INTRO_DURATION: 1500,
    MAX_JUMP_HEIGHT: 30,
    MIN_JUMP_HEIGHT: 30,
    SPEED_DROP_COEFFICIENT: 3,
    START_X_POS: 50,
    WIDTH: 44,
    WIDTH_DUCK: 59
};

Trex.collisionBoxes = {
    DUCKING: [new CollisionBox(1, 18, 55, 25)],
    RUNNING: [new CollisionBox(22, 0, 17, 16), new CollisionBox(1, 18, 30, 9), new CollisionBox(10, 35, 14, 8), new CollisionBox(1, 24, 29, 5), new CollisionBox(5, 30, 21, 4), new CollisionBox(9, 34, 15, 4)]
};

Trex.status = {
    CRASHED: "CRASHED",
    DUCKING: "DUCKING",
    JUMPING: "JUMPING",
    RUNNING: "RUNNING",
    WAITING: "WAITING"
};

Trex.BLINK_TIMING = 7e3;

Trex.animFrames = {
    WAITING: { frames: [44, 0], msPerFrame: 1e3 / 3 },
    RUNNING: { frames: [88, 132], msPerFrame: 1e3 / 12 },
    CRASHED: { frames: [220], msPerFrame: 1e3 / 60 },
    JUMPING: { frames: [0], msPerFrame: 1e3 / 60 },
    DUCKING: { frames: [262, 321], msPerFrame: 1e3 / 8 }
};

DistanceMeter.config = {
    MAX_DISTANCE_UNITS: 5,
    ACHIEVEMENT_DISTANCE: 100,
    COEFFICIENT: .025,
    FLASH_DURATION: 250,
    FLASH_ITERATIONS: 3
};

Cloud.config = {
    HEIGHT: 14,
    MAX_CLOUD_GAP: 400,
    MAX_SKY_LEVEL: 30,
    MIN_CLOUD_GAP: 100,
    MIN_SKY_LEVEL: 71,
    WIDTH: 46
};

HorizonLine.dimensions = {
    WIDTH: 600,
    HEIGHT: 12,
    YPOS: 127
};

Horizon.config = {
    BG_CLOUD_SPEED: .2,
    BUMPY_THRESHOLD: .3,
    CLOUD_FREQUENCY: .5,
    MAX_CLOUDS: 6
};

GameOverPanel.dimensions = {
    TEXT_WIDTH: 191,
    TEXT_HEIGHT: 11,
    RESTART_WIDTH: 36,
    RESTART_HEIGHT: 32
};

// --- Prototypes ---
Runner.prototype = {
    loadImages() {
        const t = IS_HIDPI ? "2x" : "1x";
        Runner.imageSprite = document.getElementById(RESOURCE_POSTFIX + t);
        this.spriteDef = IS_HIDPI ? Runner.spriteDefinition.HDPI : Runner.spriteDefinition.LDPI;
        if (Runner.imageSprite.complete) {
            this.init();
        } else {
            Runner.imageSprite.addEventListener(Runner.events.LOAD, this.init.bind(this));
        }
    },

    async loadSounds() {
        if (!IS_IOS && !this.audioContext) {
            this.audioContext = new(window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            const soundSources = Object.values(Runner.sounds);
            const soundNames = Object.keys(Runner.sounds);
            for (let i = 0; i < soundSources.length; i++) {
                const path = document.getElementById(`offline-sound-${soundNames[i].toLowerCase().replace(/_/g, '-')}`).src;
                try {
                    const response = await fetch(path);
                    const arrayBuffer = await response.arrayBuffer();
                    this.audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                        this.soundFx[soundSources[i]] = buffer;
                    });
                } catch (error) {
                    console.error(`Failed to load sound: ${path}`, error);
                }
            }
        }
    },

    setSpeed(t) {
        this.currentSpeed = t || this.currentSpeed;
    },

    init() {
        this.adjustDimensions();
        this.setSpeed();

        this.containerEl = document.createElement("div");
        this.containerEl.className = Runner.classes.CONTAINER;

        this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH, this.dimensions.HEIGHT, Runner.classes.CANVAS);
        this.canvasCtx = this.canvas.getContext("2d");
        this.canvasCtx.fillStyle = "#f7f7f7";
        this.canvasCtx.fill();
        Runner.updateCanvasScaling(this.canvas);

        this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions, this.config.GAP_COEFFICIENT);
        this.distanceMeter = new DistanceMeter(this.canvas, this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);
        this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

        this.outerContainerEl.appendChild(this.containerEl);
        this.startListening();
        this.update();

        window.addEventListener(Runner.events.RESIZE, this.debounceResize.bind(this));
        const e = window.matchMedia("(prefers-color-scheme: dark)");
        this.isDarkMode = e && e.matches;
        e.addListener(t => { this.isDarkMode = t.matches });
    },

    debounceResize() {
        if (!this.resizeTimerId_) {
            this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250);
        }
    },

    adjustDimensions() {
        clearInterval(this.resizeTimerId_);
        this.resizeTimerId_ = null;
        const t = window.getComputedStyle(this.outerContainerEl);
        const e = Number(t.paddingLeft.substr(0, t.paddingLeft.length - 2));

        this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - 2 * e;

        if (this.canvas) {
            this.canvas.width = this.dimensions.WIDTH;
            this.canvas.height = this.dimensions.HEIGHT;
            Runner.updateCanvasScaling(this.canvas);
            this.distanceMeter.calcXPos(this.dimensions.WIDTH);
            this.clearCanvas();
            this.horizon.update(0, 0, true);
            this.tRex.update(0);

            if (this.playing || this.crashed || this.paused) {
                this.containerEl.style.width = this.dimensions.WIDTH + "px";
                this.containerEl.style.height = this.dimensions.HEIGHT + "px";
                this.distanceMeter.update(0, Math.ceil(this.distanceRan));
                this.stop();
            } else {
                this.tRex.draw(0, 0);
            }

            if (this.crashed && this.gameOverPanel) {
                this.gameOverPanel.draw();
            }
        }
    },

    playIntro() {
        if (!this.activated && !this.crashed) {
            this.playingIntro = true;
            this.tRex.playingIntro = true;
            const t = "@-webkit-keyframes intro { from { width:" + Trex.config.WIDTH + "px }to { width: " + this.dimensions.WIDTH + "px }}";
            document.styleSheets[0].insertRule(t, 0);
            this.containerEl.addEventListener(Runner.events.ANIM_END, this.startGame.bind(this));
            this.containerEl.style.webkitAnimation = "intro .4s ease-out 1 both";
            this.containerEl.style.width = this.dimensions.WIDTH + "px";
            this.playing = true;
            this.activated = true;
        } else if (this.crashed) {
            this.restart();
        }
    },

    startGame() {
        this.runningTime = 0;
        this.playingIntro = false;
        this.tRex.playingIntro = false;
        this.containerEl.style.webkitAnimation = "";
        this.playCount++;
        document.addEventListener(Runner.events.VISIBILITY, this.onVisibilityChange.bind(this));
        window.addEventListener(Runner.events.BLUR, this.onVisibilityChange.bind(this));
        window.addEventListener(Runner.events.FOCUS, this.onVisibilityChange.bind(this));
    },

    clearCanvas() {
        this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
    },

    update() {
        this.updatePending = false;
        const t = getTimeStamp();
        let e = t - (this.time || t);
        this.time = t;

        if (this.playing) {
            this.clearCanvas();
            if (this.tRex.jumping) this.tRex.updateJump(e);

            this.runningTime += e;
            const i = this.runningTime > this.config.CLEAR_TIME;

            if (this.tRex.jumpCount === 1 && !this.playingIntro) this.playIntro();
            if (this.playingIntro) {
                this.horizon.update(0, this.currentSpeed, i);
            } else {
                const delta = this.activated ? e : 0;
                this.horizon.update(delta, this.currentSpeed, i, this.isDarkMode ^ this.inverted);
            }

            const s = i && this.horizon.obstacles.length > 0 && checkForCollision(this.horizon.obstacles[0], this.tRex);

            if (!s) {
                this.distanceRan += this.currentSpeed * e / this.msPerFrame;
                if (this.currentSpeed < this.config.MAX_SPEED) {
                    this.currentSpeed += this.config.ACCELERATION;
                }
                const n = this.distanceMeter.update(e, Math.ceil(this.distanceRan));
                if (n) this.playSound(this.soundFx.SCORE);

                if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
                    this.invertTimer = 0;
                    this.invertTrigger = false;
                    this.invert(false);
                } else if (this.invertTimer > 0) {
                    this.invertTimer += e;
                } else {
                    const dist = this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));
                    if (dist > 0) {
                        this.invertTrigger = !(dist % this.config.INVERT_DISTANCE);
                        if (this.invertTrigger && this.invertTimer === 0) {
                            this.invertTimer += e;
                            this.invert(false);
                        }
                    }
                }
            } else {
                this.gameOver();
            }
        }
        if (this.playing || (!this.activated && this.tRex.blinkCount < this.config.MAX_BLINK_COUNT)) {
            this.tRex.update(e);
            this.scheduleNextUpdate();
        }
    },

    handleEvent(t) {
        return function(e, i) {
            switch (e) {
                case i.KEYDOWN:
                case i.TOUCHSTART:
                case i.CLICK:
                    this.onKeyDown(t);
                    break;
                case i.KEYUP:
                case i.TOUCHEND:
                    this.onKeyUp(t);
                    break;
            }
        }.bind(this)(t.type, Runner.events)
    },

    startListening() {
        document.addEventListener(Runner.events.KEYDOWN, this);
        document.addEventListener(Runner.events.KEYUP, this);
        if (IS_MOBILE) {
            this.outerContainerEl.addEventListener(Runner.events.TOUCHSTART, this);
            document.addEventListener(Runner.events.TOUCHEND, this);
        } else {
            this.outerContainerEl.addEventListener(Runner.events.CLICK, this);
        }
    },

    stopListening() {
        document.removeEventListener(Runner.events.KEYDOWN, this);
        document.removeEventListener(Runner.events.KEYUP, this);
        if (IS_MOBILE) {
            this.outerContainerEl.removeEventListener(Runner.events.TOUCHSTART, this);
            document.removeEventListener(Runner.events.TOUCHEND, this);
        } else {
            this.outerContainerEl.removeEventListener(Runner.events.CLICK, this);
        }
    },

    onKeyDown(t) {
        if (!this.crashed && !this.paused) {
            if (Runner.keycodes.JUMP[t.keyCode] || t.type === 'touchstart' || t.type === 'click') {
                t.preventDefault();
                if (!this.playing) {
                    this.loadSounds();
                    this.playing = true;
                    this.update();
                }
                if (!this.tRex.jumping && !this.tRex.ducking) {
                    this.playSound(this.soundFx.BUTTON_PRESS);
                    this.tRex.startJump(this.currentSpeed);
                }
            } else if (this.playing && Runner.keycodes.DUCK[t.keyCode]) {
                t.preventDefault();
                if (this.tRex.jumping) {
                    this.tRex.setSpeedDrop();
                } else if (!this.tRex.ducking) {
                    this.tRex.setDuck(true);
                }
            }
        } else if (this.crashed && (Runner.keycodes.RESTART[t.keyCode] || t.type === 'click' || t.type === 'touchstart')) {
            this.restart();
        }
    },

    onKeyUp(t) {
        const e = String(t.keyCode);
        const i = Runner.keycodes.JUMP[e] || t.type === 'touchend';

        if (this.isRunning() && i) {
            this.tRex.endJump();
        } else if (Runner.keycodes.DUCK[e]) {
            this.tRex.speedDrop = false;
            this.tRex.setDuck(false);
        }
    },

    isLeftClickOnCanvas(t) {
        return t.button != null && t.button < 2 && t.type === 'click' && t.target === this.canvas;
    },

    scheduleNextUpdate() {
        if (!this.updatePending) {
            this.updatePending = true;
            this.raqId = requestAnimationFrame(this.update.bind(this));
        }
    },

    isRunning() {
        return !!this.raqId;
    },

    gameOver() {
        this.playSound(this.soundFx.HIT);
        vibrate(200);
        this.stop();
        this.crashed = true;
        this.distanceMeter.achievement = false;
        this.tRex.update(100, Trex.status.CRASHED);

        if (!this.gameOverPanel) {
            this.gameOverPanel = new GameOverPanel(this.canvas, this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART, this.dimensions);
        } else {
            this.gameOverPanel.draw();
        }

        if (this.distanceRan > this.highestScore) {
            this.highestScore = Math.ceil(this.distanceRan);
            this.distanceMeter.setHighScore(this.highestScore);
        }
        this.time = getTimeStamp();
    },

    stop() {
        this.playing = false;
        this.paused = true;
        cancelAnimationFrame(this.raqId);
        this.raqId = 0;
    },

    play() {
        if (!this.crashed) {
            this.playing = true;
            this.paused = false;
            this.tRex.reset();
            this.update();
        }
    },

    restart() {
        if (!this.raqId) {
            this.playCount++;
            this.runningTime = 0;
            this.playing = true;
            this.paused = false;
            this.crashed = false;
            this.distanceRan = 0;
            this.setSpeed(this.config.SPEED);
            this.time = getTimeStamp();
            this.clearCanvas();
            this.distanceMeter.reset();
            this.horizon.reset();
            this.tRex.reset();
            this.playSound(this.soundFx.BUTTON_PRESS);
            this.invert(true);
            this.update();
        }
    },

    onVisibilityChange(t) {
        if (document.hidden || document.webkitHidden || t.type === 'blur' || document.visibilityState !== 'visible') {
            this.stop();
        } else if (!this.crashed) {
            this.play();
        }
    },

    playSound(t) {
        if (t && this.audioContext) {
            const e = this.audioContext.createBufferSource();
            e.buffer = t;
            e.connect(this.audioContext.destination);
            e.start(0);
        }
    },

    invert(t) {
        const e = document.querySelector('html');
        if (t) {
            e.classList.remove(Runner.classes.INVERTED);
            this.invertTimer = 0;
            this.inverted = false;
        } else {
            this.inverted = e.classList.toggle(Runner.classes.INVERTED, this.invertTrigger);
        }
    },
};

Runner.updateCanvasScaling = function(t) {
    const s = t.getContext("2d");
    const n = Math.floor(window.devicePixelRatio) || 1;
    const a = Math.floor(s.webkitBackingStorePixelRatio) || 1;
    const o = n / a;
    if (n !== a) {
        const h = t.width;
        const r = t.height;
        t.width = h * o;
        t.height = r * o;
        t.style.width = h + "px";
        t.style.height = r + "px";
        s.scale(o, o);
        return true;
    }
    return false;
};

GameOverPanel.prototype = {
    draw() {
        const t = GameOverPanel.dimensions;
        let e = t.TEXT_WIDTH, i = t.TEXT_HEIGHT, s = t.RESTART_WIDTH, n = t.RESTART_HEIGHT;

        // Position for "Game Over" text
        const gameOverX = this.canvasDimensions.WIDTH / 2 - t.TEXT_WIDTH / 2;
        const gameOverY = this.canvasDimensions.HEIGHT / 3;

        // Position for Restart button
        const restartX = this.canvasDimensions.WIDTH / 2 - t.RESTART_WIDTH / 2;
        const restartY = gameOverY + t.TEXT_HEIGHT + 20;


        if (IS_HIDPI) { e *= 2; i *= 2; s *= 2; n *= 2; }

        this.canvasCtx.save();
        this.canvasCtx.drawImage(Runner.imageSprite, this.textImgPos.x, this.textImgPos.y, e, i, gameOverX, gameOverY, t.TEXT_WIDTH, t.TEXT_HEIGHT);
        this.canvasCtx.drawImage(Runner.imageSprite, this.restartImgPos.x, this.restartImgPos.y, s, n, restartX, restartY, t.RESTART_WIDTH, t.RESTART_HEIGHT);
        this.canvasCtx.restore();
    }
};

Obstacle.prototype = {
    init(t) {
        this.cloneCollisionBoxes();
        if (this.size > 1 && this.typeConfig.multipleSpeed > t) this.size = 1;

        this.width = this.typeConfig.width * this.size;
        this.yPos = Array.isArray(this.typeConfig.yPos) ? this.typeConfig.yPos[getRandomNum(0, this.typeConfig.yPos.length - 1)] : this.typeConfig.yPos;
        this.draw();

        if (this.size > 1) {
            this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width - this.collisionBoxes[2].width;
            this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
        }
        this.gap = this.getGap(this.gapCoefficient, t);
    },
    draw() {
        let t = this.typeConfig.width, e = this.typeConfig.height;
        if (IS_HIDPI) { t *= 2; e *= 2; }
        let i = (t * this.size) * (0.5 * (this.size - 1)) + this.spritePos.x;
        if (this.currentFrame > 0) i += t * this.currentFrame;

        this.canvasCtx.drawImage(Runner.imageSprite, i, this.spritePos.y, t * this.size, e, this.xPos, this.yPos, this.typeConfig.width * this.size, this.typeConfig.height);
    },
    update(t, e) {
        if (!this.remove) {
            this.xPos -= Math.floor((e * FPS / 1e3) * t);
            if (this.typeConfig.numFrames) {
                this.timer += t;
                if (this.timer >= this.typeConfig.frameRate) {
                    this.currentFrame = this.currentFrame === this.typeConfig.numFrames - 1 ? 0 : this.currentFrame + 1;
                    this.timer = 0;
                }
            }
            this.draw();
            if (!this.isVisible()) this.remove = true;
        }
    },
    getGap(t, e) {
        const i = Math.round(this.width * e + this.typeConfig.minGap * t);
        return getRandomNum(i, Math.round(i * 1.5));
    },
    isVisible() {
        return this.xPos + this.width > 0;
    },
    cloneCollisionBoxes() {
        const t = this.typeConfig.collisionBoxes;
        this.collisionBoxes = [];
        for (let i = 0; i < t.length; i++) {
            this.collisionBoxes.push(new CollisionBox(t[i].x, t[i].y, t[i].width, t[i].height));
        }
    }
};

Trex.prototype = {
    init() {
        this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT - Runner.config.BOTTOM_PAD;
        this.yPos = this.groundYPos;
        this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
        this.draw(0, 0);
        this.update(0, Trex.status.WAITING);
    },
    update(t, e) {
        this.timer += t;
        if (e) {
            this.status = e;
            this.currentFrame = 0;
            this.msPerFrame = Trex.animFrames[e].msPerFrame;
            this.currentAnimFrames = Trex.animFrames[e].frames;
            if (e === Trex.status.WAITING) {
                this.animStartTime = getTimeStamp();
                this.setBlinkDelay();
            }
        }
        if (this.playingIntro && this.xPos < this.config.START_X_POS) {
            this.xPos += Math.round((this.config.START_X_POS / this.config.INTRO_DURATION) * t);
        }
        if (this.status === Trex.status.WAITING) {
            this.blink(getTimeStamp());
        } else {
            this.draw(this.currentAnimFrames[this.currentFrame], 0);
        }
        if (this.timer >= this.msPerFrame) {
            this.currentFrame = this.currentFrame === this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
            this.timer = 0;
        }
        if (this.speedDrop && this.yPos === this.groundYPos) {
            this.speedDrop = false;
            this.setDuck(true);
        }
    },
    draw(t, e) {
        let i = t, s = e, n = this.ducking ? this.config.WIDTH_DUCK : this.config.WIDTH, a = this.config.HEIGHT;
        if (IS_HIDPI) { i *= 2; s *= 2; n *= 2; a *= 2; }
        i += this.spritePos.x;
        s += this.spritePos.y;
        this.canvasCtx.drawImage(Runner.imageSprite, i, s, n, a, this.xPos, this.yPos, this.ducking ? this.config.WIDTH_DUCK : this.config.WIDTH, this.config.HEIGHT);
    },
    setBlinkDelay() {
        this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
    },
    blink(t) {
        if (t - this.animStartTime >= this.blinkDelay) {
            this.draw(this.currentAnimFrames[this.currentFrame], 0);
            if (this.currentFrame === 1) {
                this.setBlinkDelay();
                this.animStartTime = t;
                this.blinkCount++;
            }
        }
    },
    startJump(t) {
        if (!this.jumping) {
            this.update(0, Trex.status.JUMPING);
            this.jumpVelocity = this.config.INITIAL_JUMP_VELOCITY - (t / 10);
            this.jumping = true;
            this.reachedMinHeight = false;
            this.speedDrop = false;
        }
    },
    endJump() {
        if (this.reachedMinHeight && this.jumpVelocity < this.config.DROP_VELOCITY) {
            this.jumpVelocity = this.config.DROP_VELOCITY;
        }
    },
    updateJump(t) {
        const e = Trex.animFrames[this.status].msPerFrame;
        const i = t / e;
        if (this.speedDrop) {
            this.yPos += Math.round(this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * i);
        } else {
            this.yPos += Math.round(this.jumpVelocity * i);
        }
        this.jumpVelocity += this.config.GRAVITY * i;
        if (this.yPos < this.minJumpHeight || this.speedDrop) {
            this.reachedMinHeight = true;
        }
        if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
            this.endJump();
        }
        if (this.yPos > this.groundYPos) {
            this.reset();
            this.jumpCount++;
        }
    },
    setSpeedDrop() {
        this.speedDrop = true;
        this.jumpVelocity = 1;
    },
    setDuck(t) {
        if (t && this.status !== Trex.status.DUCKING) {
            this.update(0, Trex.status.DUCKING);
            this.ducking = true;
        } else if (this.status === Trex.status.DUCKING) {
            this.update(0, Trex.status.RUNNING);
            this.ducking = false;
        }
    },
    reset() {
        this.yPos = this.groundYPos;
        this.jumpVelocity = 0;
        this.jumping = false;
        this.ducking = false;
        this.update(0, Trex.status.RUNNING);
        this.speedDrop = false;
        this.jumpCount = 0;
    }
};

DistanceMeter.dimensions = {
    WIDTH: 10,
    HEIGHT: 13,
    DEST_WIDTH: 11
};

DistanceMeter.prototype = {
    init(t) {
        let e = "";
        this.calcXPos(t);
        this.maxScore = this.maxScoreUnits;
        for (let i = 0; i < this.maxScoreUnits; i++) {
            this.draw(i, 0);
            this.defaultString += "0";
            e += "9";
        }
        this.maxScore = parseInt(e, 10);
    },
    calcXPos(t) {
        this.x = t - (DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1));
    },
    draw(t, e) {
        let i = DistanceMeter.dimensions.WIDTH, s = DistanceMeter.dimensions.HEIGHT, n = DistanceMeter.dimensions.WIDTH * e;
        if (IS_HIDPI) { i *= 2; s *= 2; n *= 2; }
        n += this.spritePos.x;
        const a = this.spritePos.y;
        this.canvasCtx.drawImage(this.image, n, a, i, s, this.x + t * DistanceMeter.dimensions.DEST_WIDTH, this.y, DistanceMeter.dimensions.WIDTH, DistanceMeter.dimensions.HEIGHT);
    },
    getActualDistance(t) {
        return t ? Math.round(t * this.config.COEFFICIENT) : 0;
    },
    update(t, e) {
        let i = true, s = false;
        if (this.achievement) {
            if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                this.flashTimer += t;
                if (this.flashTimer < this.config.FLASH_DURATION) {
                    i = false;
                } else if (this.flashTimer > (this.config.FLASH_DURATION * 2)) {
                    this.flashTimer = 0;
                    this.flashIterations++;
                }
            } else {
                this.achievement = false;
                this.flashIterations = 0;
                this.flashTimer = 0;
            }
        }
        e = this.getActualDistance(e);
        if (e > 0) {
            if (e % this.config.ACHIEVEMENT_DISTANCE === 0) {
                this.achievement = true;
                this.flashTimer = 0;
                s = true;
            }
            const o = (this.defaultString + e).substr(-this.maxScoreUnits);
            this.digits = o.split("");
        } else {
            this.digits = this.defaultString.split("");
        }
        if (i) {
            for (let d = this.digits.length - 1; d >= 0; d--) {
                this.draw(d, parseInt(this.digits[d], 10));
            }
        }
        this.drawHighScore();
        return s;
    },
    drawHighScore() {
        this.canvasCtx.save();
        this.canvasCtx.globalAlpha = 0.8;
        for (let t = this.highScore.length - 1; t >= 0; t--) {
            this.draw(t, parseInt(this.highScore[t], 10), true);
        }
        this.canvasCtx.restore();
    },
    setHighScore(t) {
        t = this.getActualDistance(t);
        const e = (this.defaultString + t).substr(-this.maxScoreUnits);
        this.highScore = e.split("");
    },
    reset() {
        this.update(0, 0);
        this.achievement = false;
    }
};

Cloud.prototype = {
    init() {
        this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL, Cloud.config.MIN_SKY_LEVEL);
        this.draw();
    },
    draw() {
        this.canvasCtx.save();
        let t = Cloud.config.WIDTH, e = Cloud.config.HEIGHT;
        if (IS_HIDPI) { t *= 2; e *= 2; }
        this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x, this.spritePos.y, t, e, this.xPos, this.yPos, Cloud.config.WIDTH, Cloud.config.HEIGHT);
        this.canvasCtx.restore();
    },
    update(t) {
        if (!this.remove) {
            this.xPos -= Math.ceil(t);
            this.draw();
            if (!this.isVisible()) this.remove = true;
        }
    },
    isVisible() {
        return this.xPos + Cloud.config.WIDTH > 0;
    }
};

HorizonLine.prototype = {
    setSourceDimensions() {
        for (const t in this.dimensions) {
            this.sourceDimensions[t] = IS_HIDPI ? 2 * this.dimensions[t] : this.dimensions[t];
        }
        this.xPos = [0, this.dimensions.WIDTH];
        this.yPos = this.dimensions.YPOS;
    },
    getRandomType() {
        return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
    },
    draw() {
        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[0], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT);
        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[1], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT);
    },
    updateXPos(t, e) {
        const i = t;
        const s = i === 0 ? 1 : 0;
        this.xPos[i] -= e;
        this.xPos[s] = this.xPos[i] + this.dimensions.WIDTH;
        if (this.xPos[i] <= -this.dimensions.WIDTH) {
            this.xPos[i] += this.dimensions.WIDTH * 2;
            this.xPos[s] = this.xPos[i] - this.dimensions.WIDTH;
            this.sourceXPos[i] = this.getRandomType() + this.spritePos.x;
        }
    },
    update(t, e) {
        const i = Math.floor(e * (FPS / 1e3) * t);
        if (this.xPos[0] <= 0) {
            this.updateXPos(0, i);
        } else {
            this.updateXPos(1, i);
        }
        this.draw();
    },
    reset() {
        this.xPos[0] = 0;
        this.xPos[1] = this.dimensions.WIDTH;
    }
};

Horizon.prototype = {
    init() {
        this.addCloud();
        this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
    },
    update(t, e, i, s) {
        this.horizonLine.update(t, e);
        this.updateClouds(t, this.cloudSpeed);
        if (i) this.updateObstacles(t, e);
    },
    updateClouds(t, e) {
        const i = e * t / 1e3;
        if (this.clouds.length < this.config.MAX_CLOUDS && Math.random() < this.cloudFrequency) {
            this.addCloud();
        }
        this.clouds = this.clouds.filter(c => {
            c.update(i);
            return !c.remove;
        });
    },
    updateObstacles(t, e) {
        const i = this.obstacles.slice(0);
        for (let s = 0; s < this.obstacles.length; s++) {
            const o = this.obstacles[s];
            o.update(t, e);
            if (o.remove) i.shift();
        }
        this.obstacles = i;
        if (this.obstacles.length > 0) {
            const lastObstacle = this.obstacles[this.obstacles.length - 1];
            if (lastObstacle && !lastObstacle.followingObstacleCreated && lastObstacle.isVisible() && (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) < this.dimensions.WIDTH) {
                this.addNewObstacle(e);
                lastObstacle.followingObstacleCreated = true;
            }
        } else {
            this.addNewObstacle(e);
        }
    },
    addNewObstacle(t) {
        const e = getRandomNum(0, Obstacle.types.length - 1);
        const i = Obstacle.types[e];
        if (this.duplicateObstacleCheck(i.type) || t < i.minSpeed) {
            this.addNewObstacle(t);
        } else {
            // FIX: Changed this.spriteDef to this.spritePos
            this.obstacles.push(new Obstacle(this.canvasCtx, i, this.spritePos[i.type], this.dimensions, this.gapCoefficient, t));
            this.obstacleHistory.unshift(i.type);
            if (this.obstacleHistory.length > 1) this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION);
        }
    },
    duplicateObstacleCheck(t) {
        return this.obstacleHistory.indexOf(t) > -1;
    },
    reset() {
        this.obstacles = [];
        this.horizonLine.reset();
        this.clouds = [];
        this.addCloud();
    },
    addCloud() {
        // FIX: Changed this.spriteDef to this.spritePos
        this.clouds.push(new Cloud(this.canvas, this.spritePos.CLOUD, this.dimensions.WIDTH));
    }
};

// --- Sprite Definitions ---
Runner.spriteDefinition = {
    LDPI: {
        CACTUS_LARGE: { x: 332, y: 2 },
        CACTUS_SMALL: { x: 228, y: 2 },
        CLOUD: { x: 86, y: 2 },
        HORIZON: { x: 2, y: 54 },
        PTERODACTYL: { x: 134, y: 2 },
        RESTART: { x: 2, y: 2 },
        TEXT_SPRITE: { x: 484, y: 2 },
        TREX: { x: 848, y: 2 },
    },
    HDPI: {
        CACTUS_LARGE: { x: 652, y: 2 },
        CACTUS_SMALL: { x: 446, y: 2 },
        CLOUD: { x: 166, y: 2 },
        HORIZON: { x: 2, y: 104 },
        PTERODACTYL: { x: 260, y: 2 },
        RESTART: { x: 2, y: 2 },
        TEXT_SPRITE: { x: 954, y: 2 },
        TREX: { x: 1678, y: 2 },
    }
};

Obstacle.types = [{
    type: "CACTUS_SMALL",
    width: 17,
    height: 35,
    yPos: 105,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 7, 5, 27), new CollisionBox(4, 0, 6, 34), new CollisionBox(10, 4, 7, 14)]
}, {
    type: "CACTUS_LARGE",
    width: 25,
    height: 50,
    yPos: 90,
    multipleSpeed: 7,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 12, 7, 38), new CollisionBox(8, 0, 7, 49), new CollisionBox(13, 10, 10, 38)]
}, {
    type: "PTERODACTYL",
    width: 46,
    height: 40,
    yPos: [100, 75, 50],
    multipleSpeed: 999,
    minSpeed: 8.5,
    minGap: 150,
    collisionBoxes: [new CollisionBox(15, 15, 16, 5), new CollisionBox(18, 21, 24, 6), new CollisionBox(2, 14, 4, 3), new CollisionBox(6, 10, 4, 7), new CollisionBox(10, 8, 6, 9)],
    numFrames: 2,
    frameRate: 1e3 / 6,
    speedOffset: .8
}];

// --- Main ---
function onDocumentLoad() {
    new Runner('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
