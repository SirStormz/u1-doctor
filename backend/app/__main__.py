"""Run: python -m app  -> serves on 127.0.0.1 only (unless U1DOCTOR_HOST is set, as in the Docker image)."""
import os

import uvicorn

from .api import create_app

if __name__ == "__main__":
    port = int(os.environ.get("U1DOCTOR_PORT", "8765"))
    host = os.environ.get("U1DOCTOR_HOST", "127.0.0.1")  # only the Docker image widens it (and publishes the port on the host loopback)
    uvicorn.run(create_app(os.environ.get("U1DOCTOR_DB", "u1doctor.sqlite3")), host=host, port=port, log_level="info")
