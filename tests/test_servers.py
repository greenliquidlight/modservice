import random
import pytest
import httpx
from pymodbus.client import AsyncModbusTcpClient

from app.main import app


@pytest.mark.asyncio
async def test_multiple_servers_different_loopback_ips_isolated():
    port = random.randint(20000, 40000)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        a = (await ac.post("/api/servers", json={"port": port, "unit_id": 1, "holding_size": 20})).json()
        b = (await ac.post("/api/servers", json={"port": port, "unit_id": 1, "holding_size": 20})).json()

    assert a["ip"] != b["ip"]
    assert a["port"] == b["port"] == port

    ca = AsyncModbusTcpClient(host=a["ip"], port=port)
    cb = AsyncModbusTcpClient(host=b["ip"], port=port)
    await ca.connect()
    await cb.connect()
    try:
        await ca.write_register(0, 111)
        await cb.write_register(0, 222)

        ra = await ca.read_holding_registers(0, count=1)
        rb = await cb.read_holding_registers(0, count=1)

        assert ra.registers[0] == 111
        assert rb.registers[0] == 222
    finally:
        ca.close()
        cb.close()
        