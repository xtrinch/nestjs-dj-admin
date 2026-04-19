import type {
  AdminDisplayConfig,
  AdminUser,
  CustomPageSchema,
  ResourceDetailPanelSchema,
  ResourceSchema,
} from '../types.js';

export type AdminExtensionPageProps<TPage extends CustomPageSchema = CustomPageSchema> = {
  display: AdminDisplayConfig;
  page: TPage;
  pagePath: string;
  params: Record<string, string>;
  user: AdminUser;
  onTitleChange?: (label: string | null) => void;
};

export type AdminExtensionDetailPanelProps = {
  display: AdminDisplayConfig;
  panel: ResourceDetailPanelSchema;
  resource: ResourceSchema;
  record: Record<string, unknown>;
  user: AdminUser;
};
