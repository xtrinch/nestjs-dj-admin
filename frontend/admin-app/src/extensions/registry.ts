import type { JSX } from 'react';
import type { CustomPageSchema, ScreenPageSchema } from '../types.js';
import { EmbedPageScreen } from './embed/EmbedPageScreen.js';
import { BullMqQueuePage } from './bullmq-queue/BullMqQueuePage.js';
import type { AdminExtensionPageProps } from './types.js';

type ExtensionPageComponent<TPage extends CustomPageSchema = CustomPageSchema> = (
  props: AdminExtensionPageProps<TPage>,
) => JSX.Element;
type AnyExtensionPageComponent = (props: AdminExtensionPageProps<CustomPageSchema>) => JSX.Element;

const screenRegistry: Record<string, ExtensionPageComponent<ScreenPageSchema>> = {
  'bullmq-queue-overview': BullMqQueuePage,
  'bullmq-queue-detail': BullMqQueuePage,
  'bullmq-queue-job-detail': BullMqQueuePage,
};

export function getExtensionPageComponent(
  page: CustomPageSchema,
): AnyExtensionPageComponent | null {
  if (page.kind === 'embed') {
    return EmbedPageScreen as unknown as AnyExtensionPageComponent;
  }

  return (screenRegistry[page.screen] as unknown as AnyExtensionPageComponent) ?? null;
}
