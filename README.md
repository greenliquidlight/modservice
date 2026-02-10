# modservice
Modbus server tool with a web-based front end.

## Quickstart
### Clone the repo
- `git clone https://github.com/greenliquidlight/modservice.git`
- `cd modservice`

### Install Python (if not already installed)
- Download and install Python 3.11+ from https://www.python.org/downloads/
- Verify: `python --version`

### Install uv
- `python -m pip install --upgrade pip`
- `python -m pip install uv`

### Install deps
- `uv sync`

### Run the app
- `uv run uvicorn app.main:app --reload`
- Open http://127.0.0.1:8000
- Static assets are cache-busted automatically based on file timestamps.

### Run tests
- `uv run pytest -q`
