import {get} from 'svelte/store';
import {PDFDocument, PDFName, PDFPage, PDFFont, rgb, StandardFonts} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {tocConfig} from '../stores';

export interface PDFState {
  doc: PDFDocument | null;
  newDoc: PDFDocument | null;
  filename: string;
  instance: any;
  currentPage: number;
  totalPages: number;
  scale: number;
}

export interface TocItem {
  id: number | string;
  title: string;
  to: number;
  children?: TocItem[];
  open?: boolean;
}

export class PDFService {
  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
  }

  async createTocPage(sourceDoc: PDFDocument, items: TocItem[]) {
    const newDoc = await PDFDocument.create();
    const [firstPage] = sourceDoc.getPages();
    const {width, height} = firstPage.getSize();

    // Copy all pages from source document
    const copiedPages = await newDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());

    // Create first TOC page
    const tocPage = newDoc.addPage([width, height]);
    const regularFont = await newDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await newDoc.embedFont(StandardFonts.TimesRomanBold);

    let yOffset = (height / 3) * 2;

    // Draw TOC title
    tocPage.drawText('Table of Contents', {
      x: 50,
      y: yOffset,
      size: 23,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    yOffset -= 38;

    // Draw TOC items
    await this.drawTocItems(newDoc, tocPage, items, copiedPages, 0, yOffset, {
      regularFont,
      boldFont,
      pageWidth: width,
      pageHeight: height,
    });

    // Add remaining pages
    copiedPages.forEach((page) => newDoc.addPage(page));

    return newDoc;
  }

  private async drawTocItems(
    doc: PDFDocument,
    currentPage: PDFPage,
    items: TocItem[],
    pages: PDFPage[],
    level: number,
    startY: number,
    options: {
      regularFont: PDFFont;
      boldFont: PDFFont;
      pageWidth: number;
      pageHeight: number;
      prefix?: string;
    }
  ) {
    let yOffset = startY;
    const config = get(tocConfig);
    const isFirstLevel = level === 0;
    const {regularFont, boldFont, pageWidth, pageHeight} = options;
    let {prefix} = options;
    let currentWorkingPage = currentPage;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if we need a new page
      if (yOffset < 60) {
        currentWorkingPage = doc.addPage([pageWidth, pageHeight]);
        yOffset = pageHeight - 60;
      }

      // Fetch level-specific config
      const levelConfig = isFirstLevel ? config.firstLevel : config.otherLevels;
      const indentation = level * 20;
      const {fontSize, dotLeader, color, lineSpacing} = levelConfig;

      const font = isFirstLevel ? options.boldFont : options.regularFont;
      const parsedColor = rgb(
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255
      );

      const lineHeight = fontSize * lineSpacing;

      // Calculate prefix
      const snl = config.showNumberedList;
      const itemPrefix = snl ? (prefix ? `${prefix}.${i + 1}` : `${i + 1}`) : '';
      let title = `${itemPrefix} ${item.title}`;

      // Draw title
      const titleX = 50 + indentation;
      if (isFirstLevel) {
        yOffset -= 8;
      }
      title = this.replaceUnsupportedCharacters(title, font);
      currentWorkingPage.drawText(title, {
        x: titleX,
        y: yOffset,
        size: fontSize,
        font,
        color: parsedColor,
        maxWidth: pageWidth - 100 - indentation,
      });

      // Draw dots
      if (dotLeader) {
        const titleWidth = font.widthOfTextAtSize(title, fontSize);
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

      // Draw page number
      const pageNum = String(item.to);
      const pageNumWidth = font.widthOfTextAtSize(pageNum, fontSize);

      currentWorkingPage.drawText(pageNum, {
        x: pageWidth - 50 - pageNumWidth,
        y: yOffset,
        size: fontSize,
        font,
        color: parsedColor,
      });

      // Create link annotation
      this.createLinkAnnotation(doc, currentWorkingPage, {
        pageNum: item.to + config.pageOffset,
        pages,
        rect: [titleX, yOffset - 2, pageWidth - 50, yOffset + fontSize],
      });

      yOffset -= lineHeight;

      if (item.children?.length) {
        const childResult = await this.drawTocItems(doc, currentWorkingPage, item.children, pages, level + 1, yOffset, {
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

  private createLinkAnnotation(
    doc: PDFDocument,
    page: any,
    options: {
      pageNum: number;
      pages: any[];
      rect: number[];
    }
  ) {
    const {pageNum, pages, rect} = options;
    const targetPage = pages[Math.min(pages.length - 1, pageNum - 1)];

    const ref = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: rect,
        Border: [0, 0, 0],
        Dest: [targetPage.ref, 'XYZ', 0, targetPage.getHeight(), 0],
      })
    );

    const existingAnnots = page.node.get(PDFName.of('Annots'));
    if (existingAnnots) {
      existingAnnots.push(ref);
    } else {
      page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
    }
  }

  async renderPage(pdf: any, pageNum: number, scale: number) {
    if (!pdf) {
      return;
    }
    const page = await pdf.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    const viewport = page.getViewport({scale});
    if (!viewport) {
      return;
    }
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
    }).promise;
  }

  /* Checks for each code point whether the given font supports it.
   If not, tries to remove diacritics from said code point.
   If that doesn't work either, replaces the unsupported character with '?'. */
  replaceUnsupportedCharacters(string, font) {
    const charSet = font.getCharacterSet();
    const codePoints = [];
    for (const codePointStr of string) {
      const codePoint = codePointStr.codePointAt(0);
      if (!charSet.includes(codePoint)) {
        const withoutDiacriticsStr = codePointStr.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const withoutDiacritics = withoutDiacriticsStr.charCodeAt(0);
        if (charSet.includes(withoutDiacritics)) {
          codePoints.push(withoutDiacritics);
        } else {
          codePoints.push('?'.codePointAt(0));
        }
      } else {
        codePoints.push(codePoint);
      }
    }
    return String.fromCodePoint(...codePoints);
  }
}
