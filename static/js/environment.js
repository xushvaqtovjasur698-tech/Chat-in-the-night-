"use strict";


/* =====================================================
   ENVIRONMENT SYSTEM
===================================================== */

const ENVIRONMENT_STORAGE_KEY = "marjona_site_environment";


/* =====================================================
   ENVIRONMENT DATA
===================================================== */

const ENVIRONMENT_DATA = {

    calm: {
        name: "Sokin",
        description:
            "Yumshoq, tabiiy va tinch muhit.",
        theme: "calm",
        note:
            "Shoshilmasdan qolish mumkin bo‘lgan joy."
    },


    warm: {
        name: "Iliq",
        description:
            "Yumshoq oltin yorug‘lik va iliq atmosfera.",
        theme: "warm",
        note:
            "Bu yerda hamma narsa biroz iliqroq."
    },


    night: {
        name: "Tungi",
        description:
            "Chuqur ko‘k, binafsha va sokin tun.",
        theme: "night",
        note:
            "Tun ba'zi narsalarni boshqacha ko‘rsatadi."
    },


    dream: {
        name: "Tushdek",
        description:
            "Haqiqat va tasavvur orasidagi muhit.",
        theme: "dream",
        note:
            "Ba'zi joylar tushga o‘xshab qoladi."
    },


    auto: {
        name: "Avtomatik",
        description:
            "Muhit vaqt va vaziyatga qarab o‘zgaradi.",
        theme: "auto",
        note:
            "Muhitni hozir saytning o‘zi tanlaydi."
    }

};


/* =====================================================
   AUTO ENVIRONMENT
===================================================== */

function getAutomaticEnvironment() {

    const hour = new Date().getHours();


    if (hour >= 6 && hour < 12) {
        return "warm";
    }


    if (hour >= 12 && hour < 18) {
        return "calm";
    }


    if (hour >= 18 && hour < 22) {
        return "dream";
    }


    return "night";
}


/* =====================================================
   ENVIRONMENT STORAGE
===================================================== */

function getSavedEnvironment() {

    try {

        const saved =
            localStorage.getItem(
                ENVIRONMENT_STORAGE_KEY
            );


        if (
            saved &&
            Object.prototype.hasOwnProperty.call(
                ENVIRONMENT_DATA,
                saved
            )
        ) {

            return saved;

        }

    } catch (error) {

        console.warn(
            "Muhitni o‘qib bo‘lmadi:",
            error
        );

    }


    return "auto";
}


function saveEnvironment(environment) {

    try {

        localStorage.setItem(
            ENVIRONMENT_STORAGE_KEY,
            environment
        );

    } catch (error) {

        console.warn(
            "Muhitni saqlab bo‘lmadi:",
            error
        );

    }

}


/* =====================================================
   RESOLVE ENVIRONMENT
===================================================== */

function resolveEnvironment(environment) {

    if (environment === "auto") {
        return getAutomaticEnvironment();
    }


    if (
        Object.prototype.hasOwnProperty.call(
            ENVIRONMENT_DATA,
            environment
        )
    ) {

        return environment;

    }


    return "calm";
}


/* =====================================================
   APPLY THEME
===================================================== */

function applyTheme(theme) {

    const root =
        document.documentElement;

    const world =
        $("world");

    const center =
        $("centerHit");


    if (!root) {
        return;
    }


    Object.values(ENVIRONMENT_DATA)
        .forEach(environment => {

            root.classList.remove(
                `theme-${environment.theme}`
            );

        });


    root.classList.add(
        `theme-${theme}`
    );


    if (world) {

        world.dataset.theme =
            theme;

    }


    if (center) {

        center.classList.remove(
            "environment-pulse"
        );


        void center.offsetWidth;


        center.classList.add(
            "environment-pulse"
        );


        window.setTimeout(() => {

            center.classList.remove(
                "environment-pulse"
            );

        }, 900);

    }


    /*
     * Asosiy fon tizimiga ham xabar.
     */

    window.dispatchEvent(
        new CustomEvent(
            "mainthemechange",
            {
                detail: {
                    theme
                }
            }
        )
    );

}


/* =====================================================
   APPLY ENVIRONMENT
===================================================== */

function applyEnvironment(
    environment,
    options = {}
) {

    const selected =
        Object.prototype.hasOwnProperty.call(
            ENVIRONMENT_DATA,
            environment
        )
            ? environment
            : "auto";


    const actual =
        resolveEnvironment(selected);


    const data =
        ENVIRONMENT_DATA[actual];


    if (!data) {
        return;
    }


    applyTheme(
        data.theme
    );


    const centerNote =
        $("centerNote");


    if (centerNote) {

        centerNote.textContent =
            data.note;

    }


    const world =
        $("world");


    if (world) {

        world.dataset.environment =
            selected;

    }


    if (options.save !== false) {

        saveEnvironment(
            selected
        );

    }


    window.dispatchEvent(
        new CustomEvent(
            "environmentchange",
            {
                detail: {
                    selected,
                    actual,
                    data
                }
            }
        )
    );


    if (
        options.notify !== false &&
        typeof showToast === "function"
    ) {

        if (selected === "auto") {

            showToast(
                `Avtomatik muhit: ${data.name}`
            );

        } else {

            showToast(
                `Muhit: ${data.name}`
            );

        }

    }

}


/* =====================================================
   SELECT ENVIRONMENT
===================================================== */

function selectEnvironment(
    environment
) {

    applyEnvironment(
        environment,
        {
            save: true,
            notify: true
        }
    );


    updateEnvironmentSelection(
        environment
    );

}


/* =====================================================
   UPDATE ENVIRONMENT SELECTION
===================================================== */

function updateEnvironmentSelection(
    selectedEnvironment
) {

    document
        .querySelectorAll(
            "[data-environment]"
        )
        .forEach(button => {

            const value =
                button.dataset.environment;


            button.classList.toggle(
                "selected",
                value === selectedEnvironment
            );


            button.setAttribute(
                "aria-pressed",
                value === selectedEnvironment
                    ? "true"
                    : "false"
            );

        });

}


/* =====================================================
   MAIN BACKGROUND SHEET
===================================================== */

function renderMainBackgroundControls() {

    if (
        typeof window.MainBackground === "undefined"
    ) {

        return `
            <div class="main-background-section">

                <div class="background-error">
                    Fon tizimi hali yuklanmagan.
                </div>

            </div>
        `;

    }


    return window.MainBackground.render();
}


/* =====================================================
   RENDER ENVIRONMENT SHEET
===================================================== */

function renderEnvironmentSheet() {

    const saved =
        getSavedEnvironment();


    return `

        <div class="environment-section">

            <div class="environment-intro">

                <div class="sheet-kicker">
                    muhit
                </div>

                <h3 class="sheet-heading">
                    Olam qanday his qilinsin?
                </h3>

                <p class="sheet-description">
                    Muhitni o‘zing tanlashing mumkin.
                    Yoki uni saytning o‘ziga topshirishing mumkin.
                </p>

            </div>


            <div class="environment-options">

                ${Object.entries(
                    ENVIRONMENT_DATA
                )
                    .map(
                        ([key, item]) => {

                            const selected =
                                key === saved
                                    ? "selected"
                                    : "";

                            return `

                                <button
                                    class="
                                        environment-option
                                        ${selected}
                                    "
                                    type="button"
                                    data-environment="${key}"
                                    aria-pressed="${
                                        key === saved
                                            ? "true"
                                            : "false"
                                    }"
                                >

                                    <span
                                        class="
                                            environment-option-name
                                        "
                                    >
                                        ${escapeHtml(item.name)}
                                    </span>


                                    <span
                                        class="
                                            environment-option-description
                                        "
                                    >
                                        ${escapeHtml(
                                            item.description
                                        )}
                                    </span>

                                </button>

                            `;

                        }
                    )
                    .join("")}

            </div>


            <div class="environment-divider"></div>


            <!-- ASOSIY FON -->

            <div class="main-background-wrapper">

                <div class="main-background-heading">

                    <div class="sheet-kicker">
                        asosiy fon
                    </div>

                    <h3 class="sheet-heading">
                        Bu joy qanday ko‘rinsin?
                    </h3>

                    <p class="sheet-description">
                        Hozirgi animatsiyali sahnani qoldirish
                        yoki o‘zingga yoqqan rasmni tanlash mumkin.
                    </p>

                </div>


                <div id="mainBackgroundControls">
                    ${renderMainBackgroundControls()}
                </div>

            </div>

        </div>

    `;

}


/* =====================================================
   INIT ENVIRONMENT
===================================================== */

function initEnvironment() {

    const saved =
        getSavedEnvironment();


    applyEnvironment(
        saved,
        {
            save: false,
            notify: false
        }
    );


    document
        .querySelectorAll(
            "[data-environment]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const environment =
                        button.dataset.environment;


                    if (!environment) {
                        return;
                    }


                    selectEnvironment(
                        environment
                    );

                }
            );

        });


    updateEnvironmentSelection(
        saved
    );


    /*
     * Asosiy fon boshqaruvini ishga tushiramiz.
     */

    if (
        typeof window.MainBackground !== "undefined" &&
        typeof window.MainBackground.init === "function"
    ) {

        window.MainBackground.init();

    }

}


/* =====================================================
   AUTOMATIC ENVIRONMENT REFRESH
===================================================== */

window.setInterval(
    () => {

        const saved =
            getSavedEnvironment();


        if (saved !== "auto") {
            return;
        }


        const actual =
            resolveEnvironment("auto");


        applyEnvironment(
            "auto",
            {
                save: false,
                notify: false
            }
        );


        console.log(
            "Avtomatik muhit tekshirildi:",
            actual
        );

    },
    5 * 60 * 1000
);


/* =====================================================
   SHEET REGISTRATION
===================================================== */

if (
    typeof window.sheets === "undefined"
) {

    window.sheets = {};

}


window.sheets.environment = {

    title: "Muhit",

    render:
        renderEnvironmentSheet,

    init:
        initEnvironment

};


var sheets = window.sheets;