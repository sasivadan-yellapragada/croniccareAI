# CronicCareAI

CronicCareAI is a full-stack web application designed to help users monitor their health, predict potential risks, and receive AI-driven lifestyle advice. It features a React-based frontend and a Python FastAPI backend with a machine learning model.

## ✨ Features

-   **Health Risk Prediction**: Analyzes user-provided vitals and lifestyle information to predict health risk levels (Low, Medium, High).
-   **AI Health Assistant**: An interactive chatbot powered by Groq's LLaMA 3.1 for personalized health advice and answers to user queries.
-   **Dashboard**: A comprehensive overview of the user's health profile, recent vital signs, risk scores, and upcoming tests.
-   **Report Analysis**: Upload medical reports (PDF/Image) to extract key metrics using OCR and receive an AI-generated summary.
-   **History Tracking**: View historical data for vitals and chat interactions.
-   **User Authentication**: Secure user registration and login.
-   **Medication Management**: Log and track medications.

## 🛠️ Tech Stack

| Category      | Technology                                                                                             |
| :------------ | :----------------------------------------------------------------------------------------------------- |
| **Frontend**  | [React](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling**   | [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)                           |
| **Backend**   | [FastAPI](https://fastapi.tiangolo.com/) (Python)                                                      |
| **Database**  | [MongoDB](https://www.mongodb.com/)                                                                    |
| **ML/AI**     | [Scikit-learn](https://scikit-learn.org/), [Pandas](https://pandas.pydata.org/), [Groq](https://groq.com/) |
| **Testing**   | [Vitest](https://vitest.dev/)                                                                          |

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later) and [npm](https://www.npmjs.com/)
-   [Python](https://www.python.org/) (v3.9 or later) and `pip`
-   [MongoDB](https://www.mongodb.com/try/download/community) running locally or a cloud instance.

### 1. Clone the Repository

```sh
git clone <YOUR_GIT_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

### 2. Backend Setup

a. **Install Python dependencies:**

```sh
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install requirements
pip install -r requirements.txt
```

b. **Configure Environment Variables:**

Create a `.env` file in the `backend` directory by copying the example file.

```sh
cp .env.example .env
```

Now, edit `backend/.env` and add your configuration:

-   `MONGODB_URI`: Your MongoDB connection string (e.g., `mongodb://localhost:27017`).
-   `GROQ_API_KEY`: Your API key from [Groq](https://console.groq.com/keys).

c. **Train the ML Model:**

This step is required once to generate the `model.joblib` artifact.

```sh
python3 -m ml.train
```

d. **Run the Backend Server:**

The backend will run on `http://localhost:8000`.

```sh
uvicorn main:app --reload
```

### 3. Frontend Setup

a. **Install Node.js dependencies:**

In a new terminal, navigate to the project's root directory.

```sh
npm install
```

b. **Run the Frontend Development Server:**

The frontend will be available at `http://localhost:5173`. It is pre-configured to proxy API requests from `/api` to the backend at `http://localhost:8000`.

```sh
npm run dev
```

You can now access the application in your browser at `http://localhost:5173`.

## 🧪 Running Tests

To run the frontend unit tests, use the following command in the root directory:

```sh
npm test
```

## 📂 Project Structure

```
.
├── backend/            # FastAPI application
│   ├── ml/             # Machine learning model and training scripts
│   ├── rag/            # Retrieval-Augmented Generation files
│   ├── main.py         # FastAPI app entrypoint
│   └── requirements.txt  # Python dependencies
│
├── public/             # Static assets
│
├── src/                # React application source
│   ├── components/     # Shared UI components
│   ├── lib/            # Utility functions and API helpers
│   ├── pages/          # Page components
│   ├── App.tsx         # Main app component with routing
│   └── main.tsx        # React app entrypoint
│
├── package.json        # Project metadata and npm scripts
└── vite.config.ts      # Vite configuration
```
