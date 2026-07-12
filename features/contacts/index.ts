/** Contacts module — referenti per azienda. */
export const CONTACTS_MODULE = "contacts" as const;

export { ContactsPage } from "./contacts-page";
export { ContactDetail } from "./components/contact-detail";
export { ContactForm } from "./components/contact-form";
export { buildContactSections } from "./utils/contact-fields";
export {
  createContactAction,
  updateContactAction,
  deleteContactAction,
} from "./actions/contact-mutations";
export {
  getContactById,
  listContactsByCompany,
  listCompanyOptions,
  type Contact,
  type ContactListItem,
} from "./services/contacts.service";
