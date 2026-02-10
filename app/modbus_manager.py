import ipaddress
import uuid
from dataclasses import dataclass
from typing import Dict, Optional, List

from pymodbus.datastore import (
    ModbusSequentialDataBlock,
    ModbusDeviceContext,
    ModbusServerContext,
)
from pymodbus.server import ModbusTcpServer


@dataclass
class Instance:
    id: str
    ip: str
    port: int
    unit_id: int
    coils_size: int
    holding_size: int
    context: ModbusServerContext
    server: Optional[ModbusTcpServer] = None


class ServerManager:
    def __init__(self) -> None:
        # start at 127.0.0.2
        self._next_ip = int(ipaddress.IPv4Address("127.0.0.2"))
        self._instances: Dict[str, Instance] = {}

    def list(self) -> List[Instance]:
        return list(self._instances.values())

    def _alloc_ip(self) -> str:
        # Stay in 127/8
        while True:
            ip = ipaddress.IPv4Address(self._next_ip)
            self._next_ip += 1
            if ip in ipaddress.IPv4Network("127.0.0.0/8"):
                return str(ip)
            raise RuntimeError("Loopback IP pool exhausted (127/8).")

    def create(self, port: int, unit_id: int, coils_size: int, holding_size: int) -> Instance:
        sid = str(uuid.uuid4())
        ip = self._alloc_ip()

        store = ModbusDeviceContext(
            di=ModbusSequentialDataBlock(1, [0] * 100),
            co=ModbusSequentialDataBlock(1, [0] * coils_size),
            hr=ModbusSequentialDataBlock(1, [0] * holding_size),
            ir=ModbusSequentialDataBlock(1, [0] * 100),
        )
        context = ModbusServerContext(devices=store, single=True)

        inst = Instance(
            id=sid,
            ip=ip,
            port=port,
            unit_id=unit_id,
            coils_size=coils_size,
            holding_size=holding_size,
            context=context,
        )
        self._instances[sid] = inst
        return inst

    async def start(self, sid: str) -> None:
        inst = self._instances[sid]
        if inst.server and inst.server.transport:
            return
        server = ModbusTcpServer(
            inst.context,
            address=(inst.ip, inst.port),
        )
        await server.serve_forever(background=True)
        inst.server = server

    async def stop(self, sid: str) -> None:
        inst = self._instances[sid]
        if not inst.server:
            return
        await inst.server.shutdown()
        inst.server = None

    def status(self, sid: str) -> str:
        inst = self._instances[sid]
        if inst.server and inst.server.transport:
            return "running"
        return "stopped"

    # Holding register access (function code 3)
    def holding_get(self, sid: str, addr: int, count: int) -> list[int]:
        inst = self._instances[sid]
        return inst.context[0x00].getValues(3, addr, count)

    def holding_set(self, sid: str, addr: int, value: int) -> None:
        inst = self._instances[sid]
        inst.context[0x00].setValues(3, addr, [value])

    def holding_set_many(self, sid: str, items: list[tuple[int, int]]) -> None:
        inst = self._instances[sid]
        for addr, value in items:
            inst.context[0x00].setValues(3, addr, [value])

    # Coil access (function code 1/5)
    def coils_get(self, sid: str, addr: int, count: int) -> list[bool]:
        inst = self._instances[sid]
        return inst.context[0x00].getValues(1, addr, count)

    def coils_set(self, sid: str, addr: int, value: bool) -> None:
        inst = self._instances[sid]
        inst.context[0x00].setValues(5, addr, [value])

    def coils_set_many(self, sid: str, items: list[tuple[int, bool]]) -> None:
        inst = self._instances[sid]
        for addr, value in items:
            inst.context[0x00].setValues(5, addr, [value])