"""The app version has one source of truth: APP_VERSION in app/api.py (for example "0.1.7-g1").

Every other place that repeats it must agree, or this test fails: pyproject, the frontend package and its lock file,
the zip name, the Windows version resource (tuple and string forms) and the download name in the README.
"""

import json
import re
import tomllib
from pathlib import Path

from app.api import APP_VERSION

ROOT = Path(__file__).resolve().parents[2]
BASE = APP_VERSION.split("-")[0]  # "0.1.7": package managers do not take the "-g1" gate suffix
TUPLE = "(" + ", ".join([*BASE.split("."), "0"]) + ")"  # "(0, 1, 7, 0)"


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_app_version_shape():
    assert re.fullmatch(r"\d+\.\d+\.\d+-g\d+", APP_VERSION), APP_VERSION


def test_pyproject_version():
    assert tomllib.loads(_read("backend/pyproject.toml"))["project"]["version"] == BASE


def test_frontend_package_and_lock():
    assert json.loads(_read("frontend/package.json"))["version"] == BASE
    lock = json.loads(_read("frontend/package-lock.json"))
    assert lock["version"] == BASE
    assert lock["packages"][""]["version"] == BASE


def test_zip_name():
    assert f'$name = "u1-doctor-{APP_VERSION}-win64"' in _read("scripts/package_zip.ps1")


def test_windows_version_resource():
    vi = _read("scripts/version_info.txt")
    assert f"filevers={TUPLE}" in vi
    assert f"prodvers={TUPLE}" in vi
    assert f"StringStruct('FileVersion', '{BASE}.0')" in vi
    assert f"StringStruct('ProductVersion', '{APP_VERSION}')" in vi


def test_readme_download_name():
    readme = _read("README.md")
    names = set(re.findall(r"u1-doctor-(\d+\.\d+\.\d+-g\d+)-win64\.zip", readme))
    assert names == {APP_VERSION}, names
