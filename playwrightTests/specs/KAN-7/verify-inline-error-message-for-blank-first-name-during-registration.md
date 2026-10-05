# KAN-7: Verify Inline Error Message for Blank First Name During Registration

## Test Cases

### TC-01: Blank First Name prevents registration and shows inline validation message
- AC: AC1
- Type: Negative
- Preconditions:
  - The user is on the registration page.
  - The First Name field is blank.
  - Other required fields contain valid values such as Last Name: Test, Email: sample.user@example.com, Password: Password123!, and Confirm Password: Password123!.
- Steps:
  1. Open the registration form.
  2. Enter valid values in all required fields except First Name.
  3. Leave First Name blank.
  4. Click the Register button.
- Expected Result:
  - The registration form is not submitted.
  - The inline error message "First name is required." is displayed near the First Name field.
  - The user remains on the registration page.

### TC-02: Registration rejection retains valid data entered in other fields
- AC: AC1
- Type: Negative
- Preconditions:
  - The user is on the registration page.
  - The First Name field is blank.
  - Other required fields already contain valid values such as Last Name: Test, Email: sample.user@example.com, Password: Password123!, and Confirm Password: Password123!.
- Steps:
  1. Review the valid entries already entered in the remaining required fields.
  2. Click the Register button.
- Expected Result:
  - The form is not submitted.
  - The inline error message "First name is required." is shown beside the First Name field.
  - The values already entered in the other fields remain populated.
  - The user remains on the registration page.

## Coverage Notes
- Positive-path coverage is not applicable for this story because the requested behavior is explicitly the validation failure when the First Name field is blank.
- Boundary coverage is not applicable because the story does not define any explicit min/max or edge-value rules for the First Name field.
