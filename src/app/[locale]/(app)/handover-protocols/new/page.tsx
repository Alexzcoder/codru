import { createBlankProtocol } from "../actions";

export default async function NewProtocolRedirect() {
  // Creates a blank protocol and redirects to its detail page.
  await createBlankProtocol();
  // createBlankProtocol() always redirects; this return is unreachable.
  return null;
}
