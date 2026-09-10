# Event Management & Reservation System

Full-stack web application for managing events, organizers, users, tickets and reservations.

## About the Project

This project is a full-stack web application that provides a platform for creating, publishing and managing events.

The system supports multiple user roles with different permissions and functionalities. Students can browse events and make reservations, organizers can create and manage events, while administrators can manage users, events and organizer requests.

The application also includes authentication, authorization, ticket management, reservations and an administration dashboard.

## Features

### Student
- User registration and login
- Browse available events
- View event details
- Reserve tickets
- View reservations
- Leave reviews for events

### Organizer
- Request organizer approval
- Create and manage events
- Save events as drafts
- Publish events
- Manage ticket types
- Set ticket prices and available seats
- View reservations and ticket sales

### Administrator
- Manage users
- Approve or reject organizer requests
- Manage events
- Soft delete and restore users/events
- View application activity
- Access administration dashboard

## Technologies

### Frontend
- React
- JavaScript
- Vite
- HTML
- CSS

### Backend
- Node.js
- Express.js
- REST API
- JWT authentication

### Database
- MySQL

### Testing
- Vitest
- SuperTest
- V8 Coverage

### Other Tools
- Git
- GitHub
- npm

## Application Structure

The project is divided into frontend and backend parts:

```text
IS/
├── frontend/
│   ├── src/
│   └── public/
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   └── ...
│
├── package.json
└── README.md
