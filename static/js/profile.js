"use strict";


/* =====================================================
   PROFILE
===================================================== */


/* =====================================================
   PROFILE SHEET
===================================================== */

function renderProfileSheet() {

    return `
        <div class="profile-section">

            <div class="profile-hero">

                <div
                    id="profileAvatar"
                    class="profile-avatar"
                    aria-hidden="true"
                >
                    ✦
                </div>

                <div class="profile-info">

                    <div class="sheet-kicker">
                        profil
                    </div>

                    <h3
                        id="profileDisplayName"
                        class="profile-name"
                    >
                        ${escapeHtml(
                            state.name ||
                            "Profil"
                        )}
                    </h3>

                    <p
                        id="profileRole"
                        class="profile-role"
                    >
                        ${escapeHtml(
                            state.role ||
                            "user"
                        )}
                    </p>

                </div>

            </div>


            <div class="sheet-field">

                <label
                    class="sheet-label"
                    for="profileNameInput"
                >
                    Ism
                </label>

                <input
                    id="profileNameInput"
                    class="sheet-input"
                    type="text"
                    maxlength="40"
                    autocomplete="name"
                    value="${escapeHtml(
                        state.name || ""
                    )}"
                    placeholder="Isming..."
                >

            </div>


            <div class="sheet-actions">

                <button
                    id="profileSaveButton"
                    class="sheet-button"
                    type="button"
                >
                    Saqlash
                </button>

                <button
                    id="profileLogoutButton"
                    class="sheet-button secondary"
                    type="button"
                >
                    Chiqish
                </button>

            </div>


            <div
                id="profileStatus"
                class="sheet-empty"
                hidden
            ></div>

        </div>
    `;

}


/* =====================================================
   UPDATE PROFILE VIEW
===================================================== */

function updateProfileView() {

    const pillName =
        $("profilePillName");

    if (pillName) {

        pillName.textContent =
            state.name ||
            "Profil";

    }


    const displayName =
        $("profileDisplayName");

    if (displayName) {

        displayName.textContent =
            state.name ||
            "Profil";

    }


    const role =
        $("profileRole");

    if (role) {

        role.textContent =
            state.role ||
            "user";

    }

}


/* =====================================================
   SAVE PROFILE
===================================================== */

async function saveProfile() {

    const input =
        $("profileNameInput");

    const button =
        $("profileSaveButton");

    const status =
        $("profileStatus");


    if (
        !input ||
        !button
    ) {
        return;
    }


    const name =
        input.value.trim();


    if (!name) {

        if (status) {

            status.hidden = false;

            status.textContent =
                "Ismni kiriting.";

        }

        input.focus();

        return;

    }


    if (name.length < 2) {

        if (status) {

            status.hidden = false;

            status.textContent =
                "Ism juda qisqa.";

        }

        input.focus();

        return;

    }


    if (status) {

        status.hidden = false;

        status.textContent =
            "Saqlanmoqda...";

    }


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
            !result.success
        ) {

            if (status) {

                status.hidden = false;

                status.textContent =
                    result?.error ||
                    "Profilni saqlab bo‘lmadi.";

            }

            return;

        }


        state.name =
            result.name ||
            name;


        updateProfileView();


        if (status) {

            status.hidden = false;

            status.textContent =
                "Profil saqlandi.";

        }


        showToast(
            "Profil yangilandi."
        );


    } catch (error) {

        console.error(
            "Profil saqlash xatosi:",
            error
        );


        if (status) {

            status.hidden = false;

            status.textContent =
                "Server bilan ulanishda xatolik.";

        }

    } finally {

        loading(
            button,
            false,
            "Saqlash"
        );

    }

}


/* =====================================================
   LOGOUT
===================================================== */

async function logoutProfile() {

    const button =
        $("profileLogoutButton");


    if (button) {

        loading(
            button,
            true,
            "Chiqilmoqda..."
        );

    }


    try {

        await logoutUser();

    } catch (error) {

        console.warn(
            "Logout server xatosi:",
            error
        );

    }


    /*
     * Lokal holatni tozalaymiz.
     */

    state.userId = null;
    state.role = null;
    state.name = "";
    state.sheet = "";
    state.menuOpen = false;
    state.initialized = false;


    if (state.socket) {

        state.socket.disconnect();

        state.socket = null;

    }


    closeSheet();
    closeMenu();


    const code =
        $("accessCode");

    const error =
        $("entryError");

    const nameInput =
        $("nameInput");

    const nameError =
        $("nameError");


    if (code) {
        code.value = "";
    }

    if (error) {
        error.textContent = "";
    }

    if (nameInput) {
        nameInput.value = "";
    }

    if (nameError) {
        nameError.textContent = "";
    }


    show("entry");


    if (code) {
        code.focus();
    }

}


/* =====================================================
   INIT PROFILE
===================================================== */

function initProfile() {

    const saveButton =
        $("profileSaveButton");

    const logoutButton =
        $("profileLogoutButton");

    const input =
        $("profileNameInput");


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveProfile
        );

    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutProfile
        );

    }


    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    saveProfile();

                }

            }
        );

    }


    updateProfileView();

}


/* =====================================================
   REGISTER PROFILE SHEET
===================================================== */

if (
    typeof window.sheets === "undefined"
) {

    window.sheets = {};

}


window.sheets.profile = {

    title: "Profil",

    render:
        renderProfileSheet,

    init:
        initProfile

};


var sheets = window.sheets;