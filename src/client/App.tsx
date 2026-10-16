import { loadData } from '../data';
import './App.scss';
import { ShipMatrix } from './ship-matrix/ship-matrix';

const data = loadData();

export const App = () => (
  <div>
    <div>Hello world</div>
    <div>
      <ShipMatrix data={data} />
    </div>
  </div>
);
