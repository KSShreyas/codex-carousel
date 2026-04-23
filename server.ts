/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";

import { Storage } from "./src/carousel/storage";
import { Registry } from "./src/carousel/registry";
import { Arbiter } from "./src/carousel/arbiter";
import { Ledger } from "./src/carousel/ledger";
import { Bridge } from "./src/carousel/bridge";
import { Monitor } from "./src/carousel/monitor";
import { loadConfig } from "./src/carousel/config";
import { SwitchReason, AccountState } from "./src/carousel/types";
import { logger } from "./src/carousel/logging";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialization
  const config = loadConfig();
  const storage = new Storage(config.stateDir);
  const registry = new Registry(storage, config);
  const arbiter = new Arbiter(config);
  const ledger = new Ledger(storage);
  const bridge = new Bridge(registry, arbiter, ledger, config);
  
  await bridge.initialize();

  // Bootstrap if empty
  const existingAccounts = registry.getAllAccounts();
  if (existingAccounts.length === 0) {
    logger.log('Bootstrapping initial accounts...');
    await registry.importAccount({ alias: 'Primary Account', priority: 10, sourcePath: 'auth_1.json', disabled: false, metadata: {} });
    await registry.importAccount({ alias: 'Secondary Buffer', priority: 5, sourcePath: 'auth_2.json', disabled: false, metadata: {} });
    await registry.importAccount({ alias: 'Safety Overflow', priority: 1, sourcePath: 'auth_3.json', disabled: false, metadata: {} });
    await bridge.performSwitch(SwitchReason.UserManuallySwitched);
  }

  const monitor = new Monitor(registry, config, (reason) => {
    bridge.performSwitch(reason).catch(err => logger.error('Auto-switch failed', err));
  });
  monitor.start();

  // API Routes
  app.get("/api/status", (req, res) => {
    res.json({
      runtime: bridge.getRuntime(),
      accounts: registry.getAllAccounts().map(acc => ({
        ...acc,
        health: registry.getHealth(acc.id)
      })),
      ledger: ledger.getCurrent(),
      config
    });
  });

  app.post("/api/accounts/import", async (req, res) => {
    const { alias, priority } = req.body;
    try {
      const acc = await registry.importAccount({
        alias,
        priority: priority ?? 1,
        sourcePath: './mock-source',
        disabled: false,
        metadata: {}
      });
      res.json(acc);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/switch", async (req, res) => {
    try {
      await bridge.performSwitch(SwitchReason.UserManuallySwitched);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/accounts/:id/suspend", async (req, res) => {
    const { reason } = req.body;
    registry.updateHealth(req.params.id, { state: AccountState.Suspended, suspendedReason: reason ?? 'Manual suspension' });
    await registry.save();
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/reactivate", async (req, res) => {
    registry.updateHealth(req.params.id, { state: AccountState.Available, cooldownUntil: null, suspendedReason: null });
    await registry.save();
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/cooldown", async (req, res) => {
    const cooldownUntil = new Date(Date.now() + config.cooldownDurationMinutes * 60 * 1000).toISOString();
    registry.updateHealth(req.params.id, { state: AccountState.CoolingDown, cooldownUntil });
    await registry.save();
    res.json({ success: true });
  });

  app.get("/api/ledger", (req, res) => {
    res.json(ledger.getCurrent());
  });

  app.get("/api/doctor", (req, res) => {
    const accounts = registry.getAllAccounts();
    const active = bridge.getRuntime().activeAccountId;
    const issues = [];
    if (!active && accounts.length > 0) issues.push("No active account selected");
    if (accounts.length === 0) issues.push("Account registry is empty");
    res.json({ status: issues.length === 0 ? 'healthy' : 'degraded', issues });
  });

  app.post("/api/accounts/:id/refresh", async (req, res) => {
    try {
      const usage = await monitor.refreshUsage(req.params.id);
      res.json(usage);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/accounts/:id/toggle", async (req, res) => {
    const acc = registry.getAccount(req.params.id);
    if (!acc) return res.status(404).json({ error: "Not found" });
    acc.disabled = !acc.disabled;
    await registry.save();
    res.json(acc);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Codex Carousel Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server failure:", err);
  process.exit(1);
});
