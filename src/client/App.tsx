import { useState } from 'react';

import { loadData } from '../data';
import { Planner } from './planner/planner';
import { ShipMatrix } from './ship-matrix/ship-matrix';

const { stats, ships } = loadData();

export const App = () => {
  const [planning, setPlanning] = useState(false);

  return planning ? (
    <Planner ships={ships} onClose={() => setPlanning(false)} />
  ) : (
    <ShipMatrix
      stats={stats}
      ships={ships}
      onOpenPlanner={() => setPlanning(true)}
    />
  );
};
