import rawData from './processed-data.json';
import { ProcessedDataSchema } from './schema';

export const loadData = () => ProcessedDataSchema.parse(rawData);
