# WordPress Site Manager

This project is a simple web application that allows you to easily create WordPress websites locally. It uses Docker to create and run each WordPress site in an seperate environment, providing a clean and efficient way to handle multiple wordpress sites.

## How It Works

The application consists of two main parts:

1.  **Backend**: A Python Flask server that handles the logic for creating and managing Docker containers. It dynamically generates `docker-compose.yml` files for each WordPress site, which includes a WordPress service and a MariaDB database service. It also manages site metadata in a JSON file.

2.  **Frontend**: A Next.js application that provides a user interface to interact with the backend. Users can create new sites by providing a name and description, and then manage their existing sites from a central dashboard.

## Technologies Used

-   **Backend**:
    -   Python
    -   Flask
    -   Docker SDK for Python
    -   PyYAML

-   **Frontend**:
    -   Next.js
    -   React
    -   TypeScript
    -   Tailwind CSS

## Getting Started

### Prerequisites

-   Docker and Docker Compose
-   Python 3.x and pip
-   Node.js and npm

### Installation & Running

**Backend**
```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the Flask server
python app.py
```

**Frontend**
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

Once both servers are running, you can access the application in your browser at `http://localhost:3000`.