export interface ResourceField {
  name: string;
  label: string;
  input: 'text' | 'email' | 'number' | 'checkbox' | 'date' | 'select' | 'multiselect';
  required: boolean;
  readOnly: boolean;
  enumValues?: string[];
}

export interface ResourceSchema {
  resourceName: string;
  label: string;
  category: string;
  list: string[];
  search: string[];
  filters: string[];
  readonly: string[];
  actions: Array<{ name: string; slug: string }>;
  fields: ResourceField[];
}

export interface AdminMetaResponse {
  resources: ResourceSchema[];
}
