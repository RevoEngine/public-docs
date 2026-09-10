// A dated example keeps the API name that existed at that release. This is not
// a general exemption for deprecated methods in guides or other release pages.
export function permitsHistoricalMethod(page, method, content) {
  return page === 'changelog/1.0.3.mdx'
    && method === 'api.transactionDatabaseData'
    && content.includes('This historical example uses the method name available in 1.0.3.')
    && content.includes('For new code, use `api.transactionDatabase()`; the older name is now deprecated.');
}
