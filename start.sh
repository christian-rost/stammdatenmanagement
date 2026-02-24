#!/bin/bash

echo "Starting Stammdatenmanagement..."
echo ""

echo "Starting backend on http://localhost:8002..."
uv run python -m backend.main &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Stammdatenmanagement is running!"
echo "  Backend:  http://localhost:8002"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
