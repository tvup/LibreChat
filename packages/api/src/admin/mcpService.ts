import mongoose from 'mongoose';

import type { MCPOptions } from 'librechat-data-provider';
import { MCPServersRegistry } from '~/mcp/registry/MCPServersRegistry';

export type MCPServerSource = 'db' | 'yaml';

export interface MCPServerResult {
  _id: string;
  name: string;
  url?: string;
  type?: string;
  tools?: string[];
  source: MCPServerSource;
  createdAt?: string;
  updatedAt?: string;
}

export interface MCPStatsResult {
  totalServers: number;
  serversByType: Array<{ type: string; count: number }>;
}

/**
 * MCP servers defined statically in `librechat.yaml` are not stored in the
 * database — they live in `appConfig.mcpConfig`. To surface them in admin
 * views alongside DB-managed servers, callers should pass the yaml config
 * map; entries are merged with `source: 'yaml'`. DB entries always win on
 * name collision, mirroring runtime override semantics.
 */
type YamlMCPMap = Record<string, MCPOptions> | null | undefined;

function getServerType(config: MCPOptions): string {
  if ('command' in config) {
    return 'stdio';
  }
  if ('url' in config) {
    const url = config.url as string;
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return 'websocket';
    }
    return 'sse';
  }
  return 'unknown';
}

function getServerUrl(config: MCPOptions): string | undefined {
  if ('url' in config) {
    return config.url as string;
  }
  if ('command' in config) {
    return (config as { command: string }).command;
  }
  return undefined;
}

export async function listMCPServers(yamlConfig?: YamlMCPMap): Promise<MCPServerResult[]> {
  const MCPServer = mongoose.models.MCPServer;
  const dbServers = MCPServer
    ? ((await MCPServer.find()
        .sort({ updatedAt: -1 })
        .lean()
        .exec()) as unknown as Array<{
        _id: string;
        serverName: string;
        config: MCPOptions & { tools?: Array<{ name: string }> };
        createdAt?: string;
        updatedAt?: string;
      }>)
    : [];

  const dbResults: MCPServerResult[] = dbServers.map((server) => {
    const config = server.config;
    const tools: string[] = [];
    if (config && Array.isArray(config.tools)) {
      for (const tool of config.tools) {
        if (tool && typeof tool.name === 'string') {
          tools.push(tool.name);
        }
      }
    }
    return {
      _id: String(server._id),
      name: server.serverName,
      url: getServerUrl(config),
      type: getServerType(config),
      tools,
      source: 'db',
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  });

  if (!yamlConfig) {
    return dbResults;
  }

  // Pull live tool lists from the registry so admin sees what each YAML
  // server actually exposes after inspection.  Falls back to empty when
  // the registry hasn't initialized yet (e.g. early in api startup).
  const registryConfigs = await getRegistryConfigsSafe();

  const dbNames = new Set(dbResults.map((s) => s.name));
  const yamlResults: MCPServerResult[] = [];
  for (const [name, config] of Object.entries(yamlConfig)) {
    if (dbNames.has(name)) {
      continue;
    }
    const liveTools = parseRegistryTools(registryConfigs[name]?.tools);
    yamlResults.push({
      _id: `yaml:${name}`,
      name,
      url: getServerUrl(config),
      type: getServerType(config),
      tools: liveTools,
      source: 'yaml',
    });
  }

  return [...dbResults, ...yamlResults];
}

async function getRegistryConfigsSafe(): Promise<Record<string, { tools?: string }>> {
  try {
    const registry = MCPServersRegistry.getInstance();
    return (await registry.getAllServerConfigs()) as unknown as Record<string, { tools?: string }>;
  } catch {
    return {};
  }
}

/**
 * Force a re-inspection of an MCP server (admin action).
 *
 * Tries CACHE storage first (yaml/config-sourced servers), then DB storage
 * (user-created servers). If the server isn't found in either, throws.
 */
export async function reinitializeMCPServer(
  serverName: string,
  userId?: string,
): Promise<{ serverName: string; tools: string[] }> {
  const registry = MCPServersRegistry.getInstance();

  let result;
  try {
    result = await registry.reinspectServer(serverName, 'CACHE', undefined, true);
  } catch (cacheErr) {
    const cacheMessage = (cacheErr as Error).message;
    const notInCache = cacheMessage.includes('not found in CACHE');
    if (!notInCache) {
      throw cacheErr;
    }
    result = await registry.reinspectServer(serverName, 'DB', userId, true);
  }

  const toolsField = (result.config as { tools?: string }).tools;
  const tools = toolsField
    ? toolsField
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];
  return { serverName: result.serverName, tools };
}

function parseRegistryTools(toolsField?: string): string[] {
  if (!toolsField) {
    return [];
  }
  return toolsField
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function getMCPServerStats(yamlConfig?: YamlMCPMap): Promise<MCPStatsResult> {
  const MCPServer = mongoose.models.MCPServer;
  const dbServers = MCPServer
    ? ((await MCPServer.find().lean().exec()) as unknown as Array<{
        serverName: string;
        config: MCPOptions;
      }>)
    : [];

  const typeCounts = new Map<string, number>();
  const seenNames = new Set<string>();

  for (const server of dbServers) {
    seenNames.add(server.serverName);
    const type = getServerType(server.config);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  let totalServers = dbServers.length;
  if (yamlConfig) {
    for (const [name, config] of Object.entries(yamlConfig)) {
      if (seenNames.has(name)) {
        continue;
      }
      totalServers += 1;
      const type = getServerType(config);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }
  }

  const serversByType: Array<{ type: string; count: number }> = [];
  for (const [type, count] of typeCounts) {
    serversByType.push({ type, count });
  }
  serversByType.sort((a, b) => b.count - a.count);

  return {
    totalServers,
    serversByType,
  };
}
