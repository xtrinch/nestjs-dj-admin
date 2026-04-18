import type { AdminDisplayConfig, AdminUser, CustomPageSchema } from '../types.js';

export type AdminExtensionPageProps<TPage extends CustomPageSchema = CustomPageSchema> = {
  display: AdminDisplayConfig;
  page: TPage;
  pagePath: string;
  params: Record<string, string>;
  user: AdminUser;
  onTitleChange?: (label: string | null) => void;
};
