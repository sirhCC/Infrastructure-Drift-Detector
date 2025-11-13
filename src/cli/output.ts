import chalk from 'chalk';
import * as ora from 'ora';

/**
 * CLI output utilities
 */
export class Output {
  
  /**
   * Chalk colors for custom styling
   */
  static colors = {
    red: chalk.red,
    green: chalk.green,
    yellow: chalk.yellow,
    blue: chalk.blue,
    cyan: chalk.cyan,
    gray: chalk.gray,
    dim: chalk.dim,
    bold: chalk.bold
  };
  
  /**
   * Print success message
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Print error message
   */
  static error(message: string, error?: any): void {
    console.error(chalk.red('✗'), message);
    if (error) {
      console.error(chalk.gray(error.message || error));
    }
  }

  /**
   * Print warning message
   */
  static warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Print info message
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Print section header
   */
  static header(title: string): void {
    console.log();
    console.log(chalk.bold.cyan(`=== ${title} ===`));
    console.log();
  }

  /**
   * Print table-like output
   */
  static table(data: Array<{ label: string; value: any }>): void {
    const maxLabelLength = Math.max(...data.map(d => d.label.length));
    
    data.forEach(({ label, value }) => {
      const padding = ' '.repeat(maxLabelLength - label.length + 2);
      console.log(`  ${chalk.gray(label)}${padding}${value}`);
    });
  }

  /**
   * Create a spinner
   */
  static spinner(text: string): any {
    return ora.default(text);
  }

  /**
   * Print drift result with severity color
   */
  static driftResult(result: any): void {
    const severityColors: Record<string, any> = {
      critical: chalk.red,
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.blue
    };

    const color = severityColors[result.severity] || chalk.white;
    const icon = result.hasDrift ? '⚠' : '✓';
    
    console.log(
      `  ${color(icon)} ${result.resourceName} ${chalk.gray(`(${result.resourceId})`)}`
    );
    
    if (result.hasDrift && result.driftedProperties.length > 0) {
      console.log(chalk.gray(`    Severity: ${result.severity.toUpperCase()}`));
      console.log(chalk.gray(`    Drifted properties: ${result.driftedProperties.length}`));
    }
  }

  /**
   * Print progress bar
   */
  static progress(current: number, total: number, label?: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    const text = label ? `${label}: ` : '';
    process.stdout.write(`\r  ${text}${bar} ${percentage}% (${current}/${total})`);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Clear line (for progress updates)
   */
  static clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }
}
