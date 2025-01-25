import {PDFDocument, PDFName, rgb, StandardFonts} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

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

    // Create TOC page
    const tocPage = newDoc.addPage([width, height]);
    const regularFont = await newDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await newDoc.embedFont(StandardFonts.HelveticaBold);

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
    });

    // Add remaining pages
    copiedPages.forEach((page) => newDoc.addPage(page));

    return newDoc;
  }

  private async drawTocItems(
    doc: PDFDocument,
    page: any,
    items: TocItem[],
    pages: any[],
    level: number,
    startY: number,
    options: {
      regularFont: any;
      boldFont: any;
      pageWidth: number;
    }
  ) {
    let yOffset = startY;
    const {regularFont, boldFont, pageWidth} = options;

    for (const item of items) {
      if (yOffset < 50) {
        page = doc.addPage([pageWidth, page.getHeight()]);
        yOffset = page.getHeight() - 50;
      }

      const indent = level * 20;
      const isFirstLevel = level === 0;

      const fontSize = isFirstLevel ? 11 : 9;
      const font = isFirstLevel ? boldFont : regularFont;
      const color = isFirstLevel ? rgb(0, 0, 0) : rgb(0.3, 0.3, 0.3);
      const lineSpacing = fontSize + (isFirstLevel ? 8 : 6);

      if (isFirstLevel) {
        yOffset -= 6;
      }

      // Draw title
      const titleX = 50 + indent;
      page.drawText(item.title, {
        x: titleX,
        y: yOffset,
        size: fontSize,
        font,
        color,
        maxWidth: pageWidth - 100 - indent,
      });

      if (isFirstLevel) {
        const dotsXStart = titleX + item.title.length * (fontSize * 0.5) + 10;
        const dotsXEnd = page.getWidth() - 65;
        for (let x = dotsXStart; x < dotsXEnd; x += 5) {
          page.drawText('.', {
            x,
            y: yOffset - 1,
            size: fontSize * 0.6,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      }

      // Draw page number
      const pageNum = String(item.to);
      const pageNumWidth = font.widthOfTextAtSize(pageNum, fontSize);
      page.drawText(pageNum, {
        x: pageWidth - 50 - pageNumWidth,
        y: yOffset,
        size: fontSize,
        font,
        color,
      });

      // Create link annotation
      this.createLinkAnnotation(doc, page, {
        pageNum: item.to,
        pages,
        rect: [titleX, yOffset - 2, pageWidth - 50, yOffset + fontSize],
      });

      yOffset -= lineSpacing;

      if (item.children?.length) {
        yOffset = await this.drawTocItems(doc, page, item.children, pages, level + 1, yOffset, options);
      }
    }

    return yOffset;
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
    const page = await pdf.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    const viewport = page.getViewport({scale});

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport,
    }).promise;
  }
}
