const {
  parsePagination,
  paginatedResponse,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
} = require('../../src/utils/pagination');

describe('parsePagination', () => {
  it('should return default values when query is empty', () => {
    const result = parsePagination({});
    expect(result).toEqual({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      offset: 0,
    });
  });

  it('should parse custom page and per_page values', () => {
    const result = parsePagination({ page: '3', per_page: '10' });
    expect(result).toEqual({
      page: 3,
      perPage: 10,
      offset: 20,
    });
  });

  it('should calculate correct offset for page 2', () => {
    const result = parsePagination({ page: '2', per_page: '15' });
    expect(result.offset).toBe(15);
  });

  it('should clamp page to minimum of 1 when given 0', () => {
    const result = parsePagination({ page: '0' });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('should clamp page to minimum of 1 when given negative value', () => {
    const result = parsePagination({ page: '-5' });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('should clamp per_page to minimum of 1 when given 0', () => {
    const result = parsePagination({ per_page: '0' });
    expect(result.perPage).toBe(1);
  });

  it('should clamp per_page to minimum of 1 when given negative value', () => {
    const result = parsePagination({ per_page: '-10' });
    expect(result.perPage).toBe(1);
  });

  it('should cap per_page at MAX_PER_PAGE when given value too large', () => {
    const result = parsePagination({ per_page: '9999' });
    expect(result.perPage).toBe(MAX_PER_PAGE);
  });

  it('should handle non-numeric strings by using defaults', () => {
    const result = parsePagination({ page: 'abc', per_page: 'xyz' });
    expect(result).toEqual({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      offset: 0,
    });
  });

  it('should handle undefined values', () => {
    const result = parsePagination({ page: undefined, per_page: undefined });
    expect(result).toEqual({
      page: 1,
      perPage: DEFAULT_PER_PAGE,
      offset: 0,
    });
  });
});

describe('paginatedResponse', () => {
  it('should return correct format with data and pagination', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = paginatedResponse(data, 50, 1, 25);

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        page: 1,
        perPage: 25,
        total: 50,
        totalPages: 2,
      },
    });
  });

  it('should calculate totalPages correctly with exact division', () => {
    const result = paginatedResponse([], 100, 1, 25);
    expect(result.pagination.totalPages).toBe(4);
  });

  it('should round up totalPages when there is a remainder', () => {
    const result = paginatedResponse([], 101, 1, 25);
    expect(result.pagination.totalPages).toBe(5);
  });

  it('should return totalPages 0 when total is 0', () => {
    const result = paginatedResponse([], 0, 1, 25);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('should return totalPages 1 when total equals perPage', () => {
    const result = paginatedResponse([], 25, 1, 25);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('should include the provided data array as-is', () => {
    const data = [{ id: 1, nome: 'Test' }];
    const result = paginatedResponse(data, 1, 1, 25);
    expect(result.data).toBe(data);
  });
});
