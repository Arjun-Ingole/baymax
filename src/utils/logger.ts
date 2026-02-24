import chalk from 'chalk';

export const logger = {
  log: (msg: string) => console.log(msg),
  warn: (msg: string) => console.warn(chalk.yellow(msg)),
  error: (msg: string) => console.error(chalk.red(msg)),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  break: () => console.log(),
};
