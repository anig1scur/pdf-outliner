import {browser} from '$app/environment';
import {PDFService} from '$lib/pdf-service';
import {get, writable} from 'svelte/store';

export type StyleConfig = {
  fontSize: number; dotLeader: string; color: string; lineSpacing: string;
};
export type TocConfig = {
  insertAtPage: number; showNumberedList: Boolean; pageOffset: number;
  firstLevel: StyleConfig;
  otherLevels: StyleConfig;
};

type TocSession = {
  items: any[]; pageOffset: number;
};

export const maxPage = writable(0);

export const tocItems = writable<any[]>([]);
export const curFileFingerprint = writable<string>('');
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
    color: '#333333',
    lineSpacing: 1.5,
  },
});

if (browser) {
  const saveSession = () => {
    const fingerprint = get(curFileFingerprint);
    const items = get(tocItems);

    if (fingerprint && items.length > 0) {
      const config = get(tocConfig);
      const session: TocSession = {
        items,
        pageOffset: config.pageOffset,
      };
      localStorage.setItem(`toc_draft_${fingerprint}`, JSON.stringify(session));
    }
  };

  tocItems.subscribe(saveSession);
  tocConfig.subscribe(saveSession);
}