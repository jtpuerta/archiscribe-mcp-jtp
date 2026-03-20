import { ViewObject, ElementObject, ModelData } from '../model/types';

export interface ResponseFormatter {
  readonly contentType: string;
  formatViewList(views: ViewObject[], disclaimer?: string): string;
  formatViewDetails(model: ModelData, view: ViewObject, disclaimer?: string): string;
  formatElementList(elements: ElementObject[], disclaimer?: string): string;
  formatElementDetails(model: ModelData, element: ElementObject, disclaimer?: string): string;
}
