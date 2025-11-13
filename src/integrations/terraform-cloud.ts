import axios, { AxiosInstance } from 'axios';

export interface TerraformCloudConfig {
  token: string;
  organization: string;
  workspace?: string;
  apiUrl?: string;
}

export interface TerraformRun {
  id: string;
  status: string;
  createdAt: string;
  plan?: {
    resourceAdditions: number;
    resourceChanges: number;
    resourceDestructions: number;
  };
}

/**
 * Terraform Cloud/Enterprise Integration
 * Integrates drift detection with Terraform Cloud runs
 */
export class TerraformCloudClient {
  private config: TerraformCloudConfig & { apiUrl: string };
  private axios: AxiosInstance;

  constructor(config: TerraformCloudConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl || 'https://app.terraform.io/api/v2',
    };

    this.axios = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.config.token}`,
      },
    }) as AxiosInstance;
  }

  /**
   * Get workspace details
   */
  async getWorkspace(workspaceName?: string): Promise<any> {
    const workspace = workspaceName || this.config.workspace;
    if (!workspace) {
      throw new Error('Workspace name is required');
    }

    const response = await this.axios.get(
      `/organizations/${this.config.organization}/workspaces/${workspace}`
    );

    return response.data.data;
  }

  /**
   * Get latest run for workspace
   */
  async getLatestRun(workspaceName?: string): Promise<TerraformRun> {
    const workspace = await this.getWorkspace(workspaceName);
    const workspaceId = workspace.id;

    const response = await this.axios.get(`/workspaces/${workspaceId}/runs`, {
      params: {
        'page[size]': 1,
      },
    });

    const run = response.data.data[0];
    
    return {
      id: run.id,
      status: run.attributes.status,
      createdAt: run.attributes['created-at'],
      plan: run.relationships.plan?.data ? await this.getPlanDetails(run.relationships.plan.data.id) : undefined,
    };
  }

  /**
   * Get plan details
   */
  private async getPlanDetails(planId: string): Promise<any> {
    const response = await this.axios.get(`/plans/${planId}`);
    const plan = response.data.data.attributes;

    return {
      resourceAdditions: plan['resource-additions'],
      resourceChanges: plan['resource-changes'],
      resourceDestructions: plan['resource-destructions'],
    };
  }

  /**
   * Get current state
   */
  async getCurrentState(workspaceName?: string): Promise<any> {
    const workspace = await this.getWorkspace(workspaceName);
    const stateVersionId = workspace.relationships['current-state-version']?.data?.id;

    if (!stateVersionId) {
      throw new Error('No state version available');
    }

    const response = await this.axios.get(`/state-versions/${stateVersionId}`);
    const downloadUrl = response.data.data.attributes['hosted-state-download-url'];

    // Download state file
    const stateResponse = await axios.get(downloadUrl);
    return stateResponse.data;
  }

  /**
   * Create a run (trigger plan/apply)
   */
  async createRun(
    workspaceName: string,
    message: string,
    isDestroy: boolean = false
  ): Promise<string> {
    const workspace = await this.getWorkspace(workspaceName);

    const response = await this.axios.post('/runs', {
      data: {
        attributes: {
          'is-destroy': isDestroy,
          message,
        },
        type: 'runs',
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: workspace.id,
            },
          },
        },
      },
    });

    return response.data.data.id;
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<string> {
    const response = await this.axios.get(`/runs/${runId}`);
    return response.data.data.attributes.status;
  }

  /**
   * Apply a run
   */
  async applyRun(runId: string, comment?: string): Promise<void> {
    await this.axios.post(`/runs/${runId}/actions/apply`, {
      comment: comment || 'Applied via drift detector',
    });
  }

  /**
   * Discard a run
   */
  async discardRun(runId: string, comment?: string): Promise<void> {
    await this.axios.post(`/runs/${runId}/actions/discard`, {
      comment: comment || 'Discarded via drift detector',
    });
  }

  /**
   * Create notification for drift
   */
  async createNotificationConfig(
    workspaceName: string,
    webhookUrl: string
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceName);

    await this.axios.post('/notification-configurations', {
      data: {
        type: 'notification-configurations',
        attributes: {
          'destination-type': 'generic',
          enabled: true,
          name: 'Drift Detection Webhook',
          triggers: ['run:completed', 'run:errored'],
          url: webhookUrl,
        },
        relationships: {
          workspace: {
            data: {
              type: 'workspaces',
              id: workspace.id,
            },
          },
        },
      },
    });
  }

  /**
   * List all workspaces in organization
   */
  async listWorkspaces(): Promise<any[]> {
    const response = await this.axios.get(
      `/organizations/${this.config.organization}/workspaces`
    );

    return response.data.data.map((ws: any) => ({
      id: ws.id,
      name: ws.attributes.name,
      terraformVersion: ws.attributes['terraform-version'],
      locked: ws.attributes.locked,
    }));
  }

  /**
   * Get workspace variables
   */
  async getWorkspaceVariables(workspaceName?: string): Promise<any[]> {
    const workspace = await this.getWorkspace(workspaceName);

    const response = await this.axios.get(`/workspaces/${workspace.id}/vars`);

    return response.data.data.map((v: any) => ({
      id: v.id,
      key: v.attributes.key,
      value: v.attributes.value,
      category: v.attributes.category,
      sensitive: v.attributes.sensitive,
    }));
  }

  /**
   * Create or update workspace variable
   */
  async setWorkspaceVariable(
    workspaceName: string,
    key: string,
    value: string,
    sensitive: boolean = false,
    category: 'terraform' | 'env' = 'terraform'
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceName);
    const existingVars = await this.getWorkspaceVariables(workspaceName);
    const existingVar = existingVars.find(v => v.key === key);

    if (existingVar) {
      // Update existing
      await this.axios.patch(`/workspaces/${workspace.id}/vars/${existingVar.id}`, {
        data: {
          id: existingVar.id,
          type: 'vars',
          attributes: {
            key,
            value,
            sensitive,
            category,
          },
        },
      });
    } else {
      // Create new
      await this.axios.post(`/workspaces/${workspace.id}/vars`, {
        data: {
          type: 'vars',
          attributes: {
            key,
            value,
            sensitive,
            category,
          },
        },
      });
    }
  }
}
