"use strict";

(function () {
    /*
     * ============================================================
     * MARJONA COSMIC WORLD — CINEMATIC ENGINE
     * ============================================================
     */

    var WORLD_ID = "world";

    var CONFIG = {
        reducedMotion: false,

        introDuration: 6200,

        distantStars: 260,
        midStars: 145,
        nearStars: 65,

        clusters: 9,
        clusterStarsMin: 14,
        clusterStarsMax: 28,

        nebulaCount: 6,
        planets: 7,
        asteroids: 18,
        comets: 4,
        dust: 120,

        eventMinimumDelay: 8000,
        eventMaximumDelay: 18000,

        parallaxDistant: 2,
        parallaxMid: 6,
        parallaxNear: 13
    };

    var worldElement = null;
    var worldLayer = null;
    var scene = null;

    var initialized = false;
    var centerInitialized = false;

    var animationFrame = null;
    var eventTimer = null;
    var resizeTimer = null;

    var introTimers = [];

    var pointerX = 0;
    var pointerY = 0;

    var targetPointerX = 0;
    var targetPointerY = 0;

    var velocityX = 0;
    var velocityY = 0;

    var lastPointerX = 0;
    var lastPointerY = 0;
    var lastPointerTime = 0;

    var quality = "rich";

    var messageIndex = 0;

    var CENTER_MESSAGES = [
        "Ba'zi narsalarni shoshmasdan kashf qilish kerak.",
        "Bu yerda vaqt biroz boshqacha o'tadi.",
        "Har bir kichik nuqtaning o'z hikoyasi bor.",
        "Ba'zi joylarga xarita kerak emas.",
        "Hali ko'rilmagan narsalar ham bor.",
        "Shunchaki biroz qol."
    ];

    var PLANET_TYPES = [
        "planet-rocky",
        "planet-blue",
        "planet-gas",
        "planet-ringed",
        "planet-moonlike",
        "planet-blue",
        "planet-gas"
    ];

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function createElement(tag, className) {
        var element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        return element;
    }

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randomInt(min, max) {
        return Math.floor(random(min, max + 1));
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function pick(array) {
        if (!array || !array.length) {
            return null;
        }

        return array[
            Math.floor(Math.random() * array.length)
        ];
    }

    function setStyles(element, styles) {
        var keys = Object.keys(styles);

        for (var i = 0; i < keys.length; i += 1) {
            element.style[keys[i]] = styles[keys[i]];
        }
    }

    function setPosition(element, x, y) {
        element.style.left = x + "%";
        element.style.top = y + "%";
    }

    function addClass(element, className) {
        if (element) {
            element.classList.add(className);
        }
    }

    function removeClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    }

    function removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    function clearTimer(timer) {
        if (timer) {
            window.clearTimeout(timer);
        }
    }

    function reducedMotion() {
        try {
            return window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;
        } catch (error) {
            return false;
        }
    }

    function detectQuality() {
        var cores = navigator.hardwareConcurrency || 4;
        var memory = navigator.deviceMemory || 4;

        var width = window.innerWidth || 1280;
        var height = window.innerHeight || 720;

        var pixels = width * height;

        if (
            cores <= 2 ||
            memory <= 2 ||
            pixels < 500000
        ) {
            return "light";
        }

        if (
            cores <= 4 ||
            memory <= 4 ||
            pixels < 1000000
        ) {
            return "balanced";
        }

        return "rich";
    }

    function configureQuality() {
        quality = detectQuality();

        if (quality === "light") {
            CONFIG.distantStars = 100;
            CONFIG.midStars = 55;
            CONFIG.nearStars = 24;
            CONFIG.clusters = 4;
            CONFIG.planets = 4;
            CONFIG.asteroids = 7;
            CONFIG.comets = 1;
            CONFIG.dust = 40;
        }

        if (quality === "balanced") {
            CONFIG.distantStars = 180;
            CONFIG.midStars = 95;
            CONFIG.nearStars = 40;
            CONFIG.clusters = 6;
            CONFIG.planets = 5;
            CONFIG.asteroids = 11;
            CONFIG.comets = 2;
            CONFIG.dust = 75;
        }

        if (quality === "rich") {
            CONFIG.distantStars = 280;
            CONFIG.midStars = 150;
            CONFIG.nearStars = 70;
            CONFIG.clusters = 10;
            CONFIG.planets = 7;
            CONFIG.asteroids = 20;
            CONFIG.comets = 4;
            CONFIG.dust = 135;
        }
    }

    function createScene() {
        worldElement = document.getElementById(WORLD_ID);

        if (!worldElement) {
            return false;
        }

        worldLayer = $(".world-layer", worldElement);

        if (!worldLayer) {
            return false;
        }

        var previous = $(".cosmic-scene", worldLayer);

        if (previous) {
            removeElement(previous);
        }

        scene = createElement(
            "div",
            "cosmic-scene"
        );

        scene.setAttribute(
            "aria-hidden",
            "true"
        );

        scene.dataset.quality = quality;

        scene.style.setProperty("--pointer-x", "0");
        scene.style.setProperty("--pointer-y", "0");
        scene.style.setProperty("--pointer-x-strong", "0");
        scene.style.setProperty("--pointer-y-strong", "0");
        scene.style.setProperty("--pointer-speed-x", "0");
        scene.style.setProperty("--pointer-speed-y", "0");

        worldLayer.insertBefore(
            scene,
            worldLayer.firstChild
        );

        return true;
    }

    /*
     * ------------------------------------------------------------
     * STARS
     * ------------------------------------------------------------
     */

    function createStar(type, settings) {
        var star = createElement(
            "span",
            "cosmic-star " + type
        );

        settings = settings || {};

        var size =
            settings.size !== undefined
                ? settings.size
                : random(0.6, 2.2);

        var opacity =
            settings.opacity !== undefined
                ? settings.opacity
                : random(0.3, 0.9);

        var depth =
            settings.depth || 1;

        var x =
            settings.x !== undefined
                ? settings.x
                : random(0, 100);

        var y =
            settings.y !== undefined
                ? settings.y
                : random(0, 100);

        setPosition(star, x, y);

        setStyles(star, {
            width: size + "px",
            height: size + "px",
            opacity: opacity.toFixed(2),
            "--star-depth": depth,
            "--star-parallax": depth + "px",
            "--twinkle-duration": random(3, 9) + "s",
            "--twinkle-delay": random(-9, 0) + "s"
        });

        if (Math.random() < 0.14) {
            addClass(star, "sparkling");
        }

        scene.appendChild(star);
    }

    function createStars() {
        var i;

        for (i = 0; i < CONFIG.distantStars; i += 1) {
            createStar(
                "star-distant",
                {
                    size: random(0.45, 1.25),
                    opacity: random(0.28, 0.72),
                    depth: CONFIG.parallaxDistant
                }
            );
        }

        for (i = 0; i < CONFIG.midStars; i += 1) {
            createStar(
                "star-mid",
                {
                    size: random(0.7, 1.9),
                    opacity: random(0.38, 0.88),
                    depth: CONFIG.parallaxMid
                }
            );
        }

        for (i = 0; i < CONFIG.nearStars; i += 1) {
            createStar(
                "star-near",
                {
                    size: random(1.2, 3.6),
                    opacity: random(0.55, 1),
                    depth: CONFIG.parallaxNear
                }
            );
        }
    }

    /*
     * ------------------------------------------------------------
     * STAR CLUSTERS
     * ------------------------------------------------------------
     */

    function createStarCluster() {
        var cluster = createElement(
            "div",
            "star-cluster"
        );

        setStyles(cluster, {
            left: random(4, 96) + "%",
            top: random(4, 96) + "%",
            "--cluster-drift": random(22, 48) + "s",
            animationDelay: random(-40, 0) + "s"
        });

        var count = randomInt(
            CONFIG.clusterStarsMin,
            CONFIG.clusterStarsMax
        );

        for (var i = 0; i < count; i += 1) {
            var star = createElement(
                "span",
                "cluster-star"
            );

            var angle = random(
                0,
                Math.PI * 2
            );

            var radius =
                Math.sqrt(Math.random()) *
                random(2, 8);

            var x =
                Math.cos(angle) *
                radius;

            var y =
                Math.sin(angle) *
                radius;

            setStyles(star, {
                left:
                    "calc(50% + " +
                    x +
                    "vw)",

                top:
                    "calc(50% + " +
                    y +
                    "vh)",

                width:
                    random(0.5, 2.2) +
                    "px",

                height:
                    random(0.5, 2.2) +
                    "px",

                opacity:
                    random(0.3, 0.95).toFixed(2),

                animationDelay:
                    random(-8, 0) + "s",

                animationDuration:
                    random(4, 10) + "s"
            });

            cluster.appendChild(star);
        }

        scene.appendChild(cluster);
    }

    function createStarClusters() {
        for (
            var i = 0;
            i < CONFIG.clusters;
            i += 1
        ) {
            createStarCluster();
        }
    }

    /*
     * ------------------------------------------------------------
     * NEBULAE
     * ------------------------------------------------------------
     */

    function createNebulae() {
        var types = [
            "nebula-blue",
            "nebula-violet",
            "nebula-cyan",
            "nebula-deep",
            "nebula-magenta",
            "nebula-rose"
        ];

        for (
            var i = 0;
            i < CONFIG.nebulaCount;
            i += 1
        ) {
            var nebula = createElement(
                "div",
                "cosmic-nebula " +
                types[i % types.length]
            );

            setPosition(
                nebula,
                random(3, 97),
                random(3, 97)
            );

            setStyles(nebula, {
                width:
                    random(30, 62) +
                    "vw",

                height:
                    random(28, 56) +
                    "vh",

                "--nebula-duration":
                    random(35, 75) +
                    "s",

                animationDelay:
                    random(-50, 0) +
                    "s"
            });

            scene.appendChild(nebula);
        }
    }

    /*
     * ------------------------------------------------------------
     * GALAXY
     * ------------------------------------------------------------
     */

    function createGalaxy() {
        var galaxy = createElement(
            "div",
            "cosmic-galaxy"
        );

        setPosition(
            galaxy,
            random(65, 84),
            random(20, 46)
        );

        setStyles(galaxy, {
            "--galaxy-width":
                random(34, 48) + "vw",

            "--galaxy-height":
                random(13, 22) + "vw",

            "--galaxy-angle":
                random(-25, -12) + "deg"
        });

        var halo = createElement(
            "div",
            "galaxy-halo"
        );

        var core = createElement(
            "div",
            "galaxy-core"
        );

        galaxy.appendChild(halo);
        galaxy.appendChild(core);

        for (var i = 0; i < 70; i += 1) {
            var star = createElement(
                "span",
                "galaxy-star"
            );

            var angle = random(
                0,
                Math.PI * 2
            );

            var radius =
                Math.sqrt(Math.random()) *
                48;

            var x =
                Math.cos(angle) *
                radius;

            var y =
                Math.sin(angle) *
                radius *
                0.4;

            setStyles(star, {
                left:
                    50 + x + "%",

                top:
                    50 + y + "%",

                width:
                    random(0.5, 1.8) +
                    "px",

                height:
                    random(0.5, 1.8) +
                    "px",

                opacity:
                    random(0.22, 0.9).toFixed(2),

                animationDelay:
                    random(-7, 0) +
                    "s"
            });

            galaxy.appendChild(star);
        }

        scene.appendChild(galaxy);
    }

    /*
     * ------------------------------------------------------------
     * DUST
     * ------------------------------------------------------------
     */

    function createDust() {
        var dustLayer = createElement(
            "div",
            "cosmic-dust"
        );

        for (
            var i = 0;
            i < CONFIG.dust;
            i += 1
        ) {
            var particle = createElement(
                "span",
                "dust-particle"
            );

            setPosition(
                particle,
                random(0, 100),
                random(0, 100)
            );

            setStyles(particle, {
                width:
                    random(0.5, 1.8) +
                    "px",

                height:
                    random(0.5, 1.8) +
                    "px",

                opacity:
                    random(0.06, 0.28).toFixed(2),

                "--dust-duration":
                    random(15, 40) +
                    "s",

                animationDelay:
                    random(-30, 0) +
                    "s"
            });

            dustLayer.appendChild(
                particle
            );
        }

        scene.appendChild(
            dustLayer
        );
    }

    /*
     * ------------------------------------------------------------
     * PLANETS
     * ------------------------------------------------------------
     */

    function createPlanet(type, index) {
        var planet = createElement(
            "div",
            "cosmic-planet " + type
        );

        var size;

        if (index === 0) {
            size = random(55, 105);
        } else if (index === 3) {
            size = random(78, 135);
        } else {
            size = random(45, 105);
        }

        setPosition(
            planet,
            random(4, 96),
            random(7, 91)
        );

        setStyles(planet, {
            width: size + "px",
            height: size + "px",

            "--planet-angle":
                random(-25, 25) + "deg",

            animationDuration:
                random(42, 105) + "s",

            animationDelay:
                random(-100, 0) + "s"
        });

        var light = createElement(
            "div",
            "planet-light"
        );

        var atmosphere = createElement(
            "div",
            "planet-atmosphere"
        );

        var surface = createElement(
            "div",
            "planet-surface"
        );

        planet.appendChild(light);
        planet.appendChild(atmosphere);
        planet.appendChild(surface);

        var marks = randomInt(5, 10);

        for (
            var i = 0;
            i < marks;
            i += 1
        ) {
            var mark = createElement(
                "span",
                "planet-mark"
            );

            setStyles(mark, {
                left:
                    random(8, 88) +
                    "%",

                top:
                    random(8, 88) +
                    "%",

                width:
                    random(8, 35) +
                    "%",

                height:
                    random(5, 19) +
                    "%",

                transform:
                    "translate(-50%, -50%) rotate(" +
                    random(-55, 55) +
                    "deg)",

                opacity:
                    random(0.08, 0.32).toFixed(2)
            });

            surface.appendChild(mark);
        }

        if (type === "planet-ringed") {
            planet.appendChild(
                createElement(
                    "div",
                    "planet-ring-back"
                )
            );

            planet.appendChild(
                createElement(
                    "div",
                    "planet-ring-front"
                )
            );
        }

        scene.appendChild(planet);
    }

    function createPlanets() {
        for (
            var i = 0;
            i < CONFIG.planets;
            i += 1
        ) {
            createPlanet(
                PLANET_TYPES[
                    i % PLANET_TYPES.length
                ],
                i
            );
        }
    }

    /*
     * ------------------------------------------------------------
     * ASTEROIDS
     * ------------------------------------------------------------
     */

    function createAsteroid() {
        var asteroid = createElement(
            "div",
            "cosmic-asteroid"
        );

        var size = random(7, 26);

        setPosition(
            asteroid,
            random(2, 98),
            random(5, 95)
        );

        setStyles(asteroid, {
            width:
                size + "px",

            height:
                size *
                random(0.65, 1.15) +
                "px",

            transform:
                "rotate(" +
                random(0, 360) +
                "deg)",

            animationDuration:
                random(25, 85) + "s",

            animationDelay:
                random(-85, 0) + "s",

            opacity:
                random(0.28, 0.8).toFixed(2)
        });

        var craters = randomInt(2, 6);

        for (
            var i = 0;
            i < craters;
            i += 1
        ) {
            var crater = createElement(
                "span",
                "asteroid-crater"
            );

            setStyles(crater, {
                left:
                    random(8, 88) + "%",

                top:
                    random(8, 88) + "%",

                width:
                    random(8, 28) + "%",

                height:
                    random(8, 28) + "%"
            });

            asteroid.appendChild(
                crater
            );
        }

        scene.appendChild(
            asteroid
        );
    }

    function createAsteroids() {
        for (
            var i = 0;
            i < CONFIG.asteroids;
            i += 1
        ) {
            createAsteroid();
        }
    }

    /*
     * ------------------------------------------------------------
     * COMETS
     * ------------------------------------------------------------
     */

    function createComet() {
        var comet = createElement(
            "div",
            "cosmic-comet"
        );

        setPosition(
            comet,
            random(-20, 5),
            random(5, 82)
        );

        setStyles(comet, {
            "--comet-duration":
                random(30, 60) + "s",

            "--comet-delay":
                random(-60, 0) + "s",

            "--comet-angle":
                random(-16, 16) + "deg"
        });

        comet.appendChild(
            createElement(
                "div",
                "comet-tail"
            )
        );

        comet.appendChild(
            createElement(
                "div",
                "comet-glow"
            )
        );

        comet.appendChild(
            createElement(
                "div",
                "comet-core"
            )
        );

        scene.appendChild(
            comet
        );
    }

    function createComets() {
        for (
            var i = 0;
            i < CONFIG.comets;
            i += 1
        ) {
            createComet();
        }
    }

    /*
     * ------------------------------------------------------------
     * CENTRAL ENERGY OBJECT
     * ------------------------------------------------------------
     */

    function createEnergySystem() {
        var center =
            document.getElementById(
                "centerHit"
            );

        if (!center) {
            return;
        }

        if (
            $(".energy-system", center)
        ) {
            return;
        }

        var system = createElement(
            "div",
            "energy-system"
        );

        var outerGlow = createElement(
            "div",
            "energy-outer-glow"
        );

        var innerGlow = createElement(
            "div",
            "energy-inner-glow"
        );

        var nucleus = createElement(
            "div",
            "energy-nucleus"
        );

        system.appendChild(
            outerGlow
        );

        system.appendChild(
            innerGlow
        );

        system.appendChild(
            nucleus
        );

        for (
            var i = 0;
            i < 4;
            i += 1
        ) {
            var ring = createElement(
                "div",
                "energy-ring energy-ring-" +
                (i + 1)
            );

            system.appendChild(
                ring
            );
        }

        var particleCount;

        if (quality === "light") {
            particleCount = 8;
        } else if (quality === "balanced") {
            particleCount = 14;
        } else {
            particleCount = 24;
        }

        for (
            var p = 0;
            p < particleCount;
            p += 1
        ) {
            var particle = createElement(
                "span",
                "energy-orbit-particle"
            );

            setStyles(particle, {
                "--orbit-angle":
                    random(0, 360) +
                    "deg",

                "--orbit-radius":
                    random(42, 62) +
                    "%",

                "--orbit-speed":
                    random(7, 18) +
                    "s",

                "--particle-delay":
                    random(-18, 0) +
                    "s"
            });

            system.appendChild(
                particle
            );
        }

        center.appendChild(
            system
        );
    }

    function showCenterMessage(message) {
        var note =
            document.getElementById(
                "centerNote"
            );

        if (!note) {
            return;
        }

        note.textContent = message;

        removeClass(
            note,
            "visible"
        );

        window.requestAnimationFrame(
            function () {
                window.requestAnimationFrame(
                    function () {
                        addClass(
                            note,
                            "visible"
                        );
                    }
                );
            }
        );

        clearTimer(
            note._hideTimer
        );

        note._hideTimer =
            window.setTimeout(
                function () {
                    removeClass(
                        note,
                        "visible"
                    );
                },
                5200
            );
    }

    /*
     * ------------------------------------------------------------
     * CLICK EFFECT
     * ------------------------------------------------------------
     */

    function createCosmicWave() {
        if (!scene) {
            return;
        }

        var wave = createElement(
            "div",
            "cosmic-wave"
        );

        scene.appendChild(
            wave
        );

        window.setTimeout(
            function () {
                removeElement(wave);
            },
            2200
        );
    }

    function createEnergyBurst() {
        if (!scene) {
            return;
        }

        var burst = createElement(
            "div",
            "energy-burst"
        );

        var count;

        if (quality === "light") {
            count = 10;
        } else if (quality === "balanced") {
            count = 18;
        } else {
            count = 30;
        }

        for (
            var i = 0;
            i < count;
            i += 1
        ) {
            var particle = createElement(
                "span",
                "energy-particle"
            );

            var angle =
                random(0, Math.PI * 2);

            var distance =
                random(100, 290);

            setStyles(particle, {
                "--particle-x":
                    Math.cos(angle) *
                    distance +
                    "px",

                "--particle-y":
                    Math.sin(angle) *
                    distance +
                    "px",

                "--particle-size":
                    random(1, 4) +
                    "px",

                animationDelay:
                    random(0, 0.2) +
                    "s"
            });

            burst.appendChild(
                particle
            );
        }

        scene.appendChild(
            burst
        );

        window.setTimeout(
            function () {
                removeElement(
                    burst
                );
            },
            1900
        );
    }

    function activateCenter() {
        var center =
            document.getElementById(
                "centerHit"
            );

        if (!center) {
            return;
        }

        messageIndex += 1;

        if (
            messageIndex >=
            CENTER_MESSAGES.length
        ) {
            messageIndex = 0;
        }

        showCenterMessage(
            CENTER_MESSAGES[
                messageIndex
            ]
        );

        removeClass(
            center,
            "center-pulse"
        );

        window.requestAnimationFrame(
            function () {
                addClass(
                    center,
                    "center-pulse"
                );
            }
        );

        createCosmicWave();
        createEnergyBurst();

        removeClass(
            scene,
            "cosmic-reaction"
        );

        window.requestAnimationFrame(
            function () {
                addClass(
                    scene,
                    "cosmic-reaction"
                );
            }
        );
    }

    function initCenter() {
        var center =
            document.getElementById(
                "centerHit"
            );

        if (!center) {
            return;
        }

        if (centerInitialized) {
            return;
        }

        centerInitialized = true;

        createEnergySystem();

        center.addEventListener(
            "click",
            activateCenter
        );

        center.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();

                    activateCenter();
                }
            }
        );
    }

    /*
     * ------------------------------------------------------------
     * CINEMATIC INTRO
     * ------------------------------------------------------------
     */

    function rememberTimer(timer) {
        introTimers.push(timer);
        return timer;
    }

    function clearIntroTimers() {
        for (
            var i = 0;
            i < introTimers.length;
            i += 1
        ) {
            clearTimer(
                introTimers[i]
            );
        }

        introTimers = [];
    }

    function startCinematicIntro() {
        if (!scene) {
            return;
        }

        clearIntroTimers();

        removeClass(
            scene,
            "cosmic-intro"
        );

        removeClass(
            scene,
            "cosmic-opening"
        );

        removeClass(
            scene,
            "cosmic-flight"
        );

        removeClass(
            scene,
            "cosmic-reveal"
        );

        removeClass(
            scene,
            "cosmic-ready"
        );

        if (CONFIG.reducedMotion) {
            addClass(
                scene,
                "cosmic-ready"
            );

            return;
        }

        addClass(
            scene,
            "cosmic-intro"
        );

        rememberTimer(
            window.setTimeout(
                function () {
                    if (scene) {
                        addClass(
                            scene,
                            "cosmic-opening"
                        );
                    }
                },
                100
            )
        );

        rememberTimer(
            window.setTimeout(
                function () {
                    if (scene) {
                        addClass(
                            scene,
                            "cosmic-flight"
                        );
                    }
                },
                900
            )
        );

        rememberTimer(
            window.setTimeout(
                function () {
                    if (scene) {
                        addClass(
                            scene,
                            "cosmic-reveal"
                        );
                    }
                },
                2700
            )
        );

        rememberTimer(
            window.setTimeout(
                function () {
                    if (!scene) {
                        return;
                    }

                    removeClass(
                        scene,
                        "cosmic-intro"
                    );

                    removeClass(
                        scene,
                        "cosmic-opening"
                    );

                    removeClass(
                        scene,
                        "cosmic-flight"
                    );

                    addClass(
                        scene,
                        "cosmic-ready"
                    );
                },
                CONFIG.introDuration
            )
        );

        rememberTimer(
            window.setTimeout(
                function () {
                    showCenterMessage(
                        CENTER_MESSAGES[0]
                    );
                },
                CONFIG.introDuration + 450
            )
        );
    }

    /*
     * ------------------------------------------------------------
     * RANDOM COSMIC EVENTS
     * ------------------------------------------------------------
     */

    function createFlashEvent() {
        if (!scene) {
            return;
        }

        var flash = createElement(
            "div",
            "cosmic-flash"
        );

        setPosition(
            flash,
            random(10, 90),
            random(8, 85)
        );

        scene.appendChild(
            flash
        );

        window.setTimeout(
            function () {
                removeElement(flash);
            },
            1400
        );
    }

    function createShootingStarEvent() {
        if (!scene) {
            return;
        }

        var meteor = createElement(
            "div",
            "cosmic-shooting-star"
        );

        setPosition(
            meteor,
            random(5, 75),
            random(5, 70)
        );

        setStyles(meteor, {
            "--meteor-angle":
                random(18, 38) +
                "deg"
        });

        scene.appendChild(
            meteor
        );

        window.setTimeout(
            function () {
                removeElement(
                    meteor
                );
            },
            1700
        );
    }

    function createAmbientEvent() {
        if (!scene) {
            return;
        }

        removeClass(
            scene,
            "ambient-pulse"
        );

        window.requestAnimationFrame(
            function () {
                addClass(
                    scene,
                    "ambient-pulse"
                );
            }
        );
    }

    function scheduleNextEvent() {
        clearTimer(eventTimer);

        if (
            CONFIG.reducedMotion
        ) {
            return;
        }

        eventTimer =
            window.setTimeout(
                function () {
                    if (!scene) {
                        return;
                    }

                    var eventType = pick([
                        "flash",
                        "shooting",
                        "ambient"
                    ]);

                    if (
                        eventType === "flash"
                    ) {
                        createFlashEvent();
                    }

                    if (
                        eventType === "shooting"
                    ) {
                        createShootingStarEvent();
                    }

                    if (
                        eventType === "ambient"
                    ) {
                        createAmbientEvent();
                    }

                    scheduleNextEvent();
                },
                random(
                    CONFIG.eventMinimumDelay,
                    CONFIG.eventMaximumDelay
                )
            );
    }

    /*
     * ------------------------------------------------------------
     * POINTER PARALLAX
     * ------------------------------------------------------------
     */

    function handlePointerMove(event) {
        if (
            CONFIG.reducedMotion ||
            !window.innerWidth ||
            !window.innerHeight
        ) {
            return;
        }

        var now =
            performance.now();

        targetPointerX =
            clamp(
                event.clientX /
                window.innerWidth -
                0.5,
                -0.5,
                0.5
            );

        targetPointerY =
            clamp(
                event.clientY /
                window.innerHeight -
                0.5,
                -0.5,
                0.5
            );

        if (lastPointerTime > 0) {
            var delta =
                Math.max(
                    now -
                    lastPointerTime,
                    1
                );

            velocityX =
                clamp(
                    (
                        event.clientX -
                        lastPointerX
                    ) / delta,
                    -2,
                    2
                );

            velocityY =
                clamp(
                    (
                        event.clientY -
                        lastPointerY
                    ) / delta,
                    -2,
                    2
                );
        }

        lastPointerX =
            event.clientX;

        lastPointerY =
            event.clientY;

        lastPointerTime =
            now;
    }

    function animateParallax() {
        pointerX +=
            (
                targetPointerX -
                pointerX
            ) * 0.035;

        pointerY +=
            (
                targetPointerY -
                pointerY
            ) * 0.035;

        velocityX *= 0.94;
        velocityY *= 0.94;

        if (scene) {
            scene.style.setProperty(
                "--pointer-x",
                pointerX.toFixed(4)
            );

            scene.style.setProperty(
                "--pointer-y",
                pointerY.toFixed(4)
            );

            scene.style.setProperty(
                "--pointer-x-strong",
                (
                    pointerX * 2
                ).toFixed(4)
            );

            scene.style.setProperty(
                "--pointer-y-strong",
                (
                    pointerY * 2
                ).toFixed(4)
            );

            scene.style.setProperty(
                "--pointer-speed-x",
                velocityX.toFixed(4)
            );

            scene.style.setProperty(
                "--pointer-speed-y",
                velocityY.toFixed(4)
            );
        }

        animationFrame =
            window.requestAnimationFrame(
                animateParallax
            );
    }

    function initParallax() {
        if (CONFIG.reducedMotion) {
            return;
        }

        window.addEventListener(
            "pointermove",
            handlePointerMove,
            {
                passive: true
            }
        );

        animationFrame =
            window.requestAnimationFrame(
                animateParallax
            );
    }

    /*
     * ------------------------------------------------------------
     * THEME
     * ------------------------------------------------------------
     */

    function applyWorldTheme(theme) {
        if (!scene) {
            return;
        }

        scene.dataset.theme =
            theme || "default";
    }

    window.applyTheme =
        applyWorldTheme;

    /*
     * ------------------------------------------------------------
     * BUILD
     * ------------------------------------------------------------
     */

    function buildWorld() {
        if (!createScene()) {
            return false;
        }

        createNebulae();
        createGalaxy();
        createStars();
        createStarClusters();
        createDust();
        createPlanets();
        createAsteroids();
        createComets();

        initCenter();

        return true;
    }

    function initWorldScene() {
        if (initialized) {
            return;
        }

        worldElement =
            document.getElementById(
                WORLD_ID
            );

        if (!worldElement) {
            return;
        }

        worldLayer =
            $(".world-layer", worldElement);

        if (!worldLayer) {
            return;
        }

        CONFIG.reducedMotion =
            reducedMotion();

        configureQuality();

        if (!buildWorld()) {
            return;
        }

        initialized = true;

        startCinematicIntro();

        scheduleNextEvent();

        if (!CONFIG.reducedMotion) {
            initParallax();
        }
    }

    function destroyWorldScene() {
        clearIntroTimers();

        clearTimer(eventTimer);

        eventTimer = null;

        clearTimer(resizeTimer);

        if (animationFrame) {
            window.cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }

        window.removeEventListener(
            "pointermove",
            handlePointerMove
        );

        if (scene) {
            removeElement(scene);
        }

        scene = null;
        worldLayer = null;
        worldElement = null;

        initialized = false;
        centerInitialized = false;

        pointerX = 0;
        pointerY = 0;

        targetPointerX = 0;
        targetPointerY = 0;

        velocityX = 0;
        velocityY = 0;

        lastPointerTime = 0;
    }

    function rebuildWorldScene() {
        destroyWorldScene();
        initWorldScene();
    }

    function handleResize() {
        clearTimer(
            resizeTimer
        );

        resizeTimer =
            window.setTimeout(
                function () {
                    if (!initialized) {
                        return;
                    }

                    var nextQuality =
                        detectQuality();

                    if (
                        nextQuality !==
                        quality
                    ) {
                        rebuildWorldScene();
                    }
                },
                500
            );
    }

    /*
     * ------------------------------------------------------------
     * PUBLIC API
     * ------------------------------------------------------------
     */

    window.initWorldScene =
        initWorldScene;

    window.destroyWorldScene =
        destroyWorldScene;

    window.rebuildWorldScene =
        rebuildWorldScene;

    window.playCosmicIntro =
        startCinematicIntro;

    window.createCosmicEvent =
        function () {
            if (!scene) {
                return;
            }

            var type = pick([
                "flash",
                "shooting",
                "ambient"
            ]);

            if (type === "flash") {
                createFlashEvent();
            }

            if (type === "shooting") {
                createShootingStarEvent();
            }

            if (type === "ambient") {
                createAmbientEvent();
            }
        };

    window.addEventListener(
        "resize",
        handleResize,
        {
            passive: true
        }
    );

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initWorldScene,
            {
                once: true
            }
        );
    } else {
        initWorldScene();
    }

})();