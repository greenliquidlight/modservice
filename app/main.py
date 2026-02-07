from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException

from app.modbus_manager import ServerManager
from app.models import ServerCreate, ServerInfo

manager = ServerManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for inst in manager.list():
        await manager.stop(inst.id)


app = FastAPI(lifespan=lifespan)


@app.post("/api/servers", response_model=ServerInfo)
async def create_server(req: ServerCreate) -> ServerInfo:
    inst = manager.create(req.port, req.unit_id, req.holding_size)
    await manager.start(inst.id)
    return ServerInfo(
        id=inst.id,
        ip=inst.ip,
        port=inst.port,
        unit_id=inst.unit_id,
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
            status=manager.status(inst.id),
        )
        for inst in manager.list()
    ]
