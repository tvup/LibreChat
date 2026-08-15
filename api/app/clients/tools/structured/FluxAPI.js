const axios = require('axios');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { Tool } = require('@librechat/agents/langchain/tools');
const {
  applyAxiosProxyConfig,
  createMinimalRetentionRequest,
  getHttpsProxyAgent,
} = require('@librechat/api');
const { FileContext, ContentTypes } = require('librechat-data-provider');

const fluxApiJsonSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['generate', 'list_finetunes', 'generate_finetuned'],
      description:
        'Action to perform: "generate" for image generation, "generate_finetuned" for finetuned model generation, "list_finetunes" to get available custom models',
    },
    prompt: {
      type: 'string',
      description:
        'Text prompt for image generation. Required when action is "generate". Not used for list_finetunes.',
    },
    width: {
      type: 'string',
      description:
        'Width of the generated image in pixels. Must be a multiple of 32. Default is 1024.',
    },
    height: {
      type: 'string',
      description:
        'Height of the generated image in pixels. Must be a multiple of 32. Default is 768.',
    },
    prompt_upsampling: {
      type: 'string',
      description: 'Whether to perform upsampling on the prompt. Use "true" or "false".',
    },
    steps: {
      type: 'string',
      description: 'Number of steps to run the model for, a number from 1 to 50. Default is 40.',
    },
    seed: {
      type: 'string',
      description: 'Optional seed for reproducibility.',
    },
    safety_tolerance: {
      type: 'string',
      description:
        'Tolerance level for input and output moderation. Between 0 and 6, 0 being most strict, 6 being least strict.',
    },
    endpoint: {
      type: 'string',
      enum: [
        '/v1/flux-pro-1.1',
        '/v1/flux-pro',
        '/v1/flux-dev',
        '/v1/flux-pro-1.1-ultra',
        '/v1/flux-pro-finetuned',
        '/v1/flux-pro-1.1-ultra-finetuned',
      ],
      description: 'Endpoint to use for image generation.',
    },
    raw: {
      type: 'string',
      description:
        'Generate less processed, more natural-looking images. Only works for /v1/flux-pro-1.1-ultra. Use "true" or "false".',
    },
    finetune_id: {
      type: 'string',
      description: 'ID of the finetuned model to use',
    },
    finetune_strength: {
      type: 'string',
      description: 'Strength of the finetuning effect (typically between 0.1 and 1.2)',
    },
    guidance: {
      type: 'string',
      description: 'Guidance scale for finetuned models',
    },
    aspect_ratio: {
      type: 'string',
      description: 'Aspect ratio for ultra models (e.g., "16:9")',
    },
  },
  required: [],
};

const displayMessage =
  "Flux displayed an image. All generated images are already plainly visible, so don't repeat the descriptions in detail. Do not list download links as they are available in the UI already. The user may download the images by clicking on them, but do not mention anything about downloading to the user.";

/**
 * FluxAPI - A tool for generating high-quality images from text prompts using the Flux API.
 * Each call generates one image. If multiple images are needed, make multiple consecutive calls with the same or varied prompts.
 */
class FluxAPI extends Tool {
  // Pricing constants in USD per image
  static PRICING = {
    FLUX_PRO_1_1_ULTRA: -0.06, // /v1/flux-pro-1.1-ultra
    FLUX_PRO_1_1: -0.04, // /v1/flux-pro-1.1
    FLUX_PRO: -0.05, // /v1/flux-pro
    FLUX_DEV: -0.025, // /v1/flux-dev
    FLUX_PRO_FINETUNED: -0.06, // /v1/flux-pro-finetuned
    FLUX_PRO_1_1_ULTRA_FINETUNED: -0.07, // /v1/flux-pro-1.1-ultra-finetuned
  };

  constructor(fields = {}) {
    super();

    /** @type {boolean} Used to initialize the Tool without necessary variables. */
    this.override = fields.override ?? false;

    this.userId = fields.userId;
    this.tenantId = fields.req?.user?.tenantId;
    this.retentionRequest = createMinimalRetentionRequest(fields.req);
    this.fileStrategy = fields.fileStrategy;

    /** @type {boolean} **/
    this.isAgent = fields.isAgent;
    if (this.isAgent) {
      /** Ensures LangChain maps [content, artifact] tuple to ToolMessage fields instead of serializing it into content. */
      this.responseFormat = 'content_and_artifact';
    }
    this.returnMetadata = fields.returnMetadata ?? false;

    if (this.isAgent) {
      this.responseFormat = 'content_and_artifact';
    }

    if (fields.processFileURL) {
      /** @type {processFileURL} Necessary for output to contain all image metadata. */
      this.processFileURL = fields.processFileURL.bind(this);
    }

    this.apiKey = fields.FLUX_API_KEY || this.getApiKey();

    this.name = 'flux';
    this.description =
      'Use Flux to generate images from text descriptions. This tool can generate images and list available finetunes. Each generate call creates one image. For multiple images, make multiple consecutive calls.';

    this.description_for_model = `// Transform any image description into a detailed, high-quality prompt. Never submit a prompt under 3 sentences. Follow these core rules:
    // 1. ALWAYS enhance basic prompts into 5-10 detailed sentences (e.g., "a cat" becomes: "A close-up photo of a sleek Siamese cat with piercing blue eyes. The cat sits elegantly on a vintage leather armchair, its tail curled gracefully around its paws. Warm afternoon sunlight streams through a nearby window, casting gentle shadows across its face and highlighting the subtle variations in its cream and chocolate-point fur. The background is softly blurred, creating a shallow depth of field that draws attention to the cat's expressive features. The overall composition has a peaceful, contemplative mood with a professional photography style.")
    // 2. Each prompt MUST be 3-6 descriptive sentences minimum, focusing on visual elements: lighting, composition, mood, and style
    // Use action: 'list_finetunes' to see available custom models. When using finetunes, use endpoint: '/v1/flux-pro-finetuned' (default) or '/v1/flux-pro-1.1-ultra-finetuned' for higher quality and aspect ratio.`;

    // Add base URL from environment variable with fallback
    this.baseUrl = process.env.FLUX_API_BASE_URL || 'https://api.us1.bfl.ai';

    this.schema = fluxApiJsonSchema;
  }

  static get jsonSchema() {
    return fluxApiJsonSchema;
  }

  getAxiosConfig() {
    const config = {};
    return applyAxiosProxyConfig(config, this.baseUrl);
  }

  /** @param {Object|string} value */
  getDetails(value) {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }

  getApiKey() {
    const apiKey = process.env.FLUX_API_KEY || '';
    if (!apiKey && !this.override) {
      throw new Error('Missing FLUX_API_KEY environment variable.');
    }
    return apiKey;
  }

  wrapInMarkdown(imageUrl) {
    const serverDomain = process.env.DOMAIN_SERVER || 'http://localhost:3080';
    return `![generated image](${serverDomain}${imageUrl})`;
  }

  returnValue(value) {
    if (this.isAgent === true && typeof value === 'string') {
      return [value, {}];
    } else if (this.isAgent === true && typeof value === 'object') {
      if (Array.isArray(value)) {
        return value;
      }
      return [displayMessage, value];
    }
    return value;
  }

  async _call(data) {
    // Coerce string values to their expected types (some LLMs send all params as strings)
    if (typeof data.width === 'string') { data.width = Number(data.width); }
    if (typeof data.height === 'string') { data.height = Number(data.height); }
    if (typeof data.steps === 'string') { data.steps = Number(data.steps); }
    if (typeof data.seed === 'string') { data.seed = Number(data.seed); }
    if (typeof data.safety_tolerance === 'string') { data.safety_tolerance = Number(data.safety_tolerance); }
    if (typeof data.finetune_strength === 'string') { data.finetune_strength = Number(data.finetune_strength); }
    if (typeof data.guidance === 'string') { data.guidance = Number(data.guidance); }
    if (typeof data.prompt_upsampling === 'string') { data.prompt_upsampling = data.prompt_upsampling === 'true'; }
    if (typeof data.raw === 'string') { data.raw = data.raw === 'true'; }

    const { action = 'generate', ...imageData } = data;

    // Use provided API key for this request if available, otherwise use default
    const requestApiKey = this.apiKey || this.getApiKey();

    // Handle list_finetunes action
    if (action === 'list_finetunes') {
      return this.getMyFinetunes(requestApiKey);
    }

    // Handle finetuned generation
    if (action === 'generate_finetuned') {
      return this.generateFinetunedImage(imageData, requestApiKey);
    }

    // For generate action, ensure prompt is provided
    if (!imageData.prompt) {
      throw new Error('Missing required field: prompt');
    }

    let payload = {
      prompt: imageData.prompt,
      prompt_upsampling: imageData.prompt_upsampling || false,
      safety_tolerance: imageData.safety_tolerance || 6,
      output_format: imageData.output_format || 'png',
    };

    // Add optional parameters if provided
    if (imageData.width) {
      payload.width = Number(imageData.width);
    }
    if (imageData.height) {
      payload.height = Number(imageData.height);
    }
    if (imageData.steps) {
      payload.steps = imageData.steps;
    }
    if (imageData.seed !== undefined) {
      payload.seed = imageData.seed;
    }
    if (imageData.raw) {
      payload.raw = imageData.raw;
    }

    const generateUrl = `${this.baseUrl}${imageData.endpoint || '/v1/flux-pro-1.1'}`;
    const resultUrl = `${this.baseUrl}/v1/get_result`;

    logger.debug('[FluxAPI] Generating image with payload:', payload);
    logger.debug('[FluxAPI] Using endpoint:', generateUrl);

    let taskResponse;
    try {
      taskResponse = await axios.post(generateUrl, payload, {
        headers: {
          'x-key': requestApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...this.getAxiosConfig(),
      });
    } catch (error) {
      const details = this.getDetails(error?.response?.data || error.message);
      logger.error('[FluxAPI] Error while submitting task:', details);

      return this.returnValue(
        `Something went wrong when trying to generate the image. The Flux API may be unavailable:
        Error Message: ${details}`,
      );
    }

    const taskId = taskResponse.data.id;
    const pollingUrl = taskResponse.data.polling_url || `${resultUrl}?id=${taskId}`;
    logger.debug(`[FluxAPI] Task ID: ${taskId}, Polling URL: ${pollingUrl}`);

    // Polling for the result
    let status = 'Pending';
    let resultData = null;
    let pollCount = 0;
    const TERMINAL_STATUSES = new Set([
      'Ready',
      'Error',
      'Content Moderated',
      'Request Moderated',
      'Task not found',
      'Failed',
    ]);
    while (!TERMINAL_STATUSES.has(status)) {
      try {
        pollCount++;
        logger.debug(`[FluxAPI] Poll #${pollCount} waiting 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logger.debug(`[FluxAPI] Poll #${pollCount} fetching ${pollingUrl}`);
        const resultResponse = await axios.get(pollingUrl, {
          headers: {
            'x-key': requestApiKey,
            Accept: 'application/json',
          },
          ...this.getAxiosConfig(),
        });
        status = resultResponse.data.status;
        logger.debug(`[FluxAPI] Poll #${pollCount} status: ${status}`);

        if (status === 'Ready') {
          resultData = resultResponse.data.result;
          break;
        } else if (status === 'Content Moderated' || status === 'Request Moderated') {
          logger.warn(`[FluxAPI] ${status}: prompt afvist af FluxAPI's content filter`);
          return this.returnValue(
            'The prompt was rejected by the image-generation provider (content moderation). Please try a different prompt.',
          );
        } else if (TERMINAL_STATUSES.has(status)) {
          logger.error('[FluxAPI] Terminal failure status:', status, resultResponse.data);
          return this.returnValue(`Image generation failed: ${status}.`);
        }
      } catch (error) {
        logger.error(`[FluxAPI] Poll #${pollCount} error: name=${error?.name} code=${error?.code} status=${error?.response?.status} message=${error?.message} data=${JSON.stringify(error?.response?.data)}`);
        return this.returnValue('An error occurred while retrieving the image.');
      }
    }
    logger.debug(`[FluxAPI] Polling complete after ${pollCount} polls, status: ${status}`);

    // If no result data
    if (!resultData || !resultData.sample) {
      logger.error('[FluxAPI] No image data received from API. Response:', resultData);
      return this.returnValue('No image data received from Flux API.');
    }

    // Try saving the image locally
    const imageUrl = resultData.sample;
    const imageName = `img-${uuidv4()}.png`;

    if (this.isAgent && this.processFileURL) {
      try {
        const result = await this.processFileURL({
          fileStrategy: this.fileStrategy,
          userId: this.userId,
          URL: imageUrl,
          fileName: imageName,
          basePath: 'images',
          context: FileContext.image_generation,
        });

        const file_ids = [result.file_id || uuidv4()];
        const response = [
          {
            type: ContentTypes.TEXT,
            text: displayMessage + `\n\ngenerated_image_id: "${file_ids[0]}"`,
          },
        ];
        // Return pre-saved file metadata in artifact (not content, to avoid
        // formatArtifactPayload adding large data to model context and
        // saveBase64Image failing on non-base64 URLs)
        return [response, { file_ids, imageFile: result }];
      } catch (error) {
        logger.error('Error processing image for agent:', error);
        return this.returnValue(`Failed to process the image. ${error.message}`);
      }
    } else if (this.isAgent) {
      try {
        const fetchOptions = {};
        const agent = getHttpsProxyAgent(imageUrl);
        if (agent) {
          fetchOptions.agent = agent;
        }
        const imageResponse = await fetch(imageUrl, fetchOptions);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const content = [
          {
            type: ContentTypes.IMAGE_URL,
            image_url: {
              url: `data:image/png;base64,${base64}`,
            },
          },
        ];

        const file_ids = [uuidv4()];
        const response = [
          {
            type: ContentTypes.TEXT,
            text: displayMessage + `\n\ngenerated_image_id: "${file_ids[0]}"`,
          },
        ];
        // Include content for saveBase64Image to process in callback
        return [response, { content, file_ids }];
      } catch (error) {
        logger.error('Error processing image for agent:', error);
        return this.returnValue(`Failed to process the image. ${error.message}`);
      }
    }

    try {
      logger.debug('[FluxAPI] Saving image:', imageUrl);
      const result = await this.processFileURL({
        fileStrategy: this.fileStrategy,
        userId: this.userId,
        URL: imageUrl,
        fileName: imageName,
        basePath: 'images',
        context: FileContext.image_generation,
        tenantId: this.tenantId,
        req: this.retentionRequest,
      });

      logger.debug('[FluxAPI] Image saved to path:', result.filepath);

      // Calculate cost based on endpoint
      /**
       * TODO: Cost handling
      const endpoint = imageData.endpoint || '/v1/flux-pro';
      const endpointKey = Object.entries(FluxAPI.PRICING).find(([key, _]) =>
        endpoint.includes(key.toLowerCase().replace(/_/g, '-')),
      )?.[0];
      const cost = FluxAPI.PRICING[endpointKey] || 0;
       */
      this.result = this.returnMetadata ? result : this.wrapInMarkdown(result.filepath);
      return this.returnValue(this.result);
    } catch (error) {
      const details = this.getDetails(error?.message ?? 'No additional error details.');
      logger.error('Error while saving the image:', details);
      return this.returnValue(`Failed to save the image locally. ${details}`);
    }
  }

  async getMyFinetunes(apiKey = null) {
    const finetunesUrl = `${this.baseUrl}/v1/my_finetunes`;
    const detailsUrl = `${this.baseUrl}/v1/finetune_details`;

    try {
      const headers = {
        'x-key': apiKey || this.getApiKey(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // Get list of finetunes
      const response = await axios.get(finetunesUrl, {
        headers,
        ...this.getAxiosConfig(),
      });
      const finetunes = response.data.finetunes;

      // Fetch details for each finetune
      const finetuneDetails = await Promise.all(
        finetunes.map(async (finetuneId) => {
          try {
            const detailResponse = await axios.get(`${detailsUrl}?finetune_id=${finetuneId}`, {
              headers,
              ...this.getAxiosConfig(),
            });
            return {
              id: finetuneId,
              ...detailResponse.data,
            };
          } catch (error) {
            logger.error(`[FluxAPI] Error fetching details for finetune ${finetuneId}:`, error);
            return {
              id: finetuneId,
              error: 'Failed to fetch details',
            };
          }
        }),
      );

      if (this.isAgent) {
        const formattedDetails = JSON.stringify(finetuneDetails, null, 2);
        return [`Here are the available finetunes:\n${formattedDetails}`, null];
      }
      return JSON.stringify(finetuneDetails);
    } catch (error) {
      const details = this.getDetails(error?.response?.data || error.message);
      logger.error('[FluxAPI] Error while getting finetunes:', details);
      const errorMsg = `Failed to get finetunes: ${details}`;
      return this.isAgent ? this.returnValue([errorMsg, {}]) : new Error(errorMsg);
    }
  }

  async generateFinetunedImage(imageData, requestApiKey) {
    if (!imageData.prompt) {
      throw new Error('Missing required field: prompt');
    }

    if (!imageData.finetune_id) {
      throw new Error(
        'Missing required field: finetune_id for finetuned generation. Please supply a finetune_id!',
      );
    }

    // Validate endpoint is appropriate for finetuned generation
    const validFinetunedEndpoints = ['/v1/flux-pro-finetuned', '/v1/flux-pro-1.1-ultra-finetuned'];
    const endpoint = imageData.endpoint || '/v1/flux-pro-finetuned';

    if (!validFinetunedEndpoints.includes(endpoint)) {
      throw new Error(
        `Invalid endpoint for finetuned generation. Must be one of: ${validFinetunedEndpoints.join(', ')}`,
      );
    }

    let payload = {
      prompt: imageData.prompt,
      prompt_upsampling: imageData.prompt_upsampling || false,
      safety_tolerance: imageData.safety_tolerance || 6,
      output_format: imageData.output_format || 'png',
      finetune_id: imageData.finetune_id,
      finetune_strength: imageData.finetune_strength || 1.0,
      guidance: imageData.guidance || 2.5,
    };

    // Add optional parameters if provided
    if (imageData.width) {
      payload.width = Number(imageData.width);
    }
    if (imageData.height) {
      payload.height = Number(imageData.height);
    }
    if (imageData.steps) {
      payload.steps = imageData.steps;
    }
    if (imageData.seed !== undefined) {
      payload.seed = imageData.seed;
    }
    if (imageData.raw) {
      payload.raw = imageData.raw;
    }

    const generateUrl = `${this.baseUrl}${endpoint}`;
    const resultUrl = `${this.baseUrl}/v1/get_result`;

    logger.debug('[FluxAPI] Generating finetuned image with payload:', payload);
    logger.debug('[FluxAPI] Using endpoint:', generateUrl);

    let taskResponse;
    try {
      taskResponse = await axios.post(generateUrl, payload, {
        headers: {
          'x-key': requestApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...this.getAxiosConfig(),
      });
    } catch (error) {
      const details = this.getDetails(error?.response?.data || error.message);
      logger.error('[FluxAPI] Error while submitting finetuned task:', details);
      return this.returnValue(
        `Something went wrong when trying to generate the finetuned image. The Flux API may be unavailable:
        Error Message: ${details}`,
      );
    }

    const taskId = taskResponse.data.id;
    const pollingUrl = taskResponse.data.polling_url || `${resultUrl}?id=${taskId}`;

    // Polling for the result
    let status = 'Pending';
    let resultData = null;
    const TERMINAL_FT_STATUSES = new Set([
      'Ready',
      'Error',
      'Content Moderated',
      'Request Moderated',
      'Task not found',
      'Failed',
    ]);
    while (!TERMINAL_FT_STATUSES.has(status)) {
      try {
        // Wait 2 seconds between polls
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const resultResponse = await axios.get(pollingUrl, {
          headers: {
            'x-key': requestApiKey,
            Accept: 'application/json',
          },
          ...this.getAxiosConfig(),
        });
        status = resultResponse.data.status;

        if (status === 'Ready') {
          resultData = resultResponse.data.result;
          break;
        } else if (status === 'Content Moderated' || status === 'Request Moderated') {
          logger.warn(`[FluxAPI] ${status} (finetuned): prompt afvist af content filter`);
          return this.returnValue(
            'The prompt was rejected by the image-generation provider (content moderation). Please try a different prompt.',
          );
        } else if (TERMINAL_FT_STATUSES.has(status)) {
          logger.error('[FluxAPI] Terminal failure status (finetuned):', status, resultResponse.data);
          return this.returnValue(`Finetuned image generation failed: ${status}.`);
        }
      } catch (error) {
        const details = this.getDetails(error?.response?.data || error.message);
        logger.error('[FluxAPI] Error while getting finetuned result:', details);
        return this.returnValue('An error occurred while retrieving the finetuned image.');
      }
    }

    // If no result data
    if (!resultData || !resultData.sample) {
      logger.error('[FluxAPI] No image data received from API. Response:', resultData);
      return this.returnValue('No image data received from Flux API.');
    }

    const imageUrl = resultData.sample;
    const imageName = `img-${uuidv4()}.png`;

    if (this.isAgent) {
      try {
        const fetchOptions = {};
        const agent = getHttpsProxyAgent(imageUrl);
        if (agent) {
          fetchOptions.agent = agent;
        }
        const imageResponse = await fetch(imageUrl, fetchOptions);
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const content = [
          {
            type: ContentTypes.IMAGE_URL,
            image_url: {
              url: `data:image/png;base64,${base64}`,
            },
          },
        ];

        const response = [
          {
            type: ContentTypes.TEXT,
            text: displayMessage,
          },
        ];
        return [response, { content }];
      } catch (error) {
        logger.error('[FluxAPI] Error processing finetuned image for agent:', error);
        return this.returnValue(`Failed to process the finetuned image. ${error.message}`);
      }
    }

    try {
      logger.debug('[FluxAPI] Saving finetuned image:', imageUrl);
      const result = await this.processFileURL({
        fileStrategy: this.fileStrategy,
        userId: this.userId,
        URL: imageUrl,
        fileName: imageName,
        basePath: 'images',
        context: FileContext.image_generation,
        tenantId: this.tenantId,
        req: this.retentionRequest,
      });

      logger.debug('[FluxAPI] Finetuned image saved to path:', result.filepath);

      this.result = this.returnMetadata ? result : this.wrapInMarkdown(result.filepath);
      return this.returnValue(this.result);
    } catch (error) {
      const details = this.getDetails(error?.message ?? 'No additional error details.');
      logger.error('Error while saving the finetuned image:', details);
      return this.returnValue(`Failed to save the finetuned image locally. ${details}`);
    }
  }
}

module.exports = FluxAPI;
