/**
 * S&P 500 annual total returns (nominal, including dividends) 1926–2024.
 * Source: Ibbotson SBBI / Damodaran / Yale Shiller data, widely cited.
 * Each entry: { year, return } where return is a percentage (e.g. 11.6 = 11.6%).
 */
export const SP500_ANNUAL_RETURNS: { year: number; return: number }[] = [
  { year: 1926, return: 11.6 }, { year: 1927, return: 37.5 }, { year: 1928, return: 43.6 },
  { year: 1929, return: -8.4 }, { year: 1930, return: -24.9 }, { year: 1931, return: -43.3 },
  { year: 1932, return: -8.2 }, { year: 1933, return: 54.0 }, { year: 1934, return: -1.4 },
  { year: 1935, return: 47.7 }, { year: 1936, return: 33.9 }, { year: 1937, return: -35.0 },
  { year: 1938, return: 31.1 }, { year: 1939, return: -0.4 }, { year: 1940, return: -9.8 },
  { year: 1941, return: -11.6 }, { year: 1942, return: 20.3 }, { year: 1943, return: 25.9 },
  { year: 1944, return: 19.7 }, { year: 1945, return: 36.4 }, { year: 1946, return: -8.1 },
  { year: 1947, return: 5.7 }, { year: 1948, return: 5.5 }, { year: 1949, return: 18.8 },
  { year: 1950, return: 31.7 }, { year: 1951, return: 24.0 }, { year: 1952, return: 18.4 },
  { year: 1953, return: -1.0 }, { year: 1954, return: 52.6 }, { year: 1955, return: 31.6 },
  { year: 1956, return: 6.6 }, { year: 1957, return: -10.8 }, { year: 1958, return: 43.4 },
  { year: 1959, return: 12.0 }, { year: 1960, return: 0.5 }, { year: 1961, return: 26.9 },
  { year: 1962, return: -8.7 }, { year: 1963, return: 22.8 }, { year: 1964, return: 16.5 },
  { year: 1965, return: 12.5 }, { year: 1966, return: -10.1 }, { year: 1967, return: 24.0 },
  { year: 1968, return: 11.1 }, { year: 1969, return: -8.5 }, { year: 1970, return: 4.0 },
  { year: 1971, return: 14.3 }, { year: 1972, return: 19.0 }, { year: 1973, return: -14.7 },
  { year: 1974, return: -26.5 }, { year: 1975, return: 37.2 }, { year: 1976, return: 23.8 },
  { year: 1977, return: -7.2 }, { year: 1978, return: 6.6 }, { year: 1979, return: 18.4 },
  { year: 1980, return: 32.4 }, { year: 1981, return: -4.9 }, { year: 1982, return: 21.4 },
  { year: 1983, return: 22.5 }, { year: 1984, return: 6.3 }, { year: 1985, return: 32.2 },
  { year: 1986, return: 18.5 }, { year: 1987, return: 5.2 }, { year: 1988, return: 16.8 },
  { year: 1989, return: 31.5 }, { year: 1990, return: -3.2 }, { year: 1991, return: 30.6 },
  { year: 1992, return: 7.7 }, { year: 1993, return: 10.0 }, { year: 1994, return: 1.3 },
  { year: 1995, return: 37.4 }, { year: 1996, return: 23.1 }, { year: 1997, return: 33.4 },
  { year: 1998, return: 28.6 }, { year: 1999, return: 21.0 }, { year: 2000, return: -9.1 },
  { year: 2001, return: -11.9 }, { year: 2002, return: -22.1 }, { year: 2003, return: 28.7 },
  { year: 2004, return: 10.9 }, { year: 2005, return: 4.9 }, { year: 2006, return: 15.8 },
  { year: 2007, return: 5.5 }, { year: 2008, return: -37.0 }, { year: 2009, return: 26.5 },
  { year: 2010, return: 15.1 }, { year: 2011, return: 2.1 }, { year: 2012, return: 16.0 },
  { year: 2013, return: 32.4 }, { year: 2014, return: 13.7 }, { year: 2015, return: 1.4 },
  { year: 2016, return: 12.0 }, { year: 2017, return: 21.8 }, { year: 2018, return: -4.4 },
  { year: 2019, return: 31.5 }, { year: 2020, return: 18.4 }, { year: 2021, return: 28.7 },
  { year: 2022, return: -18.1 }, { year: 2023, return: 26.3 }, { year: 2024, return: 25.0 },
]

export const SP500_START_YEAR = SP500_ANNUAL_RETURNS[0].year
export const SP500_END_YEAR = SP500_ANNUAL_RETURNS[SP500_ANNUAL_RETURNS.length - 1].year
