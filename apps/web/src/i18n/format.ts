import { getLocale } from "@/paraglide/runtime.js";

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(getLocale(), options).format(value);

export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat(getLocale(), {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(isoDate));
