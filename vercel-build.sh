#!/bin/bash
set -e  # Exit immediately if a command fails

echo "Starting custom build process..."

# Print environment information
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Current directory: $(pwd)"

# List current files
echo "Files before build:"
ls -la

# Run TypeScript compilation
echo "Running tsc..."
npx tsc

# Debug TypeScript output
echo "Files after TypeScript compilation:"
ls -la
echo "Contents of dist directory (if exists):"
ls -la dist || echo "dist directory not found"

# Create api/dist directory
echo "Creating api/dist directory..."
mkdir -p api/dist

# Copy compiled files
echo "Copying files to api/dist..."
cp -r dist/* api/dist/ || echo "Copy failed, but continuing..."

# List final state
echo "Final file structure:"
ls -la
echo "Contents of api directory:"
ls -la api
echo "Contents of api/dist directory:"
ls -la api/dist || echo "api/dist directory is empty or not found"

echo "Custom build process completed!" 