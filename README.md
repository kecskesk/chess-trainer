# ChessTrainer

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 7.1.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

## Deploy to Firebase Hosting (free tier)

This app is configured for static Firebase Hosting using `dist/chess-trainer`.

### 1) Keep it free

- Use **Firebase Spark plan** (free).
- Do **not** enable paid products for this app (Cloud Functions 2nd gen, App Hosting, Blaze-only services).
- If you add a billing card, set a very low Google Cloud budget alert immediately.

### 2) One-time setup

1. Install the Firebase CLI (or use `npx`):

	```bash
	npm i -g firebase-tools
	```

2. Login:

	```bash
	firebase login
	```

3. Create a Firebase project in console (Spark plan), then copy `.firebaserc.example` to `.firebaserc` and set your project id.

### 3) Deploy

```bash
npm run firebase:deploy
```

For a preview channel:

```bash
npm run firebase:preview
```
