"""PyInstaller entry point: opens U1 Doctor in its own window (see app/desktop.py). Serves on 127.0.0.1 only."""
import sys

from app.desktop import main

if __name__ == "__main__":
    sys.exit(main())
