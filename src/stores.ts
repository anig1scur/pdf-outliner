import {PDFService} from '$lib/pdf-service';
import {writable} from 'svelte/store';

export type StyleConfig = {
  fontSize: number;
  dotLeader: string;
  color: string;
  lineSpacing: string;
};
export type TocConfig = {
  insertAtPage: number;
  showNumberedList: Boolean;
  pageOffset: number;
  firstLevel: StyleConfig;
  otherLevels: StyleConfig;
};

export const tocItems = writable([]);
export const maxPage = writable(0);
export const pdfService = writable(new PDFService());
export const tocConfig = writable({
  showNumberedList: true,
  pageOffset: 0,
  firstLevel: {
    fontSize: 11,
    dotLeader: '.',
    color: '#000000',
    lineSpacing: 1.65,
  },
  otherLevels: {
    fontSize: 9,
    dotLeader: '',
    color: '#666666',
    lineSpacing: 1.5,
  },
});
