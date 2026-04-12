export interface ResourceField {
  name: string;
  label: string;
  input: 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  enumValues?: string[];
  relation?: {
    kind: 'many-to-one' | 'many-to-many';
    option: {
      resource: string;
      labelField: string;
      valueField?: string;
    };
  };
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

export interface AdminDeleteSummaryItem {
  id: string;
  label: string;
}

export interface AdminDeleteSummary {
  resourceName: string;
  label: string;
  count: number;
  items: AdminDeleteSummaryItem[];
}

export interface ResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  objectLabel?: string;
  list: string[];
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  sortable: string[];
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
