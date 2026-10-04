from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "site.db"


SECRET_KEY = "marjona-site-change-this-later"


# Demo kirish kodlari.
# Keyinchalik bular database orqali boshqariladigan
# xavfsiz tizimga almashtiriladi.
JAMSHID_CODE = "1111"
FRIEND_CODE = "2222"

# Sirli panel kodi.
SECRET_PANEL_CODE = "9090"