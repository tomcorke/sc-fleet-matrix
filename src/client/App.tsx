import { loadData } from '../data';
import { ShipMatrix } from './ship-matrix/ship-matrix';

const ships = loadData();

export const App = () => <ShipMatrix ships={ships} />;
