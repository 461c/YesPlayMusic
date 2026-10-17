// A local freeze switch: existing data stays readable without contacting the API.
export function archiveMode() {
  try {
    return (
      JSON.parse(localStorage.getItem('settings') || '{}').archiveMode === true
    );
  } catch (_) {
    return false;
  }
}
export function archiveError() {
  const error = new Error('纪念模式：仅显示本地保存的内容');
  error.archive = true;
  return error;
}
