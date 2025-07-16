/**
 * Copyright 2021 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

// Anotated for better readability and understanding by AR Moghimi.

(function () {
    'use strict';

    // --- Constants and Globals ---
    const FPS = 60;
    const IS_HIDPI = window.devicePixelRatio > 1;
    const IS_IOS = /CriOS/.test(window.navigator.userAgent);
    const IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;
    const RESOURCE_POSTFIX = 'offline-resources-';

    // --- Utility Functions ---
    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }

    function createCanvas(container, width, height, opt_className) {
        const canvas = document.createElement('canvas');
        canvas.className = opt_className ? Runner.classes.CANVAS + ' ' + opt_className : Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);
        return canvas;
    }

    function getTimeStamp() {
        return IS_IOS ? new Date().getTime() : performance.now();
    }

    // --- CollisionBox Class ---
    function CollisionBox(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    function checkForCollision(obstacle, tRex) {
        const obstacleBox = new CollisionBox(
            obstacle.xPos + 1,
            obstacle.yPos + 1,
            obstacle.typeConfig.width * obstacle.size - 2,
            obstacle.typeConfig.height - 2
        );

        const tRexBox = new CollisionBox(
            tRex.xPos + 1,
            tRex.yPos + 1,
            tRex.config.WIDTH - 2,
            tRex.config.HEIGHT - 2
        );

        if (boxCompare(obstacleBox, tRexBox)) {
            const collisionBoxes = obstacle.collisionBoxes;
            const tRexCollisionBoxes = tRex.ducking ?
                Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING;

            for (let i = 0; i < tRexCollisionBoxes.length; i++) {
                for (let j = 0; j < collisionBoxes.length; j++) {
                    const adjTrexBox = createAdjustedCollisionBox(tRexCollisionBoxes[i], tRexBox);
                    const adjObstacleBox = createAdjustedCollisionBox(collisionBoxes[j], obstacleBox);

                    if (boxCompare(adjTrexBox, adjObstacleBox)) {
                        return [adjTrexBox, adjObstacleBox];
                    }
                }
            }
        }
        return false;
    }

    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(
            box.x + adjustment.x,
            box.y + adjustment.y,
            box.width,
            box.height
        );
    }

    function boxCompare(tRexBox, obstacleBox) {
        const obstacleX = obstacleBox.x;
        const obstacleY = obstacleBox.y;

        return (
            tRexBox.x < obstacleX + obstacleBox.width &&
            tRexBox.x + tRexBox.width > obstacleX &&
            tRexBox.y < obstacleBox.y + obstacleBox.height &&
            tRexBox.height + tRexBox.y > obstacleY
        );
    }


    // --- Runner Class (The main game controller) ---
    function Runner(outerContainerId) {
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
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
        this.msPerFrame = 1000 / FPS;
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
        this.mainMessage = document.getElementById('main-message');
        this.icon = document.querySelector('.icon-offline');

        this.loadImages();
    }
    window['Runner'] = Runner;


    // --- Game Configurations ---
    Runner.config = {
        ACCELERATION: 0.001,
        BG_CLOUD_SPEED: 0.2,
        BOTTOM_PAD: 10,
        CLEAR_TIME: 3000,
        CLOUD_FREQUENCY: 0.5,
        GAMEOVER_CLEAR_TIME: 750,
        GAP_COEFFICIENT: 0.6,
        INVERT_FADE_DURATION: 12000,
        INVERT_DISTANCE: 700,
        MAX_BLINK_COUNT: 3,
        MAX_CLOUDS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        MAX_OBSTACLE_DUPLICATION: 2,
        MAX_SPEED: 13,
        SPEED: 6,
        SPEED_DROP_COEFFICIENT: 3,
    };

    Runner.defaultDimensions = { WIDTH: 600, HEIGHT: 150 };

    Runner.classes = {
        ARCADE_MODE: 'arcade-mode',
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        INVERTED: 'inverted',
        TOUCH_CONTROLLER: 'controller',
    };

    Runner.sounds = {
        BUTTON_PRESS: 'offline-sound-press',
        HIT: 'offline-sound-hit',
        SCORE: 'offline-sound-reached',
    };

    Runner.keycodes = {
        JUMP: { '38': 1, '32': 1 }, // Up, Spacebar
        DUCK: { '40': 1 }, // Down
        RESTART: { '13': 1 }, // Enter
    };

    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        POINTERDOWN: 'pointerdown',
        POINTERUP: 'pointerup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load',
    };


    // --- Runner Prototype Methods ---
    Runner.prototype = {
        loadImages() {
            const imagePrefix = IS_HIDPI ? '2x' : '1x';
            this.spriteDef = Runner.spriteDefinition[IS_HIDPI ? 'HDPI' : 'LDPI'];
            Runner.imageSprite = document.getElementById(RESOURCE_POSTFIX + imagePrefix);

            if (Runner.imageSprite.complete) {
                this.init();
            } else {
                Runner.imageSprite.addEventListener(Runner.events.LOAD, this.init.bind(this));
            }
        },

        async loadSounds() {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if it's suspended (required by modern browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            for (const soundName in Runner.sounds) {
                const soundId = Runner.sounds[soundName];
                const soundElement = document.getElementById(soundId);
                if (soundElement) {
                    try {
                        const response = await fetch(soundElement.src);
                        const arrayBuffer = await response.arrayBuffer();
                        this.audioContext.decodeAudioData(arrayBuffer, (buffer) => {
                            this.soundFx[soundId] = buffer;
                        });
                    } catch (error) {
                        console.error(`Failed to load sound: ${soundId}`, error);
                    }
                }
            }
        },

        setSpeed(speed) {
            this.currentSpeed = speed || this.currentSpeed;
        },

        init() {
            this.containerEl = this.outerContainerEl.querySelector('.runner-container');
            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH, this.dimensions.HEIGHT);
            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();
            Runner.updateCanvasScaling(this.canvas);

            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions, this.config.GAP_COEFFICIENT);
            this.distanceMeter = new DistanceMeter(this.canvas, this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

            this.startListening();
            this.update();

            window.addEventListener(Runner.events.RESIZE, this.debounceResize.bind(this));
        },

        debounceResize() {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250);
            }
        },

        adjustDimensions() {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;

            const boxStyles = window.getComputedStyle(this.outerContainerEl);
            const padding = Number(boxStyles.paddingLeft.replace('px', ''));

            this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;

            if (this.canvas) {
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;
                Runner.updateCanvasScaling(this.canvas);
                this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                this.clearCanvas();
                this.horizon.update(0, 0, true);
                this.tRex.update(0);

                if (this.playing || this.crashed || this.paused) {
                    this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                    this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                    this.distanceMeter.update(0, Math.ceil(this.distanceRan));
                    this.stop();
                } else {
                    this.tRex.draw(0, 0);
                }

                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw();
                }
            }
        },

        playIntro() {
            if (!this.activated && !this.crashed) {
                this.playingIntro = true;
                this.tRex.playingIntro = true;
                this.mainMessage.style.opacity = '0';
                this.icon.style.opacity = '0';
                this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both';
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';

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
            this.playCount++;
            window.addEventListener(Runner.events.VISIBILITY, this.onVisibilityChange.bind(this));
        },
        
        clearCanvas() {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        update() {
            this.updatePending = false;
            const now = getTimeStamp();
            let deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.clearCanvas();

                if (this.tRex.jumping) {
                    this.tRex.updateJump(deltaTime);
                }

                this.runningTime += deltaTime;
                const hasObstacles = this.runningTime > this.config.CLEAR_TIME;

                if (this.tRex.jumpCount === 1 && !this.playingIntro) {
                    this.playIntro();
                }
                
                if (this.playingIntro) {
                    this.horizon.update(0, this.currentSpeed, hasObstacles);
                } else {
                    deltaTime = !this.activated ? 0 : deltaTime;
                    this.horizon.update(deltaTime, this.currentSpeed, hasObstacles, this.inverted);
                }

                const collision = hasObstacles && checkForCollision(this.horizon.obstacles[0], this.tRex);
                
                if (!collision) {
                    this.distanceRan += (this.currentSpeed * deltaTime) / this.msPerFrame;
                    if (this.currentSpeed < this.config.MAX_SPEED) {
                        this.currentSpeed += this.config.ACCELERATION;
                    }
                    const scoreHasChanged = this.distanceMeter.update(deltaTime, Math.ceil(this.distanceRan));
                    if (scoreHasChanged) {
                        this.playSound(this.soundFx.SCORE);
                    }
                } else {
                    this.gameOver();
                }
            }

            if (this.playing || (!this.activated && this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)) {
                this.tRex.update(deltaTime);
                this.scheduleNextUpdate();
            }
        },

        handleEvent(e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.POINTERDOWN:
                        this.onKeyDown(e);
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.POINTERUP:
                        this.onKeyUp(e);
                        break;
                }
            }.bind(this))(e.type, Runner.events);
        },

        startListening() {
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);
            this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
            this.containerEl.addEventListener(Runner.events.POINTERDOWN, this);
            document.addEventListener(Runner.events.TOUCHEND, this);
        },
        
        onKeyDown(e) {
            if (this.crashed || this.paused) {
                 if(e.keyCode === Runner.keycodes.JUMP['32'] || e.type === 'touchstart' || e.type === 'pointerdown'){
                    this.restart();
                 }
                return;
            }

            if (Runner.keycodes.JUMP[e.keyCode] || e.type === 'touchstart' || e.type === 'pointerdown') {
                e.preventDefault();
                if (!this.playing) {
                    this.loadSounds();
                    this.activated = true;
                    this.playing = true;
                }
                if (!this.tRex.jumping && !this.tRex.ducking) {
                    this.playSound(this.soundFx.BUTTON_PRESS);
                    this.tRex.startJump(this.currentSpeed);
                }
            } else if (this.playing && Runner.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();
                if (this.tRex.jumping) {
                    this.tRex.setSpeedDrop();
                } else if (!this.tRex.ducking) {
                    this.tRex.setDuck(true);
                }
            }
        },

        onKeyUp(e) {
            const keyCode = String(e.keyCode);
            const isjumpKey = Runner.keycodes.JUMP[keyCode] || e.type === 'touchend' || e.type === 'pointerup';

            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump();
            } else if (Runner.keycodes.DUCK[keyCode]) {
                this.tRex.speedDrop = false;
                this.tRex.setDuck(false);
            }
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
            }
            this.gameOverPanel.draw();
            
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
                this.tRex.update(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
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
                this.update();
            }
        },

        onVisibilityChange(e) {
            if (document.hidden || document.webkitHidden || e.type === 'blur' || document.visibilityState !== 'visible') {
                this.stop();
            } else if (!this.crashed) {
                this.play();
            }
        },

        playSound(soundBuffer) {
            if (soundBuffer && this.audioContext) {
                const source = this.audioContext.createBufferSource();
                source.buffer = soundBuffer;
                source.connect(this.audioContext.destination);
                source.start(0);
            }
        },
    };
    
    // --- Canvas Scaling ---
    Runner.updateCanvasScaling = function(canvas) {
        const context = canvas.getContext('2d');
        const devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        const backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        const ratio = devicePixelRatio / backingStoreRatio;

        if (devicePixelRatio !== backingStoreRatio) {
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;
            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';
            context.scale(ratio, ratio);
            return true;
        }
        return false;
    };


    // --- Trex Class ---
    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.blinkDelay = 0;
        this.blinkCount = 0;
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;
        this.status = Trex.status.WAITING;
        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.init();
    }

    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
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
        WIDTH_DUCK: 59,
    };

    Trex.collisionBoxes = {
        RUNNING: [
            new CollisionBox(22, 0, 17, 16), new CollisionBox(1, 18, 30, 9),
            new CollisionBox(10, 35, 14, 8), new CollisionBox(1, 24, 29, 5),
            new CollisionBox(5, 30, 21, 4), new CollisionBox(9, 34, 15, 4),
        ],
        DUCKING: [ new CollisionBox(1, 18, 55, 25) ],
    };

    Trex.status = {
        CRASHED: 'CRASHED',
        DUCKING: 'DUCKING',
        JUMPING: 'JUMPING',
        RUNNING: 'RUNNING',
        WAITING: 'WAITING',
    };

    Trex.animFrames = {
        WAITING: { frames: [44, 0], msPerFrame: 1000 / 3 },
        RUNNING: { frames: [88, 132], msPerFrame: 1000 / 12 },
        CRASHED: { frames: [220], msPerFrame: 1000 / 60 },
        JUMPING: { frames: [0], msPerFrame: 1000 / 60 },
        DUCKING: { frames: [262, 321], msPerFrame: 1000 / 8 },
    };

    Trex.prototype = {
        init() {
            this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT - Runner.config.BOTTOM_PAD;
            this.yPos = this.groundYPos;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;
            this.draw(0, 0);
            this.update(0, Trex.status.WAITING);
        },
        update(deltaTime, opt_status) {
            this.timer += deltaTime;
            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;
                if (opt_status === Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                    this.setBlinkDelay();
                }
            }
            if (this.playingIntro && this.xPos < this.config.START_X_POS) {
                this.xPos += Math.round((this.config.START_X_POS / this.config.INTRO_DURATION) * deltaTime);
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
        draw(x, y) {
            let sX = x; let sY = y;
            let sWidth = this.ducking ? this.config.WIDTH_DUCK : this.config.WIDTH;
            let sHeight = this.config.HEIGHT;
            if (IS_HIDPI) {
                sX *= 2; sY *= 2; sWidth *= 2; sHeight *= 2;
            }
            sX += this.spritePos.x;
            sY += this.spritePos.y;
            this.canvasCtx.drawImage(
                Runner.imageSprite, sX, sY, sWidth, sHeight,
                this.xPos, this.yPos, this.config.WIDTH, this.config.HEIGHT
            );
        },
        setBlinkDelay() {
            this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
        },
        blink(time) {
            if (time - this.animStartTime >= this.blinkDelay) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
                if (this.currentFrame === 1) {
                    this.setBlinkDelay();
                    this.animStartTime = time;
                    this.blinkCount++;
                }
            }
        },
        startJump(speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                this.jumpVelocity = this.config.INITIAL_JUMP_VELOCITY - (speed / 10);
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
        updateJump(deltaTime) {
            const msPerFrame = Trex.animFrames[this.status].msPerFrame;
            const framesElapsed = deltaTime / msPerFrame;
            if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity * this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            }
            this.jumpVelocity += this.config.GRAVITY * framesElapsed;
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
        setDuck(isDucking) {
            if (isDucking && this.status !== Trex.status.DUCKING) {
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
        },
    };
    Trex.BLINK_TIMING = 7000;


    // --- Obstacle Class ---
    function Obstacle(canvasCtx, type, spritePos, dimensions, gapCoefficient, speed) {
        this.canvasCtx = canvasCtx;
        this.spritePos = spritePos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = dimensions.WIDTH;
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;
        this.currentFrame = 0;
        this.timer = 0;
        this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
        this.init(speed);
    }
    Obstacle.MAX_OBSTACLE_LENGTH = 3;
    Obstacle.prototype = {
        init: function (speed) {
            this.cloneCollisionBoxes();
            if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
                this.size = 1;
            }
            this.width = this.typeConfig.width * this.size;
            this.xPos = this.dimensions.WIDTH - this.width;
            if (Array.isArray(this.typeConfig.yPos)) {
                this.yPos = this.typeConfig.yPos[getRandomNum(0, this.typeConfig.yPos.length - 1)];
            } else {
                this.yPos = this.typeConfig.yPos;
            }
            this.draw();
            if (this.size > 1) {
                this.collisionBoxes[1].x = this.width - this.collisionBoxes[1].width - this.collisionBoxes[2].width;
                this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
            }
            if (this.typeConfig.speedOffset) {
                this.speedOffset = Math.random() > 0.5 ? this.typeConfig.speedOffset : -this.typeConfig.speedOffset;
            }
            this.gap = this.getGap(this.gapCoefficient, speed);
        },
        draw: function () {
            let sourceWidth = this.typeConfig.width;
            let sourceHeight = this.typeConfig.height;
            if (IS_HIDPI) {
                sourceWidth *= 2;
                sourceHeight *= 2;
            }
            let sourceX = sourceWidth * this.size * (0.5 * (this.size - 1)) + this.spritePos.x;
            if (this.currentFrame > 0) {
                sourceX += sourceWidth * this.currentFrame;
            }
            this.canvasCtx.drawImage(Runner.imageSprite, sourceX, this.spritePos.y, sourceWidth * this.size, sourceHeight, this.xPos, this.yPos, this.typeConfig.width * this.size, this.typeConfig.height);
        },
        update: function (deltaTime, speed) {
            if (!this.remove) {
                if (this.typeConfig.speedOffset) {
                    speed += this.speedOffset;
                }
                this.xPos -= Math.floor(speed * FPS / 1000 * deltaTime);
                if (this.typeConfig.numFrames) {
                    this.timer += deltaTime;
                    if (this.timer >= this.typeConfig.frameRate) {
                        this.currentFrame = this.currentFrame === this.typeConfig.numFrames - 1 ? 0 : this.currentFrame + 1;
                        this.timer = 0;
                    }
                }
                this.draw();
                if (!this.isVisible()) {
                    this.remove = true;
                }
            }
        },
        getGap: function (gapCoefficient, speed) {
            const minGap = Math.round(this.width * speed + this.typeConfig.minGap * gapCoefficient);
            const maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
            return getRandomNum(minGap, maxGap);
        },
        isVisible: function () {
            return this.xPos + this.width > 0;
        },
        cloneCollisionBoxes: function () {
            const collisionBoxes = this.typeConfig.collisionBoxes;
            this.collisionBoxes = [];
            for (let i = 0; i < collisionBoxes.length; i++) {
                this.collisionBoxes.push(new CollisionBox(collisionBoxes[i].x, collisionBoxes[i].y, collisionBoxes[i].width, collisionBoxes[i].height));
            }
        },
    };
    Obstacle.MAX_GAP_COEFFICIENT = 1.5;

    
    // --- Horizon Class ---
    function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonLine = null;
        this.clouds = [];
        this.cloudFrequency = this.config.CLOUD_FREQUENCY;
        this.spritePos = spritePos;
        this.init();
    }
    Horizon.config = {
        BG_CLOUD_SPEED: 0.2,
        BUMPY_THRESHOLD: 0.3,
        CLOUD_FREQUENCY: 0.5,
        HORIZON_HEIGHT: 16,
        MAX_CLOUDS: 6,
    };
    Horizon.prototype = {
        init: function () {
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
            this.addCloud();
        },
        update: function (deltaTime, currentSpeed, hasObstacles) {
            this.runningTime += deltaTime;
            this.horizonLine.update(deltaTime, currentSpeed);
            this.updateClouds(deltaTime, currentSpeed);
            if (hasObstacles) {
                this.updateObstacles(deltaTime, currentSpeed);
            }
        },
        updateClouds: function (deltaTime) {
            const speed = this.config.BG_CLOUD_SPEED / 1000 * deltaTime * FPS;
            if (this.clouds.length < this.config.MAX_CLOUDS && Math.random() < this.cloudFrequency) {
                this.addCloud();
            }
            this.clouds = this.clouds.filter(cloud => {
                cloud.update(speed);
                return !cloud.remove;
            });
        },
        updateObstacles: function (deltaTime, currentSpeed) {
            const updatedObstacles = this.obstacles.slice(0);
            for (let i = 0; i < this.obstacles.length; i++) {
                const obstacle = this.obstacles[i];
                obstacle.update(deltaTime, currentSpeed);
                if (obstacle.remove) {
                    updatedObstacles.shift();
                }
            }
            this.obstacles = updatedObstacles;
            if (this.obstacles.length > 0) {
                const lastObstacle = this.obstacles[this.obstacles.length - 1];
                if (lastObstacle && !lastObstacle.followingObstacleCreated && lastObstacle.isVisible() && (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) < this.dimensions.WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {
                this.addNewObstacle(currentSpeed);
            }
        },
        addNewObstacle: function (currentSpeed) {
            const obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
            const obstacleType = Obstacle.types[obstacleTypeIndex];

            if (this.duplicateObstacleCheck(obstacleType.type) || currentSpeed < obstacleType.minSpeed) {
                this.addNewObstacle(currentSpeed);
            } else {
                this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType, this.spritePos[obstacleType.type], this.dimensions, this.gapCoefficient, currentSpeed));
                this.obstacleHistory.unshift(obstacleType.type);
                if (this.obstacleHistory.length > Runner.config.MAX_OBSTACLE_DUPLICATION) {
                    this.obstacleHistory.pop();
                }
            }
        },
        duplicateObstacleCheck(nextObstacleType) {
            let duplicateCount = 0;
            for (let i = 0; i < this.obstacleHistory.length; i++) {
                if (this.obstacleHistory[i] === nextObstacleType) {
                    duplicateCount++;
                }
            }
            return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION;
        },
        reset: function () {
            this.obstacles = [];
            this.horizonLine.reset();
        },
        addCloud: function () {
            this.clouds.push(new Cloud(this.canvas, this.spritePos.CLOUD, this.dimensions.WIDTH));
        },
    };
    
    // --- Other Classes ---
    function Cloud(canvas, spritePos, containerWidth) { this.canvas = canvas; this.canvasCtx = this.canvas.getContext('2d'); this.spritePos = spritePos; this.containerWidth = containerWidth; this.xPos = containerWidth; this.yPos = 0; this.remove = false; this.gap = getRandomNum(Cloud.config.MIN_CLOUD_GAP, Cloud.config.MAX_CLOUD_GAP); this.init(); }
    Cloud.config = { HEIGHT: 14, MAX_CLOUD_GAP: 400, MAX_SKY_LEVEL: 30, MIN_CLOUD_GAP: 100, MIN_SKY_LEVEL: 71, WIDTH: 46, };
    Cloud.prototype = { init: function () { this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL, Cloud.config.MIN_SKY_LEVEL); this.draw(); }, draw: function () { this.canvasCtx.save(); let sourceWidth = Cloud.config.WIDTH, sourceHeight = Cloud.config.HEIGHT; if (IS_HIDPI) { sourceWidth *= 2; sourceHeight *= 2; } this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x, this.spritePos.y, sourceWidth, sourceHeight, this.xPos, this.yPos, Cloud.config.WIDTH, Cloud.config.HEIGHT); this.canvasCtx.restore(); }, update: function (speed) { if (!this.remove) { this.xPos -= Math.ceil(speed); this.draw(); if (!this.isVisible()) { this.remove = true; } } }, isVisible: function () { return this.xPos + Cloud.config.WIDTH > 0; } };

    function HorizonLine(canvas, spritePos) { this.spritePos = spritePos; this.canvas = canvas; this.canvasCtx = this.canvas.getContext('2d'); this.sourceDimensions = {}; this.dimensions = HorizonLine.dimensions; this.sourceXPos = [this.spritePos.x, this.spritePos.x + this.dimensions.WIDTH]; this.xPos = []; this.yPos = 0; this.bumpThreshold = 0.5; this.setSourceDimensions(); this.draw(); }
    HorizonLine.dimensions = { WIDTH: 600, HEIGHT: 12, YPOS: 127, };
    HorizonLine.prototype = { setSourceDimensions: function () { for (const dimension in this.dimensions) { if (IS_HIDPI) { if (dimension !== 'YPOS') { this.sourceDimensions[dimension] = this.dimensions[dimension] * 2; } } else { this.sourceDimensions[dimension] = this.dimensions[dimension]; } } this.xPos = [0, this.dimensions.WIDTH]; this.yPos = this.dimensions.YPOS; }, getRandomType: function () { return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0; }, draw: function () { this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[0], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT); this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1], this.spritePos.y, this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT, this.xPos[1], this.yPos, this.dimensions.WIDTH, this.dimensions.HEIGHT); }, update: function (deltaTime, speed) { const increment = Math.floor(speed * (FPS / 1000) * deltaTime); if (this.xPos[0] <= -this.dimensions.WIDTH) { this.xPos[0] += this.dimensions.WIDTH * 2; this.xPos[1] = this.xPos[0] - this.dimensions.WIDTH; this.sourceXPos[0] = this.getRandomType() + this.spritePos.x; } this.xPos[0] -= increment; this.xPos[1] = this.xPos[0] + this.dimensions.WIDTH; this.draw(); }, reset: function () { this.xPos[0] = 0; this.xPos[1] = this.dimensions.WIDTH; } };
    
    function GameOverPanel(canvas, textSprite, restartSprite, dimensions) { this.canvas = canvas; this.canvasCtx = canvas.getContext('2d'); this.canvasDimensions = dimensions; this.textImgPos = textSprite; this.restartImgPos = restartSprite; this.draw(); }
    GameOverPanel.dimensions = { TEXT_WIDTH: 191, TEXT_HEIGHT: 11, RESTART_WIDTH: 36, RESTART_HEIGHT: 32 };
    GameOverPanel.prototype = { updateDimensions: function (width) { this.canvasDimensions.WIDTH = width; this.draw(); }, draw: function () { const dimensions = GameOverPanel.dimensions; let textSourceWidth = dimensions.TEXT_WIDTH; let textSourceHeight = dimensions.TEXT_HEIGHT; let restartSourceWidth = dimensions.RESTART_WIDTH; let restartSourceHeight = dimensions.RESTART_HEIGHT; if (IS_HIDPI) { textSourceWidth *= 2; textSourceHeight *= 2; restartSourceWidth *= 2; restartSourceHeight *= 2; } const textX = this.canvasDimensions.WIDTH / 2 - dimensions.TEXT_WIDTH / 2; const textY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3); const restartX = this.canvasDimensions.WIDTH / 2 - dimensions.RESTART_WIDTH / 2; const restartY = textY + dimensions.TEXT_HEIGHT + 20; this.canvasCtx.save(); this.canvasCtx.drawImage(Runner.imageSprite, this.textImgPos.x, this.textImgPos.y, textSourceWidth, textSourceHeight, textX, textY, dimensions.TEXT_WIDTH, dimensions.TEXT_HEIGHT); this.canvasCtx.drawImage(Runner.imageSprite, this.restartImgPos.x, this.restartImgPos.y, restartSourceWidth, restartSourceHeight, restartX, restartY, dimensions.RESTART_WIDTH, dimensions.RESTART_HEIGHT); this.canvasCtx.restore(); } };

    function DistanceMeter(canvas, spritePos, canvasWidth) { this.canvas = canvas; this.canvasCtx = canvas.getContext('2d'); this.image = Runner.imageSprite; this.spritePos = spritePos; this.x = 0; this.y = 5; this.currentDistance = 0; this.maxScore = 0; this.highScore = '0'; this.digits = []; this.achievement = false; this.defaultString = ''; this.flashTimer = 0; this.flashIterations = 0; this.config = DistanceMeter.config; this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS; this.init(canvasWidth); }
    DistanceMeter.config = { MAX_DISTANCE_UNITS: 5, ACHIEVEMENT_DISTANCE: 100, COEFFICIENT: 0.025, FLASH_DURATION: 1000 / 4, FLASH_ITERATIONS: 3, };
    DistanceMeter.dimensions = { WIDTH: 10, HEIGHT: 13, DEST_WIDTH: 11, };
    // --- DistanceMeter Class Prototype (FIXED) ---
    DistanceMeter.prototype = {
    init: function (width) {
        let maxScoreStr = '';
        this.calcXPos(width);
        this.maxScore = this.maxScoreUnits;
        for (let i = 0; i < this.maxScoreUnits; i++) {
            this.draw(i, 0);
            this.defaultString += '0';
            maxScoreStr += '9';
        }
        this.highScore = '0'; // FIX: Initialize as a string
        this.maxScore = parseInt(maxScoreStr);
    },

    calcXPos: function (canvasWidth) {
        this.x = canvasWidth - (DistanceMeter.dimensions.DEST_WIDTH * (this.maxScoreUnits + 1));
    },

    draw: function (digitPos, value, opt_highScore) {
        let sourceWidth = DistanceMeter.dimensions.WIDTH;
        let sourceHeight = DistanceMeter.dimensions.HEIGHT;
        let sourceX = DistanceMeter.dimensions.WIDTH * value;

        if (IS_HIDPI) {
            sourceWidth *= 2;
            sourceHeight *= 2;
            sourceX *= 2;
        }

        sourceX += this.spritePos.x;
        const sourceY = this.spritePos.y;

        // Position HIGH SCORE (HI) text correctly
        const targetX = opt_highScore ? this.x - (this.maxScoreUnits * 2.5) : this.x;

        this.canvasCtx.save();
        this.canvasCtx.globalAlpha = .8;
        this.canvasCtx.drawImage(
            this.image,
            sourceX, sourceY,
            sourceWidth, sourceHeight,
            targetX + digitPos * DistanceMeter.dimensions.DEST_WIDTH, this.y,
            DistanceMeter.dimensions.WIDTH, DistanceMeter.dimensions.HEIGHT
        );
        this.canvasCtx.restore();
    },

    getActualDistance: function (distance) {
        return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
    },

    update: function (deltaTime, distance) {
        let paint = true;
        let playSound = false;

        if (this.achievement) {
            if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                this.flashTimer += deltaTime;
                if (this.flashTimer < this.config.FLASH_DURATION) {
                    paint = false;
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

        distance = this.getActualDistance(distance);

        if (distance > 0) {
            if (distance % this.config.ACHIEVEMENT_DISTANCE === 0) {
                this.achievement = true;
                this.flashTimer = 0;
                playSound = true;
            }
            const distanceStr = (this.defaultString + distance).slice(-this.maxScoreUnits);
            this.digits = distanceStr.split('');
        } else {
            this.digits = this.defaultString.split('');
        }

        if (paint) {
            for (let i = this.digits.length - 1; i >= 0; i--) {
                this.draw(i, parseInt(this.digits[i]));
            }
        }

        this.drawHighScore();
        return playSound;
    },

    setHighScore: function (distance) {
        distance = this.getActualDistance(distance);
        const highScoreStr = (this.defaultString + distance).slice(-this.maxScoreUnits);
        // FIX: Replicate original "HI" score prefix by using an array
        this.highScore = ['10', '11', ''].concat(highScoreStr.split(''));
    },

    drawHighScore: function () {
        // FIX: Handle both string and array types for highScore
        // parseInt on an array like ['10', '11', ...] correctly evaluates to a number > 0
        if (parseInt(this.highScore, 10) > 0) {
            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = 0.8;
            for (let i = 0; i < this.highScore.length; i++) {
                this.draw(i, parseInt(this.highScore[i], 10), true);
            }
            this.canvasCtx.restore();
        }
    },
    
    reset: function () {
        this.update(0, 0);
        this.achievement = false;
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
        }
    };
    
    Obstacle.types = [
        { type: 'CACTUS_SMALL', width: 17, height: 35, yPos: 105, multipleSpeed: 4, minGap: 120, minSpeed: 0, collisionBoxes: [new CollisionBox(0, 7, 5, 27), new CollisionBox(4, 0, 6, 34), new CollisionBox(10, 4, 7, 14)] },
        { type: 'CACTUS_LARGE', width: 25, height: 50, yPos: 90, multipleSpeed: 7, minGap: 120, minSpeed: 0, collisionBoxes: [new CollisionBox(0, 12, 7, 38), new CollisionBox(8, 0, 7, 49), new CollisionBox(13, 10, 10, 38)] },
        { type: 'PTERODACTYL', width: 46, height: 40, yPos: [100, 75, 50], multipleSpeed: 999, minSpeed: 8.5, minGap: 150, collisionBoxes: [new CollisionBox(15, 15, 16, 5), new CollisionBox(18, 21, 24, 6), new CollisionBox(2, 14, 4, 3), new CollisionBox(6, 10, 4, 7), new CollisionBox(10, 8, 6, 9)], numFrames: 2, frameRate: 1000/6, speedOffset: .8}
    ];

    // --- Main Execution ---
    new Runner('#main-frame-error');

})();
