const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

/**
 * Extracts pagination params from query string
 * @param {object} query - Request query object
 * @returns {{ page: number, perPage: number, offset: number }}
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const rawPerPage = parseInt(query.per_page, 10);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number.isNaN(rawPerPage) ? DEFAULT_PER_PAGE : rawPerPage)
  );
  const offset = (page - 1) * perPage;

  return { page, perPage, offset };
}

/**
 * Builds paginated response object
 * @param {Array} data - Result rows
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} perPage - Items per page
 * @returns {{ data: Array, pagination: object }}
 */
function paginatedResponse(data, total, page, perPage) {
  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

module.exports = { parsePagination, paginatedResponse, DEFAULT_PER_PAGE, MAX_PER_PAGE };
