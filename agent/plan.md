# plan.md — Modbus TCP Server Tool (Local, Browser UI)

## 0. Purpose / Problem Statement
Build a local developer tool that can spin up **multiple Modbus TCP server instances** on-demand, managed from a **browser-based UI**. Each server instance represents a distinct “device” with its own **IP address** (locally) and **one Unit ID**.

Primary goal: fast, cross-platform, minimal setup. Security is not a concern (local tool).

---

## 1. Key Requirements (MVP)
### Functional
- Browser UI with a clickable **“Add Server”** button.
- Backend creates and starts a new Modbus TCP server instance per click.
- Each instance:
  - Binds to a unique local IP address.
  - Uses **one Unit ID per server** (default 1).
  - Exposes at least Holding Registers (HR) for read/write.
- UI can:
  - List servers (IP, port, status).
  - Stop/start server.
  - View and edit at least a small HR range (e.g., addresses 0–50).

### Non-functional
- Runs on Windows/macOS/Linux without Docker.
- Avoid admin/root requirement by default.
- Testable via automated integration tests.

---

## 2. Networking Model (Important)
### MVP approach: loopback IP fan-out
- Allocate IPs from `127.0.0.0/8` (e.g. `127.0.0.2`, `127.0.0.3`, ...).
- This enables “device == unique IP” locally without configuring NIC aliases.
- Default port: **1502** (not privileged on Linux/macOS). Allow user override; optionally provide “try 502” later.

### Future (not MVP): LAN alias mode
- Bind servers to IP aliases on a real NIC subnet (e.g. 192.168.x.y).
- Requires elevated privileges and OS-specific commands. Defer until demanded.

---

## 3. Tech Stack Decisions
### Backend
- Python 3.11+
- `uv` for env + dependency management
- FastAPI + Uvicorn (REST API; optional websockets later)
- `pymodbus` for Modbus TCP server implementation

### Frontend
- Plain HTML/CSS/JS (keep it dumb)
- Fetch REST endpoints
- (Optional later) WebSocket for live register updates

### Testing
- `pytest`
- `pytest-asyncio`
- Integration tests use `pymodbus` client to validate server behavior

---

## 4. High-Level Architecture
### Components
1. **ServerManager**
   - Allocates loopback IP addresses sequentially (`127.0.0.2` upward).
   - Creates instances with Modbus datastore.
   - Starts/stops instances.
   - Tracks status.

2. **ModbusServerInstance**
   - Holds: id, ip, port, unit_id, datastore/context, running task handle.
   - Runs server in asyncio task.

3. **REST API**
   - Create server (alloc + start)
   - List servers
   - Start/stop server
   - Read/write holding registers

4. **UI**
   - Server list table
   - “Add Server” button
   - Simple register editor for selected server

---

## 5. API Contract (MVP)
### Create server
- `POST /api/servers`
- Request JSON:
  ```json
  { "port": 1502, "unit_id": 1, "holding_size": 2000 }
  ```
- Response JSON:
  ```json
  { "id": "...", "ip": "127.0.0.2", "port": 1502, "unit_id": 1, "status": "running" }
  ```

### List servers
- `GET /api/servers`
- Returns array of ServerInfo

### Stop/Start
- `POST /api/servers/{id}/stop`
- `POST /api/servers/{id}/start` (optional for MVP; can ship stop-only first)

### Holding registers
- `GET /api/servers/{id}/holding?addr=0&count=10`
- `PUT /api/servers/{id}/holding/{addr}`
  - body: `{ "value": 123 }`

---

## 6. Data Model (MVP)
- Holding registers: sequential array size `holding_size` (default 2000)
- Coils/inputs optional for MVP (can stub or implement quickly)
- No persistence initially (in-memory). Add SQLite later if needed.

---

## 7. Repository Layout (Proposed)
```
modbus-tool/
  pyproject.toml
  app/
    __init__.py
    main.py              # FastAPI app + routes
    models.py            # Pydantic request/response models
    modbus_manager.py    # ServerManager + instance lifecycle
  static/
    index.html           # simple UI
    app.js
    styles.css
  tests/
    test_servers.py      # integration tests
```

---

## 8. Implementation Plan (Step-by-step)
### Phase 1 — Backend skeleton
- [ ] Create FastAPI app with `/api/servers` create/list endpoints.
- [ ] Implement ServerManager:
  - allocate IP in 127/8
  - create pymodbus datastore
  - start server bound to instance IP and port
- [ ] Add holding register read/write endpoints.

### Phase 2 — Integration tests
- [ ] Write pytest integration test that:
  - creates 2 servers on same port but different loopback IP
  - writes register 0 on each to different values
  - reads back using pymodbus client and confirms isolation
- [ ] Add CI basics (optional): GitHub Actions for ubuntu+windows.

### Phase 3 — Frontend MVP
- [ ] Static UI that:
  - lists servers
  - “Add Server” button calls `POST /api/servers`
  - shows server IP:port
  - select server -> show HR editor for range (0..N)
  - update values via PUT endpoint

### Phase 4 — Quality / usability
- [ ] Add stop/delete server.
- [ ] Add port conflict detection + friendly errors.
- [ ] Add “preferred port” setting UI + server create form.
- [ ] Document usage.

### Phase 5 — Future (feature creep containment)
- [ ] Optional WebSocket updates when register values change.
- [ ] Persistence (SQLite) for server configs and register presets.
- [ ] LAN alias mode (requires admin + OS-specific commands).
- [ ] Profiles (pre-canned register maps per device type).

---

## 9. Constraints / Known Pitfalls
- Binding to port 502 on Linux/macOS requires root/capabilities. Default >1024.
- Binding to an IP not assigned to the host yields `EADDRNOTAVAIL`. Loopback 127/8 avoids manual configuration.
- Don’t bind to `0.0.0.0`; must bind per-instance IP to keep “device IP realism”.

---

## 10. Dev Commands (uv)
- Install deps:
  - `uv sync`
- Run backend:
  - `uv run uvicorn app.main:app --reload`
- Run tests:
  - `uv run pytest -q`

---

## 11. Definition of Done (MVP)
- User clicks “Add Server” in browser -> new server appears with unique `127.0.0.X:1502`.
- External local Modbus client can read/write HR values per server independently.
- Automated test proves two servers on same port but different IP are isolated.
- Works on Windows/macOS/Linux without Docker and without admin privileges (using port 1502).
