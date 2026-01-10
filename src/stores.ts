import {browser} from '$app/environment';
import {PDFService} from '$lib/pdf-service';
import {DEFAULT_PREFIX_CONFIG, type LevelConfig} from '$lib/prefix-service';
import {get, writable} from 'svelte/store';

export type StyleConfig = {
  fontSize: number; dotLeader: string; color: string; lineSpacing: string;
};
export type TocConfig = {
  titleYStart?: number;
  insertAtPage: number; pageOffset: number; firstLevel: StyleConfig;
  otherLevels: StyleConfig;
  prefixSettings: {enabled: boolean; configs: LevelConfig[];};
};

type TocSession = {
  items: any[]; pageOffset: number;
};

export const maxPage = writable(0);

export const tocItems = writable<any[]>([]);
export const curFileFingerprint = writable<string>('');
export const pdfService = writable(new PDFService());
export const tocConfig = writable({
  prefixSettings: {
    enabled: false,
    configs: DEFAULT_PREFIX_CONFIG,
  },
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



export const autoSaveEnabled = writable(true);

if (browser) {
  const saveSession = () => {
    if (!get(autoSaveEnabled)) return;

    const fingerprint = get(curFileFingerprint);
    const items = get(tocItems);

    if (fingerprint && items.length > 0) {
      const config = get(tocConfig);
      const session: TocSession = {
        items,
        pageOffset: config.pageOffset,
      };
      try {
        localStorage.setItem(`toc_draft_${ fingerprint }`, JSON.stringify(session));
      } catch (e) {
        console.error('Failed to save session:', e);
      }
    }
  };

  tocItems.subscribe(saveSession);
  tocConfig.subscribe(saveSession);
}