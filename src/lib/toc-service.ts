import type * as PdfjsLibTypes from 'pdfjs-dist';
import {get} from 'svelte/store';

import {pdfService} from '../stores';

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

  const response = await fetch('/api/process-toc', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      images: imagesBase64,
      apiKey: apiKey,
      provider: provider,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    let friendlyMessage = err.message || 'AI processing failed.';

    if (friendlyMessage.includes('No valid ToC') ||
        friendlyMessage.includes('parsing error') ||
        friendlyMessage.includes('structure')) {
      friendlyMessage =
          'The selected pages don\'t look like a ToC. Please try adjusting the page range.';
    } else if (response.status === 413) {
      friendlyMessage =
          'Request too large. The images are too high resolution.';
    } else if (response.status === 429) {
      friendlyMessage =
          'Daily limit exceeded. Please try again tomorrow or download the client.';
    }
    throw new Error(friendlyMessage);
  }

  return await response.json();
}