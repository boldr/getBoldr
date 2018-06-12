import chalk from 'chalk';
import Table from 'cli-table3';

function flattenExplanation(basePath, target, ctx) {
  const isArray = typeof ctx.length === 'number';
  for (const key in ctx) {
    const pathKey = isArray ? `[${key}]` : (basePath && '.') + key;
    const currentPath = basePath + pathKey;
    if (
      ctx[key] &&
      typeof ctx[key] === 'object' &&
      (ctx[key].src === undefined || ctx[key].val === undefined)
    ) {
      flattenExplanation(currentPath, target, ctx[key]);
    } else {
      target[currentPath] = ctx[key];
    }
  }
  return target;
}

function displayConfig(applicationName, explanation) {
  const flattenedExplanation = flattenExplanation('', {}, explanation);

  const table = new Table({
    head: ['Key', 'Value', 'Source'],
    chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['white', 'bold'] },
  });

  for (const jsonPath in flattenedExplanation) {
    const valueExplaination = flattenedExplanation[jsonPath];
    let color;
    switch (valueExplaination.src) {
      case 'flag':
        color = 'magenta';
        break;
      case 'environment':
        color = 'green';
        break;
      case 'defaults':
        color = 'gray';
        break;
      default:
        color = 'cyan';
        break;
    }

    const { src } = valueExplaination;
    let { val } = valueExplaination;
    let valColor; // eslint-disable-line
    switch (typeof val) {
      case 'string':
        valColor = 'cyan';
        val = `"${val}"`;
        break;
      case 'number':
        valColor = 'green';
        break;
      case 'boolean':
        valColor = 'red';
        break;
      case 'object':
        valColor = 'yellow';
        break;
      default:
        valColor = 'white';
        break;
    }

    const row = {};
    row[jsonPath] = [chalk[valColor](val), chalk[color](src)];
    table.push(row);
  }

  const title = `Displaying config for ${applicationName}`;

  /* eslint-disable no-console */
  console.log();
  console.log(`  ${chalk.bold.underline(title)}`);
  console.log(table.toString());
  console.log();
  /* eslint-enable no-console */
}

export default displayConfig;
