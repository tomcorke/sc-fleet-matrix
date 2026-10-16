import { loadData } from '../data';
import { ShipMatrix } from './ship-matrix/ship-matrix';

const data = loadData();

export const App = () => (
  <div>
    <h1>Star Citizen Fleet Matrix</h1>
    <div>
      <ShipMatrix data={data} />
    </div>
  </div>
);
