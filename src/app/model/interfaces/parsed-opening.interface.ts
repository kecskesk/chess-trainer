import { IOpeningAssetItem } from './opening-asset-item.interface';

export interface IParsedOpening {
  name: string;
  steps: string[];
  raw: IOpeningAssetItem;
}
