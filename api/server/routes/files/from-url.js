const express = require('express');
const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { FileContext, FileSources } = require('librechat-data-provider');
const { processFileURL } = require('~/server/services/Files/process');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');

const router = express.Router();

/**
 * POST /api/files/from-url
 *
 * Importerer et eksternt billede ind i LibreChat's egen Files-collection
 * og storage-strategi. Wrapper `processFileURL` så billedet (a) downloades
 * af LibreChat, (b) gemmes via aktiv fileStrategy (local/s3/firebase),
 * (c) registreres i `files`-collection med ejer = req.user._id.
 *
 * Bruges af MCP-tools (fx atlascloud-mcp) der genererer billeder eksternt
 * men gerne vil have dem dukke op i admin/files + være knyttet til en bruger.
 *
 * Body:
 *   - url (required): http(s)-URL til billedet
 *   - fileName (optional): foretrukket filnavn; fallback genereres fra URL
 *   - conversationId (optional): hvis sat, knyttes filen til samtalen
 *   - context (optional): FileContext-værdi (default: 'image_generation')
 *
 * Returnerer det oprettede File-dokument.
 */
router.post('/', async (req, res) => {
  try {
    const callerUserId = req.user?._id?.toString();
    if (!callerUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { url, fileName, conversationId, context, targetUserId } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url is required' });
    }

    /**
     * `targetUserId` lader en betroet caller (fx atlascloud-MCP der signerer
     * med ATLAS_OWNER's JWT) registrere filen under en ANDEN bruger. Det er
     * nødvendigt for multi-bruger-flow hvor MCP-processen kender ATLAS_OWNER's
     * JWT_SECRET men skal tildele filen til den bruger der reelt chatter.
     * Kun tilladt hvis caller selv har ADMIN-rolle.
     */
    let userId = callerUserId;
    if (typeof targetUserId === 'string' && targetUserId !== callerUserId) {
      if (req.user?.role !== 'ADMIN') {
        logger.warn(
          `[POST /api/files/from-url] non-admin ${callerUserId} tried targetUserId=${targetUserId}`,
        );
        return res.status(403).json({ message: 'targetUserId requires ADMIN role' });
      }
      userId = targetUserId;
    }

    /** Sikr fileName: udled fra URL hvis ikke angivet. */
    const resolvedFileName = (() => {
      if (typeof fileName === 'string' && fileName.trim()) {
        return fileName.trim();
      }
      try {
        const parsed = new URL(url);
        const last = path.basename(parsed.pathname);
        return last || `file-${Date.now()}`;
      } catch {
        return `file-${Date.now()}`;
      }
    })();

    const fileStrategy = getFileStrategy(req.config, { isImage: true }) || FileSources.local;

    const file = await processFileURL({
      fileStrategy,
      userId,
      URL: url,
      fileName: resolvedFileName,
      basePath: 'images',
      context: context || FileContext.image_generation,
    });

    if (conversationId && file?._id) {
      file.conversationId = conversationId;
    }

    return res.status(201).json(file);
  } catch (error) {
    logger.error('[POST /api/files/from-url] failed:', error);
    return res.status(500).json({ message: 'Failed to import file from URL' });
  }
});

module.exports = router;
