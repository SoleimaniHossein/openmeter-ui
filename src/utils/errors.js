// Helpers for turning API failures into friendly, actionable messages.
// Browsers mask CORS violations as generic network errors, so these are
// tagged centrally by the axios response interceptor in api/openmeter.js.

// A CORS failure surfaces as a network error (no response) sent to an origin
// different from the page's own origin.
export const isCorsError = (error) => Boolean(error?.isCors);

export const describeApiError = (error, fallback = 'Request failed') => {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (isCorsError(error)) {
    const target = error.corsTarget || '';
    return (
      `CORS error: the browser blocked the response from ${target || 'the target API'} because the ` +
      `backend does not allow this origin. Enable CORS on the OpenMeter backend, or set the API base ` +
      `URL to a relative /api path so requests go through the Vite proxy.`
    );
  }
  return error?.message || fallback;
};
