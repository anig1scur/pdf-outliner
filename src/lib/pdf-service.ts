import fontkit from '@pdf-lib/fontkit';
import {PDFDocument, PDFFont, PDFName, PDFPage, rgb} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import {get} from 'svelte/store';

import {tocConfig} from '../stores';

const TOC_LAYOUT = {
  PAGE: {
    MARGIN_X: 50,       // 左右边距
    MARGIN_BOTTOM: 60,  // 下边距
  },
  TITLE: {
    FONT_SIZE: 23,
    Y_START_RATIO: 2 / 3,  // 标题起始位置占页面高度的比例
    MARGIN_BOTTOM: 38,     // 标题与第一项的间距
  },
  ITEM: {
    INDENT_PER_LEVEL: 20,   // 每级缩进宽度
    LINE_HEIGHT_ADJUST: 8,  // 第一级标题特殊的Y轴微调
    DOT_LEADER: {
      SIZE_RATIO: 0.6,    // 虚线点相对于字号的大小
      SPACING_STEP: 5,    // 虚线点的密度步长
      GAP_TITLE: 10,      // 标题文字与虚线开始的间距
      RIGHT_PADDING: 15,  // 虚线结束位置距离右边距的距离
    },
    PAGE_NUM_WIDTH_PAD: 50,
    ANNOT_Y_PADDING: 2,
  },
};

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
  to: number;
  children?: TocItem[];
  open?: boolean;
}

type PendingAnnot = {
  tocPage: PDFPage; rect: number[]; targetPageNum: number;
};

interface TocRenderContext {
  doc: PDFDocument;
  regularFont: PDFFont;
  boldFont: PDFFont;
  pageWidth: number;
  pageHeight: number;
  config: any;
  pendingAnnots: PendingAnnot[];
}

pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export class PDFService {
  private static regularFontBytes?: ArrayBuffer;
  private static boldFontBytes?: ArrayBuffer;
  static sharedWorker: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWorker();
    }
  }

  private initWorker() {
    if (!PDFService.sharedWorker) {
      PDFService.sharedWorker = new pdfjsLib.PDFWorker();
    }
  }

  private async loadFonts(): Promise<void> {
    if (PDFService.regularFontBytes && PDFService.boldFontBytes) return;

    const fontUrl = '/fonts/NotoSerifSC-Regular.ttf';
    const boldFontUrl = '/fonts/NotoSerifSC-Bold.ttf';

    try {
      const [regBytes, boldBytes] = await Promise.all([
        fetch(fontUrl).then((res) => res.arrayBuffer()),
        fetch(boldFontUrl).then((res) => res.arrayBuffer()),
      ]);

      PDFService.regularFontBytes = regBytes;
      PDFService.boldFontBytes = boldBytes;
    } catch (error) {
      console.error('Failed to load fonts:', error);
      throw new Error('Fonts could not be loaded');
    }
  }

  async createTocPage(
      sourceDoc: PDFDocument, items: TocItem[], insertAtPage: number = 2):
      Promise<{newDoc: PDFDocument; tocPageCount: number}> {
    await this.loadFonts();

    const newDoc = await PDFDocument.create();
    newDoc.registerFontkit(fontkit);

    const notoRegularFont =
        await newDoc.embedFont(PDFService.regularFontBytes!, {subset: false});
    const notoBoldFont =
        await newDoc.embedFont(PDFService.boldFontBytes!, {subset: false});

    const sourceIndices = sourceDoc.getPageIndices();
    const insertIndex =
        Math.max(0, Math.min(insertAtPage - 1, sourceIndices.length));

    const indicesBefore = sourceIndices.slice(0, insertIndex);
    if (indicesBefore.length > 0) {
      const copiedPages = await newDoc.copyPages(sourceDoc, indicesBefore);
      copiedPages.forEach((page) => newDoc.addPage(page));
    }

    const allSourcePages = sourceDoc.getPages();
    const sizeRefPage =
        allSourcePages.length > 1 ? allSourcePages[1] : allSourcePages[0];
    const {width, height} = sizeRefPage.getSize();
    const tocPage = newDoc.addPage([width, height]);

    let yOffset = height * TOC_LAYOUT.TITLE.Y_START_RATIO;

    tocPage.drawText('Table of Contents', {
      x: TOC_LAYOUT.PAGE.MARGIN_X,
      y: yOffset,
      size: TOC_LAYOUT.TITLE.FONT_SIZE,
      font: notoBoldFont,
      color: rgb(0, 0, 0),
    });

    yOffset -= TOC_LAYOUT.TITLE.MARGIN_BOTTOM;

    const pendingAnnots: PendingAnnot[] = [];

    const renderContext: TocRenderContext = {
      doc: newDoc,
      regularFont: notoRegularFont,
      boldFont: notoBoldFont,
      pageWidth: width,
      pageHeight: height,
      config: get(tocConfig),
      pendingAnnots,
    };

    await this.drawTocItems(tocPage, items, 0, yOffset, renderContext);

    const tocPageCount = newDoc.getPageCount() - indicesBefore.length;

    const indicesAfter = sourceIndices.slice(insertIndex);
    if (indicesAfter.length > 0) {
      const copiedPages = await newDoc.copyPages(sourceDoc, indicesAfter);
      copiedPages.forEach((page) => newDoc.addPage(page));
    }

    const allPages = newDoc.getPages();
    for (const pa of pendingAnnots) {
      const physicalPageNum = pa.targetPageNum;
      const targetIndexInSourceDoc = physicalPageNum - 1;

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
  private async drawTocItems(
      currentPage: PDFPage, items: TocItem[], level: number, startY: number,
      ctx: TocRenderContext, options: {prefix?: string} = {}) {
    let yOffset = startY;
    let currentWorkingPage = currentPage;
    const {prefix} = options;
    const {
      doc,
      regularFont,
      boldFont,
      pageWidth,
      pageHeight,
      config,
      pendingAnnots
    } = ctx;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 检查是否需要换页
      if (yOffset < TOC_LAYOUT.PAGE.MARGIN_BOTTOM) {
        currentWorkingPage = doc.addPage([pageWidth, pageHeight]);
        yOffset = pageHeight - TOC_LAYOUT.PAGE.MARGIN_BOTTOM;
      }

      const isFirstLevel = level === 0;
      const levelConfig = isFirstLevel ? config.firstLevel : config.otherLevels;

      const {fontSize, dotLeader, color, lineSpacing} = levelConfig;
      const parsedColor =
          rgb(parseInt(color.slice(1, 3), 16) / 255,
              parseInt(color.slice(3, 5), 16) / 255,
              parseInt(color.slice(5, 7), 16) / 255);

      const indentation = level * TOC_LAYOUT.ITEM.INDENT_PER_LEVEL;
      const lineHeight = fontSize * lineSpacing;

      const snl = config.showNumberedList;
      const itemPrefix =
          snl ? (prefix ? `${prefix}.${i + 1}` : `${i + 1}`) : '';
      const title = `${itemPrefix} ${item.title}`.trim();

      const titleX = TOC_LAYOUT.PAGE.MARGIN_X + indentation;

      if (isFirstLevel) {
        yOffset -= TOC_LAYOUT.ITEM.LINE_HEIGHT_ADJUST;
      }

      const currentFont = isFirstLevel ? boldFont : regularFont;

      currentWorkingPage.drawText(title, {
        x: titleX,
        y: yOffset,
        size: fontSize,
        font: currentFont,
        color: parsedColor,
        maxWidth: pageWidth - 100 - indentation,
      });

      if (dotLeader) {
        const titleWidth = currentFont.widthOfTextAtSize(title, fontSize);
        const dotsXStart =
            titleX + titleWidth + TOC_LAYOUT.ITEM.DOT_LEADER.GAP_TITLE;
        const dotsXEnd = pageWidth - TOC_LAYOUT.PAGE.MARGIN_X -
            TOC_LAYOUT.ITEM.DOT_LEADER.RIGHT_PADDING;

        for (let x = dotsXStart; x < dotsXEnd;
             x += TOC_LAYOUT.ITEM.DOT_LEADER.SPACING_STEP) {
          currentWorkingPage.drawText(dotLeader, {
            x,
            y: yOffset,
            size: fontSize * TOC_LAYOUT.ITEM.DOT_LEADER.SIZE_RATIO,
            font: regularFont,
            color: parsedColor,
          });
        }
      }

      const pageNumText = String(item.to);
      const pageNumWidth = currentFont.widthOfTextAtSize(pageNumText, fontSize);
      currentWorkingPage.drawText(pageNumText, {
        x: pageWidth - TOC_LAYOUT.ITEM.PAGE_NUM_WIDTH_PAD - pageNumWidth,
        y: yOffset,
        size: fontSize,
        font: currentFont,
        color: parsedColor,
      });

      const annotRect = [
        titleX, yOffset - TOC_LAYOUT.ITEM.ANNOT_Y_PADDING,
        pageWidth - TOC_LAYOUT.PAGE.MARGIN_X, yOffset + fontSize
      ];
      pendingAnnots.push({
        tocPage: currentWorkingPage,
        rect: annotRect,
        targetPageNum: item.to + (config.pageOffset ?? 0),
      });

      yOffset -= lineHeight;

      if (item.children?.length) {
        const childResult = await this.drawTocItems(
            currentWorkingPage, item.children, level + 1, yOffset, ctx,
            {prefix: itemPrefix});
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
    const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('PDF Canvas element not found');
      return;
    }

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({scale});

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
    } catch (e) {
      console.error(`Error rendering page ${pageNum}:`, e);
    }
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

      await page
          .render({
            canvasContext: context,
            viewport: scaledViewport,
          })
          .promise;
    } catch (error: any) {
      if (!error.message?.includes('multiple render')) {
        console.error(`Error rendering page ${pageNum} to canvas:`, error);
      }
    }
  }

  async getPageAsImage(
      pdf: any, pageNum: number, targetScale: number = 1.5,
      maxDimension: number = 2048): Promise<string> {
    const page = await pdf.getPage(pageNum);

    let viewport = page.getViewport({scale: targetScale});

    const maxSide = Math.max(viewport.width, viewport.height);

    if (maxSide > maxDimension) {
      const adjustmentRatio = maxDimension / maxSide;
      const finalScale = targetScale * adjustmentRatio;

      viewport = page.getViewport({scale: finalScale});
      console.log(`Page ${pageNum} too large (${maxSide}px). Downscaling to ${
          finalScale.toFixed(2)}x`);
    }

    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create 2D context');

    await page
        .render({
          canvasContext: context,
          viewport,
        })
        .promise;

    return canvas.toDataURL('image/jpeg', 0.9);
  }
}
