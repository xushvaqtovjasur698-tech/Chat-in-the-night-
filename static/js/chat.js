"use strict";

/*
    ============================================================
    PRIVATE CHAT
    ============================================================

    1-to-1 chat:
    - user search
    - conversations
    - realtime Socket.IO
    - unread
    - typing
    - background upload
    - mobile layout
*/


(function () {

    const state = {
        me: null,
        conversations: [],
        activeConversation: null,
        activeUser: null,
        messages: [],
        socket: null,
        typingTimer: null,
        searchTimer: null,
        backgroundUrl: "",
        initialized: false,
    };


    // ========================================================
    // CSS
    // ========================================================

    function ensureChatCss() {

        if (
            document.querySelector(
                'link[data-chat-style="true"]'
            )
        ) {
            return;
        }

        const link = document.createElement("link");

        link.rel = "stylesheet";

        link.href =
            "/static/css/chat.css";

        link.dataset.chatStyle = "true";

        document.head.appendChild(link);
    }


    // ========================================================
    // HELPERS
    // ========================================================

    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function initials(name) {

        const clean = String(
            name || "?"
        ).trim();

        if (!clean) {
            return "?";
        }

        const parts = clean
            .split(/\s+/)
            .filter(Boolean);

        if (parts.length >= 2) {

            return (
                parts[0][0] +
                parts[1][0]
            ).toUpperCase();
        }

        return clean
            .slice(0, 2)
            .toUpperCase();
    }


    function formatTime(value) {

        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            "uz-UZ",
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    }


    function formatDate(value) {

        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleDateString(
            "uz-UZ",
            {
                day: "numeric",
                month: "long",
            }
        );
    }


    async function api(
        url,
        options = {}
    ) {

        const response = await fetch(
            url,
            {
                credentials: "same-origin",
                ...options,
            }
        );

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {

            const error = new Error(
                data.error ||
                "So‘rov bajarilmadi."
            );

            error.status =
                response.status;

            throw error;
        }

        return data;
    }


    function showMessage(
        text
    ) {

        if (
            typeof window.showToast ===
            "function"
        ) {
            window.showToast(text);
        }
    }


    // ========================================================
    // RENDER MAIN
    // ========================================================

    function renderChatSheet() {

        ensureChatCss();

        return `
            <div class="chat-app">

                <aside class="chat-sidebar">

                    <div class="chat-sidebar-head">

                        <div>
                            <div class="chat-eyebrow">
                                shaxsiy suhbatlar
                            </div>

                            <h3 class="chat-title">
                                Chat
                            </h3>
                        </div>

                        <button
                            type="button"
                            class="chat-mini-button"
                            id="chatRefreshButton"
                            aria-label="Yangilash"
                            title="Yangilash"
                        >
                            ↻
                        </button>

                    </div>


                    <div class="chat-search-wrap">

                        <span class="chat-search-icon">
                            ⌕
                        </span>

                        <input
                            id="chatSearch"
                            class="chat-search"
                            type="search"
                            autocomplete="off"
                            placeholder="Kim bilan gaplashamiz?"
                            maxlength="60"
                        >

                        <button
                            type="button"
                            id="chatSearchClear"
                            class="chat-search-clear"
                            hidden
                        >
                            ×
                        </button>

                    </div>


                    <div
                        id="chatSearchResults"
                        class="chat-search-results"
                        hidden
                    ></div>


                    <div class="chat-list-heading">
                        <span>Suhbatlar</span>

                        <span
                            id="chatConversationCount"
                            class="chat-list-count"
                        >
                            0
                        </span>
                    </div>


                    <div
                        id="chatConversationList"
                        class="chat-conversation-list"
                    >
                        <div class="chat-loading">
                            Suhbatlar yuklanmoqda...
                        </div>
                    </div>

                </aside>


                <main
                    id="chatMain"
                    class="chat-main"
                >

                    <div
                        id="chatEmptyState"
                        class="chat-main-empty"
                    >

                        <div class="chat-empty-orbit">

                            <div class="chat-empty-orbit-line"></div>

                            <div class="chat-empty-dot"></div>

                        </div>

                        <div class="chat-empty-title">
                            Bir suhbat tanlang
                        </div>

                        <div class="chat-empty-text">
                            Yoki yuqoridan biror ismni qidiring.
                        </div>

                    </div>


                    <section
                        id="chatConversationView"
                        class="chat-conversation-view"
                        hidden
                    >

                        <header class="chat-header">

                            <button
                                id="chatBackButton"
                                class="chat-back"
                                type="button"
                                aria-label="Orqaga"
                            >
                                ←
                            </button>


                            <div class="chat-avatar">
                                <span
                                    id="chatHeaderInitials"
                                ></span>

                                <span
                                    class="chat-online-dot"
                                    aria-hidden="true"
                                ></span>
                            </div>


                            <div class="chat-header-info">

                                <div
                                    id="chatHeaderName"
                                    class="chat-header-name"
                                >
                                </div>

                                <div
                                    id="chatHeaderStatus"
                                    class="chat-header-status"
                                >
                                    suhbat
                                </div>

                            </div>


                            <div class="chat-header-actions">

                                <button
                                    id="chatBackgroundButton"
                                    class="chat-header-button"
                                    type="button"
                                    title="Chat fonini o‘zgartirish"
                                >
                                    ✦
                                </button>

                                <button
                                    id="chatResetBackgroundButton"
                                    class="chat-header-button"
                                    type="button"
                                    title="Fonini qaytarish"
                                >
                                    ↺
                                </button>

                            </div>

                        </header>


                        <div
                            id="chatBackgroundLayer"
                            class="chat-background-layer"
                        ></div>

                        <div
                            id="chatMessages"
                            class="chat-messages-new"
                        ></div>


                        <div
                            id="chatTyping"
                            class="chat-typing-new"
                            hidden
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>


                        <div
                            id="chatStatus"
                            class="chat-status-new"
                        ></div>


                        <form
                            id="chatComposer"
                            class="chat-composer-new"
                        >

                            <input
                                id="chatBackgroundFile"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                hidden
                            >

                            <button
                                id="chatComposerImage"
                                class="chat-tool-button"
                                type="button"
                                title="Fon rasmini tanlash"
                            >
                                ◌
                            </button>


                            <textarea
                                id="chatInput"
                                class="chat-input-new"
                                rows="1"
                                maxlength="5000"
                                placeholder="Biror narsa yozing..."
                            ></textarea>


                            <button
                                id="chatSend"
                                class="chat-send-new"
                                type="submit"
                                aria-label="Yuborish"
                            >
                                <span>↑</span>
                            </button>

                        </form>

                    </section>

                </main>

            </div>
        `;
    }


    // ========================================================
    // SEARCH
    // ========================================================

    async function searchUsers(
        query
    ) {

        try {

            const data = await api(
                `/api/chat/users?q=${encodeURIComponent(query)}`
            );

            renderSearchResults(
                data.users || []
            );

        } catch (error) {

            console.error(
                "Chat user search:",
                error
            );
        }
    }


    function renderSearchResults(
        users
    ) {

        const box = document.getElementById(
            "chatSearchResults"
        );

        if (!box) {
            return;
        }

        if (!users.length) {

            box.innerHTML = `
                <div class="chat-search-empty">
                    Bunday foydalanuvchi topilmadi.
                </div>
            `;

            box.hidden = false;

            return;
        }

        box.innerHTML = users.map(
            user => `
                <button
                    type="button"
                    class="chat-user-result"
                    data-user-id="${user.id}"
                >

                    <span class="chat-result-avatar">
                        ${escapeHtml(
                            initials(user.name)
                        )}
                    </span>

                    <span class="chat-result-info">

                        <strong>
                            ${escapeHtml(
                                user.name
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                user.account_name
                            )}
                        </small>

                    </span>

                    <span class="chat-result-arrow">
                        →
                    </span>

                </button>
            `
        ).join("");

        box.hidden = false;

        box.querySelectorAll(
            "[data-user-id]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const userId =
                            Number(
                                button.dataset.userId
                            );

                        await openUserConversation(
                            userId
                        );
                    }
                );

            }
        );
    }


    // ========================================================
    // CONVERSATIONS
    // ========================================================

    async function loadConversations() {

        try {

            const data = await api(
                "/api/chat/conversations"
            );

            state.conversations =
                data.conversations || [];

            renderConversationList();

        } catch (error) {

            console.error(
                "Chat conversations:",
                error
            );

            const list =
                document.getElementById(
                    "chatConversationList"
                );

            if (list) {

                list.innerHTML = `
                    <div class="chat-loading chat-error-text">
                        Suhbatlarni yuklab bo‘lmadi.
                    </div>
                `;
            }
        }
    }


    function renderConversationList() {

        const list =
            document.getElementById(
                "chatConversationList"
            );

        const count =
            document.getElementById(
                "chatConversationCount"
            );

        if (!list) {
            return;
        }

        if (count) {
            count.textContent =
                state.conversations.length;
        }

        if (!state.conversations.length) {

            list.innerHTML = `
                <div class="chat-no-conversations">

                    <div class="chat-no-conversations-symbol">
                        ·
                    </div>

                    <div>
                        Hali suhbat yo‘q.
                    </div>

                    <small>
                        Yuqoridan ism qidirib boshlang.
                    </small>

                </div>
            `;

            return;
        }

        list.innerHTML =
            state.conversations.map(
                conversation => {

                    const user =
                        conversation.user;

                    const active =
                        state.activeConversation ===
                        conversation.id;

                    const unread =
                        Number(
                            conversation.unread_count ||
                            0
                        );

                    return `
                        <button
                            type="button"
                            class="chat-conversation-item ${
                                active
                                    ? "active"
                                    : ""
                            }"
                            data-conversation-id="${
                                conversation.id
                            }"
                        >

                            <span class="chat-list-avatar">
                                ${escapeHtml(
                                    initials(
                                        user.name
                                    )
                                )}
                            </span>


                            <span class="chat-list-content">

                                <span class="chat-list-top">

                                    <strong>
                                        ${escapeHtml(
                                            user.name
                                        )}
                                    </strong>

                                    <time>
                                        ${escapeHtml(
                                            formatTime(
                                                conversation.last_message_at
                                            )
                                        )}
                                    </time>

                                </span>


                                <span class="chat-list-bottom">

                                    <span class="chat-list-preview">
                                        ${
                                            conversation.last_text
                                                ? escapeHtml(
                                                    conversation.last_text
                                                )
                                                : "Yangi suhbat"
                                        }
                                    </span>

                                    ${
                                        unread
                                            ? `
                                                <span class="chat-unread">
                                                    ${
                                                        unread > 99
                                                            ? "99+"
                                                            : unread
                                                    }
                                                </span>
                                            `
                                            : ""
                                    }

                                </span>

                            </span>

                        </button>
                    `;
                }
            ).join("");

        list.querySelectorAll(
            "[data-conversation-id]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openConversation(
                            Number(
                                button.dataset
                                    .conversationId
                            )
                        );

                    }
                );

            }
        );
    }


    async function openUserConversation(
        userId
    ) {

        try {

            const data = await api(
                "/api/chat/conversations",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        user_id: userId,
                    }),
                }
            );

            hideSearch();

            await loadConversations();

            await openConversation(
                data.conversation_id
            );

        } catch (error) {

            showMessage(
                error.message ||
                "Chatni ochib bo‘lmadi."
            );
        }
    }


    async function openConversation(
        conversationId
    ) {

        const conversation =
            state.conversations.find(
                item =>
                    Number(item.id) ===
                    Number(conversationId)
            );

        if (!conversation) {

            await loadConversations();

            const found =
                state.conversations.find(
                    item =>
                        Number(item.id) ===
                        Number(conversationId)
                );

            if (!found) {
                return;
            }

            return openConversation(
                conversationId
            );
        }

        if (
            state.activeConversation
            &&
            state.activeConversation !==
                conversationId
        ) {

            leaveCurrentRoom();
        }

        state.activeConversation =
            Number(conversationId);

        state.activeUser =
            conversation.user;

        renderConversationList();

        showConversationView();

        renderHeader();

        await loadMessages();

        await loadBackground();

        markRead();

        joinCurrentRoom();
    }


    // ========================================================
    // MESSAGE
    // ========================================================

    async function loadMessages() {

        if (!state.activeConversation) {
            return;
        }

        const box =
            document.getElementById(
                "chatMessages"
            );

        if (!box) {
            return;
        }

        box.innerHTML = `
            <div class="chat-loading chat-message-loading">
                Xabarlar yuklanmoqda...
            </div>
        `;

        try {

            const data = await api(
                `/api/chat/conversations/${state.activeConversation}/messages`
            );

            state.messages =
                data.messages || [];

            renderMessages();

        } catch (error) {

            box.innerHTML = `
                <div class="chat-loading chat-error-text">
                    Xabarlarni yuklab bo‘lmadi.
                </div>
            `;
        }
    }


    function renderMessages() {

        const box =
            document.getElementById(
                "chatMessages"
            );

        if (!box) {
            return;
        }

        if (!state.messages.length) {

            box.innerHTML = `
                <div class="chat-first-message">

                    <div class="chat-first-message-ring">
                        ✦
                    </div>

                    <strong>
                        Birinchi xabarni siz yozishingiz mumkin.
                    </strong>

                    <span>
                        Ba'zi suhbatlar aynan shunday boshlanadi.
                    </span>

                </div>
            `;

            return;
        }

        let html = "";

        let previousDate = "";

        state.messages.forEach(
            message => {

                const date =
                    formatDate(
                        message.created_at
                    );

                if (
                    date &&
                    date !== previousDate
                ) {

                    html += `
                        <div class="chat-date-divider">
                            <span>
                                ${escapeHtml(date)}
                            </span>
                        </div>
                    `;

                    previousDate = date;
                }

                const mine =
                    Number(
                        message.sender_id
                    ) === Number(
                        state.me?.id
                    );

                html += `
                    <div
                        class="chat-message-new ${
                            mine
                                ? "mine"
                                : "theirs"
                        }"
                        data-message-id="${
                            message.id
                        }"
                    >

                        <div class="chat-bubble-new">

                            <div class="chat-message-text-new">
                                ${escapeHtml(
                                    message.text
                                )}
                            </div>

                            <div class="chat-message-meta-new">
                                ${escapeHtml(
                                    formatTime(
                                        message.created_at
                                    )
                                )}
                            </div>

                        </div>

                    </div>
                `;
            }
        );

        box.innerHTML = html;

        scrollMessages();
    }


    function addMessage(
        message
    ) {

        if (
            !message ||
            Number(
                message.conversation_id
            ) !== Number(
                state.activeConversation
            )
        ) {
            return;
        }

        if (
            state.messages.some(
                item =>
                    Number(item.id) ===
                    Number(message.id)
            )
        ) {
            return;
        }

        state.messages.push(
            message
        );

        const box =
            document.getElementById(
                "chatMessages"
            );

        if (!box) {
            return;
        }

        const empty =
            box.querySelector(
                ".chat-first-message"
            );

        if (empty) {
            box.innerHTML = "";
        }

        const mine =
            Number(
                message.sender_id
            ) === Number(
                state.me?.id
            );

        const element =
            document.createElement(
                "div"
            );

        element.className =
            `chat-message-new ${
                mine
                    ? "mine"
                    : "theirs"
            }`;

        element.dataset.messageId =
            message.id;

        element.innerHTML = `
            <div class="chat-bubble-new">

                <div class="chat-message-text-new">
                    ${escapeHtml(
                        message.text
                    )}
                </div>

                <div class="chat-message-meta-new">
                    ${escapeHtml(
                        formatTime(
                            message.created_at
                        )
                    )}
                </div>

            </div>
        `;

        box.appendChild(
            element
        );

        scrollMessages();

        markRead();
    }


    function scrollMessages() {

        const box =
            document.getElementById(
                "chatMessages"
            );

        if (!box) {
            return;
        }

        requestAnimationFrame(
            () => {

                box.scrollTo(
                    {
                        top:
                            box.scrollHeight,
                        behavior:
                            "smooth",
                    }
                );

            }
        );
    }


    // ========================================================
    // SEND
    // ========================================================

    function sendCurrentMessage() {

        const input =
            document.getElementById(
                "chatInput"
            );

        if (
            !input ||
            !state.activeConversation
        ) {
            return;
        }

        const text =
            input.value.trim();

        if (!text) {
            return;
        }

        if (!state.socket) {
            showMessage(
                "Chat serverga ulanmagan."
            );
            return;
        }

        const clientId =
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;

        state.socket.emit(
            "chat:send",
            {
                conversation_id:
                    state.activeConversation,

                text,

                client_id:
                    clientId,
            }
        );

        input.value = "";

        autoResizeInput();

        stopTyping();
    }


    function autoResizeInput() {

        const input =
            document.getElementById(
                "chatInput"
            );

        if (!input) {
            return;
        }

        input.style.height =
            "auto";

        input.style.height =
            Math.min(
                input.scrollHeight,
                130
            ) + "px";
    }


    // ========================================================
    // TYPING
    // ========================================================

    function startTyping() {

        if (
            !state.socket ||
            !state.activeConversation
        ) {
            return;
        }

        state.socket.emit(
            "chat:typing",
            {
                conversation_id:
                    state.activeConversation,

                typing: true,
            }
        );

        clearTimeout(
            state.typingTimer
        );

        state.typingTimer =
            setTimeout(
                stopTyping,
                1400
            );
    }


    function stopTyping() {

        clearTimeout(
            state.typingTimer
        );

        if (
            !state.socket ||
            !state.activeConversation
        ) {
            return;
        }

        state.socket.emit(
            "chat:typing",
            {
                conversation_id:
                    state.activeConversation,

                typing: false,
            }
        );
    }


    function setTypingVisible(
        visible
    ) {

        const element =
            document.getElementById(
                "chatTyping"
            );

        if (!element) {
            return;
        }

        element.hidden =
            !visible;
    }


    // ========================================================
    // READ
    // ========================================================

    async function markRead() {

        if (!state.activeConversation) {
            return;
        }

        try {

            await api(
                `/api/chat/conversations/${state.activeConversation}/read`,
                {
                    method: "POST",
                }
            );

            const item =
                state.conversations.find(
                    conversation =>
                        Number(
                            conversation.id
                        ) ===
                        Number(
                            state.activeConversation
                        )
                );

            if (item) {
                item.unread_count = 0;
            }

            renderConversationList();

        } catch {
            // jim
        }
    }


    // ========================================================
    // BACKGROUND
    // ========================================================

    async function loadBackground() {

        if (!state.activeConversation) {
            return;
        }

        try {

            const data = await api(
                `/api/chat/conversations/${state.activeConversation}/background`
            );

            setBackground(
                data.url || ""
            );

        } catch {

            setBackground("");
        }
    }


    function setBackground(
        url
    ) {

        state.backgroundUrl =
            url || "";

        const layer =
            document.getElementById(
                "chatBackgroundLayer"
            );

        const main =
            document.getElementById(
                "chatMain"
            );

        if (!layer) {
            return;
        }

        if (url) {

            layer.style.backgroundImage =
                `url("${url}?v=${Date.now()}")`;

            layer.classList.add(
                "has-image"
            );

            if (main) {
                main.classList.add(
                    "has-chat-background"
                );
            }

        } else {

            layer.style.backgroundImage =
                "";

            layer.classList.remove(
                "has-image"
            );

            if (main) {
                main.classList.remove(
                    "has-chat-background"
                );
            }
        }
    }


    async function uploadBackground(
        file
    ) {

        if (
            !file ||
            !state.activeConversation
        ) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            showMessage(
                "Faqat rasm tanlang."
            );

            return;
        }

        if (
            file.size >
            8 * 1024 * 1024
        ) {

            showMessage(
                "Rasm 8 MB dan kichik bo‘lishi kerak."
            );

            return;
        }

        const form =
            new FormData();

        form.append(
            "background",
            file
        );

        try {

            showStatus(
                "Fon saqlanmoqda..."
            );

            const data =
                await api(
                    `/api/chat/conversations/${state.activeConversation}/background`,
                    {
                        method: "POST",
                        body: form,
                    }
                );

            setBackground(
                data.url || ""
            );

            showStatus(
                ""
            );

        } catch (error) {

            showMessage(
                error.message ||
                "Fon rasmini saqlab bo‘lmadi."
            );

            showStatus("");
        }
    }


    async function resetBackground() {

        if (!state.activeConversation) {
            return;
        }

        try {

            await api(
                `/api/chat/conversations/${state.activeConversation}/background`,
                {
                    method: "DELETE",
                }
            );

            setBackground("");

        } catch (error) {

            showMessage(
                error.message ||
                "Fon olib tashlanmadi."
            );
        }
    }


    // ========================================================
    // SOCKET
    // ========================================================

    function initSocket() {

        if (
            typeof io !==
            "function"
        ) {
            console.warn(
                "Socket.IO topilmadi."
            );

            return;
        }

        if (state.socket) {
            return;
        }

        state.socket =
            io(
                {
                    transports: [
                        "websocket",
                        "polling",
                    ],

                    withCredentials:
                        true,
                }
            );


        state.socket.on(
            "connect",
            () => {

                if (
                    state.activeConversation
                ) {
                    joinCurrentRoom();
                }

            }
        );


        state.socket.on(
            "chat:message",
            message => {

                addMessage(
                    message
                );

                updateConversationPreview(
                    message
                );

                if (
                    Number(
                        message.sender_id
                    ) !== Number(
                        state.me?.id
                    )
                ) {
                    markRead();
                }

            }
        );


        state.socket.on(
            "chat:typing",
            data => {

                if (
                    Number(
                        data.conversation_id
                    ) !== Number(
                        state.activeConversation
                    )
                ) {
                    return;
                }

                setTypingVisible(
                    Boolean(
                        data.typing
                    )
                );

            }
        );


        state.socket.on(
            "chat:error",
            data => {

                showMessage(
                    data?.error ||
                    "Chat xatosi."
                );

            }
        );
    }


    function joinCurrentRoom() {

        if (
            !state.socket ||
            !state.activeConversation
        ) {
            return;
        }

        state.socket.emit(
            "chat:join",
            {
                conversation_id:
                    state.activeConversation,
            }
        );
    }


    function leaveCurrentRoom() {

        if (
            !state.socket ||
            !state.activeConversation
        ) {
            return;
        }

        state.socket.emit(
            "chat:leave",
            {
                conversation_id:
                    state.activeConversation,
            }
        );
    }


    function updateConversationPreview(
        message
    ) {

        const conversation =
            state.conversations.find(
                item =>
                    Number(item.id) ===
                    Number(
                        message.conversation_id
                    )
            );

        if (!conversation) {
            loadConversations();
            return;
        }

        conversation.last_text =
            message.text;

        conversation.last_message_at =
            message.created_at;

        if (
            Number(
                message.sender_id
            ) !== Number(
                state.me?.id
            ) &&
            Number(
                state.activeConversation
            ) !== Number(
                message.conversation_id
            )
        ) {

            conversation.unread_count =
                Number(
                    conversation.unread_count ||
                    0
                ) + 1;
        }

        state.conversations.sort(
            (
                a,
                b
            ) =>
                new Date(
                    b.last_message_at
                ) -
                new Date(
                    a.last_message_at
                )
        );

        renderConversationList();
    }


    // ========================================================
    // VIEW
    // ========================================================

    function showConversationView() {

        const empty =
            document.getElementById(
                "chatEmptyState"
            );

        const view =
            document.getElementById(
                "chatConversationView"
            );

        if (empty) {
            empty.hidden = true;
        }

        if (view) {
            view.hidden = false;
        }

        const main =
            document.getElementById(
                "chatMain"
            );

        if (main) {
            main.classList.add(
                "conversation-open"
            );
        }
    }


    function hideConversationView() {

        const empty =
            document.getElementById(
                "chatEmptyState"
            );

        const view =
            document.getElementById(
                "chatConversationView"
            );

        if (empty) {
            empty.hidden = false;
        }

        if (view) {
            view.hidden = true;
        }

        const main =
            document.getElementById(
                "chatMain"
            );

        if (main) {
            main.classList.remove(
                "conversation-open"
            );
        }
    }


    function renderHeader() {

        const user =
            state.activeUser;

        if (!user) {
            return;
        }

        const name =
            document.getElementById(
                "chatHeaderName"
            );

        const initialsElement =
            document.getElementById(
                "chatHeaderInitials"
            );

        if (name) {
            name.textContent =
                user.name;
        }

        if (initialsElement) {
            initialsElement.textContent =
                initials(
                    user.name
                );
        }
    }


    function backToList() {

        leaveCurrentRoom();

        state.activeConversation =
            null;

        state.activeUser =
            null;

        state.messages =
            [];

        setBackground("");

        hideConversationView();

        renderConversationList();
    }


    // ========================================================
    // SEARCH UI
    // ========================================================

    function hideSearch() {

        const results =
            document.getElementById(
                "chatSearchResults"
            );

        const clear =
            document.getElementById(
                "chatSearchClear"
            );

        const input =
            document.getElementById(
                "chatSearch"
            );

        if (results) {
            results.hidden = true;
        }

        if (clear) {
            clear.hidden = true;
        }

        if (input) {
            input.value = "";
        }
    }


    function setupSearch() {

        const input =
            document.getElementById(
                "chatSearch"
            );

        const clear =
            document.getElementById(
                "chatSearchClear"
            );

        if (!input) {
            return;
        }

        input.addEventListener(
            "input",
            () => {

                const value =
                    input.value.trim();

                if (clear) {
                    clear.hidden =
                        !value;
                }

                clearTimeout(
                    state.searchTimer
                );

                if (!value) {

                    const results =
                        document.getElementById(
                            "chatSearchResults"
                        );

                    if (results) {
                        results.hidden = true;
                    }

                    return;
                }

                state.searchTimer =
                    setTimeout(
                        () => {
                            searchUsers(
                                value
                            );
                        },
                        180
                    );
            }
        );


        input.addEventListener(
            "focus",
            () => {

                if (
                    input.value.trim()
                ) {
                    searchUsers(
                        input.value.trim()
                    );
                }

            }
        );


        if (clear) {

            clear.addEventListener(
                "click",
                () => {

                    input.value = "";

                    clear.hidden =
                        true;

                    const results =
                        document.getElementById(
                            "chatSearchResults"
                        );

                    if (results) {
                        results.hidden = true;
                    }

                    input.focus();
                }
            );
        }
    }


    // ========================================================
    // SETUP
    // ========================================================

    function setupEvents() {

        const form =
            document.getElementById(
                "chatComposer"
            );

        const input =
            document.getElementById(
                "chatInput"
            );

        const backgroundButton =
            document.getElementById(
                "chatBackgroundButton"
            );

        const backgroundFile =
            document.getElementById(
                "chatBackgroundFile"
            );

        const composerImage =
            document.getElementById(
                "chatComposerImage"
            );

        const resetBackgroundButton =
            document.getElementById(
                "chatResetBackgroundButton"
            );

        const backButton =
            document.getElementById(
                "chatBackButton"
            );

        const refreshButton =
            document.getElementById(
                "chatRefreshButton"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendCurrentMessage();

                }
            );
        }


        if (input) {

            input.addEventListener(
                "input",
                () => {

                    autoResizeInput();

                    if (
                        input.value.trim()
                    ) {
                        startTyping();
                    } else {
                        stopTyping();
                    }

                }
            );


            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                            "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendCurrentMessage();
                    }

                }
            );
        }


        const openFile =
            () => {

                if (backgroundFile) {
                    backgroundFile.click();
                }

            };


        if (backgroundButton) {
            backgroundButton.addEventListener(
                "click",
                openFile
            );
        }

        if (composerImage) {
            composerImage.addEventListener(
                "click",
                openFile
            );
        }


        if (backgroundFile) {

            backgroundFile.addEventListener(
                "change",
                () => {

                    const file =
                        backgroundFile.files?.[0];

                    if (file) {
                        uploadBackground(
                            file
                        );
                    }

                    backgroundFile.value =
                        "";
                }
            );
        }


        if (resetBackgroundButton) {

            resetBackgroundButton.addEventListener(
                "click",
                resetBackground
            );
        }


        if (backButton) {

            backButton.addEventListener(
                "click",
                backToList
            );
        }


        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                async () => {

                    await loadConversations();

                    if (
                        state.activeConversation
                    ) {

                        await loadMessages();

                        await loadBackground();
                    }

                }
            );
        }
    }


    function showStatus(
        text
    ) {

        const element =
            document.getElementById(
                "chatStatus"
            );

        if (!element) {
            return;
        }

        element.textContent =
            text || "";
    }


    // ========================================================
    // INIT
    // ========================================================

    async function initChat() {

        ensureChatCss();

        if (
            state.initialized
        ) {

            await loadConversations();

            return;
        }

        state.initialized =
            true;

        try {

            const me =
                await api(
                    "/api/me"
                );

            state.me =
                me.user;

        } catch {

            state.me =
                null;
        }

        setupSearch();

        setupEvents();

        initSocket();

        await loadConversations();
    }


    // ========================================================
    // PUBLIC SHEET
    // ========================================================

    window.sheets =
        window.sheets || {};

    window.sheets.chat = {
        title: "Chat",
        render: renderChatSheet,
        init: initChat,
    };

})();