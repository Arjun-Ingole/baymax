import fs from 'node:fs';
import TOML from '@iarna/toml';
import yaml from 'js-yaml';

export const safeReadJson = (filePath: string): unknown | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
};

export const safeReadToml = (filePath: string): unknown | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return TOML.parse(raw);
  } catch { return null; }
};

export const safeReadYaml = (filePath: string): unknown | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return yaml.load(raw);
  } catch { return null; }
};
