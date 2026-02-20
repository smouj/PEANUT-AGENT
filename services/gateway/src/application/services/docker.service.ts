import { exec } from 'child_process';
import { promisify } from 'util';
import { AuditService } from './audit.service.js';
import { ExternalServiceError, NotFoundError } from '../../domain/errors.js';
import type { DockerContainer, ContainerMetrics, ContainerLog, DockerImage, DeployContainerDto } from '@peanut/shared-types';

const execAsync = promisify(exec);

export class DockerService {
  constructor(private readonly audit: AuditService) {}

  async listContainers(all = false): Promise<DockerContainer[]> {
    try {
      const format = '{{json .}}';
      const { stdout } = await execAsync(
        `docker ps ${all ? '-a' : ''} --format '${format}' --no-trunc`,
      );
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const raw = JSON.parse(line) as {
            ID: string; Names: string; Image: string; Status: string;
            Ports: string; CreatedAt: string; Labels: string;
          };
          return this.parseContainer(raw);
        });
    } catch (error) {
      throw new ExternalServiceError('Docker', String(error));
    }
  }

  async getContainerMetrics(containerId: string): Promise<ContainerMetrics> {
    try {
      const { stdout } = await execAsync(
        `docker stats ${containerId} --no-stream --format '{{json .}}'`,
      );
      const raw = JSON.parse(stdout.trim()) as {
        CPUPerc: string; MemUsage: string; NetIO: string; BlockIO: string;
      };
      return this.parseMetrics(containerId, raw);
    } catch (error) {
      throw new ExternalServiceError('Docker', `Failed to get metrics: ${String(error)}`);
    }
  }

  async getContainerLogs(containerId: string, tail = 100): Promise<ContainerLog[]> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker logs --tail ${tail} --timestamps ${containerId} 2>&1`,
      );
      const combined = (stdout + stderr).trim();
      return combined
        .split('\n')
        .filter(Boolean)
        .map(line => {
          const match = /^(\S+)\s+(.+)$/.exec(line);
          return {
            stream: 'stdout' as const,
            timestamp: match?.[1] ?? new Date().toISOString(),
            line: match?.[2] ?? line,
          };
        });
    } catch (error) {
      throw new ExternalServiceError('Docker', `Failed to get logs: ${String(error)}`);
    }
  }

  async startContainer(containerId: string, actorId: string, actorEmail: string): Promise<void> {
    await this.runDockerCommand(`docker start ${containerId}`);
    await this.audit.log({
      action: 'docker.container_started',
      userId: actorId, userEmail: actorEmail, ipAddress: 'internal', userAgent: 'system',
      resourceType: 'container', resourceId: containerId, details: {},
    });
  }

  async stopContainer(containerId: string, actorId: string, actorEmail: string): Promise<void> {
    await this.runDockerCommand(`docker stop ${containerId}`);
    await this.audit.log({
      action: 'docker.container_stopped',
      userId: actorId, userEmail: actorEmail, ipAddress: 'internal', userAgent: 'system',
      resourceType: 'container', resourceId: containerId, details: {},
    });
  }

  async removeContainer(containerId: string, actorId: string, actorEmail: string): Promise<void> {
    await this.runDockerCommand(`docker rm -f ${containerId}`);
    await this.audit.log({
      action: 'docker.container_deleted',
      userId: actorId, userEmail: actorEmail, ipAddress: 'internal', userAgent: 'system',
      resourceType: 'container', resourceId: containerId, details: {},
    });
  }

  async deployContainer(dto: DeployContainerDto, actorId: string, actorEmail: string): Promise<DockerContainer> {
    // Validate image name to prevent injection
    if (!/^[a-zA-Z0-9/_:.-]+$/.test(dto.image)) {
      throw new ExternalServiceError('Docker', 'Invalid image name');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(dto.name)) {
      throw new ExternalServiceError('Docker', 'Invalid container name');
    }

    const envArgs = Object.entries(dto.env ?? {})
      .map(([k, v]) => `-e "${k.replace(/"/g, '')}=${v.replace(/"/g, '')}"`)
      .join(' ');

    const portArgs = (dto.ports ?? [])
      .map(p => `-p ${p.hostPort}:${p.containerPort}/${p.protocol}`)
      .join(' ');

    const volumeArgs = (dto.volumes ?? [])
      .map(v => `-v "${v.replace(/"/g, '')}"`)
      .join(' ');

    const restartPolicy = dto.restartPolicy ?? 'unless-stopped';
    const networkMode = dto.networkMode ? `--network ${dto.networkMode}` : '';

    const cmd = [
      'docker run -d',
      `--name ${dto.name}`,
      `--restart ${restartPolicy}`,
      networkMode,
      portArgs,
      envArgs,
      volumeArgs,
      dto.image,
    ].filter(Boolean).join(' ');

    const { stdout } = await this.runDockerCommand(cmd);
    const containerId = stdout.trim();

    await this.audit.log({
      action: 'docker.container_started',
      userId: actorId, userEmail: actorEmail, ipAddress: 'internal', userAgent: 'system',
      resourceType: 'container', resourceId: containerId,
      details: { name: dto.name, image: dto.image },
    });

    const containers = await this.listContainers();
    const container = containers.find(c => c.id.startsWith(containerId.slice(0, 12)));
    if (!container) throw new NotFoundError('Container', containerId);
    return container;
  }

  async listImages(): Promise<DockerImage[]> {
    const { stdout } = await execAsync(
      `docker images --format '{{json .}}' --no-trunc`,
    );
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const raw = JSON.parse(line) as { ID: string; Repository: string; Tag: string; Size: string; CreatedAt: string };
      const tag = raw.Tag === '<none>' ? '' : `:${raw.Tag}`;
      const sizeMb = parseFloat(raw.Size) * (raw.Size.includes('GB') ? 1024 : 1);
      return {
        id: raw.ID,
        tags: [`${raw.Repository}${tag}`],
        sizeMb,
        createdAt: raw.CreatedAt,
      };
    });
  }

  private async runDockerCommand(cmd: string): Promise<{ stdout: string; stderr: string }> {
    try {
      return await execAsync(cmd);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new ExternalServiceError('Docker', msg);
    }
  }

  private parseContainer(raw: {
    ID: string; Names: string; Image: string; Status: string;
    Ports: string; CreatedAt: string; Labels: string;
  }): DockerContainer {
    const statusMap: Record<string, import('@peanut/shared-types').ContainerStatus> = {
      'Up': 'running', 'Exited': 'exited', 'Paused': 'paused',
      'Created': 'created', 'Restarting': 'restarting',
    };
    const statusKey = Object.keys(statusMap).find(k => raw.Status.startsWith(k)) ?? 'exited';
    const status = statusMap[statusKey] ?? 'exited';

    const labels: Record<string, string> = {};
    if (raw.Labels) {
      raw.Labels.split(',').forEach(l => {
        const [k, v] = l.split('=');
        if (k) labels[k] = v ?? '';
      });
    }

    return {
      id: raw.ID,
      name: raw.Names.replace(/^\//, ''),
      image: raw.Image,
      status,
      ports: [],
      createdAt: raw.CreatedAt,
      labels,
      networkMode: 'bridge',
    };
  }

  private parseMetrics(containerId: string, raw: {
    CPUPerc: string; MemUsage: string; NetIO: string; BlockIO: string;
  }): ContainerMetrics {
    const cpuPercent = parseFloat(raw.CPUPerc.replace('%', '')) || 0;
    const [memUsed, memLimit] = raw.MemUsage.split(' / ').map(s => parseFloat(s) || 0);
    const [netRx, netTx] = raw.NetIO.split(' / ').map(s => parseFloat(s) * 1024 || 0);
    const [blkRead, blkWrite] = raw.BlockIO.split(' / ').map(s => parseFloat(s) * 1024 || 0);

    return {
      containerId,
      cpuPercent,
      memoryUsageMb: memUsed ?? 0,
      memoryLimitMb: memLimit ?? 0,
      networkRxBytes: netRx ?? 0,
      networkTxBytes: netTx ?? 0,
      blockReadBytes: blkRead ?? 0,
      blockWriteBytes: blkWrite ?? 0,
      timestamp: new Date().toISOString(),
    };
  }
}
