import { ViewObject, ElementObject, ModelData } from '../model/types';
import { ResponseFormatter } from './types';
import {
  buildViewListData,
  buildViewDetailsData,
  buildElementListData,
  buildElementDetailsData,
  withDisclaimerField
} from './dataBuilders';

export class JsonFormatter implements ResponseFormatter {
  readonly contentType = 'application/json';

  formatViewList(views: ViewObject[], disclaimer?: string): string {
    return JSON.stringify(withDisclaimerField(buildViewListData(views), disclaimer), null, 2);
  }

  formatViewDetails(model: ModelData, view: ViewObject, disclaimer?: string): string {
    return JSON.stringify(withDisclaimerField(buildViewDetailsData(model, view), disclaimer), null, 2);
  }

  formatElementList(elements: ElementObject[], disclaimer?: string): string {
    return JSON.stringify(withDisclaimerField(buildElementListData(elements), disclaimer), null, 2);
  }

  formatElementDetails(model: ModelData, element: ElementObject, disclaimer?: string): string {
    return JSON.stringify(withDisclaimerField(buildElementDetailsData(model, element), disclaimer), null, 2);
  }
}
