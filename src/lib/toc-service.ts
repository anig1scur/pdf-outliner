import type * as PdfjsLibTypes from 'pdfjs-dist';
import {get} from 'svelte/store';

import {pdfService} from '../stores';
import { processToc } from './service';

interface AiTocOptions {
  pdfInstance: PdfjsLibTypes.PDFDocumentProxy;
  ranges?: { start: number; end: number }[];
  startPage?: number;
  endPage?: number;
  apiKey?: string;
  provider?: string;
  textEndpoint?: string;
  visionEndpoint?: string;
}

export async function generateToc(
  { pdfInstance, ranges, startPage, endPage, apiKey, provider, textEndpoint, visionEndpoint }: AiTocOptions) {

  // Normalize ranges
  let finalRanges: { start: number; end: number }[] = [];
  if (ranges && ranges.length > 0) {
    finalRanges = ranges;
  } else if (startPage !== undefined && endPage !== undefined) {
    finalRanges = [{ start: startPage, end: endPage }];
  } else {
    throw new Error('No page ranges provided.');
  }

  const service = get(pdfService);
  if (!service) {
    throw new Error('PDF Service not initialized');
  }

  const imagesBase64: string[] = [];
  let currentTotalSize = 0;
  const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;
  let totalPageCount = 0;

  for (const range of finalRanges) {
    if (range.end < range.start) {
      continue; // Skip invalid ranges
    }

    for (let pageNum = range.start;pageNum <= range.end;pageNum++) {
      totalPageCount++;
      if (totalPageCount > 10) {
        throw new Error(`Too many pages selected. Max allowed is 10 pages.`);
      }

      const image = await service.getPageAsImage(pdfInstance, pageNum);

      currentTotalSize += image.length;
      if (currentTotalSize > MAX_PAYLOAD_SIZE) {
        throw new Error(
          'Total size too large (>5MB). Please reduce page range or lower resolution.');
      }

      imagesBase64.push(image);
    }
  }

  if (imagesBase64.length === 0) {
    throw new Error('No valid pages selected.');
  }

  try {
    const res = await processToc({
      images: imagesBase64,
      apiKey: apiKey || '',
      provider: provider || '',
      doubaoConfig: {
        textEndpoint: textEndpoint || '',
        visionEndpoint: visionEndpoint || '',
      }
    });
    return res;

  } catch (err: any) {
    let friendlyMessage = err.message || 'AI processing failed.';

    if (response.status >= 500 && response.status < 600) {
      const p = provider || 'Unknown Provider';
      const providerName = p.charAt(0).toUpperCase() + p.slice(1);
      friendlyMessage = `${ providerName }: ${ friendlyMessage } You can try other model in API settings.`;
    } else if (friendlyMessage.includes('No valid ToC') ||
        friendlyMessage.includes('parsing error') ||
        friendlyMessage.includes('structure')) {
      friendlyMessage =
          "The selected pages don't look like a ToC. Please try adjusting the page range.";
    } else if (err.status === 413 || friendlyMessage.includes('Request too large')) {
      friendlyMessage =
          'Request too large. Please reduce the page range or lower the resolution.';
    } else if (err.status === 429 || friendlyMessage.includes('Daily limit exceeded')) {
      friendlyMessage =
          'Daily limit exceeded. Please try again tomorrow or download the client or deploy service with your own API key.';
    }
    throw new Error(friendlyMessage);

  }
}