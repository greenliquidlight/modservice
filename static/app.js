const serverList = document.getElementById("serverList");
const addServerButton = document.getElementById("addServer");
const refreshButton = document.getElementById("refresh");
const selectedServer = document.getElementById("selectedServer");

const portInput = document.getElementById("port");
const unitIdInput = document.getElementById("unitId");
const coilsSizeInput = document.getElementById("coilsSize");
const holdingSizeInput = document.getElementById("holdingSize");

const hrAddr = document.getElementById("hrAddr");
const hrValue = document.getElementById("hrValue");
const hrResult = document.getElementById("hrResult");
const readHr = document.getElementById("readHr");
const writeHr = document.getElementById("writeHr");

const coilAddr = document.getElementById("coilAddr");
const coilValue = document.getElementById("coilValue");
const coilResult = document.getElementById("coilResult");
const readCoil = document.getElementById("readCoil");
const writeCoil = document.getElementById("writeCoil");

let activeServerId = null;

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
  serverList.innerHTML = "";
  if (!servers.length) {
    serverList.innerHTML = "<p>No servers yet. Add one to get started.</p>";
    return;
  }

  servers.forEach((server) => {
    const card = document.createElement("div");
    card.className = "server-card";

    const meta = document.createElement("div");
    meta.className = "server-meta";
    meta.innerHTML = `
      <strong>${server.ip}:${server.port}</strong>
      <span>Unit ${server.unit_id} · ${server.status}</span>
    `;

    const selectButton = document.createElement("button");
    selectButton.className = "btn ghost";
    selectButton.textContent = "Select";
    selectButton.addEventListener("click", () => selectServer(server));

    card.appendChild(meta);
    card.appendChild(selectButton);
    serverList.appendChild(card);
  });
}

function selectServer(server) {
  activeServerId = server.id;
  selectedServer.textContent = `${server.ip}:${server.port}`;
}

async function loadServers() {
  const servers = await fetchJson("/api/servers");
  renderServers(servers);
  if (servers.length && !activeServerId) {
    selectServer(servers[0]);
  }
}

async function createServer() {
  const payload = {
    port: Number(portInput.value),
    unit_id: Number(unitIdInput.value),
    coils_size: Number(coilsSizeInput.value),
    holding_size: Number(holdingSizeInput.value),
  };
  await fetchJson("/api/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await loadServers();
}

async function readHolding() {
  if (!activeServerId) {
    hrResult.textContent = "Select a server first.";
    return;
  }
  const addr = Number(hrAddr.value);
  const data = await fetchJson(`/api/servers/${activeServerId}/holding?addr=${addr}&count=1`);
  hrResult.textContent = `Value: ${data.values[0]}`;
}

async function writeHolding() {
  if (!activeServerId) {
    hrResult.textContent = "Select a server first.";
    return;
  }
  const addr = Number(hrAddr.value);
  const value = Number(hrValue.value);
  await fetchJson(`/api/servers/${activeServerId}/holding/${addr}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  hrResult.textContent = "Written.";
}

async function readCoils() {
  if (!activeServerId) {
    coilResult.textContent = "Select a server first.";
    return;
  }
  const addr = Number(coilAddr.value);
  const data = await fetchJson(`/api/servers/${activeServerId}/coils?addr=${addr}&count=1`);
  coilResult.textContent = `Value: ${Boolean(data.values[0])}`;
}

async function writeCoils() {
  if (!activeServerId) {
    coilResult.textContent = "Select a server first.";
    return;
  }
  const addr = Number(coilAddr.value);
  const value = coilValue.value === "true";
  await fetchJson(`/api/servers/${activeServerId}/coils/${addr}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  coilResult.textContent = "Written.";
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

readHr.addEventListener("click", () => {
  readHolding().catch((err) => {
    hrResult.textContent = err.message || "Read failed";
  });
});

writeHr.addEventListener("click", () => {
  writeHolding().catch((err) => {
    hrResult.textContent = err.message || "Write failed";
  });
});

readCoil.addEventListener("click", () => {
  readCoils().catch((err) => {
    coilResult.textContent = err.message || "Read failed";
  });
});

writeCoil.addEventListener("click", () => {
  writeCoils().catch((err) => {
    coilResult.textContent = err.message || "Write failed";
  });
});

loadServers().catch((err) => {
  serverList.innerHTML = `<p>Failed to load servers: ${err.message}</p>`;
});
