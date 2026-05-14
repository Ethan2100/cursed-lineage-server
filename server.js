const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'cursed_lineage.db');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, arena_name TEXT UNIQUE NOT NULL, class_key TEXT NOT NULL,
    char_name TEXT DEFAULT '', level INTEGER DEFAULT 1, icon TEXT DEFAULT '👤',
    color TEXT DEFAULT '#6366f1', atk INTEGER DEFAULT 10, def INTEGER DEFAULT 5,
    max_hp INTEGER DEFAULT 100, max_ce INTEGER DEFAULT 50, techniques TEXT DEFAULT '[]',
    title TEXT DEFAULT 'Grade 4 Sorcerer', skin TEXT, total_kills INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0, total_arena_wins INTEGER DEFAULT 0, total_dmg INTEGER DEFAULT 0,
    highest_crit INTEGER DEFAULT 0, boss_rush_clears INTEGER DEFAULT 0,
    friend_code TEXT UNIQUE, updated_at TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS friends (
    player_id TEXT NOT NULL, friend_id TEXT NOT NULL, PRIMARY KEY (player_id, friend_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pvp_queue (
    arena_name TEXT PRIMARY KEY, class_key TEXT NOT NULL, char_name TEXT DEFAULT '',
    level INTEGER DEFAULT 1, icon TEXT DEFAULT '👤', color TEXT DEFAULT '#6366f1',
    atk INTEGER DEFAULT 10, def INTEGER DEFAULT 5, max_hp INTEGER DEFAULT 100,
    max_ce INTEGER DEFAULT 50, techniques TEXT DEFAULT '[]', title TEXT DEFAULT '',
    skin TEXT, streak INTEGER DEFAULT 0, queued_at TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    save_data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT ''
  )`);

  saveDB();
}

function saveDB() {
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); } catch (e) {}
}
setInterval(saveDB, 30000);
setInterval(() => {
  try { db.run("DELETE FROM pvp_queue WHERE queued_at < ?", [new Date(Date.now() - 300000).toISOString()]); } catch (e) {}
}, 60000);

function genId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 8); }
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)];
  return s.substring(0, 4) + '-' + s.substring(4);
}

function qOne(sql, p = []) {
  const s = db.prepare(sql); s.bind(p);
  if (s.step()) { const c = s.getColumnNames(), v = s.get(); s.free(); const r = {}; c.forEach((k, i) => r[k] = v[i]); return r; }
  s.free(); return null;
}
function qAll(sql, p = []) {
  const s = db.prepare(sql); s.bind(p); const rows = [];
  while (s.step()) { const c = s.getColumnNames(), v = s.get(), r = {}; c.forEach((k, i) => r[k] = v[i]); rows.push(r); }
  s.free(); return rows;
}

// ═══ PLAYER ═══
app.post('/api/player', (req, res) => {
  try {
    const b = req.body;
    if (!b.arenaName || !b.classKey) return res.status(400).json({ error: 'arenaName and classKey required' });
    const ex = qOne("SELECT id, friend_code FROM players WHERE arena_name = ?", [b.arenaName]);
    const id = ex?.id || genId(), fc = ex?.friend_code || genCode(), now = new Date().toISOString();
    const techs = JSON.stringify(b.techniques || []);

    if (ex) {
      db.run(`UPDATE players SET class_key=?,char_name=?,level=?,icon=?,color=?,atk=?,def=?,max_hp=?,max_ce=?,
        techniques=?,title=?,skin=?,total_kills=?,best_streak=?,total_arena_wins=?,total_dmg=?,highest_crit=?,
        boss_rush_clears=?,updated_at=? WHERE arena_name=?`,
        [b.classKey,b.charName||'',b.level||1,b.icon||'👤',b.color||'#6366f1',b.atk||10,b.def||5,
         b.maxHP||100,b.maxCE||50,techs,b.title||'',b.skin||null,b.totalKills||0,b.bestStreak||0,
         b.totalArenaWins||0,b.totalDmg||0,b.highestCrit||0,b.bossRushClears||0,now,b.arenaName]);
    } else {
      db.run(`INSERT INTO players (id,arena_name,class_key,char_name,level,icon,color,atk,def,max_hp,max_ce,
        techniques,title,skin,total_kills,best_streak,total_arena_wins,total_dmg,highest_crit,
        boss_rush_clears,friend_code,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,b.arenaName,b.classKey,b.charName||'',b.level||1,b.icon||'👤',b.color||'#6366f1',
         b.atk||10,b.def||5,b.maxHP||100,b.maxCE||50,techs,b.title||'',b.skin||null,
         b.totalKills||0,b.bestStreak||0,b.totalArenaWins||0,b.totalDmg||0,b.highestCrit||0,
         b.bossRushClears||0,fc,now]);
    }
    saveDB();
    res.json({ ok: true, playerId: id, friendCode: fc });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/player/code/:code', (req, res) => {
  try {
    const p = qOne("SELECT * FROM players WHERE friend_code = ?", [req.params.code]);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json({ arenaName:p.arena_name, classKey:p.class_key, charName:p.char_name,
      level:p.level, icon:p.icon, color:p.color, atk:p.atk, def:p.def,
      maxHP:p.max_hp, maxCE:p.max_ce, techniques:JSON.parse(p.techniques||'[]'),
      title:p.title, skin:p.skin, streak:p.best_streak, totalKills:p.total_kills, friendCode:p.friend_code });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ═══ PVP MATCHMAKING ═══
app.post('/api/pvp/queue', (req, res) => {
  try {
    const b = req.body; if (!b.arenaName) return res.status(400).json({ error: 'arenaName required' });
    db.run("DELETE FROM pvp_queue WHERE arena_name = ?", [b.arenaName]);
    db.run(`INSERT INTO pvp_queue (arena_name,class_key,char_name,level,icon,color,atk,def,max_hp,max_ce,
      techniques,title,skin,streak,queued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.arenaName,b.classKey||'',b.charName||'',b.level||1,b.icon||'👤',b.color||'#6366f1',
       b.atk||10,b.def||5,b.maxHP||100,b.maxCE||50,JSON.stringify(b.techniques||[]),
       b.title||'',b.skin||null,b.streak||0,new Date().toISOString()]);
    saveDB(); res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/pvp/opponents/:arenaName/:level', (req, res) => {
  try {
    const name = req.params.arenaName, lv = parseInt(req.params.level) || 1;
    const min = Math.max(1, lv - 5), max = lv + 5;

    let ops = qAll("SELECT * FROM pvp_queue WHERE arena_name != ? AND level BETWEEN ? AND ? ORDER BY ABS(level-?) LIMIT 3",
      [name, min, max, lv]);

    if (ops.length < 3) {
      const exc = [name, ...ops.map(o => o.arena_name)];
      const ph = exc.map(() => '?').join(',');
      const off = qAll(`SELECT * FROM players WHERE arena_name NOT IN (${ph}) AND level BETWEEN ? AND ? ORDER BY ABS(level-?) LIMIT ?`,
        [...exc, min, max, lv, 3 - ops.length]);
      off.forEach(p => ops.push({ ...p, streak: p.best_streak, offline: true }));
    }

    res.json({ opponents: ops.map(o => ({
      arenaName:o.arena_name, classKey:o.class_key, charName:o.char_name,
      level:o.level, icon:o.icon, color:o.color, atk:o.atk, def:o.def,
      maxHP:o.max_hp, maxCE:o.max_ce, techniques:JSON.parse(o.techniques||'[]'),
      title:o.title, skin:o.skin, streak:o.streak||0, isReal:true, isOffline:!!o.offline
    })), count: ops.length });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ═══ FRIENDS ═══
app.post('/api/friends/add', (req, res) => {
  try {
    const { playerId, friendCode } = req.body;
    if (!playerId || !friendCode) return res.status(400).json({ error: 'playerId and friendCode required' });
    const f = qOne("SELECT id,arena_name,class_key,char_name,level,icon,color,atk,def FROM players WHERE friend_code=?", [friendCode]);
    if (!f) return res.status(404).json({ error: 'No player with that code' });
    if (f.id === playerId) return res.status(400).json({ error: "Can't add yourself" });
    if (qOne("SELECT 1 FROM friends WHERE player_id=? AND friend_id=?", [playerId, f.id])) return res.status(400).json({ error: 'Already friends' });
    db.run("INSERT INTO friends (player_id,friend_id) VALUES (?,?)", [playerId, f.id]);
    saveDB();
    res.json({ ok:true, friend:{ arenaName:f.arena_name, classKey:f.class_key, charName:f.char_name, level:f.level, icon:f.icon, color:f.color, atk:f.atk, def:f.def }});
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/friends/:playerId', (req, res) => {
  try {
    const fr = qAll("SELECT p.* FROM friends f JOIN players p ON p.id=f.friend_id WHERE f.player_id=? ORDER BY p.level DESC", [req.params.playerId]);
    res.json({ friends: fr.map(f => ({
      arenaName:f.arena_name, classKey:f.class_key, charName:f.char_name, level:f.level,
      icon:f.icon, color:f.color, atk:f.atk, def:f.def, maxHP:f.max_hp, maxCE:f.max_ce,
      techniques:JSON.parse(f.techniques||'[]'), title:f.title, streak:f.best_streak, friendCode:f.friend_code
    }))});
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/friends/:playerId/:friendName', (req, res) => {
  try {
    const f = qOne("SELECT id FROM players WHERE arena_name=?", [req.params.friendName]);
    if (f) db.run("DELETE FROM friends WHERE player_id=? AND friend_id=?", [req.params.playerId, f.id]);
    saveDB(); res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ═══ LEADERBOARD & STATS ═══
app.get('/api/leaderboard', (req, res) => {
  try {
    const col = {kills:'total_kills',streak:'best_streak',level:'level',dmg:'total_dmg'}[req.query.sort] || 'total_kills';
    const top = qAll(`SELECT arena_name,class_key,icon,level,total_kills,best_streak,total_dmg,title FROM players ORDER BY ${col} DESC LIMIT 50`);
    res.json({ leaderboard: top.map(e => ({
      arenaName:e.arena_name, classKey:e.class_key, icon:e.icon, level:e.level,
      kills:e.total_kills, streak:e.best_streak, dmg:e.total_dmg, title:e.title
    }))});
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/stats', (req, res) => {
  try {
    res.json({
      totalPlayers: qOne("SELECT COUNT(*) as c FROM players")?.c || 0,
      totalKills: qOne("SELECT SUM(total_kills) as c FROM players")?.c || 0,
      topStreak: qOne("SELECT MAX(best_streak) as c FROM players")?.c || 0,
      topLevel: qOne("SELECT MAX(level) as c FROM players")?.c || 0
    });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ═══ ACCOUNTS ═══
app.post('/api/account/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    
    const existing = qOne("SELECT 1 FROM accounts WHERE username = ?", [username.toLowerCase()]);
    if (existing) return res.status(400).json({ error: 'Username already taken' });
    
    const now = new Date().toISOString();
    db.run("INSERT INTO accounts (username, password, save_data, created_at, updated_at) VALUES (?,?,?,?,?)",
      [username.toLowerCase(), password, '{}', now, now]);
    saveDB();
    res.json({ ok: true, msg: 'Account created!' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/account/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    const acc = qOne("SELECT * FROM accounts WHERE username = ?", [username.toLowerCase()]);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    if (acc.password !== password) return res.status(401).json({ error: 'Wrong password' });
    
    res.json({ ok: true, saveData: acc.save_data, msg: 'Welcome back!' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/account/save', (req, res) => {
  try {
    const { username, password, saveData } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credentials required' });
    
    const acc = qOne("SELECT 1 FROM accounts WHERE username = ? AND password = ?", [username.toLowerCase(), password]);
    if (!acc) return res.status(401).json({ error: 'Invalid credentials' });
    
    const now = new Date().toISOString();
    db.run("UPDATE accounts SET save_data = ?, updated_at = ? WHERE username = ?",
      [typeof saveData === 'string' ? saveData : JSON.stringify(saveData), now, username.toLowerCase()]);
    saveDB();
    res.json({ ok: true, msg: 'Saved to cloud!' });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n⚔️  CURSED LINEAGE: DOMAIN WARS — MULTIPLAYER SERVER`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📦 DB: ${DB_PATH}\n`);
  });
}).catch(e => { console.error('Start failed:', e); process.exit(1); });
