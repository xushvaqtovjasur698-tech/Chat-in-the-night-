"use strict";


/* =====================================================
   SPECIAL MESSAGES
===================================================== */


/* =====================================================
   SHEET
===================================================== */

function renderSpecialSheet() {

    return `
        <div class="special-section">

            <div class="special-intro">

                <div class="sheet-kicker">
                    maxsus
                </div>

                <h3 class="sheet-heading">
                    Oddiy xabardan biroz boshqacha.
                </h3>

                <p class="sheet-description">
                    Bu yerda keyinchalik maxsus yozuvlar,
                    kichik syurprizlar va yashirin xabarlar
                    paydo bo‘ladi.
                </p>

            </div>


            <div class="sheet-card special-card">

                <div class="sheet-card-title">
                    Hozircha bu joy sokin.
                </div>

                <div class="sheet-card-text">
                    Ba'zi narsalarni oldindan ko‘rsatmaslik
                    qiziqroq.
                </div>

            </div>

        </div>
    `;

}


/* =====================================================
   INIT
===================================================== */

function initSpecial() {

    /*
     * Keyinchalik bu yerga:
     *
     * - maxsus xabarlarni yuklash
     * - rejalashtirilgan xabarlar
     * - animatsiyalar
     * - musiqa
     * - yashirin xabarlar
     *
     * qo‘shiladi.
     */

}


/* =====================================================
   REGISTER
===================================================== */

if (
    typeof window.sheets === "undefined"
) {

    window.sheets = {};

}


window.sheets.special = {

    title: "Maxsus xabarlar",

    render:
        renderSpecialSheet,

    init:
        initSpecial

};


var sheets = window.sheets;