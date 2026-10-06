# KAN-9: Verify login and logout

## Test Cases

### TC-01: Successful login for a registered customer
- AC: AC1
- Type: Positive
- Preconditions:
  - The user has a registered account.
  - The user knows the correct credentials.
- Steps:
  1. Open the login flow.
  2. Enter the valid username or email and password for the registered account.
  3. Select "Log in".
- Expected Result:
  - The user is signed in.
  - The account is accessible for the signed-in session.

### TC-02: Login is denied for an incorrect password
- AC: AC2
- Type: Negative
- Preconditions:
  - The user has a registered account.
  - The user enters an incorrect password.
- Steps:
  1. Open the login flow.
  2. Enter a valid username or email for the account.
  3. Enter an incorrect password.
  4. Select "Log in".
- Expected Result:
  - Access is denied.
  - An error message is displayed explaining that the login failed.
  - The user remains signed out.

### TC-03: Successful logout ends the current session
- AC: AC3
- Type: Positive
- Preconditions:
  - The user is already signed in.
- Steps:
  1. Select "Log out".
- Expected Result:
  - The signed-in session ends.
  - The user is signed out.
  - The login option is available again for a new session.

## Coverage Notes
- Negative coverage is covered by the invalid password scenario in AC2.
- Boundary coverage is not applicable because the story does not define explicit minimum, maximum, or edge-value limits for credentials or session behavior.
