/**
 * Terraform module representation
 */
export interface TerraformModule {
  name: string;
  source: string;
  version?: string;
  variables: Record<string, any>;
  outputs?: string[];
}

/**
 * Module parser for Terraform
 */
export class ModuleParser {
  
  /**
   * Extract module calls from Terraform content
   */
  static extractModules(content: string): TerraformModule[] {
    const modules: TerraformModule[] = [];
    const moduleRegex = /module\s+"([^"]+)"\s*\{([\s\S]*?)\n\}/g;
    
    let match;
    while ((match = moduleRegex.exec(content)) !== null) {
      const [, name, body] = match;
      
      const sourceMatch = body.match(/source\s*=\s*"([^"]*)"/);
      const versionMatch = body.match(/version\s*=\s*"([^"]*)"/);
      
      const variables: Record<string, any> = {};
      
      // Extract all variables passed to the module
      const varRegex = /(\w+)\s*=\s*"([^"]*)"/g;
      let varMatch;
      
      while ((varMatch = varRegex.exec(body)) !== null) {
        const [, key, value] = varMatch;
        if (key !== 'source' && key !== 'version') {
          variables[key] = value;
        }
      }

      modules.push({
        name,
        source: sourceMatch ? sourceMatch[1] : '',
        version: versionMatch ? versionMatch[1] : undefined,
        variables
      });
    }

    return modules;
  }

  /**
   * Extract outputs from a module
   */
  static extractOutputs(content: string): string[] {
    const outputs: string[] = [];
    const outputRegex = /output\s+"([^"]+)"/g;
    
    let match;
    while ((match = outputRegex.exec(content)) !== null) {
      outputs.push(match[1]);
    }

    return outputs;
  }
}
