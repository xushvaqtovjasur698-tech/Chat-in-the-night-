"use strict";


/* =====================================================
   SOCKET
===================================================== */

function initializeSocket() {

    if (state.socket) {
        return;
    }

    if (typeof io !== "function") {

        console.warn(
            "Socket.IO yuklanmagan."
        );

        return;
    }

    state.socket = io();

    state.socket.on(
        "connect",
        () => {

            showToast(
                "Real-time ulanish tayyor."
            );

            if (
                typeof checkUnreadChat === "function"
            ) {

                checkUnreadChat();

            }

        }
    );

    state.socket.on(
        "chat_message",
        message => {

            if (
                typeof onChatMessage === "function"
            ) {

                onChatMessage(message);

            }

        }
    );

    state.socket.on(
        "disconnect",
        () => {

            console.log(
                "Real-time ulanish uzildi."
            );

        }
    );

}


/* =====================================================
   LOGIN
===================================================== */

async function login() {

    const nameInput =
        $("loginName");

    const passwordInput =
        $("loginPassword");

    const error =
        $("entryError");

    const button =
        $("entryButton");


    if (
        !nameInput ||
        !passwordInput ||
        !error ||
        !button
    ) {

        return;

    }


    const name =
        nameInput.value.trim();

    const password =
        passwordInput.value;


    /* =================================================
       VALIDATION
    ================================================= */

    if (!name) {

        error.textContent =
            "Ismingizni kiriting.";

        nameInput.focus();

        return;

    }


    if (!password) {

        error.textContent =
            "Parolingizni kiriting.";

        passwordInput.focus();

        return;

    }


    error.textContent = "";


    loading(
        button,
        true,
        "Tekshirilmoqda..."
    );


    try {

        const result =
            await apiPost(
                "/login",
                {
                    name,
                    password,
                    device_id:
                        getDeviceId()
                }
            );


        /* =============================================
           LOGIN ERROR
        ============================================= */

        const loginSuccess =
            result &&
            (
                result.success === true ||
                result.ok === true
            );


        if (!loginSuccess) {

            error.textContent =
                result?.error ||
                "Ism yoki parol noto‘g‘ri.";


            if (
                result?.blocked &&
                result?.remaining_seconds
            ) {

                error.textContent =
                    `${result.error || "Juda ko‘p urinish."} ` +
                    `Qolgan vaqt: ` +
                    `${result.remaining_seconds} soniya.`;

            }

            passwordInput.select();

            return;

        }


        /* =============================================
           USER INFORMATION
        ============================================= */

        const user =
            result.user || {};


        state.userId =
            user.id ??
            null;


        state.role =
            user.role ??
            "";


        state.name =
            user.name ||
            user.display_name ||
            user.account_name ||
            user.username ||
            "";


        /* =============================================
           SOCKET
        ============================================= */

        initializeSocket();


        /* =============================================
           INTRO
        ============================================= */

        show("intro");


        window.setTimeout(
            () => {

                /*
                 * Profil nomi mavjud bo‘lsa,
                 * ism oynasini qayta ko‘rsatmaymiz.
                 */

                if (
                    state.name &&
                    state.name.trim()
                ) {

                    enterWorld();

                    return;

                }


                /*
                 * Ism mavjud bo‘lmasa,
                 * eski nameGate oqimini saqlaymiz.
                 */

                show("nameGate");


                const nameGateInput =
                    $("nameInput");


                if (nameGateInput) {

                    nameGateInput.focus();

                }

            },
            1800
        );


    } catch (errorObject) {

        console.error(
            "Login xatosi:",
            errorObject
        );


        error.textContent =
            "Server bilan ulanishda xatolik.";


    } finally {

        loading(
            button,
            false,
            "Kirish"
        );

    }

}


/* =====================================================
   CREATE ACCOUNT
===================================================== */

async function createAccount() {

    const nameInput =
        $("createName");

    const passwordInput =
        $("createPassword");

    const confirmInput =
        $("createPasswordConfirm");

    const error =
        $("createAccountError");

    const button =
        $("createAccountSubmit");


    if (
        !nameInput ||
        !passwordInput ||
        !confirmInput ||
        !error ||
        !button
    ) {

        return;

    }


    const name =
        nameInput.value.trim();

    const password =
        passwordInput.value;

    const confirmPassword =
        confirmInput.value;


    /* =================================================
       VALIDATION
    ================================================= */

    error.textContent = "";


    if (!name) {

        error.textContent =
            "Yangi hisob uchun ismingizni kiriting.";

        nameInput.focus();

        return;

    }


    if (name.length < 2) {

        error.textContent =
            "Ism kamida 2 ta belgidan iborat bo‘lsin.";

        nameInput.focus();

        return;

    }


    if (!password) {

        error.textContent =
            "Yangi hisob uchun parol kiriting.";

        passwordInput.focus();

        return;

    }


    if (password.length < 6) {

        error.textContent =
            "Parol kamida 6 ta belgidan iborat bo‘lsin.";

        passwordInput.focus();

        return;

    }


    if (!confirmPassword) {

        error.textContent =
            "Parolni tasdiqlang.";

        confirmInput.focus();

        return;

    }


    if (password !== confirmPassword) {

        error.textContent =
            "Parollar bir xil emas.";

        confirmInput.focus();

        return;

    }


    /* =================================================
       LOADING
    ================================================= */

    loading(
        button,
        true,
        "Yaratilmoqda..."
    );


    try {

        const result =
            await apiPost(
                "/register",
                {
                    name,
                    password,
                    device_id:
                        getDeviceId()
                }
            );


        /* =============================================
           REGISTER ERROR
        ============================================= */

        const registerSuccess =
            result &&
            (
                result.success === true ||
                result.ok === true
            );


        if (!registerSuccess) {

            error.textContent =
                result?.error ||
                "Hisob yaratib bo‘lmadi.";

            return;

        }


        /* =============================================
           USER INFORMATION
        ============================================= */

        const user =
            result.user || {};


        state.userId =
            user.id ??
            null;


        state.role =
            user.role ??
            "user";


        state.name =
            user.name ||
            user.display_name ||
            user.account_name ||
            user.username ||
            name;


        /* =============================================
           SOCKET
        ============================================= */

        initializeSocket();


        /* =============================================
           CLOSE CREATE ACCOUNT WINDOW
        ============================================= */

        if (
            typeof window.closeCreateAccount ===
            "function"
        ) {

            window.closeCreateAccount();

        }


        /* =============================================
           CLEAR CREATE ACCOUNT FORM
        ============================================= */

        nameInput.value = "";
        passwordInput.value = "";
        confirmInput.value = "";
        error.textContent = "";


        /* =============================================
           INTRO
        ============================================= */

        show("intro");


        window.setTimeout(
            () => {

                enterWorld();

            },
            1800
        );


    } catch (errorObject) {

        console.error(
            "Hisob yaratish xatosi:",
            errorObject
        );

        error.textContent =
            errorObject?.message ||
            "Server bilan ulanishda xatolik.";

    } finally {

        loading(
            button,
            false,
            "Hisob yaratish"
        );

    }

}


/* =====================================================
   FIRST NAME
===================================================== */

async function saveFirstName() {

    const input =
        $("nameInput");

    const error =
        $("nameError");

    const button =
        $("nameButton");


    if (
        !input ||
        !error ||
        !button
    ) {

        return;

    }


    const name =
        input.value.trim();


    if (!name) {

        error.textContent =
            "Ismingizni kiriting.";

        input.focus();

        return;

    }


    if (
        name.length < 2
    ) {

        error.textContent =
            "Ism juda qisqa.";

        input.focus();

        return;

    }


    error.textContent = "";


    loading(
        button,
        true,
        "Saqlanmoqda..."
    );


    try {

        const result =
            await updateProfileName(
                name
            );


        if (
            !result ||
            !(
                result.success === true ||
                result.ok === true
            )
        ) {

            error.textContent =
                result?.error ||
                "Ismni saqlab bo‘lmadi.";

            return;

        }


        state.name =
            result.name ||
            result.display_name ||
            name;


        enterWorld();


    } catch (errorObject) {

        console.error(
            "Ismni saqlash xatosi:",
            errorObject
        );


        error.textContent =
            "Server bilan ulanishda xatolik.";


    } finally {

        loading(
            button,
            false,
            "Davom etish"
        );

    }

}


/* =====================================================
   ENTER WORLD
===================================================== */

function enterWorld() {

    const profileName =
        $("profilePillName");


    if (profileName) {

        profileName.textContent =
            state.name ||
            "Profil";

    }


    show("world");


    state.initialized =
        true;


    if (
        typeof checkUnreadChat === "function"
    ) {

        checkUnreadChat();

    }

}


/* =====================================================
   INIT AUTH
===================================================== */

function initAuth() {

    const entryButton =
        $("entryButton");

    const loginName =
        $("loginName");

    const loginPassword =
        $("loginPassword");

    const createAccountButton =
        $("createAccountButton");

    const createName =
        $("createName");

    const createPassword =
        $("createPassword");

    const createPasswordConfirm =
        $("createPasswordConfirm");

    const createAccountSubmit =
        $("createAccountSubmit");

    const nameButton =
        $("nameButton");

    const nameInput =
        $("nameInput");


    /* =================================================
       LOGIN BUTTON
    ================================================= */

    if (entryButton) {

        entryButton.addEventListener(
            "click",
            login
        );

    }


    /* =================================================
       LOGIN NAME ENTER
    ================================================= */

    if (loginName) {

        loginName.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    if (loginPassword) {

                        loginPassword.focus();

                    }

                }

            }
        );

    }


    /* =================================================
       LOGIN PASSWORD ENTER
    ================================================= */

    if (loginPassword) {

        loginPassword.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    login();

                }

            }
        );

    }


    /* =================================================
       CREATE ACCOUNT OPEN
       
       Muhim:
       index.html ichidagi yangi kod bu tugmani
       modalni ochish uchun ishlatyapti.
       
       Shuning uchun bu yerda createAccount()
       chaqirilmaydi.
    ================================================= */

    if (createAccountButton) {

        /*
         * Modalni index.html ochadi.
         * Bu joy ataylab bo‘sh qoldirildi.
         */

    }


    /* =================================================
       CREATE ACCOUNT SUBMIT
    ================================================= */

    if (createAccountSubmit) {

        createAccountSubmit.addEventListener(
            "click",
            createAccount
        );

    }


    /* =================================================
       CREATE ACCOUNT NAME ENTER
    ================================================= */

    if (createName) {

        createName.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    if (createPassword) {

                        createPassword.focus();

                    }

                }

            }
        );

    }


    /* =================================================
       CREATE ACCOUNT PASSWORD ENTER
    ================================================= */

    if (createPassword) {

        createPassword.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    if (createPasswordConfirm) {

                        createPasswordConfirm.focus();

                    }

                }

            }
        );

    }


    /* =================================================
       CREATE ACCOUNT CONFIRM PASSWORD ENTER
    ================================================= */

    if (createPasswordConfirm) {

        createPasswordConfirm.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    createAccount();

                }

            }
        );

    }


    /* =================================================
       NAME GATE
    ================================================= */

    if (nameButton) {

        nameButton.addEventListener(
            "click",
            saveFirstName
        );

    }


    if (nameInput) {

        nameInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    saveFirstName();

                }

            }
        );

    }

}


initAuth();