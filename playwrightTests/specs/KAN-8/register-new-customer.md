# KAN-8: Register a new customer

## Test Cases

### TC-01: Registration form is displayed from the home page
- AC: AC1
- Type: Positive
- Preconditions:
  - The customer is on the home page.
- Steps:
  1. Open the home page.
  2. Select the Register option.
- Expected Result:
  - The registration form is displayed and ready for entry.

### TC-02: Successful registration creates a new customer account
- AC: AC2
- Type: Positive
- Preconditions:
  - The customer is on the registration form.
  - The email address is not already associated with an existing account.
- Steps:
  1. Enter all required details.
  2. Use a new email address.
  3. Enter matching passwords.
  4. Submit the form.
- Expected Result:
  - Registration succeeds.
  - A confirmation is displayed to the customer.

### TC-03: Blank required field blocks registration
- AC: AC3
- Type: Negative
- Preconditions:
  - The customer is on the registration form.
- Steps:
  1. Leave at least one required field blank.
  2. Enter valid values in the remaining fields.
  3. Submit the form.
- Expected Result:
  - Registration is blocked.
  - A relevant validation message is displayed indicating the required field is missing.

### TC-04: Mismatched passwords block registration
- AC: AC3
- Type: Negative
- Preconditions:
  - The customer is on the registration form.
- Steps:
  1. Enter all required details with a new email address.
  2. Enter different values in the password fields.
  3. Submit the form.
- Expected Result:
  - Registration is blocked.
  - A relevant validation message is displayed explaining that the passwords do not match.

### TC-05: Duplicate email address prevents registration
- AC: AC4
- Type: Negative
- Preconditions:
  - The customer is on the registration form.
  - The email address already belongs to an existing account.
- Steps:
  1. Enter all required details.
  2. Use an email address that is already registered.
  3. Submit the form.
- Expected Result:
  - Registration is blocked.
  - An explanatory message is displayed indicating the email address is already associated with an account.

## Coverage Notes
- Boundary coverage is not applicable because the story does not define explicit minimum or maximum field-length, value-range, or date-boundary constraints.
