import path from 'node:path';
import os from 'node:os';

export const resolveConfigPath = (rawPath: string, projectDir: string): string => {
  if (rawPath.startsWith('~')) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(projectDir, rawPath);
};
