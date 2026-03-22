import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("sim-canvas");
const clockLabel = document.getElementById("sim-clock");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const quickActions = document.getElementById("quick-actions");
const agentList = document.getElementById("agent-list");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0c1020");

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
camera.position.set(0, 62, 46);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const hemi = new THREE.HemisphereLight(0xa5b8ff, 0x232323, 1.1);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(25, 40, 10);
scene.add(dir);

const roomZones = [
  { name: "Hall", x: 0, z: 0, w: 18, d: 16, color: "#486ba0", kind: "social" },
  { name: "Kitchen A", x: -16, z: 11, w: 12, d: 9, color: "#6e8f51", kind: "resource" },
  { name: "Kitchen B", x: 16, z: 11, w: 12, d: 9, color: "#6e8f51", kind: "resource" },
  { name: "Bedroom 1", x: -18, z: -13, w: 9, d: 8, color: "#8f679d", kind: "rest" },
  { name: "Bedroom 2", x: -6, z: -13, w: 9, d: 8, color: "#8f679d", kind: "rest" },
  { name: "Bedroom 3", x: 6, z: -13, w: 9, d: 8, color: "#8f679d", kind: "rest" },
  { name: "Bedroom 4", x: 18, z: -13, w: 9, d: 8, color: "#8f679d", kind: "rest" },
  { name: "Bathroom A", x: -22, z: 1, w: 6, d: 8, color: "#5f8f9d", kind: "utility" },
  { name: "Bathroom B", x: 22, z: 1, w: 6, d: 8, color: "#5f8f9d", kind: "utility" },
  { name: "Garden", x: 0, z: 22, w: 38, d: 10, color: "#3f8353", kind: "relax" },
];

function addWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 60),
    new THREE.MeshStandardMaterial({ color: "#1a2c29" }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  for (const zone of roomZones) {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.w, zone.d),
      new THREE.MeshStandardMaterial({ color: zone.color, roughness: 0.95, metalness: 0.02 }),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(zone.x, 0.05, zone.z);
    scene.add(tile);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(zone.w, 0.2, zone.d)),
      new THREE.LineBasicMaterial({ color: "#d7e0ff" }),
    );
    border.position.set(zone.x, 0.11, zone.z);
    scene.add(border);
  }
}

addWorld();

const ethnicityPalette = {
  african: "#8d5524",
  east_asian: "#f1c27d",
  south_asian: "#c68642",
  latino: "#d1a17a",
  middle_eastern: "#b97a56",
  white: "#f3d0ba",
  mixed: "#bf8d63",
};

const maleNames = ["Ethan", "Noah", "Liam", "Adrian", "Kai", "Malik"];
const femaleNames = ["Ava", "Maya", "Leila", "Sophia", "Zara", "Nia"];

const baseAgents = [
  { gender: "male", ethnicity: "african", trait: "strategist" },
  { gender: "male", ethnicity: "east_asian", trait: "peacemaker" },
  { gender: "male", ethnicity: "white", trait: "chaotic" },
  { gender: "male", ethnicity: "middle_eastern", trait: "analytical" },
  { gender: "female", ethnicity: "south_asian", trait: "leader" },
  { gender: "female", ethnicity: "latino", trait: "social" },
  { gender: "female", ethnicity: "mixed", trait: "adventurous" },
  { gender: "female", ethnicity: "african", trait: "competitive" },
];

const traitBias = {
  strategist: { social: 0.5, rest: 0.8, resource: 0.9, relax: 0.6, utility: 0.6 },
  peacemaker: { social: 1.2, rest: 0.7, resource: 0.7, relax: 0.9, utility: 0.6 },
  chaotic: { social: 1.4, rest: 0.5, resource: 0.8, relax: 1.3, utility: 0.5 },
  analytical: { social: 0.6, rest: 0.9, resource: 1.2, relax: 0.6, utility: 0.8 },
  leader: { social: 1.3, rest: 0.6, resource: 0.8, relax: 0.7, utility: 0.5 },
  social: { social: 1.5, rest: 0.6, resource: 0.8, relax: 1.1, utility: 0.6 },
  adventurous: { social: 1.0, rest: 0.5, resource: 0.9, relax: 1.5, utility: 0.5 },
  competitive: { social: 1.1, rest: 0.5, resource: 0.8, relax: 1.2, utility: 0.6 },
};

const agents = [];
const eventState = {
  tension: 0,
  current: "normal",
  timer: 0,
};

const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.3, 4, 8);

function randomZoneByKind(kind) {
  const filtered = roomZones.filter((z) => z.kind === kind);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function pickDestination(agent) {
  const bias = traitBias[agent.trait] || traitBias.social;
  const weighted = roomZones.map((zone) => ({
    zone,
    score: (bias[zone.kind] || 0.4) * (0.7 + Math.random() * 0.9),
  }));
  weighted.sort((a, b) => b.score - a.score);
  return weighted[0].zone;
}

function spawnAgent({ gender = "female", ethnicity = "mixed", trait = "social" }, announce = true) {
  const names = gender === "male" ? maleNames : femaleNames;
  const name = `${names[Math.floor(Math.random() * names.length)]}-${Math.floor(Math.random() * 100)}`;

  const mesh = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshStandardMaterial({ color: ethnicityPalette[ethnicity] || "#b98f6b" }),
  );
  mesh.castShadow = true;

  const zone = randomZoneByKind("social") || roomZones[0];
  mesh.position.set(zone.x + (Math.random() - 0.5) * (zone.w - 2), 1, zone.z + (Math.random() - 0.5) * (zone.d - 2));
  scene.add(mesh);

  const agent = {
    id: crypto.randomUUID(),
    name,
    gender,
    ethnicity,
    trait,
    mood: 0.5,
    mesh,
    target: zone,
    speed: 0.02 + Math.random() * 0.03,
    stateTimer: 0,
  };

  agents.push(agent);
  if (announce) {
    addChat("system", `${agent.name} joined the house (${gender}, ${ethnicity}, ${trait}).`);
  }
  renderAgentCards();
}

for (const a of baseAgents) {
  spawnAgent(a, false);
}

function addChat(type, text) {
  const div = document.createElement("div");
  div.className = `chat-line ${type}`;
  div.textContent = text;
  chatLog.prepend(div);
}

function renderAgentCards() {
  agentList.innerHTML = "";
  for (const a of agents) {
    const card = document.createElement("div");
    card.className = "agent-card";
    const moodLabel = a.mood > 0.7 ? "high" : a.mood > 0.4 ? "stable" : "stressed";
    card.innerHTML = `<strong>${a.name}</strong><br /><small>${a.gender} • ${a.ethnicity} • ${a.trait}</small><br /><small>Mood: ${moodLabel}</small>`;
    agentList.append(card);
  }
}

function triggerEvent(kind) {
  eventState.current = kind;
  eventState.timer = 16 + Math.random() * 18;

  if (kind === "party") {
    addChat("event", "🎉 Event: Surprise party in the Hall!");
    eventState.tension = Math.max(0, eventState.tension - 0.15);
    agents.forEach((a) => {
      a.mood = Math.min(1, a.mood + 0.2);
      a.target = roomZones.find((z) => z.name === "Hall") || a.target;
    });
  } else if (kind === "conflict") {
    addChat("event", "⚡ Event: Hidden conflict challenge activated.");
    eventState.tension = Math.min(1, eventState.tension + 0.25);
    agents.forEach((a) => {
      a.mood = Math.max(0, a.mood - 0.15);
    });
  } else if (kind === "blackout") {
    addChat("event", "🌘 Event: Temporary blackout. Garden meetup begins.");
    agents.forEach((a) => {
      a.target = roomZones.find((z) => z.name === "Garden") || a.target;
    });
  }

  renderAgentCards();
}

const quicks = [
  { label: "Start Party", command: "event party" },
  { label: "Inject Conflict", command: "event conflict" },
  { label: "Power Blackout", command: "event blackout" },
  { label: "Spawn Female", command: "spawn female" },
  { label: "Spawn Male", command: "spawn male" },
];

for (const q of quicks) {
  const btn = document.createElement("button");
  btn.textContent = q.label;
  btn.addEventListener("click", () => handleCommand(q.command));
  quickActions.append(btn);
}

function handleCommand(raw) {
  const cmd = raw.trim().toLowerCase();
  if (!cmd) return;
  addChat("agent", `Host Command: ${raw}`);

  if (cmd.startsWith("event ")) {
    const kind = cmd.split(" ")[1];
    if (["party", "conflict", "blackout"].includes(kind)) {
      triggerEvent(kind);
      return;
    }
  }

  if (cmd.startsWith("spawn ")) {
    const gender = cmd.includes("male") ? "male" : "female";
    const ethnicities = Object.keys(ethnicityPalette);
    const traits = Object.keys(traitBias);
    spawnAgent({
      gender,
      ethnicity: ethnicities[Math.floor(Math.random() * ethnicities.length)],
      trait: traits[Math.floor(Math.random() * traits.length)],
    });
    return;
  }

  if (cmd.startsWith("mood ")) {
    if (cmd.includes("conflict")) {
      triggerEvent("conflict");
      return;
    }
    if (cmd.includes("calm")) {
      triggerEvent("party");
      return;
    }
  }

  addChat("system", "Unknown command. Examples: event party, spawn male, mood calm.");
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = chatInput.value;
  chatInput.value = "";
  handleCommand(value);
});

let simTime = {
  day: 1,
  minutes: 8 * 60,
};

function moveAgent(agent, delta) {
  agent.stateTimer -= delta;
  if (agent.stateTimer <= 0 || Math.random() < 0.0025) {
    agent.target = pickDestination(agent);
    agent.stateTimer = 6 + Math.random() * 14;
  }

  const tx = agent.target.x + (Math.random() - 0.5) * (agent.target.w - 2.5);
  const tz = agent.target.z + (Math.random() - 0.5) * (agent.target.d - 2.5);
  const dx = tx - agent.mesh.position.x;
  const dz = tz - agent.mesh.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist > 0.6) {
    const speedBoost = eventState.current === "conflict" ? 1.4 : 1;
    const step = agent.speed * speedBoost;
    agent.mesh.position.x += (dx / dist) * step * delta * 20;
    agent.mesh.position.z += (dz / dist) * step * delta * 20;
    agent.mesh.rotation.y = Math.atan2(dx, dz);
  }

  const moodDrift = eventState.current === "conflict" ? -0.01 : 0.004;
  agent.mood = Math.min(1, Math.max(0, agent.mood + moodDrift * delta));
}

let lastRandomEvent = 0;
let previous = performance.now();

function tick(now) {
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  simTime.minutes += delta * 8;
  if (simTime.minutes >= 24 * 60) {
    simTime.day += 1;
    simTime.minutes = 0;
    addChat("system", `A new day starts: Day ${simTime.day}`);
  }

  const hrs = String(Math.floor(simTime.minutes / 60)).padStart(2, "0");
  const mins = String(Math.floor(simTime.minutes % 60)).padStart(2, "0");
  clockLabel.textContent = `Day ${simTime.day} • ${hrs}:${mins}`;

  eventState.timer -= delta;
  if (eventState.timer <= 0 && eventState.current !== "normal") {
    eventState.current = "normal";
    addChat("event", "Event resolved. House dynamics returned to baseline.");
  }

  lastRandomEvent += delta;
  if (lastRandomEvent > 25) {
    lastRandomEvent = 0;
    const bag = ["party", "conflict", "blackout"];
    if (Math.random() > 0.35) {
      triggerEvent(bag[Math.floor(Math.random() * bag.length)]);
    }
  }

  for (const agent of agents) {
    moveAgent(agent, delta);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function onResize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", onResize);
onResize();

addChat("system", "Simulation online. 8 residents loaded with personality-driven behavior.");
addChat("system", "Type commands in chat or use quick actions to direct the season.");
renderAgentCards();
requestAnimationFrame(tick);
