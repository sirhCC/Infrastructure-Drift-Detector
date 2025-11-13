import { Command } from 'commander';
import { DashboardServer } from '../../web/server';

export function createDashboardCommand(): Command {
  const command = new Command('dashboard');

  command
    .description('Start the web dashboard server')
    .option('-p, --port <port>', 'Server port', '3001')
    .option('-h, --host <host>', 'Server host', '0.0.0.0')
    .option('--cors <origins>', 'CORS origins (comma-separated)', 'http://localhost:3000')
    .option('--api-prefix <prefix>', 'API route prefix', '/api')
    .action(async (options) => {
      try {
        const server = new DashboardServer({
          port: Number(options.port),
          host: options.host,
          corsOrigins: options.cors.split(','),
          apiPrefix: options.apiPrefix,
        });

        console.log('🚀 Starting Infrastructure Drift Detector Dashboard...\n');
        console.log(`   Port: ${options.port}`);
        console.log(`   Host: ${options.host}`);
        console.log(`   CORS: ${options.cors}`);
        console.log(`   API Prefix: ${options.apiPrefix}\n`);

        server.start();

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log('\n\n👋 Shutting down dashboard server...');
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          console.log('\n\n👋 Shutting down dashboard server...');
          process.exit(0);
        });
      } catch (error) {
        console.error('❌ Failed to start dashboard server:', error);
        process.exit(1);
      }
    });

  return command;
}
