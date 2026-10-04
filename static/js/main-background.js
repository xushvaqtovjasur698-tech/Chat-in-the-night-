"use strict";

/* =========================================================
   MARJONA — MAIN BACKGROUND MEDIA SYSTEM
   ========================================================= */

const MAIN_BACKGROUND_CONFIG = {
    dbName: "marjona_main_background",
    dbVersion: 3,

    playlistStore: "playlist",
    oldStore: "backgrounds",

    modeKey: "marjona_main_background_mode",
    intervalKey: "marjona_main_background_interval",

    defaultInterval: 7000,

    imageMaxSize: 2600,
    imageQuality: 0.88
};


/* =========================================================
   STATE
========================================================= */

let mainBackgroundDB = null;

let mainBackgroundItems = [];

let mainBackgroundIndex = 0;

let mainBackgroundMode = "animated";

let mainBackgroundTimer = null;

let mainBackgroundLayer = null;

let mainBackgroundCurrentElement = null;

let mainBackgroundObjectUrls = [];

let mainBackgroundInitialized = false;

let mainBackgroundRestored = false;


/* =========================================================
   HELPERS
========================================================= */

function mb$(selector, root = document) {
    return root.querySelector(selector);
}


function mbEscapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getMainBackgroundInterval() {

    const saved = Number(
        localStorage.getItem(
            MAIN_BACKGROUND_CONFIG.intervalKey
        )
    );

    if (!Number.isFinite(saved)) {
        return MAIN_BACKGROUND_CONFIG.defaultInterval;
    }

    return Math.max(2000, saved);
}


function saveMainBackgroundMode(mode) {

    mainBackgroundMode = mode;

    localStorage.setItem(
        MAIN_BACKGROUND_CONFIG.modeKey,
        mode
    );
}


function getSavedMainBackgroundMode() {

    const saved =
        localStorage.getItem(
            MAIN_BACKGROUND_CONFIG.modeKey
        );

    if (
        saved === "animated" ||
        saved === "image" ||
        saved === "single" ||
        saved === "playlist"
    ) {
        return saved;
    }

    return "animated";
}


/* =========================================================
   DYNAMIC STYLE
========================================================= */

function injectMainBackgroundStyles() {

    if (
        document.getElementById(
            "marjona-main-background-runtime-style"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");


    style.id =
        "marjona-main-background-runtime-style";


    style.textContent = `

        #mainBackgroundMediaLayer {

            position: absolute;

            inset: 0;

            width: 100%;
            height: 100%;

            overflow: hidden;

            z-index: 0;

            background: #000;

            opacity: 0;

            visibility: hidden;

            pointer-events: none;

            transition:
                opacity .45s ease,
                visibility 0s linear .45s;

        }


        #mainBackgroundMediaLayer.is-active {

            opacity: 1;

            visibility: visible;

            transition:
                opacity .45s ease,
                visibility 0s linear 0s;

        }


        #mainBackgroundMediaLayer img,
        #mainBackgroundMediaLayer video {

            position: absolute;

            inset: 0;

            width: 100% !important;
            height: 100% !important;

            min-width: 100%;
            min-height: 100%;

            max-width: none;
            max-height: none;

            display: block;

            margin: 0;
            padding: 0;

            border: 0;
            outline: 0;

            object-fit: cover;

            object-position: center center;

            background: #000;

            opacity: 1 !important;

            filter: none !important;

            transform: none !important;

            box-shadow: none;

        }


        /* Custom media paytida cosmic fonni
           BUTUNLAY yashiramiz */

        body.main-custom-background .world-layer {

            opacity: 0 !important;

            visibility: hidden !important;

            pointer-events: none !important;

        }


        body.main-custom-background .world-atmosphere,
        body.main-custom-background .center-object,
        body.main-custom-background .center-aura,
        body.main-custom-background .center-core,
        body.main-custom-background .center-note {

            visibility: hidden !important;

        }


        body.main-animated-background .world-layer {

            opacity: 1 !important;

            visibility: visible !important;

        }


        body.main-animated-background
        #mainBackgroundMediaLayer {

            opacity: 0 !important;

            visibility: hidden !important;

        }


        /* =================================================
           CONTROLS
        ================================================= */

        .main-background-controls {

            display: flex;

            flex-direction: column;

            gap: 14px;

            width: 100%;

        }


        .main-background-control-title {

            color:
                rgba(255,255,255,.94);

            font-size: 14px;

            font-weight: 600;

        }


        .main-background-control-description {

            margin-top: 4px;

            color:
                rgba(255,255,255,.48);

            font-size: 12px;

            line-height: 1.55;

        }


        .main-background-mode-row {

            display: grid;

            grid-template-columns:
                repeat(3, minmax(0,1fr));

            gap: 8px;

        }


        .main-background-button {

            min-height: 45px;

            padding: 9px 10px;

            border:
                1px solid
                rgba(255,255,255,.10);

            border-radius: 13px;

            background:
                rgba(255,255,255,.045);

            color:
                rgba(255,255,255,.72);

            font: inherit;

            font-size: 12px;

            cursor: pointer;

            transition:
                background .2s ease,
                border-color .2s ease,
                color .2s ease,
                transform .2s ease;

        }


        .main-background-button:hover {

            background:
                rgba(255,255,255,.085);

            border-color:
                rgba(255,255,255,.20);

            color: #fff;

            transform:
                translateY(-1px);

        }


        .main-background-button.is-active {

            background:
                rgba(255,255,255,.12);

            border-color:
                rgba(255,255,255,.28);

            color: #fff;

        }


        /* =================================================
           UPLOAD
        ================================================= */

        .main-background-upload-row {

            display: grid;

            grid-template-columns:
                1fr 1fr;

            gap: 8px;

        }


        .main-background-file-button {

            position: relative;

            display: flex;

            align-items: center;

            justify-content: center;

            min-height: 48px;

            padding: 10px 12px;

            border:
                1px dashed
                rgba(255,255,255,.18);

            border-radius: 14px;

            background:
                rgba(255,255,255,.035);

            color:
                rgba(255,255,255,.78);

            font-size: 12px;

            cursor: pointer;

            text-align: center;

        }


        .main-background-file-button:hover {

            background:
                rgba(255,255,255,.07);

            border-color:
                rgba(255,255,255,.28);

        }


        .main-background-file-button input {

            position: absolute;

            width: 1px;
            height: 1px;

            opacity: 0;

            pointer-events: none;

        }


        /* =================================================
           PLAYLIST
        ================================================= */

        .main-background-playlist {

            display: flex;

            flex-direction: column;

            gap: 8px;

        }


        .main-background-playlist-list {

            display: flex;

            flex-direction: column;

            gap: 7px;

            max-height: 300px;

            overflow-y: auto;

        }


        .main-background-playlist-empty {

            padding: 18px 12px;

            border:
                1px dashed
                rgba(255,255,255,.11);

            border-radius: 13px;

            color:
                rgba(255,255,255,.42);

            text-align: center;

            font-size: 12px;

        }


        .main-background-playlist-item {

            display: grid;

            grid-template-columns:
                40px minmax(0,1fr) auto;

            align-items: center;

            gap: 9px;

            min-height: 48px;

            padding: 7px 8px;

            border:
                1px solid
                rgba(255,255,255,.075);

            border-radius: 12px;

            background:
                rgba(255,255,255,.035);

        }


        .main-background-playlist-item.is-current {

            border-color:
                rgba(255,255,255,.25);

            background:
                rgba(255,255,255,.075);

        }


        .main-background-playlist-thumb {

            width: 40px;
            height: 40px;

            overflow: hidden;

            display: flex;

            align-items: center;
            justify-content: center;

            border-radius: 9px;

            background:
                rgba(0,0,0,.35);

        }


        .main-background-playlist-thumb img {

            width: 100%;
            height: 100%;

            object-fit: cover;

        }


        .main-background-playlist-video-icon {

            color:
                rgba(255,255,255,.80);

            font-size: 14px;

        }


        .main-background-playlist-name {

            min-width: 0;

            padding: 0;

            border: 0;

            background: transparent;

            color:
                rgba(255,255,255,.78);

            font: inherit;

            font-size: 12px;

            text-align: left;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

            cursor: pointer;

        }


        .main-background-playlist-actions {

            display: flex;

            align-items: center;

            gap: 4px;

        }


        .main-background-playlist-action {

            width: 29px;
            height: 29px;

            padding: 0;

            border:
                1px solid
                rgba(255,255,255,.08);

            border-radius: 8px;

            background:
                rgba(255,255,255,.035);

            color:
                rgba(255,255,255,.68);

            cursor: pointer;

        }


        .main-background-playlist-action:hover {

            background:
                rgba(255,255,255,.09);

            color: #fff;

        }


        /* =================================================
           INTERVAL
        ================================================= */

        .main-background-interval-row {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 10px;

        }


        .main-background-interval-label {

            color:
                rgba(255,255,255,.58);

            font-size: 12px;

        }


        .main-background-interval-select {

            min-width: 110px;

            padding: 8px 10px;

            border:
                1px solid
                rgba(255,255,255,.10);

            border-radius: 10px;

            background:
                rgba(20,20,30,.85);

            color:
                rgba(255,255,255,.84);

            font: inherit;

            font-size: 12px;

            outline: none;

        }


        /* =================================================
           RESET
        ================================================= */

        .main-background-reset {

            width: 100%;

            min-height: 43px;

            padding: 9px 12px;

            border:
                1px solid
                rgba(255,255,255,.09);

            border-radius: 12px;

            background:
                rgba(255,255,255,.035);

            color:
                rgba(255,255,255,.62);

            font: inherit;

            font-size: 12px;

            cursor: pointer;

        }


        .main-background-reset:hover {

            background:
                rgba(255,255,255,.07);

            color: #fff;

        }


        .main-background-status {

            min-height: 17px;

            color:
                rgba(255,255,255,.45);

            font-size: 11px;

        }


        @media (max-width: 700px) {

            .main-background-mode-row {

                grid-template-columns: 1fr;

            }

            .main-background-upload-row {

                grid-template-columns: 1fr;

            }

        }

    `;


    document.head.appendChild(style);

}


/* =========================================================
   INDEXED DB
========================================================= */

function openMainBackgroundDB() {

    if (mainBackgroundDB) {
        return Promise.resolve(
            mainBackgroundDB
        );
    }


    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    MAIN_BACKGROUND_CONFIG.dbName,
                    MAIN_BACKGROUND_CONFIG.dbVersion
                );


            request.onupgradeneeded =
                event => {

                    const db =
                        event.target.result;


                    if (
                        !db.objectStoreNames.contains(
                            MAIN_BACKGROUND_CONFIG.playlistStore
                        )
                    ) {

                        db.createObjectStore(
                            MAIN_BACKGROUND_CONFIG.playlistStore,
                            {
                                keyPath: "id"
                            }
                        );

                    }


                    if (
                        !db.objectStoreNames.contains(
                            MAIN_BACKGROUND_CONFIG.oldStore
                        )
                    ) {

                        db.createObjectStore(
                            MAIN_BACKGROUND_CONFIG.oldStore
                        );

                    }

                };


            request.onsuccess =
                event => {

                    mainBackgroundDB =
                        event.target.result;

                    resolve(
                        mainBackgroundDB
                    );

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================================
   LOAD PLAYLIST
========================================================= */

async function loadMainBackgroundPlaylist() {

    const db =
        await openMainBackgroundDB();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    MAIN_BACKGROUND_CONFIG.playlistStore,
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    MAIN_BACKGROUND_CONFIG.playlistStore
                );


            const request =
                store.getAll();


            request.onsuccess =
                () => {

                    const result =
                        Array.isArray(
                            request.result
                        )
                            ? request.result
                            : [];


                    result.sort(
                        (a, b) =>
                            Number(a.order || 0) -
                            Number(b.order || 0)
                    );


                    resolve(result);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* =========================================================
   SAVE PLAYLIST
========================================================= */

async function saveMainBackgroundPlaylist(
    items
) {

    const db =
        await openMainBackgroundDB();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    MAIN_BACKGROUND_CONFIG.playlistStore,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    MAIN_BACKGROUND_CONFIG.playlistStore
                );


            store.clear();


            items.forEach(
                (item, index) => {

                    item.order =
                        index;

                    store.put(item);

                }
            );


            transaction.oncomplete =
                () => resolve();


            transaction.onerror =
                () => {

                    reject(
                        transaction.error
                    );

                };

        }
    );

}


/* =========================================================
   CLEAR STORAGE
========================================================= */

async function clearMainBackgroundStorage() {

    const db =
        await openMainBackgroundDB();


    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    MAIN_BACKGROUND_CONFIG.playlistStore,
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    MAIN_BACKGROUND_CONFIG.playlistStore
                );


            const request =
                store.clear();


            request.onsuccess =
                () => resolve();


            request.onerror =
                () => reject(
                    request.error
                );

        }
    );

}


/* =========================================================
   OLD IMAGE
========================================================= */

async function loadOldMainBackground() {

    try {

        const db =
            await openMainBackgroundDB();


        if (
            !db.objectStoreNames.contains(
                MAIN_BACKGROUND_CONFIG.oldStore
            )
        ) {
            return null;
        }


        return new Promise(
            resolve => {

                const transaction =
                    db.transaction(
                        MAIN_BACKGROUND_CONFIG.oldStore,
                        "readonly"
                    );


                const store =
                    transaction.objectStore(
                        MAIN_BACKGROUND_CONFIG.oldStore
                    );


                const request =
                    store.get("main");


                request.onsuccess =
                    () => {

                        resolve(
                            request.result ||
                            null
                        );

                    };


                request.onerror =
                    () => {

                        resolve(null);

                    };

            }
        );

    } catch (_) {

        return null;

    }

}


/* =========================================================
   IMAGE COMPRESSION
========================================================= */

function compressMainBackgroundImage(
    file
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    const image =
                        new Image();


                    image.onload =
                        () => {

                            let width =
                                image.naturalWidth;

                            let height =
                                image.naturalHeight;


                            const max =
                                MAIN_BACKGROUND_CONFIG.imageMaxSize;


                            if (
                                width > max ||
                                height > max
                            ) {

                                const scale =
                                    Math.min(
                                        max / width,
                                        max / height
                                    );


                                width =
                                    Math.round(
                                        width * scale
                                    );


                                height =
                                    Math.round(
                                        height * scale
                                    );

                            }


                            const canvas =
                                document.createElement(
                                    "canvas"
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const context =
                                canvas.getContext(
                                    "2d",
                                    {
                                        alpha: false
                                    }
                                );


                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );


                            canvas.toBlob(
                                blob => {

                                    if (!blob) {

                                        reject(
                                            new Error(
                                                "Rasm tayyorlanmadi."
                                            )
                                        );

                                        return;

                                    }


                                    resolve(blob);

                                },

                                "image/webp",

                                MAIN_BACKGROUND_CONFIG.imageQuality
                            );

                        };


                    image.onerror =
                        () => {

                            reject(
                                new Error(
                                    "Rasmni o‘qib bo‘lmadi."
                                )
                            );

                        };


                    image.src =
                        reader.result;

                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Fayl o‘qilmadi."
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   TYPE
========================================================= */

function getMainBackgroundMediaType(
    file
) {

    if (
        file.type?.startsWith(
            "image/"
        )
    ) {
        return "image";
    }


    if (
        file.type?.startsWith(
            "video/"
        )
    ) {
        return "video";
    }


    const name =
        String(
            file.name || ""
        ).toLowerCase();


    if (
        /\.(mp4|webm|mov|m4v|ogg)$/i.test(
            name
        )
    ) {
        return "video";
    }


    if (
        /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(
            name
        )
    ) {
        return "image";
    }


    return null;

}


/* =========================================================
   CREATE ITEM
========================================================= */

async function createMainBackgroundItem(
    file,
    order
) {

    const type =
        getMainBackgroundMediaType(
            file
        );


    if (!type) {

        throw new Error(
            "Faqat rasm yoki video."
        );

    }


    let blob;


    if (type === "image") {

        blob =
            await compressMainBackgroundImage(
                file
            );

    } else {

        blob =
            file;

    }


    return {

        id:
            `${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 10)}`,

        type,

        name:
            file.name || "media",

        blob,

        order,

        createdAt:
            Date.now()

    };

}


/* =========================================================
   LAYER
========================================================= */

function ensureMainBackgroundLayer() {

    if (
        mainBackgroundLayer &&
        document.body.contains(
            mainBackgroundLayer
        )
    ) {
        return mainBackgroundLayer;
    }


    const existing =
        document.getElementById(
            "mainBackgroundMediaLayer"
        );


    if (existing) {

        mainBackgroundLayer =
            existing;

        return existing;

    }


    const world =
        document.getElementById(
            "world"
        );


    const parent =
        world || document.body;


    const layer =
        document.createElement(
            "div"
        );


    layer.id =
        "mainBackgroundMediaLayer";


    layer.setAttribute(
        "aria-hidden",
        "true"
    );


    parent.insertBefore(
        layer,
        parent.firstChild
    );


    mainBackgroundLayer =
        layer;


    return layer;

}


/* =========================================================
   STOP
========================================================= */

function stopMainBackgroundPlayback() {

    if (mainBackgroundTimer) {

        clearTimeout(
            mainBackgroundTimer
        );

        mainBackgroundTimer =
            null;

    }


    if (
        mainBackgroundCurrentElement
    ) {

        try {

            mainBackgroundCurrentElement.pause();

        } catch (_) {}


        mainBackgroundCurrentElement.onended =
            null;

        mainBackgroundCurrentElement.onerror =
            null;

    }


    mainBackgroundCurrentElement =
        null;

}


/* =========================================================
   CLEAR LAYER
========================================================= */

function clearMainBackgroundLayer() {

    stopMainBackgroundPlayback();


    if (mainBackgroundLayer) {

        mainBackgroundLayer.innerHTML =
            "";

    }


    mainBackgroundObjectUrls.forEach(
        url => {

            try {

                URL.revokeObjectURL(
                    url
                );

            } catch (_) {}

        }
    );


    mainBackgroundObjectUrls =
        [];

}


/* =========================================================
   BODY CLASS
========================================================= */

function applyMainBackgroundBodyClass(
    mode
) {

    document.body.classList.remove(
        "main-animated-background",
        "main-custom-background",
        "main-single-background",
        "main-playlist-background"
    );


    if (mode === "animated") {

        document.body.classList.add(
            "main-animated-background"
        );

    }


    if (mode === "single") {

        document.body.classList.add(
            "main-custom-background",
            "main-single-background"
        );

    }


    if (mode === "playlist") {

        document.body.classList.add(
            "main-custom-background",
            "main-playlist-background"
        );

    }

}


/* =========================================================
   HIDE WORLD
========================================================= */

function hideOriginalWorldCompletely() {

    const world =
        document.getElementById(
            "world"
        );


    if (!world) {
        return;
    }


    const layer =
        world.querySelector(
            ".world-layer"
        );


    if (!layer) {
        return;
    }


    layer.style.setProperty(
        "opacity",
        "0",
        "important"
    );


    layer.style.setProperty(
        "visibility",
        "hidden",
        "important"
    );


    layer.style.setProperty(
        "pointer-events",
        "none",
        "important"
    );

}


/* =========================================================
   RESTORE WORLD
========================================================= */

function restoreOriginalWorld() {

    const world =
        document.getElementById(
            "world"
        );


    if (!world) {
        return;
    }


    const layer =
        world.querySelector(
            ".world-layer"
        );


    if (!layer) {
        return;
    }


    layer.style.removeProperty(
        "opacity"
    );


    layer.style.removeProperty(
        "visibility"
    );


    layer.style.removeProperty(
        "pointer-events"
    );

}


/* =========================================================
   ANIMATED
========================================================= */

function useAnimatedMainBackground() {

    stopMainBackgroundPlayback();

    clearMainBackgroundLayer();


    saveMainBackgroundMode(
        "animated"
    );


    applyMainBackgroundBodyClass(
        "animated"
    );


    restoreOriginalWorld();


    if (
        typeof window.rebuildWorldScene ===
        "function"
    ) {

        try {

            window.rebuildWorldScene();

        } catch (error) {

            console.warn(
                "World scene:",
                error
            );

        }

    }


    updateMainBackgroundControls();

    showMainBackgroundStatus(
        "Animatsiyali fon qaytarildi."
    );

}


/* =========================================================
   SHOW MEDIA
========================================================= */

function showMainBackgroundMedia(
    index = 0
) {

    if (
        !mainBackgroundItems.length
    ) {

        useAnimatedMainBackground();

        return;

    }


    if (
        index < 0 ||
        index >=
        mainBackgroundItems.length
    ) {

        index = 0;

    }


    mainBackgroundIndex =
        index;


    const item =
        mainBackgroundItems[
            mainBackgroundIndex
        ];


    if (
        !item ||
        !item.blob
    ) {

        moveToNextMainBackground();

        return;

    }


    stopMainBackgroundPlayback();

    clearMainBackgroundLayer();


    applyMainBackgroundBodyClass(
        mainBackgroundMode
    );


    hideOriginalWorldCompletely();


    const layer =
        ensureMainBackgroundLayer();


    layer.classList.add(
        "is-active"
    );


    const url =
        URL.createObjectURL(
            item.blob
        );


    mainBackgroundObjectUrls.push(
        url
    );


    let element;


    if (
        item.type === "image"
    ) {

        element =
            document.createElement(
                "img"
            );


        element.src =
            url;


        element.alt =
            "";


        element.decoding =
            "async";


        element.onload =
            () => {

                scheduleNextMainBackgroundImage();

            };


        element.onerror =
            () => {

                moveToNextMainBackground();

            };

    } else {

        element =
            document.createElement(
                "video"
            );


        element.src =
            url;


        element.autoplay =
            true;

        element.muted =
            true;

        element.playsInline =
            true;

        element.controls =
            false;

        element.loop =
            false;

        element.preload =
            "auto";


        element.onended =
            () => {

                moveToNextMainBackground();

            };


        element.onerror =
            () => {

                moveToNextMainBackground();

            };

    }


    mainBackgroundCurrentElement =
        element;


    layer.appendChild(
        element
    );


    if (
        item.type === "video"
    ) {

        const promise =
            element.play();


        if (
            promise &&
            typeof promise.catch ===
            "function"
        ) {

            promise.catch(
                error => {

                    console.warn(
                        "Video autoplay:",
                        error
                    );

                }
            );

        }

    }


    updateMainBackgroundControls();


    window.dispatchEvent(
        new CustomEvent(
            "mainbackgroundchange",
            {
                detail: {
                    mode:
                        mainBackgroundMode,

                    index:
                        mainBackgroundIndex,

                    item
                }
            }
        )
    );

}


/* =========================================================
   IMAGE TIMER
========================================================= */

function scheduleNextMainBackgroundImage() {

    const item =
        mainBackgroundItems[
            mainBackgroundIndex
        ];


    if (
        !item ||
        item.type !== "image"
    ) {
        return;
    }


    if (mainBackgroundTimer) {

        clearTimeout(
            mainBackgroundTimer
        );

    }


    mainBackgroundTimer =
        setTimeout(
            () => {

                moveToNextMainBackground();

            },
            getMainBackgroundInterval()
        );

}


/* =========================================================
   NEXT
========================================================= */

function moveToNextMainBackground() {

    stopMainBackgroundPlayback();


    if (
        !mainBackgroundItems.length
    ) {

        useAnimatedMainBackground();

        return;

    }


    let next =
        mainBackgroundIndex + 1;


    if (
        next >=
        mainBackgroundItems.length
    ) {

        next = 0;

    }


    showMainBackgroundMedia(
        next
    );

}


/* =========================================================
   SINGLE
========================================================= */

async function useCustomMainBackground(
    file
) {

    if (!file) {
        return;
    }


    try {

        const item =
            await createMainBackgroundItem(
                file,
                0
            );


        await clearMainBackgroundStorage();


        mainBackgroundItems =
            [item];


        mainBackgroundIndex =
            0;


        saveMainBackgroundMode(
            "single"
        );


        await saveMainBackgroundPlaylist(
            mainBackgroundItems
        );


        showMainBackgroundMedia(
            0
        );


        updateMainBackgroundControls();


        showMainBackgroundStatus(
            "Yangi fon saqlandi."
        );

    } catch (error) {

        console.error(
            error
        );


        showMainBackgroundStatus(
            "Fon saqlanmadi."
        );

    }

}


/* =========================================================
   ADD MULTIPLE
========================================================= */

async function addMainBackgroundMedia(
    files
) {

    const selectedFiles =
        Array.from(
            files || []
        );


    if (
        !selectedFiles.length
    ) {
        return;
    }


    const newItems = [];


    for (
        const file of selectedFiles
    ) {

        try {

            const item =
                await createMainBackgroundItem(
                    file,
                    mainBackgroundItems.length +
                    newItems.length
                );


            newItems.push(
                item
            );

        } catch (error) {

            console.warn(
                file.name,
                error
            );

        }

    }


    if (!newItems.length) {

        showMainBackgroundStatus(
            "Mos rasm yoki video topilmadi."
        );

        return;

    }


    mainBackgroundItems.push(
        ...newItems
    );


    mainBackgroundItems.forEach(
        (item, index) => {

            item.order =
                index;

        }
    );


    await saveMainBackgroundPlaylist(
        mainBackgroundItems
    );


    mainBackgroundSaveMode(
        mainBackgroundItems.length > 1
            ? "playlist"
            : "single"
    );


    mainBackgroundIndex =
        mainBackgroundItems.length -
        newItems.length;


    showMainBackgroundMedia(
        mainBackgroundIndex
    );


    updateMainBackgroundControls();


    showMainBackgroundStatus(
        `${newItems.length} ta media qo‘shildi.`
    );

}


/* =========================================================
   REORDER
========================================================= */

async function reorderMainBackground(
    from,
    to
) {

    if (
        from < 0 ||
        to < 0 ||
        from >=
        mainBackgroundItems.length ||
        to >=
        mainBackgroundItems.length
    ) {
        return;
    }


    const moved =
        mainBackgroundItems.splice(
            from,
            1
        )[0];


    mainBackgroundItems.splice(
        to,
        0,
        moved
    );


    mainBackgroundItems.forEach(
        (item, index) => {

            item.order =
                index;

        }
    );


    await saveMainBackgroundPlaylist(
        mainBackgroundItems
    );


    if (
        mainBackgroundIndex ===
        from
    ) {

        mainBackgroundIndex =
            to;

    } else if (
        from <
        mainBackgroundIndex &&
        to >=
        mainBackgroundIndex
    ) {

        mainBackgroundIndex--;

    } else if (
        from >
        mainBackgroundIndex &&
        to <=
        mainBackgroundIndex
    ) {

        mainBackgroundIndex++;

    }


    showMainBackgroundMedia(
        mainBackgroundIndex
    );

}


/* =========================================================
   REMOVE
========================================================= */

async function removeMainBackground(
    index
) {

    if (
        index < 0 ||
        index >=
        mainBackgroundItems.length
    ) {
        return;
    }


    mainBackgroundItems.splice(
        index,
        1
    );


    await saveMainBackgroundPlaylist(
        mainBackgroundItems
    );


    if (
        !mainBackgroundItems.length
    ) {

        mainBackgroundIndex =
            0;


        useAnimatedMainBackground();

        return;

    }


    if (
        mainBackgroundIndex >=
        mainBackgroundItems.length
    ) {

        mainBackgroundIndex = 0;

    }


    mainBackgroundSaveMode(
        mainBackgroundItems.length > 1
            ? "playlist"
            : "single"
    );


    showMainBackgroundMedia(
        mainBackgroundIndex
    );


    updateMainBackgroundControls();

}


/* =========================================================
   SELECT
========================================================= */

function selectMainBackground(
    index
) {

    if (
        index < 0 ||
        index >=
        mainBackgroundItems.length
    ) {
        return;
    }


    if (
        mainBackgroundItems.length > 1
    ) {

        saveMainBackgroundMode(
            "playlist"
        );

    } else {

        saveMainBackgroundMode(
            "single"
        );

    }


    showMainBackgroundMedia(
        index
    );

}


/* =========================================================
   INTERVAL
========================================================= */

function changeMainBackgroundInterval(
    value
) {

    const interval =
        Number(value);


    if (
        !Number.isFinite(interval) ||
        interval < 2000
    ) {
        return;
    }


    localStorage.setItem(
        MAIN_BACKGROUND_CONFIG.intervalKey,
        String(interval)
    );


    if (
        mainBackgroundItems[
            mainBackgroundIndex
        ]?.type === "image"
    ) {

        scheduleNextMainBackgroundImage();

    }

}


/* =========================================================
   STATUS
========================================================= */

function showMainBackgroundStatus(
    message
) {

    const status =
        document.getElementById(
            "mainBackgroundStatus"
        );


    if (!status) {
        return;
    }


    status.textContent =
        message;


    clearTimeout(
        status._timer
    );


    status._timer =
        setTimeout(
            () => {

                status.textContent =
                    "";

            },
            3500
        );

}


/* =========================================================
   RENDER
   MUHIM:
   Bu funksiya HTML STRING QAYTARADI.
========================================================= */

function renderMainBackgroundControls() {

    const interval =
        getMainBackgroundInterval();


    return `

        <div class="main-background-controls">

            <div>

                <div class="main-background-control-title">
                    Asosiy fon
                </div>

                <div class="main-background-control-description">
                    Animatsiyali sahnani qoldirishing
                    yoki rasm va videolardan o‘z muhitingni
                    yaratishing mumkin.
                </div>

            </div>


            <div class="main-background-mode-row">

                <button
                    type="button"
                    class="main-background-button"
                    data-main-background-mode="animated"
                >
                    ✦ Animatsiya
                </button>


                <button
                    type="button"
                    class="main-background-button"
                    data-main-background-mode="single"
                >
                    ▣ Bitta fon
                </button>


                <button
                    type="button"
                    class="main-background-button"
                    data-main-background-mode="playlist"
                >
                    ◌ Ketma-ket
                </button>

            </div>


            <div class="main-background-upload-row">

                <label class="main-background-file-button">

                    <span>
                        🖼 Rasm / video tanlash
                    </span>

                    <input
                        id="mainBackgroundSingleInput"
                        type="file"
                        accept="image/*,video/*"
                    >

                </label>


                <label class="main-background-file-button">

                    <span>
                        ＋ Bir nechta qo‘shish
                    </span>

                    <input
                        id="mainBackgroundMultipleInput"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                    >

                </label>

            </div>


            <div
                id="mainBackgroundPlaylist"
                class="main-background-playlist"
            ></div>


            <div class="main-background-interval-row">

                <span class="main-background-interval-label">
                    Rasmlar almashish vaqti
                </span>


                <select
                    id="mainBackgroundInterval"
                    class="main-background-interval-select"
                >

                    <option
                        value="3000"
                        ${interval === 3000 ? "selected" : ""}
                    >
                        3 soniya
                    </option>


                    <option
                        value="5000"
                        ${interval === 5000 ? "selected" : ""}
                    >
                        5 soniya
                    </option>


                    <option
                        value="7000"
                        ${interval === 7000 ? "selected" : ""}
                    >
                        7 soniya
                    </option>


                    <option
                        value="10000"
                        ${interval === 10000 ? "selected" : ""}
                    >
                        10 soniya
                    </option>


                    <option
                        value="15000"
                        ${interval === 15000 ? "selected" : ""}
                    >
                        15 soniya
                    </option>


                    <option
                        value="20000"
                        ${interval === 20000 ? "selected" : ""}
                    >
                        20 soniya
                    </option>

                </select>

            </div>


            <button
                id="mainBackgroundReset"
                type="button"
                class="main-background-reset"
            >
                ↺ Asl animatsiyali fonga qaytish
            </button>


            <div
                id="mainBackgroundStatus"
                class="main-background-status"
                aria-live="polite"
            ></div>

        </div>

    `;

}


/* =========================================================
   PLAYLIST RENDER
========================================================= */

function renderMainBackgroundPlaylist() {

    const container =
        document.getElementById(
            "mainBackgroundPlaylist"
        );


    if (!container) {
        return;
    }


    if (
        !mainBackgroundItems.length
    ) {

        container.innerHTML = `

            <div class="main-background-playlist-empty">

                Hozircha rasm yoki video qo‘shilmagan.

            </div>

        `;

        return;

    }


    container.innerHTML = `

        <div class="main-background-playlist-list">

            ${mainBackgroundItems
                .map(
                    (item, index) => {

                        const current =
                            index ===
                            mainBackgroundIndex;


                        let thumbnail = "";


                        if (
                            item.type === "image"
                        ) {

                            const url =
                                URL.createObjectURL(
                                    item.blob
                                );


                            mainBackgroundObjectUrls.push(
                                url
                            );


                            thumbnail = `

                                <img
                                    src="${url}"
                                    alt=""
                                >

                            `;

                        } else {

                            thumbnail = `

                                <span
                                    class="
                                        main-background-playlist-video-icon
                                    "
                                >
                                    ▶
                                </span>

                            `;

                        }


                        return `

                            <div
                                class="
                                    main-background-playlist-item
                                    ${current ? "is-current" : ""}
                                "
                            >

                                <div
                                    class="
                                        main-background-playlist-thumb
                                    "
                                >
                                    ${thumbnail}
                                </div>


                                <button
                                    type="button"
                                    class="
                                        main-background-playlist-name
                                    "
                                    data-bg-select="${index}"
                                >
                                    ${mbEscapeHtml(
                                        item.name
                                    )}
                                </button>


                                <div
                                    class="
                                        main-background-playlist-actions
                                    "
                                >

                                    <button
                                        type="button"
                                        class="
                                            main-background-playlist-action
                                        "
                                        data-bg-up="${index}"
                                        ${index === 0 ? "disabled" : ""}
                                        title="Yuqoriga"
                                    >
                                        ↑
                                    </button>


                                    <button
                                        type="button"
                                        class="
                                            main-background-playlist-action
                                        "
                                        data-bg-down="${index}"
                                        ${
                                            index ===
                                            mainBackgroundItems.length - 1
                                                ? "disabled"
                                                : ""
                                        }
                                        title="Pastga"
                                    >
                                        ↓
                                    </button>


                                    <button
                                        type="button"
                                        class="
                                            main-background-playlist-action
                                        "
                                        data-bg-delete="${index}"
                                        title="O‘chirish"
                                    >
                                        ×
                                    </button>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("")}

        </div>

    `;


    container
        .querySelectorAll(
            "[data-bg-select]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectMainBackground(
                            Number(
                                button.dataset.bgSelect
                            )
                        );

                    }
                );

            }
        );


    container
        .querySelectorAll(
            "[data-bg-up]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const index =
                            Number(
                                button.dataset.bgUp
                            );


                        if (
                            index > 0
                        ) {

                            await reorderMainBackground(
                                index,
                                index - 1
                            );

                        }

                    }
                );

            }
        );


    container
        .querySelectorAll(
            "[data-bg-down]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const index =
                            Number(
                                button.dataset.bgDown
                            );


                        if (
                            index <
                            mainBackgroundItems.length - 1
                        ) {

                            await reorderMainBackground(
                                index,
                                index + 1
                            );

                        }

                    }
                );

            }
        );


    container
        .querySelectorAll(
            "[data-bg-delete]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await removeMainBackground(
                            Number(
                                button.dataset.bgDelete
                            )
                        );

                    }
                );

            }
        );

}


/* =========================================================
   UPDATE CONTROLS
========================================================= */

function updateMainBackgroundControls() {

    document
        .querySelectorAll(
            "[data-main-background-mode]"
        )
        .forEach(
            button => {

                const mode =
                    button.dataset
                        .mainBackgroundMode;


                button.classList.toggle(
                    "is-active",
                    mode ===
                    mainBackgroundMode
                );

            }
        );


    renderMainBackgroundPlaylist();

}


/* =========================================================
   EVENTS
========================================================= */

function bindMainBackgroundControls() {

    const container =
        document.getElementById(
            "mainBackgroundControls"
        );


    if (!container) {
        return;
    }


    container
        .querySelectorAll(
            "[data-main-background-mode]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const mode =
                            button.dataset
                                .mainBackgroundMode;


                        if (
                            mode === "animated"
                        ) {

                            useAnimatedMainBackground();

                            return;

                        }


                        if (
                            !mainBackgroundItems.length
                        ) {

                            showMainBackgroundStatus(
                                "Avval rasm yoki video tanlang."
                            );

                            return;

                        }


                        saveMainBackgroundMode(
                            mode === "playlist" &&
                            mainBackgroundItems.length > 1
                                ? "playlist"
                                : "single"
                        );


                        showMainBackgroundMedia(
                            mainBackgroundIndex
                        );


                        updateMainBackgroundControls();

                    }
                );

            }
        );


    const singleInput =
        document.getElementById(
            "mainBackgroundSingleInput"
        );


    singleInput?.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files?.[0];


            if (file) {

                await useCustomMainBackground(
                    file
                );

            }


            event.target.value =
                "";

        }
    );


    const multipleInput =
        document.getElementById(
            "mainBackgroundMultipleInput"
        );


    multipleInput?.addEventListener(
        "change",
        async event => {

            await addMainBackgroundMedia(
                event.target.files
            );


            event.target.value =
                "";

        }
    );


    const interval =
        document.getElementById(
            "mainBackgroundInterval"
        );


    interval?.addEventListener(
        "change",
        event => {

            changeMainBackgroundInterval(
                event.target.value
            );

        }
    );


    const reset =
        document.getElementById(
            "mainBackgroundReset"
        );


    reset?.addEventListener(
        "click",
        () => {

            resetMainBackground();

        }
    );

}


/* =========================================================
   RESET
========================================================= */

async function resetMainBackground() {

    stopMainBackgroundPlayback();

    clearMainBackgroundLayer();


    try {

        await clearMainBackgroundStorage();

    } catch (error) {

        console.warn(
            error
        );

    }


    mainBackgroundItems =
        [];

    mainBackgroundIndex =
        0;


    saveMainBackgroundMode(
        "animated"
    );


    restoreOriginalWorld();


    applyMainBackgroundBodyClass(
        "animated"
    );


    if (
        typeof window.rebuildWorldScene ===
        "function"
    ) {

        try {

            window.rebuildWorldScene();

        } catch (_) {}

    }


    updateMainBackgroundControls();


    showMainBackgroundStatus(
        "Asl animatsiyali fon qaytarildi."
    );

}


/* =========================================================
   RESTORE
========================================================= */

async function restoreMainBackground() {

    if (
        mainBackgroundRestored
    ) {
        return;
    }


    mainBackgroundRestored =
        true;


    injectMainBackgroundStyles();

    ensureMainBackgroundLayer();


    try {

        mainBackgroundItems =
            await loadMainBackgroundPlaylist();

    } catch (error) {

        console.warn(
            "Playlist yuklanmadi:",
            error
        );

        mainBackgroundItems =
            [];

    }


    const savedMode =
        getSavedMainBackgroundMode();


    /* Eski image rejimini migratsiya qilish */

    if (
        !mainBackgroundItems.length &&
        (
            savedMode === "image" ||
            savedMode === "single" ||
            savedMode === "playlist"
        )
    ) {

        const old =
            await loadOldMainBackground();


        if (
            old &&
            old.blob
        ) {

            const migrated = {

                id:
                    `migrated_${Date.now()}`,

                type:
                    "image",

                name:
                    "Oldingi saqlangan fon",

                blob:
                    old.blob,

                order:
                    0,

                createdAt:
                    Date.now()

            };


            mainBackgroundItems =
                [migrated];


            try {

                await saveMainBackgroundPlaylist(
                    mainBackgroundItems
                );

            } catch (_) {}

        }

    }


    if (
        mainBackgroundItems.length
    ) {

        mainBackgroundMode =
            savedMode === "playlist" &&
            mainBackgroundItems.length > 1
                ? "playlist"
                : "single";


        saveMainBackgroundMode(
            mainBackgroundMode
        );


        mainBackgroundIndex =
            0;


        showMainBackgroundMedia(
            0
        );

    } else {

        mainBackgroundMode =
            "animated";


        saveMainBackgroundMode(
            "animated"
        );


        showAnimatedMainBackground();

    }


    updateMainBackgroundControls();

}


/* =========================================================
   INIT
========================================================= */

async function initMainBackground() {

    injectMainBackgroundStyles();

    ensureMainBackgroundLayer();


    if (
        mainBackgroundInitialized
    ) {

        bindMainBackgroundControls();

        updateMainBackgroundControls();

        return;

    }


    mainBackgroundInitialized =
        true;


    await restoreMainBackground();


    bindMainBackgroundControls();

}


/* =========================================================
   PUBLIC API
========================================================= */

window.MainBackground = {

    render:
        renderMainBackgroundControls,

    init:
        initMainBackground,

    restore:
        restoreMainBackground,

    animated:
        useAnimatedMainBackground,

    image:
        useCustomMainBackground,

    add:
        addMainBackgroundMedia,

    clear:
        resetMainBackground,

    next:
        moveToNextMainBackground,

    select:
        selectMainBackground

};


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            initMainBackground();

        },
        {
            once: true
        }
    );

} else {

    initMainBackground();

}