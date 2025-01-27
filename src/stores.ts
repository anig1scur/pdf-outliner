import { PDFService } from '$lib/pdf-service';
import {writable} from 'svelte/store';

export const tocItems = writable([]);
export const maxPage = writable(0);
export const pdfService = writable(new PDFService());
export const showNumberedList = writable(true);
