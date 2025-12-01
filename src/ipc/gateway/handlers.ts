/**
 * Gateway IPC Handlers
 * Provides ORPC handlers for controlling the API Gateway service
 */
import { gatewayInstance } from './server';
import { ConfigManager } from '../config/manager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Start the gateway server
 */
export const startGateway = async (port: number): Promise<boolean> => {
  try {
    if (gatewayInstance.isRunning()) {
      await gatewayInstance.stop();
    }
    await gatewayInstance.start(port);
    return true;
  } catch (e) {
    console.error('Failed to start gateway:', e);
    return false;
  }
};

/**
 * Stop the gateway server
 */
export const stopGateway = async (): Promise<boolean> => {
  try {
    await gatewayInstance.stop();
    return true;
  } catch (e) {
    console.error('Failed to stop gateway:', e);
    return false;
  }
};

/**
 * Get gateway status
 */
export const getGatewayStatus = async () => {
  return gatewayInstance.getStatus();
};

/**
 * Generate a new API key
 */
export const generateApiKey = async (): Promise<string> => {
  const newKey = `sk-${uuidv4().replace(/-/g, '')}`;

  // Save to config
  const config = ConfigManager.loadConfig();
  config.proxy.api_key = newKey;
  ConfigManager.saveConfig(config);

  return newKey;
};
