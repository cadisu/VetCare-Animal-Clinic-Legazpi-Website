import { FormField, TextAreaField } from "@/components/ui/FormField";
import { PhoneNumberField } from "@/components/clients/PhoneNumberField";

type Values = Partial<
  Record<
    "lastName" | "middleName" | "firstName" | "nameSuffix" | "address" | "birthdate" | "contactNumber",
    string
  >
>;

/** Personal fields used by both client registration and the "My Profile" page. */
export function ClientProfileFields({
  values,
  fieldErrors,
  maxBirthdate,
}: {
  values?: Values;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Today's date (YYYY-MM-DD), passed from the server. */
  maxBirthdate: string;
}) {
  return (
    <>
      <FormField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        required
        maxLength={60}
        defaultValue={values?.lastName}
        errors={fieldErrors?.lastName}
      />
      <FormField
        label="Middle name"
        labelNote="(optional)"
        name="middleName"
        autoComplete="additional-name"
        maxLength={60}
        defaultValue={values?.middleName}
        errors={fieldErrors?.middleName}
      />
      <FormField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        required
        maxLength={60}
        defaultValue={values?.firstName}
        errors={fieldErrors?.firstName}
      />
      <FormField
        label="Suffix"
        labelNote="(optional)"
        name="nameSuffix"
        autoComplete="honorific-suffix"
        maxLength={20}
        placeholder="Jr., Sr., III"
        defaultValue={values?.nameSuffix}
        errors={fieldErrors?.nameSuffix}
      />
      <TextAreaField
        label="Address"
        name="address"
        autoComplete="street-address"
        required
        maxLength={255}
        rows={2}
        placeholder="House no., street, barangay, city/municipality, province"
        defaultValue={values?.address}
        errors={fieldErrors?.address}
      />
      <FormField
        label="Birthdate"
        name="birthdate"
        type="date"
        autoComplete="bday"
        required
        min="1900-01-01"
        max={maxBirthdate}
        defaultValue={values?.birthdate}
        errors={fieldErrors?.birthdate}
      />
      <PhoneNumberField defaultValue={values?.contactNumber} errors={fieldErrors?.contactNumber} />
    </>
  );
}
