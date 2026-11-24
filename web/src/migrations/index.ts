import * as migration_20261115_104003_initial from './20261115_104003_initial';
import * as migration_20261124_233953_integrations from './20261124_233953_integrations';

export const migrations = [
  {
    up: migration_20261115_104003_initial.up,
    down: migration_20261115_104003_initial.down,
    name: '20261115_104003_initial',
  },
  {
    up: migration_20261124_233953_integrations.up,
    down: migration_20261124_233953_integrations.down,
    name: '20261124_233953_integrations'
  },
];
