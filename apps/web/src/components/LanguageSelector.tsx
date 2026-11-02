import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
} from "@floating-ui/react";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { languageRegistry, type AppLocale } from "@/i18n/locales";
import { pageUrlForLocale } from "@/i18n/urls";
import { cn } from "@/lib/utils";

import flagUS from "@/assets/flags/us.svg";
import flagES from "@/assets/flags/es.svg";
import flagFR from "@/assets/flags/fr.svg";
import flagDE from "@/assets/flags/de.svg";
import flagIT from "@/assets/flags/it.svg";
import flagBR from "@/assets/flags/br.svg";
import flagJP from "@/assets/flags/jp.svg";
import flagKR from "@/assets/flags/kr.svg";
import flagRU from "@/assets/flags/ru.svg";
import flagCN from "@/assets/flags/cn.svg";
import flagTW from "@/assets/flags/tw.svg";

const flagImages = { us: flagUS, es: flagES, fr: flagFR, de: flagDE, it: flagIT, br: flagBR, jp: flagJP, kr: flagKR, ru: flagRU, cn: flagCN, tw: flagTW };

export function LanguageSelector() {
  const locale = getLocale();
  const selectedIndex = languageRegistry.findIndex((language) => language.locale === locale);
  const selected = languageRegistry[selectedIndex];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const listRef = useRef<Array<HTMLButtonElement | null>>([]);
  const labelsRef = useRef(languageRegistry.map(({ nativeName }) => nativeName));
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        },
      }),
    ],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "select" });
  const navigation = useListNavigation(context, {
    listRef,
    activeIndex,
    selectedIndex,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex,
    onMatch: setActiveIndex,
    enabled: open,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click, dismiss, role, navigation, typeahead,
  ]);

  function chooseLanguage(next: AppLocale) {
    setOpen(false);
    if (next !== locale) {
      window.location.assign(pageUrlForLocale(new URL(window.location.href), next));
    }
  }

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        data-language-selector
        data-locale={locale}
        aria-label={`${m.language_label()}: ${selected.nativeName}`}
        className="inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.035] py-2 pr-3 pl-3.5 text-sm font-medium text-zinc-300 shadow-sm transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
        {...getReferenceProps()}
      >
        <img src={flagImages[selected.flag]} alt="" aria-hidden="true" width={20} height={20} className="size-5 shrink-0 rounded-full" />
        <span lang={locale}>{selected.nativeName}</span>
        <ChevronDown aria-hidden="true" size={14} className={cn("ml-0.5 text-zinc-500 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-label={m.language_label()}
              className="z-[10000] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-zinc-900 p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)] outline-none"
              {...getFloatingProps()}
            >
              <div aria-hidden="true" className="mx-2 mb-1 border-b border-white/[0.06] px-1 pt-2 pb-2.5 text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                {m.language_label()}
              </div>
              {languageRegistry.map((language, index) => (
                <button
                  key={language.locale}
                  ref={(node) => { listRef.current[index] = node; }}
                  type="button"
                  role="option"
                  aria-selected={language.locale === locale}
                  lang={language.locale}
                  data-locale={language.locale}
                  tabIndex={activeIndex === index ? 0 : -1}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-white/[0.06] focus:bg-white/[0.06]",
                    language.locale === locale ? "bg-indigo-400/10 text-indigo-200" : "text-zinc-300",
                  )}
                  {...getItemProps({
                    active: activeIndex === index,
                    selected: language.locale === locale,
                    onClick: () => chooseLanguage(language.locale),
                  })}
                >
                  <img src={flagImages[language.flag]} alt="" aria-hidden="true" width={20} height={20} className="size-5 shrink-0 rounded-full" />
                  <span className="flex-1">{language.nativeName}</span>
                  {language.locale === locale && <Check aria-hidden="true" size={15} className="text-indigo-300" />}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
