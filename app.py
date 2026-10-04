from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    session,
    send_file,
)

from flask_socketio import (
    SocketIO,
    emit,
    join_room,
    leave_room,
)

from werkzeug.middleware.proxy_fix import ProxyFix

from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

import config


# ============================================================
# APP
# ============================================================

app = Flask(__name__)

# Render kabi hostinglarda maxfiy kalitni Environment Variable'dan
# olish mumkin. Lokal kompyuterda esa config.py'dagi qiymat ishlaydi.
app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    config.SECRET_KEY,
)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Render HTTPS'ni tashqi tomonda tugatadi va ilovaga proxy orqali
# uzatadi. Lokal kompyuterda esa Secure=False bo'ladi.
app.config["SESSION_COOKIE_SECURE"] = bool(
    os.getenv("RENDER")
)

# Render reverse proxy ortida ishlayotganimiz uchun original HTTPS
# sxemasini to'g'ri aniqlashga yordam beradi.
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1,
    x_prefix=1,
)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
)


DATABASE = Path(config.DATABASE_PATH)

CHAT_UPLOAD_DIR = (
    config.DATA_DIR
    / "chat_backgrounds"
)

MAX_CHAT_BACKGROUND_SIZE = (
    8 * 1024 * 1024
)


# ============================================================
# VAQT
# ============================================================

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


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

    CHAT_UPLOAD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )


def get_db() -> sqlite3.Connection:

    ensure_data_directory()

    connection = sqlite3.connect(
        DATABASE,
        timeout=30,
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

    ensure_data_directory()

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

        /* ====================================================
           PRIVATE CHAT
           ==================================================== */

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_a_id INTEGER NOT NULL,
            user_b_id INTEGER NOT NULL,

            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,

            background_a TEXT,
            background_b TEXT,

            UNIQUE(user_a_id, user_b_id),

            FOREIGN KEY (user_a_id)
                REFERENCES users(id),

            FOREIGN KEY (user_b_id)
                REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS direct_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            conversation_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,

            text TEXT NOT NULL,

            client_id TEXT,

            created_at TEXT NOT NULL,

            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id),

            FOREIGN KEY (sender_id)
                REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS
            idx_direct_messages_conversation
        ON direct_messages(conversation_id, id);

        CREATE INDEX IF NOT EXISTS
            idx_direct_messages_sender
        ON direct_messages(sender_id);

        CREATE TABLE IF NOT EXISTS chat_reads (
            conversation_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            last_read_message_id INTEGER NOT NULL DEFAULT 0,

            PRIMARY KEY (
                conversation_id,
                user_id
            ),

            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id)
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
        "password_hash",
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
                password_hash,
                display_name,
                failed_attempts,
                lock_until
            )
            VALUES (
                ?,
                ?,
                NULL,
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
    # OLD PASSWORD MIGRATION
    # ========================================================

    rows = connection.execute(
        """
        SELECT
            id,
            login_code,
            code_hash,
            password_hash
        FROM users
        """
    ).fetchall()

    for row in rows:

        if row["password_hash"]:
            continue

        if row["code_hash"]:

            connection.execute(
                """
                UPDATE users
                SET
                    password_hash = ?,
                    code_hash = NULL,
                    login_code = NULL
                WHERE id = ?
                """,
                (
                    row["code_hash"],
                    row["id"],
                ),
            )

            continue

        old_code = row["login_code"]

        if old_code:

            connection.execute(
                """
                UPDATE users
                SET
                    password_hash = ?,
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
# AUTH HELPERS
# ============================================================

def current_user_id() -> int | None:

    value = session.get("user_id")

    if not value:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def require_user():

    user_id = current_user_id()

    if not user_id:

        return None, (
            jsonify(
                {
                    "success": False,
                    "error":
                        "Avval tizimga kiring.",
                }
            ),
            401,
        )

    return user_id, None


def current_user_role() -> str | None:

    role = session.get("role")

    if role:
        return str(role)

    user_id = current_user_id()

    if not user_id:
        return None

    connection = get_db()

    user = connection.execute(
        """
        SELECT role
        FROM users
        WHERE id = ?
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()

    connection.close()

    if user is None:
        return None

    role = user["role"]

    session["role"] = role

    return role


def require_owner():

    user_id = current_user_id()

    if not user_id:

        return None, (
            jsonify(
                {
                    "success": False,
                    "error":
                        "Avval tizimga kiring.",
                }
            ),
            401,
        )

    role = current_user_role()

    if role != "owner":

        return None, (
            jsonify(
                {
                    "success": False,
                    "error":
                        "Bu bo‘limga kirish taqiqlangan.",
                }
            ),
            403,
        )

    return user_id, None


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

    username = str(
        data.get("name", "")
    ).strip()

    password = str(
        data.get("password", "")
    )

    device_id = str(
        data.get("device_id", "")
    ).strip()

    user_agent = request.headers.get(
        "User-Agent",
        "",
    )

    if not username:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ismingizni kiriting.",
            }
        ), 400

    if not password:

        return jsonify(
            {
                "success": False,
                "error":
                    "Parolni kiriting.",
            }
        ), 400

    if len(username) > 60:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism juda uzun.",
            }
        ), 400

    if len(password) > 200:

        return jsonify(
            {
                "success": False,
                "error":
                    "Parol juda uzun.",
            }
        ), 400

    connection = get_db()

    user = connection.execute(
        """
        SELECT *
        FROM users
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
        """,
        (username,),
    ).fetchone()

    if user is None:

        log_activity(
            connection,
            None,
            "login_failed",
            "Noma'lum hisobga kirishga urinish.",
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
                    "Ism yoki parol noto‘g‘ri.",
            }
        ), 401

    user_id = user["id"]

    lock_until_text = user["lock_until"]

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
                    "Hisob vaqtincha bloklangan.",
            }
        ), 429

    password_hash = user["password_hash"]

    password_correct = False

    if password_hash:

        try:

            password_correct = check_password_hash(
                password_hash,
                password,
            )

        except ValueError:

            password_correct = False

    if not password_correct:

        failed_attempts = (
            user["failed_attempts"] or 0
        ) + 1

        lock_seconds = 0

        if failed_attempts >= 5:

            if failed_attempts < 10:
                lock_seconds = 60

            elif failed_attempts < 15:
                lock_seconds = 5 * 60

            elif failed_attempts < 20:
                lock_seconds = 15 * 60

            else:
                lock_seconds = 30 * 60

        new_lock_until = None

        if lock_seconds:

            new_lock_until = datetime.fromtimestamp(
                now_utc().timestamp()
                + lock_seconds,
                timezone.utc,
            ).isoformat()

        connection.execute(
            """
            UPDATE users
            SET
                failed_attempts = ?,
                lock_until = ?
            WHERE id = ?
            """,
            (
                failed_attempts,
                new_lock_until,
                user_id,
            ),
        )

        log_activity(
            connection,
            user_id,
            "login_failed",
            (
                "Noto‘g‘ri parol. "
                f"Urinish: {failed_attempts}."
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

        if lock_seconds:

            return jsonify(
                {
                    "success": False,
                    "blocked": True,
                    "remaining_seconds":
                        lock_seconds,
                    "error":
                        "Juda ko‘p noto‘g‘ri urinish. "
                        "Hisob vaqtincha bloklandi.",
                }
            ), 429

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism yoki parol noto‘g‘ri.",
                "failed_attempts":
                    failed_attempts,
            }
        ), 401

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
    session["role"] = user["role"]

    display_name = (
        user["display_name"]
        or user["username"]
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
                user["username"],
            "name":
                display_name,
            "role":
                user["role"],
            "has_name":
                bool(
                    display_name.strip()
                ),
        },
    }

    connection.close()

    return jsonify(result)


# ============================================================
# REGISTER
# ============================================================

@app.post("/api/register")
def register():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    username = str(
        data.get("name", "")
    ).strip()

    password = str(
        data.get("password", "")
    )

    device_id = str(
        data.get("device_id", "")
    ).strip()

    user_agent = request.headers.get(
        "User-Agent",
        "",
    )

    if not username:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ismingizni kiriting.",
            }
        ), 400

    if len(username) < 2:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism kamida 2 ta belgidan iborat bo‘lsin.",
            }
        ), 400

    if len(username) > 60:

        return jsonify(
            {
                "success": False,
                "error":
                    "Ism juda uzun.",
            }
        ), 400

    if not password:

        return jsonify(
            {
                "success": False,
                "error":
                    "Parolni kiriting.",
            }
        ), 400

    if len(password) < 6:

        return jsonify(
            {
                "success": False,
                "error":
                    "Parol kamida 6 ta belgidan iborat bo‘lsin.",
            }
        ), 400

    if len(password) > 200:

        return jsonify(
            {
                "success": False,
                "error":
                    "Parol juda uzun.",
            }
        ), 400

    connection = get_db()

    existing_user = connection.execute(
        """
        SELECT id
        FROM users
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
        """,
        (username,),
    ).fetchone()

    if existing_user is not None:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu ism bilan hisob allaqachon mavjud.",
            }
        ), 409

    password_hash = generate_password_hash(
        password
    )

    cursor = connection.execute(
        """
        INSERT INTO users (
            username,
            role,
            login_code,
            code_hash,
            password_hash,
            display_name,
            failed_attempts,
            lock_until,
            created_at
        )
        VALUES (
            ?,
            'user',
            NULL,
            NULL,
            ?,
            ?,
            0,
            NULL,
            ?
        )
        """,
        (
            username,
            password_hash,
            username,
            now_iso(),
        ),
    )

    user_id = cursor.lastrowid

    log_activity(
        connection,
        user_id,
        "account_created",
        "Yangi hisob yaratildi.",
        device_id,
        user_agent,
    )

    connection.commit()

    session.clear()

    session["user_id"] = user_id
    session["role"] = "user"

    connection.close()

    return jsonify(
        {
            "success": True,
            "user": {
                "id": user_id,
                "account_name":
                    username,
                "name":
                    username,
                "role":
                    "user",
                "has_name":
                    True,
            },
        }
    ), 201


# ============================================================
# CURRENT PROFILE
# ============================================================

@app.get("/api/me")
def current_profile():

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "authenticated": False,
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
                "authenticated": False,
            }
        ), 401

    connection.close()

    return jsonify(
        {
            "authenticated": True,
            "user": {
                "id":
                    user["id"],
                "account_name":
                    user["username"],
                "name":
                    user["display_name"]
                    or user["username"],
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

    user_id = current_user_id()

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
        data.get("name", "")
    ).strip()

    device_id = str(
        data.get("device_id", "")
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

    user_id = current_user_id()

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

    user_id = current_user_id()

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
                    or row["username"],
                "role":
                    row["role"],
                "created_at":
                    row["created_at"],
            }
            for row in rows
        ]
    )


# ============================================================
# LEGACY CHAT HISTORY
# ============================================================

@app.get("/api/chat/messages")
def chat_messages():

    user_id = current_user_id()

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
            ON users.id = messages.user_id
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
# PRIVATE CHAT HELPERS
# ============================================================

def canonical_pair(
    first_id: int,
    second_id: int,
) -> tuple[int, int]:

    if first_id < second_id:
        return first_id, second_id

    return second_id, first_id


def user_public_data(
    row: sqlite3.Row,
) -> dict:

    return {
        "id":
            row["id"],
        "account_name":
            row["username"],
        "name":
            row["display_name"]
            or row["username"],
    }


def user_can_access_conversation(
    connection: sqlite3.Connection,
    conversation_id: int,
    user_id: int,
) -> bool:

    row = connection.execute(
        """
        SELECT id
        FROM conversations
        WHERE id = ?
          AND (
              user_a_id = ?
              OR user_b_id = ?
          )
        LIMIT 1
        """,
        (
            conversation_id,
            user_id,
            user_id,
        ),
    ).fetchone()

    return row is not None


def conversation_other_user(
    connection: sqlite3.Connection,
    conversation_id: int,
    user_id: int,
):

    return connection.execute(
        """
        SELECT
            u.id,
            u.username,
            u.display_name
        FROM conversations c

        JOIN users u
            ON u.id =
                CASE
                    WHEN c.user_a_id = ?
                    THEN c.user_b_id
                    ELSE c.user_a_id
                END

        WHERE c.id = ?
        LIMIT 1
        """,
        (
            user_id,
            conversation_id,
        ),
    ).fetchone()


def conversation_background_column(
    connection: sqlite3.Connection,
    conversation_id: int,
    user_id: int,
) -> str | None:

    row = connection.execute(
        """
        SELECT
            user_a_id,
            user_b_id,
            background_a,
            background_b
        FROM conversations
        WHERE id = ?
        LIMIT 1
        """,
        (conversation_id,),
    ).fetchone()

    if row is None:
        return None

    if row["user_a_id"] == user_id:
        return row["background_a"]

    if row["user_b_id"] == user_id:
        return row["background_b"]

    return None


def private_message_payload(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
) -> dict:

    sender = connection.execute(
        """
        SELECT
            id,
            username,
            display_name
        FROM users
        WHERE id = ?
        """,
        (row["sender_id"],),
    ).fetchone()

    return {
        "id":
            row["id"],
        "conversation_id":
            row["conversation_id"],
        "sender_id":
            row["sender_id"],
        "account_name":
            sender["username"]
            if sender
            else "",
        "name":
            (
                sender["display_name"]
                or sender["username"]
            )
            if sender
            else "",
        "text":
            row["text"],
        "client_id":
            row["client_id"],
        "created_at":
            row["created_at"],
    }


# ============================================================
# SEARCH USERS
# ============================================================

@app.get("/api/chat/users")
def chat_search_users():

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    query = str(
        request.args.get(
            "q",
            "",
        )
    ).strip()

    if len(query) > 60:
        query = query[:60]

    connection = get_db()

    if query:

        rows = connection.execute(
            """
            SELECT
                id,
                username,
                display_name
            FROM users
            WHERE id != ?
              AND (
                    LOWER(username)
                        LIKE LOWER(?)
                    OR
                    LOWER(
                        COALESCE(
                            display_name,
                            ''
                        )
                    )
                        LIKE LOWER(?)
              )
            ORDER BY
                CASE
                    WHEN LOWER(username)
                        = LOWER(?)
                    THEN 0
                    ELSE 1
                END,
                id ASC
            LIMIT 20
            """,
            (
                user_id,
                f"%{query}%",
                f"%{query}%",
                query,
            ),
        ).fetchall()

    else:

        rows = connection.execute(
            """
            SELECT
                id,
                username,
                display_name
            FROM users
            WHERE id != ?
            ORDER BY id ASC
            LIMIT 20
            """,
            (user_id,),
        ).fetchall()

    connection.close()

    return jsonify(
        {
            "success": True,
            "users": [
                user_public_data(row)
                for row in rows
            ],
        }
    )


# ============================================================
# CREATE / GET CONVERSATION
# ============================================================

@app.post("/api/chat/conversations")
def create_conversation():

    user_id = current_user_id()

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

    try:

        other_user_id = int(
            data.get("user_id")
        )

    except (
        TypeError,
        ValueError,
    ):

        return jsonify(
            {
                "success": False,
                "error":
                    "Foydalanuvchi noto‘g‘ri.",
            }
        ), 400

    if other_user_id == user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "O‘zingiz bilan chat ochib bo‘lmaydi.",
            }
        ), 400

    connection = get_db()

    other = connection.execute(
        """
        SELECT
            id,
            username,
            display_name
        FROM users
        WHERE id = ?
        LIMIT 1
        """,
        (other_user_id,),
    ).fetchone()

    if other is None:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Foydalanuvchi topilmadi.",
            }
        ), 404

    user_a, user_b = canonical_pair(
        user_id,
        other_user_id,
    )

    existing = connection.execute(
        """
        SELECT *
        FROM conversations
        WHERE user_a_id = ?
          AND user_b_id = ?
        LIMIT 1
        """,
        (
            user_a,
            user_b,
        ),
    ).fetchone()

    if existing:

        conversation_id = existing["id"]

    else:

        created_at = now_iso()

        cursor = connection.execute(
            """
            INSERT INTO conversations (
                user_a_id,
                user_b_id,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                user_a,
                user_b,
                created_at,
                created_at,
            ),
        )

        conversation_id = cursor.lastrowid

        connection.execute(
            """
            INSERT OR IGNORE INTO chat_reads (
                conversation_id,
                user_id,
                last_read_message_id
            )
            VALUES (?, ?, 0)
            """,
            (
                conversation_id,
                user_id,
            ),
        )

        connection.execute(
            """
            INSERT OR IGNORE INTO chat_reads (
                conversation_id,
                user_id,
                last_read_message_id
            )
            VALUES (?, ?, 0)
            """,
            (
                conversation_id,
                other_user_id,
            ),
        )

    connection.commit()
    connection.close()

    return jsonify(
        {
            "success": True,
            "conversation_id":
                conversation_id,
            "user":
                user_public_data(other),
        }
    )


# ============================================================
# CONVERSATION LIST
# ============================================================

@app.get("/api/chat/conversations")
def list_conversations():

    user_id = current_user_id()

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
            c.id,
            c.user_a_id,
            c.user_b_id,
            c.created_at,
            c.updated_at,

            CASE
                WHEN c.user_a_id = ?
                THEN c.user_b_id
                ELSE c.user_a_id
            END AS other_user_id,

            (
                SELECT dm.text
                FROM direct_messages dm
                WHERE dm.conversation_id = c.id
                ORDER BY dm.id DESC
                LIMIT 1
            ) AS last_text,

            (
                SELECT dm.created_at
                FROM direct_messages dm
                WHERE dm.conversation_id = c.id
                ORDER BY dm.id DESC
                LIMIT 1
            ) AS last_message_at,

            (
                SELECT COUNT(*)
                FROM direct_messages dm
                WHERE dm.conversation_id = c.id
                  AND dm.id >
                      COALESCE(
                          (
                              SELECT cr.last_read_message_id
                              FROM chat_reads cr
                              WHERE cr.conversation_id = c.id
                                AND cr.user_id = ?
                          ),
                          0
                      )
                  AND dm.sender_id != ?
            ) AS unread_count

        FROM conversations c

        WHERE
            c.user_a_id = ?
            OR c.user_b_id = ?

        ORDER BY
            COALESCE(
                last_message_at,
                c.updated_at
            ) DESC
        """,
        (
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
        ),
    ).fetchall()

    result = []

    for row in rows:

        other = connection.execute(
            """
            SELECT
                id,
                username,
                display_name
            FROM users
            WHERE id = ?
            """,
            (
                row["other_user_id"],
            ),
        ).fetchone()

        if other is None:
            continue

        result.append(
            {
                "id":
                    row["id"],
                "user":
                    user_public_data(other),
                "last_text":
                    row["last_text"]
                    or "",
                "last_message_at":
                    row["last_message_at"]
                    or row["updated_at"],
                "unread_count":
                    int(
                        row["unread_count"]
                        or 0
                    ),
            }
        )

    connection.close()

    return jsonify(
        {
            "success": True,
            "conversations":
                result,
        }
    )


# ============================================================
# CONVERSATION MESSAGES
# ============================================================

@app.get(
    "/api/chat/conversations/<int:conversation_id>/messages"
)
def private_chat_messages(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    rows = connection.execute(
        """
        SELECT
            id,
            conversation_id,
            sender_id,
            text,
            client_id,
            created_at
        FROM direct_messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT 100
        """,
        (conversation_id,),
    ).fetchall()

    rows = list(
        reversed(rows)
    )

    messages = [
        private_message_payload(
            connection,
            row,
        )
        for row in rows
    ]

    connection.close()

    return jsonify(
        {
            "success": True,
            "messages":
                messages,
        }
    )


# ============================================================
# MARK READ
# ============================================================

@app.post(
    "/api/chat/conversations/<int:conversation_id>/read"
)
def mark_chat_read(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    latest = connection.execute(
        """
        SELECT id
        FROM direct_messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (conversation_id,),
    ).fetchone()

    latest_id = (
        latest["id"]
        if latest
        else 0
    )

    connection.execute(
        """
        INSERT INTO chat_reads (
            conversation_id,
            user_id,
            last_read_message_id
        )
        VALUES (?, ?, ?)

        ON CONFLICT(
            conversation_id,
            user_id
        )
        DO UPDATE SET
            last_read_message_id =
                excluded.last_read_message_id
        """,
        (
            conversation_id,
            user_id,
            latest_id,
        ),
    )

    connection.commit()
    connection.close()

    return jsonify(
        {
            "success": True,
            "last_read_message_id":
                latest_id,
        }
    )


# ============================================================
# CHAT BACKGROUND
# ============================================================

@app.get(
    "/api/chat/conversations/<int:conversation_id>/background"
)
def get_chat_background(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    filename = conversation_background_column(
        connection,
        conversation_id,
        user_id,
    )

    connection.close()

    return jsonify(
        {
            "success": True,
            "filename":
                filename or "",
            "url":
                (
                    f"/api/chat/conversations/"
                    f"{conversation_id}/background/file"
                    if filename
                    else ""
                ),
        }
    )


@app.get(
    "/api/chat/conversations/<int:conversation_id>/background/file"
)
def serve_chat_background(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:
        return "", 401

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        return "", 403

    filename = conversation_background_column(
        connection,
        conversation_id,
        user_id,
    )

    connection.close()

    if not filename:
        return "", 404

    path = CHAT_UPLOAD_DIR / filename

    if not path.exists():
        return "", 404

    return send_file(
        path,
        conditional=True,
    )


@app.post(
    "/api/chat/conversations/<int:conversation_id>/background"
)
def upload_chat_background(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    uploaded = request.files.get(
        "background"
    )

    if uploaded is None:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Rasm tanlanmagan.",
            }
        ), 400

    original_name = (
        uploaded.filename
        or ""
    )

    extension = Path(
        original_name
    ).suffix.lower()

    allowed = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
    }

    if extension not in allowed:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu rasm formatini qo‘llab-quvvatlab bo‘lmaydi.",
            }
        ), 400

    uploaded.stream.seek(0)

    content = uploaded.stream.read(
        MAX_CHAT_BACKGROUND_SIZE + 1
    )

    if len(content) > MAX_CHAT_BACKGROUND_SIZE:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Rasm 8 MB dan kichik bo‘lishi kerak.",
            }
        ), 400

    filename = (
        f"{uuid4().hex}"
        f"{extension}"
    )

    path = CHAT_UPLOAD_DIR / filename

    path.write_bytes(content)

    row = connection.execute(
        """
        SELECT
            user_a_id,
            user_b_id,
            background_a,
            background_b
        FROM conversations
        WHERE id = ?
        """,
        (conversation_id,),
    ).fetchone()

    if row is None:

        connection.close()

        try:
            path.unlink()
        except OSError:
            pass

        return jsonify(
            {
                "success": False,
                "error":
                    "Suhbat topilmadi.",
            }
        ), 404

    old_filename = None

    if row["user_a_id"] == user_id:

        old_filename = row["background_a"]

        connection.execute(
            """
            UPDATE conversations
            SET background_a = ?
            WHERE id = ?
            """,
            (
                filename,
                conversation_id,
            ),
        )

    elif row["user_b_id"] == user_id:

        old_filename = row["background_b"]

        connection.execute(
            """
            UPDATE conversations
            SET background_b = ?
            WHERE id = ?
            """,
            (
                filename,
                conversation_id,
            ),
        )

    else:

        connection.close()

        try:
            path.unlink()
        except OSError:
            pass

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    connection.commit()
    connection.close()

    if old_filename:

        old_path = (
            CHAT_UPLOAD_DIR
            / old_filename
        )

        try:

            if old_path.exists():
                old_path.unlink()

        except OSError:
            pass

    return jsonify(
        {
            "success": True,
            "url":
                (
                    f"/api/chat/conversations/"
                    f"{conversation_id}/background/file"
                ),
        }
    )


@app.delete(
    "/api/chat/conversations/<int:conversation_id>/background"
)
def delete_chat_background(
    conversation_id: int,
):

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    row = connection.execute(
        """
        SELECT
            user_a_id,
            user_b_id,
            background_a,
            background_b
        FROM conversations
        WHERE id = ?
        """,
        (conversation_id,),
    ).fetchone()

    if row is None:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Suhbat topilmadi.",
            }
        ), 404

    old_filename = None

    if row["user_a_id"] == user_id:

        old_filename = row["background_a"]

        connection.execute(
            """
            UPDATE conversations
            SET background_a = NULL
            WHERE id = ?
            """,
            (conversation_id,),
        )

    elif row["user_b_id"] == user_id:

        old_filename = row["background_b"]

        connection.execute(
            """
            UPDATE conversations
            SET background_b = NULL
            WHERE id = ?
            """,
            (conversation_id,),
        )

    else:

        connection.close()

        return jsonify(
            {
                "success": False,
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            }
        ), 403

    connection.commit()
    connection.close()

    if old_filename:

        old_path = (
            CHAT_UPLOAD_DIR
            / old_filename
        )

        try:

            if old_path.exists():
                old_path.unlink()

        except OSError:
            pass

    return jsonify(
        {
            "success": True,
        }
    )


# ============================================================
# PRIVATE CHAT SOCKET
# ============================================================

@socketio.on("chat:join")
def private_chat_join(data):

    user_id = current_user_id()

    if not user_id:
        return

    if not isinstance(data, dict):
        return

    try:

        conversation_id = int(
            data.get(
                "conversation_id"
            )
        )

    except (
        TypeError,
        ValueError,
    ):

        return

    connection = get_db()

    allowed = user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    )

    connection.close()

    if not allowed:
        return

    join_room(
        f"conversation_{conversation_id}"
    )


@socketio.on("chat:leave")
def private_chat_leave(data):

    if not isinstance(data, dict):
        return

    try:

        conversation_id = int(
            data.get(
                "conversation_id"
            )
        )

    except (
        TypeError,
        ValueError,
    ):

        return

    leave_room(
        f"conversation_{conversation_id}"
    )


@socketio.on("chat:typing")
def private_chat_typing(data):

    user_id = current_user_id()

    if not user_id:
        return

    if not isinstance(data, dict):
        return

    try:

        conversation_id = int(
            data.get(
                "conversation_id"
            )
        )

    except (
        TypeError,
        ValueError,
    ):

        return

    is_typing = bool(
        data.get("typing")
    )

    connection = get_db()

    allowed = user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    )

    if not allowed:

        connection.close()
        return

    user = connection.execute(
        """
        SELECT
            username,
            display_name
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    ).fetchone()

    connection.close()

    emit(
        "chat:typing",
        {
            "conversation_id":
                conversation_id,
            "user_id":
                user_id,
            "name":
                (
                    user["display_name"]
                    or user["username"]
                )
                if user
                else "",
            "typing":
                is_typing,
        },
        to=f"conversation_{conversation_id}",
        include_self=False,
    )


@socketio.on("chat:send")
def private_chat_send(data):

    user_id = current_user_id()

    if not user_id:

        emit(
            "chat:error",
            {
                "error":
                    "Sessiya mavjud emas.",
            },
        )

        return

    if not isinstance(data, dict):

        emit(
            "chat:error",
            {
                "error":
                    "Xabar formati noto‘g‘ri.",
            },
        )

        return

    try:

        conversation_id = int(
            data.get(
                "conversation_id"
            )
        )

    except (
        TypeError,
        ValueError,
    ):

        emit(
            "chat:error",
            {
                "error":
                    "Suhbat topilmadi.",
            },
        )

        return

    text = str(
        data.get(
            "text",
            "",
        )
    ).strip()

    client_id = str(
        data.get(
            "client_id",
            "",
        )
    ).strip()

    if not text:
        return

    if len(text) > 5000:

        emit(
            "chat:error",
            {
                "error":
                    "Xabar juda uzun.",
            },
        )

        return

    connection = get_db()

    if not user_can_access_conversation(
        connection,
        conversation_id,
        user_id,
    ):

        connection.close()

        emit(
            "chat:error",
            {
                "error":
                    "Bu suhbatga kirish mumkin emas.",
            },
        )

        return

    created_at = now_iso()

    cursor = connection.execute(
        """
        INSERT INTO direct_messages (
            conversation_id,
            sender_id,
            text,
            client_id,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            conversation_id,
            user_id,
            text,
            client_id or None,
            created_at,
        ),
    )

    message_id = cursor.lastrowid

    connection.execute(
        """
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
        """,
        (
            created_at,
            conversation_id,
        ),
    )

    log_activity(
        connection,
        user_id,
        "private_chat_message_sent",
        f"Private chat xabari: {text[:120]}",
        "",
        request.headers.get(
            "User-Agent",
            "",
        ),
    )

    row = connection.execute(
        """
        SELECT
            id,
            conversation_id,
            sender_id,
            text,
            client_id,
            created_at
        FROM direct_messages
        WHERE id = ?
        """,
        (message_id,),
    ).fetchone()

    message = private_message_payload(
        connection,
        row,
    )

    connection.commit()
    connection.close()

    emit(
        "chat:message",
        message,
        to=f"conversation_{conversation_id}",
    )


# ============================================================
# OLD CHAT SOCKET
# ============================================================

@socketio.on("connect")
def socket_connect():

    user_id = current_user_id()

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

    user_id = current_user_id()

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

    emit(
        "chat_message",
        message,
        broadcast=True,
    )


# ============================================================
# XATLAR
# ============================================================

def ensure_letters_table(connection):

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS letters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            open_at TEXT,
            visibility TEXT NOT NULL DEFAULT 'both',
            created_at TEXT NOT NULL
        )
        """
    )


def parse_time(value):

    try:

        parsed = datetime.fromisoformat(
            str(value).replace(
                "Z",
                "+00:00",
            )
        )

    except ValueError:

        return None

    if parsed.tzinfo is None:

        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed.astimezone(
        timezone.utc
    )


@app.get("/api/letters")
def letters_list():

    user_id = current_user_id()

    if not user_id:

        return jsonify(
            {
                "success": False,
                "error":
                    "Avval tizimga kiring.",
            }
        ), 401

    connection = get_db()

    ensure_letters_table(
        connection
    )

    rows = connection.execute(
        """
        SELECT
            letters.id,
            letters.user_id,
            letters.title,
            letters.body,
            letters.open_at,
            letters.visibility,
            letters.created_at,
            users.username,
            users.display_name

        FROM letters

        JOIN users
            ON users.id =
                letters.user_id

        WHERE letters.user_id = ?
           OR letters.visibility = 'both'

        ORDER BY letters.id DESC

        LIMIT 100
        """,
        (user_id,),
    ).fetchall()

    connection.close()

    now = now_utc()

    result = []

    for row in rows:

        mine = (
            row["user_id"]
            == user_id
        )

        opens = (
            parse_time(
                row["open_at"]
            )
            if row["open_at"]
            else None
        )

        locked = bool(
            opens
            and opens > now
            and not mine
        )

        result.append(
            {
                "id":
                    row["id"],
                "name":
                    row["display_name"]
                    or row["username"],
                "title":
                    row["title"],
                "body":
                    ""
                    if locked
                    else row["body"],
                "open_at":
                    row["open_at"],
                "visibility":
                    row["visibility"],
                "locked":
                    locked,
                "mine":
                    mine,
                "created_at":
                    row["created_at"],
            }
        )

    return jsonify(
        {
            "success": True,
            "letters":
                result,
        }
    )


@app.post("/api/letters")
def letters_create():

    user_id = current_user_id()

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

    title = str(
        data.get(
            "title",
            "",
        )
    ).strip()

    body = str(
        data.get(
            "body",
            "",
        )
    ).strip()

    visibility = data.get(
        "visibility",
        "both",
    )

    if visibility not in (
        "me",
        "both",
    ):

        visibility = "both"

    if not title or not body:

        return jsonify(
            {
                "success": False,
                "error":
                    "Sarlavha va matnni yozing.",
            }
        ), 400

    if (
        len(title) > 100
        or len(body) > 10000
    ):

        return jsonify(
            {
                "success": False,
                "error":
                    "Xat juda uzun.",
            }
        ), 400

    open_at = None

    if data.get("open_at"):

        opens = parse_time(
            data["open_at"]
        )

        if opens is None:

            return jsonify(
                {
                    "success": False,
                    "error":
                        "Vaqt noto‘g‘ri.",
                }
            ), 400

        open_at = opens.isoformat()

    connection = get_db()

    ensure_letters_table(
        connection
    )

    connection.execute(
        """
        INSERT INTO letters (
            user_id,
            title,
            body,
            open_at,
            visibility,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            title,
            body,
            open_at,
            visibility,
            now_iso(),
        ),
    )

    log_activity(
        connection,
        user_id,
        "letter_created",
        f"Xat yaratildi: {title[:80]}",
        "",
        request.headers.get(
            "User-Agent",
            "",
        ),
    )

    connection.commit()
    connection.close()

    return jsonify(
        {
            "success": True,
        }
    )


# ============================================================
# ADMIN ACTIVITY
# ============================================================

@app.get("/api/admin/activity")
def admin_activity():

    _, error_response = require_owner()

    if error_response:
        return error_response

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
# DATABASE INITIALIZATION
# ============================================================
#
# MUHIM:
# Gunicorn app:app orqali ilovani import qilganda
# __main__ qismi ishlamaydi.
#
# Shuning uchun database'ni shu yerda ishga tushiramiz.
# Bu lokal python app.py uchun ham muammo emas.
# ============================================================

init_database()


# ============================================================
# LOCAL START
# ============================================================

if __name__ == "__main__":

    port = int(
        os.getenv(
            "PORT",
            "5000",
        )
    )

    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=True,
    )