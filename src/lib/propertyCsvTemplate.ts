export const PROPERTY_CSV_HEADERS = ['name', 'street_address', 'city', 'state', 'zip_code', 'zone'];

export function downloadPropertyCsvTemplate() {
  const csv = [
    PROPERTY_CSV_HEADERS.join(','),
    'Sunset Apartments,123 Main St,Miami,FL,33101,North Zone',
    ',456 Oak Ave,Orlando,FL,32801,',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'properties-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
