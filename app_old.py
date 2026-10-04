from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    session,
)
from flask_socketio import (
    SocketIO,
    emit,
)
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

import config


# ============================================================
# APP
# ============================================================

app = Flask(__name__)

app.config["SECRET_KEY"] = config.SECRET_KEY

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False


socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
)


DATABASE = Path(
    config.DATABASE_PATH
)


# ============================================================
# VAQT
# ============================================================

def now_utc() -> datetime:
    return datetime.now(
        timezone.utc
    )


def now_iso() -> str:
    return now_utc().isoformat()


# ============================================================
# DATABASE
# ============================================================

def ensure_data_directory() -> None:
    config.DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )


def get_db() -> sqlite3.Connection:
    ensure_data_directory()

    connection = sqlite3.connect(
        DATABASE
    )

    connection.row_factory = sqlite3.Row

    return connection


def add_column_if_missing(
    connection: sqlite3.Connection,
    table: str,
    column: str,
    definition: str,
) -> None:

    columns = connection.execute(
        f"PRAGMA table_info({table})"
    ).fetchall()

    names = {
        row["name"]
        for row in columns
    }

    if column not in names:

        connection.execute(
            f"""
            ALTER TABLE {table}
            ADD COLUMN {column} {definition}
            """
        )


# ============================================================
# DATABASE INIT
# ============================================================

def init_database() -> None:

    connection = get_db()

    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            login_code TEXT,
            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            device_id TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id)
                REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            success INTEGER NOT NULL
                DEFAULT 0,
            device_id TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id)
                REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id)
                REFERENCES users(id)
        );
        """
    )

    # ========================================================
    # USERS MIGRATION
    # ========================================================

    add_column_if_missing(
        connection,
        "users",
        "code_hash",
        "TEXT",
    )

    add_column_if_missing(
        connection,
        "users",
        "display_name",
        "TEXT",
    )

    add_column_if_missing(
        connection,
        "users",
        "failed_attempts",
        "INTEGER NOT NULL DEFAULT 0",
    )

    add_column_if_missing(
        connection,
        "users",
        "lock_until",
        "TEXT",
    )

    # ========================================================
    # FIRST USERS
    # ========================================================

    existing_count = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM users
        """
    ).fetchone()["count"]

    if existing_count == 0:

        connection.executemany(
            """
            INSERT INTO users (
                username,
                role,
                login_code,
                code_hash,
                display_name,
                failed_attempts,
                lock_until
            )
            VALUES (
                ?,
                ?,
                NULL,
                ?,
                NULL,
                0,
                NULL
            )
            """,
            [
                (
                    "Jamshid",
                    "owner",
                    generate_password_hash(
                        config.JAMSHID_CODE
                    ),
                ),
                (
                    "Marjona",
                    "user",
                    generate_password_hash(
                        config.FRIEND_CODE
                    ),
                ),
            ],
        )

    # ========================================================
    # OLD PLAIN CODES -> HASH
    # ========================================================

    rows = connection.execute(
        """
        SELECT
            id,
            login_code,
            code_hash
        FROM users
        """
    ).fetchall()

    for row in rows:

        if row["code_hash"]:
            continue

        old_code = row["login_code"]

        if not old_code:
            continue

        connection.execute(
            """
            UPDATE users

            SET
                code_hash = ?,
                login_code = NULL

            WHERE id = ?
            """,
            (
                generate_password_hash(
                    old_code
                ),
                row["id"],
            ),
        )

    connection.commit()
    connection.close()


# ============================================================
# ACTIVITY LOG
# ============================================================

def log_activity(
    connection: sqlite3.Connection,
    user_id: int | None,
    action: str,
    details: str = "",
    device_id: str = "",
    user_agent: str = "",
) -> None:

    connection.execute(
        """
        INSERT INTO activity_log (
            user_id,
            action,
            details,
            device_id,
            user_agent,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            action,
            details,
            device_id,
            user_agent,
            now_iso(),
        ),
    )


def log_login_attempt(
    connection: sqlite3.Connection,
    user_id: int | None,
    success: bool,
    device_id: str,
    user_agent: str,
) -> None:

    connection.execute(
        """
        INSERT INTO login_attempts (
            user_id,
            success,
            device_id,
            user_agent,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            user_id,
            1 if success else 0,
            device_id,
            user_agent,
            now_iso(),
        ),
    )


# ============================================================
# PAGE
# ============================================================

@app.get("/")
def index():
    return render_template(
        "index.html"
    )


# ============================================================
# STATUS
# ============================================================

@app.get("/api/status")
def status():

    return jsonify(
        {
            "success": True,
            "message":
                "Sayt backend ishlayapti.",
        }
    )


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/login")
def login():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    code = str(
        data.get(
            "code",
            "",
        )
    ).strip()

    device_id = str(
        data.get(
            "device_id",
            "",
        )
    ).strip()

    user_agent = request.headers.get(
        "User-Agent",
        "",
    )

    if not code:

        return jsonify(
            {
                "success": False,
                "error":
                    "Kirish kodi kiritilmagan.",
            }
        ), 400

    connection = get_db()

    users = connection.execute(
        """
        SELECT *
        FROM users
        ORDER BY id
        """
    ).fetchall()

    matched_user = None

    for user in users:

        code_hash = user[
            "code_hash"
        ]

        if not code_hash:
            continue

        if check_password_hash(
            code_hash,
            code,
        ):

            matched_user = user

            break

    # ========================================================
    # WRONG CODE
    # ========================================================

    if matched_user is None:

        log_activity(
            connection,
            None,
            "login_failed",
            "Noto‘g‘ri yoki noma'lum kod.",
            device_id,
            user_agent,
        )

        log_login_attempt(
            connection,
            None,
            False,
            device_id,
            user_agent,
        )

        connection.commit()
        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Kirish kodi noto‘g‘ri.",
            }
        ), 401

    user_id = matched_user["id"]

    # ========================================================
    # LOCK
    # ========================================================

    lock_until_text = (
        matched_user["lock_until"]
    )

    lock_until = None

    if lock_until_text:

        try:

            lock_until = datetime.fromisoformat(
                lock_until_text
            )

        except ValueError:

            lock_until = None

    if (
        lock_until
        and now_utc() < lock_until
    ):

        remaining = max(
            1,
            int(
                (
                    lock_until
                    - now_utc()
                ).total_seconds()
            ),
        )

        log_activity(
            connection,
            user_id,
            "login_blocked",
            (
                "Blok davom etmoqda: "
                f"{remaining} soniya."
            ),
            device_id,
            user_agent,
        )

        log_login_attempt(
            connection,
            user_id,
            False,
            device_id,
            user_agent,
        )

        connection.commit()
        connection.close()

        return jsonify(
            {
                "success": False,
                "blocked": True,
                "remaining_seconds":
                    remaining,
                "error":
                    "Kirish vaqtincha bloklangan.",
            }
        ), 429

    # ========================================================
    # SUCCESS
    # ========================================================

    connection.execute(
        """
        UPDATE users

        SET
            failed_attempts = 0,
            lock_until = NULL

        WHERE id = ?
        """,
        (user_id,),
    )

    session.clear()

    session["user_id"] = user_id
    session["role"] = (
        matched_user["role"]
    )

    display_name = (
        matched_user["display_name"]
        or ""
    )

    log_activity(
        connection,
        user_id,
        "login_success",
        "Muvaffaqiyatli kirish.",
        device_id,
        user_agent,
    )

    log_login_attempt(
        connection,
        user_id,
        True,
        device_id,
        user_agent,
    )

    connection.commit()

    result = {
        "success": True,

        "user": {
            "id": user_id,

            "account_name":
                matched_user[
                    "username"
                ],

            "name":
                display_name,

            "role":
                matched_user[
                    "role"
                ],

            "has_name":
                bool(
                    display_name.strip()
                ),
        },
    }

    connection.close()

    return jsonify(result)


# ============================================================
# CURRENT PROFILE
# ============================================================

@app.get("/api/me")
def current_profile():

    user_id = session.get(
        "user_id"
    )

    if not user_id:

        return jsonify(
            {
                "authenticated":
                    False,
            }
        ), 401

    connection = get_db()

    user = connection.execute(
        """
        SELECT
            id,
            username,
            role,
            display_name,
            created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    if user is None:

        session.clear()

        connection.close()

        return jsonify(
            {
                "authenticated":
                    False,
            }
        ), 401

    connection.close()

    return jsonify(
        {
            "authenticated":
                True,

            "user": {
                "id":
                    user["id"],

                "account_name":
                    user["username"],

                "name":
                    user["display_name"]
                    or "",

                "role":
                    user["role"],

                "created_at":
                    user["created_at"],
            },
        }
    )


# ============================================================
# SAVE PROFILE NAME
# ============================================================

@app.post("/api/profile/name")
def save_profile_name():

    user_id = session.get(
        "user_id"
    )

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    name = str(
        data.get(
            "name",
            "",
        )
    ).strip()

    device_id = str(
        data.get(
            "device_id",
            "",
        )
    ).strip()

    user_agent = request.headers.get(
        "User-Agent",
        "",
    )

    if not name:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism kiritilmagan.",
            }
        ), 400

    if len(name) > 40:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism juda uzun.",
            }
        ), 400

    connection = get_db()

    old_user = connection.execute(
        """
        SELECT display_name
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    if old_user is None:

        connection.close()

        session.clear()

        return jsonify(
            {
                "success": False,
                "error":
                    "Profil topilmadi.",
            }
        ), 404

    old_name = (
        old_user["display_name"]
        or ""
    )

    connection.execute(
        """
        UPDATE users

        SET display_name = ?

        WHERE id = ?
        """,
        (
            name,
            user_id,
        ),
    )

    log_activity(
        connection,
        user_id,
        "profile_name_saved",
        (
            f"Profil ismi o‘zgartirildi: "
            f"'{old_name}' → '{name}'."
        ),
        device_id,
        user_agent,
    )

    connection.commit()
    connection.close()

    return jsonify(
        {
            "success": True,
            "name": name,
        }
    )


# ============================================================
# LOGOUT
# ============================================================

@app.post("/api/logout")
def logout():

    user_id = session.get(
        "user_id"
    )

    if user_id:

        connection = get_db()

        body = (
            request.get_json(
                silent=True
            )
            or {}
        )

        log_activity(
            connection,
            user_id,
            "logout",
            "Foydalanuvchi chiqdi.",
            str(
                body.get(
                    "device_id",
                    "",
                )
            ),
            request.headers.get(
                "User-Agent",
                "",
            ),
        )

        connection.commit()
        connection.close()

    session.clear()

    return jsonify(
        {
            "success": True,
        }
    )


# ============================================================
# USERS
# ============================================================

@app.get("/api/users")
def users():

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            id,
            username,
            role,
            display_name,
            created_at
        FROM users
        ORDER BY id
        """
    ).fetchall()

    connection.close()

    return jsonify(
        [
            {
                "id":
                    row["id"],

                "account_name":
                    row["username"],

                "name":
                    row["display_name"]
                    or "",

                "role":
                    row["role"],

                "created_at":
                    row["created_at"],
            }

            for row in rows
        ]
    )


# ============================================================
# CHAT HISTORY
# ============================================================

@app.get("/api/chat/messages")
def chat_messages():

    user_id = session.get(
        "user_id"
    )

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            messages.id,
            messages.user_id,
            messages.text,
            messages.created_at,
            users.username,
            users.display_name
        FROM messages

        JOIN users
            ON users.id =
                messages.user_id

        ORDER BY messages.id ASC

        LIMIT 300
        """
    ).fetchall()

    connection.close()

    return jsonify(
        {
            "success": True,

            "messages": [
                {
                    "id":
                        row["id"],

                    "user_id":
                        row["user_id"],

                    "account_name":
                        row["username"],

                    "name":
                        row["display_name"]
                        or row["username"],

                    "text":
                        row["text"],

                    "created_at":
                        row["created_at"],
                }

                for row in rows
            ],
        }
    )


# ============================================================
# CHAT SOCKET
# ============================================================

@socketio.on("connect")
def socket_connect():

    user_id = session.get(
        "user_id"
    )

    if not user_id:

        return False

    emit(
        "chat_ready",
        {
            "success": True,
        },
    )


@socketio.on("send_message")
def socket_send_message(data):

    user_id = session.get(
        "user_id"
    )

    if not user_id:

        emit(
            "chat_error",
            {
                "error":
                    "Sessiya mavjud emas.",
            },
        )

        return

    if not isinstance(
        data,
        dict,
    ):

        emit(
            "chat_error",
            {
                "error":
                    "Xabar formati noto‘g‘ri.",
            },
        )

        return

    text = str(
        data.get(
            "text",
            "",
        )
    ).strip()

    if not text:

        return

    # Xabar uzunligi
    if len(text) > 5000:

        emit(
            "chat_error",
            {
                "error":
                    "Xabar juda uzun.",
            },
        )

        return

    connection = get_db()

    user = connection.execute(
        """
        SELECT
            id,
            username,
            display_name
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    if user is None:

        connection.close()

        emit(
            "chat_error",
            {
                "error":
                    "Profil topilmadi.",
            },
        )

        return

    created_at = now_iso()

    cursor = connection.execute(
        """
        INSERT INTO messages (
            user_id,
            text,
            created_at
        )
        VALUES (?, ?, ?)
        """,
        (
            user_id,
            text,
            created_at,
        ),
    )

    message_id = cursor.lastrowid

    log_activity(
        connection,
        user_id,
        "chat_message_sent",
        f"Chat xabari yuborildi: {text[:120]}",
        "",
        request.headers.get(
            "User-Agent",
            "",
        ),
    )

    connection.commit()
    connection.close()

    message = {
        "id":
            message_id,

        "user_id":
            user_id,

        "account_name":
            user["username"],

        "name":
            user["display_name"]
            or user["username"],

        "text":
            text,

        "created_at":
            created_at,
    }

    # Hozir online bo‘lgan barcha
    # authenticated foydalanuvchilarga yuboriladi.
    emit(
        "chat_message",
        message,
        broadcast=True,
    )


# ============================================================
# ADMIN ACTIVITY
# ============================================================

@app.get("/api/admin/activity")
def admin_activity():

    connection = get_db()

    rows = connection.execute(
        """
        SELECT
            activity_log.id,
            users.username,
            users.display_name,
            activity_log.action,
            activity_log.details,
            activity_log.device_id,
            activity_log.user_agent,
            activity_log.created_at

        FROM activity_log

        LEFT JOIN users
            ON users.id =
                activity_log.user_id

        ORDER BY
            activity_log.id DESC

        LIMIT 300
        """
    ).fetchall()

    connection.close()

    return jsonify(
        [
            {
                "id":
                    row["id"],

                "account_name":
                    row["username"]
                    or "Noma'lum",

                "name":
                    row["display_name"]
                    or "",

                "action":
                    row["action"],

                "details":
                    row["details"]
                    or "",

                "device_id":
                    row["device_id"]
                    or "",

                "user_agent":
                    row["user_agent"]
                    or "",

                "created_at":
                    row["created_at"],
            }

            for row in rows
        ]
    )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    init_database()

    socketio.run(
        app,
        host="127.0.0.1",
        port=5000,
        debug=True,
    )