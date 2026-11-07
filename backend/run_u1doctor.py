"""PyInstaller entry point. Serves on 127.0.0.1 only."""
import os
import sys

import uvicorn

from app.api import create_app


def main() -> None:
    port = int(os.environ.get("U1DOCTOR_PORT", "8765"))
    db = os.environ.get("U1DOCTOR_DB", os.path.join(os.path.expanduser("~"), ".u1-doctor.sqlite3"))
    uvicorn.run(create_app(db), host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    sys.exit(main())
