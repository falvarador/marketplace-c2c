# frontend-auth-and-state Specification

## Purpose

Defines the client-side authentication state management, PocketBase singleton integration, reactive favorites synchronization, login/registration flows (Email/Password and OAuth2), and route protection in the Preact SPA.

## Requirements

### Requirement: Singleton PocketBase Client and Reactive Auth Store
The frontend application SHALL maintain a singleton PocketBase client and expose reactive state signals for the current authenticated user, authentication validity, and the list of favorite record mappings (`listingId -> favoriteRecordId`) synchronized with the backend.

#### Scenario: Session restoration and favorites synchronization on app startup
- **WHEN** the SPA loads with a valid token stored in `pb.authStore`
- **THEN** the reactive auth store exposes the authenticated user record and automatically fetches the user's `favorites` records into the reactive favorites store

#### Scenario: Clearing state on logout
- **WHEN** the user triggers logout
- **THEN** `pb.authStore.clear()` is executed and the reactive user state and favorites list are immediately reset to empty

### Requirement: Email/Password and OAuth2 Authentication UI
The frontend SHALL provide a Login and Registration modal or view allowing users to:
- Register a new account with name, email, password, Costa Rica `phone` (WhatsApp), and `province`
- Sign in using email and password
- Sign in with one click via OAuth2 ("Continuar con Google" and "Continuar con Facebook") using `pb.collection('users').authWithOAuth2()`

#### Scenario: User logs in with email and password
- **WHEN** a user submits valid credentials in the Login form
- **THEN** the user is authenticated, their reactive session and favorites load, and the modal closes or redirects to the target route

#### Scenario: User authenticates via Google or Facebook OAuth2
- **WHEN** a user clicks "Continuar con Google" or "Continuar con Facebook"
- **THEN** the client invokes `pb.collection('users').authWithOAuth2({ provider })` and updates the reactive auth store upon completion

### Requirement: Protected Routes for Authenticated Actions
The frontend router SHALL protect `/anunciar`, `/editar/:id`, `/favoritos`, and `/mis-anuncios` so that unauthenticated visitors are prompted to log in before accessing those views.

#### Scenario: Unauthenticated visitor navigates to publish route
- **WHEN** an unauthenticated user navigates to `/anunciar`
- **THEN** the application prevents rendering the creation form and displays the Login/Registration view or modal
