import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DriftDetector } from '../detector';
import { TerraformParser } from '../parsers/terraform';
import { PulumiParser } from '../parsers/pulumi';
import { StateManager } from '../state/manager';
import { DriftHistoryStore, DriftScanRecord } from '../reporting/history';
import { ConfigLoader } from '../config';
import { TerraformStateParser } from '../state/parser';
import type { DriftResult, Resource } from '../types';

export interface DashboardConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  apiPrefix: string;
}

export interface ScanRequest {
  projectId: string;
  projectName: string;
  iacPath: string;
  iacType: 'terraform' | 'pulumi';
  configPath?: string;
  statePath?: string;
  stateBackend?: 's3' | 'azure' | 'gcs';
  stateBucket?: string;
  stateKey?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  iacType: 'terraform' | 'pulumi';
  lastScan?: Date;
  driftCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

export class DashboardServer {
  private app: Express;
  private config: DashboardConfig;
  private history: DriftHistoryStore;
  private projects: Map<string, ProjectInfo>;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      port: config.port || 3001,
      host: config.host || '0.0.0.0',
      corsOrigins: config.corsOrigins || ['http://localhost:3000'],
      apiPrefix: config.apiPrefix || '/api',
    };

    this.app = express();
    this.history = new DriftHistoryStore('./drift-history');
    this.projects = new Map();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  private setupRoutes(): void {
    const api = this.config.apiPrefix;

    // Health check
    this.app.get(`${api}/health`, this.handleHealth.bind(this));

    // Projects
    this.app.get(`${api}/projects`, this.handleGetProjects.bind(this));
    this.app.get(`${api}/projects/:id`, this.handleGetProject.bind(this));
    this.app.post(`${api}/projects`, this.handleCreateProject.bind(this));
    this.app.delete(`${api}/projects/:id`, this.handleDeleteProject.bind(this));

    // Scanning
    this.app.post(`${api}/scan`, this.handleScan.bind(this));
    this.app.get(`${api}/scan/:scanId`, this.handleGetScan.bind(this));
    this.app.get(`${api}/scans`, this.handleGetScans.bind(this));

    // History
    this.app.get(`${api}/history/:projectId`, this.handleGetHistory.bind(this));
    this.app.get(`${api}/history/:projectId/stats`, this.handleGetStats.bind(this));
    this.app.get(`${api}/history/:projectId/trends`, this.handleGetTrends.bind(this));

    // Resources
    this.app.get(`${api}/resources/:projectId`, this.handleGetResources.bind(this));
    this.app.get(`${api}/resources/:projectId/:resourceId`, this.handleGetResource.bind(this));

    // Real-time (for future WebSocket support)
    this.app.get(`${api}/stream`, this.handleStream.bind(this));
  }

  // Health check
  private handleHealth(req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  // Get all projects
  private handleGetProjects(req: Request, res: Response): void {
    const projects = Array.from(this.projects.values());
    res.json({ projects });
  }

  // Get single project
  private handleGetProject(req: Request, res: Response): void {
    const { id } = req.params;
    const project = this.projects.get(id);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  }

  // Create project
  private handleCreateProject(req: Request, res: Response): void {
    const { id, name, iacType } = req.body;

    if (!id || !name || !iacType) {
      res.status(400).json({ error: 'Missing required fields: id, name, iacType' });
      return;
    }

    if (this.projects.has(id)) {
      res.status(409).json({ error: 'Project already exists' });
      return;
    }

    const project: ProjectInfo = {
      id,
      name,
      iacType,
      driftCount: 0,
      status: 'healthy',
    };

    this.projects.set(id, project);
    res.status(201).json({ project });
  }

  // Delete project
  private handleDeleteProject(req: Request, res: Response): void {
    const { id } = req.params;

    if (!this.projects.has(id)) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    this.projects.delete(id);
    res.json({ success: true });
  }

  // Scan for drift
  private async handleScan(req: Request, res: Response): Promise<void> {
    try {
      const scanReq: ScanRequest = req.body;

      // Validate request
      if (!scanReq.projectId || !scanReq.iacPath || !scanReq.iacType) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Parse IaC
      let expectedResources: Resource[] = [];
      if (scanReq.iacType === 'terraform') {
        const parser = new TerraformParser();
        const result = parser.parse(scanReq.iacPath);
        expectedResources = result.resources;
      } else if (scanReq.iacType === 'pulumi') {
        const parser = new PulumiParser();
        const result = await parser.parse({ projectDir: scanReq.iacPath });
        // Convert Pulumi resources to generic Resource type
        expectedResources = result.resources.map(r => ({
          id: r.name,
          type: r.type as any, // Convert Pulumi type to generic type
          name: r.name,
          provider: 'aws' as any, // Use aws as default provider
          properties: r.properties,
        }));
      }

      // Load state if provided
      if (scanReq.statePath || scanReq.stateBackend) {
        const stateManager = new StateManager();

        const stateParser = new TerraformStateParser();
        
        if (scanReq.statePath) {
          const state = await stateManager.loadLocalState(scanReq.statePath);
          expectedResources = stateParser.extractResources(state);
        } else if (scanReq.stateBackend && scanReq.stateBucket && scanReq.stateKey) {
          // Build backend config
          const backendConfig: any = {
            type: scanReq.stateBackend,
            config: {
              bucket: scanReq.stateBucket,
              key: scanReq.stateKey,
              region: 'us-east-1',
            },
          };
          
          const state = await stateManager.loadRemoteState(backendConfig);
          expectedResources = stateParser.extractResources(state);
        } else {
          res.status(400).json({ error: 'Invalid state configuration' });
          return;
        }
      }

      // Load config
      let config: any = {};
      if (scanReq.configPath) {
        const configLoader = new ConfigLoader();
        config = configLoader.loadFromFile(scanReq.configPath);
      }

      // Create detector
      const detector = new DriftDetector({
        providers: config.providers || ['aws'],
        ignoreProperties: config.ignoreProperties,
      });

      // TODO: Fetch actual resources from cloud (placeholder)
      const actualResources: Resource[] = [];

      // Detect drift
      const driftResults = detector.detectDrift(expectedResources, actualResources);

      // Save to history
      const scanId = this.history.addScan({
        provider: config.providers?.[0] || 'aws',
        region: config.regions?.[0],
        totalResources: driftResults.length,
        driftedResources: driftResults.filter(r => r.hasDrift).length,
        severityCounts: {
          critical: driftResults.filter(r => r.severity === 'critical').length,
          high: driftResults.filter(r => r.severity === 'high').length,
          medium: driftResults.filter(r => r.severity === 'medium').length,
          low: driftResults.filter(r => r.severity === 'low').length,
        },
        results: driftResults,
        metadata: {
          terraformPath: scanReq.iacPath,
          configFile: scanReq.configPath,
        },
      });

      // Update project info
      const project = this.projects.get(scanReq.projectId);
      if (project) {
        project.lastScan = new Date();
        project.driftCount = driftResults.filter(r => r.hasDrift).length;
        project.status = this.calculateProjectStatus(driftResults);
      }

      res.json({
        scanId,
        projectId: scanReq.projectId,
        results: driftResults,
        summary: {
          total: driftResults.length,
          drifted: driftResults.filter(r => r.hasDrift).length,
          healthy: driftResults.filter(r => !r.hasDrift).length,
        },
      });
    } catch (error) {
      console.error('Scan error:', error);
      res.status(500).json({
        error: 'Scan failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Get scan results
  private handleGetScan(req: Request, res: Response): void {
    const { scanId } = req.params;
    const scan = this.history.getScanById(scanId);

    if (!scan) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    res.json({ scan });
  }

  // Get all scans
  private handleGetScans(req: Request, res: Response): void {
    const { limit = 10 } = req.query;
    const scans = this.history.getRecentScans(Number(limit));

    res.json({ scans });
  }

  // Get project history
  private handleGetHistory(req: Request, res: Response): void {
    const { projectId } = req.params;
    const { limit = 30 } = req.query;

    const scans = this.history.getRecentScans(Number(limit));
    res.json({ history: scans });
  }

  // Get project stats
  private handleGetStats(req: Request, res: Response): void {
    const { projectId } = req.params;
    const stats = this.history.getStatistics();

    res.json({ stats });
  }

  // Get trend data
  private handleGetTrends(req: Request, res: Response): void {
    const { projectId } = req.params;
    const { days = 30 } = req.query;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));

    const endDate = new Date();
    const scans = this.history.getScansByDateRange(cutoff, endDate);

    const trends = scans.map(scan => ({
      timestamp: scan.timestamp,
      driftCount: scan.driftedResources,
      totalResources: scan.totalResources,
      criticalCount: scan.severityCounts.critical,
      highCount: scan.severityCounts.high,
    }));

    res.json({ trends });
  }

  // Get resources
  private handleGetResources(req: Request, res: Response): void {
    const { projectId } = req.params;
    const scans = this.history.getRecentScans(1);

    if (scans.length === 0) {
      res.json({ resources: [] });
      return;
    }

    const latestScan = scans[0];
    res.json({ resources: latestScan.results });
  }

  // Get single resource
  private handleGetResource(req: Request, res: Response): void {
    const { projectId, resourceId } = req.params;
    const scans = this.history.getRecentScans(30);

    if (scans.length === 0) {
      res.status(404).json({ error: 'No scans found for project' });
      return;
    }

    const latestScan = scans[0];
    const resource = latestScan.results.find((r: DriftResult) => r.resourceName === resourceId);

    if (!resource) {
      res.status(404).json({ error: 'Resource not found' });
      return;
    }

    // Get resource history
    const history = scans.map(scan => {
      const r = scan.results.find((res: DriftResult) => res.resourceName === resourceId);
      return {
        timestamp: scan.timestamp,
        hasDrift: r?.hasDrift || false,
        driftCount: r?.driftedProperties?.length || 0,
      };
    });

    res.json({ resource, history });
  }

  // Stream endpoint (placeholder for WebSocket)
  private handleStream(req: Request, res: Response): void {
    res.json({
      message: 'WebSocket streaming not yet implemented',
      upgrade: 'Use WebSocket connection for real-time updates',
    });
  }

  private calculateProjectStatus(results: DriftResult[]): 'healthy' | 'warning' | 'critical' {
    const driftedCount = results.filter(r => r.hasDrift).length;
    const criticalCount = results.filter(r => r.hasDrift && r.severity === 'critical').length;

    if (criticalCount > 0) return 'critical';
    if (driftedCount > 5) return 'warning';
    return 'healthy';
  }

  public start(): void {
    this.app.listen(this.config.port, this.config.host, () => {
      console.log(`🌐 Dashboard API server running on http://${this.config.host}:${this.config.port}`);
      console.log(`📊 API endpoints available at ${this.config.apiPrefix}`);
    });
  }

  public getApp(): Express {
    return this.app;
  }
}

// CLI entry point
if (require.main === module) {
  const server = new DashboardServer({
    port: Number(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  });

  server.start();
}
