/*
  # Add Range and File Upload Custom Field Types

  1. Changes
    - Update the field_type check constraint in custom_fields table
    - Add support for: range, file_upload
    - Previous types: text, dropdown_single, dropdown_multiple, date, number, email, phone, url, currency, longtext
    - New types: range, file_upload

  2. Field Types
    - range: For numeric range inputs with min/max values
    - file_upload: For file attachments and uploads

  3. Notes
    - This migration safely adds new field types without affecting existing data
    - All existing fields with previous types remain valid
    - Range fields can store min/max values in dropdown_options as JSON
    - File upload fields will store file URLs/paths
*/

-- Drop the existing check constraint
ALTER TABLE custom_fields
  DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

-- Add the updated check constraint with all field types including range and file_upload
ALTER TABLE custom_fields
  ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type IN (
    'text',
    'dropdown_single',
    'dropdown_multiple',
    'date',
    'number',
    'email',
    'phone',
    'url',
    'currency',
    'longtext',
    'range',
    'file_upload'
  ));
