import mongoose from 'mongoose';
import { logger } from '@librechat/data-schemas';

const modelOverrideSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  disabledModels: { type: [String], default: [] },
}, { timestamps: true });

function getModelOverrideModel() {
  return mongoose.models.ModelOverride || mongoose.model('ModelOverride', modelOverrideSchema);
}

export async function getModelOverrides(): Promise<Array<{ endpoint: string; disabledModels: string[] }>> {
  const ModelOverride = getModelOverrideModel();
  const results = await ModelOverride.find({}).lean().exec();
  return results as unknown as Array<{ endpoint: string; disabledModels: string[] }>;
}

export async function getDisabledModelsMap(): Promise<Record<string, Set<string>>> {
  const overrides = await getModelOverrides();
  const map: Record<string, Set<string>> = {};
  for (const override of overrides) {
    map[override.endpoint] = new Set(override.disabledModels);
  }
  return map;
}

export async function setDisabledModels(endpoint: string, disabledModels: string[]): Promise<void> {
  const ModelOverride = getModelOverrideModel();
  await ModelOverride.findOneAndUpdate(
    { endpoint },
    { $set: { disabledModels } },
    { upsert: true },
  );
  logger.info(`[Admin] Model overrides updated for endpoint: ${endpoint}`);
}

export async function toggleModel(endpoint: string, model: string, disabled: boolean): Promise<string[]> {
  const ModelOverride = getModelOverrideModel();
  const existing = await ModelOverride.findOne({ endpoint }).lean() as { disabledModels?: string[] } | null;
  const currentDisabled = new Set(existing?.disabledModels ?? []);

  if (disabled) {
    currentDisabled.add(model);
  } else {
    currentDisabled.delete(model);
  }

  const disabledModels = [...currentDisabled];
  await ModelOverride.findOneAndUpdate(
    { endpoint },
    { $set: { disabledModels } },
    { upsert: true },
  );

  return disabledModels;
}
