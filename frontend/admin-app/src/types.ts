export interface ResourceField {
  name: string;
  label: string;
  input: 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  enumValues?: string[];
}

export interface AdminUser {
  id: string;
  role: string;
  email?: string;
}

export interface AdminDisplayConfig {
  locale: string;
  dateFormat: Intl.DateTimeFormatOptions;
  dateTimeFormat: Intl.DateTimeFormatOptions;
}

export interface ResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  list: string[];
  listDisplayLinks: string[];
  search: string[];
  filters: string[];
  readonly: string[];
  actions: Array<{ name: string; slug: string }>;
  fields: ResourceField[];
}

export interface AdminMetaResponse {
  resources: ResourceSchema[];
  display: AdminDisplayConfig;
}

export interface ResourceMetaResponse {
  resource: ResourceSchema;
  filterOptions: Array<{ field: string; values: Array<string | number> }>;
  display?: AdminDisplayConfig;
}
