"use strict";


/* =====================================================
   LETTERS
===================================================== */


/* =====================================================
   LETTER SHEET
===================================================== */

function renderLettersSheet() {

    return `
        <div class="letters-section">

            <div
                id="lettersList"
                class="letters-list"
            >
                <div class="sheet-empty">
                    Xatlar yuklanmoqda...
                </div>
            </div>

            <div class="sheet-actions">
                <button
                    id="newLetterButton"
                    class="sheet-button"
                    type="button"
                >
                    Yangi xat
                </button>
            </div>

            <div
                id="letterEditor"
                class="letter-editor"
                hidden
            >

                <div class="sheet-field">

                    <label
                        class="sheet-label"
                        for="letterTitle"
                    >
                        Sarlavha
                    </label>

                    <input
                        id="letterTitle"
                        class="sheet-input"
                        type="text"
                        maxlength="120"
                        placeholder="Xat sarlavhasi..."
                    >

                </div>


                <div class="sheet-field">

                    <label
                        class="sheet-label"
                        for="letterRecipient"
                    >
                        Kimga
                    </label>

                    <select
                        id="letterRecipient"
                        class="sheet-input"
                    >
                        <option value="">
                            Tanlang...
                        </option>
                    </select>

                </div>


                <div class="sheet-field">

                    <label
                        class="sheet-label"
                        for="letterVisibility"
                    >
                        Ko‘rinishi
                    </label>

                    <select
                        id="letterVisibility"
                        class="sheet-input"
                    >
                        <option value="both">
                            Ikkalamiz
                        </option>

                        <option value="private">
                            Faqat men
                        </option>
                    </select>

                </div>


                <div class="sheet-field">

                    <label
                        class="sheet-label"
                        for="letterOpenAt"
                    >
                        Ochilish vaqti
                    </label>

                    <input
                        id="letterOpenAt"
                        class="sheet-input"
                        type="datetime-local"
                    >

                </div>


                <div class="sheet-field">

                    <label
                        class="sheet-label"
                        for="letterBody"
                    >
                        Xat
                    </label>

                    <textarea
                        id="letterBody"
                        class="sheet-textarea"
                        maxlength="10000"
                        placeholder="Bu yerga xatingni yoz..."
                    ></textarea>

                </div>


                <div class="sheet-actions">

                    <button
                        id="saveLetterButton"
                        class="sheet-button"
                        type="button"
                    >
                        Xatni saqlash
                    </button>

                    <button
                        id="cancelLetterButton"
                        class="sheet-button secondary"
                        type="button"
                    >
                        Bekor qilish
                    </button>

                </div>

            </div>

        </div>
    `;

}


/* =====================================================
   DATE
===================================================== */

function formatLetterDate(value) {

    if (!value) {
        return "";
    }

    try {

        return new Date(value)
            .toLocaleString(
                "uz-UZ",
                {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    } catch {

        return "";

    }

}


/* =====================================================
   LOAD USERS
===================================================== */

async function loadLetterRecipients() {

    const select =
        $("letterRecipient");

    if (!select) {
        return;
    }


    try {

        const result =
            await getUsers();


        if (
            !result ||
            !result.success
        ) {

            return;

        }


        const users =
            Array.isArray(result.users)
                ? result.users
                : [];


        select.innerHTML = `
            <option value="">
                Tanlang...
            </option>
        `;


        users
            .filter(
                user =>
                    Number(user.id) !==
                    Number(state.userId)
            )
            .forEach(
                user => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        user.id;

                    option.textContent =
                        user.display_name ||
                        user.name ||
                        "Foydalanuvchi";

                    select.appendChild(
                        option
                    );

                }
            );


    } catch (error) {

        console.error(
            "Qabul qiluvchilarni yuklash xatosi:",
            error
        );

    }

}


/* =====================================================
   LOAD LETTERS
===================================================== */

async function loadLetters() {

    const container =
        $("lettersList");

    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="sheet-empty">
            Xatlar yuklanmoqda...
        </div>
    `;


    try {

        const result =
            await apiGet(
                "/letters"
            );


        if (
            !result ||
            !result.success
        ) {

            container.innerHTML = `
                <div class="sheet-empty">
                    Xatlarni yuklab bo‘lmadi.
                </div>
            `;

            return;

        }


        const letters =
            Array.isArray(result.letters)
                ? result.letters
                : [];


        if (!letters.length) {

            container.innerHTML = `
                <div class="sheet-empty">
                    Hali xatlar yo‘q.
                </div>
            `;

            return;

        }


        container.innerHTML =
            letters
                .map(
                    letter => {

                        const title =
                            escapeHtml(
                                letter.title ||
                                "Nomsiz xat"
                            );

                        const preview =
                            escapeHtml(
                                letter.body ||
                                ""
                            );

                        const sender =
                            escapeHtml(
                                letter.sender_name ||
                                letter.author_name ||
                                letter.name ||
                                ""
                            );

                        const recipient =
                            escapeHtml(
                                letter.recipient_name ||
                                ""
                            );

                        const openAt =
                            formatLetterDate(
                                letter.open_at ||
                                letter.opened_at ||
                                letter.scheduled_at
                            );


                        const locked =
                            Boolean(
                                letter.locked ||
                                letter.is_locked
                            );


                        return `
                            <article
                                class="letter-card ${locked ? "locked" : ""}"
                            >

                                <div class="letter-card-top">

                                    <h3 class="letter-card-title">
                                        ${title}
                                    </h3>

                                    ${
                                        locked
                                            ? `
                                                <span class="letter-card-status">
                                                    🔒
                                                </span>
                                              `
                                            : ""
                                    }

                                </div>


                                ${
                                    sender || recipient
                                        ? `
                                            <div class="letter-card-meta">
                                                ${
                                                    sender
                                                        ? `Kimdan: ${sender}`
                                                        : ""
                                                }

                                                ${
                                                    recipient
                                                        ? ` · Kimga: ${recipient}`
                                                        : ""
                                                }
                                            </div>
                                          `
                                        : ""
                                }


                                ${
                                    openAt
                                        ? `
                                            <div class="letter-card-date">
                                                ${
                                                    locked
                                                        ? `Ochiladi: ${openAt}`
                                                        : `Ochilgan: ${openAt}`
                                                }
                                            </div>
                                          `
                                        : ""
                                }


                                <div class="letter-card-preview">
                                    ${
                                        locked
                                            ? "Bu xat hali ochilmagan."
                                            : preview
                                    }
                                </div>

                            </article>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "Xatlar xatosi:",
            error
        );

        container.innerHTML = `
            <div class="sheet-empty">
                Xatlar bilan ishlashda xatolik.
            </div>
        `;

    }

}


/* =====================================================
   OPEN LETTER EDITOR
===================================================== */

function openLetterEditor() {

    const editor =
        $("letterEditor");

    if (!editor) {
        return;
    }


    editor.hidden = false;


    const title =
        $("letterTitle");

    if (title) {
        title.focus();
    }


    loadLetterRecipients();

}


/* =====================================================
   CLOSE LETTER EDITOR
===================================================== */

function closeLetterEditor() {

    const editor =
        $("letterEditor");

    if (!editor) {
        return;
    }


    editor.hidden = true;


    const title =
        $("letterTitle");

    const recipient =
        $("letterRecipient");

    const visibility =
        $("letterVisibility");

    const openAt =
        $("letterOpenAt");

    const body =
        $("letterBody");


    if (title) {
        title.value = "";
    }

    if (recipient) {
        recipient.value = "";
    }

    if (visibility) {
        visibility.value = "both";
    }

    if (openAt) {
        openAt.value = "";
    }

    if (body) {
        body.value = "";
    }

}


/* =====================================================
   SAVE LETTER
===================================================== */

async function saveLetter() {

    const title =
        $("letterTitle");

    const recipient =
        $("letterRecipient");

    const visibility =
        $("letterVisibility");

    const openAt =
        $("letterOpenAt");

    const body =
        $("letterBody");

    const button =
        $("saveLetterButton");


    if (
        !title ||
        !recipient ||
        !visibility ||
        !openAt ||
        !body ||
        !button
    ) {
        return;
    }


    const titleValue =
        title.value.trim();

    const recipientValue =
        recipient.value;

    const visibilityValue =
        visibility.value;

    const openAtValue =
        openAt.value;

    const bodyValue =
        body.value.trim();


    if (!titleValue) {

        showToast(
            "Xatga sarlavha kiriting."
        );

        title.focus();

        return;

    }


    if (!recipientValue) {

        showToast(
            "Qabul qiluvchini tanlang."
        );

        recipient.focus();

        return;

    }


    if (!bodyValue) {

        showToast(
            "Xat matnini yozing."
        );

        body.focus();

        return;

    }


    loading(
        button,
        true,
        "Saqlanmoqda..."
    );


    try {

        const result =
            await apiPost(
                "/letters",
                {
                    title:
                        titleValue,

                    body:
                        bodyValue,

                    recipient_id:
                        Number(
                            recipientValue
                        ),

                    visibility:
                        visibilityValue,

                    open_at:
                        openAtValue || null
                }
            );


        if (
            !result ||
            !result.success
        ) {

            showToast(
                result?.error ||
                "Xatni saqlab bo‘lmadi."
            );

            return;

        }


        showToast(
            "Xat saqlandi."
        );


        closeLetterEditor();

        await loadLetters();


    } catch (error) {

        console.error(
            "Xat saqlash xatosi:",
            error
        );

        showToast(
            "Xatni saqlashda xatolik."
        );

    } finally {

        loading(
            button,
            false,
            "Xatni saqlash"
        );

    }

}


/* =====================================================
   INIT LETTERS
===================================================== */

function initLetters() {

    const newButton =
        $("newLetterButton");

    const saveButton =
        $("saveLetterButton");

    const cancelButton =
        $("cancelLetterButton");


    if (newButton) {

        newButton.addEventListener(
            "click",
            openLetterEditor
        );

    }


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveLetter
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeLetterEditor
        );

    }


    loadLetters();

}


/* =====================================================
   REGISTER LETTERS SHEET
===================================================== */

if (
    typeof window.sheets === "undefined"
) {

    window.sheets = {};

}


window.sheets.letters = {

    title: "Xatlar",

    render:
        renderLettersSheet,

    init:
        initLetters

};


var sheets = window.sheets;