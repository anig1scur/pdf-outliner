import type * as PdfjsLibTypes from 'pdfjs-dist';
import {get} from 'svelte/store';

import {pdfService} from '../stores';
import { processToc } from './service';

interface AiTocOptions {
  pdfInstance: PdfjsLibTypes.PDFDocumentProxy;
  startPage: number;
  endPage: number;
  apiKey?: string;
  provider?: string;
}


export async function generateToc(
    {pdfInstance, startPage, endPage, apiKey, provider}: AiTocOptions) {
  if (endPage < startPage) {
    throw new Error('End page must be greater than or equal to start page.');
  }

  const selectedPageCount = endPage - startPage + 1;
  if (selectedPageCount > 10) {
    throw new Error(`Too many pages selected (${
        selectedPageCount}). Max allowed is 10 pages.`);
  }

  const service = get(pdfService);
  if (!service) {
    throw new Error('PDF Service not initialized');
  }

  const imagesBase64: string[] = [];
  let currentTotalSize = 0;
  const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const image = await service.getPageAsImage(pdfInstance, pageNum);

    currentTotalSize += image.length;
    if (currentTotalSize > MAX_PAYLOAD_SIZE) {
      throw new Error(
          'Total size too large (>5MB). Please reduce page range or lower resolution.');
    }

    imagesBase64.push(image);
  }

  try {
    const res = await processToc({
      images: imagesBase64,
      apiKey: apiKey || '',
      provider: provider || '',
      // TODO: Add doubaoConfig when available in UI settings
    });
    return res;
  } catch (err: any) {
    throw new Error(err.message || 'AI processing failed.');
  }
}