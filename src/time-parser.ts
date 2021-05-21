/**
 * Returns milliseconds by input string\
 * Fork of https://github.com/vercel/ms
 *
 * Example:
 * ```ts
 * ms('1 day'); // --> 86400000
 * ms('1d'); // --> 86400000
 * ms('5sec'); // --> 5000
 * ms('2 months'); // --> 5259600000
 * ```
 */
const ms = (input: string | number): number => {
  const regex = new RegExp(/^(\d*\.?\d+) *(month?|months?|milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/);
  const value = String(input).toLowerCase();
  const match = regex.exec(value);
  const time: Record<string, number> = {
    ms: 1,
    mo: 26298e5,
    s: 1e3,
    m: 6e4,
    h: 36e5,
    d: 864e5,
    w: 6048e5,
    y: 315576e5,
  };

  if (value.length > 100 || !match || match.length < 3) {
    return 0;
  }

  const type = (match[2] || 'ms');
  let key = type[0];

  if (type.match(/^(ms|mil)/)) {
    key = 'ms';
  }

  if (type.match(/^mo/)) {
    key = 'mo';
  }

  const factor = time[key];

  return parseFloat(match?.[1] || '0') * factor;
}

export default ms;
