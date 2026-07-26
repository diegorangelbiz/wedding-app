// Passcode for the unlisted /admin page. It lives in code because Webflow Cloud
// drops `vars` from wrangler.json, so there is no environment secret to read —
// see the README. It is never rendered into the page: the browser sends whatever
// the operator typed and the server compares here, so the passcode is not
// recoverable from the served HTML or JS.
//
// To rotate it, change this value and redeploy.
export const ADMIN_PASSCODE = "AD-L2ZE-3KEA";

export function isAuthorised(request: Request): boolean {
  return request.headers.get("x-admin-passcode") === ADMIN_PASSCODE;
}
