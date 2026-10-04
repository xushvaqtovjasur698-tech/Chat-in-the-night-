"use strict";


/* =========================================================
   ENTRY — INTERACTIVE CINEMATIC MOTION
   ========================================================= */

(function () {

    const entry = document.getElementById("entry");

    if (!entry) return;


    const scene =
        entry.querySelector(".entry-scene");

    const content =
        entry.querySelector(".entry-content");


    if (!scene) return;


    let targetX = 0;
    let targetY = 0;

    let currentX = 0;
    let currentY = 0;


    /*
     * Sichqoncha harakati.
     *
     * Juda kuchli emas.
     * Sahna faqat ozgina "nafas oladi".
     */

    function handlePointerMove(event) {

        if (
            window.matchMedia &&
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
        ) {
            return;
        }


        const width =
            window.innerWidth || 1;

        const height =
            window.innerHeight || 1;


        const normalizedX =
            (event.clientX / width) - 0.5;

        const normalizedY =
            (event.clientY / height) - 0.5;


        targetX =
            normalizedX * 2;

        targetY =
            normalizedY * 2;
    }


    function animate() {

        currentX +=
            (targetX - currentX) * 0.035;

        currentY +=
            (targetY - currentY) * 0.035;


        /*
         * Orqa sahna:
         * juda sekin parallax.
         */

        scene.style.transform =
            `translate3d(
                ${currentX * -7}px,
                ${currentY * -5}px,
                0
            ) scale(1.08)`;


        /*
         * Markaziy content:
         * orqa fondan mustaqilroq.
         */

        if (content) {

            content.style.transform =
                `translate(
                    calc(-50% + ${currentX * 2.5}px),
                    calc(-47% + ${currentY * 1.8}px)
                )`;
        }


        requestAnimationFrame(animate);
    }


    window.addEventListener(
        "pointermove",
        handlePointerMove,
        {
            passive: true
        }
    );


    /*
     * Sichqoncha oynadan chiqsa,
     * sahna yana markazga qaytadi.
     */

    window.addEventListener(
        "pointerleave",
        () => {
            targetX = 0;
            targetY = 0;
        }
    );


    /*
     * Touch qurilmalarda animatsiyani
     * o‘z holicha qoldiramiz.
     */

    if (!window.matchMedia ||
        !window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
    ) {
        requestAnimationFrame(animate);
    }


    /*
     * Kirish oynasi paydo bo‘lganda
     * inputga fokus berilmaydi.
     *
     * Foydalanuvchi sahnani avval ko‘radi.
     */

    const input =
        document.getElementById("accessCode");

    if (input) {

        input.addEventListener(
            "focus",
            () => {
                entry.classList.add(
                    "entry-input-active"
                );
            }
        );

        input.addEventListener(
            "blur",
            () => {
                entry.classList.remove(
                    "entry-input-active"
                );
            }
        );
    }


    /*
     * Button bosilganda kichik "scene response".
     * Login funksiyasini almashtirmaydi.
     */

    const button =
        document.getElementById("entryButton");

    if (button) {

        button.addEventListener(
            "click",
            () => {

                entry.classList.add(
                    "entry-entering"
                );

                window.setTimeout(
                    () => {
                        entry.classList.remove(
                            "entry-entering"
                        );
                    },
                    900
                );
            }
        );
    }

})();