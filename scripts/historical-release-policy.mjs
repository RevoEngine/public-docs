// A dated example keeps the API name that existed at that release. This is not
// a general exemption for deprecated methods in guides or other release pages.
export function permitsHistoricalMethod(page, method, content) {
  const historicalExceptions = [
    {
      page: 'changelog/1.0.3.mdx',
      method: 'api.transactionDatabaseData',
      historicalNote: 'This historical example uses the method name available in 1.0.3.',
      replacementNote: 'For new code, use `api.transactionDatabase()`; the older name is now deprecated.',
    },
    {
      page: 'changelog/1.3.1.mdx',
      method: 'api.getDatabaseViewData',
      historicalNote: 'This historical example uses the method name available in 1.3.1.',
      replacementNote: 'For new code, use `api.getDatabaseData()` with a View name; the older name is now deprecated.',
    },
    {
      page: 'changelog/1.5.7.mdx',
      method: 'api.getDatabaseViewData',
      historicalNote: 'This historical example uses the method name available in 1.5.7.',
      replacementNote: 'For new code, use `api.getDatabaseData()` with a View name; the older name is now deprecated.',
    },
    {
      page: 'changelog/1.3.2.mdx',
      method: 'api.sftpGet',
      historicalNote: 'This historical example uses the method name available in 1.3.2.',
      replacementNote: 'For new code, use `transport.sftpImport()` with a Secret-backed connection; the older name is now deprecated.',
    },
  ];
  return historicalExceptions.some((exception) => (
    page === exception.page
    && method === exception.method
    && content.includes(exception.historicalNote)
    && content.includes(exception.replacementNote)
  ));
}
