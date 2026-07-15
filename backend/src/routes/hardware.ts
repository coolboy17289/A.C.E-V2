import type { Application } from 'express';
import type { Db } from '../db.js';
import { ah } from '../util/error.js';
import { snapshot } from '../services/hardware.js';
import { setLed, ledState } from '../services/gpio.js';

export function registerHardwareRoutes(app: Application, _db: Db) {
  app.get('/api/hardware/device', ah((_req, res) => {
    res.json(snapshot());
  }));

  app.post('/api/hardware/led', ah(async (req, res) => {
    const pin = Number((req.body ?? {}).pin);
    const on = Boolean((req.body ?? {}).on);
    if (!Number.isInteger(pin) || pin < 0 || pin > 40) {
      res.status(400).json({ error: 'invalid_pin', details: 'pin must be 0..40 (BCM numbering)' });
      return;
    }
    const result = await setLed(pin, on);
    res.json(result);
  }));

  // Debug helper that returns the recent LED intents (useful during testing).
  app.get('/api/hardware/leds', ah((_req, res) => {
    res.json(ledState());
  }));
}
