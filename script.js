// --- Constants and Globals ---
const HIDDEN_CLASS = "hidden";
let isSubFrame = !1;

if (window.top.location !== window.location || window.portalHost) {
    document.documentElement.setAttribute("subframe", "");
    isSubFrame = !0;
}

const DEFAULT_WIDTH = 600;
const FPS = 60;
const IS_HIDPI = window.devicePixelRatio > 1;
const IS_IOS = /CriOS/.test(window.navigator.userAgent);
const IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;
const RESOURCE_POSTFIX = "offline-resources-";

// --- Class Definitions ---

function Runner(t, e) {
    if (Runner.instance_) return Runner.instance_;
    Runner.instance_ = this;

    this.outerContainerEl = document.querySelector(t);
    this.containerEl = null;
    this.config = e || Runner.config;
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
    Runner.slowDown = false;
    this.obstacles = [];
    this.activated = !1;
    this.playing = !1;
    this.crashed = !1;
    this.paused = !1;
    this.inverted = !1;
    this.invertTimer = 0;
    this.resizeTimerId_ = null;
    this.playCount = 0;
    this.audioContext = null;
    this.soundFx = {};

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
    this.animStartTime = 0;
    this.timer = 0;
    this.msPerFrame = 1e3 / FPS;
    this.config = Trex.config;
    this.status = Trex.status.WAITING;
    this.jumping = !1;
    this.ducking = !1;
    this.jumpVelocity = 0;
    this.reachedMinHeight = !1;
    this.speedDrop = !1;
    this.jumpCount = 0;
    this.jumpspotX = 0;
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
    this.highScore = "0";
    this.digits = [];
    this.achievement = !1;
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
    this.remove = !1;
    this.gap = getRandomNum(Cloud.config.MIN_CLOUD_GAP, Cloud.config.MAX_CLOUD_GAP);
    this.init();
}

function Obstacle(t, e, i, s, n, a) {
    this.canvasCtx = t;
    this.spritePos = i;
    this.typeConfig = e;
    this.gapCoefficient = n;
    this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
    this.dimensions = s;
    this.remove = !1;
    this.xPos = s.WIDTH + (0 || 0);
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
    this.horizonOffsets = [0, 0];
    this.cloudFrequency = this.config.CLOUD_FREQUENCY;
    this.spritePos = e;
    this.nightMode = null;
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
    RESOURCE_TEMPLATE_ID: "audio-resources",
    SPEED: 6,
    SPEED_DROP_COEFFICIENT: 3,
};

Runner.classes = {
    ARCADE_MODE: "arcade-mode",
    CANVAS: "runner-canvas",
    CONTAINER: "runner-container",
    CRASHED: "crashed",
    ICON: "icon-offline",
    INVERTED: "inverted",
    TOUCH_CONTROLLER: "controller"
};

Runner.sounds = {
    BUTTON_PRESS: "offline-sound-press",
    HIT: "offline-sound-hit",
    SCORE: "offline-sound-reached"
};

Runner.keycodes = {
    JUMP: {
        38: 1,
        32: 1
    },
    DUCK: {
        40: 1
    },
    RESTART: {
        13: 1
    }
};

Runner.events = {
    ANIM_END: "webkitAnimationEnd",
    CLICK: "click",
    KEYDOWN: "keydown",
    KEYUP: "keyup",
    RESIZE: "resize",
    TOUCHEND: "touchend",
    TOUCHSTART: "touchstart",
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
    SPRITE_WIDTH: 262,
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

Obstacle.config = {
    MAX_GAP_COEFFICIENT: 1.5,
    MAX_OBSTACLE_LENGTH: 3,
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
    HORIZON_HEIGHT: 16,
    MAX_CLOUDS: 6
};

GameOverPanel.dimensions = {
    TEXT_WIDTH: 191,
    TEXT_HEIGHT: 11,
    RESTART_WIDTH: 36,
    RESTART_HEIGHT: 32
};

// --- Game Logic and Methods ---

Runner.prototype = {
    loadImages() {
        let t = "1x";
        IS_HIDPI && (t = "2x");
        Runner.imageSprite = document.getElementById(RESOURCE_POSTFIX + t);
        this.spriteDef = IS_HIDPI ? Runner.spriteDefinition.HDPI : Runner.spriteDefinition.LDPI;
        Runner.imageSprite.complete ? this.init() : Runner.imageSprite.addEventListener(Runner.events.LOAD, this.init.bind(this));
    },

    async loadSounds() {
        if (!IS_IOS && !this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        if (this.audioContext) {
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
        document.querySelector("." + Runner.classes.ICON).style.visibility = "hidden";
        this.adjustDimensions();
        this.setSpeed();

        this.containerEl = document.createElement("div");
        this.containerEl.className = Runner.classes.CONTAINER;

        this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH, this.dimensions.HEIGHT);
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
        this.isDarkMode = e && e.matches, e.addListener(t => {
            this.isDarkMode = t.matches
        })
    },

    createTouchController() {
        this.touchController = document.createElement("div"), this.touchController.className = Runner.classes.TOUCH_CONTROLLER, this.touchController.addEventListener(Runner.events.TOUCHSTART, this), this.touchController.addEventListener(Runner.events.TOUCHEND, this), this.outerContainerEl.appendChild(this.touchController)
    },

    debounceResize() {
        this.resizeTimerId_ || (this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250))
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
            this.horizon.update(0, 0, !0);
            this.tRex.update(0);
            if (this.playing || this.crashed || this.paused) {
                this.containerEl.style.width = this.dimensions.WIDTH + "px", this.containerEl.style.height = this.dimensions.HEIGHT + "px", this.distanceMeter.update(0, Math.ceil(this.distanceRan)), this.stop()
            } else this.tRex.draw(0, 0);
            this.crashed && this.gameOverPanel && (this.gameOverPanel.updateDimensions(this.dimensions.WIDTH), this.gameOverPanel.draw())
        }
    },

    playIntro() {
        if (!this.activated && !this.crashed) {
            this.playingIntro = !0;
            this.tRex.playingIntro = !0;
            const t = "@-webkit-keyframes intro { from { width:" + Trex.config.WIDTH + "px }to { width: " + this.dimensions.WIDTH + "px }}";
            document.styleSheets[0].insertRule(t, 0);
            this.containerEl.addEventListener(Runner.events.ANIM_END, this.startGame.bind(this));
            this.containerEl.style.webkitAnimation = "intro .4s ease-out 1 both";
            this.containerEl.style.width = this.dimensions.WIDTH + "px";
            this.setPlayStatus(!0);
            this.activated = !0
        } else this.crashed && this.restart()
    },

    startGame() {
        this.runningTime = 0;
        this.playingIntro = !1;
        this.tRex.playingIntro = !1;
        this.containerEl.style.webkitAnimation = "";
        this.playCount++;
        document.addEventListener(Runner.events.VISIBILITY, this.onVisibilityChange.bind(this));
        window.addEventListener(Runner.events.BLUR, this.onVisibilityChange.bind(this));
        window.addEventListener(Runner.events.FOCUS, this.onVisibilityChange.bind(this));
    },

    clearCanvas() {
        this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT)
    },

    update() {
        this.updatePending = !1;
        const t = getTimeStamp();
        let e = t - (this.time || t);
        this.time = t;

        if (this.playing) {
            this.clearCanvas();
            this.tRex.jumping && this.tRex.updateJump(e);
            this.runningTime += e;
            const t = this.runningTime > this.config.CLEAR_TIME;
            1 !== this.tRex.jumpCount || this.playingIntro || this.playIntro();
            this.playingIntro ? this.horizon.update(0, this.currentSpeed, t) : (e = this.activated ? e : 0, this.horizon.update(e, this.currentSpeed, t, this.isDarkMode ^ this.inverted));
            const i = t && checkForCollision(this.horizon.obstacles[0], this.tRex);
            if (i) {
                this.gameOver();
            } else {
                this.distanceRan += this.currentSpeed * e / this.msPerFrame;
                this.currentSpeed < (Runner.normalConfig.MAX_SPEED) && (this.currentSpeed += (Trex.config.ACCELERATION || Runner.normalConfig.ACCELERATION));
            }
            const s = this.distanceMeter.update(e, Math.ceil(this.distanceRan));
            s && this.playSound(this.soundFx.SCORE);
            if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
                this.invertTimer = 0, this.invertTrigger = !1, this.invert()
            } else if (this.invertTimer) {
                this.invertTimer += e;
            } else {
                const t = this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));
                t > 0 && (this.invertTrigger = !(t % (Runner.normalConfig.INVERT_DISTANCE)), this.invertTrigger && 0 === this.invertTimer && (this.invertTimer += e, this.invert()))
            }
        }(this.playing || !this.activated && this.tRex.blinkCount < 3) && (this.tRex.update(e), this.scheduleNextUpdate())
    },

    handleEvent(t) {
        return function(e, i) {
            switch (e) {
                case i.KEYDOWN:
                case i.TOUCHSTART:
                    this.onKeyDown(t);
                    break;
                case i.KEYUP:
                case i.TOUCHEND:
                    this.onKeyUp(t);
            }
        }.bind(this)(t.type, Runner.events)
    },

    startListening() {
        document.addEventListener(Runner.events.KEYDOWN, this);
        document.addEventListener(Runner.events.KEYUP, this);
        if (IS_MOBILE) {
            this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
        } else {
            this.containerEl.addEventListener(Runner.events.CLICK, this);
        }
    },

    stopListening() {
        document.removeEventListener(Runner.events.KEYDOWN, this);
        document.removeEventListener(Runner.events.KEYUP, this);
        if (IS_MOBILE) {
            this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
        } else {
            this.containerEl.removeEventListener(Runner.events.CLICK, this);
        }
    },

    onKeyDown(t) {
        if (IS_MOBILE && this.playing && t.preventDefault();
        !this.crashed && !this.paused) {
            if (Runner.keycodes.JUMP[t.keyCode] || t.type === Runner.events.TOUCHSTART) {
                if (t.preventDefault(), !this.playing) {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    this.loadSounds();
                    this.setPlayStatus(!0);
                    this.update();
                }
                if (!this.tRex.jumping && !this.tRex.ducking) {
                    this.playSound(this.soundFx.BUTTON_PRESS), this.tRex.startJump(this.currentSpeed);
                }
            } else if (this.playing && Runner.keycodes.DUCK[t.keyCode]) {
                t.preventDefault(), this.tRex.jumping ? this.tRex.setSpeedDrop() : this.tRex.jumping || this.tRex.ducking || this.tRex.setDuck(!0);
            }
        }
    },

    onKeyUp(t) {
        const e = String(t.keyCode);
        const i = Runner.keycodes.JUMP[e] || t.type === Runner.events.TOUCHEND;
        if (this.isRunning() && i) {
            this.tRex.endJump();
        } else if (Runner.keycodes.DUCK[e]) {
            this.tRex.speedDrop = !1;
            this.tRex.setDuck(!1);
        } else if (this.crashed) {
            const i = getTimeStamp() - this.time;
            (Runner.keycodes.RESTART[e] || this.isLeftClickOnCanvas(t) || i >= this.config.GAMEOVER_CLEAR_TIME && Runner.keycodes.JUMP[e]) && this.restart();
        } else if (this.paused && i) {
            this.tRex.reset();
            this.play();
        }
    },

    isLeftClickOnCanvas: (t) => t.button < 2 && t.target === this.canvas,

    scheduleNextUpdate() {
        this.updatePending || (this.updatePending = !0, this.raqId = requestAnimationFrame(this.update.bind(this)))
    },

    isRunning() {
        return !!this.raqId
    },

    gameOver() {
        this.playSound(this.soundFx.HIT);
        vibrate(200);
        this.stop();
        this.crashed = !0;
        this.distanceMeter.achievement = !1;
        this.tRex.update(100, Trex.status.CRASHED);
        this.gameOverPanel || (this.gameOverPanel = new GameOverPanel(this.canvas, this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART, this.dimensions));
        this.distanceRan > this.highestScore && (this.highestScore = Math.ceil(this.distanceRan), this.distanceMeter.setHighScore(this.highestScore));
        this.time = getTimeStamp();
    },

    stop() {
        this.setPlayStatus(!1);
        this.paused = !0;
        cancelAnimationFrame(this.raqId);
        this.raqId = 0;
    },

    play() {
        this.crashed || (this.setPlayStatus(!0), this.paused = !1, this.tRex.update(0, Trex.status.RUNNING), this.time = getTimeStamp(), this.update())
    },

    restart() {
        this.raqId || (this.playCount++, this.runningTime = 0, this.setPlayStatus(!0), this.paused = !1, this.crashed = !1, this.distanceRan = 0, this.setSpeed(this.config.SPEED), this.time = getTimeStamp(), this.clearCanvas(), this.distanceMeter.reset(), this.horizon.reset(), this.tRex.reset(), this.playSound(this.soundFx.BUTTON_PRESS), this.invert(!0), this.update())
    },

    setPlayStatus(t) {
        this.playing = t
    },

    invert() {
        document.firstElementChild.classList.toggle(Runner.classes.INVERTED, this.invertTrigger)
    },
};

Runner.updateCanvasScaling = function(t, e, i) {
    const s = t.getContext("2d");
    const n = Math.floor(window.devicePixelRatio) || 1;
    const a = Math.floor(s.webkitBackingStorePixelRatio) || 1;
    const o = n / a;
    if (n !== a) {
        const n = e || t.width;
        const a = i || t.height;
        return t.width = n * o, t.height = a * o, t.style.width = n + "px", t.style.height = a + "px", s.scale(o, o), !0
    }
    return 1 === n && (t.style.width = t.width + "px", t.style.height = t.height + "px"), !1
};

GameOverPanel.prototype = {
    updateDimensions(t, e) {
        this.canvasDimensions.WIDTH = t, e && (this.canvasDimensions.HEIGHT = e)
    },
    draw() {
        const t = GameOverPanel.dimensions;
        let e = t.TEXT_WIDTH,
            i = t.TEXT_HEIGHT,
            s = t.RESTART_WIDTH,
            n = t.RESTART_HEIGHT;
        const a = this.canvasDimensions.WIDTH / 2 - e / 2,
            o = this.canvasDimensions.HEIGHT / 2 - i / 2,
            h = this.canvasDimensions.WIDTH / 2 - s / 2,
            r = this.canvasDimensions.HEIGHT / 2 - n / 2 + 20;

        IS_HIDPI && (e *= 2, i *= 2, s *= 2, n *= 2);

        this.canvasCtx.drawImage(Runner.imageSprite, this.textImgPos.x, this.textImgPos.y, e, i, a, o, t.TEXT_WIDTH, t.TEXT_HEIGHT);
        this.canvasCtx.drawImage(Runner.imageSprite, this.restartImgPos.x, this.restartImgPos.y, s, n, h, r, t.RESTART_WIDTH, t.RESTART_HEIGHT);
    }
};

Obstacle.prototype = {
    init(t) {
        this.cloneCollisionBoxes();
        this.size > 1 && this.typeConfig.multipleSpeed > t && (this.size = 1);
        this.width = this.typeConfig.width * this.size;
        Array.isArray(this.typeConfig.yPos) ? this.yPos = this.typeConfig.yPos[getRandomNum(0, this.typeConfig.yPos.length - 1)] : this.yPos = this.typeConfig.yPos;
        this.draw();
        this.size > 1 && (this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width - this.collisionBoxes[2].width, this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width);
        this.gap = this.getGap(this.gapCoefficient, t);
    },
    draw() {
        let t = this.typeConfig.width,
            e = this.typeConfig.height;
        IS_HIDPI && (t *= 2, e *= 2);
        let i = t * this.size * (.5 * (this.size - 1)) + this.spritePos.x;
        this.currentFrame > 0 && (i += t * this.currentFrame);
        this.canvasCtx.drawImage(Runner.imageSprite, i, this.spritePos.y, t * this.size, e, this.xPos, this.yPos, this.typeConfig.width * this.size, this.typeConfig.height);
    },
    update(t, e) {
        if (!this.remove) {
            this.xPos -= Math.floor(e * FPS / 1e3 * t);
            if (this.typeConfig.numFrames) {
                this.timer += t;
                if (this.timer >= this.typeConfig.frameRate) {
                    this.currentFrame = this.currentFrame == this.typeConfig.numFrames - 1 ? 0 : this.currentFrame + 1;
                    this.timer = 0;
                }
            }
            this.draw();
            this.isVisible() || (this.remove = !0);
        }
    },
    getGap(t, e) {
        const i = Math.round(this.width * e + this.typeConfig.minGap * t);
        return getRandomNum(i, Math.round(i * Obstacle.config.MAX_GAP_COEFFICIENT))
    },
    isVisible() {
        return this.xPos + this.width > 0
    },
    cloneCollisionBoxes() {
        const t = this.typeConfig.collisionBoxes;
        for (let e = t.length - 1; e >= 0; e--) {
            this.collisionBoxes[e] = new CollisionBox(t[e].x, t[e].y, t[e].width, t[e].height)
        }
    }
};

Trex.prototype = {
    init() {
        this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT - Runner.config.BOTTOM_PAD;
        this.yPos = this.groundYPos;
        this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
        this.draw(0, 0);
        this.update(0, Trex.status.WAITING)
    },
    update(t, e) {
        this.timer += t;
        e && (this.status = e, this.currentFrame = 0, this.msPerFrame = Trex.animFrames[e].msPerFrame, this.currentAnimFrames = Trex.animFrames[e].frames, e === Trex.status.WAITING && (this.animStartTime = getTimeStamp(), this.setBlinkDelay()));
        this.playingIntro && this.xPos < this.config.START_X_POS && (this.xPos += Math.round(this.config.START_X_POS / this.config.INTRO_DURATION * t));
        this.status === Trex.status.WAITING ? this.blink(getTimeStamp()) : this.draw(this.currentAnimFrames[this.currentFrame], 0);
        this.timer >= this.msPerFrame && (this.currentFrame = this.currentFrame == this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1, this.timer = 0);
        this.speedDrop && this.yPos == this.groundYPos && (this.speedDrop = !1, this.setDuck(!0))
    },
    draw(t, e) {
        let i = t,
            s = e,
            n = this.ducking && this.status != Trex.status.CRASHED ? this.config.WIDTH_DUCK : this.config.WIDTH,
            a = this.config.HEIGHT;

        IS_HIDPI && (i *= 2, s *= 2, n *= 2, a *= 2);
        i += this.spritePos.x;
        s += this.spritePos.y;

        this.ducking && this.status != Trex.status.CRASHED ? this.canvasCtx.drawImage(Runner.imageSprite, i, s, n, a, this.xPos, this.yPos, this.config.WIDTH_DUCK, this.config.HEIGHT) : (this.ducking && this.status == Trex.status.CRASHED && this.xPos++, this.canvasCtx.drawImage(Runner.imageSprite, i, s, n, a, this.xPos, this.yPos, this.config.WIDTH, this.config.HEIGHT));
    },
    setBlinkDelay() {
        this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
    },
    blink(t) {
        t - this.animStartTime >= this.blinkDelay && (this.draw(this.currentAnimFrames[this.currentFrame], 0), 1 == this.currentFrame && (this.setBlinkDelay(), this.animStartTime = t))
    },
    startJump(t) {
        this.jumping || (this.update(0, Trex.status.JUMPING), this.jumpVelocity = this.config.INITIAL_JUMP_VELOCITY - t / 10, this.jumping = !0, this.reachedMinHeight = !1, this.speedDrop = !1)
    },
    endJump() {
        this.reachedMinHeight && this.jumpVelocity < this.config.DROP_VELOCITY && (this.jumpVelocity = this.config.DROP_VELOCITY)
    },
    updateJump(t) {
        const e = t / this.msPerFrame;
        this.speedDrop ? this.yPos += Math.round(this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * e) : this.yPos += Math.round(this.jumpVelocity * e);
        this.jumpVelocity += this.config.GRAVITY * e;
        (this.yPos < this.minJumpHeight || this.speedDrop) && (this.reachedMinHeight = !0);
        (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) && this.endJump();
        this.yPos > this.groundYPos && (this.reset(), this.jumpCount++)
    },
    setSpeedDrop() {
        this.speedDrop = !0, this.jumpVelocity = 1
    },
    setDuck(t) {
        t && this.status != Trex.status.DUCKING ? (this.update(0, Trex.status.DUCKING), this.ducking = !0) : this.status == Trex.status.DUCKING && (this.update(0, Trex.status.RUNNING), this.ducking = !1)
    },
    reset() {
        this.yPos = this.groundYPos;
        this.jumpVelocity = 0;
        this.jumping = !1;
        this.ducking = !1;
        this.update(0, Trex.status.WAITING);
        this.midair = !1;
        this.speedDrop = !1;
        this.jumpCount = 0;
    }
};

DistanceMeter.prototype = {
    init(t) {
        let e = "";
        this.calcXPos(t);
        this.maxScore = this.maxScoreUnits;
        for (let t = 0; t < this.maxScoreUnits; t++) this.draw(t, 0), this.defaultString += "0", e += "9";
        this.maxScore = parseInt(e)
    },
    calcXPos(t) {
        this.x = t - DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1)
    },
    draw(t, e) {
        let i = DistanceMeter.dimensions.WIDTH,
            s = DistanceMeter.dimensions.HEIGHT,
            n = DistanceMeter.dimensions.WIDTH * e;

        IS_HIDPI && (i *= 2, s *= 2, n *= 2);

        this.canvasCtx.drawImage(this.image, n, 0, i, s, this.x + t * DistanceMeter.dimensions.DEST_WIDTH, this.y, DistanceMeter.dimensions.WIDTH, DistanceMeter.dimensions.HEIGHT);
    },
    getActualDistance(t) {
        return t ? Math.round(t * this.config.COEFFICIENT) : 0
    },
    update(t, e) {
        let i = !0,
            s = !1;
        this.achievement ? this.flashIterations <= this.config.FLASH_ITERATIONS ? (this.flashTimer += t, this.flashTimer < this.config.FLASH_DURATION ? i = !1 : this.flashTimer > 2 * this.config.FLASH_DURATION && (this.flashTimer = 0, this.flashIterations++)) : (this.achievement = !1, this.flashIterations = 0, this.flashTimer = 0) : ((e = this.getActualDistance(e)) > this.maxScore && this.maxScoreUnits == this.config.MAX_DISTANCE_UNITS && (this.maxScoreUnits++, this.maxScore = parseInt(this.maxScore + "9")), this.distance = 0);

        if (e > 0) {
            e % this.config.ACHIEVEMENT_DISTANCE == 0 && (this.achievement = !0, this.flashTimer = 0, s = !0);
            const t = (this.defaultString + e).substr(-this.maxScoreUnits);
            this.digits = t.split("");
        } else {
            this.digits = this.defaultString.split("");
        }

        if (i) {
            for (let t = this.digits.length - 1; t >= 0; t--) this.draw(t, parseInt(this.digits[t]));
        }

        this.drawHighScore();
        return s;
    },
    drawHighScore() {
        this.canvasCtx.save();
        this.canvasCtx.globalAlpha = .8;
        for (let t = this.highScore.length - 1; t >= 0; t--) this.draw(t, parseInt(this.highScore[t]), !0);
        this.canvasCtx.restore();
    },
    setHighScore(t) {
        t = this.getActualDistance(t);
        const e = (this.defaultString + t).substr(-this.maxScoreUnits);
        this.highScore = e.split("");
    },
    reset() {
        this.update(0, 0), this.achievement = !1
    }
};

Cloud.prototype = {
    init() {
        this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL, Cloud.config.MIN_SKY_LEVEL), this.draw()
    },
    draw() {
        this.canvasCtx.save();
        let t = Cloud.config.WIDTH,
            e = Cloud.config.HEIGHT;
        IS_HIDPI && (t *= 2, e *= 2);
        this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x, this.spritePos.y, t, e, this.xPos, this.yPos, Cloud.config.WIDTH, Cloud.config.HEIGHT);
        this.canvasCtx.restore();
    },
    update(t) {
        this.remove || (this.xPos -= Math.ceil(t), this.draw(), this.isVisible() || (this.remove = !0))
    },
    isVisible() {
        return this.xPos + Cloud.config.WIDTH > 0
    }
};

HorizonLine.prototype = {
    setSourceDimensions() {
        for (const t in HorizonLine.dimensions) this.sourceDimensions[t] = IS_HIDPI ? 2 * HorizonLine.dimensions[t] : HorizonLine.dimensions[t];
        this.xPos = [0, HorizonLine.dimensions.WIDTH], this.yPos = HorizonLine.dimensions.YPOS
    },
    getRandomType() {
        return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0
    },
    draw() {
        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[0], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT);
        this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[1], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT)
    },
    updateXPos(t, e) {
        const i = t,
            s = 0 == t ? 1 : 0;
        this.xPos[i] -= e;
        this.xPos[s] = this.xPos[i] + this.dimensions.WIDTH;
        this.xPos[i] <= -this.dimensions.WIDTH && (this.xPos[i] += 2 * this.dimensions.WIDTH, this.xPos[s] = this.xPos[i] - this.dimensions.WIDTH, this.sourceXPos[i] = this.getRandomType() + this.spritePos.x)
    },
    update(t, e) {
        const i = Math.floor(e * (FPS / 1e3) * t);
        this.xPos[0] <= 0 ? this.updateXPos(0, i) : this.updateXPos(1, i);
        this.draw();
    },
    reset() {
        this.xPos[0] = 0, this.xPos[1] = HorizonLine.dimensions.WIDTH
    }
};

Horizon.prototype = {
    init() {
        this.addCloud(), this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON)
    },
    update(t, e, i, s) {
        this.horizonLine.update(t, e), this.updateClouds(t, this.cloudSpeed), i && this.updateObstacles(t, e)
    },
    updateClouds(t, e) {
        const i = e / 1e3 * t;
        this.clouds.length < this.config.MAX_CLOUDS && Math.random() < this.cloudFrequency && this.addCloud();
        this.clouds = this.clouds.filter(t => (t.update(i), !t.remove))
    },
    updateObstacles(t, e) {
        const i = this.obstacles.slice(0);
        for (let s = 0; s < this.obstacles.length; s++) this.obstacles[s].update(t, e), this.obstacles[s].remove && i.shift();
        this.obstacles = i;
        this.obstacles.length > 0 && this.obstacles[this.obstacles.length - 1].isVisible() && this.obstacles[this.obstacles.length - 1].xPos + this.obstacles[this.obstacles.length - 1].width + this.obstacles[this.obstacles.length - 1].gap < this.dimensions.WIDTH && this.addNewObstacle(e)
    },
    addNewObstacle(t) {
        const e = getRandomNum(0, Obstacle.types.length - 1),
            i = Obstacle.types[e];
        (this.duplicateObstacleCheck(i.type) || t < i.minSpeed) ? this.addNewObstacle(t) : (this.obstacles.push(new Obstacle(this.canvasCtx, i, this.spriteDef, this.dimensions, this.gapCoefficient, t)), this.obstacleHistory.unshift(i.type), this.obstacleHistory.length > 1 && this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION))
    },
    duplicateObstacleCheck: (t) => this.obstacleHistory.indexOf(t) > -1,
    reset() {
        this.obstacles = [], this.horizonLine.reset()
    },
    addCloud() {
        this.clouds.push(new Cloud(this.canvas, this.spriteDef.CLOUD, this.dimensions.WIDTH))
    }
};

const GAME_TYPE = [];
let ObstacleType;

Runner.spriteDefinitionByType = {
    original: {
        LDPI: {
            CACTUS_LARGE: { x: 332, y: 2 },
            CACTUS_SMALL: { x: 228, y: 2 },
            CLOUD: { x: 86, y: 2 },
            HORIZON: { x: 2, y: 54 },
            PTERODACTYL: { x: 134, y: 2 },
            RESTART: { x: 2, y: 68 },
            TEXT_SPRITE: { x: 655, y: 2 },
            TREX: { x: 848, y: 2 },
        },
        HDPI: {
            CACTUS_LARGE: { x: 652, y: 2 },
            CACTUS_SMALL: { x: 446, y: 2 },
            CLOUD: { x: 166, y: 2 },
            HORIZON: { x: 2, y: 104 },
            PTERODACTYL: { x: 260, y: 2 },
            RESTART: { x: 2, y: 130 },
            TEXT_SPRITE: { x: 1294, y: 2 },
            TREX: { x: 1678, y: 2 },
        },
        OBSTACLES: [{
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
            yPosMobile: [100, 50],
            multipleSpeed: 999,
            minSpeed: 8.5,
            minGap: 150,
            collisionBoxes: [new CollisionBox(15, 15, 16, 5), new CollisionBox(18, 21, 24, 6), new CollisionBox(2, 14, 4, 3), new CollisionBox(6, 10, 4, 7), new CollisionBox(10, 8, 6, 9)],
            numFrames: 2,
            frameRate: 1e3 / 6,
            speedOffset: .8
        }],
    }
};

function onDocumentLoad() {
    new Runner('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);
