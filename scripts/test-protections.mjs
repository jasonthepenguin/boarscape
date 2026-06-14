// Throwaway smoke test for server connection protections.
// Usage: node scripts/test-protections.mjs [port]
import WebSocket from "ws";

const PORT = process.argv[2] || 3001;
const URL = `ws://localhost:${PORT}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function nextMessage(ws, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    ws.once("message", (d) => {
      clearTimeout(t);
      resolve(JSON.parse(d));
    });
  });
}

let pass = 0;
let fail = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  ok ? pass++ : fail++;
}

// --- Test 1: per-IP concurrent cap (4 allowed, 5th rejected)
const conns = [];
for (let i = 0; i < 4; i++) conns.push(await connect());
await wait(200);
check("4 concurrent connections allowed", conns.every((c) => c.readyState === WebSocket.OPEN));

const fifth = await connect();
const rejMsg = await nextMessage(fifth);
check("5th connection rejected", rejMsg?.type === "rejected");
console.log(`       reason: ${rejMsg?.reason}`);

// --- Test 2: normal join still works on an allowed connection
conns[0].send(JSON.stringify({ type: "join", name: "smoke", color: "#fff" }));
const joinMsg = await nextMessage(conns[0]);
check("normal join works", joinMsg?.type === "joined");

// --- Test 3: message flood gets terminated
const flooder = conns[1];
for (let i = 0; i < 120; i++) flooder.send(JSON.stringify({ type: "state", x: 0, y: 0, z: 0, ry: 0, anim: "idle" }));
await wait(500);
check("message flood terminated", flooder.readyState !== WebSocket.OPEN);

// --- Test 4: oversized payload closes connection (maxPayload 4096)
const fat = conns[2];
fat.send(JSON.stringify({ type: "join", name: "x".repeat(8000), color: "#fff" }));
await wait(500);
check("oversized payload closed", fat.readyState !== WebSocket.OPEN);

// --- Test 5: join name/color sanitized (reuses open conns; no new sockets)
// conns[0] is already joined (Test 2) and observes; conns[3] is still open and
// unused, so it joins with a hostile name/color and we inspect what the server
// re-broadcasts. A filtering listener is needed because conns[0] also receives
// periodic "positions" ticks.
function waitFor(ws, type, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { ws.off("message", onMsg); resolve(null); }, timeoutMs);
    function onMsg(d) {
      const m = JSON.parse(d);
      if (m.type === type) { clearTimeout(t); ws.off("message", onMsg); resolve(m); }
    }
    ws.on("message", onMsg);
  });
}

const pjPromise = waitFor(conns[0], "playerJoined");
conns[3].send(JSON.stringify({ type: "join", name: "Z".repeat(200), color: "not-a-color" }));
const pj = await pjPromise;
check("join name clamped to 16 chars", pj?.name?.length === 16);
check("join bad color defaulted to hex", /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(pj?.color || ""));

// --- Test 6: connect-rate limit (8 per 10s window; we've used 5 already)
for (const c of conns) { try { c.close(); } catch {} }
try { fifth.close(); } catch {}
await wait(300);

let rateLimited = false;
for (let i = 0; i < 6; i++) {
  const ws = await connect();
  const m = await nextMessage(ws, 500);
  if (m?.type === "rejected" && /too fast/i.test(m.reason || "")) {
    rateLimited = true;
    break;
  }
  ws.close();
  await wait(50);
}
check("connect spam rate-limited", rateLimited);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
