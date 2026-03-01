/**
 * Seqta module type UUIDs used for content rendering.
 * These identify different module types in the course document structure.
 */
export const MODULE_TYPE_UUIDS = {
  /** Legacy editor / table module type */
  LEGACY_EDITOR: '0d49d130-c197-421d-a56a-d1ba0a67cfc0',
  /** Preview Lexical module type */
  PREVIEW_LEXICAL: 'f388e4f9-b350-4ee8-964b-2618ea4a037a',
  /** Column layout module type */
  COLUMN_LAYOUT: 'c082b45f-abf5-41fa-9c15-74233ab52c91',
  /** Link module type */
  LINK: 'e3f1b225-d159-4a7f-bc84-2fddf05ed6d6',
  /** Formula module type */
  FORMULA: 'b30fef7f-528f-4c0c-bfb4-0cc78e77767a',
} as const;
