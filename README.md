# User Management API

A RESTful API for managing user data with SQLite database integration.

## Overview

This project provides a simple yet robust API for creating, retrieving, updating, and deleting user records. It includes validation for user data and manages relationships between users and managers.

## Features

- **User Management**: Create, retrieve, update, and delete user records
- **Data Validation**: Validates mobile numbers and PAN card numbers
- **Manager Integration**: Ensures users are assigned to active managers
- **Soft Delete**: Preserves data integrity by marking records as inactive instead of permanent deletion
- **Transaction Support**: Ensures data consistency during complex operations

## Tech Stack

- Node.js
- Express.js
- SQLite3
- UUID generation

## Prerequisites

- Node.js (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/user-management-api.git
   cd user-management-api
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the server
   ```
   npm start
   ```

The server will start on port 3000 by default.

## Database Schema

The application uses an SQLite database with the following tables:

### Users Table
- `user_id`: Unique identifier (UUID)
- `full_name`: User's full name
- `mob_num`: Mobile number (10 digits)
- `pan_num`: PAN card number (format: ABCDE1234F)
- `manager_id`: Reference to a manager
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `is_active`: Boolean flag (1 for active, 0 for inactive)

### Managers Table
- `manager_id`: Unique identifier
- `is_active`: Boolean flag (1 for active, 0 for inactive)

## API Endpoints

### Create User
```
POST /create_user
```
Creates a new user with validation for required fields.

**Request Body:**
```json
{
  "full_name": "John Doe",
  "mob_num": "9876543210",
  "pan_num": "ABCDE1234F",
  "manager_id": "manager-uuid"
}
```

### Get Users
```
POST /get_users
```
Retrieves users based on filters.

**Request Body:**
```json
{
  "user_id": "user-uuid", // Optional
  "mob_num": "9876543210", // Optional
  "manager_id": "manager-uuid" // Optional
}
```

### Update User
```
POST /update_user
```
Updates user information with validation.

**Request Body:**
```json
{
  "user_ids": ["user-uuid"],
  "update_data": {
    "full_name": "Jane Doe", // Optional
    "mob_num": "9876543210", // Optional
    "pan_num": "ABCDE1234F", // Optional
    "manager_id": "new-manager-uuid" // Optional
  }
}
```

**Bulk Manager Update:**
```json
{
  "user_ids": ["user-uuid1", "user-uuid2", "user-uuid3"],
  "update_data": {
    "manager_id": "new-manager-uuid"
  }
}
```

### Delete User
```
POST /delete_user
```
Soft deletes a user by marking them as inactive.

**Request Body:**
```json
{
  "user_id": "user-uuid" // Either user_id or mob_num is required
}
```
OR
```json
{
  "mob_num": "9876543210" // Either user_id or mob_num is required
}
```

## Data Validation

- **Mobile Number**: Must be 10 digits. Automatically strips prefixes like +91 or 0.
- **PAN Number**: Must follow the format ABCDE1234F (5 letters, 4 numbers, 1 letter).
- **Manager**: Must exist and be active in the system.

## Error Handling

The API returns appropriate HTTP status codes with descriptive error messages:

- `400 Bad Request`: For validation errors
- `404 Not Found`: When a requested resource doesn't exist
- `500 Internal Server Error`: For server-side errors

## License

[Include your license information here]
