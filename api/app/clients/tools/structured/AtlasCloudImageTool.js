const { Tool } = require('@langchain/core/tools');
const axios = require('axios');

class AtlasCloudImageTool extends Tool {
  constructor(fields) {
    super();
    this.name = 'atlas-cloud-image';
    this.apiKey = fields.ATLAS_CLOUD_API_KEY || process.env.ATLAS_CLOUD_API_KEY;
    this.baseURL = fields.ATLAS_CLOUD_BASE_URL || 'https://api.atlascloud.ai/v1';
    this.description = `Generate NSFW images using Atlas Cloud API. 
    Supports 15+ NSFW video models and 40+ image models.
    Use for artistic nude content with 3 women in natural settings.`;
  }

  async _call(input) {
    try {
      const prompt = this.extractPrompt(input);
      const response = await axios.post(
        `${this.baseURL}/generate/image`,
        {
          prompt: prompt,
          model: 'wan-2.2-spicy', // NSFW model
          size: '1024x1024',
          quality: 'high'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Return image URL or base64 data
      return `Image generated successfully: ${response.data.image_url}`;
    } catch (error) {
      return `Error generating image: ${error.message}`;
    }
  }

  extractPrompt(input) {
    // Extract prompt from user input
    return input;
  }
}

module.exports = AtlasCloudImageTool;
