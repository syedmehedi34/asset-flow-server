# 📝 AssetFlow - Website Backend

This is a backend API for the **AssetFlow** platform, built using **Express**, **MongoDB**, **JWT**, and **Stripe**. It allows HR managers to manage assets, handle employee requests, process payments, and assign roles for users. The API includes endpoints for authentication, asset management, user management, and payment processing.

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [⚙️ Prerequisites](#%EF%B8%8F-prerequisites)
- [🚀 Installation](#-installation)
- [🔑 Environment Variables](#-environment-variables)
- [📂 Usage](#-usage)
- [📚 API Endpoints](#-api-endpoints)
- [🔒 Authentication](#-authentication)
- [🛠 Error Handling](#-error-handling)

---

## ✨ Features

- 🔐 **Secure Authentication**: Robust JWT and HTTP-only using local storage.
- 📝 **Asset Management**: Add, update, delete, and search assets.
- 💬 **Counting**: Real time counting for the assets.
- 📌 **Update**: Update any assets.
- 🔍 **Search & Filter**: Filter assets and employees by category or search by text.
- 🌟 **Employee route**: For the employees their is protected routes.
- 🕒 **HR manager route**: For the Manager their is protected routes.

---

## ⚙️ Prerequisites

Make sure you have the following installed:

- **Node.js** (v14 or later)
- **MongoDB** (Atlas or local instance)
- **NPM** or **Yarn**
- A `.env` file with the necessary environment variables.

---

## 🔑 Environment Variables

Create a `.env` file in the root directory of your project and add the following variables:

````env
PORT=5001
ACCESS_TOKEN_SECRET=your_secret_key
DB_USER=your_db_username
DB_PASS=your_db_password```
````

## 📂 Usage

Follow these steps to use the backend server:

1. **Start the Server**:
   Run the following command in the terminal to start the server:

   ```bash
   npx nodemon index.js
   Access the APIs at `https://nextblog-phi-ten.vercel.app/`
   ```

   ## 📚 API Endpoints

The backend provides the following API endpoints:

## API Endpoints

| **Method** | **Endpoint**             | **Description**                                                            | **Request Body** / **Query Params**                                      | **Response**                                                                   |
| ---------- | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **POST**   | `/jwt`                   | Generate a JWT token for a user.                                           | `{ "email": "user-email" }`                                              | `{ "token": "JWT-token" }`                                                     |
| **GET**    | `/users/admin/:email`    | Check if a user is an admin (HR manager).                                  | `email` (user email)                                                     | `{ "role": "hr_manager" }` or `{ "role": "employee" }`                         |
| **POST**   | `/users`                 | Create a new user.                                                         | `{ "email": "user-email", "role": "employee/hr_manager", ... }`          | `{ "message": "user already exists", "insertedId": null }` or user data object |
| **PATCH**  | `/users`                 | Update user data (e.g., name, photo, company logo).                        | `{ "_id": "user-id", "name": "user-name", "photo": "user-photo-url" }`   | Updated user data object                                                       |
| **GET**    | `/assets`                | Get all assets based on filters like `hr_email`, `searchText`, `category`. | `hr_email`, `searchText`, `category` query params                        | List of assets                                                                 |
| **POST**   | `/assets`                | Add a new asset (only HR managers).                                        | `{ "assetName": "Asset Name", "assetType": "Returnable", ... }`          | New asset data                                                                 |
| **PATCH**  | `/assets`                | Update asset information (e.g., returnable assets).                        | `{ "assetID": "asset-id", "quantity": 1 }`                               | Updated asset data                                                             |
| **POST**   | `/create-payment-intent` | Create a Stripe payment intent.                                            | `{ "price": <amount> }`                                                  | `{ "clientSecret": "client-secret-for-payment" }`                              |
| **POST**   | `/payments`              | Record a payment and update user package.                                  | Payment data `{ "email": "user-email", "packageId": "package-id", ... }` | Payment result and update data                                                 |
| **GET**    | `/asset_distribution`    | Get asset distribution data based on filters.                              | `hr_email`, `requestStatus`, `searchText`, `category` query params       | List of asset distribution data                                                |
| **POST**   | `/asset_distribution`    | Add a new asset distribution request.                                      | `{ "assetName": "asset-name", "employeeEmail": "employee-email", ... }`  | New asset distribution data                                                    |

## 🛠 Error Handling

The backend handles errors gracefully and provides meaningful HTTP status codes and responses to guide the user. Below are the common errors and their meanings:

| HTTP Status Code              | Meaning                  | Description                                                            |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| **400 Bad Request**           | Invalid Input            | The client sent invalid data (e.g., malformed JSON or missing fields). |
| **401 Unauthorized**          | Missing or Invalid Token | The request lacks a valid JWT token or the token has expired.          |
| **403 Forbidden**             | Permission Denied        | The user does not have the necessary permissions for the action.       |
| **404 Not Found**             | Resource Not Found       | The requested resource (e.g., blog, comment) does not exist.           |
| **500 Internal Server Error** | Server Error             | An unexpected error occurred on the server side.                       |

## 👥 Contributor

- **Name** - Syed Meehdi Hasan
- **Email** - syedmehedi34@gmail.com
