export type ContainerStatus = 'running' | 'stopped' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead' | 'created';

export interface DockerContainer {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly status: ContainerStatus;
  readonly ports: readonly PortMapping[];
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly networkMode: string;
}

export interface PortMapping {
  readonly hostPort: number;
  readonly containerPort: number;
  readonly protocol: 'tcp' | 'udp';
}

export interface ContainerMetrics {
  readonly containerId: string;
  readonly cpuPercent: number;
  readonly memoryUsageMb: number;
  readonly memoryLimitMb: number;
  readonly networkRxBytes: number;
  readonly networkTxBytes: number;
  readonly blockReadBytes: number;
  readonly blockWriteBytes: number;
  readonly timestamp: string;
}

export interface ContainerLog {
  readonly stream: 'stdout' | 'stderr';
  readonly line: string;
  readonly timestamp: string;
}

export interface DockerImage {
  readonly id: string;
  readonly tags: readonly string[];
  readonly sizeMb: number;
  readonly createdAt: string;
}

export interface DeployContainerDto {
  readonly name: string;
  readonly image: string;
  readonly ports?: readonly PortMapping[];
  readonly env?: Readonly<Record<string, string>>;
  readonly volumes?: readonly string[];
  readonly networkMode?: string;
  readonly restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  readonly labels?: Readonly<Record<string, string>>;
}
