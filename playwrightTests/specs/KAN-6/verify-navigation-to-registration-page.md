# KAN-6: Verify Navigation to the Registration Page

## Test Cases

### TC-01: User can access the Demo Web Shop home page
- AC: AC1
- Type: Positive
- Preconditions:
  - A user has a working browser and network access.
- Steps:
  1. Navigate to the application URL specified in the story.
  2. Wait for the page to finish loading.
- Expected Result:
  - The application is reachable.
  - The home page is displayed without an error state.

### TC-02: Home page loads successfully
- AC: AC2
- Type: Positive
- Preconditions:
  - The user is on the application URL.
- Steps:
  1. Load the application home page.
  2. Observe the initial page state.
- Expected Result:
  - The page loads successfully.
  - The user sees the home page content and can continue to the next step.

### TC-03: Register link is visible and enabled
- AC: AC3
- Type: Positive
- Preconditions:
  - The home page has loaded successfully.
- Steps:
  1. Inspect the home page for the Register link.
  2. Confirm that the link is present and interactive.
- Expected Result:
  - The Register link is visible to the user.
  - The Register link is enabled and ready to be clicked.

### TC-04: User can navigate from the home page to the registration page
- AC: AC4
- Type: Positive
- Preconditions:
  - The Register link is visible and enabled.
- Steps:
  1. Click the Register link from the home page.
  2. Wait for the destination page to open.
- Expected Result:
  - The registration page opens successfully.
  - The user is taken to the registration flow.

### TC-05: Registration page URL contains the expected route
- AC: AC5
- Type: Positive
- Preconditions:
  - The user has clicked the Register link from the home page.
- Steps:
  1. Check the browser location after the page opens.
- Expected Result:
  - The browser URL contains /register.
  - The destination matches the expected registration page route.

### TC-06: Registration page title matches the expected title
- AC: AC6
- Type: Positive
- Preconditions:
  - The registration page is open.
- Steps:
  1. Inspect the browser page title.
- Expected Result:
  - The page title is "Demo Web Shop. Register".

## Boundary and Negative Coverage
- Boundary coverage: Not applicable for this story. The acceptance criteria define specific required page states and route/title checks, but they do not describe min/max values, invalid input ranges, or other boundary-driven rules.
- Negative coverage: Not applicable for this story as written. The story defines the successful navigation path and expected URL/title outcomes, but it does not specify an alternate invalid or blocked path to test.
