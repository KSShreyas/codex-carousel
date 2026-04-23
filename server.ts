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
import { SwitchReason, AccountState, FailureKind } from "./src/carousel/types";
import { logger } from "./src/carousel/logging";
import { RuntimeStore } from "./src/carousel/runtime";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialization
  const config = loadConfig();
  const storage = new Storage(config.stateDir);
  
  // Ensure directories exist
  await storage.ensureDir();
  await storage.ensureDir('ledgers');
  await storage.ensureDir('ledgers/history');
  await storage.ensureDir(path.relative(process.cwd(), config.logDir));
  
  // Initialize logger with log directory
  logger.logFile = path.join(config.logDir, 'carousel.jsonl');
  await logger.init();
  
  const registry = new Registry(storage, config);
  const arbiter = new Arbiter(config);
  const ledger = new Ledger(storage);
  const runtimeStore = new RuntimeStore(storage);
  const bridge = new Bridge(registry, arbiter, ledger, runtimeStore, config);
  
  await bridge.initialize();

  // Bootstrap if empty (dev mode only) - GATED BEHIND EXPLICIT FLAG
  const existingAccounts = registry.getAllAccounts();
  if (existingAccounts.length === 0 && process.env.CAROUSEL_BOOTSTRAP_DEV === 'true') {
    logger.log('DEV BOOTSTRAP MODE: Creating starter accounts');
    await registry.importAccount({ alias: 'Primary Account', priority: 10, sourcePath: 'auth_1.json', disabled: false, metadata: {} });
    await registry.importAccount({ alias: 'Secondary Buffer', priority: 5, sourcePath: 'auth_2.json', disabled: false, metadata: {} });
    await registry.importAccount({ alias: 'Safety Overflow', priority: 1, sourcePath: 'auth_3.json', disabled: false, metadata: {} });
    logger.log('DEV BOOTSTRAP: Created 3 starter accounts');
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

  app.get("/api/accounts", (req, res) => {
    res.json(registry.getAllAccounts().map(acc => ({
      ...acc,
      health: registry.getHealth(acc.id)
    })));
  });

  app.get("/api/runtime", (req, res) => {
    res.json(bridge.getRuntime());
  });

  app.get("/api/ledger", (req, res) => {
    res.json(ledger.getCurrent());
  });

  app.get("/api/logs", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = await logger.loadRecentEvents(limit);
    res.json(logs);
  });

  app.get("/api/doctor", (req, res) => {
    const accounts = registry.getAllAccounts();
    const runtime = bridge.getRuntime();
    const issues = [];
    
    if (!runtime.activeAccountId && accounts.length > 0) {
      issues.push("No active account selected");
    }
    if (accounts.length === 0) {
      issues.push("Account registry is empty");
    }
    
    // Check for accounts in bad states
    for (const acc of accounts) {
      const health = registry.getHealth(acc.id);
      if (health?.consecutiveFailures >= config.maxConsecutiveFailures) {
        issues.push(`Account ${acc.alias} has ${health.consecutiveFailures} consecutive failures`);
      }
    }
    
    res.json({ status: issues.length === 0 ? 'healthy' : 'degraded', issues, runtime, accountCount: accounts.length });
  });

  app.post("/api/accounts/import", async (req, res) => {
    const { alias, priority, sourcePath } = req.body;
    if (!alias) {
      return res.status(400).json({ error: 'Alias is required' });
    }
    
    // In production mode, require explicit source path
    if (!sourcePath && process.env.CAROUSEL_PRODUCTION === 'true') {
      return res.status(400).json({ error: 'Source path is required in production mode' });
    }
    
    try {
      const acc = await registry.importAccount({
        alias,
        priority: priority ?? 1,
        sourcePath: sourcePath || `./auth-${Date.now()}.json`,
        disabled: false,
        metadata: {}
      });
      logger.log('API: Account imported', { id: acc.id, alias: acc.alias, sourcePath: acc.sourcePath });
      res.json(acc);
    } catch (err) {
      logger.error('API: Import failed', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/rotate", async (req, res) => {
    try {
      const result = await bridge.performSwitch(SwitchReason.UserManuallySwitched);
      if (result.success) {
        logger.log('API: Rotation completed', { selectedId: result.selectedId });
        res.json({ success: true, selectedId: result.selectedId });
      } else {
        logger.error('API: Rotation failed', result.error);
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (err) {
      logger.error('API: Rotation exception', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/accounts/:id/suspend", async (req, res) => {
    const { reason } = req.body;
    await registry.suspendAccount(req.params.id, reason ?? 'Manual suspension');
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/reactivate", async (req, res) => {
    await registry.reactivateAccount(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/disable", async (req, res) => {
    await registry.setAccountDisabled(req.params.id, true);
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/enable", async (req, res) => {
    await registry.setAccountDisabled(req.params.id, false);
    res.json({ success: true });
  });

  app.post("/api/accounts/:id/toggle", async (req, res) => {
    const acc = registry.getAccount(req.params.id);
    if (!acc) return res.status(404).json({ error: "Not found" });
    await registry.setAccountDisabled(req.params.id, !acc.disabled);
    res.json({ ...acc, disabled: !acc.disabled });
  });

  app.post("/api/accounts/:id/cooldown", async (req, res) => {
    const cooldownUntil = new Date(Date.now() + config.cooldownDurationMinutes * 60 * 1000).toISOString();
    registry.updateHealth(req.params.id, { state: AccountState.CoolingDown, cooldownUntil });
    await registry.save();
    res.json({ success: true, cooldownUntil });
  });

  app.post("/api/accounts/:id/refresh", async (req, res) => {
    try {
      const usage = await monitor.refreshUsage(req.params.id);
      res.json(usage);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/rebuild", async (req, res) => {
    try {
      await registry.rebuildFromDisk(config.inboxDir);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
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
