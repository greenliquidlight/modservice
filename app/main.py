from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.modbus_manager import ServerManager
from app.models import (
    CoilBatchWrite,
    CoilWrite,
    HoldingBatchWrite,
    HoldingWrite,
    ServerCreate,
    ServerInfo,
)

manager = ServerManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for inst in manager.list():
        await manager.stop(inst.id)


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

_INDEX_PATH = Path("static/index.html")
_ASSET_FILES = [Path("static/app.js"), Path("static/styles.css")]


@app.post("/api/servers", response_model=ServerInfo)
async def create_server(req: ServerCreate) -> ServerInfo:
    inst = manager.create(req.port, req.unit_id, req.coils_size, req.holding_size)
    await manager.start(inst.id)
    return ServerInfo(
        id=inst.id,
        ip=inst.ip,
        port=inst.port,
        unit_id=inst.unit_id,
        coils_size=inst.coils_size,
        holding_size=inst.holding_size,
        status=manager.status(inst.id),
    )


@app.get("/api/servers", response_model=List[ServerInfo])
async def list_servers() -> List[ServerInfo]:
    return [
        ServerInfo(
            id=inst.id,
            ip=inst.ip,
            port=inst.port,
            unit_id=inst.unit_id,
            coils_size=inst.coils_size,
            holding_size=inst.holding_size,
            status=manager.status(inst.id),
        )
        for inst in manager.list()
    ]


@app.get("/")
async def index() -> HTMLResponse:
    version = 0
    for asset in _ASSET_FILES:
        try:
            version = max(version, int(asset.stat().st_mtime))
        except FileNotFoundError:
            continue
    template = _INDEX_PATH.read_text(encoding="utf-8")
    html = template.replace("{{asset_version}}", str(version))
    return HTMLResponse(html)


@app.get("/api/servers/{sid}/holding")
async def read_holding(
    sid: str,
    addr: int = Query(ge=0),
    count: int = Query(ge=1),
) -> dict:
    try:
        values = manager.holding_get(sid, addr, count)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"values": values}


@app.put("/api/servers/{sid}/holding/{addr}")
async def write_holding(sid: str, addr: int, body: HoldingWrite) -> dict:
    try:
        manager.holding_set(sid, addr, body.value)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"status": "ok"}


@app.put("/api/servers/{sid}/holding")
async def write_holding_batch(sid: str, body: HoldingBatchWrite) -> dict:
    try:
        items = [(item.addr, item.value) for item in body.values]
        manager.holding_set_many(sid, items)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"status": "ok", "written": len(body.values)}


@app.get("/api/servers/{sid}/coils")
async def read_coils(
    sid: str,
    addr: int = Query(ge=0),
    count: int = Query(ge=1),
) -> dict:
    try:
        values = manager.coils_get(sid, addr, count)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"values": values}


@app.put("/api/servers/{sid}/coils/{addr}")
async def write_coil(sid: str, addr: int, body: CoilWrite) -> dict:
    try:
        manager.coils_set(sid, addr, body.value)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"status": "ok"}


@app.put("/api/servers/{sid}/coils")
async def write_coils_batch(sid: str, body: CoilBatchWrite) -> dict:
    try:
        items = [(item.addr, item.value) for item in body.values]
        manager.coils_set_many(sid, items)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Server not found") from exc
    return {"status": "ok", "written": len(body.values)}
