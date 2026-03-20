import { ResponseFormat } from '../config';
import { ResponseFormatter } from './types';
import { MarkdownFormatter } from './markdownFormatter';
import { JsonFormatter } from './jsonFormatter';
import { YamlFormatter } from './yamlFormatter';

export type { ResponseFormatter } from './types';

const formatters: Record<ResponseFormat, ResponseFormatter> = {
  markdown: new MarkdownFormatter(),
  json: new JsonFormatter(),
  yaml: new YamlFormatter(),
};

export function getFormatter(format?: ResponseFormat): ResponseFormatter {
  return formatters[format || 'markdown'] || formatters.markdown;
}
