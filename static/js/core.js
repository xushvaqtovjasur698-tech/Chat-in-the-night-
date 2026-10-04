"use strict";


/* =====================================================
   CONFIG
===================================================== */

const API_BASE = "/api";

const KEY = {
    deviceId:
        "marjona_site_device_id"
};


/* =====================================================
   STATE
===================================================== */

const state = {
    userId: null,
    role: null,
    name: "",
    sheet: "",
    menuOpen: false,
    initialized: false,
    socket: null
};


/* =====================================================
   DOM HELPER
===================================================== */

const $ = id =>
    document.getElementById(id);


/* =====================================================
   SCREENS
===================================================== */

const screens = [
    $("entry"),
    $("intro"),
    $("nameGate"),
    $("world")
];


/* =====================================================
   HTML HELPER
===================================================== */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =====================================================
   SCREEN HELPER
===================================================== */

function show(id) {

    screens.forEach(
        screen => {

            if (!screen) {
                return;
            }

            screen.classList.toggle(
                "active",
                screen.id === id
            );

        }
    );
}


/* =====================================================
   DEVICE ID
===================================================== */

function getDeviceId() {

    let id =
        localStorage.getItem(
            KEY.deviceId
        );


    if (!id) {

        id =
            window.crypto &&
            typeof crypto.randomUUID ===
            "function"

                ? crypto.randomUUID()

                : (
                    Date.now() +
                    "-" +
                    Math.random()
                        .toString(16)
                        .slice(2)
                );


        localStorage.setItem(
            KEY.deviceId,
            id
        );

    }


    return id;
}


/* =====================================================
   API
===================================================== */

async function api(
    path,
    options = {}
) {

    const config = {

        method:
            options.method ||
            "GET",

        headers: {

            "Content-Type":
                "application/json"

        },

        credentials:
            "same-origin"

    };


    if (
        Object.prototype
            .hasOwnProperty
            .call(
                options,
                "body"
            )
    ) {

        config.body =
            JSON.stringify(
                options.body
            );

    }


    const response =
        await fetch(
            API_BASE + path,
            config
        );


    let data = {};


    try {

        data =
            await response.json();

    } catch {

        data = {};

    }


    if (!response.ok) {

        const error =
            new Error(
                data.error ||
                `So‘rov bajarilmadi (${response.status}).`
            );


        error.status =
            response.status;


        error.data =
            data;


        throw error;

    }


    return data;
}


/* =====================================================
   TOAST
===================================================== */

function toast(message) {

    let element =
        $("toast");


    if (!element) {

        element =
            document.createElement(
                "div"
            );


        element.id =
            "toast";


        element.style.cssText = `
            position:fixed;
            left:50%;
            bottom:28px;
            z-index:200;
            transform:translate(-50%,18px);
            opacity:0;
            pointer-events:none;
            padding:11px 17px;
            border-radius:999px;
            border:1px solid rgba(255,255,255,.09);
            background:rgba(15,17,24,.86);
            backdrop-filter:blur(18px);
            color:rgba(255,255,255,.88);
            font-size:12px;
            transition:.45s cubic-bezier(.22,1,.36,1);
        `;


        document.body.appendChild(
            element
        );

    }


    element.textContent =
        message;


    element.style.opacity =
        "1";


    element.style.transform =
        "translate(-50%,0)";


    clearTimeout(
        toast.timer
    );


    toast.timer =
        setTimeout(
            () => {

                element.style.opacity =
                    "0";


                element.style.transform =
                    "translate(-50%,18px)";

            },
            2400
        );

}


/* =====================================================
   PUBLIC TOAST ALIAS
===================================================== */

function showToast(message) {

    toast(message);

}


/* =====================================================
   BUTTON LOADING
===================================================== */

function loading(
    button,
    value,
    text
) {

    if (!button) {
        return;
    }


    if (value) {

        button.disabled =
            true;


        button.dataset.oldText =
            button.textContent;


        button.textContent =
            text;

    } else {

        button.disabled =
            false;


        button.textContent =
            button.dataset.oldText ||
            button.textContent;

    }

}


/* =====================================================
   LOCAL TIME
===================================================== */

function fmtLocal(iso) {

    try {

        return new Date(
            iso
        ).toLocaleString(
            "uz-UZ"
        );

    } catch {

        return iso;

    }

}


/* =====================================================
   CHAT SEEN KEY
===================================================== */

function chatSeenKey() {

    return "chatSeen_" +
        state.userId;

}


/* =====================================================
   CHAT BADGE
===================================================== */

function setChatBadge(on) {

    const item =
        document.querySelector(
            '[data-sheet="chat"]'
        );


    if (!item) {
        return;
    }


    let dot =
        item.querySelector(
            ".chat-dot"
        );


    if (
        on &&
        !dot
    ) {

        dot =
            document.createElement(
                "span"
            );


        dot.className =
            "chat-dot";


        dot.style.cssText =
            `
            display:inline-block;
            width:9px;
            height:9px;
            margin-left:8px;
            border-radius:50%;
            background:#ff5d8f
            `;


        item.appendChild(
            dot
        );

    }


    if (
        !on &&
        dot
    ) {

        dot.remove();

    }

}


/* =====================================================
   GLOBAL DEVICE INITIALIZATION
===================================================== */

getDeviceId();