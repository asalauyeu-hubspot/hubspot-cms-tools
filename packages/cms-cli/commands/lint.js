const {
  lint,
  printHublValidationResult,
} = require('@hubspot/cms-lib/validate');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');

const { version } = require('../package.json');
const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { validatePortal } = require('../lib/validation');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'lint';
const DESCRIPTION = 'Lint a file or folder for HubL syntax';

const parseOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validatePortal(options)))) {
    process.exit(1);
  }
};

const action = async (args, options) => {
  const portalId = getPortalId(options);
  const localPath = resolveLocalPath(args.localPath);
  const groupName = `Linting "${localPath}"`;

  trackCommandUsage(COMMAND_NAME, {}, portalId);
  await parseOptions(options);

  logger.group(groupName);
  let count = 0;
  try {
    await lint(portalId, localPath, result => {
      count += printHublValidationResult(result);
    });
  } catch (err) {
    logger.groupEnd(groupName);
    logErrorInstance(err, { portalId });
    process.exit(1);
  }
  logger.groupEnd(groupName);
  logger.log(`${count} issues found`);
};

module.exports = {
  /**
   * Yargs
   */
  command: `${COMMAND_NAME} <path>`,
  describe: DESCRIPTION,
  builder: yargs => {
    addConfigOptions(yargs, true);
    addPortalOptions(yargs, true);
    addLoggerOptions(yargs, true);
    yargs.positional('path', {
      describe: 'Local folder to lint',
      type: 'string',
    });
    return yargs;
  },
  handler: async argv => action({ localPath: argv.path }, argv),
  /**
   * Commander
   */
  configureLintCommand: commander => {
    commander
      .version(version)
      .description(DESCRIPTION)
      .arguments('<path>')
      .action(async (localPath, command = {}) =>
        action({ localPath }, command)
      );

    addConfigOptions(commander);
    addPortalOptions(commander);
    addLoggerOptions(commander);
    addHelpUsageTracking(commander, COMMAND_NAME);
  },
};
