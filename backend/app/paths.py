"""Resolve the data root in source checkouts and in frozen (PyInstaller) builds."""
import sys
from pathlib import Path

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
