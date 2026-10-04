"use strict";


/* =====================================================
   API HELPERS
===================================================== */


/**
 * JSON API orqali GET/POST/PUT/DELETE so‘rov yuboradi.
 *
 * core.js dagi `api()` funksiyasi asosiy universal
 * so‘rov funksiyasi sifatida qoladi.
 *
 * Bu fayldagi yordamchilar esa keyingi modullar uchun
 * aniqroq va tushunarli interfeys beradi.
 */


/* =====================================================
   GET
===================================================== */

async function apiGet(path) {

    return api(
        path,
        {
            method: "GET"
        }
    );

}


/* =====================================================
   POST
===================================================== */

async function apiPost(
    path,
    body = {}
) {

    return api(
        path,
        {
            method: "POST",
            body
        }
    );

}


/* =====================================================
   PUT
===================================================== */

async function apiPut(
    path,
    body = {}
) {

    return api(
        path,
        {
            method: "PUT",
            body
        }
    );

}


/* =====================================================
   DELETE
===================================================== */

async function apiDelete(path) {

    return api(
        path,
        {
            method: "DELETE"
        }
    );

}


/* =====================================================
   CURRENT USER
===================================================== */

async function getCurrentUser() {

    return apiGet(
        "/me"
    );

}


/* =====================================================
   USERS
===================================================== */

async function getUsers() {

    return apiGet(
        "/users"
    );

}


/* =====================================================
   PROFILE NAME
===================================================== */

async function updateProfileName(
    name
) {

    return apiPost(
        "/profile/name",
        {
            name,

            device_id:
                getDeviceId()
        }
    );

}


/* =====================================================
   LOGOUT
===================================================== */

async function logoutUser() {

    return apiPost(
        "/logout"
    );

}