export function musicQualityLevel(value) {
  return (
    {
      128000: 'standard',
      192000: 'higher',
      320000: 'exhigh',
      flac: 'lossless',
      999000: 'hires',
    }[value] || 'exhigh'
  );
}
