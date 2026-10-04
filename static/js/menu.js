"use strict";


/* =====================================================
   MENU
===================================================== */


/* =====================================================
   CLOSE MENU
===================================================== */

function closeMenu() {

    const menu =
        $("mainMenu");

    const button =
        $("menuButton");

    if (!menu) {
        return;
    }

    state.menuOpen = false;

    menu.classList.remove("open");

    menu.setAttribute(
        "aria-hidden",
        "true"
    );

    if (button) {

        button.classList.remove("active");

        button.setAttribute(
            "aria-expanded",
            "false"
        );

    }

}


/* =====================================================
   OPEN MENU
===================================================== */

function openMenu() {

    const menu =
        $("mainMenu");

    const button =
        $("menuButton");

    if (!menu) {
        return;
    }

    state.menuOpen = true;

    menu.classList.add("open");

    menu.setAttribute(
        "aria-hidden",
        "false"
    );

    if (button) {

        button.classList.add("active");

        button.setAttribute(
            "aria-expanded",
            "true"
        );

    }

}


/* =====================================================
   TOGGLE MENU
===================================================== */

function toggleMenu() {

    if (state.menuOpen) {

        closeMenu();

    } else {

        openMenu();

    }

}


/* =====================================================
   SHEET
===================================================== */

function openSheet(name) {

    const overlay =
        $("sheetOverlay");

    const sheet =
        $("sheet");

    const title =
        $("sheetTitle");

    const body =
        $("sheetBody");

    if (
        !overlay ||
        !sheet ||
        !title ||
        !body
    ) {
        return;
    }


    const sheetConfig =
        typeof sheets !== "undefined"
            ? sheets[name]
            : null;


    if (!sheetConfig) {

        console.warn(
            "Noma'lum sheet:",
            name
        );

        return;

    }


    state.sheet =
        name;


    title.textContent =
        sheetConfig.title ||
        "Bo‘lim";


    body.innerHTML =
        typeof sheetConfig.render === "function"
            ? sheetConfig.render()
            : "";


    overlay.classList.add("open");

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    closeMenu();


    if (
        typeof sheetConfig.init === "function"
    ) {

        sheetConfig.init();

    }

}


/* =====================================================
   CLOSE SHEET
===================================================== */

function closeSheet() {

    const overlay =
        $("sheetOverlay");

    const body =
        $("sheetBody");

    if (!overlay) {
        return;
    }

    overlay.classList.remove("open");

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    state.sheet = "";


    if (body) {

        body.innerHTML = "";

    }

}


/* =====================================================
   MENU EVENTS
===================================================== */

function initMenu() {

    const menuButton =
        $("menuButton");

    const menu =
        $("mainMenu");

    const overlay =
        $("sheetOverlay");

    const sheetClose =
        $("sheetClose");


    /* ---------------------------------------------
       MENU BUTTON
    --------------------------------------------- */

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                toggleMenu();

            }
        );

    }


    /* ---------------------------------------------
       MENU ITEMS
    --------------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    "[data-sheet]"
                );

            if (!item) {
                return;
            }

            const sheetName =
                item.dataset.sheet;

            if (!sheetName) {
                return;
            }

            openSheet(
                sheetName
            );

        }
    );


    /* ---------------------------------------------
       SHEET CLOSE BUTTON
    --------------------------------------------- */

    if (sheetClose) {

        sheetClose.addEventListener(
            "click",
            closeSheet
        );

    }


    /* ---------------------------------------------
       CLICK OUTSIDE SHEET
    --------------------------------------------- */

    if (overlay) {

        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target === overlay
                ) {

                    closeSheet();

                }

            }
        );

    }


    /* ---------------------------------------------
       CLICK OUTSIDE MENU
    --------------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            if (!state.menuOpen) {
                return;
            }

            if (
                menu &&
                menu.contains(event.target)
            ) {
                return;
            }

            if (
                menuButton &&
                menuButton.contains(event.target)
            ) {
                return;
            }

            closeMenu();

        }
    );


    /* ---------------------------------------------
       ESCAPE
    --------------------------------------------- */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }

            if (state.sheet) {

                closeSheet();

                return;

            }

            if (state.menuOpen) {

                closeMenu();

            }

        }
    );

}


/* =====================================================
   START MENU MODULE
===================================================== */

initMenu();
/* =====================================================
   MAIN SCENE NAVIGATION VISIBILITY
===================================================== */

function syncSceneNavigation() {

    const world =
        $("world");

    if (!world) {
        return;
    }

    const body =
        document.body;

    if (!body) {
        return;
    }

    const isWorldActive =
        world.classList.contains("active");

    body.classList.toggle(
        "scene-ready",
        isWorldActive
    );
}


/* Initial state */
syncSceneNavigation();


/* Watch screen changes */
const sceneNavigationObserver =
    new MutationObserver(() => {

        syncSceneNavigation();

    });


const worldScreen =
    $("world");

if (worldScreen) {

    sceneNavigationObserver.observe(
        worldScreen,
        {
            attributes: true,
            attributeFilter: ["class"]
        }
    );

}