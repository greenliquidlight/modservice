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


@pytest.mark.asyncio
async def test_datastore_allocations_allow_coil_and_register_rw():
    port = random.randint(20000, 40000)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        server = (
            await ac.post(
                "/api/servers",
                json={"port": port, "unit_id": 1, "coils_size": 7, "holding_size": 5},
            )
        ).json()

    client = AsyncModbusTcpClient(host=server["ip"], port=port)
    await client.connect()
    try:
        await client.write_coil(6, True)
        await client.write_register(4, 555)

        rc = await client.read_coils(6, count=1)
        rr = await client.read_holding_registers(4, count=1)

        assert rc.bits[0] is True
        assert rr.registers[0] == 555
    finally:
        client.close()
        