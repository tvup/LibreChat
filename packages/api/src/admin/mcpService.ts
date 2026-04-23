import mongoose from 'mongoose';

import type { MCPOptions } from 'librechat-data-provider';

export interface MCPServerResult {
  _id: string;
  name: string;
  url?: string;
  type?: string;
  tools?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MCPStatsResult {
  totalServers: number;
  serversByType: Array<{ type: string; count: number }>;
}

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

export async function listMCPServers(): Promise<MCPServerResult[]> {
  const MCPServer = mongoose.models.MCPServer;
  if (!MCPServer) {
    return [];
  }

  const servers = await MCPServer.find()
    .sort({ updatedAt: -1 })
    .lean()
    .exec() as unknown as Array<{
    _id: string;
    serverName: string;
    config: MCPOptions & { tools?: Array<{ name: string }> };
    createdAt?: string;
    updatedAt?: string;
  }>;

  return servers.map((server) => {
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
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  });
}

export async function getMCPServerStats(): Promise<MCPStatsResult> {
  const MCPServer = mongoose.models.MCPServer;
  if (!MCPServer) {
    return { totalServers: 0, serversByType: [] };
  }

  const servers = await MCPServer.find()
    .lean()
    .exec() as unknown as Array<{ config: MCPOptions }>;

  const typeCounts = new Map<string, number>();
  for (const server of servers) {
    const type = getServerType(server.config);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const serversByType: Array<{ type: string; count: number }> = [];
  for (const [type, count] of typeCounts) {
    serversByType.push({ type, count });
  }
  serversByType.sort((a, b) => b.count - a.count);

  return {
    totalServers: servers.length,
    serversByType,
  };
}
