from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

PARTS_DIR = BASE_DIR / "templates" / "parts"

INDEX_FILE = BASE_DIR / "templates" / "index.html"


PART_FILES = [
    "entry.html",
    "intro.html",
    "name.html",
    "world.html",
    "menu.html",
]


JS_FILES = [
    "core.js",
    "api.js",
    "entry.js",
    "chat.js",
    "letters.js",
    "worlds.js",
    "environment.js",
    "profile.js",
    "special.js",
    "menu.js",
    "auth.js",
]


CSS_FILES = [
    "base.css",
    "ambient.css",
    "entry.css",
    "intro.css",
    "world.css",
    "menu.css",
    "sheet.css",
    "chat.css",
    "letters.css",
    "responsive.css",
]


def read_file(path: Path) -> str:

    if not path.exists():
        raise FileNotFoundError(
            f"Fayl topilmadi: {path}"
        )

    return path.read_text(
        encoding="utf-8"
    )


def build_index():

    parts = {}

    for filename in PART_FILES:

        path = PARTS_DIR / filename

        parts[filename] = read_file(path)


    css_links = "\n".join(
        f'''    <link
        rel="stylesheet"
        href="{{{{ url_for('static', filename='css/{filename}') }}}}"
    >'''
        for filename in CSS_FILES
    )


    js_scripts = "\n".join(
        f'''    <script
        src="{{{{ url_for('static', filename='js/{filename}') }}}}"
    ></script>'''
        for filename in JS_FILES
    )


    html = f"""<!DOCTYPE html>

<html lang="uz">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Bir kichik olam</title>


    <!-- CSS -->

{css_links}

</head>


<body>


    <!-- Ambient -->

    <div
        class="ambient"
        aria-hidden="true"
    ></div>


    <!-- Dust -->

    <div
        class="dust"
        aria-hidden="true"
    ></div>


    <!-- Entry -->

    {parts["entry.html"]}


    <!-- Intro -->

    {parts["intro.html"]}


    <!-- Name -->

    {parts["name.html"]}


    <!-- World -->

    {parts["world.html"]}


    <!-- Menu -->

    {parts["menu.html"]}


    <!-- Socket.IO -->

    <script
        src="https://cdn.socket.io/4.8.3/socket.io.min.js"
    ></script>


    <!-- JavaScript -->

{js_scripts}


</body>

</html>
"""


    INDEX_FILE.write_text(
        html,
        encoding="utf-8"
    )


    print()
    print("========================================")
    print(" INDEX BUILD MUVAFFAQIYATLI")
    print("========================================")
    print()
    print(f"Fayl: {INDEX_FILE}")
    print()
    print(f"CSS: {len(CSS_FILES)} ta")
    print(f"JS:  {len(JS_FILES)} ta")
    print(f"HTML parts: {len(PART_FILES)} ta")
    print()
    print("Tayyor.")
    print()


if __name__ == "__main__":
    build_index()