import * as migration_20261115_104003_initial from './20261115_104003_initial';

export const migrations = [
  {
    up: migration_20261115_104003_initial.up,
    down: migration_20261115_104003_initial.down,
    name: '20261115_104003_initial'
  },
];
