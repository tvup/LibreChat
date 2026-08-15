// ./api/server/services/Files/Audio/TTSService.js
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Transform } = require('stream');
const { logger } = require('@librechat/data-schemas');
const {
  genAzureEndpoint,
  logAxiosError,
  applyAxiosProxyConfig,
  resolveConfigSecret,
  applySSRFSafeAgentIfDirect,
} = require('@librechat/api');
const { extractEnvVariable, TTSProviders } = require('librechat-data-provider');
const { getRandomVoiceId, createChunkProcessor, splitTextIntoChunks } = require('./streamAudio');
const { getAppConfig } = require('~/server/services/Config');

const TTS_CACHE_DIR = path.resolve(
  process.env.TTS_CACHE_DIR || path.join(process.cwd(), 'data', 'tts-cache'),
);
const TTS_CACHE_DEFAULT_DAYS = 30;

class TTSService {
  constructor() {
    this.providerStrategies = {
      [TTSProviders.OPENAI]: this.openAIProvider.bind(this),
      [TTSProviders.AZURE_OPENAI]: this.azureOpenAIProvider.bind(this),
      [TTSProviders.ELEVENLABS]: this.elevenLabsProvider.bind(this),
      [TTSProviders.LOCALAI]: this.localAIProvider.bind(this),
    };
  }

  getCacheMaxAgeMs(appConfig) {
    const days = appConfig?.speech?.tts?.cacheMaxAgeDays;
    return (days != null && days >= 0 ? days : TTS_CACHE_DEFAULT_DAYS) * 24 * 60 * 60 * 1000;
  }

  static async getInstance() {
    const instance = new TTSService();
    instance.cleanupCache().catch((err) =>
      logger.warn(`[TTS Cache] Cleanup error: ${err.message}`),
    );
    return instance;
  }

  /* ====== CACHE METHODS ====== */

  getCacheFilePath(input, voice) {
    const hash = crypto
      .createHash('sha256')
      .update(`${voice}:${input}`)
      .digest('hex');
    return path.join(TTS_CACHE_DIR, `${hash}.mp3`);
  }

  async getCachedStream(input, voice, maxAgeMs) {
    try {
      const filePath = this.getCacheFilePath(input, voice);
      const stats = await fsp.stat(filePath);
      if (Date.now() - stats.mtimeMs > maxAgeMs) {
        await fsp.unlink(filePath).catch(() => {});
        return null;
      }
      logger.debug(`[TTS Cache] Hit: ${input.substring(0, 60)}`);
      const now = new Date();
      await fsp.utimes(filePath, now, now).catch(() => {});
      return fs.createReadStream(filePath);
    } catch {
      return null;
    }
  }

  createCachingTransform(input, voice) {
    const filePath = this.getCacheFilePath(input, voice);
    const chunks = [];
    return new Transform({
      transform(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        const buffer = Buffer.concat(chunks);
        fsp
          .mkdir(TTS_CACHE_DIR, { recursive: true })
          .then(() => fsp.writeFile(filePath, buffer))
          .then(() => logger.debug(`[TTS Cache] Stored: ${input.substring(0, 60)}`))
          .catch((err) => logger.error(`[TTS Cache] Write error: ${err.message}`));
        callback();
      },
    });
  }

  async cleanupCache(maxAgeMs) {
    const maxAge = maxAgeMs || TTS_CACHE_DEFAULT_DAYS * 24 * 60 * 60 * 1000;
    try {
      const files = await fsp.readdir(TTS_CACHE_DIR);
      let removed = 0;
      for (const file of files) {
        const filePath = path.join(TTS_CACHE_DIR, file);
        const stats = await fsp.stat(filePath);
        if (Date.now() - stats.mtimeMs > maxAge) {
          await fsp.unlink(filePath);
          removed++;
        }
      }
      if (removed > 0) {
        logger.info(`[TTS Cache] Cleaned up ${removed} expired files`);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /* ====== PROVIDER CONFIG (unchanged) ====== */

  getProvider(appConfig) {
    const ttsSchema = appConfig?.speech?.tts;
    if (!ttsSchema) {
      throw new Error(
        'No TTS schema is set. Did you configure TTS in the custom config (librechat.yaml)?',
      );
    }
    const providers = Object.entries(ttsSchema).filter(
      ([key, value]) => key !== 'allowedAddresses' && Object.keys(value).length > 0,
    );

    if (providers.length !== 1) {
      throw new Error(
        providers.length > 1
          ? 'Multiple providers are set. Please set only one provider.'
          : 'No provider is set. Please set a provider.',
      );
    }
    return providers[0][0];
  }

  async getVoice(providerSchema, requestVoice) {
    const voices = providerSchema.voices.filter((voice) => voice && voice.toUpperCase() !== 'ALL');
    let voice = requestVoice;
    if (!voice || !voices.includes(voice) || (voice.toUpperCase() === 'ALL' && voices.length > 1)) {
      voice = getRandomVoiceId(voices);
    }
    return voice;
  }

  removeUndefined(obj) {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === 'object') {
        this.removeUndefined(obj[key]);
        if (Object.keys(obj[key]).length === 0) {
          delete obj[key];
        }
      } else if (obj[key] === undefined) {
        delete obj[key];
      }
    });
  }

  /* ====== PROVIDER STRATEGIES (unchanged) ====== */

  openAIProvider(ttsSchema, input, voice) {
    const url = ttsSchema?.url || 'https://api.openai.com/v1/audio/speech';

    if (
      ttsSchema?.voices &&
      ttsSchema.voices.length > 0 &&
      !ttsSchema.voices.includes(voice) &&
      !ttsSchema.voices.includes('ALL')
    ) {
      throw new Error(`Voice ${voice} is not available.`);
    }

    const data = {
      input,
      model: ttsSchema?.model,
      voice: ttsSchema?.voices && ttsSchema.voices.length > 0 ? voice : undefined,
      backend: ttsSchema?.backend,
    };

    const apiKey = resolveConfigSecret(ttsSchema?.apiKey) || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    };

    return [url, data, headers];
  }

  azureOpenAIProvider(ttsSchema, input, voice) {
    const url = `${genAzureEndpoint({
      azureOpenAIApiInstanceName: extractEnvVariable(ttsSchema?.instanceName),
      azureOpenAIApiDeploymentName: extractEnvVariable(ttsSchema?.deploymentName),
    })}/audio/speech?api-version=${extractEnvVariable(ttsSchema?.apiVersion)}`;

    if (
      ttsSchema?.voices &&
      ttsSchema.voices.length > 0 &&
      !ttsSchema.voices.includes(voice) &&
      !ttsSchema.voices.includes('ALL')
    ) {
      throw new Error(`Voice ${voice} is not available.`);
    }

    const data = {
      model: extractEnvVariable(ttsSchema?.model),
      input,
      voice: ttsSchema?.voices && ttsSchema.voices.length > 0 ? voice : undefined,
    };

    const headers = {
      'Content-Type': 'application/json',
      'api-key': ttsSchema.apiKey ? resolveConfigSecret(ttsSchema.apiKey) || '' : '',
    };

    return [url, data, headers];
  }

  elevenLabsProvider(ttsSchema, input, voice, stream) {
    let url =
      ttsSchema?.url ||
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}${stream ? '/stream' : ''}`;

    if (!ttsSchema?.voices.includes(voice) && !ttsSchema?.voices.includes('ALL')) {
      throw new Error(`Voice ${voice} is not available.`);
    }

    const data = {
      model_id: ttsSchema?.model,
      text: input,
      voice_settings: {
        similarity_boost: ttsSchema?.voice_settings?.similarity_boost,
        stability: ttsSchema?.voice_settings?.stability,
        style: ttsSchema?.voice_settings?.style,
        use_speaker_boost: ttsSchema?.voice_settings?.use_speaker_boost,
      },
      pronunciation_dictionary_locators: ttsSchema?.pronunciation_dictionary_locators,
    };

    const apiKey = resolveConfigSecret(ttsSchema?.apiKey) || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'xi-api-key': apiKey }),
      Accept: 'audio/mpeg',
    };

    return [url, data, headers];
  }

  localAIProvider(ttsSchema, input, voice) {
    const url = ttsSchema?.url;

    if (
      ttsSchema?.voices &&
      ttsSchema.voices.length > 0 &&
      !ttsSchema.voices.includes(voice) &&
      !ttsSchema.voices.includes('ALL')
    ) {
      throw new Error(`Voice ${voice} is not available.`);
    }

    const data = {
      input,
      model: ttsSchema?.voices && ttsSchema.voices.length > 0 ? voice : undefined,
      backend: ttsSchema?.backend,
    };

    const apiKey = resolveConfigSecret(ttsSchema?.apiKey) || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    };

    return [url, data, headers];
  }

  /* ====== TTS REQUEST — NOW WITH CACHING + SSRF PROTECTION ====== */

  async ttsRequest(
    provider,
    ttsSchema,
    { input, voice, stream = true, appConfig },
    allowedAddresses,
  ) {
    const maxAgeMs = this.getCacheMaxAgeMs(appConfig);
    const cached = await this.getCachedStream(input, voice, maxAgeMs);
    if (cached) {
      return { data: cached };
    }


    const strategy = this.providerStrategies[provider];
    if (!strategy) {
      throw new Error('Invalid provider');
    }

    const [url, data, headers] = strategy.call(this, ttsSchema, input, voice, stream);

    [data, headers].forEach(this.removeUndefined.bind(this));

    const options = { headers, responseType: stream ? 'stream' : 'arraybuffer' };

    applyAxiosProxyConfig(options, url);
    applySSRFSafeAgentIfDirect(options, url, allowedAddresses);

    try {
      const response = await axios.post(url, data, options);

      if (stream && response.data) {
        response.data = response.data.pipe(this.createCachingTransform(input, voice));
      }

      return response;
    } catch (error) {
      logAxiosError({ message: `TTS request failed for provider ${provider}:`, error });
      throw error;
    }
  }

  /* ====== HANDLERS (unchanged) ====== */

  async processTextToSpeech(req, res) {
    const { input, voice: requestVoice } = req.body;

    if (!input) {
      return res.status(400).send('Missing text in request body');
    }

    const appConfig =
      req.config ??
      (await getAppConfig({
        role: req.user?.role,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
      }));
    try {
      res.setHeader('Content-Type', 'audio/mpeg');
      const provider = this.getProvider(appConfig);
      const ttsSchema = appConfig?.speech?.tts?.[provider];
      const allowedAddresses = appConfig?.speech?.tts?.allowedAddresses;
      const voice = await this.getVoice(ttsSchema, requestVoice);

      if (input.length < 4096) {
        const response = await this.ttsRequest(
          provider,
          ttsSchema,
          { input, voice, appConfig },
          allowedAddresses,
        );
        response.data.pipe(res);
        return;
      }

      const textChunks = splitTextIntoChunks(input, 1000);

      for (const chunk of textChunks) {
        try {
          const response = await this.ttsRequest(
            provider,
            ttsSchema,
            {
              voice,
              input: chunk.text,
              stream: true,
              appConfig,
            },
            allowedAddresses,
          );

          logger.debug(`[textToSpeech] user: ${req?.user?.id} | writing audio stream`);
          await new Promise((resolve) => {
            response.data.pipe(res, { end: chunk.isFinished });
            response.data.on('end', resolve);
          });

          if (chunk.isFinished) {
            break;
          }
        } catch (innerError) {
          logAxiosError({
            message: `[TTS] Error processing manual update for chunk: ${chunk?.text?.substring(0, 50)}...`,
            error: innerError,
          });
          if (!res.headersSent) {
            return res.status(500).end();
          }
          return;
        }
      }

      if (!res.headersSent) {
        res.end();
      }
    } catch (error) {
      logAxiosError({ message: '[TTS] Error creating the audio stream:', error });
      if (!res.headersSent) {
        return res.status(500).send('An error occurred');
      }
    }
  }

  async streamAudio(req, res) {
    res.setHeader('Content-Type', 'audio/mpeg');
    const appConfig =
      req.config ??
      (await getAppConfig({
        role: req.user?.role,
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
      }));
    const provider = this.getProvider(appConfig);
    const ttsSchema = appConfig?.speech?.tts?.[provider];
    const allowedAddresses = appConfig?.speech?.tts?.allowedAddresses;
    const voice = await this.getVoice(ttsSchema, req.body.voice);

    let shouldContinue = true;

    req.on('close', () => {
      logger.warn('[streamAudio] Audio Stream Request closed by client');
      shouldContinue = false;
    });

    const processChunks = createChunkProcessor(req.user.id, req.body.messageId);

    try {
      while (shouldContinue) {
        const updates = await processChunks();
        if (typeof updates === 'string') {
          logger.error(`Error processing audio stream updates: ${updates}`);
          return res.status(500).end();
        }

        if (updates.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1250));
          continue;
        }

        for (const update of updates) {
          try {
            const response = await this.ttsRequest(
              provider,
              ttsSchema,
              {
                voice,
                input: update.text,
                stream: true,
                appConfig,
              },
              allowedAddresses,
            );

            if (!shouldContinue) {
              break;
            }

            logger.debug(`[streamAudio] user: ${req?.user?.id} | writing audio stream`);
            await new Promise((resolve) => {
              response.data.pipe(res, { end: update.isFinished });
              response.data.on('end', resolve);
            });

            if (update.isFinished) {
              shouldContinue = false;
              break;
            }
          } catch (innerError) {
            logAxiosError({
              message: `[TTS] Error processing audio stream update: ${update?.text?.substring(0, 50)}...`,
              error: innerError,
            });
            if (!res.headersSent) {
              return res.status(500).end();
            }
            return;
          }
        }

        if (!shouldContinue) {
          break;
        }
      }

      if (!res.headersSent) {
        res.end();
      }
    } catch (error) {
      logAxiosError({ message: '[TTS] Failed to fetch audio:', error });
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  }
}

async function createTTSService() {
  return TTSService.getInstance();
}

async function textToSpeech(req, res) {
  const ttsService = await createTTSService();
  await ttsService.processTextToSpeech(req, res);
}

async function streamAudio(req, res) {
  const ttsService = await createTTSService();
  await ttsService.streamAudio(req, res);
}

async function getProvider(appConfig) {
  const ttsService = await createTTSService();
  return ttsService.getProvider(appConfig);
}

module.exports = {
  textToSpeech,
  streamAudio,
  getProvider,
  TTSService,
};
