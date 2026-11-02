import { Fragment, type ReactNode } from "react";

/** Named slots keep a sentence together and let translators reorder links/emphasis safely. */
export const messageSlot = (name: string) => `\uFFF0${name}\uFFF1`;
export function richText(text: string, slots: Record<string, ReactNode>): ReactNode {
  return text.split(/(\uFFF0\w+\uFFF1)/g).map((part, index) => (
    <Fragment key={index}>
      {part.startsWith("\uFFF0") ? slots[part.slice(1, -1)] : part}
    </Fragment>
  ));
}
