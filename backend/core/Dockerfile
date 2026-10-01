# Use a lightweight official Python image
FROM python:3.11-slim

# 1. Set the working directory inside the container FIRST
WORKDIR /app

# 2. Copy ONLY requirements.txt first to leverage Docker's caching system
COPY requirements.txt .

# 3. Install dependencies now that requirements.txt physically exists inside /app
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy everything else from backend/core/ into /app
COPY . .

# 5. Expose the port FastAPI runs on
EXPOSE 8000

# 6. Run Uvicorn bound to 0.0.0.0 (Crucial for Docker containers to be reachable)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
