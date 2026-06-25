/**
 * Safari-safe form submission.
 *
 * `HTMLFormElement.requestSubmit()` (which runs validation + fires the form's
 * submit handler, unlike `.submit()`) is only supported in Safari 16+. On
 * older Safari it's `undefined`, so calling it throws
 * "form.requestSubmit is not a function" and trips the error boundary.
 *
 * This calls the native method when available and otherwise dispatches a
 * cancelable, bubbling `submit` event so React's onSubmit handler still runs.
 */
export function requestSubmit(form: HTMLFormElement | null | undefined): void {
  if (!form) return;
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}
