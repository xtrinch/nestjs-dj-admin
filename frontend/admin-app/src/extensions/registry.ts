import type { JSX } from 'react';
import type { CustomPageSchema, ResourceDetailPanelSchema, ScreenPageSchema } from '../types.js';
import { EmbedPageScreen } from './embed/EmbedPageScreen.js';
import { BullMqQueuePage, BullMqRelatedJobsPanel } from './bullmq-queue/BullMqQueuePage.js';
import type { AdminExtensionDetailPanelProps, AdminExtensionPageProps } from './types.js';

type ExtensionPageComponent<TPage extends CustomPageSchema = CustomPageSchema> = (
  props: AdminExtensionPageProps<TPage>,
) => JSX.Element;
type AnyExtensionPageComponent = (props: AdminExtensionPageProps<CustomPageSchema>) => JSX.Element;
type ExtensionDetailPanelComponent = (props: AdminExtensionDetailPanelProps) => JSX.Element | null;

const screenRegistry: Record<string, ExtensionPageComponent<ScreenPageSchema>> = {
  'bullmq-queue-overview': BullMqQueuePage,
  'bullmq-queue-detail': BullMqQueuePage,
  'bullmq-queue-job-detail': BullMqQueuePage,
};

const detailPanelRegistry: Record<string, ExtensionDetailPanelComponent> = {
  'bullmq-related-jobs': BullMqRelatedJobsPanel,
};

export function getExtensionPageComponent(
  page: CustomPageSchema,
): AnyExtensionPageComponent | null {
  if (page.kind === 'embed') {
    return EmbedPageScreen as unknown as AnyExtensionPageComponent;
  }

  return (screenRegistry[page.screen] as unknown as AnyExtensionPageComponent) ?? null;
}

export function getExtensionDetailPanelComponent(
  panel: ResourceDetailPanelSchema,
): ExtensionDetailPanelComponent | null {
  return detailPanelRegistry[panel.screen] ?? null;
}
