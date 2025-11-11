import fontkit from '@pdf-lib/fontkit';
import {PDFDocument, PDFFont, PDFName, PDFPage, rgb} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {get} from 'svelte/store';

import {tocConfig} from '../stores';

export interface PDFState {
  doc: PDFDocument|null;
  newDoc: PDFDocument|null;
  filename: string;
  instance: any;
  currentPage: number;
  totalPages: number;
  scale: number;
}

export interface TocItem {
  id: number|string;
  title: string;
  to: number;  // 1-based page number in source doc
  children?: TocItem[];
  open?: boolean;
}

type PendingAnnot = {
  tocPage: PDFPage; rect: number[]; targetPageNum: number;
};

export class PDFService {
  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
  }

  async addMetadataOnly(sourceDoc: PDFDocument, items: TocItem[]) {
    const newDoc = await PDFDocument.create();
    const copiedPages =
        await newDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());
    copiedPages.forEach((page) => newDoc.addPage(page));
    return newDoc;
  }

  /**
   * Generates a new PDF document, inserting TOC pages at a specific location
   * and then appending the source pages, split by the insertion index.
   */
  async createTocPage(
      sourceDoc: PDFDocument, items: TocItem[], addPhysicalPage: boolean = true,
      insertAtPage: number = 2  // 1-based page number to insert *before*
      ): Promise<{newDoc: PDFDocument; tocPageCount: number}> {
    if (!addPhysicalPage) {
      const newDoc = await this.addMetadataOnly(sourceDoc, items);
      return {newDoc, tocPageCount: 0};
    }

    const newDoc = await PDFDocument.create();
    newDoc.registerFontkit(fontkit);

    const fontUrl = '/fonts/NotoSerifSC-Regular.ttf';
    const boldFontUrl = '/fonts/NotoSerifSC-Bold.ttf';

    const [fontBytes, boldFontBytes] = await Promise.all([
      fetch(fontUrl).then(res => res.arrayBuffer()),
      fetch(boldFontUrl).then(res => res.arrayBuffer())
    ]);

    const notoRegularFont = await newDoc.embedFont(fontBytes, {subset: false});
    const notoBoldFont = await newDoc.embedFont(boldFontBytes, {subset: false});

    const sourceIndices = sourceDoc.getPageIndices();

    // 1-based page number to 0-based index
    const insertIndex =
        Math.max(0, Math.min(insertAtPage - 1, sourceIndices.length));

    // 1. Copy pages *before* the insertion point
    const indicesBefore = sourceIndices.slice(0, insertIndex);
    if (indicesBefore.length > 0) {
      const copiedPages = await newDoc.copyPages(sourceDoc, indicesBefore);
      copiedPages.forEach((page) => newDoc.addPage(page));
    }

    // 2. Create and add TOC pages
    const [firstPage] = sourceDoc.getPages();
    const {width, height} = firstPage.getSize();

    const tocPage = newDoc.addPage([width, height]);
    let yOffset = (height / 3) * 2;

    tocPage.drawText('Table of Contents', {
      x: 50,
      y: yOffset,
      size: 23,
      font: notoBoldFont,
      color: rgb(0, 0, 0),
    });
    yOffset -= 38;

    const pendingAnnots: PendingAnnot[] = [];

    await this.drawTocItems(newDoc, tocPage, items, 0, yOffset, {
      regularFont: notoRegularFont,
      boldFont: notoBoldFont,
      pageWidth: width,
      pageHeight: height,
      pendingAnnots,
    });

    // Get the *actual* number of TOC pages that were created
    const tocPageCount = newDoc.getPageCount() - indicesBefore.length;

    // 3. Copy pages *after* the insertion point
    const indicesAfter = sourceIndices.slice(insertIndex);
    if (indicesAfter.length > 0) {
      const copiedPages = await newDoc.copyPages(sourceDoc, indicesAfter);
      copiedPages.forEach((page) => newDoc.addPage(page));
    }

    // 4. Process all pending annotations
    const allPages = newDoc.getPages();
    for (const pa of pendingAnnots) {
      // 1-based physical page number from source doc
      const physicalPageNum = pa.targetPageNum;
      // 0-based index in *source* doc
      const targetIndexInSourceDoc = physicalPageNum - 1;

      // Find its new index in the final document
      let targetIndexInNewDoc;
      if (targetIndexInSourceDoc < insertIndex) {
        targetIndexInNewDoc = targetIndexInSourceDoc;
      } else {
        targetIndexInNewDoc = targetIndexInSourceDoc + tocPageCount;
      }

      const boundedIndex =
          Math.min(Math.max(0, targetIndexInNewDoc), allPages.length - 1);
      const targetPage = allPages[boundedIndex];

      const ref = newDoc.context.register(newDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: pa.rect,
        Border: [0, 0, 0],
        Dest: [targetPage.ref, 'Fit'],
      }));

      const existingAnnots = pa.tocPage.node.get(PDFName.of('Annots'));
      if (existingAnnots) {
        existingAnnots.push(ref);
      } else {
        pa.tocPage.node.set(PDFName.of('Annots'), newDoc.context.obj([ref]));
      }
    }

    return {newDoc, tocPageCount};
  }

  /**
   * drawTocItems: Recursively draws TOC text and collects annotation data.
   */
  private async drawTocItems(
      doc: PDFDocument, currentPage: PDFPage, items: TocItem[], level: number,
      startY: number, options: {
        regularFont: PDFFont;
        boldFont: PDFFont;
        pageWidth: number;
        pageHeight: number;
        prefix?: string;
        pendingAnnots?: PendingAnnot[];
      }) {
    let yOffset = startY;
    const config = get(tocConfig);
    const isFirstLevel = level === 0;

    const {
      regularFont,
      boldFont,
      pageWidth,
      pageHeight
    } = options;
    let {prefix} = options;
    let currentWorkingPage = currentPage;
    const pendingAnnots = options.pendingAnnots ?? [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (yOffset < 60) {
        currentWorkingPage = doc.addPage([pageWidth, pageHeight]);
        yOffset = pageHeight - 60;
      }

      const levelConfig = isFirstLevel ? config.firstLevel : config.otherLevels;
      const indentation = level * 20;
      const {fontSize, dotLeader, color, lineSpacing} = levelConfig;

      const parsedColor =
          rgb(parseInt(color.slice(1, 3), 16) / 255,
              parseInt(color.slice(3, 5), 16) / 255,
              parseInt(color.slice(5, 7), 16) / 255);

      const lineHeight = fontSize * lineSpacing;

      const snl = config.showNumberedList;
      const itemPrefix =
          snl ? (prefix ? `${prefix}.${i + 1}` : `${i + 1}`) : '';
      let title = `${itemPrefix} ${item.title}`.trim();

      const titleX = 50 + indentation;
      if (isFirstLevel) {
        yOffset -= 8;
      }

      const titleFont = isFirstLevel ? boldFont : regularFont;

      currentWorkingPage.drawText(title, {
        x: titleX,
        y: yOffset,
        size: fontSize,
        font: titleFont,
        color: parsedColor,
        maxWidth: pageWidth - 100 - indentation,
      });

      if (dotLeader) {
        const titleWidth = titleFont.widthOfTextAtSize(title, fontSize);
        const dotsXStart = titleX + titleWidth + 10;
        const dotsXEnd = pageWidth - 65;
        for (let x = dotsXStart; x < dotsXEnd; x += 5) {
          currentWorkingPage.drawText(dotLeader, {
            x,
            y: yOffset,
            size: fontSize * 0.6,
            font: regularFont,
            color: parsedColor,
          });
        }
      }

      const pageNumText = String(item.to);
      const pageNumFont = isFirstLevel ? boldFont : regularFont;
      const pageNumWidth = pageNumFont.widthOfTextAtSize(pageNumText, fontSize);
      currentWorkingPage.drawText(pageNumText, {
        x: pageWidth - 50 - pageNumWidth,
        y: yOffset,
        size: fontSize,
        font: pageNumFont,
        color: parsedColor,
      });

      const annotRect =
          [titleX, yOffset - 2, pageWidth - 50, yOffset + fontSize];
      pendingAnnots.push({
        tocPage: currentWorkingPage,
        rect: annotRect,
        targetPageNum: item.to + (config.pageOffset ?? 0),
      });

      yOffset -= lineHeight;

      if (item.children?.length) {
        const childResult = await this.drawTocItems(
            doc, currentWorkingPage, item.children, level + 1, yOffset, {
              ...options,
              prefix: itemPrefix,
            });
        currentWorkingPage = childResult.currentPage;
        yOffset = childResult.yOffset;
      }
    }

    return {
      currentPage: currentWorkingPage,
      yOffset,
    };
  }

  async renderPage(pdf: any, pageNum: number, scale: number) {
    if (!pdf) return;
    const page = await pdf.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const viewport = page.getViewport({scale});
    if (!viewport) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const context = canvas.getContext('2d');
    if (!context) return;

    await page
        .render({
          canvasContext: context,
          viewport,
        })
        .promise;
  }

  async renderPageToCanvas(
      pdf: any, pageNum: number, canvas: HTMLCanvasElement,
      maxWidth: number = 150) {
    if (!pdf || !canvas) return;
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({scale: 1});
      const scale = maxWidth / viewport.width;
      const scaledViewport = page.getViewport({scale});

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      const renderTask = page.render(renderContext);
      await renderTask.promise;
    } catch (error) {
      if (!error.message?.includes('multiple render')) {
        console.error(`Error rendering page ${pageNum}:`, error);
      }
    }
  }

  replaceUnsupportedCharacters(string: string, font: PDFFont) {
    const charSet = font.getCharacterSet();
    const codePoints: number[] = [];
    for (const ch of string) {
      const codePoint = ch.codePointAt(0) ?? 0;
      if (!charSet.includes(codePoint)) {
        const withoutDiacriticsStr =
            ch.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const withoutDiacritics = withoutDiacriticsStr.charCodeAt(0);
        if (charSet.includes(withoutDiacritics)) {
          codePoints.push(withoutDiacritics);
        } else {
          codePoints.push('?'.codePointAt(0) ?? 63);
        }
      } else {
        codePoints.push(codePoint);
      }
    }
    return String.fromCodePoint(...codePoints);
  }

  async getPageAsImage(pdf: any, pageNum: number, scale: number = 1.5):
      Promise<string> {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({scale});

    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Could not create 2D context for image generation');

    await page
        .render({
          canvasContext: context,
          viewport,
        })
        .promise;

    return canvas.toDataURL('image/png');
  }
}