const serverList = document.getElementById("serverList");
const addServerButton = document.getElementById("addServer");
const refreshButton = document.getElementById("refresh");
const selectedServer = document.getElementById("selectedServer");
const serverDetails = document.getElementById("serverDetails");

const portInput = document.getElementById("port");
const unitIdInput = document.getElementById("unitId");
const coilsSizeInput = document.getElementById("coilsSize");
const holdingSizeInput = document.getElementById("holdingSize");

const holdingTable = document.getElementById("holdingTable");
const coilsTable = document.getElementById("coilsTable");
const holdingStatus = document.getElementById("holdingStatus");
const coilsStatus = document.getElementById("coilsStatus");
const readHolding = document.getElementById("readHolding");
const writeHolding = document.getElementById("writeHolding");
const readCoils = document.getElementById("readCoils");
const writeCoils = document.getElementById("writeCoils");

let activeServerId = null;
let lastServers = [];
const baseAddr = 0;
const state = {
  holding: { values: [], inputs: [], size: 0 },
  coils: { values: [], inputs: [], size: 0 },
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed");
  }
  return response.json();
}

function renderServers(servers) {
  lastServers = servers;
  serverList.innerHTML = "";
  if (!servers.length) {
    serverList.innerHTML = "<p>No servers yet. Add one to get started.</p>";
    return;
  }

  servers.forEach((server) => {
    const card = document.createElement("div");
    card.className = "server-card";
    const headerRow = document.createElement("div");
    headerRow.className = "server-card-row";

    const meta = document.createElement("div");
    meta.className = "server-meta";
    meta.innerHTML = `
      <strong>${server.ip}:${server.port}</strong>
      <span>Unit ${server.unit_id} · ${server.status}</span>
      <span>${server.coils_size} coils · ${server.holding_size} holding</span>
    `;

    const selectButton = document.createElement("button");
    selectButton.className = "btn ghost";
    selectButton.textContent = "Select";
    selectButton.addEventListener("click", () => selectServer(server));

    headerRow.appendChild(meta);
    headerRow.appendChild(selectButton);
    card.appendChild(headerRow);

    if (server.id === activeServerId) {
      card.classList.add("active");
      serverDetails.classList.remove("hidden");
      card.appendChild(serverDetails);
    }
    serverList.appendChild(card);
  });
}

function selectServer(server) {
  activeServerId = server.id;
  selectedServer.textContent = `${server.ip}:${server.port}`;
  holdingStatus.textContent = "";
  coilsStatus.textContent = "";
  buildTable(holdingTable, "holding", server.holding_size);
  buildTable(coilsTable, "coils", server.coils_size);
  renderServers(lastServers);
}

async function loadServers() {
  const servers = await fetchJson("/api/servers");
  renderServers(servers);
  if (!servers.length) {
    activeServerId = null;
    serverDetails.classList.add("hidden");
    return;
  }
  const selected = servers.find((server) => server.id === activeServerId) || servers[servers.length - 1];
  selectServer(selected);
}

async function createServer() {
  const payload = {
    port: Number(portInput.value),
    unit_id: Number(unitIdInput.value),
    coils_size: Number(coilsSizeInput.value),
    holding_size: Number(holdingSizeInput.value),
  };
  const created = await fetchJson("/api/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  activeServerId = created.id;
  await loadServers();
}

function buildTable(table, type, size) {
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  state[type].inputs = [];
  state[type].values = new Array(size).fill(type === "coils" ? false : 0);
  state[type].size = size;
  for (let i = 0; i < size; i += 1) {
    const addr = baseAddr + i;
    const row = document.createElement("tr");
    const addrCell = document.createElement("td");
    addrCell.textContent = String(addr);

    const valueCell = document.createElement("td");
    let input;
    if (type === "coils") {
      input = document.createElement("select");
      input.className = "data-input";
      const optTrue = document.createElement("option");
      optTrue.value = "true";
      optTrue.textContent = "true";
      const optFalse = document.createElement("option");
      optFalse.value = "false";
      optFalse.textContent = "false";
      input.appendChild(optTrue);
      input.appendChild(optFalse);
    } else {
      input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "65535";
      input.className = "data-input";
    }
    input.dataset.addr = String(addr);
    valueCell.appendChild(input);
    row.appendChild(addrCell);
    row.appendChild(valueCell);
    tbody.appendChild(row);
    state[type].inputs.push(input);
  }
}

function setTableValues(type, values) {
  state[type].values = values.slice();
  state[type].inputs.forEach((input, index) => {
    const value = values[index];
    if (type === "coils") {
      input.value = value ? "true" : "false";
    } else {
      input.value = String(value ?? 0);
    }
  });
}

async function readHoldingTable() {
  if (!activeServerId) {
    holdingStatus.textContent = "Select a server first.";
    return;
  }
  if (!state.holding.size) {
    holdingStatus.textContent = "No holding registers to read.";
    return;
  }
  const data = await fetchJson(
    `/api/servers/${activeServerId}/holding?addr=${baseAddr}&count=${state.holding.size}`
  );
  setTableValues("holding", data.values);
  holdingStatus.textContent = "Loaded.";
}

async function readCoilsTable() {
  if (!activeServerId) {
    coilsStatus.textContent = "Select a server first.";
    return;
  }
  if (!state.coils.size) {
    coilsStatus.textContent = "No coils to read.";
    return;
  }
  const data = await fetchJson(
    `/api/servers/${activeServerId}/coils?addr=${baseAddr}&count=${state.coils.size}`
  );
  setTableValues("coils", data.values.map(Boolean));
  coilsStatus.textContent = "Loaded.";
}

async function writeHoldingTable() {
  if (!activeServerId) {
    holdingStatus.textContent = "Select a server first.";
    return;
  }
  if (!state.holding.size) {
    holdingStatus.textContent = "No holding registers to write.";
    return;
  }
  const changes = [];
  state.holding.inputs.forEach((input, index) => {
    const addr = baseAddr + index;
    const value = Number(input.value || 0);
    if (value !== state.holding.values[index]) {
      changes.push({ addr, value });
    }
  });
  if (!changes.length) {
    holdingStatus.textContent = "No changes to write.";
    return;
  }
  await fetchJson(`/api/servers/${activeServerId}/holding`, {
    method: "PUT",
    body: JSON.stringify({ values: changes }),
  });
  holdingStatus.textContent = `Wrote ${changes.length} values.`;
  state.holding.values = state.holding.inputs.map((input) => Number(input.value || 0));
}

async function writeCoilsTable() {
  if (!activeServerId) {
    coilsStatus.textContent = "Select a server first.";
    return;
  }
  if (!state.coils.size) {
    coilsStatus.textContent = "No coils to write.";
    return;
  }
  const changes = [];
  state.coils.inputs.forEach((input, index) => {
    const addr = baseAddr + index;
    const value = input.value === "true";
    if (value !== state.coils.values[index]) {
      changes.push({ addr, value });
    }
  });
  if (!changes.length) {
    coilsStatus.textContent = "No changes to write.";
    return;
  }
  await fetchJson(`/api/servers/${activeServerId}/coils`, {
    method: "PUT",
    body: JSON.stringify({ values: changes }),
  });
  coilsStatus.textContent = `Wrote ${changes.length} values.`;
  state.coils.values = state.coils.inputs.map((input) => input.value === "true");
}

addServerButton.addEventListener("click", () => {
  createServer().catch((err) => {
    alert(err.message || "Failed to create server");
  });
});

refreshButton.addEventListener("click", () => {
  loadServers().catch((err) => {
    alert(err.message || "Failed to load servers");
  });
});

readHolding.addEventListener("click", () => {
  readHoldingTable().catch((err) => {
    holdingStatus.textContent = err.message || "Read failed";
  });
});

writeHolding.addEventListener("click", () => {
  writeHoldingTable().catch((err) => {
    holdingStatus.textContent = err.message || "Write failed";
  });
});

readCoils.addEventListener("click", () => {
  readCoilsTable().catch((err) => {
    coilsStatus.textContent = err.message || "Read failed";
  });
});

writeCoils.addEventListener("click", () => {
  writeCoilsTable().catch((err) => {
    coilsStatus.textContent = err.message || "Write failed";
  });
});

loadServers().catch((err) => {
  serverList.innerHTML = `<p>Failed to load servers: ${err.message}</p>`;
});
