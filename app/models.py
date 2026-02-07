from pydantic import BaseModel, Field
from typing import Literal


class ServerCreate(BaseModel):
    port: int = Field(default=1502, ge=1, le=65535)
    unit_id: int = Field(default=1, ge=1, le=247)
    coils_size: int = Field(default=100, ge=1, le=65535)
    holding_size: int = Field(default=2000, ge=1, le=65535)


class ServerInfo(BaseModel):
    id: str
    ip: str
    port: int
    unit_id: int
    status: Literal["running", "stopped"]


class HoldingWrite(BaseModel):
    value: int = Field(ge=0, le=65535)


class CoilWrite(BaseModel):
    value: bool