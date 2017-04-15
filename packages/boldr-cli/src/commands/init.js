/* eslint-disable max-lines, max-statements, camelcase */

import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import shell from 'shelljs';
import chalk from 'chalk';
import appRootDir from 'app-root-dir';

import cliPkgJson from '../../package.json';
import spinner from '../util/spinner';
import handleErrors from '../util/handleErrors';
import ApiSetup from '../setup/Api';
import CmsSetup from '../setup/Cms';
import FullSetup from '../setup/Full';

async function getProjectType() {
  const answers = await inquirer.prompt({
    type: 'list',
    name: 'flavor',
    message: 'Choose a project type to scaffold.',
    choices: [
      {
        value: 'api',
        name: 'Boldr API (REST / DB)',
      },
      {
        value: 'cms',
        name: 'Boldr CMS (Frontend/SSR)',
      },
      {
        value: 'full',
        name: 'Boldr Fullstack',
      },
    ],
  });
  return answers.flavor;
}
async function getPackageManager() {
  const answers = await inquirer.prompt({
    type: 'list',
    name: 'packageManager',
    message: 'Somthing config.',
    choices: [
      {
        value: 'yarn',
        name: 'Yarn',
      },
      {
        value: 'npm',
        name: 'NPM',
      },
    ],
  });
  return answers.packageManager;
}

function getInstaller(flavor, opts) {
  switch (flavor) {
    case 'api':
      const apiSetup = new ApiSetup(opts);
      break;
    case 'cms':
      const cmsSetup = new CmsSetup(opts);
      break;
    case 'full':
      const fullSetup = new FullSetup(opts);
      break;
    default:
      console.log('Please choose an installer');
  }
}

async function task(args, options) {
  const boldr = {};
  boldr.flavor = args.flavor || (await getProjectType());
  boldr.packageManager = args.packageManager || (await getPackageManager());

  const opts = { packageManager: boldr.packageManager };
  const { flavor } = boldr;
  getInstaller(flavor, opts);
  // await config.save(process.cwd());

  console.log(chalk.green('👌  All set.'));
}

function register(program) {
  program.command('init', 'initialize a new Boldr project.').action(handleErrors(task));
}

export default { register };
