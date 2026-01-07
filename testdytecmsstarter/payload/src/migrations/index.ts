import * as migration_20260107_133002 from './20260107_133002';

export const migrations = [
  {
    up: migration_20260107_133002.up,
    down: migration_20260107_133002.down,
    name: '20260107_133002'
  },
];
