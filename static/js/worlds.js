"use strict";

/* =========================================================
   MAIN WORLD
   Living Cosmos interaction
   ========================================================= */

(function () {

    let centerObject = null;
    let centerNote = null;

    let mouseX = 0;
    let mouseY = 0;

    let targetX = 0;
    let targetY = 0;

    let animationFrame = null;


    /* =====================================================
       XABARLAR
       ===================================================== */

    const WORLD_MESSAGES = [
        "Ba'zi narsalarni shoshmasdan kashf qilish kerak.",
        "Bu yerda hali ko‘rilmagan narsalar bor.",
        "Har safar qaraganda boshqa bir detal seziladi.",
        "Ba'zi joylar gapirmaydi. Faqat his qilinadi.",
        "Shoshilma. Bu olam hali tugamagan.",
        "Ehtimol, eng qiziq narsa hali yashirin.",
        "Jimlikning ham o‘z hikoyasi bor.",
        "Yaqinroq qarasang, hammasi biroz boshqacha."
    ];


    /* =====================================================
       XABAR KO‘RSATISH
       ===================================================== */

    function showCenterMessage(message) {

        if (!centerNote) return;

        centerNote.textContent = message;

        centerNote.classList.remove("visible");

        void centerNote.offsetWidth;

        centerNote.classList.add("visible");

        window.clearTimeout(
            showCenterMessage.timer
        );

        showCenterMessage.timer =
            window.setTimeout(() => {

                centerNote.classList.remove(
                    "visible"
                );

            }, 4600);
    }


    /* =====================================================
       MARKAZ BILAN O‘ZARO ALOQA
       ===================================================== */

    function interactWithCenter() {

        if (!centerObject) return;

        centerObject.classList.remove(
            "is-active"
        );

        void centerObject.offsetWidth;

        centerObject.classList.add(
            "is-active"
        );


        const index =
            Math.floor(
                Math.random() *
                WORLD_MESSAGES.length
            );


        showCenterMessage(
            WORLD_MESSAGES[index]
        );


        if (
            typeof showToast ===
            "function"
        ) {

            showToast(
                "Olam yana bir oz uyg‘ondi."
            );

        }
    }


    /* =====================================================
       KLAVIATURA
       ===================================================== */

    function handleKeyboard(event) {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            interactWithCenter();
        }
    }


    /* =====================================================
       SICHQONCHA PARALLAX
       ===================================================== */

    function handlePointerMove(event) {

        if (
            window.matchMedia(
                "(hover: none)"
            ).matches
        ) {
            return;
        }


        const width =
            window.innerWidth;

        const height =
            window.innerHeight;


        mouseX =
            (event.clientX / width - .5);

        mouseY =
            (event.clientY / height - .5);
    }


    function animateParallax() {

        targetX +=
            (mouseX - targetX) * .035;

        targetY +=
            (mouseY - targetY) * .035;


        if (centerObject) {

            const moveX =
                targetX * 8;

            const moveY =
                targetY * 6;


            /*
             * CSS transform ustiga
             * juda kichik parallax.
             */

            if (
                !centerObject.classList.contains(
                    "is-active"
                )
            ) {

                centerObject.style.transform =
                    `translate3d(${moveX}px, ${moveY}px, 0) scale(1)`;
            }
        }


        animationFrame =
            window.requestAnimationFrame(
                animateParallax
            );
    }


    /* =====================================================
       MARKAZ ELEMENTLARI
       ===================================================== */

    function createAtmosphereDetails() {

        if (!centerObject) return;


        /*
         * Mayda kosmik zarrachalar.
         * HTMLga qo‘lda yozish shart emas.
         */

        const particles = [
            {
                left: "18%",
                top: "27%",
                delay: "0s",
                duration: "6s"
            },
            {
                left: "77%",
                top: "25%",
                delay: "1.4s",
                duration: "7s"
            },
            {
                left: "83%",
                top: "64%",
                delay: "2.1s",
                duration: "8s"
            },
            {
                left: "21%",
                top: "70%",
                delay: ".8s",
                duration: "7.4s"
            }
        ];


        particles.forEach(
            particleData => {

                const particle =
                    document.createElement(
                        "span"
                    );


                particle.className =
                    "world-particle";


                particle.style.left =
                    particleData.left;

                particle.style.top =
                    particleData.top;

                particle.style.animationDelay =
                    particleData.delay;

                particle.style.animationDuration =
                    particleData.duration;


                centerObject.appendChild(
                    particle
                );
            }
        );


        /*
         * Markaz atrofidagi yumshoq
         * yorug‘lik izi.
         */

        const trace =
            document.createElement(
                "span"
            );

        trace.className =
            "center-light-trace";

        centerObject.appendChild(
            trace
        );
    }


    /* =====================================================
       YUKLANISH
       ===================================================== */

    function initWorld() {

        centerObject =
            document.getElementById(
                "centerHit"
            );

        centerNote =
            document.getElementById(
                "centerNote"
            );


        if (!centerObject) {
            return;
        }


        centerObject.addEventListener(
            "click",
            interactWithCenter
        );


        centerObject.addEventListener(
            "keydown",
            handleKeyboard
        );


        centerObject.addEventListener(
            "pointerenter",
            () => {

                centerObject.classList.add(
                    "is-hovered"
                );

            }
        );


        centerObject.addEventListener(
            "pointerleave",
            () => {

                centerObject.classList.remove(
                    "is-hovered"
                );

            }
        );


        createAtmosphereDetails();


        /*
         * Sichqoncha harakatini kuzatamiz.
         */

        document.addEventListener(
            "pointermove",
            handlePointerMove,
            {
                passive: true
            }
        );


        /*
         * Parallax loop.
         */

        animationFrame =
            window.requestAnimationFrame(
                animateParallax
            );
    }


    /* =====================================================
       TOZALASH
       ===================================================== */

    function destroyWorld() {

        if (animationFrame) {

            window.cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }


        document.removeEventListener(
            "pointermove",
            handlePointerMove
        );
    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initWorld,
            {
                once: true
            }
        );

    } else {

        initWorld();

    }


    /* =====================================================
       GLOBAL API
       ===================================================== */

    window.mainWorld = {

        interact:
            interactWithCenter,

        destroy:
            destroyWorld
    };

})();