import * as migration_20261129_010000_soft_hero from './20261129_010000_soft_hero';
import * as migration_20261129_000000_new_faces from './20261129_000000_new_faces';
import * as migration_20261115_104003_initial from './20261115_104003_initial';
import * as migration_20261124_233953_integrations from './20261124_233953_integrations';
import * as migration_20261124_234805_analytics from './20261124_234805_analytics';
import * as migration_20261125_000004_seo_fields from './20261125_000004_seo_fields';
import * as migration_20261125_001753_telegram_bot from './20261125_001753_telegram_bot';
import * as migration_20261128_170424_admin_launch_tools from './20261128_170424_admin_launch_tools';

export const migrations = [
  {
    up: migration_20261115_104003_initial.up,
    down: migration_20261115_104003_initial.down,
    name: '20261115_104003_initial',
  },
  {
    up: migration_20261124_233953_integrations.up,
    down: migration_20261124_233953_integrations.down,
    name: '20261124_233953_integrations',
  },
  {
    up: migration_20261124_234805_analytics.up,
    down: migration_20261124_234805_analytics.down,
    name: '20261124_234805_analytics',
  },
  {
    up: migration_20261125_000004_seo_fields.up,
    down: migration_20261125_000004_seo_fields.down,
    name: '20261125_000004_seo_fields',
  },
  {
    up: migration_20261125_001753_telegram_bot.up,
    down: migration_20261125_001753_telegram_bot.down,
    name: '20261125_001753_telegram_bot',
  },
  {
    up: migration_20261128_170424_admin_launch_tools.up,
    down: migration_20261128_170424_admin_launch_tools.down,
    name: '20261128_170424_admin_launch_tools'
  },
  {
    up: migration_20261129_000000_new_faces.up,
    down: migration_20261129_000000_new_faces.down,
    name: '20261129_000000_new_faces'
  },
  {
    up: migration_20261129_010000_soft_hero.up,
    down: migration_20261129_010000_soft_hero.down,
    name: '20261129_010000_soft_hero'
  },
];
