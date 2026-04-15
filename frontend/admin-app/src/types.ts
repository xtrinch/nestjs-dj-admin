export interface ResourceField {
  name: string;
  label: string;
  input: 'text' | 'email' | 'tel' | 'url' | 'password' | 'number' | 'checkbox' | 'date' | 'time' | 'datetime-local' | 'textarea' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  modes?: Array<'create' | 'update'>;
  helpText?: string;
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

export interface AdminDeleteRelatedSummary {
  field: string;
  label: string;
  count: number;
  items: AdminDeleteSummaryItem[];
}

export interface AdminDeleteImpactGroup {
  resourceName: string;
  label: string;
  count: number;
  items: AdminDeleteSummaryItem[];
  via?: string;
}

export interface AdminDeleteSummary {
  resourceName: string;
  label: string;
  count: number;
  mode?: 'delete' | 'soft-delete';
  items: AdminDeleteSummaryItem[];
  related: AdminDeleteRelatedSummary[];
  impact: {
    delete: AdminDeleteImpactGroup[];
    disconnect: AdminDeleteImpactGroup[];
    blocked: AdminDeleteImpactGroup[];
  };
}

export interface AdminLookupItem {
  value: string;
  label: string;
}

export interface AdminLookupResponse {
  items: AdminLookupItem[];
  total: number;
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
  bulkActions: Array<{ name: string; slug: string }>;
  fields: ResourceField[];
  createFields: ResourceField[];
  updateFields: ResourceField[];
  softDelete?: {
    enabled: boolean;
    fieldName: string;
    filterField: '__softDeleteState';
  };
  password?: {
    enabled: boolean;
    helpText?: string;
  };
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
