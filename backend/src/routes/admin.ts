import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';

import {
  deleteModelById,
  listModels,
  publicBaseUrl,
  uploadModel,
  requireDashboardKey,
} from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.use(requireDashboardKey);

router.get('/models', async (req, res) => {
  const models = await listModels(publicBaseUrl(req));
  res.json({ models });
});

router.post('/models/upload', ...uploadModel);

router.delete('/models/:id', async (req, res) => {
  const deleted = await deleteModelById(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  res.status(204).end();
});

export default router;
