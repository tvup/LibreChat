"""Minimal LibreChat code-interpreter shim.

Implements the contract that LibreChat's `kodefortolker` toggle expects:

  POST /exec                          -> run code, return stdout/stderr/files
  GET  /files/{session_id}?detail=full -> list artefacts from a session
  GET  /files/{session_id}/{name}     -> download a single artefact

Sandboxing strategy: each execution spawns an ephemeral Docker container on
the host (via the bind-mounted /var/run/docker.sock) with --network=none and
strict resource limits.  Session directories persist between calls so files
generated in one execution are available in the next call within the same
session.
"""

import os
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException, Path as PathParam
from fastapi.responses import FileResponse
from pydantic import BaseModel

API_KEY = os.environ["CODE_SHIM_API_KEY"]
SESSIONS_DIR = Path(os.environ.get("CODE_SHIM_SESSIONS_DIR", "/sessions"))
# Path to the same directory as seen from the docker host.  Required because
# we spawn sibling containers via the host's docker.sock — bind-mount sources
# are resolved by the host daemon, not by this container.
HOST_SESSIONS_DIR = os.environ["CODE_SHIM_HOST_SESSIONS_DIR"]
EXEC_TIMEOUT = int(os.environ.get("CODE_SHIM_TIMEOUT", "60"))
MEMORY_LIMIT = os.environ.get("CODE_SHIM_MEMORY", "1g")
CPU_LIMIT = os.environ.get("CODE_SHIM_CPUS", "2")
# When set, mount this host directory at /project in every exec container.
PROJECT_HOST_DIR = os.environ.get("CODE_SHIM_PROJECT_HOST_DIR")
# "none" disables network in exec containers; "bridge" allows internet.
EXEC_NETWORK = os.environ.get("CODE_SHIM_NETWORK", "bridge")
# When set, lang="sail" runs commands inside this already-running container
# (typically the Laravel Sail app container) via `docker exec`.
SAIL_CONTAINER = os.environ.get("CODE_SHIM_SAIL_CONTAINER")
SAIL_WORKDIR = os.environ.get("CODE_SHIM_SAIL_WORKDIR", "/var/www/html")

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

LANG_CONFIG = {
    "py": {"image": "python:3.12-slim", "ext": "py", "cmd": ["python", "code.py"]},
    "js": {"image": "node:20-slim", "ext": "js", "cmd": ["node", "code.js"]},
    "ts": {"image": "node:20-slim", "ext": "ts", "cmd": ["npx", "-y", "tsx", "code.ts"]},
    "sh": {"image": "alpine:latest", "ext": "sh", "cmd": ["sh", "code.sh"]},
    "go": {"image": "golang:1.22-alpine", "ext": "go", "cmd": ["go", "run", "code.go"]},
    "rb": {"image": "ruby:3.3-slim", "ext": "rb", "cmd": ["ruby", "code.rb"]},
    # composer image already bundles PHP 8 + composer; ample for Laravel work.
    "php": {"image": "composer:2", "ext": "php", "cmd": ["php", "code.php"]},
}

app = FastAPI(title="librechat-code-shim", version="0.1.0")


class CodeFile(BaseModel):
    session_id: Optional[str] = None
    id: Optional[str] = None
    name: str
    content: Optional[str] = None


class ExecRequest(BaseModel):
    lang: str
    code: str
    args: Optional[List[str]] = None
    files: Optional[List[CodeFile]] = None
    session_id: Optional[str] = None


def _check_auth(x_api_key: Optional[str]) -> None:
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _safe_session_dir(session_id: str) -> Path:
    """Resolve the session directory, blocking path traversal."""
    if "/" in session_id or ".." in session_id or not session_id:
        raise HTTPException(status_code=400, detail="Invalid session_id")
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(exist_ok=True)
    return session_dir


def _exec_in_sail(req: ExecRequest) -> dict:
    """Run a shell command inside an already-running Sail/compose container.

    No bind mount, no fresh image — we hop straight into the live app
    container so MySQL, Redis, Meilisearch etc. resolve correctly via
    Sail's internal docker network and `.env`."""
    if not SAIL_CONTAINER:
        raise HTTPException(
            status_code=400,
            detail="lang='sail' requested but CODE_SHIM_SAIL_CONTAINER is not set",
        )
    session_id = req.session_id or uuid.uuid4().hex
    cmd = [
        "docker", "exec",
        "-w", SAIL_WORKDIR,
        SAIL_CONTAINER,
        "sh", "-c", req.code,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=EXEC_TIMEOUT)
        stdout = proc.stdout.decode("utf-8", errors="replace")
        stderr = proc.stderr.decode("utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        stdout, stderr = "", f"Execution timed out after {EXEC_TIMEOUT}s"
    return {
        "stdout": stdout,
        "stderr": stderr,
        "files": [],
        "session_id": session_id,
    }


@app.post("/exec")
def exec_code(req: ExecRequest, x_api_key: Optional[str] = Header(None, alias="X-API-Key")):
    _check_auth(x_api_key)

    if req.lang == "sail":
        return _exec_in_sail(req)

    cfg = LANG_CONFIG.get(req.lang)
    if cfg is None:
        supported = sorted(LANG_CONFIG) + (["sail"] if SAIL_CONTAINER else [])
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language '{req.lang}'. Supported: {supported}",
        )

    session_id = req.session_id or uuid.uuid4().hex
    session_dir = _safe_session_dir(session_id)

    code_path = session_dir / f"code.{cfg['ext']}"
    code_path.write_text(req.code)

    # Snapshot existing files to detect what was generated by this execution.
    files_before = {p.name for p in session_dir.iterdir() if p.name != code_path.name}

    host_session_path = f"{HOST_SESSIONS_DIR.rstrip('/')}/{session_id}"
    docker_cmd = [
        "docker", "run", "--rm",
        f"--network={EXEC_NETWORK}",
        f"--memory={MEMORY_LIMIT}",
        f"--cpus={CPU_LIMIT}",
        "-v", f"{host_session_path}:/work",
        "-w", "/work",
        "-e", "HOME=/tmp",
    ]
    if PROJECT_HOST_DIR:
        docker_cmd += ["-v", f"{PROJECT_HOST_DIR}:/project"]
    docker_cmd += [cfg["image"], *cfg["cmd"], *(req.args or [])]

    try:
        proc = subprocess.run(
            docker_cmd,
            capture_output=True,
            timeout=EXEC_TIMEOUT,
        )
        stdout = proc.stdout.decode("utf-8", errors="replace")
        stderr = proc.stderr.decode("utf-8", errors="replace")
    except subprocess.TimeoutExpired:
        stdout = ""
        stderr = f"Execution timed out after {EXEC_TIMEOUT}s"
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="docker CLI not available inside shim container",
        )

    files_after = {p.name for p in session_dir.iterdir() if p.name != code_path.name}
    new_files = sorted(files_after - files_before)

    generated = [
        {"name": name, "id": uuid.uuid4().hex}
        for name in new_files
    ]

    return {
        "stdout": stdout,
        "stderr": stderr,
        "files": generated,
        "session_id": session_id,
    }


@app.get("/files/{session_id}")
def list_files(
    session_id: str = PathParam(..., min_length=1),
    detail: str = "full",
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    _check_auth(x_api_key)
    session_dir = SESSIONS_DIR / session_id
    if not session_dir.exists():
        return []
    return [
        {
            "name": p.name,
            "metadata": {"original-filename": p.name},
        }
        for p in session_dir.iterdir()
        if not p.name.startswith("code.")
    ]


@app.get("/files/{session_id}/{filename}")
def download_file(
    session_id: str,
    filename: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    _check_auth(x_api_key)
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = SESSIONS_DIR / session_id / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    _check_auth(x_api_key)
    session_dir = SESSIONS_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
    return {"deleted": session_id}


@app.get("/health")
def health():
    return {"ok": True}
