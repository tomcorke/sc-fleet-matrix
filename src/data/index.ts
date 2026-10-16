import rawData from './processed-data.json';
import { ProcessedMatrixDataSchema } from './schema';

export const loadData = () => {
  return ProcessedMatrixDataSchema.parse(rawData);
};
