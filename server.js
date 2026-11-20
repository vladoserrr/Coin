const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const playersFile = path.join(dataDir, "players.json");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

function readPlayers() {
  try { return JSON.parse(fs.readFileSync(playersFile, "utf8")); }
  catch { return {}; }
}
function writePlayers(players) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(playersFile, JSON.stringify(players, null, 2));
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "same-origin" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 12000) reject(new Error("Payload too large")); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function cleanName(value) {
  return String(value || "Игрок").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 18) || "Игрок";
}
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/api/leaderboard" && req.method === "GET") {
    const players = Object.values(readPlayers()).sort((a,b) => b.score-a.score).slice(0, 100);
    return send(res, 200, { players, total: Object.keys(readPlayers()).length });
  }
  if ((pathname === "/api/player" || pathname === "/api/score") && req.method === "POST") {
    try {
      const body = await readBody(req);
      const id = String(body.playerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      if (!id) return send(res, 400, { error: "playerId required" });
      const players = readPlayers();
      const player = players[id] || { id, nickname: "Игрок", score: 0, games: 0, wins: 0, createdAt: Date.now() };
      player.nickname = cleanName(body.nickname || player.nickname);
      player.updatedAt = Date.now();
      if (pathname === "/api/score") {
        const points = Math.max(0, Math.min(1000000, Math.floor(Number(body.points) || 0)));
        player.score += points;
        player.games += 1;
        if (body.won === true) player.wins += 1;
      }
      players[id] = player;
      writePlayers(players);
      return send(res, 200, { player });
    } catch (error) {
      return send(res, 400, { error: error.message || "Bad request" });
    }
  }
  if (pathname.startsWith("/api/")) return send(res, 404, { error: "API route not found" });
  let requestPath = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(root, "." + requestPath);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

const port = process.env.PORT || 8080;
server.listen(port, "0.0.0.0", () => console.log("Coin Casino listening on " + port));
